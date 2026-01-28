"""Metrics models for HomelabCmd.

This module stores time-series metrics collected from monitored servers,
including raw metrics and tiered aggregates (hourly, daily) for long-term retention.

Retention tiers (US0046):
- Raw: 60-second granularity, 7-day retention
- Hourly: 1-hour aggregates, 90-day retention
- Daily: 1-day aggregates, 12-month retention
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class Metrics(Base):
    """SQLAlchemy model for server metrics.

    Stores time-series performance data collected via agent heartbeats.
    Each record represents a snapshot of server metrics at a specific time.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        timestamp: When the metrics were collected
        cpu_percent: CPU usage percentage (0-100)
        memory_percent: Memory usage percentage (0-100)
        memory_total_mb: Total memory in MB
        memory_used_mb: Used memory in MB
        disk_percent: Disk usage percentage (0-100)
        disk_total_gb: Total disk space in GB
        disk_used_gb: Used disk space in GB
        network_rx_bytes: Network bytes received
        network_tx_bytes: Network bytes transmitted
        load_1m: 1-minute load average
        load_5m: 5-minute load average
        load_15m: 15-minute load average
        uptime_seconds: Server uptime in seconds
    """

    __tablename__ = "metrics"

    # Composite index for efficient queries by server and time range
    __table_args__ = (Index("idx_metrics_server_timestamp", "server_id", "timestamp"),)

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Timestamp of the metrics snapshot
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # CPU metrics
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Memory metrics
    memory_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_total_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_used_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Disk metrics
    disk_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_total_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_used_gb: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Network metrics (using BigInteger for large byte counts)
    network_rx_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    network_tx_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # System load averages
    load_1m: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_5m: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_15m: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Uptime
    uptime_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationship to server
    server: Mapped["Server"] = relationship("Server", back_populates="metrics")

    def __repr__(self) -> str:
        """Return string representation of the metrics."""
        return (
            f"<Metrics(id={self.id}, server_id={self.server_id!r}, "
            f"timestamp={self.timestamp}, cpu={self.cpu_percent}%)>"
        )


class MetricsHourly(Base):
    """Hourly aggregated metrics (90-day retention).

    Stores hourly averages, minimums, and maximums for CPU, memory, and disk.
    Created by rolling up raw metrics older than 7 days.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        timestamp: Hour start time (e.g., 2026-01-18 14:00:00)
        cpu_avg/min/max: CPU usage statistics
        memory_avg/min/max: Memory usage statistics
        disk_avg/min/max: Disk usage statistics
        sample_count: Number of raw records aggregated
    """

    __tablename__ = "metrics_hourly"

    __table_args__ = (Index("idx_metrics_hourly_server_ts", "server_id", "timestamp"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # CPU aggregates
    cpu_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Memory aggregates
    memory_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Disk aggregates
    disk_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Sample count
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        """Return string representation of the hourly metrics."""
        return (
            f"<MetricsHourly(id={self.id}, server_id={self.server_id!r}, "
            f"timestamp={self.timestamp}, samples={self.sample_count})>"
        )


class MetricsDaily(Base):
    """Daily aggregated metrics (12-month retention).

    Stores daily averages, minimums, and maximums for CPU, memory, and disk.
    Created by rolling up hourly metrics older than 90 days.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        timestamp: Day start time (e.g., 2026-01-18 00:00:00)
        cpu_avg/min/max: CPU usage statistics
        memory_avg/min/max: Memory usage statistics
        disk_avg/min/max: Disk usage statistics
        sample_count: Total raw samples represented (sum of hourly sample_counts)
    """

    __tablename__ = "metrics_daily"

    __table_args__ = (Index("idx_metrics_daily_server_ts", "server_id", "timestamp"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # CPU aggregates
    cpu_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Memory aggregates
    memory_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Disk aggregates
    disk_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Sample count
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        """Return string representation of the daily metrics."""
        return (
            f"<MetricsDaily(id={self.id}, server_id={self.server_id!r}, "
            f"timestamp={self.timestamp}, samples={self.sample_count})>"
        )
