"""Add ssh_host_keys table for TOFU host key verification

Part of EP0008: Tailscale Integration (US0079: SSH Connection via Tailscale).

Stores trusted SSH host keys using Trust On First Use (TOFU) pattern.

Revision ID: b5c0043d0f8b
Revises: c1d2e3f4g5h6
Create Date: 2026-01-26 22:34:42.951790

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b5c0043d0f8b'
down_revision: str | Sequence[str] | None = 'c1d2e3f4g5h6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add ssh_host_keys table."""
    op.create_table('ssh_host_keys',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('machine_id', sa.String(length=100), nullable=False),
        sa.Column('hostname', sa.String(length=255), nullable=False),
        sa.Column('key_type', sa.String(length=50), nullable=False),
        sa.Column('public_key', sa.Text(), nullable=False),
        sa.Column('fingerprint', sa.String(length=100), nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['servers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ssh_host_keys', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ssh_host_keys_machine_id'), ['machine_id'], unique=True)


def downgrade() -> None:
    """Remove ssh_host_keys table."""
    with op.batch_alter_table('ssh_host_keys', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ssh_host_keys_machine_id'))

    op.drop_table('ssh_host_keys')
