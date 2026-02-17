"""Docker Container API endpoints.

Part of EP0014: Docker Container Monitoring - US0158.

Provides API endpoints for listing Docker containers on servers via SSH.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.containers import (
    ContainerActionResponse,
    ContainerInfo,
    ContainerListResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.container_service import ContainerService
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.ssh_executor import (
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["Containers"])

# Service singletons (lazily initialised)
_ssh_executor: SSHPooledExecutor | None = None
_container_service: ContainerService | None = None


def get_container_service(
    session: AsyncSession = Depends(get_async_session),
) -> ContainerService:
    """Get or create the container service singleton."""
    global _ssh_executor, _container_service
    if _container_service is None:
        settings = get_settings()
        credential_service = CredentialService(session, settings.encryption_key or "")
        host_key_service = HostKeyService(session)
        _ssh_executor = SSHPooledExecutor(credential_service, host_key_service)
        _container_service = ContainerService(_ssh_executor)
    return _container_service


async def get_ssh_username(session: AsyncSession) -> str | None:
    """Get the default SSH username from config.

    Checks the SSH config in the database for a default username.
    Falls back to settings.ssh_default_username if not configured.

    Args:
        session: Database session.

    Returns:
        SSH username or None if not configured.
    """
    settings = get_settings()
    default_username = settings.ssh_default_username

    ssh_config_result = await session.execute(select(Config).where(Config.key == "ssh"))
    ssh_config = ssh_config_result.scalar_one_or_none()
    if ssh_config and ssh_config.value:
        default_username = ssh_config.value.get("default_username", default_username)

    return default_username


@router.get(
    "/{server_id}/containers",
    response_model=ContainerListResponse,
    operation_id="list_server_containers",
    summary="List Docker containers on a server",
    description="""
List all Docker containers (running and stopped) on a server via SSH.

Requires:
- Server must have `has_docker: true`
- Server must have Tailscale hostname configured
- SSH key must be configured in settings

Results are cached for 60 seconds to reduce SSH calls.
Use `refresh=true` to bypass cache.

**Returns:**
- List of containers with id, name, image, state, status, ports
- Containers sorted by state (running first) then name
- `cached: true` if served from cache
- `error` field if fetch failed (still returns 200 with empty list)
""",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def list_containers(
    server_id: str,
    refresh: bool = Query(
        False,
        description="Force refresh, bypassing cache",
    ),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ContainerListResponse:
    """List Docker containers on a server (US0158).

    Executes `docker ps -a` via SSH and returns structured container data.
    Results are cached for 60 seconds per server.
    """
    # 1. Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # 2. Check if Docker is installed
    if not server.has_docker:
        # Return empty list without error if Docker status is unknown (null)
        # Return with message if explicitly false
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error="Docker not installed on this server" if server.has_docker is False else None,
        )

    # 3. Check server has a reachable address for SSH
    hostname = server.tailscale_hostname or server.ip_address or server.hostname
    if not hostname:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_SSH_TARGET",
                "message": f"Server '{server_id}' has no hostname or IP address configured for SSH.",
            },
        )

    # 4. Get SSH username (per-server or global default)
    ssh_username = server.ssh_username or await get_ssh_username(session)

    # 5. Get container service and fetch containers
    service = get_container_service(session)
    try:
        containers, cached, fetched_at, error = await service.list_containers(
            server, force_refresh=refresh, username=ssh_username
        )
        return ContainerListResponse(
            server_id=server_id,
            containers=[ContainerInfo(**c) for c in containers],
            total=len(containers),
            cached=cached,
            fetched_at=fetched_at,
            error=error,
        )
    except SSHKeyNotConfiguredError:
        # Return error response rather than 500
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error="SSH key not configured. Set up SSH in Settings.",
        )
    except SSHConnectionError as e:
        logger.warning("SSH connection failed for %s: %s", server_id, e)
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error=f"SSH connection failed: {e}",
        )
    except SSHAuthenticationError as e:
        logger.warning("SSH authentication failed for %s: %s", server_id, e)
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error=f"SSH authentication failed: {e}",
        )
    except Exception as e:
        # Catch-all for unexpected errors - log and return gracefully
        logger.exception("Unexpected error listing containers for %s", server_id)
        return ContainerListResponse(
            server_id=server_id,
            containers=[],
            total=0,
            cached=False,
            fetched_at=datetime.now(UTC),
            error=f"Unexpected error: {e}",
        )


@router.post(
    "/{server_id}/containers/{container_id}/start",
    response_model=ContainerActionResponse,
    operation_id="start_container",
    summary="Start a Docker container",
    description="""
