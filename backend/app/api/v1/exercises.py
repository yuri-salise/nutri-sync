import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import Exercise
from app.db.session import get_db, set_rls_context
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.exercise import ExerciseCreate, ExerciseResponse, ExerciseUpdate

router = APIRouter(prefix="/exercises", tags=["Exercises"])

# Exercise visibility:
#   "approved" - built-in library, visible to everyone
#   "private"  - a user's custom exercise, visible only to its creator (no approval step)
SORTABLE = {"name", "muscle_group", "category", "created_at", "met_value"}


def _error(code: int, err: str, message: str, details: Optional[list] = None) -> HTTPException:
    return HTTPException(
        status_code=code,
        detail={"error": {"code": err, "message": message, "details": details or []}},
    )


def _visible_to(user_id: int):
    return or_(Exercise.status == "approved", Exercise.created_by_id == user_id)


async def _get_visible(db: AsyncSession, id: int, token: TokenPayload) -> Exercise:
    exercise = await db.get(Exercise, id)
    user_id = int(token.sub)
    if not exercise or (exercise.status != "approved" and exercise.created_by_id != user_id):
        raise _error(404, "RESOURCE_NOT_FOUND", f"Exercise with ID {id} does not exist.")
    return exercise


@router.get(
    "",
    response_model=PaginatedResponse[ExerciseResponse],
    summary="List the built-in exercises plus my custom ones (Role: athlete, admin)",
)
async def list_exercises(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    muscle_group: Optional[str] = Query(None, description="Filter by muscle group"),
    category: Optional[str] = Query(None, description="Filter by exercise category"),
    mine: bool = Query(False, description="Only my custom exercises"),
    q: Optional[str] = Query(None, description="Search by name, muscle group or category"),
    sort: Optional[str] = Query("name", description="Sort field (prefix with - for desc)"),
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    await set_rls_context(db, user_id=user_id, role=token.role)

    query = select(Exercise).where(_visible_to(user_id))
    if mine:
        query = query.where(Exercise.created_by_id == user_id, Exercise.status == "private")
    if muscle_group:
        query = query.where(Exercise.muscle_group == muscle_group)
    if category:
        query = query.where(Exercise.category == category)
    if q:
        query = query.where(
            or_(
                Exercise.name.ilike(f"%{q}%"),
                Exercise.muscle_group.ilike(f"%{q}%"),
                Exercise.category.ilike(f"%{q}%"),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    sort = sort or "name"
    field = sort.lstrip("-")
    col = getattr(Exercise, field if field in SORTABLE else "name")
    query = query.order_by(desc(col) if sort.startswith("-") else asc(col))
    query = query.offset((page - 1) * limit).limit(limit)
    items = list((await db.execute(query)).scalars().all())

    return PaginatedResponse(
        data=items,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=math.ceil(total / limit) if total > 0 else 1,
        ),
    )


@router.post(
    "",
    response_model=ExerciseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a custom exercise; it's usable right away (Role: athlete, admin)",
    responses={409: {"description": "An exercise with this name already exists"}},
)
async def create_exercise(
    payload: ExerciseCreate,
    response: Response,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    await set_rls_context(db, user_id=user_id, role=token.role)
    name = payload.name.strip()

    dup = await db.execute(
        select(Exercise).where(_visible_to(user_id), func.lower(Exercise.name) == name.lower())
    )
    existing = dup.scalars().first()
    if existing:
        raise _error(
            409,
            "DUPLICATE_RESOURCE",
            f'"{existing.name}" is already in your exercise list.',
            [{"field": "name", "message": f"Use the existing exercise (ID {existing.id})."}],
        )

    # Admins add to the shared library; everyone else gets a private exercise.
    exercise = Exercise(
        name=name,
        category=payload.category,
        muscle_group=payload.muscle_group,
        met_value=payload.met_value,
        status="approved" if token.role == "admin" else "private",
        created_by_id=user_id,
    )
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)

    response.headers["Location"] = f"{settings.API_V1_PREFIX}/exercises/{exercise.id}"
    return exercise


@router.get(
    "/{id}",
    response_model=ExerciseResponse,
    summary="Get one exercise (Role: athlete, admin)",
    responses={404: {"description": "Not found or not visible to you"}},
)
async def get_exercise(
    id: int,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    return await _get_visible(db, id, token)


@router.patch(
    "/{id}",
    response_model=ExerciseResponse,
    summary="Edit my custom exercise; admins can also add it to the shared library",
    responses={403: {"description": "Not your exercise, or status change by non-admin"}},
)
async def update_exercise(
    id: int,
    payload: ExerciseUpdate,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    exercise = await db.get(Exercise, id)
    if not exercise or (
        token.role != "admin"
        and exercise.status != "approved"
        and exercise.created_by_id != user_id
    ):
        raise _error(404, "RESOURCE_NOT_FOUND", f"Exercise with ID {id} does not exist.")

    if token.role != "admin" and exercise.created_by_id != user_id:
        raise _error(403, "FORBIDDEN", "You can only edit exercises you created.")

    if payload.status is not None and token.role != "admin":
        raise _error(403, "FORBIDDEN", "Only coaches can move exercises into the shared library.")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(exercise, field, val)

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete my custom exercise (admins: any exercise)",
    responses={403: {"description": "Not your exercise"}, 404: {"description": "Not found"}},
)
async def delete_exercise(
    id: int,
    token: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    exercise = await db.get(Exercise, id)
    if not exercise or (
        token.role != "admin"
        and exercise.status != "approved"
        and exercise.created_by_id != user_id
    ):
        raise _error(404, "RESOURCE_NOT_FOUND", f"Exercise with ID {id} does not exist.")

    if token.role != "admin" and exercise.created_by_id != user_id:
        raise _error(403, "FORBIDDEN", "You can only delete exercises you created.")

    await db.delete(exercise)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
