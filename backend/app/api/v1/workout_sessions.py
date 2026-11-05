import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import User, WorkoutSession, WorkoutSet
from app.db.session import get_db, set_rls_context
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.workout import (
    WorkoutSessionCreate,
    WorkoutSessionResponse,
    WorkoutSessionUpdate,
    WorkoutSetResponse,
)

router = APIRouter(tags=["Workouts"])


@router.get(
    "/workout-sessions",
    response_model=PaginatedResponse[WorkoutSessionResponse],
    summary="List workout sessions with pagination and filtering",
)
async def list_workout_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    split_title: Optional[str] = Query(None),
    only_mine: bool = Query(True),
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    await set_rls_context(db, user_id=user_id, role=token_payload.role)
    query = select(WorkoutSession).options(
        selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise)
    )

    if only_mine and token_payload.role != "admin":
        query = query.where(WorkoutSession.user_id == user_id)
    elif not only_mine:
        query = query.where(WorkoutSession.is_public == True)

    if split_title:
        query = query.where(WorkoutSession.split_title.ilike(f"%{split_title}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(desc(WorkoutSession.session_date))
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    res = await db.execute(query)
    sessions = list(res.scalars().all())
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=sessions,
        meta=PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages),
    )


@router.post(
    "/workout-sessions",
    response_model=WorkoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a workout session with sets and automatic PR detection",
)
async def create_workout_session(
    payload: WorkoutSessionCreate,
    response: Response,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    await set_rls_context(db, user_id=user_id, role=token_payload.role)
    user = await db.get(User, user_id)
    weight = user.weight_kg if user else 70.0

    # Calculate burned kcal if not provided: MET (6.0 avg strength) * weight * hours
    burned = payload.burned_kcal
    if burned is None:
        duration_hours = payload.duration_min / 60.0
        burned = round(6.0 * weight * duration_hours, 1)

    session = WorkoutSession(
        user_id=user_id,
        split_title=payload.split_title,
        duration_min=payload.duration_min,
        burned_kcal=burned,
        is_public=payload.is_public,
        session_date=payload.session_date or datetime.now(timezone.utc),
    )
    db.add(session)
    await db.flush()

    # Process sets & detect PRs (Personal Records)
    for s in payload.sets:
        # Check user's max previous weight for this exercise
        max_pr_stmt = (
            select(func.coalesce(func.max(WorkoutSet.weight_kg), 0.0))
            .join(WorkoutSession, WorkoutSet.session_id == WorkoutSession.id)
            .where(and_(WorkoutSession.user_id == user_id, WorkoutSet.exercise_id == s.exercise_id))
        )
        prev_max_res = await db.execute(max_pr_stmt)
        prev_max_weight = prev_max_res.scalar_one()

        is_new_pr = s.weight_kg > prev_max_weight and s.weight_kg > 0.0

        w_set = WorkoutSet(
            session_id=session.id,
            exercise_id=s.exercise_id,
            set_no=s.set_no,
            reps=s.reps,
            weight_kg=s.weight_kg,
            is_pr=is_new_pr or s.is_pr,
        )
        db.add(w_set)

    await db.commit()

    # Reload with relationships
    stmt = (
        select(WorkoutSession)
        .options(selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise))
        .where(WorkoutSession.id == session.id)
    )
    res = await db.execute(stmt)
    full_session = res.scalar_one()

    response.headers["Location"] = f"{settings.API_V1_PREFIX}/workout-sessions/{session.id}"
    return full_session


@router.get(
    "/workout-sessions/{id}",
    response_model=WorkoutSessionResponse,
    summary="Get single workout session by ID",
)
async def get_workout_session(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(WorkoutSession)
        .options(selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise))
        .where(WorkoutSession.id == id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Workout session {id} not found.",
                    "details": [],
                }
            },
        )

    user_id = int(token_payload.sub)
    if not session.is_public and session.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "This workout session is private.",
                    "details": [],
                }
            },
        )

    return session


@router.put(
    "/workout-sessions/{id}",
    response_model=WorkoutSessionResponse,
    summary="Update workout session metadata",
)
async def update_workout_session(
    id: int,
    payload: WorkoutSessionUpdate,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(WorkoutSession, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Workout session {id} not found.",
                    "details": [],
                }
            },
        )

    user_id = int(token_payload.sub)
    if session.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only update your own sessions.",
                    "details": [],
                }
            },
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, val)

    await db.commit()

    stmt = (
        select(WorkoutSession)
        .options(selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise))
        .where(WorkoutSession.id == id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete(
    "/workout-sessions/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a workout session",
)
async def delete_workout_session(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(WorkoutSession, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Workout session {id} not found.",
                    "details": [],
                }
            },
        )

    user_id = int(token_payload.sub)
    if session.user_id != user_id and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only delete your own sessions.",
                    "details": [],
                }
            },
        )

    await db.delete(session)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/workout-sets/{id}/verify",
    response_model=WorkoutSetResponse,
    summary="Coach/Admin PR Verification (Requirement B4, Core Feature 7)",
)
async def verify_workout_set_pr(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    admin_id = int(token_payload.sub)
    w_set = await db.get(WorkoutSet, id)
    if not w_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Workout set {id} not found.",
                    "details": [],
                }
            },
        )

    w_set.verified_by_id = admin_id
    w_set.is_pr = True
    await db.commit()
    await db.refresh(w_set)
    return w_set
