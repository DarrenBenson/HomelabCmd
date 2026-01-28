"""add_cpu_power_fields

Revision ID: 4d5e6f7g8h9i
Revises: 3ea7c7846aa8
Create Date: 2026-01-20 10:00:00.000000

Adds CPU information and machine category fields for enhanced power estimation.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4d5e6f7g8h9i'
down_revision: str | Sequence[str] | None = '3ea7c7846aa8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('servers', schema=None) as batch_op:
        # CPU information from agent
        batch_op.add_column(sa.Column('cpu_model', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('cpu_cores', sa.Integer(), nullable=True))

        # Machine category for power estimation
        batch_op.add_column(sa.Column('machine_category', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('machine_category_source', sa.String(10), nullable=True))
        batch_op.add_column(sa.Column('idle_watts', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.drop_column('idle_watts')
        batch_op.drop_column('machine_category_source')
        batch_op.drop_column('machine_category')
        batch_op.drop_column('cpu_cores')
        batch_op.drop_column('cpu_model')
