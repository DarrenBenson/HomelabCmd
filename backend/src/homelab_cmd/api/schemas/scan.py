"""Pydantic schemas for Scan API endpoints.

This module defines the schemas for SSH configuration and connection testing:
- SSH settings configuration
- Connection test request/response
- Scan initiation and results
- SSH key management

US0037: SSH Key Configuration
US0038: Scan Initiation
US0071: SSH Key Manager UI
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# =============================================================================
# US0071: SSH Key Management Schemas
# =============================================================================


class SSHKeyMetadata(BaseModel):
    """SSH key metadata (without private key content).

    US0071: SSH Key Manager UI - AC1
    US0072: SSH Key Username Association
    US0093: Unified SSH Key Management - added is_default field
    """

    id: str = Field(description="Key identifier (filename)")
    name: str = Field(description="Key name (filename)")
    type: str = Field(description="Key type (ED25519, RSA, ECDSA)")
    fingerprint: str = Field(description="SHA256 fingerprint of the key")
    created_at: datetime = Field(description="When the key file was created")
    username: str | None = Field(
        default=None,
        description="SSH username associated with this key (uses default if not set)",
    )
    is_default: bool = Field(
        default=False,
        description="Whether this key is the default key for SSH operations",
    )


class SSHKeyListResponse(BaseModel):
    """Response for listing SSH keys.

    US0071: SSH Key Manager UI - AC1
    """

    keys: list[SSHKeyMetadata] = Field(description="List of SSH key metadata")


class SetDefaultKeyResponse(BaseModel):
    """Response for setting default SSH key.

    US0093: Unified SSH Key Management - AC5
    """

    success: bool = Field(description="Whether the operation succeeded")
    message: str = Field(description="Status message")


class SSHKeyUploadRequest(BaseModel):
    """Request for uploading an SSH key.

    US0071: SSH Key Manager UI - AC2
    US0072: SSH Key Username Association
    """

    name: str = Field(
        min_length=1,
        max_length=64,
        description="Key name (will be sanitised to safe characters)",
    )
    private_key: str = Field(
        min_length=1,
        description="SSH private key content (PEM format)",
    )
    username: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="SSH username to use with this key (uses default if not set)",
    )


class SSHConfig(BaseModel):
    """SSH configuration response schema.

    Contains the current SSH settings and discovered keys.
    """

    key_path: str = Field(description="Path to SSH keys directory")
    keys_found: list[str] = Field(description="List of SSH key files found")
    default_username: str = Field(description="Default SSH username")
    default_port: int = Field(description="Default SSH port")


class SSHConfigUpdate(BaseModel):
    """Schema for updating SSH configuration.

    All fields are optional - only provided fields are updated.
    Note: key_path is not updatable (set via environment variable).
    """

    default_username: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="Default SSH username",
    )
    default_port: int | None = Field(
        default=None,
        ge=1,
        le=65535,
        description="Default SSH port",
    )


class SSHConfigResponse(BaseModel):
    """Response for SSH settings update."""

    updated: list[str] = Field(description="List of fields that were updated")
    config: SSHConfig = Field(description="Current SSH configuration")


class TestConnectionRequest(BaseModel):
    """Request schema for testing SSH connection."""

    hostname: str = Field(
        min_length=1,
        max_length=255,
        description="Target hostname or IP address",
    )
    port: int | None = Field(
        default=None,
        ge=1,
        le=65535,
        description="SSH port (defaults to configured default)",
    )
    username: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="SSH username (defaults to configured default)",
    )


class TestConnectionResponse(BaseModel):
    """Response schema for SSH connection test.

    Returns success/failure status with diagnostic information.
    """

    status: str = Field(description="Connection status: 'success' or 'failed'")
    hostname: str = Field(description="Target hostname that was tested")
    remote_hostname: str | None = Field(
        default=None,
        description="Hostname reported by remote system (on success)",
    )
    response_time_ms: int | None = Field(
        default=None,
        description="Connection response time in milliseconds (on success)",
    )
    error: str | None = Field(
        default=None,
        description="Error message (on failure)",
    )


# =============================================================================
# US0038: Scan Initiation Schemas
# =============================================================================


class ScanRequest(BaseModel):
    """Request schema for initiating a scan.

    US0038: Scan Initiation
    """

    hostname: str = Field(
        min_length=1,
        max_length=255,
        description="Target hostname or IP address",
    )
    port: int | None = Field(
        default=None,
        ge=1,
        le=65535,
        description="SSH port (defaults to configured default)",
    )
    username: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="SSH username (defaults to configured default)",
    )
    scan_type: Literal["quick", "full"] = Field(
        default="quick",
        description="Type of scan: 'quick' (basic info) or 'full' (detailed)",
    )


class ScanInitiatedResponse(BaseModel):
    """Response when a scan is successfully initiated.

    US0038: Scan Initiation
    """

    scan_id: int = Field(description="Unique scan identifier")
    status: str = Field(description="Initial scan status (pending or running)")
    hostname: str = Field(description="Target hostname")
    scan_type: str = Field(description="Type of scan (quick or full)")
    started_at: datetime | None = Field(
        default=None,
        description="When the scan started",
    )


class DiskInfo(BaseModel):
    """Disk usage information for a mount point."""

    mount: str = Field(description="Mount point path")
    total_gb: float = Field(description="Total space in GB")
    used_gb: float = Field(description="Used space in GB")
    percent: int = Field(description="Usage percentage")


class MemoryInfo(BaseModel):
    """Memory usage information."""

    total_mb: int = Field(description="Total memory in MB")
    used_mb: int = Field(description="Used memory in MB")
    percent: int = Field(description="Usage percentage")


class OSInfo(BaseModel):
    """Operating system information."""

    name: str | None = Field(default=None, description="OS name (e.g., Ubuntu)")
    version: str | None = Field(default=None, description="OS version (e.g., 22.04)")
    kernel: str | None = Field(default=None, description="Kernel version")
    pretty_name: str | None = Field(default=None, description="Full OS name")
    id: str | None = Field(default=None, description="OS ID (e.g., ubuntu)")


class ProcessInfo(BaseModel):
    """Process information."""

    user: str = Field(description="Process owner")
    pid: int = Field(description="Process ID")
    cpu_percent: float = Field(description="CPU usage percentage")
    mem_percent: float = Field(description="Memory usage percentage")
    command: str = Field(description="Command (truncated)")


class NetworkAddress(BaseModel):
    """Network address information."""

    type: str = Field(description="Address type (ipv4 or ipv6)")
    address: str = Field(description="Address with CIDR notation")


class NetworkInterface(BaseModel):
    """Network interface information."""

    name: str = Field(description="Interface name")
    state: str = Field(description="Interface state (up, down, unknown)")
    addresses: list[NetworkAddress] = Field(
        default_factory=list,
        description="IP addresses assigned",
    )


class PackageInfo(BaseModel):
    """Package information."""

    count: int = Field(description="Total number of packages")
    recent: list[str] = Field(
        default_factory=list,
        description="List of recent packages (up to 50)",
    )


class ScanResults(BaseModel):
    """Scan results structure.

    Quick scan includes: os, hostname, uptime_seconds, disk, memory
    Full scan adds: packages, processes, network_interfaces
    """

    os: OSInfo | dict[str, Any] | None = Field(
        default=None,
        description="Operating system information",
    )
    hostname: str | None = Field(
        default=None,
        description="Hostname reported by the system",
    )
    uptime_seconds: int | None = Field(
        default=None,
        description="System uptime in seconds",
    )
    disk: list[DiskInfo | dict[str, Any]] = Field(
        default_factory=list,
        description="Disk usage by mount point",
    )
    memory: MemoryInfo | dict[str, Any] | None = Field(
        default=None,
        description="Memory usage information",
    )
    packages: PackageInfo | dict[str, Any] | None = Field(
        default=None,
        description="Package information (full scan only)",
    )
    processes: list[ProcessInfo | dict[str, Any]] = Field(
        default_factory=list,
        description="Top processes by memory (full scan only)",
    )
    network_interfaces: list[NetworkInterface | dict[str, Any]] = Field(
        default_factory=list,
        description="Network interfaces (full scan only)",
    )
    errors: list[str] | None = Field(
        default=None,
        description="Errors encountered during scan",
    )


class ScanStatusResponse(BaseModel):
    """Response for scan status/results query.

    US0038: Scan Initiation
    """

    scan_id: int = Field(description="Unique scan identifier")
    status: str = Field(description="Scan status: pending, running, completed, failed")
    hostname: str = Field(description="Target hostname")
    scan_type: str = Field(description="Type of scan (quick or full)")
    progress: int = Field(description="Progress percentage (0-100)")
    current_step: str | None = Field(
        default=None,
        description="Current scan step description",
    )
    started_at: datetime | None = Field(
        default=None,
        description="When the scan started",
    )
    completed_at: datetime | None = Field(
        default=None,
        description="When the scan completed",
    )
    results: ScanResults | None = Field(
        default=None,
        description="Scan results (when completed)",
    )
    error: str | None = Field(
        default=None,
        description="Error message (when failed)",
    )


class ScanListResponse(BaseModel):
    """Response for listing recent scans.

    US0040: Scan History View
    """

    scans: list[ScanStatusResponse] = Field(description="List of scans")
    total: int = Field(description="Total number of scans matching filters")
    limit: int = Field(default=20, description="Page size used")
    offset: int = Field(default=0, description="Offset used for pagination")
