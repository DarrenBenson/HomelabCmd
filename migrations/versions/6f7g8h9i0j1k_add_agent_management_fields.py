"""add_agent_management_fields

Revision ID: 6f7g8h9i0j1k
Revises: 5e6f7g8h9i0j
Create Date: 2026-01-21 18:30:00.000000

Adds agent version tracking and inactive server state fields (EP0007).
- agent_version: Track installed agent version
- is_inactive: Mark servers where agent has been removed
- inactive_since: Timestamp when agent was removed
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6f7g8h9i0j1k"
down_revision: str | Sequence[str] | None = "5e6f7g8h9i0j"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add agent management fields to servers table."""
    with op.batch_alter_table("servers", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("agent_version", sa.String(length=20), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "is_inactive", sa.Boolean(), nullable=False, server_default=sa.text("0")
            )
        )
        batch_op.add_column(
            sa.Column("inactive_since", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema - remove agent management fields from servers table."""
    with op.batch_alter_table("servers", schema=None) as batch_op:
        batch_op.drop_column("inactive_since")
        batch_op.drop_column("is_inactive")
        batch_op.drop_column("agent_version")
