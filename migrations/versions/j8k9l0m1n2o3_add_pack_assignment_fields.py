"""Add assigned_packs and drift_detection_enabled fields to servers table.

EP0010: Configuration Management - US0121 Pack Assignment per Machine.

Adds fields for:
- assigned_packs: JSON array of pack names assigned to the server
- drift_detection_enabled: Boolean flag to enable/disable drift detection

Revision ID: j8k9l0m1n2o3
Revises: i7j8k9l0m1n2
Create Date: 2026-01-29 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j8k9l0m1n2o3"
down_revision: Union[str, None] = "i7j8k9l0m1n2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add assigned_packs and drift_detection_enabled columns to servers table."""
    # Add assigned_packs JSON column for pack assignment
    # Nullable - NULL treated as ["base"] at application level
    op.add_column(
        "servers",
        sa.Column("assigned_packs", sa.JSON(), nullable=True),
    )

    # Add drift_detection_enabled boolean column
    # Default True - all servers have drift detection enabled by default
    op.add_column(
        "servers",
        sa.Column(
            "drift_detection_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )


def downgrade() -> None:
    """Remove assigned_packs and drift_detection_enabled columns from servers table."""
    op.drop_column("servers", "drift_detection_enabled")
    op.drop_column("servers", "assigned_packs")
