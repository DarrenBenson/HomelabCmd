"""PendingPackage model for tracking server package updates.

This model stores detailed information about packages that have updates available
on each server, collected via agent heartbeat.
"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class PendingPackage(Base):
    """SQLAlchemy model for a pending package update.

    Attributes:
        id: Unique identifier (UUID)
        server_id: Reference to the server this package belongs to
        name: Package name (e.g., "openssl")
        current_version: Currently installed version
        new_version: Available version to upgrade to
        repository: Source repository (e.g., "bookworm-security")
        is_security: True if from a security repository
        detected_at: When this package update was first detected
        updated_at: When this record was last updated
    """

    __tablename__ = "pending_packages"

    # Composite unique constraint: one record per (server_id, name)
    __table_args__ = (UniqueConstraint("server_id", "name", name="uq_pending_package_server_name"),)

    # Primary key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    # Foreign key to server
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Package information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    current_version: Mapped[str] = mapped_column(String(100), nullable=False)
    new_version: Mapped[str] = mapped_column(String(100), nullable=False)
    repository: Mapped[str] = mapped_column(String(255), nullable=False)
    is_security: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationship to server
    server: Mapped["Server"] = relationship(
        "Server",
        back_populates="pending_packages",
    )

    def __repr__(self) -> str:
        """Return string representation of the pending package."""
        return (
            f"<PendingPackage(id={self.id!r}, server_id={self.server_id!r}, "
            f"name={self.name!r}, new_version={self.new_version!r})>"
        )
