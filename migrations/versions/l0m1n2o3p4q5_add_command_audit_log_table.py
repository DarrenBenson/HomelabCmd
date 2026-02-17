"""Add command_audit_log table for command execution audit trail.

EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.

Creates an immutable audit log table for tracking all command executions
for security compliance and incident investigation.

Revision ID: l0m1n2o3p4q5
Revises: k9l0m1n2o3p4
Create Date: 2026-01-30 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l0m1n2o3p4q5"
down_revision: Union[str, None] = "k9l0m1n2o3p4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create command_audit_log table."""
    op.create_table(
        "command_audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(100), nullable=False),
        sa.Column("command", sa.Text(), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("exit_code", sa.Integer(), nullable=True),
        sa.Column("stdout", sa.Text(), nullable=True),
        sa.Column("stderr", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "executed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("executed_by", sa.String(255), server_default="dashboard", nullable=False),
        sa.ForeignKeyConstraint(
            ["server_id"],
            ["servers.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for efficient querying (as per AC2)
    op.create_index(
        "idx_command_audit_server_date",
        "command_audit_log",
        ["server_id", "executed_at"],
        unique=False,
    )
    op.create_index(
        "idx_command_audit_type_date",
        "command_audit_log",
        ["action_type", "executed_at"],
        unique=False,
    )
    op.create_index(
        "idx_command_audit_date",
        "command_audit_log",
        ["executed_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop command_audit_log table."""
    op.drop_index("idx_command_audit_date", table_name="command_audit_log")
    op.drop_index("idx_command_audit_type_date", table_name="command_audit_log")
    op.drop_index("idx_command_audit_server_date", table_name="command_audit_log")
    op.drop_table("command_audit_log")
