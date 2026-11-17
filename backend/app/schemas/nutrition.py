from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RagScanRequest(BaseModel):
    query_input: str = Field(
        "",
        max_length=1000,
        description="Natural language meal description or food item. Optional with a photo.",
    )
    # ~4 MB of base64 is ~3 MB of JPEG; the frontend downsizes to 1024 px first.
    image_base64: Optional[str] = Field(
        None, max_length=4_000_000, description="Optional meal photo, base64 JPEG."
    )

    @model_validator(mode="after")
    def _text_or_photo(self) -> "RagScanRequest":
        if self.image_base64:
            if self.image_base64.startswith("data:"):
                self.image_base64 = self.image_base64.split(",", 1)[-1]
        elif len(self.query_input.strip()) < 2:
            raise ValueError("Describe the meal or attach a photo.")
        return self


class FoodItemSummary(BaseModel):
    id: int
    food_name: str
    source_dataset: str
    kcal_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    serving_description: str


class PredictedMacros(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class ScannedMealItem(BaseModel):
    query_text: str = Field(
        ..., description="The part of the meal description this item came from."
    )
    matched_food: Optional[FoodItemSummary] = Field(
        None, description="Best matching food, or null when nothing credible was found."
    )
    grams: float = Field(..., description="Estimated portion in grams (0 when unmatched).")
    macros: PredictedMacros
    match_score: float = Field(..., description="Hybrid lexical + embedding score, 0-1.")
    confidence: str = Field(..., description="high | low | none")
    alternatives: List[FoodItemSummary] = Field(default_factory=list)


class RagScanResponse(BaseModel):
    scan_id: int
    query_input: str
    is_machine_generated: bool = True
    requires_human_confirmation: bool = True
    used_fallback: bool
    latency_ms: float
    top_similarity_score: float
    predicted_macros: PredictedMacros
    items: List[ScannedMealItem] = Field(default_factory=list)
    unmatched: List[str] = Field(default_factory=list)
    retrieved_items: List[FoodItemSummary]
    model_version: str


class NutritionLogCreate(BaseModel):
    meal_name: str = Field(..., min_length=2, max_length=255)
    total_kcal: float = Field(..., ge=0.0)
    protein_g: float = Field(..., ge=0.0)
    carbs_g: float = Field(..., ge=0.0)
    fat_g: float = Field(..., ge=0.0)
    rag_scan_id: Optional[int] = None
    logged_at: Optional[datetime] = None


class NutritionLogUpdate(BaseModel):
    meal_name: Optional[str] = Field(None, min_length=2, max_length=255)
    total_kcal: Optional[float] = Field(None, ge=0.0)
    protein_g: Optional[float] = Field(None, ge=0.0)
    carbs_g: Optional[float] = Field(None, ge=0.0)
    fat_g: Optional[float] = Field(None, ge=0.0)


class NutritionLogResponse(BaseModel):
    id: int
    user_id: int
    rag_scan_id: Optional[int] = None
    meal_name: str
    total_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    logged_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RagScanLogResponse(BaseModel):
    id: int
    user_id: int
    query_input: str
    retrieved_item_ids: str
    top_similarity_score: float
    predicted_macros_json: str
    model_version: str
    latency_ms: float
    used_fallback: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