Start a stopped Docker container on a server via SSH.

Requires:
- Server must have `has_docker: true`
- Server must have Tailscale hostname configured
- SSH key must be configured in settings
- Container must exist on the server

Creates an audit log entry for the action.

**Returns:**
- `success: true` if container started (exit_code=0)
- `output`: Docker command output
- `action`: "start"
""",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def start_container(
    server_id: str,
    container_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ContainerActionResponse:
    """Start a stopped Docker container (US0160).

    Executes `docker start {container_id}` via SSH and creates an audit log entry.
    """
    from homelab_cmd.services.audit_service import create_audit_log

    # 1. Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # 2. Check if Docker is installed
    if not server.has_docker:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "DOCKER_NOT_INSTALLED",
                "message": f"Server '{server_id}' does not have Docker installed",
            },
        )

    # 3. Check server has a reachable address for SSH
    hostname = server.tailscale_hostname or server.ip_address or server.hostname
    if not hostname:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_SSH_TARGET",
                "message": f"Server '{server_id}' has no hostname or IP address configured for SSH",
            },
        )

    # 4. Get SSH username (per-server or global default)
    ssh_username = server.ssh_username or await get_ssh_username(session)

    # 5. Execute container start
    service = get_container_service(session)
    try:
        success, output, exit_code, duration_ms = await service.start_container(
            server, container_id, username=ssh_username
        )

        # 6. Create audit log entry (AC7)
        await create_audit_log(
            db=session,
            server_id=server_id,
            command=f"docker start {container_id}",
            action_type="container_start",
            exit_code=exit_code,
            stdout=output if success else None,
            stderr=output if not success else None,
            duration_ms=duration_ms,
            executed_by="dashboard",
        )

        return ContainerActionResponse(
            success=success,
            output=output,
            container_id=container_id,
            action="start",
        )

    except SSHKeyNotConfiguredError:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SSH_KEY_NOT_CONFIGURED",
                "message": "SSH key not configured. Set up SSH in Settings.",
            },
        ) from None
    except SSHConnectionError as e:
        logger.warning("SSH connection failed for %s: %s", server_id, e)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SSH_CONNECTION_FAILED",
                "message": f"SSH connection failed: {e}",
            },
        ) from None
    except SSHAuthenticationError as e:
        logger.warning("SSH authentication failed for %s: %s", server_id, e)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SSH_AUTHENTICATION_FAILED",
                "message": f"SSH authentication failed: {e}",
            },
        ) from None
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SSH_USERNAME_NOT_CONFIGURED",
                "message": str(e),
            },
        ) from None


@router.post(
    "/{server_id}/containers/{container_id}/stop",
    response_model=ContainerActionResponse,
    operation_id="stop_container",
    summary="Stop a Docker container",
    description="""
Stop a running Docker container on a server via SSH.

Requires:
- Server must have `has_docker: true`
- Server must have Tailscale hostname configured
- SSH key must be configured in settings
- Container must exist on the server

The `timeout` parameter sets the graceful shutdown timeout (default 10 seconds).
Docker will wait this long for the container to stop before forcefully killing it.

Creates an audit log entry for the action.

