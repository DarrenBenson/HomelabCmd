"""Add config_apply table for configuration pack application.

EP0010: Configuration Management - US0119 Apply Configuration Pack.

Revision ID: i7j8k9l0m1n2
Revises: h6i7j8k9l0m1
Create Date: 2026-01-29 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i7j8k9l0m1n2"
down_revision: Union[str, None] = "h6i7j8k9l0m1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create config_apply table."""
    op.create_table(
        "config_apply",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(length=255), nullable=False),
        sa.Column("pack_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, default="pending"),
        sa.Column("progress", sa.Integer(), nullable=False, default=0),
        sa.Column("current_item", sa.String(length=255), nullable=True),
        sa.Column("items_total", sa.Integer(), nullable=False, default=0),
        sa.Column("items_completed", sa.Integer(), nullable=False, default=0),
        sa.Column("items_failed", sa.Integer(), nullable=False, default=0),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("results", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("triggered_by", sa.String(length=100), nullable=False, default="user"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_config_apply_server_id"), "config_apply", ["server_id"], unique=False
    )
    op.create_index(
        "idx_config_apply_server_status",
        "config_apply",
        ["server_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_config_apply_created_at",
        "config_apply",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop config_apply table."""
    op.drop_index("idx_config_apply_created_at", table_name="config_apply")
    op.drop_index("idx_config_apply_server_status", table_name="config_apply")
    op.drop_index(op.f("ix_config_apply_server_id"), table_name="config_apply")
    op.drop_table("config_apply")
