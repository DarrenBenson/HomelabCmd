"""Add cost_snapshots and cost_snapshots_monthly tables.

EP0005: Cost Tracking - US0183 Historical Cost Tracking.

Creates tables for:
- cost_snapshots: Daily cost snapshots per server
- cost_snapshots_monthly: Monthly aggregates for long-term retention

Revision ID: k9l0m1n2o3p4
Revises: j8k9l0m1n2o3
Create Date: 2026-01-29 21:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k9l0m1n2o3p4"
down_revision: Union[str, None] = "j8k9l0m1n2o3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create cost_snapshots and cost_snapshots_monthly tables."""
    # Create cost_snapshots table for daily snapshots
    op.create_table(
        "cost_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(100), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("estimated_kwh", sa.Float(), nullable=False),
        sa.Column("estimated_cost", sa.Float(), nullable=False),
        sa.Column("electricity_rate", sa.Float(), nullable=False),
        sa.Column("tdp_watts", sa.Integer(), nullable=True),
        sa.Column("idle_watts", sa.Integer(), nullable=True),
        sa.Column("avg_cpu_percent", sa.Float(), nullable=True),
        sa.Column("machine_type", sa.String(20), nullable=True),
        sa.Column("hours_used", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("server_id", "date", name="uq_cost_snapshot"),
    )

    # Create indexes for cost_snapshots
    op.create_index("idx_cost_snapshot_server_date", "cost_snapshots", ["server_id", "date"])
    op.create_index("idx_cost_snapshot_date", "cost_snapshots", ["date"])
    op.create_index("ix_cost_snapshots_server_id", "cost_snapshots", ["server_id"])

    # Create cost_snapshots_monthly table for monthly aggregates
    op.create_table(
        "cost_snapshots_monthly",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(100), nullable=True),
        sa.Column("year_month", sa.String(7), nullable=False),
        sa.Column("total_kwh", sa.Float(), nullable=False),
        sa.Column("total_cost", sa.Float(), nullable=False),
        sa.Column("avg_electricity_rate", sa.Float(), nullable=False),
        sa.Column("snapshot_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("server_id", "year_month", name="uq_monthly_cost_snapshot"),
    )

    # Create indexes for cost_snapshots_monthly
    op.create_index(
        "idx_cost_snapshot_monthly_server", "cost_snapshots_monthly", ["server_id", "year_month"]
    )
    op.create_index("idx_cost_snapshot_monthly_ym", "cost_snapshots_monthly", ["year_month"])
    op.create_index("ix_cost_snapshots_monthly_server_id", "cost_snapshots_monthly", ["server_id"])


def downgrade() -> None:
    """Drop cost_snapshots and cost_snapshots_monthly tables."""
    # Drop cost_snapshots_monthly table and indexes
    op.drop_index("ix_cost_snapshots_monthly_server_id", table_name="cost_snapshots_monthly")
    op.drop_index("idx_cost_snapshot_monthly_ym", table_name="cost_snapshots_monthly")
    op.drop_index("idx_cost_snapshot_monthly_server", table_name="cost_snapshots_monthly")
    op.drop_table("cost_snapshots_monthly")

    # Drop cost_snapshots table and indexes
    op.drop_index("ix_cost_snapshots_server_id", table_name="cost_snapshots")
    op.drop_index("idx_cost_snapshot_date", table_name="cost_snapshots")
    op.drop_index("idx_cost_snapshot_server_date", table_name="cost_snapshots")
    op.drop_table("cost_snapshots")
