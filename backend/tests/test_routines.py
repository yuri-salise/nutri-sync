import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, get_password_hash
from app.db.models import Exercise, User


@pytest.fixture
async def extra_exercise(db_session, seed_test_users):
    ex = Exercise(
        id=2,
        name="Barbell Back Squat",
        category="compound",
        muscle_group="legs",
        met_value=7.5,
        status="approved",
        created_by_id=2,
    )
    db_session.add(ex)
    await db_session.commit()
    return ex


@pytest.mark.asyncio
async def test_routine_crud_flow(client: AsyncClient, extra_exercise, athlete_token):
    headers = {"Authorization": f"Bearer {athlete_token}"}
    payload = {
        "name": "Full Body A",
        "notes": "Monday",
        "exercises": [
            {"exercise_id": 2, "target_sets": 5, "target_reps": 5, "target_weight_kg": 100},
            {"exercise_id": 1, "target_sets": 3, "target_reps": 8, "rest_sec": 120},
        ],
    }

    # Create (201 + Location), exercises kept in order
    created = await client.post("/api/v1/workout-routines", json=payload, headers=headers)
    assert created.status_code == 201
    assert "Location" in created.headers
    body = created.json()
    rid = body["id"]
    assert [e["exercise_id"] for e in body["exercises"]] == [2, 1]
    assert body["exercises"][0]["exercise"]["name"] == "Barbell Back Squat"
    assert body["exercises"][1]["rest_sec"] == 120

    # Duplicate name (case-insensitive) -> 409
    dup = await client.post(
        "/api/v1/workout-routines", json={**payload, "name": "full body a"}, headers=headers
    )
    assert dup.status_code == 409

    # List with search + pagination
    listed = await client.get("/api/v1/workout-routines?q=full&page=1&limit=5", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] == 1

    # Get one
    got = await client.get(f"/api/v1/workout-routines/{rid}", headers=headers)
    assert got.status_code == 200 and got.json()["name"] == "Full Body A"

    # Update: rename and replace the exercise list
    updated = await client.put(
        f"/api/v1/workout-routines/{rid}",
        json={"name": "Leg Day", "exercises": [{"exercise_id": 2, "target_sets": 4}]},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Leg Day"
    assert len(updated.json()["exercises"]) == 1
    assert updated.json()["exercises"][0]["target_sets"] == 4

    # Delete
    assert (
        await client.delete(f"/api/v1/workout-routines/{rid}", headers=headers)
    ).status_code == 204
    assert (await client.get(f"/api/v1/workout-routines/{rid}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_routine_validation_and_ownership(
    client: AsyncClient, db_session, extra_exercise, athlete_token
):
    headers = {"Authorization": f"Bearer {athlete_token}"}

    # Unknown exercise -> 422 with consistent error shape
    bad = await client.post(
        "/api/v1/workout-routines",
        json={"name": "Ghost", "exercises": [{"exercise_id": 999}]},
        headers=headers,
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"

    # Empty exercise list -> 400/422 from schema validation
    empty = await client.post(
        "/api/v1/workout-routines", json={"name": "Empty", "exercises": []}, headers=headers
    )
    assert empty.status_code in (400, 422)

    # Unauthenticated -> 401
    assert (await client.get("/api/v1/workout-routines")).status_code == 401

    # Another athlete can't see or change my routine
    created = await client.post(
        "/api/v1/workout-routines",
        json={"name": "Mine", "exercises": [{"exercise_id": 1}]},
        headers=headers,
    )
    rid = created.json()["id"]
    db_session.add(
        User(
            id=3,
            email="other@example.com",
            password_hash=get_password_hash("Password123!"),
            full_name="Other",
            role="athlete",
        )
    )
    await db_session.commit()
    other = {"Authorization": f"Bearer {create_access_token(subject=3, role='athlete')}"}
    assert (await client.get(f"/api/v1/workout-routines/{rid}", headers=other)).status_code == 404
    assert (
        await client.put(f"/api/v1/workout-routines/{rid}", json={"name": "Hax"}, headers=other)
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/workout-routines/{rid}", headers=other)
    ).status_code == 404
    other_list = await client.get("/api/v1/workout-routines", headers=other)
    assert other_list.json()["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_only_heaviest_set_in_a_workout_is_a_pr(
    client: AsyncClient, seed_test_users, athlete_token
):
    headers = {"Authorization": f"Bearer {athlete_token}"}
    resp = await client.post(
        "/api/v1/workout-sessions",
        json={
            "split_title": "Bench test",
            "duration_min": 30,
            "sets": [
                {"exercise_id": 1, "set_no": 1, "reps": 5, "weight_kg": 60},
                {"exercise_id": 1, "set_no": 2, "reps": 5, "weight_kg": 60},
                {"exercise_id": 1, "set_no": 3, "reps": 3, "weight_kg": 70},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    prs = [s["is_pr"] for s in sorted(resp.json()["sets"], key=lambda s: s["set_no"])]
    # 60 beats nothing-before (first ever), the repeated 60 doesn't, 70 does.
    assert prs == [True, False, True]
