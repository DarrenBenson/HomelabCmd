"""Add last_restart_at to expected_services table.

EP0003: Service Monitoring - US0185 Service Restart Grace Period.

Adds field for tracking when a service was last restarted to enable
grace period calculation during alert evaluation.

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2026-01-31 15:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "n2o3p4q5r6s7"
down_revision: Union[str, None] = "m1n2o3p4q5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last_restart_at column to expected_services table."""
    # US0185: Track last restart timestamp for grace period calculation
    op.add_column(
        "expected_services",
        sa.Column(
            "last_restart_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove last_restart_at column from expected_services table."""
    op.drop_column("expected_services", "last_restart_at")
