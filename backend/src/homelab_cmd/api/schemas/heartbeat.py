"""Pydantic schemas for Agent Heartbeat API endpoint."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OSInfo(BaseModel):
    """Operating system information from agent."""

    distribution: str | None = Field(
        None,
        max_length=100,
        description="Linux distribution name (e.g., Debian, Ubuntu)",
        examples=["Debian GNU/Linux", "Ubuntu"],
    )
    version: str | None = Field(
        None,
        max_length=100,
        description="Distribution version",
        examples=["12", "22.04"],
    )
    kernel: str | None = Field(
        None,
        max_length=100,
        description="Kernel version string",
        examples=["6.1.0-18-amd64"],
    )
    architecture: str | None = Field(
        None,
        max_length=20,
        description="CPU architecture",
        examples=["x86_64", "aarch64"],
    )


class CPUInfo(BaseModel):
    """CPU information for power profile detection."""

    cpu_model: str | None = Field(
        None,
        max_length=255,
        description="CPU model name (e.g., Intel Core i5-8250U)",
        examples=["Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz", "BCM2711"],
    )
    cpu_cores: int | None = Field(
        None,
        ge=1,
        le=1024,
        description="Number of logical CPU cores",
        examples=[4, 8],
    )


class MetricsPayload(BaseModel):
    """Metrics collected by agent (all fields optional)."""

    cpu_percent: float | None = Field(None, ge=0, le=100, description="CPU usage percentage")
    memory_percent: float | None = Field(None, ge=0, le=100, description="Memory usage percentage")
    memory_total_mb: int | None = Field(None, ge=0, description="Total memory in megabytes")
    memory_used_mb: int | None = Field(None, ge=0, description="Used memory in megabytes")
    disk_percent: float | None = Field(None, ge=0, le=100, description="Root disk usage percentage")
    disk_total_gb: float | None = Field(None, ge=0, description="Total disk space in gigabytes")
    disk_used_gb: float | None = Field(None, ge=0, description="Used disk space in gigabytes")
    network_rx_bytes: int | None = Field(
        None, ge=0, description="Network bytes received since boot"
    )
    network_tx_bytes: int | None = Field(
        None, ge=0, description="Network bytes transmitted since boot"
    )
    load_1m: float | None = Field(None, ge=0, description="1-minute load average")
    load_5m: float | None = Field(None, ge=0, description="5-minute load average")
    load_15m: float | None = Field(None, ge=0, description="15-minute load average")
    uptime_seconds: int | None = Field(None, ge=0, description="System uptime in seconds")


# Maximum size for command output (10KB as per US0025)
MAX_OUTPUT_SIZE = 10000


class CommandResultPayload(BaseModel):
    """Command execution result reported by agent (US0025).

    Included in heartbeat request to report results of executed commands.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "action_id": 42,
                    "exit_code": 0,
                    "stdout": "",
                    "stderr": "",
                    "executed_at": "2026-01-18T10:31:30Z",
                    "completed_at": "2026-01-18T10:31:32Z",
                }
            ]
        }
    )

    action_id: int = Field(
        ...,
        ge=1,
        description="ID of the action that was executed",
        examples=[42],
    )
    exit_code: int = Field(
        ...,
        description="Command exit code (0 = success)",
        examples=[0, 1],
    )
    stdout: str | None = Field(
        None,
        max_length=MAX_OUTPUT_SIZE,
        description="Command standard output (truncated to 10KB)",
        examples=[""],
    )
    stderr: str | None = Field(
        None,
        max_length=MAX_OUTPUT_SIZE,
        description="Command standard error (truncated to 10KB)",
        examples=[""],
    )
    executed_at: datetime = Field(
        ...,
        description="When execution started (ISO8601)",
    )
    completed_at: datetime = Field(
        ...,
        description="When execution completed (ISO8601)",
    )

    @field_validator("stdout", "stderr", mode="before")
    @classmethod
    def truncate_output(cls, v: str | None) -> str | None:
        """Truncate output to MAX_OUTPUT_SIZE to prevent memory issues."""
        if v is not None and len(v) > MAX_OUTPUT_SIZE:
            return v[:MAX_OUTPUT_SIZE]
        return v


