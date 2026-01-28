"""Pydantic schemas for Action API endpoints."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ActionType(str, Enum):
    """Allowed action types for remediation."""

    RESTART_SERVICE = "restart_service"
    CLEAR_LOGS = "clear_logs"
    APT_UPDATE = "apt_update"
    APT_UPGRADE_ALL = "apt_upgrade_all"
    APT_UPGRADE_SECURITY = "apt_upgrade_security"


class ActionCreate(BaseModel):
    """Schema for creating a new action."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "server_id": "omv-mediaserver",
                    "action_type": "restart_service",
                    "service_name": "plex",
                    "alert_id": 15,
                }
            ]
        }
    )

    server_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Server ID to execute action on",
        examples=["omv-mediaserver"],
    )
    action_type: ActionType = Field(
        ...,
        description="Type of action to perform",
        examples=["restart_service"],
    )
    service_name: str | None = Field(
        None,
        max_length=255,
        description="Service name (required for restart_service)",
        examples=["plex", "nginx"],
    )
    alert_id: int | None = Field(
        None,
        ge=1,
        description="Optional ID of triggering alert",
        examples=[15],
    )


class ActionResponse(BaseModel):
    """Schema for action response (full details)."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique action identifier")
    server_id: str = Field(..., description="Server ID")
    action_type: str = Field(..., description="Type of action")
    status: str = Field(..., description="Current status")
    service_name: str | None = Field(None, description="Service name for restart actions")
    command: str = Field(..., description="Command to execute")
    alert_id: int | None = Field(None, description="Triggering alert ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    created_by: str = Field(..., description="Who created the action")
    approved_at: datetime | None = Field(None, description="Approval timestamp")
    approved_by: str | None = Field(None, description="Who approved the action")
    rejected_at: datetime | None = Field(None, description="Rejection timestamp")
    rejected_by: str | None = Field(None, description="Who rejected the action")
    rejection_reason: str | None = Field(None, description="Rejection reason")
    executed_at: datetime | None = Field(None, description="Execution start timestamp")
    completed_at: datetime | None = Field(None, description="Completion timestamp")
    exit_code: int | None = Field(None, description="Command exit code")
    stdout: str | None = Field(None, description="Command standard output")
    stderr: str | None = Field(None, description="Command standard error")


class ActionListResponse(BaseModel):
    """Schema for paginated action list response."""

    actions: list[ActionResponse] = Field(..., description="List of actions")
    total: int = Field(..., ge=0, description="Total number of matching actions")
    limit: int = Field(..., ge=1, description="Page size limit")
    offset: int = Field(..., ge=0, description="Page offset")


class RejectActionRequest(BaseModel):
    """Schema for rejecting an action (US0026)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "reason": "Not needed - service recovered automatically",
                }
            ]
        }
    )

    reason: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Reason for rejection",
        examples=["Not needed - service recovered automatically"],
    )
