from typing import AsyncGenerator
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

is_sqlite = "sqlite" in settings.DATABASE_URL
engine_kwargs = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
}
if settings.DB_SERVERLESS:
    engine_kwargs["poolclass"] = NullPool
    engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    }
elif not is_sqlite:
    engine_kwargs.update({"pool_size": 10, "max_overflow": 20})

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an active async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def set_rls_context(session: AsyncSession, user_id: int, role: str = "athlete") -> None:
    """
    Sets PostgreSQL Row Level Security (RLS) session variables for multi-tenant data isolation.
    Enforces that queries only access the authenticated user's records.
    """
    try:
        bind = session.get_bind()
        if bind and bind.dialect.name == "postgresql":
            clean_user_id = int(user_id)
            clean_role = "admin" if role == "admin" else "athlete"
            await session.execute(text(f"SET LOCAL app.current_user_id = '{clean_user_id}';"))
            await session.execute(text(f"SET LOCAL app.current_user_role = '{clean_role}';"))
    except Exception:
        pass
