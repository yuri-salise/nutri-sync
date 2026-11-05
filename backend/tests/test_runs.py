import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_run_activities_flow(client: AsyncClient, seed_test_users, athlete_token):
    headers = {"Authorization": f"Bearer {athlete_token}"}

    # 1. Create run activity
    payload = {
        "surface_type": "trail",
        "distance_km": 5.2,
        "duration_sec": 1800,
        "elevation_gain_m": 80.0,
        "is_public": True,
        "route_geojson": '{"type":"LineString","coordinates":[[121.0,14.5],[121.1,14.6]]}',
    }
    resp = await client.post("/api/v1/run-activities", json=payload, headers=headers)
    assert resp.status_code == 201
    assert "Location" in resp.headers
    run_data = resp.json()
    run_id = run_data["id"]
    assert run_data["burned_kcal"] > 0

    # 2. List runs
    list_resp = await client.get("/api/v1/run-activities?surface_type=trail", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["meta"]["total"] >= 1

    # 3. Get single run
    get_resp = await client.get(f"/api/v1/run-activities/{run_id}", headers=headers)
    assert get_resp.status_code == 200

    # 4. Delete run
    del_resp = await client.delete(f"/api/v1/run-activities/{run_id}", headers=headers)
    assert del_resp.status_code == 204
