"""Add config_user column to servers table.

Revision ID: j9k0l1m2n3o4
Revises: j8k9l0m1n2o3
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "j9k0l1m2n3o4"
down_revision = "j8k9l0m1n2o3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "servers",
        sa.Column("config_user", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("servers", "config_user")
