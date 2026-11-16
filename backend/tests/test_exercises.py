import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, get_password_hash
from app.db.models import User


@pytest.mark.asyncio
async def test_exercise_crud_flow(client: AsyncClient, seed_test_users, athlete_token, admin_token):
    headers_athlete = {"Authorization": f"Bearer {athlete_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Athlete adds a custom exercise: usable right away, private to them (no approval)
    payload = {
        "name": "Bulgarian Split Squat",
        "category": "compound",
        "muscle_group": "legs",
        "met_value": 6.5,
    }
    create_resp = await client.post("/api/v1/exercises", json=payload, headers=headers_athlete)
    assert create_resp.status_code == 201
    assert "Location" in create_resp.headers
    ex_data = create_resp.json()
    ex_id = ex_data["id"]
    assert ex_data["status"] == "private"

    # 2. List with filtering and pagination (Requirement B6): built-ins + my custom ones
    list_resp = await client.get(
        "/api/v1/exercises?muscle_group=legs&page=1&limit=10", headers=headers_athlete
    )
    assert list_resp.status_code == 200
    names = [e["name"] for e in list_resp.json()["data"]]
    assert "Bulgarian Split Squat" in names
    assert list_resp.json()["meta"]["total"] >= 1

    mine = await client.get("/api/v1/exercises?mine=true", headers=headers_athlete)
    assert [e["id"] for e in mine.json()["data"]] == [ex_id]

    # 3. Duplicate name is rejected (409)
    dup = await client.post("/api/v1/exercises", json=payload, headers=headers_athlete)
    assert dup.status_code == 409

    # 4. Athlete can rename their own exercise, but can't move it into the shared library
    rename = await client.patch(
        f"/api/v1/exercises/{ex_id}", json={"name": "Split Squat (DB)"}, headers=headers_athlete
    )
    assert rename.status_code == 200
    forbidden_resp = await client.patch(
        f"/api/v1/exercises/{ex_id}", json={"status": "approved"}, headers=headers_athlete
    )
    assert forbidden_resp.status_code == 403

    # 5. Admin can add an athlete's exercise to the shared library
    admin_resp = await client.patch(
        f"/api/v1/exercises/{ex_id}", json={"status": "approved"}, headers=headers_admin
    )
    assert admin_resp.status_code == 200
    assert admin_resp.json()["status"] == "approved"

    # 6. Get single exercise (200) and delete (204)
    get_resp = await client.get(f"/api/v1/exercises/{ex_id}", headers=headers_athlete)
    assert get_resp.status_code == 200
    del_resp = await client.delete(f"/api/v1/exercises/{ex_id}", headers=headers_admin)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_custom_exercises_are_private(
    client: AsyncClient, db_session, seed_test_users, athlete_token
):
    other = User(
        id=3,
        email="other@example.com",
        password_hash=get_password_hash("Password123!"),
        full_name="Other Athlete",
        role="athlete",
    )
    db_session.add(other)
    await db_session.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(subject=3, role='athlete')}"}

    created = await client.post(
        "/api/v1/exercises",
        json={"name": "My Secret Curl", "muscle_group": "arms"},
        headers={"Authorization": f"Bearer {athlete_token}"},
    )
    ex_id = created.json()["id"]

    # Another athlete can't see, edit or delete it
    listed = await client.get("/api/v1/exercises?q=secret", headers=other_headers)
    assert listed.json()["meta"]["total"] == 0
    assert (
        await client.get(f"/api/v1/exercises/{ex_id}", headers=other_headers)
    ).status_code == 404
    assert (
        await client.patch(f"/api/v1/exercises/{ex_id}", json={"name": "x2"}, headers=other_headers)
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/exercises/{ex_id}", headers=other_headers)
    ).status_code == 404

    # Athletes can't edit built-in exercises
    builtin = await client.patch(
        "/api/v1/exercises/1", json={"name": "Renamed"}, headers=other_headers
    )
    assert builtin.status_code == 403


@pytest.mark.asyncio
async def test_exercises_require_login(client: AsyncClient, seed_test_users):
    assert (await client.get("/api/v1/exercises")).status_code == 401
