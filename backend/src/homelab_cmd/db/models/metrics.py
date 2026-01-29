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

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer, String
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


class FilesystemMetrics(Base):
    """Per-filesystem metrics storage (US0178).

    Stores historical per-filesystem disk metrics for trend analysis.
    Each record represents a single filesystem's metrics at a specific time.

    Retention: Same as raw metrics (7 days), then purged.
    For longer retention, implement FilesystemMetricsHourly/Daily if needed.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        timestamp: When the metrics were collected
        mount_point: Filesystem mount point (e.g., /, /data)
        device: Block device path (e.g., /dev/sda1)
        fs_type: Filesystem type (e.g., ext4, xfs)
        total_bytes: Total filesystem size
        used_bytes: Used space
        available_bytes: Available space
        percent: Usage percentage
    """

    __tablename__ = "filesystem_metrics"

    __table_args__ = (
        Index("idx_fs_metrics_server_ts", "server_id", "timestamp"),
        Index("idx_fs_metrics_server_mount_ts", "server_id", "mount_point", "timestamp"),
    )

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

    # Filesystem identification
    mount_point: Mapped[str] = mapped_column(String(255), nullable=False)
    device: Mapped[str] = mapped_column(String(255), nullable=False)
    fs_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Metrics (using BigInteger for large disk sizes)
    total_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    used_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    available_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    percent: Mapped[float] = mapped_column(Float, nullable=False)

    def __repr__(self) -> str:
        """Return string representation of the filesystem metrics."""
        return (
            f"<FilesystemMetrics(id={self.id}, server_id={self.server_id!r}, "
            f"mount_point={self.mount_point!r}, percent={self.percent}%)>"
        )


class NetworkInterfaceMetrics(Base):
    """Per-interface network metrics storage (US0179).

    Stores historical per-interface network metrics for trend analysis.
    Each record represents a single interface's metrics at a specific time.

    Retention: Same as raw metrics (7 days), then purged.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        timestamp: When the metrics were collected
        interface_name: Network interface name (e.g., eth0, tailscale0)
        rx_bytes: Total bytes received
        tx_bytes: Total bytes transmitted
        rx_packets: Total packets received
        tx_packets: Total packets transmitted
        is_up: Whether interface is up
    """

    __tablename__ = "network_interface_metrics"

    __table_args__ = (
        Index("idx_net_iface_server_ts", "server_id", "timestamp"),
        Index("idx_net_iface_server_name_ts", "server_id", "interface_name", "timestamp"),
    )

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

    # Interface identification
    interface_name: Mapped[str] = mapped_column(String(64), nullable=False)

    # Network metrics (using BigInteger for large byte counts)
    rx_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tx_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    rx_packets: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tx_packets: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Interface state
    is_up: Mapped[bool] = mapped_column(Boolean, nullable=False)

    def __repr__(self) -> str:
        """Return string representation of the network interface metrics."""
        return (
            f"<NetworkInterfaceMetrics(id={self.id}, server_id={self.server_id!r}, "
            f"interface_name={self.interface_name!r}, rx_bytes={self.rx_bytes})>"
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
