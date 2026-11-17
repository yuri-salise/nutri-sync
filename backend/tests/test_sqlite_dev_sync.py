import sqlalchemy as sa

from app.db.base import Base
from app.db.sqlite_dev_sync import sync_sqlite_dev_schema


def _old_dev_database(path):
    """A dev DB made before run_activities had sport_type/title, with older exercise data."""
    engine = sa.create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE run_activities (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, "
                "surface_type VARCHAR(50) NOT NULL, distance_km FLOAT NOT NULL, "
                "duration_sec INTEGER NOT NULL, elevation_gain_m FLOAT NOT NULL, "
                "burned_kcal FLOAT NOT NULL, route_geojson TEXT, is_public BOOLEAN NOT NULL, "
                "recorded_at DATETIME NOT NULL)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO run_activities VALUES (1, 1, 'road', 5.0, 1800, 0, 300, NULL, 1, "
                "'2026-11-16 10:00:00')"
            )
        )
        conn.execute(
            sa.text(
                "CREATE TABLE exercises (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL, "
                "category VARCHAR(100) NOT NULL, muscle_group VARCHAR(100) NOT NULL, "
                "met_value FLOAT NOT NULL, status VARCHAR(50) NOT NULL, created_by_id INTEGER, "
                "created_at DATETIME NOT NULL)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO exercises VALUES (1, 'Barbell Bench Press', 'compound', 'chest', "
                "6.0, 'approved', 2, '2026-11-01'), (2, 'My Custom Move', 'compound', 'legs', "
                "6.0, 'pending', 1, '2026-11-02')"
            )
        )
    return engine


def test_old_sqlite_database_is_brought_up_to_date(tmp_path):
    engine = _old_dev_database(tmp_path / "dev.db")
    with engine.begin() as conn:
        Base.metadata.create_all(conn)  # what startup does first: adds missing tables only
        cols = {c["name"] for c in sa.inspect(conn).get_columns("run_activities")}
        assert "sport_type" not in cols  # the bug: create_all leaves old tables alone

        sync_sqlite_dev_schema(conn)

        cols = {c["name"] for c in sa.inspect(conn).get_columns("run_activities")}
        assert {"sport_type", "title"} <= cols
        # existing rows get the default, so the feed and history keep working
        assert conn.execute(sa.text("SELECT sport_type, title FROM run_activities")).one() == (
            "run",
            None,
        )

        # the ORM query that used to crash with "no such column" now runs
        from app.db.models import RunActivity

        assert conn.execute(sa.select(RunActivity.sport_type, RunActivity.title)).all()

        # custom exercises are private (no approval), built-ins are added next to the old one
        statuses = dict(conn.execute(sa.text("SELECT name, status FROM exercises")).all())
        assert statuses["My Custom Move"] == "private"
        assert statuses["Barbell Bench Press"] == "approved"
        assert statuses["Pull-Ups"] == "approved"
        names = [r[0] for r in conn.execute(sa.text("SELECT name FROM exercises"))]
        assert names.count("Barbell Bench Press") == 1  # not duplicated


def test_sync_is_idempotent(tmp_path):
    engine = _old_dev_database(tmp_path / "dev.db")
    with engine.begin() as conn:
        Base.metadata.create_all(conn)
        sync_sqlite_dev_schema(conn)
        before = conn.execute(sa.text("SELECT COUNT(*) FROM exercises")).scalar_one()
        sync_sqlite_dev_schema(conn)
        sync_sqlite_dev_schema(conn)
        assert conn.execute(sa.text("SELECT COUNT(*) FROM exercises")).scalar_one() == before


def test_does_nothing_on_other_databases():
    class FakeDialect:
        name = "postgresql"

    class FakeConn:
        dialect = FakeDialect()

    sync_sqlite_dev_schema(FakeConn())  # must return without touching the connection
