import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_workout_session_and_pr_detection(
    client: AsyncClient,
    seed_test_users,
    athlete_token,
    admin_token
):
    headers_athlete = {"Authorization": f"Bearer {athlete_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Workout Session with Sets (automatic PR calculation)
    payload = {
        "split_title": "Heavy Push Day",
        "duration_min": 60,
        "is_public": True,
        "sets": [
            {"exercise_id": 1, "set_no": 1, "reps": 10, "weight_kg": 70.0},
            {"exercise_id": 1, "set_no": 2, "reps": 8, "weight_kg": 85.0},
            {"exercise_id": 1, "set_no": 3, "reps": 5, "weight_kg": 100.0, "is_pr": True},
        ]
    }
    resp = await client.post("/api/v1/workout-sessions", json=payload, headers=headers_athlete)
    assert resp.status_code == 201
    assert "Location" in resp.headers
    session_data = resp.json()
    session_id = session_data["id"]
    assert session_data["split_title"] == "Heavy Push Day"
    assert len(session_data["sets"]) == 3
    assert session_data["burned_kcal"] > 0

    # 2. List sessions
    list_resp = await client.get("/api/v1/workout-sessions", headers=headers_athlete)
    assert list_resp.status_code == 200
    assert list_resp.json()["meta"]["total"] >= 1

    # 3. Get single session
    get_resp = await client.get(f"/api/v1/workout-sessions/{session_id}", headers=headers_athlete)
    assert get_resp.status_code == 200

    # 4. Coach verifies PR on set 3
    set_id = session_data["sets"][2]["id"]
    verify_resp = await client.patch(f"/api/v1/workout-sets/{set_id}/verify", headers=headers_admin)
    assert verify_resp.status_code == 200
    assert verify_resp.json()["is_pr"] is True
    assert verify_resp.json()["verified_by_id"] == 2

    # 5. Delete session
    del_resp = await client.delete(f"/api/v1/workout-sessions/{session_id}", headers=headers_athlete)
    assert del_resp.status_code == 204
