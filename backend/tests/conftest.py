import os
import sys
from pathlib import Path

# Dummy test-only values so settings load without a real .env (secrets have no defaults).
os.environ.setdefault("SECRET_KEY", "test_secret_key_minimum_32_characters_for_tests_only")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///:memory:")

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pgvector.sqlalchemy import Vector
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


# Compile Vector as TEXT when using SQLite in tests
@compiles(Vector, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    return "TEXT"


from app.api.v1.auth import _login_attempts
from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.models import Exercise, NutritionKnowledgeItem, User
from app.db.session import get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    _login_attempts.clear()  # rate-limit state must not leak between tests

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def seed_test_users(db_session: AsyncSession):
    athlete = User(
        id=1,
        email="athlete@example.com",
        password_hash=get_password_hash("Password123!"),
        full_name="Test Athlete",
        role="athlete",
        weight_kg=70.0,
        base_kcal_goal=2200.0,
        protein_goal_g=150.0,
        carbs_goal_g=250.0,
        fat_goal_g=65.0,
    )
    admin = User(
        id=2,
        email="admin@example.com",
        password_hash=get_password_hash("Password123!"),
        full_name="Test Admin",
        role="admin",
        weight_kg=80.0,
        base_kcal_goal=2400.0,
        protein_goal_g=170.0,
        carbs_goal_g=270.0,
        fat_goal_g=70.0,
    )
    exercise = Exercise(
        id=1,
        name="Barbell Bench Press",
        category="compound",
        muscle_group="chest",
        met_value=6.0,
        status="approved",
        created_by_id=2,
    )
    food_item = NutritionKnowledgeItem(
        id=1,
        food_name="Adobong Manok (Chicken Adobo)",
        source_dataset="FNRI",
        kcal_per_100g=185.0,
        protein_per_100g=22.4,
        carbs_per_100g=2.8,
        fat_per_100g=9.2,
        serving_description="1 portion",
        embedding=None,
    )
    db_session.add_all([athlete, admin, exercise, food_item])
    await db_session.commit()
    return {"athlete": athlete, "admin": admin, "exercise": exercise, "food_item": food_item}


@pytest.fixture
def athlete_token() -> str:
    return create_access_token(subject=1, role="athlete")


@pytest.fixture
def admin_token() -> str:
    return create_access_token(subject=2, role="admin")
