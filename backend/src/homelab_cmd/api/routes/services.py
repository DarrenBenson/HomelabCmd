"""Expected Services API endpoints."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, CONFLICT_RESPONSE, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.service import (
    DuplicateActionError,
    ExpectedServiceCreate,
    ExpectedServiceListResponse,
    ExpectedServiceResponse,
    ExpectedServiceUpdate,
    RestartActionResponse,
    ServiceCurrentStatus,
)
from homelab_cmd.db.models.remediation import ActionStatus, RemediationAction
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.models.service import ExpectedService, ServiceStatus
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.agent_config_sync import sync_services_to_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["Services"])


@router.get(
    "/{server_id}/services",
    response_model=ExpectedServiceListResponse,
    operation_id="list_server_services",
    summary="List expected services for a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def list_server_services(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ExpectedServiceListResponse:
    """List all expected services for a server.

    Returns expected services with their current status from the latest heartbeat.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Query all expected services for this server
    result = await session.execute(
        select(ExpectedService).where(ExpectedService.server_id == server_id)
    )
    services = result.scalars().all()

    # Build response with current status for each service
    service_responses = []
    for svc in services:
        response = ExpectedServiceResponse(
            service_name=svc.service_name,
            display_name=svc.display_name,
            is_critical=svc.is_critical,
            enabled=svc.enabled,
            current_status=None,
        )

        # Query latest ServiceStatus for this service
        status_result = await session.execute(
            select(ServiceStatus)
            .where(
                and_(
                    ServiceStatus.server_id == server_id,
                    ServiceStatus.service_name == svc.service_name,
                )
            )
            .order_by(desc(ServiceStatus.timestamp))
            .limit(1)
        )
        latest_status = status_result.scalar_one_or_none()

        if latest_status:
            response.current_status = ServiceCurrentStatus(
                status=latest_status.status,
                status_reason=latest_status.status_reason,
                pid=latest_status.pid,
                memory_mb=latest_status.memory_mb,
                cpu_percent=latest_status.cpu_percent,
                last_seen=latest_status.timestamp,
            )

        service_responses.append(response)

    return ExpectedServiceListResponse(
        services=service_responses,
        total=len(services),
    )


async def _sync_agent_background(server_id: str) -> None:
    """Background task to sync services to agent config."""
    from homelab_cmd.db.session import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        success, message = await sync_services_to_agent(session, server_id)
        if success:
            logger.info("Agent sync completed for %s: %s", server_id, message)
        else:
            logger.warning("Agent sync failed for %s: %s", server_id, message)


