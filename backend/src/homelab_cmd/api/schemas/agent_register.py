"""Pydantic schemas for Agent Registration API endpoints.

Secure Agent Architecture: Pull-based installation with per-agent tokens.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class AgentMode(str, Enum):
    """Agent operating mode."""

    READONLY = "readonly"
    READWRITE = "readwrite"


# --- Registration Token Schemas ---


class CreateRegistrationTokenRequest(BaseModel):
    """Request schema for creating a registration token."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "mode": "readonly",
                    "display_name": "Media Server",
                    "monitored_services": ["plex", "sonarr", "radarr"],
                    "expiry_minutes": 15,
                }
            ]
        }
    )

    mode: AgentMode = Field(
        AgentMode.READONLY,
        description="Agent operating mode (readonly for metrics only, readwrite for commands)",
    )
    display_name: str | None = Field(
        None,
        max_length=255,
        description="Human-readable display name for the server",
        examples=["Media Server", "Pi-hole Primary"],
    )
    monitored_services: list[str] | None = Field(
        None,
        description="List of systemd services to monitor",
        examples=[["plex", "sonarr", "radarr"]],
    )
    expiry_minutes: int = Field(
        15,
        ge=5,
        le=60,
        description="Token expiry time in minutes (5-60)",
        examples=[15, 30],
    )


class RegistrationTokenResponse(BaseModel):
    """Response schema for a registration token."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Token ID")
    token_prefix: str = Field(..., description="Token prefix for display (e.g., 'hlh_rt_abc123')")
    mode: str = Field(..., description="Agent operating mode")
    display_name: str | None = Field(None, description="Pre-configured display name")
    monitored_services: list[str] | None = Field(None, description="Pre-configured services")
    expires_at: datetime = Field(..., description="Token expiry timestamp")
    created_at: datetime = Field(..., description="Token creation timestamp")
    is_expired: bool = Field(..., description="Whether the token has expired")
    is_claimed: bool = Field(..., description="Whether the token has been claimed")


class CreateRegistrationTokenResponse(BaseModel):
    """Response schema for creating a registration token (includes plaintext)."""

    token: str = Field(
        ...,
        description="Full plaintext token (shown once, then discarded)",
        examples=["hlh_rt_a1b2c3d4e5f6..."],
    )
    token_prefix: str = Field(
        ...,
        description="Token prefix for future reference",
        examples=["hlh_rt_a1b2c3d4"],
    )
    expires_at: datetime = Field(..., description="Token expiry timestamp")
    install_command: str = Field(
        ...,
        description="One-liner command to run on target server",
        examples=[
            "curl -sSL http://hub:8080/api/v1/agents/register/install.sh | sudo bash -s -- --token hlh_rt_..."
        ],
    )


class RegistrationTokenListResponse(BaseModel):
    """Response schema for listing registration tokens."""

    tokens: list[RegistrationTokenResponse] = Field(
        ..., description="List of pending registration tokens"
    )
    total: int = Field(..., description="Total number of tokens")


# --- Token Claim Schemas ---


class ClaimTokenRequest(BaseModel):
    """Request schema for claiming a registration token."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "token": "hlh_rt_a1b2c3d4e5f6...",
                    "server_id": "media-server",
                    "hostname": "mediaserver.local",
                }
            ]
        }
    )

    token: str = Field(
        ...,
        min_length=40,
        description="Registration token to claim",
        examples=["hlh_rt_a1b2c3d4e5f6..."],
    )
    server_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
        description="Server identifier (slug format)",
        examples=["media-server", "pihole-primary"],
    )
    hostname: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Server hostname",
        examples=["mediaserver.local", "pihole.home"],
    )


class ClaimTokenResponse(BaseModel):
    """Response schema for claiming a registration token."""

    success: bool = Field(..., description="Whether the claim succeeded")
    server_id: str | None = Field(None, description="Server identifier")
    server_guid: str | None = Field(None, description="Server permanent GUID")
    api_token: str | None = Field(
        None,
        description="Per-agent API token (shown once, then discarded)",
        examples=["hlh_ag_a1b2c3d4_..."],
    )
    config_yaml: str | None = Field(
        None,
        description="Complete agent configuration YAML",
    )
    error: str | None = Field(None, description="Error message if failed")


# --- Agent Credential Schemas ---


class AgentCredentialResponse(BaseModel):
    """Response schema for agent credentials."""

    model_config = ConfigDict(from_attributes=True)

    server_guid: str = Field(..., description="Server permanent GUID")
    api_token_prefix: str = Field(..., description="Token prefix for display")
    is_legacy: bool = Field(..., description="Whether using legacy shared API key")
    last_used_at: datetime | None = Field(None, description="Last authentication timestamp")
    is_revoked: bool = Field(..., description="Whether the credential is revoked")
    created_at: datetime = Field(..., description="Credential creation timestamp")


class RotateTokenResponse(BaseModel):
    """Response schema for rotating an agent token."""

    success: bool = Field(..., description="Whether rotation succeeded")
    server_guid: str = Field(..., description="Server permanent GUID")
    api_token: str | None = Field(
        None,
        description="New API token (shown once, then discarded)",
    )
    api_token_prefix: str | None = Field(None, description="New token prefix")
    error: str | None = Field(None, description="Error message if failed")


class RevokeTokenResponse(BaseModel):
    """Response schema for revoking an agent token."""

    success: bool = Field(..., description="Whether revocation succeeded")
    server_guid: str = Field(..., description="Server permanent GUID")
    error: str | None = Field(None, description="Error message if failed")


# --- Auth Info Schema ---


class AuthInfoResponse(BaseModel):
    """Response schema for authentication info."""

    auth_method: str = Field(
        ...,
        description="Authentication method used",
        examples=["per_agent", "legacy"],
    )
    server_guid: str | None = Field(
        None,
        description="Server GUID if using per-agent auth",
    )
    credential_prefix: str | None = Field(
        None,
        description="Credential prefix if using per-agent auth",
    )
