"""Agent deployment API endpoints.

Provides endpoints for:
- Getting current agent version
- Installing agents on remote devices
- Upgrading existing agents
- Removing agents (mark inactive or delete)
- Re-activating inactive servers

EP0007: Agent Management
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.agent_deploy import (
    AgentInstallRequest,
    AgentInstallResponse,
    AgentRemoveRequest,
    AgentRemoveResponse,
    AgentUpgradeResponse,
    AgentVersionResponse,
    ServerActivateResponse,
)
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.agent_deploy import get_agent_version, get_deployment_service

router = APIRouter(prefix="/agents", tags=["Agent Deployment"])
logger = logging.getLogger(__name__)


@router.get(
    "/version",
    response_model=AgentVersionResponse,
    operation_id="get_agent_version",
    summary="Get current agent version",
    responses={**AUTH_RESPONSES},
)
async def get_version(
    _: str = Depends(verify_api_key),
) -> AgentVersionResponse:
    """Get the current agent version available for deployment."""
    return AgentVersionResponse(version=get_agent_version())


@router.post(
    "/install",
    response_model=AgentInstallResponse,
    operation_id="install_agent",
    summary="Install agent on remote device",
    responses={
        **AUTH_RESPONSES,
        409: {"description": "Server already exists with active agent"},
    },
)
async def install_agent(
    request: AgentInstallRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AgentInstallResponse:
    """Install the monitoring agent on a remote device via SSH.

    The device must be accessible via SSH with key-based authentication.
    A tarball containing the agent and pre-configured settings is transferred
    and installed using the agent's install script.
    """
    service = get_deployment_service(session)

    # US0069: Convert service_config to dict format for service layer
    service_config = None
    if request.service_config:
        service_config = [{"name": svc.name, "core": svc.core} for svc in request.service_config]

    result = await service.install_agent(
        hostname=request.hostname,
        port=request.port,
        username=request.username,
        server_id=request.server_id,
        display_name=request.display_name,
        monitored_services=request.monitored_services,
        service_config=service_config,
        command_execution_enabled=request.command_execution_enabled,
        use_sudo=request.use_sudo,
        sudo_password=request.sudo_password,
    )

    if not result.success and "already exists" in (result.error or ""):
        raise HTTPException(status_code=409, detail=result.error)

    return AgentInstallResponse(
        success=result.success,
        server_id=result.server_id,
        message=result.message,
        error=result.error,
        agent_version=result.agent_version,
    )


@router.post(
    "/{server_id}/upgrade",
    response_model=AgentUpgradeResponse,
    operation_id="upgrade_agent",
    summary="Upgrade agent on existing server",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Server not found"},
    },
)
async def upgrade_agent(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AgentUpgradeResponse:
    """Upgrade the agent on an existing monitored server.

    Stops the agent service, deploys the new version, and restarts the service.
    The existing configuration is preserved.
    """
    service = get_deployment_service(session)
    result = await service.upgrade_agent(server_id)

    if not result.success and "not found" in (result.error or ""):
        raise HTTPException(status_code=404, detail=result.error)

    return AgentUpgradeResponse(
        success=result.success,
        server_id=server_id,
        message=result.message,
        error=result.error,
        agent_version=result.agent_version,
    )


@router.post(
    "/{server_id}/remove",
    response_model=AgentRemoveResponse,
    operation_id="remove_agent",
    summary="Remove agent from server",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Server not found"},
    },
)
async def remove_agent(
    server_id: str,
    request: AgentRemoveRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AgentRemoveResponse:
    """Remove the agent from a server.

    By default, marks the server as inactive (preserving historical data).
    Use delete_completely=true to remove the server and all related data.
    """
    service = get_deployment_service(session)
    result = await service.remove_agent(
        server_id=server_id,
        delete_completely=request.delete_completely,
        ssh_username=request.ssh_username,
        ssh_password=request.ssh_password,
    )

    if not result.success and "not found" in (result.error or ""):
        raise HTTPException(status_code=404, detail=result.error)

    return AgentRemoveResponse(
        success=result.success,
        server_id=server_id,
        message=result.message,
        error=result.error,
    )


@router.put(
    "/{server_id}/activate",
    response_model=ServerActivateResponse,
    operation_id="activate_server",
    summary="Re-activate inactive server",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Server not found"},
    },
)
async def activate_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerActivateResponse:
    """Re-activate an inactive server.

    This is typically done automatically when the agent sends a heartbeat,
    but can also be triggered manually.
    """
    service = get_deployment_service(session)
    result = await service.activate_server(server_id)

    if not result.success and "not found" in (result.error or ""):
        raise HTTPException(status_code=404, detail=result.error)

    return ServerActivateResponse(
        success=result.success,
        server_id=server_id,
        message=result.message,
        error=result.error,
    )
