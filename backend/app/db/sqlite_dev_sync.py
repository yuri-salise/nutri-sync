"""Keeps a local SQLite dev database in step with the models.

Why this exists: in development the app builds its schema with ``Base.metadata.create_all``,
which creates *missing tables* but never adds *new columns* to tables that already exist.
After a feature adds a column (for example ``run_activities.sport_type``), an older
``nutrisync.db`` then fails with "no such column" and the API answers 500.

PostgreSQL deployments use Alembic migrations instead, so this only runs on SQLite.
It is idempotent and never drops or rewrites existing data except for the same
one-off conversions that migration 003 performs.
"""

from datetime import datetime, timezone
from typing import List

import sqlalchemy as sa

from app.core.logging import logger
from app.db.base import Base
from app.db.common_exercises import COMMON_EXERCISES


def _default_literal(column: sa.Column, dialect) -> str | None:
    """SQL literal for the column's default, or None when it has none we can express."""
    if column.server_default is not None and hasattr(column.server_default, "arg"):
        arg = column.server_default.arg
        return (
            str(arg)
            if isinstance(arg, str) and arg.startswith("(")
            else sa.literal(arg)
            .compile(dialect=dialect, compile_kwargs={"literal_binds": True})
            .string
        )
    default = column.default
    if default is not None and getattr(default, "is_scalar", False):
        return (
            sa.literal(default.arg)
            .compile(dialect=dialect, compile_kwargs={"literal_binds": True})
            .string
        )
    return None


def add_missing_columns(conn: sa.Connection) -> List[str]:
    """ALTER TABLE ... ADD COLUMN for every model column the database lacks."""
    inspector = sa.inspect(conn)
    added: List[str] = []
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            type_sql = column.type.compile(dialect=conn.dialect)
            default_sql = _default_literal(column, conn.dialect)
            if not column.nullable and default_sql is None:
                logger.warning(
                    f"Cannot auto-add NOT NULL column {table.name}.{column.name} without a "
                    "default; recreate the dev database or add the column by hand."
                )
                continue
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {type_sql}'
            if default_sql is not None:
                ddl += f" DEFAULT {default_sql}"
            if not column.nullable:
                ddl += " NOT NULL"
            conn.execute(sa.text(ddl))
            added.append(f"{table.name}.{column.name}")
    return added


def sync_exercises(conn: sa.Connection) -> int:
    """Mirrors migration 003 for dev databases: private custom exercises + built-in library."""
    exercises = Base.metadata.tables["exercises"]
    conn.execute(
        sa.update(exercises)
        .where(exercises.c.status.in_(["pending", "rejected"]))
        .values(status="private")
    )
    existing = {
        name.lower()
        for (name,) in conn.execute(
            sa.select(exercises.c.name).where(exercises.c.status == "approved")
        )
    }
    now = datetime.now(timezone.utc)
    rows = [
        {
            "name": name,
            "category": cat,
            "muscle_group": muscle,
            "met_value": met,
            "status": "approved",
            "created_by_id": None,
            "created_at": now,
        }
        for name, cat, muscle, met in COMMON_EXERCISES
        if name.lower() not in existing
    ]
    if rows:
        conn.execute(sa.insert(exercises), rows)
    return len(rows)


def sync_sqlite_dev_schema(conn: sa.Connection) -> None:
    """Entry point, called at startup after create_all (SQLite only)."""
    if conn.dialect.name != "sqlite":
        return
    added = add_missing_columns(conn)
    if added:
        logger.info(f"SQLite dev schema: added columns {', '.join(added)}")
    inserted = sync_exercises(conn)
    if inserted:
        logger.info(f"SQLite dev schema: added {inserted} built-in exercises")
