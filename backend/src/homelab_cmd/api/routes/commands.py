"""Synchronous Command Execution API.

Part of EP0013: Synchronous Command Execution - US0153.
Extended by US0156: Real-Time Command Output Streaming.

Provides synchronous and streaming API endpoints for executing whitelisted
commands on servers via SSH.
"""

from __future__ import annotations

import json
import logging
import re
import time
from collections import defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.commands import CommandExecuteRequest, CommandExecuteResponse
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.models.service import ExpectedService
from homelab_cmd.db.session import get_async_session, get_session_factory
from homelab_cmd.services.audit_service import create_audit_log
from homelab_cmd.services.command_whitelist import is_whitelisted
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.progress_parser import is_progress_relevant, parse_apt_progress
from homelab_cmd.services.ssh_executor import (
    CommandTimeoutError,
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["Commands"])

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 10  # Max requests per window
RATE_LIMIT_WINDOW_SECONDS = 60  # Window size in seconds

# In-memory rate limit store: {api_key: [timestamp1, timestamp2, ...]}
_rate_limit_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(api_key: str) -> tuple[bool, int]:
    """Check if request is within rate limit.

    Args:
        api_key: The API key making the request.

    Returns:
        Tuple of (allowed, retry_after_seconds).
        If allowed is False, retry_after_seconds indicates when to retry.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS

    # Clean old entries (get with default for patched tests)
    timestamps = _rate_limit_store.get(api_key, [])
    _rate_limit_store[api_key] = [t for t in timestamps if t > window_start]

    # Check limit
    if len(_rate_limit_store[api_key]) >= RATE_LIMIT_REQUESTS:
        oldest_in_window = min(_rate_limit_store[api_key])
        retry_after = int(oldest_in_window + RATE_LIMIT_WINDOW_SECONDS - now) + 1
        return False, max(1, retry_after)

    # Add current request
    _rate_limit_store[api_key].append(now)
    return True, 0


# SSH executor singleton (lazily initialized)
_ssh_executor: SSHPooledExecutor | None = None


async def get_ssh_executor() -> SSHPooledExecutor:
    """Get or create SSH executor instance."""
    global _ssh_executor
    if _ssh_executor is None:
        credential_service = CredentialService()
        host_key_service = HostKeyService()
        _ssh_executor = SSHPooledExecutor(credential_service, host_key_service)
    return _ssh_executor


@router.post(
    "/{server_id}/commands/execute",
    response_model=CommandExecuteResponse,
    operation_id="execute_command",
    summary="Execute a whitelisted command on a server",
    description="""
Execute a command on a server via SSH and receive immediate results.

Commands must be whitelisted - only approved action types are allowed.
Rate limited to 10 requests per minute per API key.

**Action Types:**
- `restart_service`: Restart a systemd service (e.g., `systemctl restart nginx`)
- `apply_updates`: Apply system updates
- `clear_logs`: Clear old log entries

