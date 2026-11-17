import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import NutritionKnowledgeItem, RagScanLog
from app.db.session import get_db, set_rls_context
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.nutrition import (
    FoodItemSummary,
    RagScanLogResponse,
    RagScanRequest,
    RagScanResponse,
)
from app.services.rag_service import execute_rag_scan
from app.services.vision_service import VisionUnavailable, describe_meal_photo

router = APIRouter(tags=["RAG Nutrition Engine"])


@router.post(
    "/rag-nutrition-scans",
    response_model=RagScanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Analyze meal description or photo via RAG pipeline (Requirements T1-T4, T6)",
)
async def scan_meal_nutrition(
    payload: RagScanRequest,
    response: Response,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    query_input = payload.query_input.strip()
    if payload.image_base64:
        try:
            query_input = await describe_meal_photo(payload.image_base64, hint=query_input)
        except VisionUnavailable as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        if not query_input:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "We couldn't spot any food in that photo. Try another photo or type your meal.",
            )

    await set_rls_context(db, user_id=user_id, role=token_payload.role)
    result = await execute_rag_scan(
        db=db,
        user_id=user_id,
        query_input=query_input[:1000],
        image_base64=payload.image_base64,
    )

    response.headers["Location"] = (
        f"{settings.API_V1_PREFIX}/rag-nutrition-scans/{result['scan_id']}"
    )
    return result


@router.get(
    "/rag-nutrition-scans",
    response_model=PaginatedResponse[RagScanLogResponse],
    summary="Audit RAG scan logs for traceability & model latency (Admin/Coach only, Req T4)",
)
async def list_rag_scan_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    token_payload: TokenPayload = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(RagScanLog).order_by(desc(RagScanLog.created_at))

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    logs = list(res.scalars().all())

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=logs, meta=PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)
    )


@router.get(
    "/nutrition-knowledge-items",
    response_model=PaginatedResponse[FoodItemSummary],
    summary="Explore indexed DOST-FNRI & USDA food items in knowledge base",
)
async def list_nutrition_knowledge_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    source_dataset: Optional[str] = Query(None, description="Filter by FNRI or USDA"),
    q: Optional[str] = Query(None, description="Search food item name"),
    db: AsyncSession = Depends(get_db),
):
    query = select(NutritionKnowledgeItem)

    if source_dataset:
        query = query.where(NutritionKnowledgeItem.source_dataset == source_dataset)
    if q:
        query = query.where(NutritionKnowledgeItem.food_name.ilike(f"%{q}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(NutritionKnowledgeItem.food_name.asc())
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    res = await db.execute(query)
    items = list(res.scalars().all())
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=items,
        meta=PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages),
    )
