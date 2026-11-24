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
    assert data["photo_status"] == "used"
    assert data["photo_description"] == "200g chicken adobo"


@pytest.mark.asyncio
async def test_typed_amount_overrides_photo_guess(
    client: AsyncClient, seed_test_users, athlete_token, monkeypatch
):
    async def fake_describe(image_b64, hint=""):
        return "200g chicken adobo"  # the model ignored the note's amount

    monkeypatch.setattr(rag_nutrition, "describe_meal_photo", fake_describe)
    resp = await client.post(
        "/api/v1/rag-nutrition-scans",
        json={"image_base64": "QUJD", "query_input": "I only had 120g chicken adobo"},
        headers={"Authorization": f"Bearer {athlete_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["items"][0]["grams"] == 120
    assert data["note"] == "I only had 120g chicken adobo"
    assert data["note_amounts_applied"] == 1
    assert data["predicted_macros"]["calories"] == round(185.0 * 1.2, 1)


@pytest.mark.asyncio
async def test_photo_scan_errors(client: AsyncClient, seed_test_users, athlete_token, monkeypatch):
    headers = {"Authorization": f"Bearer {athlete_token}"}

    async def unavailable(image_b64, hint=""):
        raise VisionUnavailable("not configured")

    monkeypatch.setattr(rag_nutrition, "describe_meal_photo", unavailable)
    resp = await client.post(
        "/api/v1/rag-nutrition-scans", json={"image_base64": "QUJD"}, headers=headers
    )
    assert resp.status_code == 503

    async def no_food(image_b64, hint=""):
        return ""

    monkeypatch.setattr(rag_nutrition, "describe_meal_photo", no_food)
    resp = await client.post(
        "/api/v1/rag-nutrition-scans", json={"image_base64": "QUJD"}, headers=headers
    )
    assert resp.status_code == 422

    # With a typed meal, a photo that can't be used falls back to the text.
    for fake, expected in ((unavailable, "unavailable"), (no_food, "no_food")):
        monkeypatch.setattr(rag_nutrition, "describe_meal_photo", fake)
        resp = await client.post(
            "/api/v1/rag-nutrition-scans",
            json={"image_base64": "QUJD", "query_input": "150g chicken adobo"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["photo_status"] == expected
        assert data["photo_description"] is None
        assert data["items"][0]["grams"] == 150

    # Neither text nor photo is still rejected (app maps validation errors to 400).
    resp = await client.post(
        "/api/v1/rag-nutrition-scans", json={"query_input": " "}, headers=headers
    )
    assert resp.status_code == 400
