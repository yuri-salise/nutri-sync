import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success_and_duplicate(client: AsyncClient):
    # 1. Successful registration (201)
    payload = {
        "email": "newathlete@nutrisync.com",
        "password": "Password123!",
        "full_name": "New Athlete",
        "role": "athlete",
        "weight_kg": 75.0,
        "base_kcal_goal": 2300.0,
        "protein_goal_g": 160.0,
        "carbs_goal_g": 260.0,
        "fat_goal_g": 70.0,
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    assert "Location" in resp.headers
    data = resp.json()
    assert data["email"] == payload["email"]
    assert "password_hash" not in data

    # 2. Duplicate registration failure (409)
    dup_resp = await client.post("/api/v1/auth/register", json=payload)
    assert dup_resp.status_code == 409
    err = dup_resp.json()
    assert err["error"]["code"] == "DUPLICATE_RESOURCE"


@pytest.mark.asyncio
async def test_login_success_and_failure(client: AsyncClient, seed_test_users):
    # Success
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "athlete@example.com", "password": "Password123!"}
    )
    assert resp.status_code == 200
    token_data = resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "Bearer"

    # Bad password (401)
    bad_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "athlete@example.com", "password": "WrongPassword!"}
    )
    assert bad_resp.status_code == 401
    err = bad_resp.json()
    assert err["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_auth_me_profile(client: AsyncClient, seed_test_users, athlete_token):
    headers = {"Authorization": f"Bearer {athlete_token}"}
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "athlete@example.com"

    # Update profile
    patch_resp = await client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"weight_kg": 71.5, "base_kcal_goal": 2250.0}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["weight_kg"] == 71.5
