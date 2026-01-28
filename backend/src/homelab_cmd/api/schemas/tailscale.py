"""Pydantic schemas for Tailscale API endpoints.

Part of EP0008: Tailscale Integration (US0076, US0077).

This module defines the request/response schemas for:
- Token configuration (save/remove)
- Connection testing
- Configuration status
- Device discovery (US0077)
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TailscaleTokenRequest(BaseModel):
    """Request to save a Tailscale API token.

    The token is validated to be non-empty. Format validation is
    deferred to the Tailscale API (which will return 401 for invalid tokens).
    """

    token: str = Field(..., min_length=1, description="Tailscale API token")


class TailscaleTokenResponse(BaseModel):
    """Response after saving or removing a Tailscale token."""

    success: bool
    message: str


class TailscaleTestResponse(BaseModel):
    """Response from testing Tailscale API connection.

    On success: success=True, tailnet and device_count populated.
    On failure: success=False, error and code populated.
    """

    success: bool
    tailnet: str | None = None
    device_count: int | None = None
    message: str | None = None
    error: str | None = None
    code: str | None = None


class TailscaleStatusResponse(BaseModel):
    """Response showing current Tailscale configuration status.

    If configured, shows masked token (first 8 chars + "...").
    """

    configured: bool
    masked_token: str | None = None


# =============================================================================
# Device Discovery Schemas (US0077)
# =============================================================================


class TailscaleDeviceSchema(BaseModel):
    """Schema for a single Tailscale device.

    Part of US0077: Tailscale Device Discovery.
    """

    id: str = Field(..., description="Tailscale device ID")
    name: str = Field(..., description="Device name in Tailscale")
    hostname: str = Field(..., description="Full Tailscale hostname (e.g., host.tailnet.ts.net)")
    tailscale_ip: str = Field(..., description="Tailscale IPv4 address (100.x.x.x)")
    os: str = Field(..., description="Operating system (linux, windows, macos, ios, android)")
    os_version: str | None = Field(None, description="Tailscale client version")
    last_seen: datetime = Field(..., description="Last time device was seen")
    online: bool = Field(..., description="Whether device is currently online")
    authorized: bool = Field(..., description="Whether device is authorized in tailnet")
    already_imported: bool = Field(
        False, description="Whether device is already registered as a HomelabCmd server"
    )


class TailscaleDeviceListResponse(BaseModel):
    """Response for device list endpoint.

    Part of US0077: Tailscale Device Discovery.
    """

    devices: list[TailscaleDeviceSchema] = Field(..., description="List of Tailscale devices")
    count: int = Field(..., description="Number of devices in the list")
    cache_hit: bool = Field(..., description="Whether the response was served from cache")
    cached_at: datetime | None = Field(
        None, description="When the cache was populated (None if not cached)"
    )


# =============================================================================
# Device Import Schemas (US0078)
# =============================================================================


class TailscaleImportRequest(BaseModel):
    """Request to import a Tailscale device as a server.

    Part of US0078: Machine Registration via Tailscale.
    """

    tailscale_device_id: str = Field(..., description="Tailscale device ID")
    tailscale_hostname: str = Field(..., description="Full Tailscale hostname")
    tailscale_ip: str = Field(..., description="Tailscale IP address")
    os: str = Field(..., description="Operating system")
    display_name: str = Field(
        ..., min_length=1, max_length=100, description="Display name for the server"
    )
    machine_type: Literal["server", "workstation"] = Field("server", description="Machine type")
    tdp: int | None = Field(None, gt=0, description="TDP in watts (optional, must be positive)")
    category_id: str | None = Field(None, description="Machine category ID (optional)")


class TailscaleImportedMachine(BaseModel):
    """Imported machine details returned after successful import.

    Part of US0078: Machine Registration via Tailscale.
    """

    id: str = Field(..., description="Server ID (slug format)")
    server_id: str = Field(..., description="Server ID (same as id)")
    display_name: str = Field(..., description="Display name")
    tailscale_hostname: str = Field(..., description="Tailscale hostname")
    tailscale_device_id: str = Field(..., description="Tailscale device ID")
    machine_type: str = Field(..., description="Machine type (server/workstation)")
    status: str = Field(..., description="Server status")
    created_at: datetime = Field(..., description="Creation timestamp")


class TailscaleImportResponse(BaseModel):
    """Response after successfully importing a Tailscale device.

    Part of US0078: Machine Registration via Tailscale.
    """

    success: bool = True
    machine: TailscaleImportedMachine
    message: str


class TailscaleImportCheckResponse(BaseModel):
    """Response for import check endpoint.

    Part of US0078: Machine Registration via Tailscale.
    """

    imported: bool = Field(..., description="Whether the device is already imported")
    machine_id: str | None = Field(None, description="Machine ID if imported")
    display_name: str | None = Field(None, description="Display name if imported")
    imported_at: datetime | None = Field(None, description="Import timestamp if imported")


# =============================================================================
# SSH Testing Schemas (EP0016)
# =============================================================================


class TailscaleSSHTestRequest(BaseModel):
    """Request to test SSH connection to a Tailscale device.

    EP0016: Unified Discovery Experience (US0096).
    """

    key_id: str | None = Field(None, description="Specific SSH key ID to test (optional)")


class TailscaleSSHTestResponse(BaseModel):
    """Response from SSH connection test.

    EP0016: Unified Discovery Experience (US0096).
    """

    success: bool = Field(..., description="Whether SSH connection succeeded")
    latency_ms: int | None = Field(None, description="Connection latency in milliseconds")
    key_used: str | None = Field(None, description="Name of SSH key that succeeded")
    error: str | None = Field(None, description="Error message if connection failed")


class TailscaleDeviceWithSSHSchema(TailscaleDeviceSchema):
    """Device schema with SSH status.

    EP0016: Unified Discovery Experience (US0097).
    """

    ssh_status: Literal["available", "unavailable", "untested"] = Field(
        "untested", description="SSH connectivity status"
    )
    ssh_error: str | None = Field(None, description="SSH error message if unavailable")
    ssh_key_used: str | None = Field(None, description="Name of SSH key that succeeded")


class TailscaleDeviceListWithSSHResponse(BaseModel):
    """Response for device list with SSH testing.

    EP0016: Unified Discovery Experience (US0097).
    """

    devices: list[TailscaleDeviceWithSSHSchema] = Field(
        ..., description="List of Tailscale devices with SSH status"
    )
    count: int = Field(..., description="Number of devices in the list")
    cache_hit: bool = Field(..., description="Whether the response was served from cache")
    cached_at: datetime | None = Field(
        None, description="When the cache was populated (None if not cached)"
    )
