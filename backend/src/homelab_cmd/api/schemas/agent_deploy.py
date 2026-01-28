"""Pydantic schemas for Agent Deployment API endpoints.

EP0007: Agent Management
US0069: Service Discovery During Agent Installation
"""

from pydantic import BaseModel, ConfigDict, Field


class ServiceConfig(BaseModel):
    """Service configuration for monitoring with core/standard classification."""

    name: str = Field(..., description="Service name")
    core: bool = Field(False, description="True = critical alerts, False = warning alerts")


class AgentVersionResponse(BaseModel):
    """Response schema for agent version endpoint."""

    version: str = Field(..., description="Current agent version", examples=["1.0.0"])


class AgentInstallRequest(BaseModel):
    """Request schema for installing agent on a remote device."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "hostname": "192.168.1.100",
                    "port": 22,
                    "username": "darren",
                    "server_id": "media-server",
                    "display_name": "Media Server",
                    "monitored_services": ["plex", "sonarr", "radarr"],
                    "command_execution_enabled": True,
                    "use_sudo": True,
                }
            ]
        }
    )

    hostname: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Target hostname or IP address",
        examples=["192.168.1.100", "mediaserver.local"],
    )
    port: int = Field(
        22,
        ge=1,
        le=65535,
        description="SSH port number",
        examples=[22],
    )
    username: str | None = Field(
        None,
        max_length=100,
        description="SSH username (uses default if not specified)",
        examples=["darren", "root"],
    )
    server_id: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
        description="Server identifier (generated from hostname if not provided)",
        examples=["media-server", "pihole-primary"],
    )
    display_name: str | None = Field(
        None,
        max_length=255,
        description="Human-readable display name",
        examples=["Media Server", "Pi-hole Primary"],
    )
    monitored_services: list[str] | None = Field(
        None,
        description="Services to monitor on the target device (simple list, backward compat)",
        examples=[["plex", "sonarr", "radarr"]],
    )
    service_config: list[ServiceConfig] | None = Field(
        None,
        description="Services with core/standard classification (US0069)",
    )
    command_execution_enabled: bool = Field(
        False,
        description="Enable remote command execution on the agent",
    )
    use_sudo: bool = Field(
        False,
        description="Use sudo for command execution",
    )
    sudo_password: str | None = Field(
        None,
        description="Sudo password for installation (required if user needs password for sudo)",
    )


class AgentInstallResponse(BaseModel):
    """Response schema for agent installation."""

    success: bool = Field(..., description="Whether installation succeeded")
    server_id: str | None = Field(None, description="Server identifier")
    message: str = Field("", description="Status message")
    error: str | None = Field(None, description="Error message if failed")
    agent_version: str | None = Field(None, description="Installed agent version")


class AgentUpgradeResponse(BaseModel):
    """Response schema for agent upgrade."""

    success: bool = Field(..., description="Whether upgrade succeeded")
    server_id: str = Field(..., description="Server identifier")
    message: str = Field("", description="Status message")
    error: str | None = Field(None, description="Error message if failed")
    agent_version: str | None = Field(None, description="New agent version")


class AgentRemoveRequest(BaseModel):
    """Request schema for removing an agent."""

    delete_completely: bool = Field(
        False,
        description="If true, delete server from database. If false, mark as inactive.",
    )
    ssh_username: str | None = Field(
        None,
        max_length=100,
        description="Optional SSH username for password authentication",
        examples=["darren", "root"],
    )
    ssh_password: str | None = Field(
        None,
        max_length=255,
        description="Optional SSH password for password authentication",
        examples=["example-password"],
    )


class AgentRemoveResponse(BaseModel):
    """Response schema for agent removal."""

    success: bool = Field(..., description="Whether removal succeeded")
    server_id: str = Field(..., description="Server identifier")
    message: str = Field("", description="Status message")
    error: str | None = Field(None, description="Error message if failed")


class ServerActivateResponse(BaseModel):
    """Response schema for activating an inactive server."""

    success: bool = Field(..., description="Whether activation succeeded")
    server_id: str = Field(..., description="Server identifier")
    message: str = Field("", description="Status message")
    error: str | None = Field(None, description="Error message if failed")
