"""Alert model for persistent alert history.

This model stores the full alert lifecycle (open -> acknowledged -> resolved)
for historical review and pattern analysis.

Note: This is distinct from AlertState which tracks deduplication/cooldown state.
- AlertState: Internal machinery, one row per server per metric type
- Alert: User-facing history, multiple rows tracking full alert lifecycle
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class AlertStatus(str, Enum):
    """Status values for an alert lifecycle."""

    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class AlertType(str, Enum):
    """Types of alerts that can be generated."""

    DISK = "disk"
    MEMORY = "memory"
    CPU = "cpu"
    OFFLINE = "offline"
    SERVICE_DOWN = "service_down"


class Alert(TimestampMixin, Base):
    """SQLAlchemy model for persistent alert history.

    Stores the full lifecycle of alerts for historical tracking and analysis.
    Each alert record represents a single alert event from creation to resolution.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server that triggered the alert
        alert_type: Type of alert (disk, memory, cpu, offline, service_down)
        severity: Alert severity (critical, high, medium, low)
        status: Current status in lifecycle (open, acknowledged, resolved)
        title: Short description of the alert
        message: Detailed alert message (optional)
        threshold_value: The threshold that was breached (optional)
        actual_value: The value that triggered the alert (optional)
        created_at: When the alert was created (from TimestampMixin)
        updated_at: When the alert was last updated (from TimestampMixin)
        acknowledged_at: When the alert was acknowledged (optional)
        resolved_at: When the alert was resolved (optional)
        auto_resolved: Whether the alert was automatically resolved
    """

    __tablename__ = "alerts"

    # Indices for common query patterns
    __table_args__ = (
        Index("idx_alerts_server_status", "server_id", "status"),
        Index("idx_alerts_severity_status", "severity", "status"),
        Index("idx_alerts_created_at", "created_at"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Alert classification
    alert_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default=AlertStatus.OPEN.value,
        nullable=False,
    )

    # Alert content
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Metric values
    threshold_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    actual_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # Lifecycle timestamps
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Resolution type
    auto_resolved: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationship to Server
    server: Mapped["Server"] = relationship(
        "Server",
        back_populates="alerts",
        lazy="select",
    )

    def __repr__(self) -> str:
        """Return string representation of the alert."""
        return (
            f"<Alert(id={self.id}, server_id={self.server_id!r}, "
            f"type={self.alert_type!r}, severity={self.severity!r}, "
            f"status={self.status!r})>"
        )

    @property
    def is_open(self) -> bool:
        """Check if the alert is still open."""
        return self.status == AlertStatus.OPEN.value

    @property
    def is_resolved(self) -> bool:
        """Check if the alert has been resolved."""
        return self.status == AlertStatus.RESOLVED.value

    def acknowledge(self, at: datetime | None = None) -> None:
        """Mark the alert as acknowledged.

        Args:
            at: Timestamp of acknowledgement. Defaults to now.
        """
        from datetime import UTC

        self.status = AlertStatus.ACKNOWLEDGED.value
        self.acknowledged_at = at or datetime.now(UTC)

    def resolve(self, at: datetime | None = None, auto: bool = False) -> None:
        """Mark the alert as resolved.

        Args:
            at: Timestamp of resolution. Defaults to now.
            auto: Whether this was an automatic resolution.
        """
        from datetime import UTC

        self.status = AlertStatus.RESOLVED.value
        self.resolved_at = at or datetime.now(UTC)
        self.auto_resolved = auto
