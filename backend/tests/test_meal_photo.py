import pytest
from httpx import AsyncClient

from app.api.v1 import rag_nutrition
from app.services.vision_service import VisionUnavailable, items_to_description


def test_items_to_description():
    raw = '{"items": [{"food": "chicken adobo", "grams": 180}, {"food": "rice, white", "grams": "150"}, {"food": "egg"}]}'
    assert items_to_description(raw) == "180g chicken adobo, 150g rice  white, egg"
    assert items_to_description('{"items": []}') == ""


@pytest.mark.asyncio
async def test_photo_scan_uses_vision_description(
    client: AsyncClient, seed_test_users, athlete_token, monkeypatch
):
    seen = {}

    async def fake_describe(image_b64, hint=""):
        seen["image"], seen["hint"] = image_b64, hint
        return "200g chicken adobo"

    monkeypatch.setattr(rag_nutrition, "describe_meal_photo", fake_describe)
    headers = {"Authorization": f"Bearer {athlete_token}"}
    resp = await client.post(
        "/api/v1/rag-nutrition-scans",
        json={"image_base64": "data:image/jpeg;base64,QUJD", "query_input": "lunch"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert seen == {"image": "QUJD", "hint": "lunch"}  # data-URL prefix stripped
    data = resp.json()
    assert data["query_input"] == "200g chicken adobo"
    assert data["items"][0]["grams"] == 200


@pytest.mark.asyncio
async def test_photo_scan_errors(client: AsyncClient, seed_test_users, athlete_token, monkeypatch):
    headers = {"Authorization": f"Bearer {athlete_token}"}

    async def unavailable(image_b64, hint=""):
        raise VisionUnavailable("not configured")

    monkeypatch.setattr(rag_nutrition, "describe_meal_photo", unavailable)
    resp = await client.post("/api/v1/rag-nutrition-scans", json={"image_base64": "QUJD"}, headers=headers)
    assert resp.status_code == 503

    async def no_food(image_b64, hint=""):
        return ""

    monkeypatch.setattr(rag_nutrition, "describe_meal_photo", no_food)
    resp = await client.post("/api/v1/rag-nutrition-scans", json={"image_base64": "QUJD"}, headers=headers)
    assert resp.status_code == 422

    # Neither text nor photo is still rejected (app maps validation errors to 400).
    resp = await client.post("/api/v1/rag-nutrition-scans", json={"query_input": " "}, headers=headers)
    assert resp.status_code == 400
