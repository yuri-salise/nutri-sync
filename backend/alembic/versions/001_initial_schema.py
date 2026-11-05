"""Initial database schema with pgvector

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-11-05 20:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable vector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("base_kcal_goal", sa.Float(), nullable=False),
        sa.Column("protein_goal_g", sa.Float(), nullable=False),
        sa.Column("carbs_goal_g", sa.Float(), nullable=False),
        sa.Column("fat_goal_g", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    # 2. exercises
    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("muscle_group", sa.String(length=100), nullable=False),
        sa.Column("met_value", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exercises_id"), "exercises", ["id"], unique=False)
    op.create_index(op.f("ix_exercises_muscle_group"), "exercises", ["muscle_group"], unique=False)
    op.create_index(op.f("ix_exercises_name"), "exercises", ["name"], unique=False)

    # 3. workout_sessions
    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("split_title", sa.String(length=255), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("burned_kcal", sa.Float(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("session_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workout_sessions_id"), "workout_sessions", ["id"], unique=False)
    op.create_index(
        op.f("ix_workout_sessions_user_id"), "workout_sessions", ["user_id"], unique=False
    )

    # 4. workout_sets
    op.create_table(
        "workout_sets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("exercise_id", sa.Integer(), nullable=False),
        sa.Column("set_no", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("is_pr", sa.Boolean(), nullable=False),
        sa.Column("verified_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["workout_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verified_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_workout_sets_exercise_id"), "workout_sets", ["exercise_id"], unique=False
    )
    op.create_index(op.f("ix_workout_sets_id"), "workout_sets", ["id"], unique=False)
    op.create_index(
        op.f("ix_workout_sets_session_id"), "workout_sets", ["session_id"], unique=False
    )

    # 5. run_activities
    op.create_table(
        "run_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("surface_type", sa.String(length=50), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=False),
        sa.Column("duration_sec", sa.Integer(), nullable=False),
        sa.Column("elevation_gain_m", sa.Float(), nullable=False),
        sa.Column("burned_kcal", sa.Float(), nullable=False),
        sa.Column("route_geojson", sa.Text(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_run_activities_id"), "run_activities", ["id"], unique=False)
    op.create_index(op.f("ix_run_activities_user_id"), "run_activities", ["user_id"], unique=False)

    # 6. nutrition_knowledge_items
    op.create_table(
        "nutrition_knowledge_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("food_name", sa.String(length=255), nullable=False),
        sa.Column("source_dataset", sa.String(length=50), nullable=False),
        sa.Column("kcal_per_100g", sa.Float(), nullable=False),
        sa.Column("protein_per_100g", sa.Float(), nullable=False),
        sa.Column("carbs_per_100g", sa.Float(), nullable=False),
        sa.Column("fat_per_100g", sa.Float(), nullable=False),
        sa.Column("serving_description", sa.String(length=255), nullable=False),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_nutrition_knowledge_items_food_name"),
        "nutrition_knowledge_items",
        ["food_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_nutrition_knowledge_items_id"), "nutrition_knowledge_items", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_nutrition_knowledge_items_source_dataset"),
        "nutrition_knowledge_items",
        ["source_dataset"],
        unique=False,
    )

    # 7. rag_scan_logs
    op.create_table(
        "rag_scan_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("query_input", sa.Text(), nullable=False),
        sa.Column("retrieved_item_ids", sa.Text(), nullable=False),
        sa.Column("top_similarity_score", sa.Float(), nullable=False),
        sa.Column("predicted_macros_json", sa.Text(), nullable=False),
        sa.Column("model_version", sa.String(length=100), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("used_fallback", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rag_scan_logs_id"), "rag_scan_logs", ["id"], unique=False)
    op.create_index(op.f("ix_rag_scan_logs_user_id"), "rag_scan_logs", ["user_id"], unique=False)

    # 8. nutrition_logs
    op.create_table(
        "nutrition_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("rag_scan_id", sa.Integer(), nullable=True),
        sa.Column("meal_name", sa.String(length=255), nullable=False),
        sa.Column("total_kcal", sa.Float(), nullable=False),
        sa.Column("protein_g", sa.Float(), nullable=False),
        sa.Column("carbs_g", sa.Float(), nullable=False),
        sa.Column("fat_g", sa.Float(), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["rag_scan_id"], ["rag_scan_logs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_nutrition_logs_id"), "nutrition_logs", ["id"], unique=False)
    op.create_index(op.f("ix_nutrition_logs_user_id"), "nutrition_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("nutrition_logs")
    op.drop_table("rag_scan_logs")
    op.drop_table("nutrition_knowledge_items")
    op.drop_table("run_activities")
    op.drop_table("workout_sets")
    op.drop_table("workout_sessions")
    op.drop_table("exercises")
    op.drop_table("users")
