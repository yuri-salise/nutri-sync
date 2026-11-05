import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import Exercise
from app.db.session import get_db
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.exercise import ExerciseCreate, ExerciseResponse, ExerciseUpdate

router = APIRouter(prefix="/exercises", tags=["Exercises"])


@router.get(
    "",
    response_model=PaginatedResponse[ExerciseResponse],
    summary="List exercises with pagination, filtering, and sorting (Requirement B6)"
)
async def list_exercises(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    muscle_group: Optional[str] = Query(None, description="Filter by muscle group"),
    category: Optional[str] = Query(None, description="Filter by exercise category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (pending|approved)"),
    q: Optional[str] = Query(None, description="Search query string"),
    sort: Optional[str] = Query("-created_at", description="Sort field (prefix with - for desc)"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Exercise)

    if muscle_group:
        query = query.where(Exercise.muscle_group == muscle_group)
    if category:
        query = query.where(Exercise.category == category)
    if status_filter:
        query = query.where(Exercise.status == status_filter)
    if q:
        query = query.where(
            or_(
                Exercise.name.ilike(f"%{q}%"),
                Exercise.muscle_group.ilike(f"%{q}%"),
                Exercise.category.ilike(f"%{q}%"),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Sorting
    if sort:
        is_desc = sort.startswith("-")
        col_name = sort[1:] if is_desc else sort
        col_attr = getattr(Exercise, col_name, None)
        if col_attr is not None:
            query = query.order_by(desc(col_attr) if is_desc else asc(col_attr))
        else:
            query = query.order_by(desc(Exercise.created_at))
    else:
        query = query.order_by(desc(Exercise.created_at))

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    items = list(res.scalars().all())

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=items,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=total_pages
        )
    )


@router.post(
    "",
    response_model=ExerciseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or submit a custom exercise"
)
async def create_exercise(
    payload: ExerciseCreate,
    response: Response,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    user_id = int(token_payload.sub)
    exercise_status = "approved" if token_payload.role == "admin" else "pending"

    exercise = Exercise(
        name=payload.name,
        category=payload.category,
        muscle_group=payload.muscle_group,
        met_value=payload.met_value,
        status=exercise_status,
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
    summary="Get single exercise by ID"
)
async def get_exercise(id: int, db: AsyncSession = Depends(get_db)):
    exercise = await db.get(Exercise, id)
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Exercise with ID {id} does not exist.",
                    "details": []
                }
            }
        )
    return exercise


@router.patch(
    "/{id}",
    response_model=ExerciseResponse,
    summary="Update an exercise (Admins can approve/reject; Creators can update fields)"
)
async def update_exercise(
    id: int,
    payload: ExerciseUpdate,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    exercise = await db.get(Exercise, id)
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Exercise with ID {id} does not exist.",
                    "details": []
                }
            }
        )

    user_id = int(token_payload.sub)
    if token_payload.role != "admin" and exercise.created_by_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only update exercises that you created.",
                    "details": []
                }
            }
        )

    # Only admin can change status to approved/rejected
    if payload.status is not None and token_payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Only coaches or administrators can approve/reject exercise submissions.",
                    "details": []
                }
            }
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(exercise, field, val)

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an exercise"
)
async def delete_exercise(
    id: int,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    exercise = await db.get(Exercise, id)
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RESOURCE_NOT_FOUND",
                    "message": f"Exercise with ID {id} does not exist.",
                    "details": []
                }
            }
        )

    user_id = int(token_payload.sub)
    if token_payload.role != "admin" and exercise.created_by_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only delete exercises you created.",
                    "details": []
                }
            }
        )

    await db.delete(exercise)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
