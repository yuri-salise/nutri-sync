import math
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import TokenPayload, require_roles
from app.db.models import RunActivity, WorkoutSession, WorkoutSet
from app.db.session import get_db, set_rls_context
from app.db.social_models import TARGET_TYPES, FeedComment, FeedPost, Kudos
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.community import (
    CommentCreate,
    CommentResponse,
    FeedAuthor,
    FeedExercise,
    FeedItem,
    KudosState,
    PostCreate,
)
from app.services.route import feed_route
from app.services.social import delete_social_for, find_visible_target

router = APIRouter(prefix="/community-feed", tags=["Community"])

AUTHENTICATED = ["athlete", "admin"]
SPORT_LABELS = {"run": "Run", "walk": "Walk", "ride": "Ride", "hike": "Hike"}


def _error(code: int, err: str, message: str, details: Optional[list] = None) -> HTTPException:
    return HTTPException(
        status_code=code,
        detail={"error": {"code": err, "message": message, "details": details or []}},
    )


def _author(user, fallback: str = "Athlete") -> FeedAuthor:
    return FeedAuthor(id=user.id if user else 0, name=user.full_name if user else fallback)


def _workout_exercises(w: WorkoutSession) -> Tuple[List[FeedExercise], int]:
    groups: Dict[int, dict] = {}
    for s in sorted(w.sets, key=lambda x: x.set_no):
        g = groups.setdefault(
            s.exercise_id,
            {"name": s.exercise.name if s.exercise else "Exercise", "sets": 0, "top": -1.0},
        )
        g["sets"] += 1
        g["is_pr"] = g.get("is_pr", False) or s.is_pr
        if s.weight_kg >= g["top"]:
            g["top"], g["reps"] = s.weight_kg, s.reps
    items = [
        FeedExercise(
            name=g["name"],
            sets=g["sets"],
            reps=g["reps"],
            top_weight_kg=max(g["top"], 0.0),
            is_pr=g["is_pr"],
        )
        for g in groups.values()
    ]
    return items, sum(1 for s in w.sets if s.is_pr)


def _run_title(r: RunActivity) -> str:
    if r.title:
        return r.title
    label = SPORT_LABELS.get(r.sport_type or "run", "Activity")
    return f"{r.surface_type.capitalize()} {label}" if r.sport_type in (None, "run") else label


async def _social_counts(db: AsyncSession, items: List[FeedItem], viewer_id: int) -> None:
    """Fills kudos/comment counts and 'did I give kudos' for a page of items (3 queries)."""
    if not items:
        return
    by_type: Dict[str, List[int]] = defaultdict(list)
    for it in items:
        by_type[it.type].append(it.id)

    def targets(col_type, col_id):
        return or_(*[and_(col_type == t, col_id.in_(ids)) for t, ids in by_type.items()])

    kudos_rows = await db.execute(
        select(Kudos.target_type, Kudos.target_id, func.count())
        .where(targets(Kudos.target_type, Kudos.target_id))
        .group_by(Kudos.target_type, Kudos.target_id)
    )
    kudos = {(t, i): c for t, i, c in kudos_rows.all()}

    mine_rows = await db.execute(
        select(Kudos.target_type, Kudos.target_id).where(
            targets(Kudos.target_type, Kudos.target_id), Kudos.user_id == viewer_id
        )
    )
    mine = {(t, i) for t, i in mine_rows.all()}

    comment_rows = await db.execute(
        select(FeedComment.target_type, FeedComment.target_id, func.count())
        .where(targets(FeedComment.target_type, FeedComment.target_id))
        .group_by(FeedComment.target_type, FeedComment.target_id)
    )
    comments = {(t, i): c for t, i, c in comment_rows.all()}

    for it in items:
        k = (it.type, it.id)
        it.kudos_count = kudos.get(k, 0)
        it.kudos_by_me = k in mine
        it.comments_count = comments.get(k, 0)


