"""Add config_check table for compliance checking.

EP0010: Configuration Management - US0117 Configuration Compliance Checker.

Revision ID: h6i7j8k9l0m1
Revises: g5h6i7j8k9l0
Create Date: 2026-01-29 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h6i7j8k9l0m1"
down_revision: Union[str, None] = "g5h6i7j8k9l0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create config_check table."""
    op.create_table(
        "config_check",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(), nullable=False),
        sa.Column("pack_name", sa.String(), nullable=False),
        sa.Column("is_compliant", sa.Boolean(), nullable=False),
        sa.Column("mismatches", sa.JSON(), nullable=True),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("check_duration_ms", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_config_check_server_id"), "config_check", ["server_id"], unique=False
    )


def downgrade() -> None:
    """Drop config_check table."""
    op.drop_index(op.f("ix_config_check_server_id"), table_name="config_check")
    op.drop_table("config_check")
