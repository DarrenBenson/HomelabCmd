"""Discovery model for network device discovery.

This model stores discovery sessions and their results.

US0041: Network Discovery
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import JSON, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from homelab_cmd.db.base import Base, TimestampMixin


class DiscoveryStatus(str, Enum):
    """Status values for a discovery lifecycle."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Discovery(TimestampMixin, Base):
    """SQLAlchemy model for network discovery sessions.

    Stores discovery configuration, progress, and results for subnet scans.
    Each discovery record represents a single discovery attempt.

    Attributes:
        id: Auto-incrementing primary key
        subnet: Subnet being scanned in CIDR notation (e.g., "192.168.1.0/24")
        status: Current status (pending, running, completed, failed)
        progress_scanned: Number of IPs scanned so far
        progress_total: Total number of IPs to scan
        devices_found: Count of devices discovered
        devices: JSON array of discovered devices
        started_at: When the discovery started
        completed_at: When the discovery completed or failed
        error: Error message if discovery failed
        created_at: When the discovery was requested (from TimestampMixin)
        updated_at: When the record was last updated (from TimestampMixin)
    """

    __tablename__ = "discoveries"

    # Indices for common query patterns
    __table_args__ = (
        Index("idx_discoveries_status", "status"),
        Index("idx_discoveries_created_at", "created_at"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Discovery configuration
    subnet: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Status and progress
    status: Mapped[str] = mapped_column(
        String(20),
        default=DiscoveryStatus.PENDING.value,
        nullable=False,
    )

    progress_scanned: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    progress_total: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    devices_found: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Discovered devices (JSON array)
    devices: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Lifecycle timestamps
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Error message
    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    def __repr__(self) -> str:
        """Return string representation of the discovery."""
        return (
            f"<Discovery(id={self.id}, subnet={self.subnet!r}, "
            f"status={self.status!r}, devices_found={self.devices_found})>"
        )

    @property
    def is_pending(self) -> bool:
        """Check if the discovery is pending."""
        return self.status == DiscoveryStatus.PENDING.value

    @property
    def is_running(self) -> bool:
        """Check if the discovery is currently running."""
        return self.status == DiscoveryStatus.RUNNING.value

    @property
    def is_completed(self) -> bool:
        """Check if the discovery completed successfully."""
        return self.status == DiscoveryStatus.COMPLETED.value

    @property
    def is_failed(self) -> bool:
        """Check if the discovery failed."""
        return self.status == DiscoveryStatus.FAILED.value

    @property
    def progress_percent(self) -> int:
        """Calculate progress as a percentage."""
        if self.progress_total == 0:
            return 0
        return int((self.progress_scanned / self.progress_total) * 100)
