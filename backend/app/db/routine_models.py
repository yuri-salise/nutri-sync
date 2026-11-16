"""Saved workout routines ("templates"): a named, ordered list of exercises with targets.

A user taps a routine to start a workout pre-filled with its exercises, so they don't
have to re-enter the same plan every gym day.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


def _utcnow():
    return datetime.now(timezone.utc)


class WorkoutRoutine(Base):
    __tablename__ = "workout_routines"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_workout_routines_user_name"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name = Column(String(120), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    exercises = relationship(
        "WorkoutRoutineExercise",
        back_populates="routine",
        cascade="all, delete-orphan",
        order_by="WorkoutRoutineExercise.position",
        lazy="selectin",
    )


class WorkoutRoutineExercise(Base):
    __tablename__ = "workout_routine_exercises"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(
        Integer,
        ForeignKey("workout_routines.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    exercise_id = Column(
        Integer, ForeignKey("exercises.id", ondelete="CASCADE"), index=True, nullable=False
    )
    position = Column(Integer, nullable=False, default=1)
    target_sets = Column(Integer, nullable=False, default=3)
    target_reps = Column(Integer, nullable=False, default=10)
    target_weight_kg = Column(Float, nullable=False, default=0.0)
    rest_sec = Column(Integer, nullable=False, default=90)

    routine = relationship("WorkoutRoutine", back_populates="exercises")
    exercise = relationship("Exercise", lazy="selectin")