@router.get(
    "",
    response_model=PaginatedResponse[FeedItem],
    summary="Community feed: public workouts, GPS activities and posts, newest first",
)
async def get_community_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    activity_type: Optional[str] = Query(
        "all", pattern="^(all|workouts|runs|posts)$", description="all | workouts | runs | posts"
    ),
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    viewer_id = int(token.sub)
    await set_rls_context(db, user_id=viewer_id, role=token.role)
    want = activity_type or "all"
    need = page * limit  # each source can contribute up to this many items to the page
    items: List[FeedItem] = []
    total = 0

    if want in ("all", "workouts"):
        visible = or_(WorkoutSession.is_public == True, WorkoutSession.user_id == viewer_id)
        total += (
            await db.execute(select(func.count(WorkoutSession.id)).where(visible))
        ).scalar_one()
        rows = await db.execute(
            select(WorkoutSession)
            .options(
                selectinload(WorkoutSession.user),
                selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise),
            )
            .where(visible)
            .order_by(desc(WorkoutSession.session_date))
            .limit(need)
        )
        for w in rows.scalars().all():
            exercises, prs = _workout_exercises(w)
            items.append(
                FeedItem(
                    key=f"workout-{w.id}",
                    type="workout",
                    id=w.id,
                    timestamp=w.session_date,
                    author=_author(w.user),
                    title=w.split_title,
                    burned_kcal=w.burned_kcal,
                    duration_min=w.duration_min,
                    exercises=exercises,
                    prs_count=prs,
                    has_verified_pr=any(s.verified_by_id is not None for s in w.sets if s.is_pr),
                    mine=w.user_id == viewer_id,
                )
            )

    if want in ("all", "runs"):
        visible = or_(RunActivity.is_public == True, RunActivity.user_id == viewer_id)
        total += (await db.execute(select(func.count(RunActivity.id)).where(visible))).scalar_one()
        rows = await db.execute(
            select(RunActivity)
            .options(selectinload(RunActivity.user))
            .where(visible)
            .order_by(desc(RunActivity.recorded_at))
            .limit(need)
        )
        for r in rows.scalars().all():
            is_mine = r.user_id == viewer_id
            route = feed_route(r.route_geojson, hide_ends=not is_mine)
            items.append(
                FeedItem(
                    key=f"run-{r.id}",
                    type="run",
                    id=r.id,
                    timestamp=r.recorded_at,
                    author=_author(r.user, "Athlete"),
                    title=_run_title(r),
                    burned_kcal=r.burned_kcal,
                    sport_type=r.sport_type or "run",
                    surface_type=r.surface_type,
                    distance_km=r.distance_km,
                    duration_sec=r.duration_sec,
                    elevation_gain_m=r.elevation_gain_m,
                    route=route or None,
                    route_hidden_ends=not is_mine,
                    mine=is_mine,
                )
            )

    if want in ("all", "posts"):
        total += (await db.execute(select(func.count(FeedPost.id)))).scalar_one()
        rows = await db.execute(
            select(FeedPost)
            .options(selectinload(FeedPost.user))
            .order_by(desc(FeedPost.created_at))
            .limit(need)
        )
        for p in rows.scalars().all():
            items.append(
                FeedItem(
                    key=f"post-{p.id}",
                    type="post",
                    id=p.id,
                    timestamp=p.created_at,
                    author=_author(p.user),
                    title="",
                    text=p.body,
                    mine=p.user_id == viewer_id,
                )
            )

    items.sort(key=lambda x: x.timestamp, reverse=True)
    page_items = items[(page - 1) * limit : page * limit]
    await _social_counts(db, page_items, viewer_id)

    return PaginatedResponse(
        data=page_items,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=math.ceil(total / limit) if total else 1,
        ),
    )


# ---------------------------------------------------------------------------- posts
@router.post(
    "/posts",
    response_model=FeedItem,
    status_code=status.HTTP_201_CREATED,
    summary="Share a text post with the community (Role: athlete, admin)",
)
async def create_post(
    payload: PostCreate,
    response: Response,
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token.sub)
    await set_rls_context(db, user_id=user_id, role=token.role)
    post = FeedPost(user_id=user_id, body=payload.body)
    db.add(post)
    await db.commit()
    await db.refresh(post, attribute_names=["user"])
    response.headers["Location"] = f"{settings.API_V1_PREFIX}/community-feed/posts/{post.id}"
    return FeedItem(
        key=f"post-{post.id}",
        type="post",
        id=post.id,
        timestamp=post.created_at,
        author=_author(post.user),
        title="",
        text=post.body,
        mine=True,
    )


