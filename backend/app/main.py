import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.health import router as health_router
from app.api.v1.activity_sync import router as activity_sync_router
from app.api.v1.auth import router as auth_router
from app.api.v1.community import router as community_router
from app.api.v1.exercises import router as exercises_router
from app.api.v1.nutrition_logs import router as nutrition_logs_router
from app.api.v1.rag_nutrition import router as rag_router
from app.api.v1.run_activities import router as runs_router
from app.api.v1.workout_routines import router as routines_router
from app.api.v1.workout_sessions import router as workouts_router
from app.core.config import settings
from app.core.logging import logger
from app.db.base import Base
from app.db.session import engine
from app.db.sqlite_dev_sync import sync_sqlite_dev_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing NutriSync-RAG application engine...")
    # PostgreSQL schema (pgvector, tables, RLS) comes only from Alembic migrations (D2).
    # The SQLite bare-metal dev DB has no migrations, so it is still created here.
    if engine.dialect.name == "sqlite":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                # create_all never adds columns to existing tables; bring a SQLite dev DB up to date
                await conn.run_sync(sync_sqlite_dev_schema)
            logger.info("SQLite dev schema synchronized.")
        except Exception as e:
            logger.warning(f"Database sync on startup warning: {e}")
    yield
    logger.info("NutriSync-RAG backend shutdown complete.")


app = FastAPI(
    title="NutriSync-RAG REST API",
    description="Activity-Synced Nutritional Retrieval-Augmented Generation & Geolocation Workout Tracking API",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware (Requirement 6.4, Q4)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.FRONTEND_ORIGIN.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Request Logging Middleware (Requirement B9: No passwords or tokens)
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    method = request.method
    path = request.url.path
    client_ip = request.client.host if request.client else "unknown"

    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000.0, 2)
    logger.info(f"{method} {path} - {response.status_code} [{duration_ms}ms] - IP: {client_ip}")
    return response


# Requirement 6.2: Standard Error JSON Shape
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", []))
        details.append({"field": field, "message": error.get("msg", "Invalid value")})

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Some fields are invalid.",
                "details": details,
            }
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": [],
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    # Requirement 6.2: Unexpected server error (no stack trace in the response) -> 500
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "details": [],
            }
        },
    )


# Mount Endpoints
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(exercises_router, prefix=settings.API_V1_PREFIX)
app.include_router(workouts_router, prefix=settings.API_V1_PREFIX)
app.include_router(routines_router, prefix=settings.API_V1_PREFIX)
app.include_router(runs_router, prefix=settings.API_V1_PREFIX)
app.include_router(rag_router, prefix=settings.API_V1_PREFIX)
app.include_router(nutrition_logs_router, prefix=settings.API_V1_PREFIX)
app.include_router(activity_sync_router, prefix=settings.API_V1_PREFIX)
app.include_router(community_router, prefix=settings.API_V1_PREFIX)
