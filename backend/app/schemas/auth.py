from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long.")
    full_name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(default="athlete", pattern="^(athlete|admin)$")
    weight_kg: float = Field(default=70.0, gt=20.0, lt=400.0)
    base_kcal_goal: float = Field(default=2200.0, gt=500.0, lt=10000.0)
    protein_goal_g: float = Field(default=150.0, gt=10.0, lt=600.0)
    carbs_goal_g: float = Field(default=250.0, gt=10.0, lt=1000.0)
    fat_goal_g: float = Field(default=65.0, gt=5.0, lt=400.0)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    weight_kg: float
    base_kcal_goal: float
    protein_goal_g: float
    carbs_goal_g: float
    fat_goal_g: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    weight_kg: Optional[float] = Field(None, gt=20.0, lt=400.0)
    base_kcal_goal: Optional[float] = Field(None, gt=500.0, lt=10000.0)
    protein_goal_g: Optional[float] = Field(None, gt=10.0, lt=600.0)
    carbs_goal_g: Optional[float] = Field(None, gt=10.0, lt=1000.0)
    fat_goal_g: Optional[float] = Field(None, gt=5.0, lt=400.0)
