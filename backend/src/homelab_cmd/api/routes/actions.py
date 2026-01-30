"""Action Queue API endpoints for remediation actions."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import (
    AUTH_RESPONSES,
    CONFLICT_RESPONSE,
    FORBIDDEN_RESPONSE,
    NOT_FOUND_RESPONSE,
)
from homelab_cmd.api.schemas.actions import (
    ActionCreate,
    ActionListResponse,
    ActionResponse,
    ActionType,
    RejectActionRequest,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.remediation import ActionStatus, RemediationAction
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.ssh_executor import SSHPooledExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/actions", tags=["Actions"])

# APT action types that should prevent duplicate actions
APT_ACTION_TYPES = {
    ActionType.APT_UPDATE.value,
    ActionType.APT_UPGRADE_ALL.value,
    ActionType.APT_UPGRADE_SECURITY.value,
}

# Command whitelist - only these action types are allowed
# Note: apt_upgrade_security requires async for database query
# DEBIAN_FRONTEND=noninteractive and Dpkg options ensure non-interactive execution (US0074)
APT_OPTIONS = '-q -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"'
DEBIAN_FRONTEND = "DEBIAN_FRONTEND=noninteractive"

ALLOWED_ACTION_TYPES: dict[str, Callable[[ActionCreate], str]] = {
    ActionType.RESTART_SERVICE.value: lambda data: f"systemctl restart {data.service_name}",
    ActionType.CLEAR_LOGS.value: lambda data: "journalctl --vacuum-time=7d",
    ActionType.APT_UPDATE.value: lambda data: f"{DEBIAN_FRONTEND} apt-get update -q -o APT::Sandbox::User=root",
    ActionType.APT_UPGRADE_ALL.value: lambda data: f"{DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS} -o APT::Sandbox::User=root",
    # apt_upgrade_security is handled separately (async)
}


def _build_command(action_data: ActionCreate) -> str | None:
    """Build the command string from action data.

    Args:
        action_data: The action creation request

    Returns:
        Command string if action_type is whitelisted, None otherwise.
    """
    builder = ALLOWED_ACTION_TYPES.get(action_data.action_type.value)
    if not builder:
        return None
    return builder(action_data)


async def _build_security_upgrade_command(server_id: str, session: AsyncSession) -> str:
    """Build apt install command for security packages only.

    Args:
        server_id: The server to get security packages for
        session: Database session

    Returns:
        Command to install security packages, or echo if none available.
    """
    from homelab_cmd.db.models.pending_package import PendingPackage

    result = await session.execute(
        select(PendingPackage.name).where(
            PendingPackage.server_id == server_id,
            PendingPackage.is_security == True,  # noqa: E712
        )
    )
    security_pkgs = [row[0] for row in result.all()]

    if not security_pkgs:
        return "echo 'No security packages to upgrade'"

    return f"{DEBIAN_FRONTEND} apt-get install {APT_OPTIONS} -o APT::Sandbox::User=root {' '.join(security_pkgs)}"


async def _execute_action_via_ssh(action_id: int) -> None:
    """Execute an approved action via SSH in the background.

    This function runs in the background after an action is approved.
    It connects to the server via SSH, executes the command, and updates
    the action status with the result.

    Args:
        action_id: The ID of the action to execute.
    """
    from homelab_cmd.db.session import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        # Get the action
        action = await session.get(RemediationAction, action_id)
        if not action:
            logger.error("Action %d not found for execution", action_id)
            return

        if action.status != ActionStatus.APPROVED.value:
            logger.warning(
                "Action %d has status %s, expected approved",
                action_id,
                action.status,
            )
            return

        # Get the server
        server = await session.get(Server, action.server_id)
        if not server:
            logger.error("Server %s not found for action %d", action.server_id, action_id)
            action.status = ActionStatus.FAILED.value
            action.completed_at = datetime.now(UTC)
            action.exit_code = -1
            action.stderr = f"Server {action.server_id} not found"
            await session.commit()
            return

        # Mark as executing
        action.status = ActionStatus.EXECUTING.value
        action.executed_at = datetime.now(UTC)
        await session.commit()

        # Create SSH executor
        settings = get_settings()
        credential_service = CredentialService(session, settings.encryption_key or "")
        host_key_service = HostKeyService(session)
        ssh_executor = SSHPooledExecutor(credential_service, host_key_service)

        try:
            # Execute the command (with sudo for apt commands)
            command = action.command
            if command and ("apt-get" in command or "apt " in command):
                command = f"sudo {command}"

            result = await ssh_executor.execute(
                server=server,
                command=command,
                timeout=300,  # 5 minutes for apt operations
            )

            # Update action with result
            action.status = (
                ActionStatus.COMPLETED.value
                if result.exit_code == 0
                else ActionStatus.FAILED.value
            )
            action.completed_at = datetime.now(UTC)
            action.exit_code = result.exit_code
            action.stdout = result.stdout[:10000] if result.stdout else None  # Limit size
            action.stderr = result.stderr[:10000] if result.stderr else None

            logger.info(
                "Action %d completed with exit code %d",
                action_id,
                result.exit_code,
            )

        except Exception as e:
            logger.exception("Failed to execute action %d: %s", action_id, e)
            action.status = ActionStatus.FAILED.value
            action.completed_at = datetime.now(UTC)
            action.exit_code = -1
            action.stderr = str(e)

        await session.commit()


@router.get(
    "",
    response_model=ActionListResponse,
    operation_id="list_actions",
    summary="List remediation actions with optional filtering",
    responses={**AUTH_RESPONSES},
)
async def list_actions(
    status: str | None = Query(None, description="Filter by status"),
    server_id: str | None = Query(None, description="Filter by server ID"),
    action_type: str | None = Query(None, description="Filter by action type"),
    limit: int = Query(50, ge=1, le=100, description="Maximum results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionListResponse:
    """List remediation actions with optional filtering and pagination.

    Returns actions sorted by creation date (newest first).
    """
    # Build base query
    query = select(RemediationAction)

    # Apply filters
    if status:
        query = query.where(RemediationAction.status == status)
    if server_id:
        query = query.where(RemediationAction.server_id == server_id)
    if action_type:
        query = query.where(RemediationAction.action_type == action_type)

    # Get total count before pagination
    count_query = select(func.count()).select_from(RemediationAction)
    if status:
        count_query = count_query.where(RemediationAction.status == status)
    if server_id:
        count_query = count_query.where(RemediationAction.server_id == server_id)
    if action_type:
        count_query = count_query.where(RemediationAction.action_type == action_type)

    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(RemediationAction.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    actions = result.scalars().all()

    return ActionListResponse(
        actions=[ActionResponse.model_validate(a) for a in actions],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{action_id}",
    response_model=ActionResponse,
    operation_id="get_action",
    summary="Get action details by ID",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_action(
    action_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Get action details by ID."""
    action = await session.get(RemediationAction, action_id)

    if not action:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Action {action_id} not found"},
        )

    return ActionResponse.model_validate(action)


