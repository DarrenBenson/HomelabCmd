"""add_has_docker_to_server

US0157: Add has_docker field to server model for Docker detection (EP0014).

Revision ID: p5q6r7s8t9u0
Revises: c9542a8b9caf
Create Date: 2026-02-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p5q6r7s8t9u0'
down_revision: Union[str, Sequence[str], None] = 'c9542a8b9caf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('has_docker', sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.drop_column('has_docker')
