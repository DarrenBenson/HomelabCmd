"""Add per-server credentials support.

Part of EP0015: Per-Host Credential Management (US0083).

Extends credentials table with server_id FK to support per-server credentials.
Adds ssh_username and sudo_mode fields to servers table.

Revision ID: d2e3f4g5h6i7
Revises: b5c0043d0f8b
Create Date: 2026-01-27 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2e3f4g5h6i7"
down_revision: str | Sequence[str] | None = "b5c0043d0f8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - add per-server credentials support."""
    # Add server_id column to credentials table
    op.add_column(
        "credentials",
        sa.Column("server_id", sa.String(length=100), nullable=True),
    )

    # Create foreign key constraint
    op.create_foreign_key(
        "fk_credentials_server_id",
        "credentials",
        "servers",
        ["server_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Create index on server_id
    op.create_index(
        "ix_credentials_server_id",
        "credentials",
        ["server_id"],
    )

    # Drop the old unique constraint on credential_type
    # SQLite doesn't support DROP CONSTRAINT, so we need to use batch mode
    with op.batch_alter_table("credentials") as batch_op:
        # Drop the old unique index
        batch_op.drop_index("ix_credentials_credential_type")

    # Create new compound unique index for (credential_type, server_id)
    # SQLite handles NULL uniqueness correctly: (type, NULL) is distinct from (type, 'server1')
    op.create_index(
        "ix_credentials_type_server_unique",
        "credentials",
        ["credential_type", "server_id"],
        unique=True,
    )

    # Add ssh_username and sudo_mode columns to servers table
    op.add_column(
        "servers",
        sa.Column("ssh_username", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "servers",
        sa.Column(
            "sudo_mode",
            sa.String(length=20),
            nullable=False,
            server_default="passwordless",
        ),
    )


def downgrade() -> None:
    """Downgrade schema - remove per-server credentials support."""
    # Remove server columns
    op.drop_column("servers", "sudo_mode")
    op.drop_column("servers", "ssh_username")

    # Restore original credential_type unique index
    op.drop_index("ix_credentials_type_server_unique", table_name="credentials")

    # Need to use batch mode for SQLite to modify constraints
    with op.batch_alter_table("credentials") as batch_op:
        batch_op.create_index(
            "ix_credentials_credential_type",
            ["credential_type"],
            unique=True,
        )

    # Remove foreign key and index
    op.drop_index("ix_credentials_server_id", table_name="credentials")
    op.drop_constraint("fk_credentials_server_id", "credentials", type_="foreignkey")
    op.drop_column("credentials", "server_id")
