import json

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


@pytest.mark.asyncio
async def test_other_users_runs_are_private_and_trimmed(client: AsyncClient, seed_test_users, athlete_token):
    from app.core.security import create_access_token

    owner = {"Authorization": f"Bearer {athlete_token}"}
    stranger = {"Authorization": f"Bearer {create_access_token(subject=99, role='athlete')}"}
    # ~1 km due north, one point every ~111 m.
    coords = [[121.0, 14.500 + i * 0.001] for i in range(10)]
    route = '{"type":"LineString","coordinates":' + str(coords) + "}"
    base = {"surface_type": "road", "distance_km": 1.0, "duration_sec": 600, "route_geojson": route}

    private = (await client.post("/api/v1/run-activities", json={**base, "is_public": False}, headers=owner)).json()
    public = (await client.post("/api/v1/run-activities", json={**base, "is_public": True}, headers=owner)).json()

    # Someone else's private activity is not revealed.
    assert (await client.get(f"/api/v1/run-activities/{private['id']}", headers=stranger)).status_code == 404

    # Someone else's public activity loses its first and last 200 m.
    seen = (await client.get(f"/api/v1/run-activities/{public['id']}", headers=stranger)).json()
    seen_coords = json.loads(seen["route_geojson"])["coordinates"]
    assert coords[0] not in seen_coords and coords[-1] not in seen_coords
    assert 0 < len(seen_coords) < len(coords)

    listed = (await client.get("/api/v1/run-activities?only_mine=false", headers=stranger)).json()["data"]
    assert all(coords[0] not in json.loads(r["route_geojson"])["coordinates"] for r in listed)

    # The owner still sees the whole route.
    mine = (await client.get(f"/api/v1/run-activities/{public['id']}", headers=owner)).json()
    assert json.loads(mine["route_geojson"])["coordinates"] == coords