@router.post(
    "/{server_id}/services",
    response_model=ExpectedServiceResponse,
    status_code=201,
    operation_id="create_expected_service",
    summary="Add expected service to a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
)
async def create_expected_service(
    server_id: str,
    service_data: ExpectedServiceCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ExpectedServiceResponse:
    """Add a new expected service to a server.

    Creates a new expected service configuration for monitoring.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Check for existing service with same name
    result = await session.execute(
        select(ExpectedService).where(
            and_(
                ExpectedService.server_id == server_id,
                ExpectedService.service_name == service_data.service_name,
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "message": f"Service '{service_data.service_name}' already exists for server '{server_id}'",
            },
        )

    # Create the expected service
    expected_service = ExpectedService(
        server_id=server_id,
        service_name=service_data.service_name,
        display_name=service_data.display_name,
        is_critical=service_data.is_critical,
        enabled=True,
    )
    session.add(expected_service)
    await session.flush()
    await session.refresh(expected_service)

    # Commit before background task to ensure data is persisted
    await session.commit()

    # Sync to agent in background (after commit)
    background_tasks.add_task(_sync_agent_background, server_id)

    return ExpectedServiceResponse(
        service_name=expected_service.service_name,
        display_name=expected_service.display_name,
        is_critical=expected_service.is_critical,
        enabled=expected_service.enabled,
        current_status=None,
    )


@router.put(
    "/{server_id}/services/{service_name}",
    response_model=ExpectedServiceResponse,
    operation_id="update_expected_service",
    summary="Update expected service configuration",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def update_expected_service(
    server_id: str,
    service_name: str,
    service_data: ExpectedServiceUpdate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ExpectedServiceResponse:
    """Update an expected service configuration.

    Updates only the provided fields; omitted fields retain current values.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Find the expected service
    result = await session.execute(
        select(ExpectedService).where(
            and_(
                ExpectedService.server_id == server_id,
                ExpectedService.service_name == service_name,
            )
        )
    )
    expected_service = result.scalar_one_or_none()
    if not expected_service:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": f"Service '{service_name}' not found for server '{server_id}'",
            },
        )

    # Update only provided fields
    update_data = service_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expected_service, field, value)

    await session.flush()
    await session.refresh(expected_service)

    # Commit before background task to ensure data is persisted
    await session.commit()

    # Sync to agent in background if enabled status changed
    if "enabled" in update_data:
        background_tasks.add_task(_sync_agent_background, server_id)

    return ExpectedServiceResponse(
        service_name=expected_service.service_name,
        display_name=expected_service.display_name,
        is_critical=expected_service.is_critical,
        enabled=expected_service.enabled,
        current_status=None,
    )


@router.delete(
    "/{server_id}/services/{service_name}",
    status_code=204,
    operation_id="delete_expected_service",
    summary="Remove expected service from server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def delete_expected_service(
    server_id: str,
    service_name: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> None:
    """Remove an expected service from a server.

    Permanently removes the expected service configuration.
    Service status history is not deleted.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Find the expected service
    result = await session.execute(
        select(ExpectedService).where(
            and_(
                ExpectedService.server_id == server_id,
                ExpectedService.service_name == service_name,
            )
        )
    )
    expected_service = result.scalar_one_or_none()
    if not expected_service:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": f"Service '{service_name}' not found for server '{server_id}'",
            },
        )

    await session.delete(expected_service)

    # Commit before background task to ensure deletion is persisted
    await session.commit()

    # Sync to agent in background (after commit)
    background_tasks.add_task(_sync_agent_background, server_id)


@router.post(
    "/{server_id}/services/{service_name}/restart",
    response_model=RestartActionResponse,
    status_code=201,
    operation_id="create_service_restart_action",
    summary="Queue a service restart action",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        409: {"model": DuplicateActionError, "description": "Action already pending"},
    },
)
async def restart_service(
    server_id: str,
    service_name: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> RestartActionResponse:
    """Queue a service restart action.

    Creates a pending restart action for the specified service.
    The action will be executed once approved (EP0004).

    Returns 409 Conflict if a restart action is already pending for this service.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Check for existing pending/approved action for this service
    result = await session.execute(
        select(RemediationAction).where(
            and_(
                RemediationAction.server_id == server_id,
                RemediationAction.service_name == service_name,
                RemediationAction.status.in_(
                    [
                        ActionStatus.PENDING.value,
                        ActionStatus.APPROVED.value,
                    ]
                ),
            )
        )
    )
    existing_action = result.scalar_one_or_none()
    if existing_action:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": "A restart action for this service is already queued",
                "existing_action_id": existing_action.id,
            },
        )

    # Create the remediation action
    action = RemediationAction(
        server_id=server_id,
        action_type="restart_service",
        service_name=service_name,
        command=f"systemctl restart {service_name}",
    )

    # Set status based on server maintenance mode (US0026)
    if server.is_paused:
        action.status = ActionStatus.PENDING.value
    else:
        action.status = ActionStatus.APPROVED.value
        action.approved_at = datetime.now(UTC)
        action.approved_by = "auto"

    session.add(action)
    await session.flush()
    await session.refresh(action)

    return RestartActionResponse.model_validate(action)
