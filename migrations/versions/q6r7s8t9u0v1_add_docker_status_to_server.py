"""add_docker_status_to_server

US0163: Add docker_status JSON field to server model for container status (EP0014).

Revision ID: q6r7s8t9u0v1
Revises: p5q6r7s8t9u0
Create Date: 2026-02-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'q6r7s8t9u0v1'
down_revision: Union[str, Sequence[str], None] = 'p5q6r7s8t9u0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('docker_status', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.drop_column('docker_status')
