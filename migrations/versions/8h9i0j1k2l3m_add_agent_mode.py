"""add_agent_mode

Revision ID: 8h9i0j1k2l3m
Revises: 7g8h9i0j1k2l
Create Date: 2026-01-22 19:00:00.000000

Adds agent_mode field to servers table (BG0017).
- agent_mode: "readonly" or "readwrite" operating mode
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8h9i0j1k2l3m"
down_revision: str | Sequence[str] | None = "7g8h9i0j1k2l"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add agent_mode field to servers table."""
    with op.batch_alter_table("servers", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("agent_mode", sa.String(length=20), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema - remove agent_mode field from servers table."""
    with op.batch_alter_table("servers", schema=None) as batch_op:
        batch_op.drop_column("agent_mode")
