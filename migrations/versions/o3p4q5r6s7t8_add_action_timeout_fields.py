"""Add timeout fields to remediation_actions table.

EP0004: Remediation Engine - US0186 Command Timeout Configuration.

Adds fields for tracking command timeout configuration:
- timeout_seconds: Override timeout for specific action
- timed_out_at: When the command timed out

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-01-31 16:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "o3p4q5r6s7t8"
down_revision: Union[str, None] = "n2o3p4q5r6s7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add timeout fields to remediation_actions table."""
    # US0186: Timeout override for specific actions
    op.add_column(
        "remediation_actions",
        sa.Column(
            "timeout_seconds",
            sa.Integer(),
            nullable=True,
        ),
    )
    # US0186: Track when command timed out
    op.add_column(
        "remediation_actions",
        sa.Column(
            "timed_out_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove timeout fields from remediation_actions table."""
    op.drop_column("remediation_actions", "timed_out_at")
    op.drop_column("remediation_actions", "timeout_seconds")
