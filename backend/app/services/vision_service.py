"""Meal photo -> text description, so the existing meal matcher can do the nutrition lookup.

The vision model only names the foods and guesses grams; macros still come from the
FNRI/USDA knowledge base. Gemini is tried first, Groq second; each is skipped when its
API key is not configured.
"""

import json
from typing import Dict, List

import httpx

from app.core.config import settings
from app.core.logging import logger

PROMPT = (
    "You are a nutrition assistant. List every food and drink visible in this meal photo. "
    "Use short common names; use the Filipino dish name when it is a Filipino dish "
    "(e.g. 'chicken adobo', 'sinigang na baboy', 'garlic rice', 'pandesal'). "
    "Estimate the edible portion of each item in grams. "
    'Reply with JSON only: {"items": [{"food": "<name>", "grams": <number>}]}. '
    'If there is no food in the photo, reply {"items": []}.'
)


class VisionUnavailable(Exception):
    """No vision provider is configured, or every configured one failed."""


NOTE_RULES = (
    "\nThe user also typed a note about this meal. The note is the user's own account and "
    "wins over what you see: use the note's names and amounts for the foods it mentions; "
    "include foods the note mentions even if they are not in the photo; leave out foods "
    "the note says were not eaten. Note: "
)


def _hinted_prompt(hint: str) -> str:
    return PROMPT + (NOTE_RULES + hint if hint else "")


async def _gemini(client: httpx.AsyncClient, image_b64: str, hint: str) -> str:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_VISION_MODEL}:generateContent"
    )
    body = {
        "contents": [
            {
                "parts": [
                    {"text": _hinted_prompt(hint)},
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    r = await client.post(url, json=body, headers={"x-goog-api-key": settings.GEMINI_API_KEY})
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


async def _groq(client: httpx.AsyncClient, image_b64: str, hint: str) -> str:
    body = {
        "model": settings.GROQ_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _hinted_prompt(hint)},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                ],
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    r = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        json=body,
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def items_to_description(raw_json: str) -> str:
    """'{"items":[{"food":"rice","grams":150}]}' -> '150g rice' (comma separated)."""
    data = json.loads(raw_json)
    items: List[Dict] = data.get("items", []) if isinstance(data, dict) else []
    parts = []
    for it in items:
        food = str(it.get("food", "")).strip().replace(",", " ")
        try:
            grams = float(it.get("grams") or 0)
        except (TypeError, ValueError):
            grams = 0
        if food:
            parts.append(f"{round(grams)}g {food}" if grams > 0 else food)
    return ", ".join(parts)


async def describe_meal_photo(image_b64: str, hint: str = "") -> str:
    """Return a meal description such as '200g chicken adobo, 150g rice' ('' if no food)."""
    providers = []
    if settings.GEMINI_API_KEY:
        providers.append(("gemini", _gemini))
    if settings.GROQ_API_KEY:
        providers.append(("groq", _groq))
    if not providers:
        raise VisionUnavailable("Photo analysis is not configured on this server.")

    # 20 s per provider keeps the worst case (both tried) under the proxy's patience.
    async with httpx.AsyncClient(timeout=20.0) as client:
        for name, call in providers:
            try:
                return items_to_description(await call(client, image_b64, hint))
            except Exception as exc:  # noqa: BLE001 - try the next provider
                # Log the type only: httpx errors can include the request URL/headers.
                logger.warning(f"Vision provider {name} failed: {type(exc).__name__}")
    raise VisionUnavailable("Photo analysis is busy right now. Please try again or type your meal.")
