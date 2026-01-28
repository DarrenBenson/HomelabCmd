"""Scan model for ad-hoc device scanning.

This model stores scan requests and results for transient devices
that are scanned via SSH.

US0038: Scan Initiation
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import JSON, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from homelab_cmd.db.base import Base, TimestampMixin


class ScanStatus(str, Enum):
    """Status values for a scan lifecycle."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanType(str, Enum):
    """Types of scans available."""

    QUICK = "quick"
    FULL = "full"


class Scan(TimestampMixin, Base):
    """SQLAlchemy model for scan requests and results.

    Stores scan configuration, progress, and results for ad-hoc device scans.
    Each scan record represents a single scan attempt with its lifecycle.

    Attributes:
        id: Auto-incrementing primary key
        hostname: Target hostname or IP address
        port: SSH port (default 22)
        username: SSH username
        scan_type: Type of scan (quick or full)
        status: Current status (pending, running, completed, failed)
        progress: Progress percentage (0-100)
        current_step: Description of current scan step
        started_at: When the scan started executing
        completed_at: When the scan completed or failed
        results: JSON object with scan results
        error: Error message if scan failed
        created_at: When the scan was requested (from TimestampMixin)
        updated_at: When the record was last updated (from TimestampMixin)
    """

    __tablename__ = "scans"

    # Indices for common query patterns
    __table_args__ = (
        Index("idx_scans_hostname_status", "hostname", "status"),
        Index("idx_scans_created_at", "created_at"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Target configuration
    hostname: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    port: Mapped[int] = mapped_column(
        Integer,
        default=22,
        nullable=False,
    )

    username: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    # Scan configuration
    scan_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Status and progress
    status: Mapped[str] = mapped_column(
        String(20),
        default=ScanStatus.PENDING.value,
        nullable=False,
    )

    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    current_step: Mapped[str | None] = mapped_column(
        String(100),
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

    # Results (JSON)
    results: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Error message
    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    def __repr__(self) -> str:
        """Return string representation of the scan."""
        return (
            f"<Scan(id={self.id}, hostname={self.hostname!r}, "
            f"type={self.scan_type!r}, status={self.status!r})>"
        )

    @property
    def is_pending(self) -> bool:
        """Check if the scan is pending."""
        return self.status == ScanStatus.PENDING.value

    @property
    def is_running(self) -> bool:
        """Check if the scan is currently running."""
        return self.status == ScanStatus.RUNNING.value

    @property
    def is_completed(self) -> bool:
        """Check if the scan completed successfully."""
        return self.status == ScanStatus.COMPLETED.value

    @property
    def is_failed(self) -> bool:
        """Check if the scan failed."""
        return self.status == ScanStatus.FAILED.value
