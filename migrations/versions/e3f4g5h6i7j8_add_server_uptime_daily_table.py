"""Add server_uptime_daily table for workstation cost tracking.

Part of US0092: Workstation Cost Tracking (EP0009).

Tracks daily uptime hours per server for calculating workstation costs
based on actual usage rather than 24/7 assumptions.

Revision ID: e3f4g5h6i7j8
Revises: d2e3f4g5h6i7
Create Date: 2026-01-27 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3f4g5h6i7j8"
down_revision: str | Sequence[str] | None = "d2e3f4g5h6i7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add server_uptime_daily table."""
    op.create_table(
        "server_uptime_daily",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=100), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("uptime_hours", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
            name="fk_server_uptime_daily_server_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("server_id", "date", name="uq_server_uptime_daily_server_date"),
    )
    op.create_index(
        "ix_server_uptime_daily_server_id",
        "server_uptime_daily",
        ["server_id"],
    )
    op.create_index(
        "ix_server_uptime_daily_date",
        "server_uptime_daily",
        ["date"],
    )


def downgrade() -> None:
    """Downgrade schema - remove server_uptime_daily table."""
    op.drop_index("ix_server_uptime_daily_date", table_name="server_uptime_daily")
    op.drop_index("ix_server_uptime_daily_server_id", table_name="server_uptime_daily")
    op.drop_table("server_uptime_daily")
