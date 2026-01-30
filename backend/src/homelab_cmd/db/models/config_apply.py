"""Database model for configuration pack application operations.

Part of EP0010: Configuration Management - US0119 Apply Configuration Pack.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import JSON, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from homelab_cmd.db.base import Base, TimestampMixin


class ConfigApplyStatus(str, Enum):
    """Status values for a config apply lifecycle."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ConfigApply(TimestampMixin, Base):
    """SQLAlchemy model for configuration apply operations.

    Stores apply configuration, progress, and results for config pack applications.
    Each record represents a single apply attempt with its lifecycle.

    Part of US0119: Apply Configuration Pack.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Target server ID (string)
        pack_name: Configuration pack being applied
        status: Current status (pending, running, completed, failed)
        progress: Progress percentage (0-100)
        current_item: Description of current item being processed
        items_total: Total number of items to apply
        items_completed: Number of completed items
        items_failed: Number of failed items
        started_at: When the apply started executing
        completed_at: When the apply completed or failed
        results: JSON array with per-item results
        error: Error message if apply failed
        triggered_by: User/source that triggered the apply (for audit)
        created_at: When the apply was requested (from TimestampMixin)
        updated_at: When the record was last updated (from TimestampMixin)
    """

    __tablename__ = "config_apply"

    # Indices for common query patterns
    __table_args__ = (
        Index("idx_config_apply_server_status", "server_id", "status"),
        Index("idx_config_apply_created_at", "created_at"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Target configuration
    server_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    pack_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Status and progress
    status: Mapped[str] = mapped_column(
        String(20),
        default=ConfigApplyStatus.PENDING.value,
        nullable=False,
    )

    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    current_item: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    items_total: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    items_completed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    items_failed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
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

    # Results (JSON array of ApplyItemResult)
    results: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Error message
    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Audit field (AC7)
    triggered_by: Mapped[str] = mapped_column(
        String(100),
        default="user",
        nullable=False,
    )

    def __repr__(self) -> str:
        """Return string representation of the apply operation."""
        return (
            f"<ConfigApply(id={self.id}, server={self.server_id!r}, "
            f"pack={self.pack_name!r}, status={self.status!r})>"
        )

    @property
    def is_pending(self) -> bool:
        """Check if the apply is pending."""
        return self.status == ConfigApplyStatus.PENDING.value

    @property
    def is_running(self) -> bool:
        """Check if the apply is currently running."""
        return self.status == ConfigApplyStatus.RUNNING.value

    @property
    def is_completed(self) -> bool:
        """Check if the apply completed successfully."""
        return self.status == ConfigApplyStatus.COMPLETED.value

    @property
    def is_failed(self) -> bool:
        """Check if the apply failed."""
        return self.status == ConfigApplyStatus.FAILED.value

    @property
    def success(self) -> bool:
        """Check if all items succeeded (completed with no failures)."""
        return self.is_completed and self.items_failed == 0