@router.delete(
    "/posts/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a post (Role: author, or admin for moderation)",
    responses={403: {"description": "Not your post"}, 404: {"description": "Not found"}},
)
async def delete_post(
    id: int,
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(FeedPost, id)
    if not post:
        raise _error(404, "RESOURCE_NOT_FOUND", f"Post {id} does not exist.")
    if post.user_id != int(token.sub) and token.role != "admin":
        raise _error(403, "FORBIDDEN", "You can only delete your own posts.")
    await delete_social_for(db, "post", post.id)
    await db.delete(post)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------- kudos
def _check_type(target_type: str) -> None:
    if target_type not in TARGET_TYPES:
        raise _error(
            404,
            "RESOURCE_NOT_FOUND",
            f"Unknown feed item type '{target_type}'.",
        )


async def _kudos_state(db: AsyncSession, target_type: str, target_id: int, viewer_id: int):
    count = (
        await db.execute(
            select(func.count(Kudos.id)).where(
                Kudos.target_type == target_type, Kudos.target_id == target_id
            )
        )
    ).scalar_one()
    mine = (
        await db.execute(
            select(Kudos.id).where(
                Kudos.target_type == target_type,
                Kudos.target_id == target_id,
                Kudos.user_id == viewer_id,
            )
        )
    ).first()
    return KudosState(kudos_count=count, kudos_by_me=mine is not None)


@router.put(
    "/{target_type}/{target_id}/kudos",
    response_model=KudosState,
    summary="Give kudos to a feed item; safe to repeat (Role: athlete, admin)",
    responses={404: {"description": "Item doesn't exist or is private"}},
)
async def give_kudos(
    target_type: str,
    target_id: int,
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    _check_type(target_type)
    viewer_id = int(token.sub)
    await set_rls_context(db, user_id=viewer_id, role=token.role)
    if not await find_visible_target(db, target_type, target_id, viewer_id):
        raise _error(404, "RESOURCE_NOT_FOUND", "That post isn't available.")
    existing = await db.execute(
        select(Kudos.id).where(
            Kudos.user_id == viewer_id,
            Kudos.target_type == target_type,
            Kudos.target_id == target_id,
        )
    )
    if not existing.first():
        db.add(Kudos(user_id=viewer_id, target_type=target_type, target_id=target_id))
        await db.commit()
    return await _kudos_state(db, target_type, target_id, viewer_id)


@router.delete(
    "/{target_type}/{target_id}/kudos",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Take back my kudos (Role: athlete, admin)",
)
async def remove_kudos(
    target_type: str,
    target_id: int,
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    _check_type(target_type)
    await db.execute(
        delete(Kudos).where(
            Kudos.user_id == int(token.sub),
            Kudos.target_type == target_type,
            Kudos.target_id == target_id,
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------------- comments
@router.get(
    "/{target_type}/{target_id}/comments",
    response_model=PaginatedResponse[CommentResponse],
    summary="List comments on a feed item, oldest first (Role: athlete, admin)",
    responses={404: {"description": "Item doesn't exist or is private"}},
)
async def list_comments(
    target_type: str,
    target_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    _check_type(target_type)
    viewer_id = int(token.sub)
    await set_rls_context(db, user_id=viewer_id, role=token.role)
    if not await find_visible_target(db, target_type, target_id, viewer_id):
        raise _error(404, "RESOURCE_NOT_FOUND", "That post isn't available.")

    base = select(FeedComment).where(
        FeedComment.target_type == target_type, FeedComment.target_id == target_id
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = await db.execute(
        base.options(selectinload(FeedComment.user))
        .order_by(FeedComment.created_at, FeedComment.id)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    data = [
        CommentResponse(
            id=c.id,
            author=_author(c.user),
            body=c.body,
            created_at=c.created_at,
            mine=c.user_id == viewer_id,
        )
        for c in rows.scalars().all()
    ]
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=math.ceil(total / limit) if total else 1,
        ),
    )


@router.post(
    "/{target_type}/{target_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a feed item (Role: athlete, admin)",
    responses={404: {"description": "Item doesn't exist or is private"}},
)
async def add_comment(
    target_type: str,
    target_id: int,
    payload: CommentCreate,
    response: Response,
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    _check_type(target_type)
    viewer_id = int(token.sub)
    await set_rls_context(db, user_id=viewer_id, role=token.role)
    if not await find_visible_target(db, target_type, target_id, viewer_id):
        raise _error(404, "RESOURCE_NOT_FOUND", "That post isn't available.")
    comment = FeedComment(
        user_id=viewer_id, target_type=target_type, target_id=target_id, body=payload.body
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment, attribute_names=["user"])
    response.headers["Location"] = (
        f"{settings.API_V1_PREFIX}/community-feed/{target_type}/{target_id}/comments"
    )
    return CommentResponse(
        id=comment.id,
        author=_author(comment.user),
        body=comment.body,
        created_at=comment.created_at,
        mine=True,
    )


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a comment (Role: its author, or admin for moderation)",
    responses={403: {"description": "Not your comment"}, 404: {"description": "Not found"}},
)
async def delete_comment(
    comment_id: int,
    token: TokenPayload = Depends(require_roles(AUTHENTICATED)),
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(FeedComment, comment_id)
    if not comment:
        raise _error(404, "RESOURCE_NOT_FOUND", f"Comment {comment_id} does not exist.")
    if comment.user_id != int(token.sub) and token.role != "admin":
        raise _error(403, "FORBIDDEN", "You can only delete your own comments.")
    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
