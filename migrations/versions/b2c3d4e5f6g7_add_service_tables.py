"""Add service tables for EP0003: Service Monitoring.

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-19

This migration adds:
- expected_services: Configuration of which services to monitor per server
- service_status: Historical status tracking for monitored services
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create expected_services and service_status tables."""
    # Create expected_services table
    op.create_table(
        "expected_services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "server_id",
            sa.String(100),
            sa.ForeignKey("servers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("service_name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("is_critical", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )

    # Create index on server_id
    op.create_index(
        "idx_expected_services_server",
        "expected_services",
        ["server_id"],
    )

    # Create unique constraint on (server_id, service_name)
    op.create_unique_constraint(
        "uq_server_service_name",
        "expected_services",
        ["server_id", "service_name"],
    )

    # Create service_status table
    op.create_table(
        "service_status",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "server_id",
            sa.String(100),
            sa.ForeignKey("servers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("service_name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("pid", sa.Integer(), nullable=True),
        sa.Column("memory_mb", sa.Float(), nullable=True),
        sa.Column("cpu_percent", sa.Float(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )

    # Create composite indices for common queries
    op.create_index(
        "idx_service_status_server_time",
        "service_status",
        ["server_id", "timestamp"],
    )
    op.create_index(
        "idx_service_status_service",
        "service_status",
        ["server_id", "service_name", "timestamp"],
    )


def downgrade() -> None:
    """Drop expected_services and service_status tables."""
    # Drop service_status table and indices
    op.drop_index("idx_service_status_service", table_name="service_status")
    op.drop_index("idx_service_status_server_time", table_name="service_status")
    op.drop_table("service_status")

    # Drop expected_services table and constraints
    op.drop_constraint("uq_server_service_name", "expected_services", type_="unique")
    op.drop_index("idx_expected_services_server", table_name="expected_services")
    op.drop_table("expected_services")
