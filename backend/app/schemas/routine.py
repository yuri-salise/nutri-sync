from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.exercise import ExerciseResponse


class RoutineExerciseIn(BaseModel):
    exercise_id: int = Field(..., ge=1)
    target_sets: int = Field(3, ge=1, le=20)
    target_reps: int = Field(10, ge=1, le=100)
    target_weight_kg: float = Field(0.0, ge=0.0, le=1000.0)
    rest_sec: int = Field(90, ge=0, le=900)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "exercise_id": 1,
                "target_sets": 3,
                "target_reps": 8,
                "target_weight_kg": 60,
                "rest_sec": 120,
            }
        }
    )


class RoutineCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)
    exercises: List[RoutineExerciseIn] = Field(..., min_length=1, max_length=30)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Push Day",
                "notes": "Chest, shoulders, triceps",
                "exercises": [
                    {"exercise_id": 1, "target_sets": 4, "target_reps": 8, "target_weight_kg": 60},
                    {"exercise_id": 7, "target_sets": 3, "target_reps": 10, "rest_sec": 90},
                ],
            }
        }
    )


class RoutineUpdate(BaseModel):
    """Full or partial update. When `exercises` is given it replaces the whole list."""

    name: Optional[str] = Field(None, min_length=2, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)
    exercises: Optional[List[RoutineExerciseIn]] = Field(None, min_length=1, max_length=30)


class RoutineExerciseOut(BaseModel):
    id: int
    exercise_id: int
    position: int
    target_sets: int
    target_reps: int
    target_weight_kg: float
    rest_sec: int
    exercise: Optional[ExerciseResponse] = None

    model_config = ConfigDict(from_attributes=True)


class RoutineResponse(BaseModel):
    id: int
    user_id: int
    name: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    exercises: List[RoutineExerciseOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
