"""Add filesystem_metrics table and server.filesystems column.

Part of US0178: Per-Filesystem Metrics API (EP0012).

Stores per-filesystem disk metrics for detailed storage monitoring
and enables the disk widget to show individual mount points.

Revision ID: f4g5h6i7j8k9
Revises: e3f4g5h6i7j8
Create Date: 2026-01-29 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4g5h6i7j8k9"
down_revision: str | Sequence[str] | None = "e3f4g5h6i7j8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add filesystem_metrics table and server.filesystems column."""
    # Create filesystem_metrics table for historical storage
    op.create_table(
        "filesystem_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=100), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mount_point", sa.String(length=255), nullable=False),
        sa.Column("device", sa.String(length=255), nullable=False),
        sa.Column("fs_type", sa.String(length=50), nullable=False),
        sa.Column("total_bytes", sa.BigInteger(), nullable=False),
        sa.Column("used_bytes", sa.BigInteger(), nullable=False),
        sa.Column("available_bytes", sa.BigInteger(), nullable=False),
        sa.Column("percent", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
            name="fk_filesystem_metrics_server_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Create indexes for efficient queries
    op.create_index(
        "idx_fs_metrics_server_ts",
        "filesystem_metrics",
        ["server_id", "timestamp"],
    )
    op.create_index(
        "idx_fs_metrics_server_mount_ts",
        "filesystem_metrics",
        ["server_id", "mount_point", "timestamp"],
    )
    op.create_index(
        "ix_filesystem_metrics_server_id",
        "filesystem_metrics",
        ["server_id"],
    )

    # Add filesystems JSON column to servers table for latest snapshot
    op.add_column(
        "servers",
        sa.Column("filesystems", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema - remove filesystem_metrics table and server.filesystems column."""
    # Remove column from servers
    op.drop_column("servers", "filesystems")

    # Remove indexes and table
    op.drop_index("ix_filesystem_metrics_server_id", table_name="filesystem_metrics")
    op.drop_index("idx_fs_metrics_server_mount_ts", table_name="filesystem_metrics")
    op.drop_index("idx_fs_metrics_server_ts", table_name="filesystem_metrics")
    op.drop_table("filesystem_metrics")