@router.post(
    "",
    response_model=ActionResponse,
    status_code=201,
    operation_id="create_action",
    summary="Create a new remediation action",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        **FORBIDDEN_RESPONSE,
        **CONFLICT_RESPONSE,
    },
)
async def create_action(
    action_data: ActionCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Create a new remediation action.

    The action status depends on the server's maintenance mode:
    - Normal servers (is_paused=false): Action is auto-approved
    - Paused servers (is_paused=true): Action requires manual approval

    Returns 403 if the action type/command is not in the whitelist.
    Returns 409 if there's already a pending action for the same server/service.
    """
    # Verify server exists
    server = await session.get(Server, action_data.server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": f"Server '{action_data.server_id}' not found",
            },
        )

    # Reject actions for inactive servers (BG0011)
    if server.is_inactive:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "message": f"Cannot create actions for inactive server '{action_data.server_id}' (agent removed)",
            },
        )

    # Reject actions for readonly agents (BG0017)
    if server.agent_mode == "readonly":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "message": (
                    f"Cannot create actions for server '{action_data.server_id}' "
                    "(agent is in readonly mode). Reinstall agent with --mode readwrite to enable management."
                ),
            },
        )

    # Validate action type and build command from whitelist
    # Handle apt_upgrade_security separately (requires async db query)
    if action_data.action_type == ActionType.APT_UPGRADE_SECURITY:
        command = await _build_security_upgrade_command(action_data.server_id, session)
    else:
        command = _build_command(action_data)
        if not command:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Action type '{action_data.action_type.value}' not in whitelist",
                },
            )

    # Validate service_name for restart_service actions
    if action_data.action_type == ActionType.RESTART_SERVICE and not action_data.service_name:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "service_name is required for restart_service actions",
            },
        )

    # Check for duplicate pending action (same server, service, and pending status)
    if action_data.action_type == ActionType.RESTART_SERVICE:
        existing_result = await session.execute(
            select(RemediationAction).where(
                RemediationAction.server_id == action_data.server_id,
                RemediationAction.service_name == action_data.service_name,
                RemediationAction.status == ActionStatus.PENDING.value,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "CONFLICT",
                    "message": f"Pending action already exists for service '{action_data.service_name}' on server '{action_data.server_id}'",
                },
            )

    # Check for duplicate APT actions (prevent concurrent apt operations)
    if action_data.action_type.value in APT_ACTION_TYPES:
        existing_result = await session.execute(
            select(RemediationAction).where(
                RemediationAction.server_id == action_data.server_id,
                RemediationAction.action_type.in_(APT_ACTION_TYPES),
                RemediationAction.status.in_(
                    [
                        ActionStatus.PENDING.value,
                        ActionStatus.APPROVED.value,
                        ActionStatus.EXECUTING.value,
                    ]
                ),
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "CONFLICT",
                    "message": f"An APT action is already pending/in-progress for server '{action_data.server_id}'",
                },
            )

    # Create the action
    action = RemediationAction(
        server_id=action_data.server_id,
        action_type=action_data.action_type.value,
        service_name=action_data.service_name,
        command=command,
        alert_id=action_data.alert_id,
        created_by="dashboard",
    )

    # Set status based on server maintenance mode
    if server.is_paused:
        action.status = ActionStatus.PENDING.value
    else:
        action.status = ActionStatus.APPROVED.value
        action.approved_at = datetime.now(UTC)
        action.approved_by = "auto"

    session.add(action)
    await session.commit()
    await session.refresh(action)

    # Trigger execution in background for auto-approved actions
    if action.status == ActionStatus.APPROVED.value:
        background_tasks.add_task(_execute_action_via_ssh, action.id)

    return ActionResponse.model_validate(action)


@router.post(
    "/{action_id}/approve",
    response_model=ActionResponse,
    operation_id="approve_action",
    summary="Approve a pending action",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
)
async def approve_action(
    action_id: int,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Approve a pending action for execution (US0026).

    Only actions with status "pending" can be approved.
    Sets approved_at timestamp and approved_by to "dashboard".
    Triggers execution in the background.

    Returns 404 if action not found.
    Returns 409 if action is not in pending status.
    """
    action = await session.get(RemediationAction, action_id)

    if not action:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Action {action_id} not found"},
        )

    if action.status != ActionStatus.PENDING.value:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "message": f"Cannot approve action with status '{action.status}' (must be pending)",
            },
        )

    # Update status and audit fields (US0026 - AC1, AC4)
    action.status = ActionStatus.APPROVED.value
    action.approved_at = datetime.now(UTC)
    action.approved_by = "dashboard"

    await session.commit()

    # Trigger execution in background
    background_tasks.add_task(_execute_action_via_ssh, action.id)

    return ActionResponse.model_validate(action)


