"""Server model for HomelabCmd.

This model represents a monitored server in the homelab infrastructure.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from homelab_cmd.db.models.alert import Alert
    from homelab_cmd.db.models.alert_state import AlertState
    from homelab_cmd.db.models.config_check import ConfigCheck
    from homelab_cmd.db.models.credential import Credential
    from homelab_cmd.db.models.metrics import Metrics
    from homelab_cmd.db.models.pending_package import PendingPackage
    from homelab_cmd.db.models.remediation import RemediationAction
    from homelab_cmd.db.models.service import ExpectedService


class ServerStatus(str, Enum):
    """Status values for a server."""

    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class Server(TimestampMixin, Base):
    """SQLAlchemy model for a monitored server.

    Attributes:
        id: Unique identifier (slug format, e.g., "omv-mediaserver")
        hostname: Server hostname
        display_name: Human-readable display name
        ip_address: Server IP address
        ssh_username: Per-server SSH username override (EP0015)
        sudo_mode: Sudo configuration - 'passwordless' or 'password' (EP0015)
        status: Current status (online/offline/unknown)
        os_distribution: Operating system distribution
        os_version: Operating system version
        kernel_version: Linux kernel version
        architecture: CPU architecture (e.g., x86_64, arm64)
        tdp_watts: Thermal Design Power for energy calculations
        is_paused: Whether server is in maintenance mode (actions require approval)
        paused_at: Timestamp when server was paused
        agent_version: Installed agent version (e.g., "1.0.0")
        is_inactive: Whether agent has been removed (server still tracked)
        inactive_since: Timestamp when server was marked inactive
        last_seen: Timestamp of last heartbeat
        created_at: Record creation timestamp
        updated_at: Record update timestamp
    """

    __tablename__ = "servers"

    # Primary key - slug format (e.g., "omv-mediaserver")
    id: Mapped[str] = mapped_column(String(100), primary_key=True)

    # Permanent agent identity (UUID v4) - survives IP/hostname changes
    # Nullable for migration: existing servers won't have GUID initially
    guid: Mapped[str | None] = mapped_column(String(36), unique=True, index=True, nullable=True)

    # Core identification
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # Supports IPv6

    # Tailscale integration fields (EP0008: US0078)
    tailscale_hostname: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    tailscale_device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    machine_type: Mapped[str] = mapped_column(String(20), default="server", nullable=False)

    # EP0015: Per-host credential settings
    # SSH username override - NULL means use global default
    ssh_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Sudo mode - 'passwordless' (default) or 'password' (requires sudo password)
    sudo_mode: Mapped[str] = mapped_column(String(20), default="passwordless", nullable=False)
    # Config user - user whose home directory to check for compliance (EP0010)
    # NULL means use ssh_username
    config_user: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=ServerStatus.UNKNOWN.value,
        nullable=False,
    )

    # Operating system information (populated from agent heartbeat)
    os_distribution: Mapped[str | None] = mapped_column(String(100), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    kernel_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    architecture: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Power consumption for energy cost calculations
    tdp_watts: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # CPU information (from agent heartbeat, for power profile detection)
    cpu_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cpu_cores: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Machine category for power estimation
    machine_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    machine_category_source: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # "auto" or "user"
    idle_watts: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Package updates (from agent heartbeat)
    updates_available: Mapped[int | None] = mapped_column(Integer, nullable=True)
    security_updates: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # US0178: Per-filesystem metrics snapshot (latest heartbeat data)
    # Stored as JSON array of filesystem metric objects
    filesystems: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # US0179: Per-interface network metrics snapshot (latest heartbeat data)
    # Stored as JSON array of network interface metric objects
    network_interfaces: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Maintenance mode - when paused, new remediation actions require manual approval
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Agent version tracking (EP0007: US0061)
    agent_version: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Agent operating mode (BG0017): "readonly" or "readwrite"
    # - readonly: Metrics collection only, cannot execute commands
    # - readwrite: Full management, can execute whitelisted commands
    agent_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Inactive server state (EP0007: US0065)
    is_inactive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    inactive_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Last heartbeat timestamp
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationship to metrics (one-to-many)
    metrics: Mapped[list["Metrics"]] = relationship(
        "Metrics",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    # Relationship to alert states (one-to-many) - internal deduplication tracking
    alert_states: Mapped[list["AlertState"]] = relationship(
        "AlertState",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # Relationship to alerts (one-to-many) - historical alert records
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    # Relationship to expected services (one-to-many) - configured services to monitor
    expected_services: Mapped[list["ExpectedService"]] = relationship(
        "ExpectedService",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # Relationship to remediation actions (one-to-many) - queued actions
    remediation_actions: Mapped[list["RemediationAction"]] = relationship(
        "RemediationAction",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    # Relationship to pending packages (one-to-many) - packages with updates available
    pending_packages: Mapped[list["PendingPackage"]] = relationship(
        "PendingPackage",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # EP0015: Relationship to per-server credentials (one-to-many)
    credentials: Mapped[list["Credential"]] = relationship(
        "Credential",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # EP0010: Relationship to configuration compliance checks (one-to-many)
    config_checks: Mapped[list["ConfigCheck"]] = relationship(
        "ConfigCheck",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    # US0121: Configuration pack assignment
    # JSON array of assigned pack names (e.g., ["base", "developer-lite"])
    # Default is ["base"] for servers, ["base", "developer-lite"] for workstations
    assigned_packs: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # US0122: Configuration drift detection enabled flag
    # When True, scheduled drift detection will check this server
    drift_detection_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        """Return string representation of the server."""
        return f"<Server(id={self.id!r}, hostname={self.hostname!r}, status={self.status!r})>"
