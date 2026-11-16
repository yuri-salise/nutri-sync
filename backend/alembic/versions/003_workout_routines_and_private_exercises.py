"""Workout routines, private custom exercises, built-in exercise library

Revision ID: 003_workout_routines
Revises: 002_enable_row_level_security
Create Date: 2026-11-17 00:00:00.000000

- New tables: workout_routines, workout_routine_exercises
- Custom exercises no longer need coach approval: they are private to their creator
  (status "private"). Existing pending/rejected submissions become private.
- Inserts the built-in common exercise library (skips names that already exist).
"""

from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from app.db.common_exercises import COMMON_EXERCISES

revision: str = "003_workout_routines"
down_revision: Union[str, None] = "002_enable_row_level_security"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workout_routines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_workout_routines_user_name"),
    )
    op.create_index("ix_workout_routines_id", "workout_routines", ["id"])
    op.create_index("ix_workout_routines_user_id", "workout_routines", ["user_id"])

    op.create_table(
        "workout_routine_exercises",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "routine_id",
            sa.Integer(),
            sa.ForeignKey("workout_routines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            sa.Integer(),
            sa.ForeignKey("exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("target_sets", sa.Integer(), nullable=False),
        sa.Column("target_reps", sa.Integer(), nullable=False),
        sa.Column("target_weight_kg", sa.Float(), nullable=False),
        sa.Column("rest_sec", sa.Integer(), nullable=False),
        sa.CheckConstraint("target_sets >= 1", name="ck_routine_ex_sets_positive"),
        sa.CheckConstraint("target_reps >= 1", name="ck_routine_ex_reps_positive"),
        sa.CheckConstraint("target_weight_kg >= 0", name="ck_routine_ex_weight_nonneg"),
        sa.CheckConstraint("rest_sec >= 0", name="ck_routine_ex_rest_nonneg"),
    )
    op.create_index("ix_workout_routine_exercises_id", "workout_routine_exercises", ["id"])
    op.create_index(
        "ix_workout_routine_exercises_routine_id", "workout_routine_exercises", ["routine_id"]
    )
    op.create_index(
        "ix_workout_routine_exercises_exercise_id", "workout_routine_exercises", ["exercise_id"]
    )

    # Custom exercises are now private instead of waiting for approval.
    op.execute("UPDATE exercises SET status = 'private' WHERE status IN ('pending', 'rejected')")

    # Built-in exercise library.
    bind = op.get_bind()
    existing = {
        row[0].lower()
        for row in bind.execute(sa.text("SELECT name FROM exercises WHERE status = 'approved'"))
    }
    exercises = sa.table(
        "exercises",
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("muscle_group", sa.String),
        sa.column("met_value", sa.Float),
        sa.column("status", sa.String),
        sa.column("created_by_id", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    rows = [
        {
            "name": name,
            "category": cat,
            "muscle_group": muscle,
            "met_value": met,
            "status": "approved",
            "created_by_id": None,
            "created_at": now,
        }
        for name, cat, muscle, met in COMMON_EXERCISES
        if name.lower() not in existing
    ]
    if rows:
        op.bulk_insert(exercises, rows)

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE workout_routine_exercises ENABLE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY workout_routines_owner_policy ON workout_routines
            FOR ALL
            USING (
                user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                OR current_setting('app.current_user_role', true) = 'admin'
            );
        """)
        op.execute("""
            CREATE POLICY workout_routine_exercises_owner_policy ON workout_routine_exercises
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM workout_routines r
                    WHERE r.id = routine_id
                    AND (
                        r.user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                        OR current_setting('app.current_user_role', true) = 'admin'
                    )
                )
            );
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "DROP POLICY IF EXISTS workout_routine_exercises_owner_policy ON workout_routine_exercises;"
        )
        op.execute("DROP POLICY IF EXISTS workout_routines_owner_policy ON workout_routines;")
    op.drop_table("workout_routine_exercises")
    op.drop_table("workout_routines")
    op.execute("UPDATE exercises SET status = 'pending' WHERE status = 'private'")
