from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ExerciseBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    category: str = Field(default="compound", max_length=100)
    muscle_group: str = Field(..., max_length=100)
    met_value: float = Field(default=6.0, gt=0.5, lt=25.0)


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = None
    muscle_group: Optional[str] = None
    met_value: Optional[float] = Field(None, gt=0.5, lt=25.0)
    status: Optional[str] = Field(None, pattern="^(private|approved)$")


class ExerciseResponse(ExerciseBase):
    id: int
    status: str
    created_by_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
