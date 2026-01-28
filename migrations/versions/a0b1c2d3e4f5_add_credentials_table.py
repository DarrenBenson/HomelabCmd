"""add_credentials_table

Revision ID: a0b1c2d3e4f5
Revises: 9i0j1k2l3m4n
Create Date: 2026-01-26 10:00:00.000000

EP0008 US0081: Add credentials table for encrypted credential storage.
Stores Tailscale API tokens and SSH private keys encrypted at rest.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a0b1c2d3e4f5"
down_revision: str | Sequence[str] | None = "9i0j1k2l3m4n"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add credentials table."""
    op.create_table(
        "credentials",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("credential_type", sa.String(length=50), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_type"),
    )
    op.create_index(
        "ix_credentials_credential_type",
        "credentials",
        ["credential_type"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema - remove credentials table."""
    op.drop_index("ix_credentials_credential_type", table_name="credentials")
    op.drop_table("credentials")
