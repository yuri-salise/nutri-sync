"""Food portions: all household portions per nutrition knowledge item

Revision ID: 005_food_portions
Revises: 004_activity_types_social
Create Date: 2026-11-17 18:00:00.000000

- nutrition_knowledge_items gets a nullable `portions` text column holding every known
  portion ("1 cup (158g) | 1 medium (118g)"), so the scanner can pick the portion that
  matches the unit a user typed. `serving_description` is unchanged.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "005_food_portions"
down_revision: Union[str, None] = "004_activity_types_social"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("nutrition_knowledge_items", sa.Column("portions", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("nutrition_knowledge_items") as batch:
        batch.drop_column("portions")
