"""add_tiered_metrics_tables

Revision ID: 5e6f7g8h9i0j
Revises: 4d5e6f7g8h9i
Create Date: 2026-01-21 10:00:00.000000

Adds metrics_hourly and metrics_daily tables for tiered data retention (US0046).
- metrics_hourly: 90-day retention of hourly aggregates
- metrics_daily: 12-month retention of daily aggregates
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5e6f7g8h9i0j"
down_revision: str | Sequence[str] | None = "4d5e6f7g8h9i"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add tiered metrics tables."""
    # Create metrics_hourly table for 90-day retention
    op.create_table(
        "metrics_hourly",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=100), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cpu_avg", sa.Float(), nullable=True),
        sa.Column("cpu_min", sa.Float(), nullable=True),
        sa.Column("cpu_max", sa.Float(), nullable=True),
        sa.Column("memory_avg", sa.Float(), nullable=True),
        sa.Column("memory_min", sa.Float(), nullable=True),
        sa.Column("memory_max", sa.Float(), nullable=True),
        sa.Column("disk_avg", sa.Float(), nullable=True),
        sa.Column("disk_min", sa.Float(), nullable=True),
        sa.Column("disk_max", sa.Float(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], ["servers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indices for hourly table
    with op.batch_alter_table("metrics_hourly", schema=None) as batch_op:
        batch_op.create_index(
            "idx_metrics_hourly_server_ts", ["server_id", "timestamp"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_metrics_hourly_server_id"), ["server_id"], unique=False
        )

    # Create metrics_daily table for 12-month retention
    op.create_table(
        "metrics_daily",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=100), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cpu_avg", sa.Float(), nullable=True),
        sa.Column("cpu_min", sa.Float(), nullable=True),
        sa.Column("cpu_max", sa.Float(), nullable=True),
        sa.Column("memory_avg", sa.Float(), nullable=True),
        sa.Column("memory_min", sa.Float(), nullable=True),
        sa.Column("memory_max", sa.Float(), nullable=True),
        sa.Column("disk_avg", sa.Float(), nullable=True),
        sa.Column("disk_min", sa.Float(), nullable=True),
        sa.Column("disk_max", sa.Float(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], ["servers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indices for daily table
    with op.batch_alter_table("metrics_daily", schema=None) as batch_op:
        batch_op.create_index(
            "idx_metrics_daily_server_ts", ["server_id", "timestamp"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_metrics_daily_server_id"), ["server_id"], unique=False
        )


def downgrade() -> None:
    """Downgrade schema - remove tiered metrics tables."""
    # Drop daily table indices and table
    with op.batch_alter_table("metrics_daily", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_metrics_daily_server_id"))
        batch_op.drop_index("idx_metrics_daily_server_ts")

    op.drop_table("metrics_daily")

    # Drop hourly table indices and table
    with op.batch_alter_table("metrics_hourly", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_metrics_hourly_server_id"))
        batch_op.drop_index("idx_metrics_hourly_server_ts")

    op.drop_table("metrics_hourly")
