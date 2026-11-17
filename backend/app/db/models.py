from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import relationship

from app.db.base import Base


# Compile Vector as TEXT when using SQLite
@compiles(Vector, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    return "TEXT"


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="athlete", nullable=False)  # "athlete" or "admin"
    weight_kg = Column(Float, default=70.0, nullable=False)
    base_kcal_goal = Column(Float, default=2200.0, nullable=False)
    protein_goal_g = Column(Float, default=150.0, nullable=False)
    carbs_goal_g = Column(Float, default=250.0, nullable=False)
    fat_goal_g = Column(Float, default=65.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    exercises_created = relationship(
        "Exercise", back_populates="created_by", foreign_keys="Exercise.created_by_id"
    )
    workout_sessions = relationship(
        "WorkoutSession", back_populates="user", cascade="all, delete-orphan"
    )
    run_activities = relationship(
        "RunActivity", back_populates="user", cascade="all, delete-orphan"
    )
    nutrition_logs = relationship(
        "NutritionLog", back_populates="user", cascade="all, delete-orphan"
    )
    rag_scans = relationship("RagScanLog", back_populates="user", cascade="all, delete-orphan")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    category = Column(
        String(100), default="compound", nullable=False
    )  # compound, isolation, bodyweight
    muscle_group = Column(
        String(100), index=True, nullable=False
    )  # chest, back, legs, shoulders, arms, core
    met_value = Column(Float, default=6.0, nullable=False)  # Metabolic Equivalent of Task
    status = Column(
        String(50), default="approved", nullable=False
    )  # "pending", "approved", "rejected"
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    created_by = relationship(
        "User", back_populates="exercises_created", foreign_keys=[created_by_id]
    )
    workout_sets = relationship("WorkoutSet", back_populates="exercise")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    split_title = Column(
        String(255), nullable=False
    )  # e.g., "Push Day A", "Heavy Legs", "Back & Biceps"
    duration_min = Column(Integer, default=60, nullable=False)
    burned_kcal = Column(Float, default=350.0, nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    session_date = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="workout_sessions")
    sets = relationship("WorkoutSet", back_populates="session", cascade="all, delete-orphan")


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id = Column(
        Integer, ForeignKey("exercises.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    set_no = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=False)
    is_pr = Column(Boolean, default=False, nullable=False)
    verified_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    session = relationship("WorkoutSession", back_populates="sets")
    exercise = relationship("Exercise", back_populates="workout_sets")
    verified_by = relationship("User", foreign_keys=[verified_by_id])


class RunActivity(Base):
    __tablename__ = "run_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    surface_type = Column(String(50), default="road", nullable=False)  # "road" or "trail"
    sport_type = Column(String(20), default="run", nullable=False)  # run | walk | ride | hike
    title = Column(String(120), nullable=True)
    distance_km = Column(Float, nullable=False)
    duration_sec = Column(Integer, nullable=False)
    elevation_gain_m = Column(Float, default=0.0, nullable=False)
    burned_kcal = Column(Float, nullable=False)
    route_geojson = Column(Text, nullable=True)  # GeoJSON string for Leaflet polyline rendering
    is_public = Column(Boolean, default=True, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="run_activities")


class NutritionKnowledgeItem(Base):
    __tablename__ = "nutrition_knowledge_items"

    id = Column(Integer, primary_key=True, index=True)
    food_name = Column(String(255), index=True, nullable=False)
    source_dataset = Column(String(50), index=True, nullable=False)  # "FNRI" or "USDA"
    kcal_per_100g = Column(Float, nullable=False)
    protein_per_100g = Column(Float, nullable=False)
    carbs_per_100g = Column(Float, nullable=False)
    fat_per_100g = Column(Float, nullable=False)
    serving_description = Column(String(255), default="100g portion", nullable=False)
    # All known household portions, " | "-separated, e.g. "1 cup (158g) | 1 medium (118g)".
    # serving_description stays the single default shown in the UI.
    portions = Column(Text, nullable=True)
    embedding = Column(Vector(384), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class RagScanLog(Base):
    """Traceability & Audit Log for Requirement T4."""

    __tablename__ = "rag_scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    query_input = Column(Text, nullable=False)
    retrieved_item_ids = Column(Text, nullable=False)  # JSON-encoded array of IDs
    top_similarity_score = Column(Float, nullable=False)
    predicted_macros_json = Column(Text, nullable=False)  # JSON-encoded calculated nutrition
    model_version = Column(String(100), default="all-MiniLM-L6-v2 + heuristic", nullable=False)
    latency_ms = Column(Float, nullable=False)
    used_fallback = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="rag_scans")
    nutrition_logs = relationship("NutritionLog", back_populates="rag_scan")


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rag_scan_id = Column(
        Integer, ForeignKey("rag_scan_logs.id", ondelete="SET NULL"), nullable=True
    )
    meal_name = Column(String(255), nullable=False)
    total_kcal = Column(Float, nullable=False)
    protein_g = Column(Float, nullable=False)
    carbs_g = Column(Float, nullable=False)
    fat_g = Column(Float, nullable=False)
    logged_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="nutrition_logs")
    rag_scan = relationship("RagScanLog", back_populates="nutrition_logs")
