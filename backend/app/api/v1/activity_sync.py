from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, require_roles
from app.db.models import User
from app.db.session import get_db
from app.services.activity_sync_service import calculate_daily_activity_synced_summary

router = APIRouter(tags=["Activity Synchronization"])


@router.get(
    "/activity-synced-summary",
    summary="Compute dynamic calorie and macronutrient targets synchronized with daily physical activity",
)
async def get_activity_synced_summary(
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {"code": "USER_NOT_FOUND", "message": "User not found.", "details": []}
            },
        )

    summary = await calculate_daily_activity_synced_summary(db, user)
    return summary