class PackageUpdatePayload(BaseModel):
    """Package update information reported by agent (US0051)."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Package name",
        examples=["openssl", "vim"],
    )
    current_version: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Currently installed version",
        examples=["3.0.13-1~deb12u1"],
    )
    new_version: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Available version",
        examples=["3.0.14-1~deb12u1"],
    )
    repository: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Source repository",
        examples=["bookworm-security", "bookworm"],
    )
    is_security: bool = Field(
        ...,
        description="True if from a security repository",
    )


class ServiceStatusPayload(BaseModel):
    """Service status reported by agent (US0018)."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Service name (e.g., plex, nginx)",
        examples=["plex", "sonarr"],
    )
    status: str = Field(
        ...,
        pattern=r"^(running|stopped|failed|unknown)$",
        description="Service status",
        examples=["running", "stopped"],
    )
    status_reason: str | None = Field(
        None,
        max_length=255,
        description="Explanation when status is unknown",
        examples=["systemd not available (container)"],
    )
    pid: int | None = Field(
        None,
        ge=0,
        description="Process ID if service is running",
        examples=[12345],
    )
    memory_mb: float | None = Field(
        None,
        ge=0,
        description="Memory usage in megabytes",
        examples=[512.5],
    )
    cpu_percent: float | None = Field(
        None,
        ge=0,
        le=100,
        description="CPU usage percentage",
        examples=[2.3],
    )


class HeartbeatRequest(BaseModel):
    """Schema for agent heartbeat request."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "server_guid": "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
                    "server_id": "omv-mediaserver",
                    "hostname": "mediaserver.home.lan",
                    "timestamp": "2026-01-19T12:00:00Z",
                    "metrics": {
                        "cpu_percent": 45.2,
                        "memory_percent": 62.5,
                        "disk_percent": 78.3,
                    },
                }
            ]
        }
    )

    # Permanent agent identity (US0070) - optional for backward compatibility
    server_guid: str | None = Field(
        None,
        min_length=36,
        max_length=36,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        description="Agent's permanent UUID v4 (optional for backward compatibility with old agents)",
        examples=["a1b2c3d4-e5f6-4890-abcd-ef1234567890"],
    )
    server_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
        description="User-friendly server identifier (display name)",
        examples=["omv-mediaserver"],
    )
    hostname: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Server hostname",
        examples=["mediaserver.home.lan"],
    )
    timestamp: datetime = Field(
        ...,
        description="Heartbeat timestamp (ISO8601 format)",
    )
    agent_version: str | None = Field(
        None,
        max_length=20,
        description="Agent version string (e.g., 1.0.0)",
        examples=["1.0.0", "1.2.3"],
    )
    agent_mode: str | None = Field(
        None,
        pattern=r"^(readonly|readwrite)$",
        description="Agent operating mode (BG0017): readonly (metrics only) or readwrite (full management)",
        examples=["readonly", "readwrite"],
    )
    os_info: OSInfo | None = Field(
        None,
        description="Operating system information",
    )
    metrics: MetricsPayload | None = Field(
        None,
        description="Current system metrics",
    )
    updates_available: int | None = Field(
        None,
        ge=0,
        description="Number of package updates available",
    )
    security_updates: int | None = Field(
        None,
        ge=0,
        description="Number of security updates available",
    )
    services: list[ServiceStatusPayload] | None = Field(
        None,
        description="Service status collected by agent (US0018)",
    )
    packages: list[PackageUpdatePayload] | None = Field(
        None,
        description="Detailed package update list (US0051)",
    )
    command_results: list[CommandResultPayload] | None = Field(
        None,
        description="Results of executed commands (US0025)",
    )
    cpu_info: CPUInfo | None = Field(
        None,
        description="CPU information for power profile detection",
    )


class PendingCommand(BaseModel):
    """Pending command to be executed by agent (US0025).

    Included in heartbeat response to deliver approved actions.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "action_id": 43,
                    "action_type": "restart_service",
                    "command": "systemctl restart plex",
                    "parameters": {"service_name": "plex"},
                    "timeout_seconds": 30,
                }
            ]
        }
    )

    action_id: int = Field(
        ...,
        ge=1,
        description="ID of the action to execute",
        examples=[43],
    )
    action_type: str = Field(
        ...,
        description="Type of action (e.g., restart_service, clear_logs)",
        examples=["restart_service"],
    )
    command: str = Field(
        ...,
        description="Shell command to execute",
        examples=["systemctl restart plex"],
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Action-specific parameters",
        examples=[{"service_name": "plex"}],
    )
    timeout_seconds: int = Field(
        30,
        ge=1,
        le=600,
        description="Command timeout in seconds",
        examples=[30],
    )


class HeartbeatResponse(BaseModel):
    """Schema for heartbeat response."""

    status: str = Field("ok", description="Response status (ok)")
    server_registered: bool = Field(
        False,
        description="True if server was auto-registered on this heartbeat",
    )
    pending_commands: list[PendingCommand] = Field(
        default_factory=list,
        description="List of pending commands for agent to execute (US0025)",
    )
    results_acknowledged: list[int] = Field(
        default_factory=list,
        description="Action IDs whose results were acknowledged (US0025)",
    )
