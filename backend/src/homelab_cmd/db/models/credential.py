"""Credential model for encrypted credential storage.

Part of EP0008: Tailscale Integration (US0081).
Updated EP0015: Per-Host Credential Management (US0083).
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class Credential(Base, TimestampMixin):
    """Encrypted credential storage for sensitive values.

    Stores Tailscale API tokens, SSH private keys, sudo passwords, and other
    sensitive credentials encrypted at rest using Fernet symmetric encryption.

    Credentials can be global (server_id=NULL) or per-server (server_id set).
    Per-server credentials override global credentials when both exist.

    The encryption key is provided via the HOMELABCMD_ENCRYPTION_KEY
    environment variable.
    """

    __tablename__ = "credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    credential_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    # EP0015: Per-server credential support
    # NULL = global credential, non-NULL = per-server credential
    server_id: Mapped[str | None] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship to server (optional - NULL for global credentials)
    server: Mapped["Server | None"] = relationship(
        "Server",
        back_populates="credentials",
        lazy="select",
    )

    # Compound unique constraint: same type can exist for different servers
    # SQLite handles NULL uniquely, so (type, NULL) and (type, 'server1') are distinct
    __table_args__ = (
        Index(
            "ix_credentials_type_server_unique",
            "credential_type",
            "server_id",
            unique=True,
        ),
    )
