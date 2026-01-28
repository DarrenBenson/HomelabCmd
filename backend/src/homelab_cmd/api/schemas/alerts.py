"""Pydantic schemas for Alert API endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    """Schema for alert response with full details."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique alert identifier")
    server_id: str = Field(..., description="Associated server identifier")
    server_name: str | None = Field(None, description="Server display name")
    alert_type: str = Field(
        ...,
        description="Alert type (cpu_high, memory_high, disk_high, server_offline)",
    )
    severity: str = Field(..., description="Severity level (critical, high)")
    status: str = Field(..., description="Current status (open, acknowledged, resolved)")
    title: str = Field(..., description="Alert title")
    message: str | None = Field(None, description="Detailed alert message")
    threshold_value: float | None = Field(
        None,
        description="Threshold value that was exceeded",
    )
    actual_value: float | None = Field(
        None,
        description="Actual value that triggered the alert",
    )
    created_at: datetime = Field(..., description="Alert creation timestamp")
    acknowledged_at: datetime | None = Field(
        None,
        description="When the alert was acknowledged",
    )
    resolved_at: datetime | None = Field(None, description="When the alert was resolved")
    auto_resolved: bool = Field(
        False,
        description="True if alert was auto-resolved when condition cleared",
    )
    can_acknowledge: bool = Field(
        True,
        description="Whether the alert can be acknowledged (False if service still down)",
    )
    service_name: str | None = Field(
        None,
        description="Service name for service alerts (extracted from title)",
    )
    can_resolve: bool = Field(
        True,
        description="Whether the alert can be resolved (False if service still down)",
    )


class AlertListResponse(BaseModel):
    """Schema for paginated alert list response."""

    alerts: list[AlertResponse] = Field(..., description="List of alert records")
    total: int = Field(..., description="Total number of matching alerts")
    limit: int = Field(..., description="Maximum results returned")
    offset: int = Field(..., description="Number of results skipped")


class AlertAcknowledgeResponse(BaseModel):
    """Schema for acknowledge action response."""

    id: int = Field(..., description="Alert identifier")
    status: str = Field(..., description="New status (acknowledged)")
    acknowledged_at: datetime = Field(..., description="Acknowledgement timestamp")


class AlertResolveResponse(BaseModel):
    """Schema for resolve action response."""

    id: int = Field(..., description="Alert identifier")
    status: str = Field(..., description="New status (resolved)")
    resolved_at: datetime = Field(..., description="Resolution timestamp")
    auto_resolved: bool = Field(..., description="True if auto-resolved, False if manual")
