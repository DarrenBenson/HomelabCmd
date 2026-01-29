"""Add network_interface_metrics table and server.network_interfaces column.

Part of US0179: Per-Interface Network Metrics API (EP0012).

Stores per-interface network metrics for detailed network monitoring
and enables the network widget to show individual interface traffic.

Revision ID: g5h6i7j8k9l0
Revises: f4g5h6i7j8k9
Create Date: 2026-01-29 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g5h6i7j8k9l0"
down_revision: str | Sequence[str] | None = "f4g5h6i7j8k9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add network_interface_metrics table and server.network_interfaces column."""
    # Create network_interface_metrics table for historical storage
    op.create_table(
        "network_interface_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=100), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("interface_name", sa.String(length=64), nullable=False),
        sa.Column("rx_bytes", sa.BigInteger(), nullable=False),
        sa.Column("tx_bytes", sa.BigInteger(), nullable=False),
        sa.Column("rx_packets", sa.BigInteger(), nullable=False),
        sa.Column("tx_packets", sa.BigInteger(), nullable=False),
        sa.Column("is_up", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
            name="fk_network_interface_metrics_server_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Create indexes for efficient queries
    op.create_index(
        "idx_net_iface_server_ts",
        "network_interface_metrics",
        ["server_id", "timestamp"],
    )
    op.create_index(
        "idx_net_iface_server_name_ts",
        "network_interface_metrics",
        ["server_id", "interface_name", "timestamp"],
    )
    op.create_index(
        "ix_network_interface_metrics_server_id",
        "network_interface_metrics",
        ["server_id"],
    )

    # Add network_interfaces JSON column to servers table for latest snapshot
    op.add_column(
        "servers",
        sa.Column("network_interfaces", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema - remove network_interface_metrics table and server.network_interfaces column."""
    # Remove column from servers
    op.drop_column("servers", "network_interfaces")

    # Remove indexes and table
    op.drop_index("ix_network_interface_metrics_server_id", table_name="network_interface_metrics")
    op.drop_index("idx_net_iface_server_name_ts", table_name="network_interface_metrics")
    op.drop_index("idx_net_iface_server_ts", table_name="network_interface_metrics")
    op.drop_table("network_interface_metrics")
