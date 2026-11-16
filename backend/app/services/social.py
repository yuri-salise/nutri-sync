"""Shared helpers for the community feed: target lookup, visibility and cleanup."""

from typing import Optional, Tuple

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import RunActivity, WorkoutSession
from app.db.social_models import FeedComment, FeedPost, Kudos

TARGET_MODELS = {"workout": WorkoutSession, "run": RunActivity, "post": FeedPost}


async def find_visible_target(
    db: AsyncSession, target_type: str, target_id: int, viewer_id: int
) -> Optional[Tuple[object, int]]:
    """Returns (row, owner_id) if the viewer may see this feed item, else None.

    Posts are always visible. Workouts and activities are visible when public, or when the
    viewer owns them. Callers answer 404 for None so private items are never revealed.
    """
    model = TARGET_MODELS.get(target_type)
    if model is None:
        return None
    row = await db.get(model, target_id)
    if row is None:
        return None
    if target_type != "post" and not row.is_public and row.user_id != viewer_id:
        return None
    return row, row.user_id


async def delete_social_for(db: AsyncSession, target_type: str, target_id: int) -> None:
    """Removes kudos and comments for a feed item that is being deleted."""
    await db.execute(
        delete(Kudos).where(Kudos.target_type == target_type, Kudos.target_id == target_id)
    )
    await db.execute(
        delete(FeedComment).where(
            FeedComment.target_type == target_type, FeedComment.target_id == target_id
        )
    )