@router.post(
    "/{action_id}/reject",
    response_model=ActionResponse,
    operation_id="reject_action",
    summary="Reject a pending action",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
)
async def reject_action(
    action_id: int,
    request: RejectActionRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Reject a pending action with a reason (US0026).

    Only actions with status "pending" can be rejected.
    Requires a reason for rejection.
    Sets rejected_at timestamp and rejected_by to "dashboard".

    Returns 404 if action not found.
    Returns 409 if action is not in pending status.
    Returns 422 if reason is not provided.
    """
    action = await session.get(RemediationAction, action_id)

    if not action:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Action {action_id} not found"},
        )

    if action.status != ActionStatus.PENDING.value:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "message": f"Cannot reject action with status '{action.status}' (must be pending)",
            },
        )

    # Update status and audit fields (US0026 - AC2)
    action.status = ActionStatus.REJECTED.value
    action.rejected_at = datetime.now(UTC)
    action.rejected_by = "dashboard"
    action.rejection_reason = request.reason

    await session.flush()
    return ActionResponse.model_validate(action)


@router.post(
    "/{action_id}/cancel",
    response_model=ActionResponse,
    operation_id="cancel_action",
    summary="Cancel a pending or approved action",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
)
async def cancel_action(
    action_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Cancel an action that hasn't started executing yet.

    Only actions with status "pending" or "approved" can be cancelled.
    Sets status to "failed" with a cancellation message.
    """
    # Get action
    result = await session.execute(
        select(RemediationAction).where(RemediationAction.id == action_id)
    )
    action = result.scalar_one_or_none()

    if not action:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Action {action_id} not found"},
        )

    # Verify action can be cancelled
    cancellable_statuses = [ActionStatus.PENDING.value, ActionStatus.APPROVED.value]
    if action.status not in cancellable_statuses:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "message": f"Cannot cancel action with status '{action.status}' (must be pending or approved)",
            },
        )

    # Update status to failed with cancellation info
    action.status = ActionStatus.FAILED.value
    action.completed_at = datetime.now(UTC)
    action.exit_code = -1
    action.stderr = "Action cancelled by user"

    await session.flush()
    return ActionResponse.model_validate(action)
