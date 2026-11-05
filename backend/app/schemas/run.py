from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RunActivityCreate(BaseModel):
    surface_type: str = Field(default="road", pattern="^(road|trail)$")
    distance_km: float = Field(..., gt=0.0, le=500.0)
    duration_sec: int = Field(..., gt=0, le=86400)
    elevation_gain_m: float = Field(default=0.0, ge=0.0, le=10000.0)
    burned_kcal: Optional[float] = Field(None, ge=0.0)
    route_geojson: Optional[str] = None
    is_public: bool = True
    recorded_at: Optional[datetime] = None


class RunActivityUpdate(BaseModel):
    surface_type: Optional[str] = Field(None, pattern="^(road|trail)$")
    distance_km: Optional[float] = Field(None, gt=0.0, le=500.0)
    duration_sec: Optional[int] = Field(None, gt=0, le=86400)
    elevation_gain_m: Optional[float] = Field(None, ge=0.0, le=10000.0)
    burned_kcal: Optional[float] = Field(None, ge=0.0)
    is_public: Optional[bool] = None


class RunActivityResponse(BaseModel):
    id: int
    user_id: int
    surface_type: str
    distance_km: float
    duration_sec: int
    elevation_gain_m: float
    burned_kcal: float
    route_geojson: Optional[str] = None
    is_public: bool
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)
