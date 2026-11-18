import asyncio
import json
import time
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.db.models import NutritionKnowledgeItem, RagScanLog
from app.services.embedding_service import generate_embedding, get_sentence_transformer_model
from app.services.meal_parser import FoodMatcher, MatchedItem, apply_note_amounts, total_macros

MATCHER_VERSION = "meal-parser v2.0 (hybrid lexical + embedding)"

# The knowledge base (~7,900 foods) changes only when re-seeded, so one matcher with
# pre-computed name embeddings is kept per process and rebuilt when the table changes.
_matcher_cache: Optional[Tuple[Tuple[int, int, float], FoodMatcher]] = None
_build_lock = asyncio.Lock()


async def _signature(db: AsyncSession) -> Tuple[int, int, float]:
    sig_row = await db.execute(
        select(
            func.count(NutritionKnowledgeItem.id),
            func.max(NutritionKnowledgeItem.id),
            func.sum(NutritionKnowledgeItem.kcal_per_100g),
        )
    )
    count, max_id, kcal_sum = sig_row.one()
    return (int(count or 0), int(max_id or 0), round(float(kcal_sum or 0.0), 2))


async def _get_matcher(db: AsyncSession) -> FoodMatcher:
    global _matcher_cache
    signature = await _signature(db)
    if _matcher_cache and _matcher_cache[0] == signature:
        return _matcher_cache[1]

    # One build at a time: concurrent first scans wait for it instead of each
    # rebuilding the whole index.
    async with _build_lock:
        if _matcher_cache and _matcher_cache[0] == signature:
            return _matcher_cache[1]
        res = await db.execute(select(NutritionKnowledgeItem))
        foods = list(res.scalars().all())
        # Building embeds every food name (CPU-bound, ~1-2 s); run it off the event
        # loop so other requests keep being served meanwhile.
        matcher = await asyncio.to_thread(FoodMatcher, foods, embed=generate_embedding)
        _matcher_cache = (signature, matcher)
        logger.info(f"Built meal matcher over {len(foods)} knowledge-base foods")
        return matcher


async def warm_matcher(session_factory) -> None:
    """Build the matcher at startup so the first scan after a deploy is not slow."""
    try:
        async with session_factory() as db:
            await _get_matcher(db)
    except Exception as exc:  # noqa: BLE001 - warm-up is best effort
        logger.warning(f"Meal matcher warm-up skipped: {type(exc).__name__}")


def _food_summary(food: NutritionKnowledgeItem) -> Dict[str, Any]:
    return {
        "id": food.id,
        "food_name": food.food_name,
        "source_dataset": food.source_dataset,
        "kcal_per_100g": food.kcal_per_100g,
        "protein_per_100g": food.protein_per_100g,
        "carbs_per_100g": food.carbs_per_100g,
        "fat_per_100g": food.fat_per_100g,
        "serving_description": food.serving_description,
    }


def _item_payload(item: MatchedItem) -> Dict[str, Any]:
    return {
        "query_text": item.query_text,
        "matched_food": _food_summary(item.food) if item.food else None,
        "grams": item.grams,
        "macros": item.macros(),
        "match_score": item.score,
        "confidence": item.confidence,
        "alternatives": [_food_summary(f) for f in item.alternatives],
    }


async def execute_rag_scan(
    db: AsyncSession, user_id: int, query_input: str, note: Optional[str] = None
) -> Dict[str, Any]:
    """
    Retrieval-augmented nutrition estimate for a free-text meal:
    1. Split the meal into food items and read each quantity ("1 cup", "200g", "2").
    2. Retrieve the best FNRI/USDA food for each item (hybrid lexical + embedding score).
    3. Scale per-100 g macros by the estimated grams and sum them.
    4. Log the scan to rag_scan_logs for traceability (T4).
    5. Flag the result as machine-generated and needing user confirmation (T6).

    `note` is text the user typed alongside a photo; `query_input` is then the photo
    description. Amounts typed in the note replace the amounts guessed from the photo.
    """
    start_time = time.time()
    # True when the neural embedding model is unavailable and the deterministic
    # hash embedding is used instead (Requirement T3 graceful fallback).
    used_fallback = get_sentence_transformer_model() is None

    matcher = await _get_matcher(db)
    items: List[MatchedItem] = []
    note_amounts_applied = 0
    if matcher.foods:
        # Matching is CPU-bound (~20 ms); keep it off the event loop.
        items = await asyncio.to_thread(matcher.match_meal, query_input)
        if note:
            note_items = await asyncio.to_thread(matcher.match_meal, note)
            note_amounts_applied = apply_note_amounts(items, note_items)

    matched = [i for i in items if i.confidence != "none"]
    calculated_macros = total_macros(items)
    top_score = (sum(i.score for i in matched) / len(matched)) if matched else 0.0

    retrieved: List[NutritionKnowledgeItem] = []
    for i in items:
        for food in ([i.food] if i.food else []) + i.alternatives:
            if food not in retrieved:
                retrieved.append(food)

    latency_ms = round((time.time() - start_time) * 1000.0, 2)
    embedder = settings.EMBEDDING_MODEL_NAME if not used_fallback else "hash-384"
    model_version = f"{MATCHER_VERSION}; {embedder}; USDA/FNRI"

    scan_log = RagScanLog(
        user_id=user_id,
        # Keep what the user typed next to the photo description for traceability (T4).
        query_input=f"{query_input} [note: {note}]" if note else query_input,
        retrieved_item_ids=json.dumps([f.id for f in retrieved]),
        top_similarity_score=float(top_score),
        predicted_macros_json=json.dumps(
            {
                **calculated_macros,
                "items": [
                    {
                        "query": i.query_text,
                        "food_id": i.food.id if i.food else None,
                        "grams": i.grams,
                        "confidence": i.confidence,
                    }
                    for i in items
                ],
            }
        ),
        model_version=model_version[:100],
        latency_ms=latency_ms,
        used_fallback=used_fallback,
    )
    db.add(scan_log)
    await db.flush()
    await db.refresh(scan_log)

    return {
        "scan_id": scan_log.id,
        "query_input": query_input,
        "is_machine_generated": True,  # Requirement T6
        "requires_human_confirmation": True,  # Requirement T6
        "used_fallback": used_fallback,
        "latency_ms": latency_ms,
        "top_similarity_score": round(float(top_score), 4),
        "predicted_macros": calculated_macros,
        "items": [_item_payload(i) for i in items],
        "unmatched": [i.query_text for i in items if i.confidence == "none"],
        "retrieved_items": [_food_summary(f) for f in retrieved],
        "model_version": scan_log.model_version,
        "note": note,
        "note_amounts_applied": note_amounts_applied,
    }
