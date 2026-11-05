import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import NutritionLog
from app.db.session import get_db
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.nutrition import NutritionLogCreate, NutritionLogResponse, NutritionLogUpdate

router = APIRouter(prefix="/nutrition-logs", tags=["Nutrition Logs"])


@router.get(
    "",
    response_model=PaginatedResponse[NutritionLogResponse],
    summary="List logged meals for current user"
)
async def list_nutrition_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    user_id = int(token_payload.sub)
    query = select(NutritionLog).where(NutritionLog.user_id == user_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(desc(NutritionLog.logged_at))
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    res = await db.execute(query)
    logs = list(res.scalars().all())
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=logs,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=total_pages
        )
    )


@router.post(
    "",
    response_model=NutritionLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a confirmed meal log (Human confirmation of RAG scan or manual entry)"
)
async def create_nutrition_log(
    payload: NutritionLogCreate,
    response: Response,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    user_id = int(token_payload.sub)
    log = NutritionLog(
        user_id=user_id,
        meal_name=payload.meal_name,
        total_kcal=payload.total_kcal,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        rag_scan_id=payload.rag_scan_id,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    response.headers["Location"] = f"{settings.API_V1_PREFIX}/nutrition-logs/{log.id}"
    return log


@router.get(
    "/{id}",
    response_model=NutritionLogResponse,
    summary="Get single nutrition log"
)
async def get_nutrition_log(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    log = await db.get(NutritionLog, id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Nutrition log {id} not found.",
                    "details": []
                }
            }
        )

    user_id = int(token_payload.sub)
    if log.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only view your own nutrition logs.",
                    "details": []
                }
            }
        )
    return log


@router.put(
    "/{id}",
    response_model=NutritionLogResponse,
    summary="Update nutrition log"
)
async def update_nutrition_log(
    id: int,
    payload: NutritionLogUpdate,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    log = await db.get(NutritionLog, id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Nutrition log {id} not found.",
                    "details": []
                }
            }
        )

    user_id = int(token_payload.sub)
    if log.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only edit your own nutrition logs.",
                    "details": []
                }
            }
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(log, field, val)

    await db.commit()
    await db.refresh(log)
    return log


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete nutrition log"
)
async def delete_nutrition_log(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    log = await db.get(NutritionLog, id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Nutrition log {id} not found.",
                    "details": []
                }
            }
        )

    user_id = int(token_payload.sub)
    if log.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only delete your own nutrition logs.",
                    "details": []
                }
            }
        )

    await db.delete(log)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
