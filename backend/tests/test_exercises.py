import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_exercise_crud_flow(client: AsyncClient, seed_test_users, athlete_token, admin_token):
    headers_athlete = {"Authorization": f"Bearer {athlete_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Athlete creates custom exercise (pending status)
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
    assert ex_data["status"] == "pending"

    # 2. List exercises with pagination and filtering (Requirement B6)
    list_resp = await client.get("/api/v1/exercises?muscle_group=legs&page=1&limit=10")
    assert list_resp.status_code == 200
    res_json = list_resp.json()
    assert "data" in res_json
    assert "meta" in res_json
    assert res_json["meta"]["total"] >= 1

    # 3. Athlete attempts to approve (forbidden 403)
    forbidden_resp = await client.patch(
        f"/api/v1/exercises/{ex_id}",
        json={"status": "approved"},
        headers=headers_athlete
    )
    assert forbidden_resp.status_code == 403

    # 4. Admin approves custom exercise (success 200)
    admin_approve_resp = await client.patch(
        f"/api/v1/exercises/{ex_id}",
        json={"status": "approved"},
        headers=headers_admin
    )
    assert admin_approve_resp.status_code == 200
    assert admin_approve_resp.json()["status"] == "approved"

    # 5. Get single exercise (200)
    get_resp = await client.get(f"/api/v1/exercises/{ex_id}")
    assert get_resp.status_code == 200

    # 6. Delete exercise (204)
    del_resp = await client.delete(f"/api/v1/exercises/{ex_id}", headers=headers_admin)
    assert del_resp.status_code == 204
