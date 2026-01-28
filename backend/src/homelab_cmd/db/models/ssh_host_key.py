"""SSH Host Key model for storing verified host keys.

Part of EP0008: Tailscale Integration (US0079).

Implements Trust On First Use (TOFU) pattern for SSH host key verification.
Host keys are stored on first connection and verified on subsequent connections.
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from homelab_cmd.db.base import Base


class SSHHostKey(Base):
    """SSH host key storage for verified host keys.

    Stores the public key of SSH hosts for verification on subsequent
    connections. Implements TOFU (Trust On First Use) pattern.

    Attributes:
        id: Unique identifier (UUID).
        machine_id: Foreign key to servers table.
        hostname: Tailscale hostname (e.g., homeserver.tail-abc123.ts.net).
        key_type: SSH key type (ssh-ed25519, ssh-rsa, etc.).
        public_key: Base64-encoded public key.
        fingerprint: SHA256 fingerprint of the host key.
        first_seen: Timestamp when host key was first stored.
        last_seen: Timestamp of last successful connection.
    """

    __tablename__ = "ssh_host_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    machine_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    key_type: Mapped[str] = mapped_column(String(50), nullable=False)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(100), nullable=False)
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        """Return string representation of the SSH host key."""
        return f"<SSHHostKey(machine_id={self.machine_id!r}, hostname={self.hostname!r}, key_type={self.key_type!r})>"
