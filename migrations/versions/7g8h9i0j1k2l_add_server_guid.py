"""add_server_guid

Revision ID: 7g8h9i0j1k2l
Revises: 6f7g8h9i0j1k
Create Date: 2026-01-22 12:00:00.000000

Adds GUID field to servers table for permanent agent identity.
- guid: UUID v4 that survives IP/hostname changes (US0070)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7g8h9i0j1k2l"
down_revision: str | Sequence[str] | None = "6f7g8h9i0j1k"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add guid field to servers table."""
    with op.batch_alter_table("servers", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("guid", sa.String(length=36), nullable=True)
        )
        batch_op.create_index("ix_servers_guid", ["guid"], unique=True)


def downgrade() -> None:
    """Downgrade schema - remove guid field from servers table."""
    with op.batch_alter_table("servers", schema=None) as batch_op:
        batch_op.drop_index("ix_servers_guid")
        batch_op.drop_column("guid")
