"""Community feed: status posts, kudos (likes) and comments.

Kudos and comments attach to a feed item by (target_type, target_id), where target_type is
"workout", "run" or "post". There is no foreign key to the target (it spans three tables),
so the API removes a target's kudos and comments when the target is deleted.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base import Base

TARGET_TYPES = ("workout", "run", "post")


def _utcnow():
    return datetime.now(timezone.utc)


class FeedPost(Base):
    __tablename__ = "feed_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)

    user = relationship("User")


class Kudos(Base):
    __tablename__ = "kudos"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_kudos_user_target"),
        Index("ix_kudos_target", "target_type", "target_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_type = Column(String(20), nullable=False)
    target_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


class FeedComment(Base):
    __tablename__ = "feed_comments"
    __table_args__ = (Index("ix_feed_comments_target", "target_type", "target_id"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_type = Column(String(20), nullable=False)
    target_id = Column(Integer, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User")
