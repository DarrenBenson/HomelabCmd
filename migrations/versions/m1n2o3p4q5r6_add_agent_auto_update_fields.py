"""Add agent auto-update fields to servers table.

EP0001: Core Monitoring - US0184 Agent Auto-Update Mechanism.

Adds fields for:
- auto_update_agent: Whether automatic agent updates are enabled (opt-in)
- agent_update_status: Current update status (pending, downloading, failed)
- agent_update_error: Error message if update failed

Revision ID: m1n2o3p4q5r6
Revises: l0m1n2o3p4q5
Create Date: 2026-01-31 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, None] = "l0m1n2o3p4q5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add agent auto-update fields to servers table."""
    # US0184: Auto-update toggle (opt-in, default False)
    op.add_column(
        "servers",
        sa.Column(
            "auto_update_agent",
            sa.Boolean(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )

    # US0184: Update status tracking
    op.add_column(
        "servers",
        sa.Column(
            "agent_update_status",
            sa.String(20),
            nullable=True,
        ),
    )

    # US0184: Error message for failed updates
    op.add_column(
        "servers",
        sa.Column(
            "agent_update_error",
            sa.String(500),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove agent auto-update fields from servers table."""
    op.drop_column("servers", "agent_update_error")
    op.drop_column("servers", "agent_update_status")
    op.drop_column("servers", "auto_update_agent")
