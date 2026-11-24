import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "NutriSync-RAG"
    APP_VERSION: str = os.getenv("APP_VERSION", "v1.0.0-dev")
    API_V1_PREFIX: str = "/api/v1"

    # Security & JWT
    # No defaults for secrets: they must come from the environment / .env (Q5, D3).
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    # Serverless hosts (Vercel) behind a transaction pooler (Supabase port 6543): no app-side
    # pool, and no prepared-statement cache, which transaction pooling cannot keep.
    DB_SERVERLESS: bool = False

    # CORS: only the frontend's origin (Q4). Comma-separate if more than one.
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Login rate limit (Q4), format "<count>/<second|minute|hour>"
    LOGIN_RATE_LIMIT: str = "5/minute"

    # AI & RAG
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Meal photo analysis (free tiers). Empty key = that provider is skipped.
    GEMINI_API_KEY: str = ""
    GEMINI_VISION_MODEL: str = "gemini-3.5-flash-lite"
    GROQ_API_KEY: str = ""
    GROQ_VISION_MODEL: str = "qwen/qwen3.8-27b"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
