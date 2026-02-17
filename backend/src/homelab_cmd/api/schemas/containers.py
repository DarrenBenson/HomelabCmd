"""Pydantic schemas for Docker container API endpoints (US0158 - EP0014)."""

from datetime import datetime

from pydantic import BaseModel, Field


class ContainerInfo(BaseModel):
    """Individual Docker container information."""

    id: str = Field(..., description="Short container ID (12 chars)")
    name: str = Field(..., description="Container name")
    image: str = Field(..., description="Image name with tag")
    state: str = Field(
        ...,
        description="Container state: running, exited, created, paused, restarting, dead",
    )
    status: str = Field(..., description="Human-readable status from Docker")
    ports: str | None = Field(None, description="Port mappings")
    created_at: str | None = Field(None, description="Container creation timestamp")
    uptime_seconds: int | None = Field(
        None, description="Uptime in seconds (only for running containers)"
    )


class ContainerListResponse(BaseModel):
    """Response for container listing endpoint (US0158)."""

    server_id: str = Field(..., description="Server identifier")
    containers: list[ContainerInfo] = Field(
        default_factory=list, description="List of containers"
    )
    total: int = Field(..., description="Total container count")
    cached: bool = Field(False, description="Whether response was served from cache")
    fetched_at: datetime = Field(..., description="When data was fetched/cached")
    error: str | None = Field(None, description="Error message if fetch failed")


class ContainerActionResponse(BaseModel):
    """Response for container action endpoints (US0160-US0162)."""

    success: bool = Field(..., description="Whether the action succeeded (exit_code == 0)")
    output: str | None = Field(None, description="Docker command output (stdout or stderr)")
    container_id: str = Field(..., description="Container ID or name that was acted upon")
    action: str = Field(..., description="Action performed: start, stop, restart")
