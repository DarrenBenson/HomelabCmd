"""Add status_reason column to service_status table.

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-01-19

This migration adds status_reason column to service_status table
to explain why a service status is 'unknown' (e.g., 'systemd not available (container)').
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6g7h8"
down_revision: str | None = "b2c3d4e5f6g7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add status_reason column to service_status table."""
    op.add_column(
        "service_status",
        sa.Column("status_reason", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    """Remove status_reason column from service_status table."""
    op.drop_column("service_status", "status_reason")
