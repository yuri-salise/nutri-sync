"""Activity types (run/walk/ride/hike) and the social feed (posts, kudos, comments)

Revision ID: 004_activity_types_social
Revises: 003_workout_routines
Create Date: 2026-11-17 12:00:00.000000

- run_activities gets sport_type (default 'run') and an optional title
- new tables: feed_posts, kudos, feed_comments
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "004_activity_types_social"
down_revision: Union[str, None] = "003_workout_routines"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("run_activities") as batch:
        batch.add_column(
            sa.Column("sport_type", sa.String(length=20), nullable=False, server_default="run")
        )
        batch.add_column(sa.Column("title", sa.String(length=120), nullable=True))
        batch.create_check_constraint(
            "ck_run_activities_sport_type", "sport_type IN ('run', 'walk', 'ride', 'hike')"
        )

    op.create_table(
        "feed_posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_feed_posts_id", "feed_posts", ["id"])
    op.create_index("ix_feed_posts_user_id", "feed_posts", ["user_id"])
    op.create_index("ix_feed_posts_created_at", "feed_posts", ["created_at"])

    op.create_table(
        "kudos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_kudos_user_target"),
        sa.CheckConstraint("target_type IN ('workout', 'run', 'post')", name="ck_kudos_target"),
    )
    op.create_index("ix_kudos_id", "kudos", ["id"])
    op.create_index("ix_kudos_user_id", "kudos", ["user_id"])
    op.create_index("ix_kudos_target", "kudos", ["target_type", "target_id"])

    op.create_table(
        "feed_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "target_type IN ('workout', 'run', 'post')", name="ck_feed_comments_target"
        ),
    )
    op.create_index("ix_feed_comments_id", "feed_comments", ["id"])
    op.create_index("ix_feed_comments_user_id", "feed_comments", ["user_id"])
    op.create_index("ix_feed_comments_target", "feed_comments", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_table("feed_comments")
    op.drop_table("kudos")
    op.drop_table("feed_posts")
    with op.batch_alter_table("run_activities") as batch:
        batch.drop_constraint("ck_run_activities_sport_type", type_="check")
        batch.drop_column("title")
        batch.drop_column("sport_type")