**Error Codes:**
- 400: Command not whitelisted
- 404: Server not found
- 408: Command execution timeout
- 429: Rate limit exceeded
- 500: SSH connection or execution error
""",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "Command not whitelisted",
            "content": {
                "application/json": {
                    "example": {"detail": "Command not in whitelist for action type 'unknown'"}
                }
            },
        },
        408: {
            "description": "Command execution timeout",
            "content": {
                "application/json": {
                    "example": {"detail": "Command timed out after 30 seconds"}
                }
            },
        },
        429: {
            "description": "Rate limit exceeded",
            "content": {
                "application/json": {
                    "example": {"detail": "Rate limit exceeded. Try again in 60 seconds."}
                }
            },
        },
        500: {
            "description": "SSH execution error",
            "content": {
                "application/json": {
                    "example": {"detail": "SSH connection failed: Connection refused"}
                }
            },
        },
    },
)
async def execute_command(
    server_id: str,
    request: CommandExecuteRequest,
    session: AsyncSession = Depends(get_async_session),
    api_key: str = Depends(verify_api_key),
) -> CommandExecuteResponse:
    """Execute a whitelisted command on a server.

    Args:
        server_id: The server ID to execute the command on.
        request: Command execution request with command and action_type.
        session: Database session.
        api_key: Authenticated API key.

    Returns:
        CommandExecuteResponse with exit_code, stdout, stderr, duration_ms.

    Raises:
        HTTPException: For various error conditions (see status codes).
    """
    # Check rate limit
    allowed, retry_after = _check_rate_limit(api_key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # Get server from database
    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=404,
            detail=f"Server '{server_id}' not found",
        )

    # Validate command against whitelist (US0154)
    if not is_whitelisted(request.command, request.action_type):
        logger.warning(
            "Blocked non-whitelisted command for server=%s, action_type=%s",
            server_id,
            request.action_type,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Command not in whitelist for action type '{request.action_type}'",
        )

    # Get default SSH username from config (stored with SSH key)
    settings = get_settings()
    default_username = settings.ssh_default_username
    ssh_config_result = await session.execute(select(Config).where(Config.key == "ssh"))
    ssh_config = ssh_config_result.scalar_one_or_none()
    if ssh_config and ssh_config.value:
        default_username = ssh_config.value.get("default_username", default_username)

    # Execute command via SSH (US0151)
    try:
        executor = await get_ssh_executor()
        cmd_result = await executor.execute(
            server=server,
            command=request.command,
            timeout=30,
            username=default_username,
        )

        # US0185: Set last_restart_at for service restart commands
        if request.action_type == "restart_service" and cmd_result.exit_code == 0:
            # Extract service name from command (e.g., "systemctl restart nginx")
            match = re.search(r"systemctl\s+restart\s+(\S+)", request.command)
            if match:
                service_name = match.group(1)
                expected_svc_result = await session.execute(
                    select(ExpectedService).where(
                        ExpectedService.server_id == server_id,
                        ExpectedService.service_name == service_name,
                    )
                )
                expected_service = expected_svc_result.scalar_one_or_none()
                if expected_service:
                    expected_service.last_restart_at = datetime.now(UTC)
                    logger.info(
                        "Set last_restart_at for service %s on %s (grace period started)",
                        service_name,
                        server_id,
                    )

        # US0155: Create audit log entry (fire-and-forget - don't fail command on audit error)
        try:
            await create_audit_log(
                db=session,
                server_id=server_id,
                command=request.command,
                action_type=request.action_type,
                exit_code=cmd_result.exit_code,
                stdout=cmd_result.stdout,
                stderr=cmd_result.stderr,
                duration_ms=cmd_result.duration_ms,
                executed_by="dashboard",
            )
        except Exception as audit_error:
            logger.error(
                "Failed to create audit log for server=%s command=%s: %s",
                server_id,
                request.command,
                audit_error,
            )

        return CommandExecuteResponse(
            exit_code=cmd_result.exit_code,
            stdout=cmd_result.stdout,
            stderr=cmd_result.stderr,
            duration_ms=cmd_result.duration_ms,
        )

    except CommandTimeoutError as e:
        logger.warning(
            "Command timeout on server=%s: %s",
            server_id,
            str(e),
        )
        raise HTTPException(
            status_code=408,
            detail=f"Command timed out after {e.timeout} seconds",
        ) from e

    except SSHKeyNotConfiguredError as e:
        logger.error("SSH key not configured: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="SSH key not configured. Upload a key in Settings > Connectivity.",
        ) from e

    except SSHAuthenticationError as e:
        logger.error(
            "SSH authentication failed for server=%s: %s",
            server_id,
            str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"SSH authentication failed: {e}",
        ) from e

    except SSHConnectionError as e:
        logger.error(
            "SSH connection failed for server=%s: %s",
            server_id,
            str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"SSH connection failed: {e}",
        ) from e

    except ValueError as e:
        # Raised by SSHPooledExecutor for invalid inputs
        logger.error("Invalid command execution request: %s", str(e))
        raise HTTPException(
            status_code=400,
            detail=str(e),
        ) from e

    except Exception as e:
        logger.exception(
            "Unexpected error executing command on server=%s",
            server_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Command execution failed: {e}",
        ) from e


@router.get(
    "/{server_id}/commands/stream",
    response_class=EventSourceResponse,
    operation_id="stream_command",
    summary="Stream command output via Server-Sent Events (US0156)",
    description="""
Stream command output in real-time via Server-Sent Events.

Commands must be whitelisted. Rate limited to 10 requests per minute per API key.
Connection remains open until command completes or times out.

**Event Types:**
- `stdout`: Standard output line(s) from command
- `stderr`: Standard error line(s) from command
- `progress`: Progress percentage and stage (for apt commands)
- `exit`: Final event with exit code and duration

