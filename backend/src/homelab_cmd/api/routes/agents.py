"""Agent communication API endpoints."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import AuthInfo, verify_agent_auth
from homelab_cmd.api.responses import AUTH_RESPONSES, FORBIDDEN_RESPONSE
from homelab_cmd.api.routes.config import (
    DEFAULT_NOTIFICATIONS,
    DEFAULT_THRESHOLDS,
    get_config_value,
)
from homelab_cmd.api.schemas.config import NotificationsConfig, ThresholdsConfig
from homelab_cmd.api.schemas.heartbeat import (
    MAX_OUTPUT_SIZE,
    HeartbeatRequest,
    HeartbeatResponse,
    PendingCommand,
)
from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.remediation import ActionStatus, RemediationAction
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.models.service import ServiceStatus
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.alerting import AlertingService
from homelab_cmd.services.notifier import ActionEvent, get_notifier

router = APIRouter(prefix="/agents", tags=["Agents"])
logger = logging.getLogger(__name__)

# Default command timeout in seconds (US0025)
DEFAULT_COMMAND_TIMEOUT = 30


async def _get_next_approved_action(
    session: AsyncSession, server_id: str
) -> RemediationAction | None:
    """Get the oldest approved action for a server (US0025 - AC6).

    Args:
        session: Database session
        server_id: Server identifier

    Returns:
        Oldest approved action or None if no approved actions exist.
    """
    result = await session.execute(
        select(RemediationAction)
        .where(RemediationAction.server_id == server_id)
        .where(RemediationAction.status == ActionStatus.APPROVED.value)
        .order_by(RemediationAction.created_at.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _format_pending_command(action: RemediationAction) -> PendingCommand:
    """Format a remediation action as a pending command for the agent (US0025).

    Args:
        action: The remediation action to format

    Returns:
        PendingCommand schema with action details.
    """
    parameters: dict = {}
    if action.service_name:
        parameters["service_name"] = action.service_name

    return PendingCommand(
        action_id=action.id,
        action_type=action.action_type,
        command=action.command,
        parameters=parameters,
        timeout_seconds=DEFAULT_COMMAND_TIMEOUT,
    )


async def _process_command_results(
    session: AsyncSession, heartbeat: HeartbeatRequest
) -> list[RemediationAction]:
    """Process command results from heartbeat request (US0025 - AC4, AC5).

    Updates action status to COMPLETED (exit_code=0) or FAILED (exit_code!=0).
    Stores stdout, stderr, and timestamps.

    Args:
        session: Database session
        heartbeat: Heartbeat request containing command_results

    Returns:
        List of completed/failed action objects (for notification - US0032).
    """
    completed_actions: list[RemediationAction] = []

    if not heartbeat.command_results:
        return completed_actions

    for result in heartbeat.command_results:
        action = await session.get(RemediationAction, result.action_id)

        if not action:
            logger.warning(
                "Result for unknown action %d from server %s",
                result.action_id,
                heartbeat.server_id,
            )
            continue

        if action.status != ActionStatus.EXECUTING.value:
            # US0074: Special case for background tasks.
            # If the action is already COMPLETED or FAILED, we might have received a late duplicate.
            # But if it's EXECUTING, we update it.
            # Wait, if it's already EXECUTING, we update it with the result.
            # What if we receive the "Started" result first, then later the "Completed" result?
            # The "Started" result should keep it in EXECUTING state.
            logger.debug(
                "Ignoring result for action %d (status=%s, not executing)",
                result.action_id,
                action.status,
            )
            continue

        # Update action with result (US0025 - AC5)
        action.exit_code = result.exit_code
        action.stdout = (result.stdout or "")[:MAX_OUTPUT_SIZE]
        action.stderr = (result.stderr or "")[:MAX_OUTPUT_SIZE]
        action.completed_at = result.completed_at

        # US0074: Detect background "Started" result
        is_background_start = "Started background execution" in (result.stdout or "")

        if is_background_start:
            # Keep in EXECUTING state while background task runs
            action.status = ActionStatus.EXECUTING.value
            logger.info("Action %d started in background", result.action_id)
            # We don't add to completed_actions so Hub doesn't acknowledge it yet?
            # Actually, if we don't acknowledge, agent will keep sending it.
            # We MUST acknowledge the "Started" result so agent stops sending it,
            # BUT we keep the status as EXECUTING in DB.
            completed_actions.append(action)
            continue

        if result.exit_code == 0:
            action.status = ActionStatus.COMPLETED.value
            logger.info("Action %d completed successfully", result.action_id)
        else:
            action.status = ActionStatus.FAILED.value
            logger.warning(
                "Action %d failed with exit code %d",
                result.action_id,
                result.exit_code,
            )

        completed_actions.append(action)

    return completed_actions


@router.post(
    "/heartbeat",
    response_model=HeartbeatResponse,
    operation_id="create_heartbeat",
    summary="Receive heartbeat from agent",
    responses={**AUTH_RESPONSES, **FORBIDDEN_RESPONSE},
)
async def receive_heartbeat(
    heartbeat: HeartbeatRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    auth: AuthInfo = Depends(verify_agent_auth),
) -> HeartbeatResponse:
    """Receive heartbeat from agent.

    Server matching (US0070):
    1. Match by GUID first (if provided) - preferred for new agents
    2. Fall back to server_id for old agents without GUID
    3. Migration: existing server gets GUID on first new-agent heartbeat
    4. Duplicate GUID returns 409 Conflict

    Also stores metrics, updates server status to online, and auto-registers
    unknown servers. Processes command results and returns pending commands.
    """
    now = datetime.now(UTC)
    server_registered = False

    # 1. Process command results first (US0025 - AC4, AC5)
    completed_actions = await _process_command_results(session, heartbeat)
    results_acknowledged = [action.id for action in completed_actions]

    # 2. Server matching logic (US0070)
    server: Server | None = None

    # 2a. Try GUID match first (preferred for new agents)
    if heartbeat.server_guid:
        result = await session.execute(select(Server).where(Server.guid == heartbeat.server_guid))
        server = result.scalar_one_or_none()

    # 2b. Fall back to server_id match (backward compatibility for old agents)
    if server is None:
        server = await session.get(Server, heartbeat.server_id)

        # Migration: existing server gets GUID from upgraded agent
        if server and heartbeat.server_guid:
            if server.guid is None:
                # First heartbeat from upgraded agent - add GUID to existing server
                server.guid = heartbeat.server_guid
                logger.info(
                    "Migration: added GUID %s to existing server %s",
                    heartbeat.server_guid,
                    heartbeat.server_id,
                )
            elif server.guid != heartbeat.server_guid:
                # GUID mismatch - this is a configuration error
                logger.error(
                    "GUID mismatch: server %s has GUID %s but received %s",
                    heartbeat.server_id,
                    server.guid,
                    heartbeat.server_guid,
                )
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "CONFLICT",
                        "message": f"Server '{heartbeat.server_id}' already has a different GUID",
                    },
                )

    # Reject heartbeats from inactive servers (BG0012)
    # Agent should be uninstalled - heartbeats indicate removal failed
    if server is not None and server.is_inactive:
        logger.warning(
            "Rejected heartbeat from inactive server %s - agent should be uninstalled",
            heartbeat.server_id,
        )
        raise HTTPException(
            status_code=403,
            detail={
                "code": "FORBIDDEN",
                "message": f"Server '{heartbeat.server_id}' is inactive (agent removed). Uninstall the agent.",
            },
        )

    if server is None:
        # 2c. Check for duplicate GUID before auto-registration
        if heartbeat.server_guid:
            existing_guid = await session.execute(
                select(Server).where(Server.guid == heartbeat.server_guid)
            )
            if existing_guid.scalar_one_or_none():
                logger.error(
                    "Duplicate GUID: %s already registered to another server",
                    heartbeat.server_guid,
                )
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "CONFLICT",
                        "message": f"GUID {heartbeat.server_guid} already registered to another server",
                    },
                )

        # Auto-register new server (AC3)
        server = Server(
            id=heartbeat.server_id,
            guid=heartbeat.server_guid,  # May be None for old agents
            hostname=heartbeat.hostname,
            status=ServerStatus.ONLINE.value,
            last_seen=now,
        )
        session.add(server)
        server_registered = True
        logger.info(
            "Auto-registered new server: %s (GUID: %s)",
            heartbeat.server_id,
            heartbeat.server_guid or "none",
        )

    # Update server status and last_seen (AC2)
    server.status = ServerStatus.ONLINE.value
    server.last_seen = now

    # Update volatile fields on EVERY heartbeat (US0070 - AC5)
    # These can change with DHCP/network changes but GUID stays the same
    server.hostname = heartbeat.hostname
    if request.client:
        server.ip_address = str(request.client.host)

    # Update OS info if provided (AC4)
    if heartbeat.os_info:
        server.os_distribution = heartbeat.os_info.distribution
        server.os_version = heartbeat.os_info.version
        server.kernel_version = heartbeat.os_info.kernel
        server.architecture = heartbeat.os_info.architecture

    # Update CPU info if provided (for power profile detection)
    if heartbeat.cpu_info:
        server.cpu_model = heartbeat.cpu_info.cpu_model
        server.cpu_cores = heartbeat.cpu_info.cpu_cores

        # Auto-detect machine category only if not already set by user
        if server.machine_category_source != "user":
            from homelab_cmd.services.power import infer_category_from_cpu

            architecture = heartbeat.os_info.architecture if heartbeat.os_info else None
            detected_category = infer_category_from_cpu(heartbeat.cpu_info.cpu_model, architecture)
            if detected_category:
                server.machine_category = detected_category.value
                server.machine_category_source = "auto"

    # Update agent version if provided (US0061)
    if heartbeat.agent_version:
        server.agent_version = heartbeat.agent_version

    # Update agent mode if provided (BG0017)
    if heartbeat.agent_mode:
        server.agent_mode = heartbeat.agent_mode

    # Note: Auto-reactivation removed (BG0012) - inactive servers must be
    # explicitly reactivated via the API, not by receiving heartbeats

    # Update package update counts if provided
    if heartbeat.updates_available is not None:
        server.updates_available = heartbeat.updates_available
    if heartbeat.security_updates is not None:
        server.security_updates = heartbeat.security_updates

    # Store metrics if provided (AC1)
    if heartbeat.metrics:
        metrics = Metrics(
            server_id=heartbeat.server_id,
            timestamp=heartbeat.timestamp,
            cpu_percent=heartbeat.metrics.cpu_percent,
            memory_percent=heartbeat.metrics.memory_percent,
            memory_total_mb=heartbeat.metrics.memory_total_mb,
            memory_used_mb=heartbeat.metrics.memory_used_mb,
            disk_percent=heartbeat.metrics.disk_percent,
            disk_total_gb=heartbeat.metrics.disk_total_gb,
            disk_used_gb=heartbeat.metrics.disk_used_gb,
            network_rx_bytes=heartbeat.metrics.network_rx_bytes,
            network_tx_bytes=heartbeat.metrics.network_tx_bytes,
            load_1m=heartbeat.metrics.load_1m,
            load_5m=heartbeat.metrics.load_5m,
            load_15m=heartbeat.metrics.load_15m,
            uptime_seconds=heartbeat.metrics.uptime_seconds,
        )
        session.add(metrics)

    # Store service status if provided (US0018 - AC5)
    if heartbeat.services:
        for svc in heartbeat.services:
            service_status = ServiceStatus(
                server_id=heartbeat.server_id,
                service_name=svc.name,
                status=svc.status,
                status_reason=svc.status_reason,
                pid=svc.pid,
                memory_mb=svc.memory_mb,
                cpu_percent=svc.cpu_percent,
                timestamp=heartbeat.timestamp,
            )
            session.add(service_status)

    # Process package updates if provided (US0051 - AC2)
    if heartbeat.packages is not None:
        # Import here to avoid circular imports
        from sqlalchemy import delete

        from homelab_cmd.db.models.pending_package import PendingPackage

        # Delete existing packages for this server using bulk delete
        await session.execute(
            delete(PendingPackage).where(PendingPackage.server_id == heartbeat.server_id)
        )

        # Deduplicate packages by name (agent may report same package twice)
        unique_packages = {pkg.name: pkg for pkg in heartbeat.packages}

        # Insert new packages
        for pkg_data in unique_packages.values():
            package = PendingPackage(
                server_id=heartbeat.server_id,
                name=pkg_data.name,
                current_version=pkg_data.current_version,
                new_version=pkg_data.new_version,
                repository=pkg_data.repository,
                is_security=pkg_data.is_security,
                detected_at=now,
                updated_at=now,
            )
            session.add(package)

    await session.flush()

    # Load notifications config (needed for both alerts and action notifications)
    notifications_data = await get_config_value(session, "notifications")
    notifications = (
        NotificationsConfig(**notifications_data) if notifications_data else DEFAULT_NOTIFICATIONS
    )

    # Send action completion/failure notifications (US0032)
    if completed_actions and notifications.slack_webhook_url:
        notifier = get_notifier(notifications.slack_webhook_url)
        for action in completed_actions:
            action_event = ActionEvent(
                action_id=action.id,
                server_id=action.server_id,
                server_name=server.hostname,
                action_type=action.action_type,
                service_name=action.service_name,
                is_success=(action.status == ActionStatus.COMPLETED.value),
                exit_code=action.exit_code,
                stderr=action.stderr,
            )
            await notifier.send_action_notification(action_event, notifications)

    # Evaluate metrics against thresholds (US0011)
    if heartbeat.metrics:
        # Load thresholds config from database (use defaults if not configured)
        thresholds_data = await get_config_value(session, "thresholds")
        thresholds = ThresholdsConfig(**thresholds_data) if thresholds_data else DEFAULT_THRESHOLDS

        # Evaluate thresholds and create Alert records as needed
        alerting_service = AlertingService(session)
        events = await alerting_service.evaluate_heartbeat(
            server_id=heartbeat.server_id,
            server_name=server.hostname,
            cpu_percent=heartbeat.metrics.cpu_percent,
            memory_percent=heartbeat.metrics.memory_percent,
            disk_percent=heartbeat.metrics.disk_percent,
            thresholds=thresholds,
            notifications=notifications,
        )

        # Evaluate service status against expected services (US0021)
        if heartbeat.services:
            service_events = await alerting_service.evaluate_services(
                server_id=heartbeat.server_id,
                server_name=server.hostname,
                services=heartbeat.services,
                notifications=notifications,
            )
            events.extend(service_events)

        # Send notifications for any alert events (US0012)
        if events and notifications.slack_webhook_url:
            notifier = get_notifier(notifications.slack_webhook_url)
            for event in events:
                await notifier.send_alert(event, notifications)

    logger.debug("Heartbeat received from %s", heartbeat.server_id)

    # 3. Get next pending command for this server (US0025 - AC1, AC2, AC6)
    pending_commands: list[PendingCommand] = []
    next_action = await _get_next_approved_action(session, heartbeat.server_id)

    if next_action:
        # Mark as executing (US0025 - AC2)
        next_action.status = ActionStatus.EXECUTING.value
        next_action.executed_at = now
        pending_commands.append(_format_pending_command(next_action))
        logger.info(
            "Delivering action %d to server %s",
            next_action.id,
            heartbeat.server_id,
        )

    # Return response with pending commands
    return HeartbeatResponse(
        status="ok",
        server_registered=server_registered,
        pending_commands=pending_commands,
        results_acknowledged=results_acknowledged,
    )
