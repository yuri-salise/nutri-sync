import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "NutriSync-RAG"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_VERSION: str = os.getenv("APP_VERSION", "v1.0.0-dev")
    API_V1_PREFIX: str = "/api/v1"

    # Security & JWT
    SECRET_KEY: str = "nutrisync_super_secure_jwt_secret_key_minimum_32_characters"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "nutrisync_user"
    DB_PASSWORD: str = "nutrisync_secure_password"
    DB_NAME: str = "nutrisync_db"
    DATABASE_URL: str = (
        "postgresql+asyncpg://nutrisync_user:nutrisync_secure_password@localhost:5432/nutrisync_db"
    )
    DATABASE_URL_SYNC: str = (
        "postgresql://nutrisync_user:nutrisync_secure_password@localhost:5432/nutrisync_db"
    )

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]

    # AI & RAG
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:1.5b"
    USE_OLLAMA_FALLBACK: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
