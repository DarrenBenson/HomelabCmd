"""add_agent_tokens

Revision ID: 9i0j1k2l3m4n
Revises: 8h9i0j1k2l3m
Create Date: 2026-01-22 20:00:00.000000

Adds tables for secure agent authentication:
- registration_tokens: One-time tokens for pull-based agent installation
- agent_credentials: Per-agent API tokens with individual revocation
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9i0j1k2l3m4n"
down_revision: str | Sequence[str] | None = "8h9i0j1k2l3m"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add registration_tokens and agent_credentials tables."""
    # Create registration_tokens table
    op.create_table(
        "registration_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token_prefix", sa.String(length=16), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("monitored_services", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_by_server_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["claimed_by_server_id"],
            ["servers.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "ix_registration_tokens_expires_at",
        "registration_tokens",
        ["expires_at"],
    )

    # Create agent_credentials table
    op.create_table(
        "agent_credentials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_guid", sa.String(length=36), nullable=False),
        sa.Column("api_token_hash", sa.String(length=64), nullable=False),
        sa.Column("api_token_prefix", sa.String(length=16), nullable=False),
        sa.Column("is_legacy", sa.Boolean(), nullable=False, default=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["server_guid"],
            ["servers.guid"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_agent_credentials_server_guid",
        "agent_credentials",
        ["server_guid"],
    )
    op.create_index(
        "ix_agent_credentials_revoked_at",
        "agent_credentials",
        ["revoked_at"],
    )


def downgrade() -> None:
    """Downgrade schema - remove registration_tokens and agent_credentials tables."""
    op.drop_index("ix_agent_credentials_revoked_at", table_name="agent_credentials")
    op.drop_index("ix_agent_credentials_server_guid", table_name="agent_credentials")
    op.drop_table("agent_credentials")

    op.drop_index("ix_registration_tokens_expires_at", table_name="registration_tokens")
    op.drop_table("registration_tokens")
