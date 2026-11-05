import json
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import RunActivity, WorkoutSession, WorkoutSet
from app.db.session import get_db
from app.schemas.common import PaginatedResponse, PaginationMeta

router = APIRouter(prefix="/community-feed", tags=["Community"])


def mask_route_privacy(geojson_str: Optional[str]) -> Optional[str]:
    """
    Masks the first and last coordinates of a run route in accordance
    with the Philippine Data Privacy Act of 2012 (RA 10173) to protect
    the user's home or origin/destination privacy.
    """
    if not geojson_str:
        return None
    try:
        data = json.loads(geojson_str)
        coords = data.get("coordinates", [])
        if len(coords) > 6:
            # Mask first 3 and last 3 points
            data["coordinates"] = coords[3:-3]
            data["privacy_masked"] = True
        return json.dumps(data)
    except Exception:
        return geojson_str


@router.get(
    "",
    summary="Get paginated community feed of public workouts, verified PRs, and runs"
)
async def get_community_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    activity_type: Optional[str] = Query(None, description="all | workouts | runs"),
    db: AsyncSession = Depends(get_db)
):
    feed_items = []

    if activity_type in (None, "all", "workouts"):
        # Public workouts
        w_stmt = (
            select(WorkoutSession)
            .options(
                selectinload(WorkoutSession.user),
                selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise)
            )
            .where(WorkoutSession.is_public == True)
            .order_by(desc(WorkoutSession.session_date))
            .limit(limit)
        )
        w_res = await db.execute(w_stmt)
        for w in w_res.scalars().all():
            prs = [s for s in w.sets if s.is_pr]
            feed_items.append({
                "type": "workout",
                "id": f"workout-{w.id}",
                "timestamp": w.session_date.isoformat(),
                "user_name": w.user.full_name if w.user else "Athlete",
                "title": w.split_title,
                "duration_min": w.duration_min,
                "burned_kcal": w.burned_kcal,
                "prs_count": len(prs),
                "has_verified_pr": any(s.verified_by_id is not None for s in prs),
                "sets": [
                    {
                        "exercise": s.exercise.name if s.exercise else "Exercise",
                        "weight_kg": s.weight_kg,
                        "reps": s.reps,
                        "is_pr": s.is_pr,
                        "verified": s.verified_by_id is not None
                    } for s in w.sets
                ]
            })

    if activity_type in (None, "all", "runs"):
        # Public runs
        r_stmt = (
            select(RunActivity)
            .options(selectinload(RunActivity.user))
            .where(RunActivity.is_public == True)
            .order_by(desc(RunActivity.recorded_at))
            .limit(limit)
        )
        r_res = await db.execute(r_stmt)
        for r in r_res.scalars().all():
            feed_items.append({
                "type": "run",
                "id": f"run-{r.id}",
                "timestamp": r.recorded_at.isoformat(),
                "user_name": r.user.full_name if r.user else "Runner",
                "title": f"{r.surface_type.capitalize()} Run",
                "surface_type": r.surface_type,
                "distance_km": r.distance_km,
                "duration_sec": r.duration_sec,
                "elevation_gain_m": r.elevation_gain_m,
                "burned_kcal": r.burned_kcal,
                "route_geojson": mask_route_privacy(r.route_geojson),
            })

    # Sort combined feed items descending by timestamp
    feed_items.sort(key=lambda x: x["timestamp"], reverse=True)

    total = len(feed_items)
    offset = (page - 1) * limit
    paginated_items = feed_items[offset:offset + limit]
    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedResponse(
        data=paginated_items,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=total_pages
        )
    )
