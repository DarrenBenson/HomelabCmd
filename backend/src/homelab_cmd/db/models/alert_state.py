"""AlertState model for tracking alert conditions per server per metric.

This model supports:
- Consecutive breach tracking for sustained thresholds
- Current severity state for deduplication
- Notification timing for cooldown logic
- Resolution tracking for auto-resolve
"""

from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base


class MetricType(str, Enum):
    """Types of metrics that can trigger alerts."""

    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    OFFLINE = "offline"


class AlertSeverity(str, Enum):
    """Alert severity levels.

    Note: Medium and Low are not actively used (no triggers defined)
    but kept for potential future use or legacy compatibility.
    """

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AlertState(Base):
    """SQLAlchemy model for tracking alert state per server per metric.

    This table tracks:
    - Consecutive breach counts for sustained threshold logic
    - Current severity for deduplication (only one active alert per metric)
    - Notification timing for cooldown-aware re-notifications
    - Resolution tracking for auto-resolve notifications

    Attributes:
        id: Primary key
        server_id: Foreign key to servers table
        metric_type: Type of metric (cpu, memory, disk, offline)
        current_severity: Active severity (null = no active alert)
        consecutive_breaches: Number of consecutive threshold breaches
        current_value: Most recent metric value
        first_breach_at: When the current breach sequence started
        last_notified_at: When the last notification was sent
        resolved_at: When the alert was last resolved
        created_at: Record creation timestamp
        updated_at: Record update timestamp
    """

    __tablename__ = "alert_states"
    __table_args__ = (UniqueConstraint("server_id", "metric_type", name="uq_server_metric"),)

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Server relationship
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Metric type (cpu, memory, disk, offline)
    metric_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Current severity (null = no active alert, not breaching)
    current_severity: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        default=None,
    )

    # Consecutive breach count for sustained threshold tracking
    consecutive_breaches: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Current metric value (for display and notifications)
    current_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # When the current breach sequence started
    first_breach_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # When the last notification was sent (for cooldown logic)
    last_notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # When the alert was last resolved
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Record timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationship to Server (optional, for eager loading)
    server: Mapped["Server"] = relationship(  # noqa: F821
        "Server",
        back_populates="alert_states",
        lazy="select",
    )

    def __repr__(self) -> str:
        """Return string representation of the alert state."""
        return (
            f"<AlertState(server_id={self.server_id!r}, "
            f"metric_type={self.metric_type!r}, "
            f"severity={self.current_severity!r}, "
            f"breaches={self.consecutive_breaches})>"
        )

    @property
    def is_active(self) -> bool:
        """Check if there's an active alert (severity is set)."""
        return self.current_severity is not None

    @property
    def duration_minutes(self) -> int | None:
        """Calculate alert duration in minutes from first breach.

        Returns None if no active alert or first_breach_at not set.
        """
        if not self.first_breach_at:
            return None

        end_time = self.resolved_at or datetime.now(UTC)

        # Handle timezone-aware vs naive datetime comparison
        # SQLite may return naive datetimes, so we normalise
        first_breach = self.first_breach_at
        if first_breach.tzinfo is None:
            first_breach = first_breach.replace(tzinfo=UTC)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=UTC)

        duration = end_time - first_breach
        return int(duration.total_seconds() / 60)
