"""Pydantic schemas for Server API endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ServerCreate(BaseModel):
    """Schema for creating a new server."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "omv-mediaserver",
                    "hostname": "mediaserver.home.lan",
                    "display_name": "OMV Media Server",
                    "ip_address": "192.168.1.100",
                    "tdp_watts": 65,
                }
            ]
        }
    )

    id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
        description="Unique server identifier (slug format, lowercase alphanumeric and hyphens)",
        examples=["omv-mediaserver", "pihole-master"],
    )
    hostname: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Network hostname or FQDN",
        examples=["mediaserver.home.lan"],
    )
    display_name: str | None = Field(
        None,
        max_length=255,
        description="Human-friendly display name",
        examples=["OMV Media Server"],
    )
    ip_address: str | None = Field(
        None,
        max_length=45,
        description="IPv4 or IPv6 address",
        examples=["192.168.1.100"],
    )
    tdp_watts: int | None = Field(
        None,
        ge=0,
        le=10000,
        description="Typical power draw in watts for cost estimation",
        examples=[65, 100],
    )
    machine_type: str = Field(
        default="server",
        pattern=r"^(server|workstation)$",
        description="Machine type: 'server' (24/7 uptime) or 'workstation' (intermittent usage)",
    )


class ServerUpdate(BaseModel):
    """Schema for updating a server (all fields optional)."""

    hostname: str | None = Field(
        None,
        min_length=1,
        max_length=255,
        description="Network hostname or FQDN",
    )
    display_name: str | None = Field(
        None,
        max_length=255,
        description="Human-friendly display name",
    )
    ip_address: str | None = Field(
        None,
        max_length=45,
        description="IPv4 or IPv6 address",
    )
    tdp_watts: int | None = Field(
        None,
        ge=0,
        le=10000,
        description="Typical power draw in watts (max watts for cost calculation)",
    )
    machine_category: str | None = Field(
        None,
        max_length=50,
        description="Machine category for power estimation (sbc, mini_pc, nas, etc.)",
    )
    machine_category_source: str | None = Field(
        None,
        max_length=10,
        description="How category was set: 'auto' (detected) or 'user' (manual)",
    )
    idle_watts: int | None = Field(
        None,
        ge=0,
        le=10000,
        description="Override idle power consumption in watts",
    )
    # Per-server credential settings (US0087 AC4)
    ssh_username: str | None = Field(
        None,
        max_length=255,
        description="Per-server SSH username override",
    )
    sudo_mode: str | None = Field(
        None,
        pattern=r"^(passwordless|password)$",
        description="Sudo mode: 'passwordless' or 'password'",
    )
    # US0137: Machine type change via drag-and-drop
    machine_type: str | None = Field(
        None,
        pattern=r"^(server|workstation)$",
        description="Machine type: 'server' or 'workstation'",
    )


class FilesystemMetricResponse(BaseModel):
    """Per-filesystem disk metrics for API response (US0178)."""

    mount_point: str = Field(..., description="Filesystem mount point")
    device: str = Field(..., description="Block device path")
    fs_type: str = Field(..., description="Filesystem type")
    total_bytes: int = Field(..., description="Total filesystem size in bytes")
    used_bytes: int = Field(..., description="Used space in bytes")
    available_bytes: int = Field(..., description="Available space in bytes")
    percent: float = Field(..., description="Usage percentage (0-100)")


class NetworkInterfaceMetricResponse(BaseModel):
    """Per-interface network metrics for API response (US0179)."""

    name: str = Field(..., description="Network interface name")
    rx_bytes: int = Field(..., description="Total bytes received since boot")
    tx_bytes: int = Field(..., description="Total bytes transmitted since boot")
    rx_packets: int = Field(..., description="Total packets received since boot")
    tx_packets: int = Field(..., description="Total packets transmitted since boot")
    is_up: bool = Field(..., description="Whether the interface is up")


class LatestMetrics(BaseModel):
    """Schema for latest metrics summary."""

    # CPU
    cpu_percent: float | None = Field(None, description="CPU usage percentage (0-100)")

    # Memory
    memory_percent: float | None = Field(None, description="Memory usage percentage (0-100)")
    memory_total_mb: int | None = Field(None, description="Total memory in megabytes")
    memory_used_mb: int | None = Field(None, description="Used memory in megabytes")

    # Disk
    disk_percent: float | None = Field(None, description="Disk usage percentage (0-100)")
    disk_total_gb: float | None = Field(None, description="Total disk space in gigabytes")
    disk_used_gb: float | None = Field(None, description="Used disk space in gigabytes")

    # Network I/O
    network_rx_bytes: int | None = Field(None, description="Network bytes received since boot")
    network_tx_bytes: int | None = Field(None, description="Network bytes transmitted since boot")

    # Load averages
    load_1m: float | None = Field(None, description="1-minute load average")
    load_5m: float | None = Field(None, description="5-minute load average")
    load_15m: float | None = Field(None, description="15-minute load average")

    # Uptime
    uptime_seconds: int | None = Field(None, description="System uptime in seconds")


