"""Enable PostgreSQL Row Level Security (RLS) and security policies

Revision ID: 002_enable_row_level_security
Revises: 001_initial_schema
Create Date: 2026-11-05 21:15:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_enable_row_level_security"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    # Row Level Security is natively enforced in PostgreSQL
    if dialect_name == "postgresql":
        # 1. Enable RLS on tenant-sensitive tables
        tables_to_secure = [
            "workout_sessions",
            "workout_sets",
            "run_activities",
            "nutrition_logs",
            "rag_scan_logs",
            "exercises",
        ]

        for table in tables_to_secure:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")

        # 2. Workout Sessions Policy
        # Users see their own sessions, or public sessions in community, or coaches/admins see all
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'workout_sessions' AND policyname = 'workout_sessions_tenant_policy'
                ) THEN
                    CREATE POLICY workout_sessions_tenant_policy ON workout_sessions
                    FOR ALL
                    USING (
                        user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                        OR current_setting('app.current_user_role', true) = 'admin'
                        OR is_public = true
                    );
                END IF;
            END $$;
        """)

        # 3. Workout Sets Policy (linked to workout session)
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'workout_sets' AND policyname = 'workout_sets_tenant_policy'
                ) THEN
                    CREATE POLICY workout_sets_policy ON workout_sets
                    FOR ALL
                    USING (
                        EXISTS (
                            SELECT 1 FROM workout_sessions ws
                            WHERE ws.id = workout_sets.session_id
                            AND (
                                ws.user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                                OR current_setting('app.current_user_role', true) = 'admin'
                                OR ws.is_public = true
                            )
                        )
                    );
                END IF;
            END $$;
        """)

        # 4. Run Activities Policy
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'run_activities' AND policyname = 'run_activities_tenant_policy'
                ) THEN
                    CREATE POLICY run_activities_tenant_policy ON run_activities
                    FOR ALL
                    USING (
                        user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                        OR current_setting('app.current_user_role', true) = 'admin'
                        OR is_public = true
                    );
                END IF;
            END $$;
        """)

        # 5. Nutrition Logs Policy
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'nutrition_logs' AND policyname = 'nutrition_logs_tenant_policy'
                ) THEN
                    CREATE POLICY nutrition_logs_tenant_policy ON nutrition_logs
                    FOR ALL
                    USING (
                        user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                        OR current_setting('app.current_user_role', true) = 'admin'
                    );
                END IF;
            END $$;
        """)

        # 6. RAG Scan Logs Policy (Audit trail)
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'rag_scan_logs' AND policyname = 'rag_scan_logs_tenant_policy'
                ) THEN
                    CREATE POLICY rag_scan_logs_tenant_policy ON rag_scan_logs
                    FOR ALL
                    USING (
                        user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                        OR current_setting('app.current_user_role', true) = 'admin'
                    );
                END IF;
            END $$;
        """)

        # 7. Exercises Policy (All users see approved, creators see their own pending, admin sees all)
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'exercises' AND policyname = 'exercises_tenant_policy'
                ) THEN
                    CREATE POLICY exercises_tenant_policy ON exercises
                    FOR SELECT
                    USING (
                        status = 'approved'
                        OR created_by_id = NULLIF(current_setting('app.current_user_id', true), '')::integer
                        OR current_setting('app.current_user_role', true) = 'admin'
                    );
                END IF;
            END $$;
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        tables = [
            "workout_sessions",
            "workout_sets",
            "run_activities",
            "nutrition_logs",
            "rag_scan_logs",
            "exercises",
        ]
        for t in tables:
            op.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY;")
