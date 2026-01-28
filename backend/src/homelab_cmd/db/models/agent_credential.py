"""Agent credential model for HomelabCmd.

This model stores per-agent authentication credentials. Each agent has a unique
API token that can be individually revoked without affecting other agents.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class AgentCredential(TimestampMixin, Base):
    """SQLAlchemy model for per-agent authentication credentials.

    Each agent receives unique credentials during registration. The hub
    stores only the hash of the API token, not the plaintext. Tokens can
    be individually revoked or rotated without affecting other agents.

    Attributes:
        id: Auto-increment primary key
        server_guid: Foreign key to server's permanent GUID
        api_token_hash: SHA-256 hash of the agent's API token
        api_token_prefix: First 12 chars of token for display (e.g., "hlh_ag_abc1")
        is_legacy: True for migrated agents using the shared API key
        last_used_at: Timestamp of last successful authentication
        revoked_at: Timestamp when token was revoked (null if active)
        created_at: Record creation timestamp
        updated_at: Record update timestamp
    """

    __tablename__ = "agent_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Link to server via GUID (not server.id which can change)
    # Note: Not unique because rotation keeps old credentials (revoked) for audit
    server_guid: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("servers.guid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Token storage (hash only, never plaintext)
    api_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    api_token_prefix: Mapped[str] = mapped_column(String(16), nullable=False)

    # Legacy flag for backward compatibility during migration
    # Legacy agents use the shared API key, not per-agent tokens
    is_legacy: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Usage tracking
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Revocation support
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationship to server
    server: Mapped["Server"] = relationship(
        "Server",
        foreign_keys=[server_guid],
        primaryjoin="AgentCredential.server_guid == Server.guid",
        lazy="select",
    )

    @property
    def is_revoked(self) -> bool:
        """Check if the credential has been revoked."""
        return self.revoked_at is not None

    @property
    def is_active(self) -> bool:
        """Check if the credential is active (not revoked)."""
        return not self.is_revoked

    def __repr__(self) -> str:
        """Return string representation of the credential."""
        status = "revoked" if self.is_revoked else ("legacy" if self.is_legacy else "active")
        return f"<AgentCredential(server_guid={self.server_guid!r}, prefix={self.api_token_prefix!r}, status={status})>"
