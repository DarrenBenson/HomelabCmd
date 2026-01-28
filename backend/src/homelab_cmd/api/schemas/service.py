"""Pydantic schemas for Expected Services API endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExpectedServiceCreate(BaseModel):
    """Schema for creating an expected service."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "service_name": "plex",
                    "display_name": "Plex Media Server",
                    "is_critical": True,
                }
            ]
        }
    )

    service_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        pattern=r"^[a-z0-9@._-]+$",
        description="Systemd service name (lowercase alphanumeric, dots, hyphens, underscores, @)",
        examples=["plex", "docker.service", "pihole-FTL"],
    )
    display_name: str | None = Field(
        None,
        max_length=255,
        description="Human-friendly display name",
        examples=["Plex Media Server"],
    )
    is_critical: bool = Field(
        False,
        description="Whether this service is critical (affects alert severity)",
    )


class ExpectedServiceUpdate(BaseModel):
    """Schema for updating an expected service (all fields optional)."""

    display_name: str | None = Field(
        None,
        max_length=255,
        description="Human-friendly display name",
    )
    is_critical: bool | None = Field(
        None,
        description="Whether this service is critical",
    )
    enabled: bool | None = Field(
        None,
        description="Whether monitoring is enabled for this service",
    )


class ServiceCurrentStatus(BaseModel):
    """Schema for current service status from latest heartbeat."""

    status: str = Field(
        ...,
        description="Service status (running, stopped, failed, unknown)",
    )
    status_reason: str | None = Field(
        None,
        description="Explanation when status is unknown (e.g., 'systemd not available')",
    )
    pid: int | None = Field(
        None,
        description="Process ID if running",
    )
    memory_mb: float | None = Field(
        None,
        description="Memory usage in megabytes",
    )
    cpu_percent: float | None = Field(
        None,
        description="CPU usage percentage",
    )
    last_seen: datetime = Field(
        ...,
        description="Timestamp of last status report",
    )


class ExpectedServiceResponse(BaseModel):
    """Schema for expected service response."""

    model_config = ConfigDict(from_attributes=True)

    service_name: str = Field(..., description="Systemd service name")
    display_name: str | None = Field(None, description="Human-friendly display name")
    is_critical: bool = Field(..., description="Whether service is critical")
    enabled: bool = Field(..., description="Whether monitoring is enabled")
    current_status: ServiceCurrentStatus | None = Field(
        None,
        description="Current status from latest heartbeat (if available)",
    )


class ExpectedServiceListResponse(BaseModel):
    """Schema for expected service list response."""

    services: list[ExpectedServiceResponse] = Field(
        ...,
        description="List of expected services",
    )
    total: int = Field(..., description="Total number of expected services")


class RestartActionResponse(BaseModel):
    """Response after queuing a service restart action."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    action_id: int = Field(
        ...,
        description="Unique action identifier",
        serialization_alias="action_id",
        validation_alias="id",
    )
    action_type: str = Field(
        ...,
        description="Type of action",
        examples=["restart_service"],
    )
    server_id: str = Field(..., description="Server identifier")
    service_name: str = Field(..., description="Service to restart")
    command: str = Field(
        ...,
        description="Command to execute",
        examples=["systemctl restart plex"],
    )
    status: str = Field(
        ...,
        description="Action status",
        examples=["pending"],
    )
    created_at: datetime = Field(..., description="When the action was created")


class DuplicateActionError(BaseModel):
    """Error response when action is already pending."""

    detail: str = Field(
        ...,
        description="Error message",
        examples=["A restart action for this service is already pending"],
    )
    existing_action_id: int = Field(
        ...,
        description="ID of the existing pending action",
    )