class ServerResponse(BaseModel):
    """Schema for server response."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique server identifier")
    guid: str | None = Field(
        None,
        description="Permanent UUID v4 agent identity (survives IP/hostname changes)",
    )
    hostname: str = Field(..., description="Network hostname")
    display_name: str | None = Field(None, description="Human-friendly display name")
    ip_address: str | None = Field(None, description="IPv4 or IPv6 address")
    status: str = Field(..., description="Current status (online, offline, unknown)")
    tdp_watts: int | None = Field(None, description="Typical power draw in watts")
    cpu_model: str | None = Field(None, description="CPU model name from agent")
    cpu_cores: int | None = Field(None, description="Number of logical CPU cores")
    machine_category: str | None = Field(
        None, description="Machine category for power estimation (sbc, mini_pc, nas, etc.)"
    )
    machine_category_source: str | None = Field(
        None, description="How category was set: 'auto' (detected) or 'user' (manual)"
    )
    idle_watts: int | None = Field(None, description="Override idle power consumption in watts")
    os_distribution: str | None = Field(None, description="Operating system distribution")
    os_version: str | None = Field(None, description="Operating system version")
    kernel_version: str | None = Field(None, description="Linux kernel version")
    architecture: str | None = Field(None, description="CPU architecture (x86_64, aarch64)")
    updates_available: int | None = Field(None, description="Number of package updates available")
    security_updates: int | None = Field(None, description="Number of security updates available")
    is_paused: bool = Field(False, description="Whether server is in maintenance mode")
    paused_at: datetime | None = Field(None, description="Timestamp when server was paused")
    agent_version: str | None = Field(None, description="Installed agent version")
    agent_mode: str | None = Field(
        None,
        description="Agent operating mode (BG0017): readonly (metrics only) or readwrite (full management)",
    )
    is_inactive: bool = Field(False, description="Whether agent has been removed")
    inactive_since: datetime | None = Field(None, description="Timestamp when agent was removed")
    last_seen: datetime | None = Field(None, description="Last heartbeat timestamp")
    tailscale_hostname: str | None = Field(
        None, description="Tailscale MagicDNS hostname for SSH connections (EP0008)"
    )
    machine_type: str = Field(
        default="server",
        description="Machine type: 'server' (24/7) or 'workstation' (intermittent) (EP0009)",
    )
    # Per-server credential settings (US0087 AC4)
    ssh_username: str | None = Field(None, description="Per-server SSH username override")
    sudo_mode: str = Field(
        default="passwordless", description="Sudo mode: 'passwordless' or 'password'"
    )
    created_at: datetime = Field(..., description="Server registration timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    latest_metrics: LatestMetrics | None = Field(None, description="Most recent metrics snapshot")
    # US0178: Per-filesystem disk metrics
    filesystems: list[FilesystemMetricResponse] | None = Field(
        None, description="Per-filesystem disk metrics for detailed storage view"
    )
    # US0179: Per-interface network metrics
    network_interfaces: list[NetworkInterfaceMetricResponse] | None = Field(
        None, description="Per-interface network metrics for detailed network view"
    )
    # US0110: Warning state visual treatment - active alert information
    active_alert_count: int = Field(0, description="Number of active (open) alerts for this server")
    active_alert_summaries: list[str] = Field(
        default_factory=list,
        description="Alert titles for tooltip display (max 3)",
    )


class ServerListResponse(BaseModel):
    """Schema for server list response."""

    servers: list[ServerResponse] = Field(..., description="List of server records")
    total: int = Field(..., description="Total number of servers")


class PackageResponse(BaseModel):
    """Schema for a single pending package update."""

    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="Package name", examples=["openssl"])
    current_version: str = Field(
        ..., description="Currently installed version", examples=["3.0.13-1~deb12u1"]
    )
    new_version: str = Field(..., description="Available version", examples=["3.0.14-1~deb12u1"])
    repository: str = Field(..., description="Source repository", examples=["bookworm-security"])
    is_security: bool = Field(..., description="True if from a security repository")
    detected_at: datetime = Field(..., description="When this update was first detected")
    updated_at: datetime = Field(..., description="When this record was last updated")


class PackageListResponse(BaseModel):
    """Schema for server package list response."""

    server_id: str = Field(..., description="Server identifier")
    last_checked: datetime | None = Field(
        None, description="Last heartbeat timestamp when packages were checked"
    )
    total_count: int = Field(..., description="Total number of pending packages")
    security_count: int = Field(..., description="Number of security packages")
    packages: list[PackageResponse] = Field(..., description="List of pending package updates")


# ===========================================================================
# Per-Server Credential Schemas (US0087)
# ===========================================================================


class ServerCredentialStatus(BaseModel):
    """Status of a credential type for a server (US0087 AC1)."""

    credential_type: str = Field(..., description="Type of credential")
    configured: bool = Field(..., description="Whether credential is configured")
    scope: str = Field(
        ...,
        description="'per_server' (override), 'global' (fallback), or 'none' (not configured)",
    )


class ServerCredentialsResponse(BaseModel):
    """List of credential statuses for a server (US0087 AC1)."""

    server_id: str = Field(..., description="Server identifier")
    ssh_username: str | None = Field(None, description="Per-server SSH username override")
    sudo_mode: str = Field(..., description="Sudo mode: 'passwordless' or 'password'")
    credentials: list[ServerCredentialStatus] = Field(
        ..., description="List of credential type statuses"
    )


class StoreServerCredentialRequest(BaseModel):
    """Request to store a per-server credential (US0087 AC2)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "credential_type": "sudo_password",
                    "value": "mypassword",
                }
            ]
        }
    )

    credential_type: str = Field(
        ...,
        description="Type of credential",
        examples=["sudo_password", "ssh_private_key", "ssh_password"],
    )
    value: str = Field(
        ...,
        min_length=1,
        description="The credential value (will be encrypted)",
    )


class StoreServerCredentialResponse(BaseModel):
    """Response after storing a credential (US0087 AC2)."""

    credential_type: str = Field(..., description="Type of credential stored")
    server_id: str = Field(..., description="Server identifier")
    message: str = Field(
        default="Credential stored successfully",
        description="Confirmation message",
    )
