"""Add alerts table

Revision ID: a1b2c3d4e5f6
Revises: 2e6e20f4bc94
Create Date: 2026-01-19 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "2e6e20f4bc94"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add alerts table."""
    # Create the alerts table for persistent alert history
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=100), nullable=False),
        sa.Column("alert_type", sa.String(length=20), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("threshold_value", sa.Float(), nullable=True),
        sa.Column("actual_value", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["server_id"], ["servers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indices for common query patterns
    with op.batch_alter_table("alerts", schema=None) as batch_op:
        batch_op.create_index("idx_alerts_server_status", ["server_id", "status"], unique=False)
        batch_op.create_index(
            "idx_alerts_severity_status", ["severity", "status"], unique=False
        )
        batch_op.create_index("idx_alerts_created_at", ["created_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_alerts_server_id"), ["server_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema - remove alerts table."""
    with op.batch_alter_table("alerts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_alerts_server_id"))
        batch_op.drop_index("idx_alerts_created_at")
        batch_op.drop_index("idx_alerts_severity_status")
        batch_op.drop_index("idx_alerts_server_status")

    op.drop_table("alerts")
