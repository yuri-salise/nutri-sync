from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.exercise import ExerciseResponse


class WorkoutSetCreate(BaseModel):
    exercise_id: int
    set_no: int = Field(..., ge=1)
    reps: int = Field(..., ge=1, le=500)
    weight_kg: float = Field(..., ge=0.0, le=1000.0)
    is_pr: bool = False


class WorkoutSetResponse(BaseModel):
    id: int
    session_id: int
    exercise_id: int
    set_no: int
    reps: int
    weight_kg: float
    is_pr: bool
    verified_by_id: Optional[int] = None
    exercise: Optional[ExerciseResponse] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkoutSessionCreate(BaseModel):
    split_title: str = Field(..., min_length=2, max_length=255)
    duration_min: int = Field(default=60, ge=1, le=1440)
    burned_kcal: Optional[float] = Field(None, ge=0.0)
    is_public: bool = True
    session_date: Optional[datetime] = None
    sets: List[WorkoutSetCreate] = Field(default_factory=list)


class WorkoutSessionUpdate(BaseModel):
    split_title: Optional[str] = Field(None, min_length=2, max_length=255)
    duration_min: Optional[int] = Field(None, ge=1, le=1440)
    burned_kcal: Optional[float] = Field(None, ge=0.0)
    is_public: Optional[bool] = None


class WorkoutSessionResponse(BaseModel):
    id: int
    user_id: int
    split_title: str
    duration_min: int
    burned_kcal: float
    is_public: bool
    session_date: datetime
    created_at: datetime
    sets: List[WorkoutSetResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
