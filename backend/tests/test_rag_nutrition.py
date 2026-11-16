import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_rag_nutrition_scan_and_audit(
    client: AsyncClient, seed_test_users, athlete_token, admin_token
):
    headers_athlete = {"Authorization": f"Bearer {athlete_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Execute RAG scan (Requirement T1-T4, T6)
    scan_payload = {
        "query_input": "Chicken adobo with steamed rice and egg",
    }
    resp = await client.post(
        "/api/v1/rag-nutrition-scans", json=scan_payload, headers=headers_athlete
    )
    assert resp.status_code == 201
    assert "Location" in resp.headers
    data = resp.json()

    assert data["is_machine_generated"] is True
    assert data["requires_human_confirmation"] is True
    assert "predicted_macros" in data
    assert data["predicted_macros"]["calories"] > 0
    assert "latency_ms" in data
    # Per-item breakdown: adobo matched from the seeded item, rice/egg not in the test KB.
    items = data["items"]
    assert items[0]["matched_food"]["food_name"] == "Adobong Manok (Chicken Adobo)"
    assert items[0]["confidence"] == "high"
    assert items[0]["grams"] > 0
    assert "egg" in data["unmatched"]
    scan_id = data["scan_id"]

    # 2. Athlete confirms and saves meal to nutrition_logs
    log_payload = {
        "meal_name": "Lunch: Chicken Adobo with Rice",
        "total_kcal": data["predicted_macros"]["calories"],
        "protein_g": data["predicted_macros"]["protein_g"],
        "carbs_g": data["predicted_macros"]["carbs_g"],
        "fat_g": data["predicted_macros"]["fat_g"],
        "rag_scan_id": scan_id,
    }
    log_resp = await client.post(
        "/api/v1/nutrition-logs", json=log_payload, headers=headers_athlete
    )
    assert log_resp.status_code == 201
    assert log_resp.json()["meal_name"] == log_payload["meal_name"]

    # 3. List user's nutrition logs
    list_nutri = await client.get("/api/v1/nutrition-logs", headers=headers_athlete)
    assert list_nutri.status_code == 200
    assert list_nutri.json()["meta"]["total"] >= 1

    # 4. Admin audits RAG traceability logs (Requirement T4)
    audit_resp = await client.get("/api/v1/rag-nutrition-scans", headers=headers_admin)
    assert audit_resp.status_code == 200
    assert audit_resp.json()["meta"]["total"] >= 1


@pytest.mark.asyncio
async def test_activity_synced_summary(client: AsyncClient, seed_test_users, athlete_token):
    headers = {"Authorization": f"Bearer {athlete_token}"}
    resp = await client.get("/api/v1/activity-synced-summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "base_goals" in data
    assert "activity_burn" in data
    assert "dynamic_targets" in data
    assert "consumed" in data
    assert "remaining" in data


@pytest.mark.asyncio
async def test_community_feed(client: AsyncClient, seed_test_users):
    resp = await client.get("/api/v1/community-feed")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert "meta" in data
