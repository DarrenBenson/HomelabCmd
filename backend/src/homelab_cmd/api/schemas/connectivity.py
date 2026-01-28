"""Connectivity settings schemas for US0080.

Defines request/response models for connectivity mode management.
Supports two modes: tailscale (mesh network) and direct_ssh (manual IP).
"""

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Valid connectivity modes
ConnectivityMode = Literal["tailscale", "direct_ssh"]

# SSH username regex: lowercase letter or underscore, followed by up to 31
# lowercase letters, digits, underscores, or hyphens
SSH_USERNAME_PATTERN = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


class TailscaleInfo(BaseModel):
    """Tailscale connection information."""

    configured: bool = Field(
        ..., description="Whether Tailscale API token is configured"
    )
    connected: bool = Field(
        False, description="Whether connected to Tailscale API"
    )
    tailnet: str | None = Field(
        None, description="Tailnet name if connected"
    )
    device_count: int = Field(
        0, description="Number of devices in tailnet"
    )


class SSHInfo(BaseModel):
    """SSH configuration information."""

    username: str = Field(
        "homelabcmd", description="Default SSH username"
    )
    key_configured: bool = Field(
        False, description="Whether SSH private key is uploaded"
    )
    key_uploaded_at: datetime | None = Field(
        None, description="When SSH key was uploaded"
    )


class ConnectivityStatusResponse(BaseModel):
    """Response for GET /api/v1/settings/connectivity."""

    mode: ConnectivityMode = Field(
        ..., description="Current connectivity mode"
    )
    mode_auto_detected: bool = Field(
        False, description="Whether mode was auto-detected vs explicitly set"
    )
    tailscale: TailscaleInfo = Field(
        ..., description="Tailscale connection status"
    )
    ssh: SSHInfo = Field(
        ..., description="SSH configuration status"
    )


class ConnectivityUpdateRequest(BaseModel):
    """Request for PUT /api/v1/settings/connectivity."""

    mode: ConnectivityMode = Field(
        ..., description="Connectivity mode to set"
    )
    ssh_username: str | None = Field(
        None,
        description="SSH username to set (optional, keeps current if not provided)",
        min_length=1,
        max_length=32,
    )

    @field_validator("ssh_username")
    @classmethod
    def validate_ssh_username(cls, v: str | None) -> str | None:
        """Validate SSH username follows Linux conventions."""
        if v is None:
            return v
        if not SSH_USERNAME_PATTERN.match(v):
            msg = (
                "SSH username must start with lowercase letter or underscore, "
                "followed by up to 31 lowercase letters, digits, underscores, "
                "or hyphens"
            )
            raise ValueError(msg)
        return v


class ConnectivityUpdateResponse(BaseModel):
    """Response for PUT /api/v1/settings/connectivity."""

    success: bool = Field(..., description="Whether update succeeded")
    mode: ConnectivityMode = Field(..., description="Current mode after update")
    message: str = Field(..., description="Status message")


class ConnectivityStatusBarResponse(BaseModel):
    """Response for GET /api/v1/settings/connectivity/status (dashboard)."""

    mode: ConnectivityMode = Field(..., description="Current connectivity mode")
    display: str = Field(
        ..., description="Display text for status bar"
    )
    healthy: bool = Field(
        True, description="Whether connectivity is healthy"
    )
