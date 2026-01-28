"""SSH API schemas.

Part of EP0008: Tailscale Integration.
US0093: Cleaned up deprecated single-key management schemas.
Key management schemas now in schemas/scan.py (SSHKeyMetadata, etc.).
"""

from pydantic import BaseModel, Field


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