**Example Events:**
```
event: stdout
data: {"text": "Reading package lists...", "ts": "2026-01-31T12:00:00Z"}

event: progress
data: {"percent": 45, "stage": "Downloading packages"}

event: exit
data: {"code": 0, "duration_ms": 5432}
```
""",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "Command not whitelisted",
            "content": {
                "application/json": {
                    "example": {"detail": "Command not in whitelist for action type 'unknown'"}
                }
            },
        },
        429: {
            "description": "Rate limit exceeded",
            "content": {
                "application/json": {
                    "example": {"detail": "Rate limit exceeded. Try again in 60 seconds."}
                }
            },
        },
    },
)
async def stream_command(
    server_id: str,
    command: str = Query(..., min_length=1, description="Shell command to execute"),
    action_type: str = Query(..., min_length=1, description="Action type for whitelist validation"),
    timeout: int = Query(300, ge=10, le=600, description="Maximum execution time in seconds"),
    request: Request = None,
    api_key: str = Depends(verify_api_key),
) -> EventSourceResponse:
    """Stream command output via Server-Sent Events (US0156).

    Args:
        server_id: The server ID to execute the command on.
        command: Shell command to execute.
        action_type: Action type for whitelist validation.
        timeout: Maximum execution time in seconds (default 300).
        request: FastAPI request object.
        api_key: Authenticated API key.

    Returns:
        EventSourceResponse streaming stdout/stderr/progress/exit events.
    """
    # Check rate limit
    allowed, retry_after = _check_rate_limit(api_key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # Validate command against whitelist
    if not is_whitelisted(command, action_type):
        logger.warning(
            "Blocked non-whitelisted streaming command for server=%s, action_type=%s",
            server_id,
            action_type,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Command not in whitelist for action type '{action_type}'",
        )

    # Get server from database and SSH username from config
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(
            select(Server).where(Server.id == server_id)
        )
        server = result.scalar_one_or_none()

        if not server:
            raise HTTPException(
                status_code=404,
                detail=f"Server '{server_id}' not found",
            )

        # Get default SSH username from config (stored with SSH key)
        settings = get_settings()
        default_username = settings.ssh_default_username
        ssh_config_result = await session.execute(select(Config).where(Config.key == "ssh"))
        ssh_config = ssh_config_result.scalar_one_or_none()
        if ssh_config and ssh_config.value:
            default_username = ssh_config.value.get("default_username", default_username)

    logger.info(
        "Starting streaming command execution for server=%s, action_type=%s",
        server_id,
        action_type,
    )

    async def event_generator():
        """Generate SSE events from command output."""
        executor = await get_ssh_executor()
        parse_progress = is_progress_relevant(action_type)
        last_progress_percent = -1

        try:
            async for chunk in executor.execute_streaming(
                server=server,
                command=command,
                timeout=timeout,
                username=default_username,
            ):
                # Check if client disconnected
                if request and await request.is_disconnected():
                    logger.info("Client disconnected during streaming for server=%s", server_id)
                    break

                timestamp = chunk.timestamp.isoformat() + "Z"

                if chunk.type == "stdout":
                    # Yield stdout event
                    yield {
                        "event": "stdout",
                        "data": json.dumps({"text": chunk.data, "ts": timestamp}),
                    }

                    # Parse progress for apt commands
                    if parse_progress:
                        for line in chunk.data.split("\n"):
                            progress = parse_apt_progress(line)
                            if progress and progress.percent > last_progress_percent:
                                last_progress_percent = progress.percent
                                yield {
                                    "event": "progress",
                                    "data": json.dumps({
                                        "percent": progress.percent,
                                        "stage": progress.stage,
                                    }),
                                }

                elif chunk.type == "stderr":
                    yield {
                        "event": "stderr",
                        "data": json.dumps({"text": chunk.data, "ts": timestamp}),
                    }

                elif chunk.type == "exit":
                    # Parse exit data (already JSON formatted)
                    yield {
                        "event": "exit",
                        "data": chunk.data,
                    }

                elif chunk.type == "error":
                    yield {
                        "event": "error",
                        "data": json.dumps({"message": chunk.data, "ts": timestamp}),
                    }

        except SSHKeyNotConfiguredError:
            yield {
                "event": "error",
                "data": json.dumps({
                    "message": "SSH key not configured. Upload a key in Settings > Connectivity.",
                    "ts": datetime.now(UTC).isoformat() + "Z",
                }),
            }

        except SSHAuthenticationError as e:
            yield {
                "event": "error",
                "data": json.dumps({
                    "message": f"SSH authentication failed: {e}",
                    "ts": datetime.now(UTC).isoformat() + "Z",
                }),
            }

        except SSHConnectionError as e:
            yield {
                "event": "error",
                "data": json.dumps({
                    "message": f"SSH connection failed: {e}",
                    "ts": datetime.now(UTC).isoformat() + "Z",
                }),
            }

        except Exception as e:
            logger.exception(
                "Unexpected error in streaming command for server=%s",
                server_id,
            )
            yield {
                "event": "error",
                "data": json.dumps({
                    "message": f"Command execution failed: {e}",
                    "ts": datetime.now(UTC).isoformat() + "Z",
                }),
            }

    return EventSourceResponse(event_generator())