**Returns:**
- `success: true` if container stopped (exit_code=0)
- `output`: Docker command output
- `action`: "stop"
""",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def stop_container(
    server_id: str,
    container_id: str,
    timeout: int = Query(
        10,
        ge=1,
        le=300,
        description="Graceful shutdown timeout in seconds (default 10)",
    ),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ContainerActionResponse:
    """Stop a running Docker container (US0161).

    Executes `docker stop -t {timeout} {container_id}` via SSH and creates an audit log entry.
    """
    from homelab_cmd.services.audit_service import create_audit_log

    # 1. Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # 2. Check if Docker is installed
    if not server.has_docker:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "DOCKER_NOT_INSTALLED",
                "message": f"Server '{server_id}' does not have Docker installed",
            },
        )

    # 3. Check server has a reachable address for SSH
    hostname = server.tailscale_hostname or server.ip_address or server.hostname
    if not hostname:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_SSH_TARGET",
                "message": f"Server '{server_id}' has no hostname or IP address configured for SSH",
            },
        )

    # 4. Get SSH username (per-server or global default)
    ssh_username = server.ssh_username or await get_ssh_username(session)

    # 5. Execute container stop
    service = get_container_service(session)
    try:
        success, output, exit_code, duration_ms = await service.stop_container(
            server, container_id, timeout_seconds=timeout, username=ssh_username
        )

        # 6. Create audit log entry (AC7)
        await create_audit_log(
            db=session,
            server_id=server_id,
            command=f"docker stop -t {timeout} {container_id}",
            action_type="container_stop",
            exit_code=exit_code,
            stdout=output if success else None,
            stderr=output if not success else None,
            duration_ms=duration_ms,
            executed_by="dashboard",
        )

        return ContainerActionResponse(
            success=success,
            output=output,
            container_id=container_id,
            action="stop",
        )

    except SSHKeyNotConfiguredError:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SSH_KEY_NOT_CONFIGURED",
                "message": "SSH key not configured. Set up SSH in Settings.",
            },
        ) from None
    except SSHConnectionError as e:
        logger.warning("SSH connection failed for %s: %s", server_id, e)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SSH_CONNECTION_FAILED",
                "message": f"SSH connection failed: {e}",
            },
        ) from None
    except SSHAuthenticationError as e:
        logger.warning("SSH authentication failed for %s: %s", server_id, e)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SSH_AUTHENTICATION_FAILED",
                "message": f"SSH authentication failed: {e}",
            },
        ) from None
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SSH_USERNAME_NOT_CONFIGURED",
                "message": str(e),
            },
        ) from None


@router.post(
    "/{server_id}/containers/{container_id}/restart",
    response_model=ContainerActionResponse,
    operation_id="restart_container",
    summary="Restart a Docker container",
    description="""
Restart a Docker container on a server via SSH.

Requires:
- Server must have `has_docker: true`
- Server must have Tailscale hostname configured
- SSH key must be configured in settings
- Container must exist on the server

Creates an audit log entry for the action.

**Returns:**
- `success: true` if container restarted (exit_code=0)
- `output`: Docker command output
- `action`: "restart"
""",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def restart_container(
    server_id: str,
    container_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ContainerActionResponse:
    """Restart a Docker container (US0162).

    Executes `docker restart {container_id}` via SSH and creates an audit log entry.
    """
    from homelab_cmd.services.audit_service import create_audit_log

    # 1. Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # 2. Check if Docker is installed
    if not server.has_docker:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "DOCKER_NOT_INSTALLED",
                "message": f"Server '{server_id}' does not have Docker installed",
            },
        )

    # 3. Check server has a reachable address for SSH
    hostname = server.tailscale_hostname or server.ip_address or server.hostname
    if not hostname:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_SSH_TARGET",
                "message": f"Server '{server_id}' has no hostname or IP address configured for SSH",
            },
        )

    # 4. Get SSH username (per-server or global default)
    ssh_username = server.ssh_username or await get_ssh_username(session)

    # 5. Execute container restart
    service = get_container_service(session)
    try:
        success, output, exit_code, duration_ms = await service.restart_container(
            server, container_id, username=ssh_username
        )

        # 6. Create audit log entry (AC5)
        await create_audit_log(
            db=session,
            server_id=server_id,
            command=f"docker restart {container_id}",
            action_type="container_restart",
            exit_code=exit_code,
            stdout=output if success else None,
            stderr=output if not success else None,
            duration_ms=duration_ms,
            executed_by="dashboard",
        )

        return ContainerActionResponse(
            success=success,
            output=output,
            container_id=container_id,
            action="restart",
        )

    except SSHKeyNotConfiguredError:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SSH_KEY_NOT_CONFIGURED",
                "message": "SSH key not configured. Set up SSH in Settings.",
            },
        ) from None
    except SSHConnectionError as e:
        logger.warning("SSH connection failed for %s: %s", server_id, e)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SSH_CONNECTION_FAILED",
                "message": f"SSH connection failed: {e}",
            },
        ) from None
    except SSHAuthenticationError as e:
        logger.warning("SSH authentication failed for %s: %s", server_id, e)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "SSH_AUTHENTICATION_FAILED",
                "message": f"SSH authentication failed: {e}",
            },
        ) from None
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SSH_USERNAME_NOT_CONFIGURED",
                "message": str(e),
            },
        ) from None
