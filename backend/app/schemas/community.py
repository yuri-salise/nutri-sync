from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FeedAuthor(BaseModel):
    id: int
    name: str


class FeedExercise(BaseModel):
    name: str
    sets: int
    reps: int
    top_weight_kg: float
    is_pr: bool = False


class FeedItem(BaseModel):
    """One card in the community feed (a workout, a GPS activity, or a text post)."""

    key: str = Field(..., description="Stable key such as 'workout-12'")
    type: str = Field(..., description="workout | run | post")
    id: int
    timestamp: datetime
    author: FeedAuthor
    title: str
    text: Optional[str] = None
    burned_kcal: Optional[float] = None

    # workout
    duration_min: Optional[int] = None
    exercises: Optional[List[FeedExercise]] = None
    prs_count: Optional[int] = None
    has_verified_pr: Optional[bool] = None

    # GPS activity
    sport_type: Optional[str] = None
    surface_type: Optional[str] = None
    distance_km: Optional[float] = None
    duration_sec: Optional[int] = None
    elevation_gain_m: Optional[float] = None
    route: Optional[List[List[float]]] = Field(
        None, description="[[lat, lng], ...], thinned, start/end hidden for other users"
    )
    route_hidden_ends: bool = False

    kudos_count: int = 0
    kudos_by_me: bool = False
    comments_count: int = 0
    mine: bool = False


class PostCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Write something before posting.")
        return v

    model_config = ConfigDict(json_schema_extra={"example": {"body": "Hit a new squat PR today!"}})


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)

    @field_validator("body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Write a comment before sending.")
        return v

    model_config = ConfigDict(json_schema_extra={"example": {"body": "Great pace!"}})


class CommentResponse(BaseModel):
    id: int
    author: FeedAuthor
    body: str
    created_at: datetime
    mine: bool = False


class KudosState(BaseModel):
    kudos_count: int
    kudos_by_me: bool
