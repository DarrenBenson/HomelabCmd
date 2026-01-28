"""Pydantic schemas for discovery API endpoints.

US0041: Network Discovery
US0069: Service Discovery During Agent Installation
"""

from pydantic import BaseModel, Field

# =============================================================================
# Service Discovery Schemas (US0069)
# =============================================================================


class ServiceDiscoveryRequest(BaseModel):
    """Request to discover services on a remote host.

    US0073: Added key_id for SSH key selection.
    """

    hostname: str = Field(..., description="Target hostname or IP address")
    port: int = Field(22, ge=1, le=65535, description="SSH port")
    username: str = Field("root", description="SSH username")
    key_id: str | None = Field(
        default=None,
        description="SSH key ID to use for authentication. "
        "If not provided, all configured keys are tried.",
    )


class DiscoveredService(BaseModel):
    """A discovered systemd service."""

    name: str = Field(..., description="Service name without .service suffix")
    status: str = Field(..., description="Service status (running, etc)")
    description: str = Field("", description="Service description")


class ServiceDiscoveryResponse(BaseModel):
    """Response from service discovery."""

    services: list[DiscoveredService] = Field(default_factory=list)
    total: int = Field(..., description="Total services discovered")
    filtered: int = Field(0, description="Services filtered out (system services)")


# =============================================================================
# Network Discovery Schemas (US0041)
# =============================================================================


class DiscoveryRequest(BaseModel):
    """Request to start a network discovery.

    US0073: Network Discovery Key Selection
    """

    subnet: str | None = Field(
        default=None,
        description="Subnet to scan in CIDR notation (e.g., '192.168.1.0/24'). "
        "Uses default from settings if not provided.",
        examples=["192.168.1.0/24", "10.0.0.0/24"],
    )
    key_id: str | None = Field(
        default=None,
        description="SSH key ID to use for authentication. "
        "If not provided, all configured keys are tried.",
        examples=["homelab-key", "work-server"],
    )


class DiscoveryProgress(BaseModel):
    """Progress information for a running discovery."""

    scanned: int = Field(description="Number of IPs scanned")
    total: int = Field(description="Total number of IPs to scan")
    percent: int = Field(description="Progress percentage (0-100)")


class DiscoveryDevice(BaseModel):
    """A discovered device on the network.

    US0073: Network Discovery Key Selection - added ssh_key_used field.
    """

    ip: str = Field(description="IP address of the device")
    hostname: str | None = Field(description="Hostname resolved via reverse DNS, or null")
    response_time_ms: int = Field(description="Response time in milliseconds")
    is_monitored: bool = Field(description="Whether this device is a registered monitored server")
    ssh_auth_status: str = Field(
        default="untested",
        description="SSH auth status: 'untested', 'success', or 'failed'",
    )
    ssh_auth_error: str | None = Field(
        default=None,
        description="SSH auth error message (if status is 'failed')",
    )
    ssh_key_used: str | None = Field(
        default=None,
        description="Name of SSH key that succeeded (if ssh_auth_status is 'success')",
    )


class DiscoveryResponse(BaseModel):
    """Response from discovery API endpoints."""

    discovery_id: int = Field(description="Unique ID of this discovery")
    status: str = Field(description="Current status: pending, running, completed, failed")
    subnet: str = Field(description="Subnet being scanned")
    started_at: str | None = Field(description="When the discovery started")
    completed_at: str | None = Field(description="When the discovery completed")
    progress: DiscoveryProgress | None = Field(
        default=None,
        description="Progress information (only while running)",
    )
    devices_found: int = Field(description="Count of devices found so far")
    devices: list[DiscoveryDevice] | None = Field(
        default=None,
        description="List of discovered devices (only when completed)",
    )
    error: str | None = Field(
        default=None,
        description="Error message if discovery failed",
    )


class DiscoverySettings(BaseModel):
    """Discovery settings configuration."""

    default_subnet: str = Field(
        default="192.168.1.0/24",
        description="Default subnet to scan if not specified in request",
    )
    timeout_ms: int = Field(
        default=500,
        description="Connection timeout in milliseconds",
    )


class DiscoverySettingsUpdate(BaseModel):
    """Request to update discovery settings."""

    default_subnet: str | None = Field(
        default=None,
        description="Default subnet to scan in CIDR notation (e.g., '192.168.1.0/24')",
        examples=["192.168.1.0/24", "10.0.0.0/24"],
    )
    timeout_ms: int | None = Field(
        default=None,
        ge=100,
        le=5000,
        description="Connection timeout in milliseconds (100-5000)",
    )
