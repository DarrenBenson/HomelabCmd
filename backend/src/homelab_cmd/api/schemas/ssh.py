"""SSH settings API schemas.

Part of EP0008: Tailscale Integration (US0079).
"""

from datetime import datetime

from pydantic import BaseModel, Field


class SSHKeyUploadResponse(BaseModel):
    """Response after uploading SSH private key.

    AC2: SSH key encrypted storage.
    """

    success: bool
    message: str
    key_type: str = Field(..., description="SSH key type (e.g., ssh-ed25519, RSA-4096)")
    fingerprint: str = Field(..., description="SHA256 fingerprint of the key")


class SSHKeyStatusResponse(BaseModel):
    """Response for SSH configuration status.

    GET /api/v1/settings/ssh/status
    """

    configured: bool = Field(..., description="Whether an SSH key is configured")
    key_type: str | None = Field(None, description="SSH key type if configured")
    fingerprint: str | None = Field(None, description="SHA256 fingerprint if configured")
    uploaded_at: datetime | None = Field(None, description="When the key was uploaded")
    username: str = Field(..., description="Default SSH username")


class SSHUsernameRequest(BaseModel):
    """Request to update default SSH username."""

    username: str = Field(..., min_length=1, max_length=100, description="Default SSH username")


class SSHUsernameResponse(BaseModel):
    """Response after updating SSH username."""

    success: bool
    message: str


class SSHKeyDeleteResponse(BaseModel):
    """Response after deleting SSH key."""

    success: bool
    message: str


class SSHTestRequest(BaseModel):
    """Request body for test-ssh endpoint (optional)."""

    username: str | None = Field(None, description="Override default username for this test")


class SSHTestResponse(BaseModel):
    """Response from test-ssh endpoint.

    AC5: Connection health check endpoint.
    """

    success: bool
    hostname: str
    latency_ms: int | None = Field(None, description="Connection latency in milliseconds")
    host_key_fingerprint: str | None = Field(None, description="SHA256 fingerprint of host key")
    error: str | None = Field(None, description="Error message if connection failed")
    attempts: int = Field(1, description="Number of connection attempts made")


class SSHHostKeyAcceptRequest(BaseModel):
    """Request to accept a changed host key."""

    accept: bool = Field(..., description="Whether to accept the new host key")


class SSHHostKeyAcceptResponse(BaseModel):
    """Response after accepting/rejecting a changed host key."""

    success: bool
    message: str
