import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import Exercise
from app.db.routine_models import WorkoutRoutine, WorkoutRoutineExercise
from app.db.session import get_db, set_rls_context
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.routine import (
    RoutineCreate,
    RoutineExerciseIn,
    RoutineResponse,
    RoutineUpdate,
)

router = APIRouter(prefix="/workout-routines", tags=["Workout Routines"])

SORTABLE = {"name", "created_at", "updated_at"}


def _error(code: int, err: str, message: str, details: Optional[list] = None) -> HTTPException:
    return HTTPException(
        status_code=code,
        detail={"error": {"code": err, "message": message, "details": details or []}},
    )


async def _get_owned_routine(db: AsyncSession, routine_id: int, token: TokenPayload):
    routine = await db.get(WorkoutRoutine, routine_id)
    # Not revealing other users' routines: a foreign routine looks the same as a missing one.
    if not routine or (token.role != "admin" and routine.user_id != int(token.sub)):
        raise _error(404, "RESOURCE_NOT_FOUND", f"Routine with ID {routine_id} does not exist.")
    return routine


async def _validate_exercises(
    db: AsyncSession, items: List[RoutineExerciseIn], user_id: int
) -> None:
    ids = {i.exercise_id for i in items}
    res = await db.execute(
        select(Exercise.id).where(
            Exercise.id.in_(ids),
            or_(Exercise.status == "approved", Exercise.created_by_id == user_id),
        )
    )
    found = set(res.scalars().all())
    missing = sorted(ids - found)
    if missing:
        raise _error(
            422,
            "VALIDATION_ERROR",
            "Some exercises in this routine don't exist or aren't available to you.",
            [{"field": "exercises", "message": f"Unknown exercise IDs: {missing}"}],
        )


async def _ensure_unique_name(
    db: AsyncSession, user_id: int, name: str, exclude_id: Optional[int] = None
) -> None:
    stmt = select(WorkoutRoutine.id).where(
        WorkoutRoutine.user_id == user_id, func.lower(WorkoutRoutine.name) == name.lower()
    )
    if exclude_id is not None:
        stmt = stmt.where(WorkoutRoutine.id != exclude_id)
    if (await db.execute(stmt)).first():
        raise _error(
            409,
            "DUPLICATE_RESOURCE",
            f'You already have a routine called "{name}".',
            [{"field": "name", "message": "Choose a different name."}],
        )


def _build_items(items: List[RoutineExerciseIn]) -> List[WorkoutRoutineExercise]:
    return [
        WorkoutRoutineExercise(
            exercise_id=i.exercise_id,
            position=pos,
            target_sets=i.target_sets,
            target_reps=i.target_reps,
            target_weight_kg=i.target_weight_kg,
            rest_sec=i.rest_sec,
        )
        for pos, i in enumerate(items, start=1)
    ]


async def _reload(db: AsyncSession, routine_id: int) -> WorkoutRoutine:
    db.expire_all()
    res = await db.execute(select(WorkoutRoutine).where(WorkoutRoutine.id == routine_id))
    return res.scalar_one()


@router.get(
    "",
    response_model=PaginatedResponse[RoutineResponse],
    summary="List my saved workout routines (Role: athlete, admin)",
)
async def list_routines(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search by routine name"),
    sort: str = Query("-updated_at", description="name | created_at | updated_at, '-' for desc"),
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    await set_rls_context(db, user_id=user_id, role=token.role)
    query = select(WorkoutRoutine).where(WorkoutRoutine.user_id == user_id)
    if q:
        query = query.where(WorkoutRoutine.name.ilike(f"%{q}%"))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    field = sort.lstrip("-")
    col = getattr(WorkoutRoutine, field if field in SORTABLE else "updated_at")
    query = query.order_by(desc(col) if sort.startswith("-") else asc(col))
    query = query.offset((page - 1) * limit).limit(limit)
    routines = list((await db.execute(query)).scalars().all())

    return PaginatedResponse(
        data=routines,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=math.ceil(total / limit) if total else 1,
        ),
    )


@router.post(
    "",
    response_model=RoutineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a workout routine (Role: athlete, admin)",
    responses={
        409: {"description": "Routine name already used"},
        422: {"description": "Bad input"},
    },
)
async def create_routine(
    payload: RoutineCreate,
    response: Response,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    await set_rls_context(db, user_id=user_id, role=token.role)
    await _ensure_unique_name(db, user_id, payload.name)
    await _validate_exercises(db, payload.exercises, user_id)

    routine = WorkoutRoutine(user_id=user_id, name=payload.name, notes=payload.notes)
    routine.exercises = _build_items(payload.exercises)
    db.add(routine)
    await db.commit()

    response.headers["Location"] = f"{settings.API_V1_PREFIX}/workout-routines/{routine.id}"
    return await _reload(db, routine.id)


@router.get(
    "/{id}",
    response_model=RoutineResponse,
    summary="Get one of my routines (Role: athlete, admin)",
    responses={404: {"description": "Not found"}},
)
async def get_routine(
    id: int,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    await set_rls_context(db, user_id=int(token.sub), role=token.role)
    return await _get_owned_routine(db, id, token)


@router.put(
    "/{id}",
    response_model=RoutineResponse,
    summary="Update a routine; a new exercise list replaces the old one (Role: owner)",
    responses={404: {"description": "Not found"}, 409: {"description": "Name already used"}},
)
async def update_routine(
    id: int,
    payload: RoutineUpdate,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    await set_rls_context(db, user_id=int(token.sub), role=token.role)
    routine = await _get_owned_routine(db, id, token)

    if payload.name is not None:
        name = payload.name.strip()
        await _ensure_unique_name(db, routine.user_id, name, exclude_id=routine.id)
        routine.name = name
    if payload.notes is not None:
        routine.notes = payload.notes
    if payload.exercises is not None:
        await _validate_exercises(db, payload.exercises, routine.user_id)
        routine.exercises.clear()
        await db.flush()
        routine.exercises.extend(_build_items(payload.exercises))

    await db.commit()
    return await _reload(db, routine.id)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a routine (Role: owner)",
    responses={404: {"description": "Not found"}},
)
async def delete_routine(
    id: int,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    await set_rls_context(db, user_id=int(token.sub), role=token.role)
    routine = await _get_owned_routine(db, id, token)
    await db.delete(routine)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
