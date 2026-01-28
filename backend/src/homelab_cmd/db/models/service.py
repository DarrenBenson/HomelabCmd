"""Service models for HomelabCmd.

This module contains models for tracking expected services per server
and their historical status.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class ServiceStatusValue(str, Enum):
    """Status values for a service."""

    RUNNING = "running"
    STOPPED = "stopped"
    FAILED = "failed"
    UNKNOWN = "unknown"


class ExpectedService(Base):
    """SQLAlchemy model for an expected service on a server.

    Attributes:
        id: Unique identifier (autoincrement)
        server_id: Reference to the server
        service_name: Systemd service name (e.g., "docker.service")
        display_name: Human-readable display name
        is_critical: Whether this service is critical (affects alert severity)
        enabled: Whether monitoring is enabled for this service
        created_at: Record creation timestamp
    """

    __tablename__ = "expected_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationship to server
    server: Mapped["Server"] = relationship("Server", back_populates="expected_services")

    __table_args__ = (
        UniqueConstraint("server_id", "service_name", name="uq_server_service_name"),
        Index("idx_expected_services_server", "server_id"),
    )

    def __repr__(self) -> str:
        """Return string representation of the expected service."""
        return (
            f"<ExpectedService(id={self.id!r}, server_id={self.server_id!r}, "
            f"service_name={self.service_name!r}, is_critical={self.is_critical!r})>"
        )


class ServiceStatus(Base):
    """SQLAlchemy model for service status history.

    Attributes:
        id: Unique identifier (autoincrement)
        server_id: Reference to the server
        service_name: Systemd service name
        status: Current status (running/stopped/failed/unknown)
        status_reason: Explanation when status is unknown
        pid: Process ID if running
        memory_mb: Memory usage in MB
        cpu_percent: CPU usage percentage
        timestamp: When this status was recorded
    """

    __tablename__ = "service_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    status_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_mb: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_service_status_server_time", "server_id", "timestamp"),
        Index("idx_service_status_service", "server_id", "service_name", "timestamp"),
    )

    def __repr__(self) -> str:
        """Return string representation of the service status."""
        return (
            f"<ServiceStatus(id={self.id!r}, server_id={self.server_id!r}, "
            f"service_name={self.service_name!r}, status={self.status!r})>"
        )
