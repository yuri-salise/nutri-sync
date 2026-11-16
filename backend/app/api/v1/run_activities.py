import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import RunActivity, User
from app.db.session import get_db, set_rls_context
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.run import RunActivityCreate, RunActivityResponse, RunActivityUpdate
from app.services.activity_calories import estimate_burned_kcal
from app.services.social import delete_social_for

router = APIRouter(prefix="/run-activities", tags=["Runs"])


@router.get(
    "",
    response_model=PaginatedResponse[RunActivityResponse],
    summary="List GPS activities (run, walk, ride, hike)",
)
async def list_run_activities(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    surface_type: Optional[str] = Query(None, description="road or trail"),
    sport_type: Optional[str] = Query(None, description="run | walk | ride | hike"),
    only_mine: bool = Query(True),
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    await set_rls_context(db, user_id=user_id, role=token_payload.role)
    query = select(RunActivity)

    if only_mine and token_payload.role != "admin":
        query = query.where(RunActivity.user_id == user_id)
    elif not only_mine:
        query = query.where(RunActivity.is_public == True)

    if surface_type:
        query = query.where(RunActivity.surface_type == surface_type)
    if sport_type:
        query = query.where(RunActivity.sport_type == sport_type)

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(desc(RunActivity.recorded_at))
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    res = await db.execute(query)
    runs = list(res.scalars().all())
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=runs, meta=PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages)
    )


@router.post(
    "",
    response_model=RunActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a GPS activity (run, walk, ride or hike)",
)
async def create_run_activity(
    payload: RunActivityCreate,
    response: Response,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    await set_rls_context(db, user_id=user_id, role=token_payload.role)
    user = await db.get(User, user_id)
    weight = user.weight_kg if user else 70.0

    # Calories depend on the sport: running, walking, riding (by speed) and hiking each
    # have their own formula (see services/activity_calories.py).
    burned = payload.burned_kcal
    if burned is None:
        burned = estimate_burned_kcal(
            sport=payload.sport_type,
            weight_kg=weight,
            distance_km=payload.distance_km,
            duration_sec=payload.duration_sec,
            elevation_gain_m=payload.elevation_gain_m,
            surface=payload.surface_type,
        )

    run = RunActivity(
        user_id=user_id,
        sport_type=payload.sport_type,
        title=(payload.title or "").strip() or None,
        surface_type=payload.surface_type,
        distance_km=payload.distance_km,
        duration_sec=payload.duration_sec,
        elevation_gain_m=payload.elevation_gain_m,
        burned_kcal=burned,
        route_geojson=payload.route_geojson,
        is_public=payload.is_public,
        recorded_at=payload.recorded_at or datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    response.headers["Location"] = f"{settings.API_V1_PREFIX}/run-activities/{run.id}"
    return run


@router.get("/{id}", response_model=RunActivityResponse, summary="Get single run activity")
async def get_run_activity(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    run = await db.get(RunActivity, id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Run activity {id} not found.",
                    "details": [],
                }
            },
        )
    return run


@router.patch("/{id}", response_model=RunActivityResponse, summary="Update run activity")
async def update_run_activity(
    id: int,
    payload: RunActivityUpdate,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    run = await db.get(RunActivity, id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Run activity {id} not found.",
                    "details": [],
                }
            },
        )

    user_id = int(token_payload.sub)
    if run.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only edit your own run activities.",
                    "details": [],
                }
            },
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(run, field, val)

    await db.commit()
    await db.refresh(run)
    return run


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete run activity")
async def delete_run_activity(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    run = await db.get(RunActivity, id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Run activity {id} not found.",
                    "details": [],
                }
            },
        )

    user_id = int(token_payload.sub)
    if run.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only delete your own run activities.",
                    "details": [],
                }
            },
        )

    await delete_social_for(db, "run", run.id)
    await db.delete(run)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
