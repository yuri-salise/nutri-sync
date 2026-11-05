import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import set_rls_context


@pytest.mark.asyncio
async def test_tenant_data_isolation_and_rls(
    client: AsyncClient,
    seed_test_users: dict,
    athlete_token: str,
    admin_token: str,
    db_session: AsyncSession,
):
    """
    Verifies multi-tenant isolation and security:
    - User A (Athlete 1) creates private workout.
    - User B (Athlete Bravo, id=3) queries workouts -> cannot view User A's private records.
    - User B attempts to tamper with User A's workout -> rejected with 403 Forbidden.
    - set_rls_context executes cleanly.
    """
    # 1. Athlete A logs private workout
    athlete_headers = {"Authorization": f"Bearer {athlete_token}"}
    workout_res = await client.post(
        "/api/v1/workout-sessions",
        headers=athlete_headers,
        json={
            "split_title": "Athlete A Secret Heavy Bench",
            "duration_min": 45,
            "is_public": False,
            "sets": [{"exercise_id": 1, "set_no": 1, "reps": 5, "weight_kg": 120.0}],
        },
    )
    assert workout_res.status_code == 201
    workout_id = workout_res.json()["id"]

    # 2. Register Athlete B
    register_b = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "athlete_b@nutrisync.com",
            "password": "Password123!",
            "full_name": "Athlete Bravo",
            "role": "athlete",
            "weight_kg": 75.0,
            "base_kcal_goal": 2300.0,
            "protein_goal_g": 160.0,
            "carbs_goal_g": 260.0,
            "fat_goal_g": 70.0,
        },
    )
    assert register_b.status_code == 201

    login_b = await client.post(
        "/api/v1/auth/login", json={"email": "athlete_b@nutrisync.com", "password": "Password123!"}
    )
    assert login_b.status_code == 200
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Athlete B queries workouts with only_mine=True -> should NOT see Athlete A's workout
    list_b = await client.get("/api/v1/workout-sessions?only_mine=true", headers=headers_b)
    assert list_b.status_code == 200
    b_workouts = list_b.json()["data"]
    assert not any(w["id"] == workout_id for w in b_workouts)

    # 4. Athlete B attempts to modify Athlete A's workout -> must be rejected (403 Forbidden)
    tamper_res = await client.put(
        f"/api/v1/workout-sessions/{workout_id}",
        headers=headers_b,
        json={"split_title": "Hacked Title"},
    )
    assert tamper_res.status_code == 403

    # Athlete B attempts to delete Athlete A's workout -> must be rejected (403 Forbidden)
    delete_res = await client.delete(f"/api/v1/workout-sessions/{workout_id}", headers=headers_b)
    assert delete_res.status_code == 403

    # 5. Verify set_rls_context helper operates safely on the active session
    await set_rls_context(db_session, user_id=999, role="athlete")
    await set_rls_context(db_session, user_id=1, role="admin")
