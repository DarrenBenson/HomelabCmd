"""Alert API endpoints for listing, viewing, acknowledging, and resolving alerts."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, BAD_REQUEST_RESPONSE, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.alerts import (
    AlertAcknowledgeResponse,
    AlertListResponse,
    AlertResolveResponse,
    AlertResponse,
)
from homelab_cmd.db.models.alert import Alert, AlertStatus
from homelab_cmd.db.models.service import ServiceStatus
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/alerts", tags=["Alerts"])


def _extract_service_name(alert: Alert) -> str | None:
    """Extract service name from a service alert title.

    Args:
        alert: Alert ORM model instance

    Returns:
        Service name if this is a service alert, None otherwise
    """
    if alert.alert_type != "service":
        return None

    # Title format: "Service {name} is {status}"
    title_parts = alert.title.split()
    if len(title_parts) >= 2 and title_parts[0] == "Service":
        return title_parts[1]
    return None


def _to_response(
    alert: Alert, can_acknowledge: bool = True, can_resolve: bool = True
) -> AlertResponse:
    """Convert Alert model to AlertResponse schema.

    Args:
        alert: Alert ORM model instance (with server relationship loaded)
        can_acknowledge: Whether the alert can be acknowledged

    Returns:
        AlertResponse schema with server_name populated
    """
    return AlertResponse(
        id=alert.id,
        server_id=alert.server_id,
        server_name=alert.server.display_name or alert.server.hostname if alert.server else None,
        alert_type=alert.alert_type,
        severity=alert.severity,
        status=alert.status,
        title=alert.title,
        message=alert.message,
        threshold_value=alert.threshold_value,
        actual_value=alert.actual_value,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
        auto_resolved=alert.auto_resolved,
        can_acknowledge=can_acknowledge,
        service_name=_extract_service_name(alert),
        can_resolve=can_resolve,
    )


async def _is_service_still_down(alert: Alert, session: AsyncSession) -> bool:
    """Check if a service alert's service is still down.

    Args:
        alert: Alert ORM model instance
        session: Database session

    Returns:
        True if service is still down, False otherwise
    """
    if alert.alert_type != "service":
        return False

    title_parts = alert.title.split()
    if len(title_parts) >= 2 and title_parts[0] == "Service":
        service_name = title_parts[1]

        result = await session.execute(
            select(ServiceStatus)
            .where(ServiceStatus.server_id == alert.server_id)
            .where(ServiceStatus.service_name == service_name)
            .order_by(desc(ServiceStatus.timestamp))
            .limit(1)
        )
        latest_status = result.scalar_one_or_none()

        if latest_status and latest_status.status in ("stopped", "failed"):
            return True

    return False


async def _check_can_acknowledge(alert: Alert, session: AsyncSession) -> bool:
    """Check if an alert can be acknowledged."""
    # Already acknowledged or resolved - cannot acknowledge
    if alert.status != AlertStatus.OPEN.value:
        return False

    # Service still down - cannot acknowledge
    if await _is_service_still_down(alert, session):
        return False

    return True


async def _check_can_resolve(alert: Alert, session: AsyncSession) -> bool:
    """Check if an alert can be resolved."""
    # Already resolved - technically can (idempotent), but hide button
    if alert.status == AlertStatus.RESOLVED.value:
        return False

    # Service still down - cannot resolve
    if await _is_service_still_down(alert, session):
        return False

    return True


@router.get(
    "",
    response_model=AlertListResponse,
    operation_id="list_alerts",
    summary="List alerts with optional filtering",
    responses={**AUTH_RESPONSES},
)
async def list_alerts(
    status: str | None = Query(None, description="Filter by status (open, acknowledged, resolved)"),
    severity: str | None = Query(
        None, description="Filter by severity (critical, high, medium, low)"
    ),
    server_id: str | None = Query(None, description="Filter by server ID"),
    limit: int = Query(50, ge=1, le=100, description="Maximum results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AlertListResponse:
    """List alerts with optional filtering and pagination.

    Returns alerts sorted by creation date (newest first).
    """
    # Build base query with eager loading of server relationship
    query = select(Alert).options(joinedload(Alert.server))

    # Apply filters
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    if server_id:
        query = query.where(Alert.server_id == server_id)

    # Get total count before pagination
    count_query = select(func.count()).select_from(Alert)
    if status:
        count_query = count_query.where(Alert.status == status)
    if severity:
        count_query = count_query.where(Alert.severity == severity)
    if server_id:
        count_query = count_query.where(Alert.server_id == server_id)

    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    alerts = result.scalars().unique().all()

    # Build responses with can_acknowledge and can_resolve status
    alert_responses = []
    for a in alerts:
        can_ack = await _check_can_acknowledge(a, session)
        can_res = await _check_can_resolve(a, session)
        alert_responses.append(_to_response(a, can_acknowledge=can_ack, can_resolve=can_res))

    return AlertListResponse(
        alerts=alert_responses,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    operation_id="get_alert",
    summary="Get alert details by ID",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AlertResponse:
    """Get alert details by ID."""
    result = await session.execute(
        select(Alert).options(joinedload(Alert.server)).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Alert {alert_id} not found"},
        )

    can_ack = await _check_can_acknowledge(alert, session)
    can_res = await _check_can_resolve(alert, session)
    return _to_response(alert, can_acknowledge=can_ack, can_resolve=can_res)


@router.post(
    "/{alert_id}/acknowledge",
    response_model=AlertAcknowledgeResponse,
    operation_id="acknowledge_alert",
    summary="Acknowledge an alert",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **BAD_REQUEST_RESPONSE},
)
async def acknowledge_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AlertAcknowledgeResponse:
    """Acknowledge an alert.

    Marks the alert as acknowledged, indicating awareness of the issue.
    Idempotent: acknowledging an already acknowledged alert returns success.
    Cannot acknowledge a resolved alert.
    Cannot acknowledge a service alert while the service is still down.
    """
    alert = await session.get(Alert, alert_id)

    if not alert:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Alert {alert_id} not found"},
        )

    # Cannot acknowledge a resolved alert
    if alert.status == AlertStatus.RESOLVED.value:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_STATE", "message": "Cannot acknowledge a resolved alert"},
        )

    # Idempotent: if already acknowledged, just return current state
    if alert.status == AlertStatus.ACKNOWLEDGED.value:
        return AlertAcknowledgeResponse(
            id=alert.id,
            status=alert.status,
            acknowledged_at=alert.acknowledged_at,  # type: ignore[arg-type]
        )

    # For service alerts, check if service is still down
    if alert.alert_type == "service":
        # Extract service name from title (format: "Service {name} is {status}")
        title_parts = alert.title.split()
        if len(title_parts) >= 2 and title_parts[0] == "Service":
            service_name = title_parts[1]

            # Get latest service status
            result = await session.execute(
                select(ServiceStatus)
                .where(ServiceStatus.server_id == alert.server_id)
                .where(ServiceStatus.service_name == service_name)
                .order_by(desc(ServiceStatus.timestamp))
                .limit(1)
            )
            latest_status = result.scalar_one_or_none()

            if latest_status and latest_status.status in ("stopped", "failed"):
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "SERVICE_STILL_DOWN",
                        "message": f"Cannot acknowledge: service {service_name} is still {latest_status.status}",
                    },
                )

    # Acknowledge the alert
    alert.acknowledge()
    await session.flush()
    await session.refresh(alert)

    return AlertAcknowledgeResponse(
        id=alert.id,
        status=alert.status,
        acknowledged_at=alert.acknowledged_at,  # type: ignore[arg-type]
    )


@router.post(
    "/{alert_id}/resolve",
    response_model=AlertResolveResponse,
    operation_id="resolve_alert",
    summary="Resolve an alert",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def resolve_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AlertResolveResponse:
    """Resolve an alert.

    Marks the alert as resolved. Can resolve from either open or acknowledged state.
    Idempotent: resolving an already resolved alert returns success.
    """
    alert = await session.get(Alert, alert_id)

    if not alert:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Alert {alert_id} not found"},
        )

    # Idempotent: if already resolved, just return current state
    if alert.status == AlertStatus.RESOLVED.value:
        return AlertResolveResponse(
            id=alert.id,
            status=alert.status,
            resolved_at=alert.resolved_at,  # type: ignore[arg-type]
            auto_resolved=alert.auto_resolved,
        )

    # Resolve the alert (manual resolution, not auto)
    alert.resolve(auto=False)
    await session.flush()
    await session.refresh(alert)

    return AlertResolveResponse(
        id=alert.id,
        status=alert.status,
        resolved_at=alert.resolved_at,  # type: ignore[arg-type]
        auto_resolved=alert.auto_resolved,
    )
