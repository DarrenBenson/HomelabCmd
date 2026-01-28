"""Add Tailscale import fields to servers table.

Part of EP0008: Tailscale Integration (US0078).

Revision ID: c1d2e3f4g5h6
Revises: a0b1c2d3e4f5
Create Date: 2026-01-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4g5h6"
down_revision: str | None = "a0b1c2d3e4f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add tailscale_hostname, tailscale_device_id, and machine_type columns."""
    op.add_column(
        "servers",
        sa.Column("tailscale_hostname", sa.String(255), nullable=True),
    )
    op.add_column(
        "servers",
        sa.Column("tailscale_device_id", sa.String(100), nullable=True),
    )
    op.add_column(
        "servers",
        sa.Column("machine_type", sa.String(20), nullable=False, server_default="server"),
    )
    op.create_index(
        "idx_servers_tailscale_hostname",
        "servers",
        ["tailscale_hostname"],
        unique=True,
    )


def downgrade() -> None:
    """Remove tailscale_hostname, tailscale_device_id, and machine_type columns."""
    op.drop_index("idx_servers_tailscale_hostname", table_name="servers")
    op.drop_column("servers", "machine_type")
    op.drop_column("servers", "tailscale_device_id")
    op.drop_column("servers", "tailscale_hostname")
