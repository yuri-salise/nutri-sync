"""Login attempts table for the shared login rate limit

Revision ID: 006_login_attempts
Revises: 005_food_portions
Create Date: 2026-11-24 12:00:00.000000

- The login rate limit moves from process memory to this table, so several API instances
  (e.g. serverless functions on Vercel) share one count per email.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "006_login_attempts"
down_revision: Union[str, None] = "005_food_portions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_attempts_email", "login_attempts", ["email"])
    op.create_index("ix_login_attempts_attempted_at", "login_attempts", ["attempted_at"])


def downgrade() -> None:
    op.drop_index("ix_login_attempts_attempted_at", table_name="login_attempts")
    op.drop_index("ix_login_attempts_email", table_name="login_attempts")
    op.drop_table("login_attempts")
