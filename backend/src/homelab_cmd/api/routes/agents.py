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
    HeartbeatRequest,
    HeartbeatResponse,
    PendingCommand,
)
from homelab_cmd.db.models.metrics import FilesystemMetrics, Metrics, NetworkInterfaceMetrics
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.models.service import ServiceStatus
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.alerting import AlertingService
from homelab_cmd.services.notifier import get_notifier

router = APIRouter(prefix="/agents", tags=["Agents"])
logger = logging.getLogger(__name__)

# US0152: Async command channel removed (EP0013)
# Commands are now executed via synchronous SSH (US0151, US0153)
# The following functions were removed:
# - _get_next_approved_action() - no longer delivering commands via heartbeat
# - _format_pending_command() - no longer formatting commands for agents
# - _process_command_results() - no longer processing results from agents


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

    # US0152: Deprecation warning for v1.0 agents sending command_results
    # The async command channel is deprecated - use synchronous SSH execution (EP0013)
    if heartbeat.command_results:
        logger.warning(
            "Deprecated: Server %s sent command_results. "
            "The async command channel is deprecated (EP0013). "
            "Upgrade agent to v2.0 for SSH-based command execution.",
            heartbeat.server_id,
        )
    # command_results are now ignored - no longer processing them
    results_acknowledged: list[int] = []

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

    # Store per-filesystem metrics if provided (US0178)
    if heartbeat.filesystems:
        # Store latest snapshot in server record (for quick API response)
        server.filesystems = [
            {
                "mount_point": fs.mount_point,
                "device": fs.device,
                "fs_type": fs.fs_type,
                "total_bytes": fs.total_bytes,
                "used_bytes": fs.used_bytes,
                "available_bytes": fs.available_bytes,
                "percent": fs.percent,
            }
            for fs in heartbeat.filesystems
        ]

        # Store historical records (for trend analysis)
        for fs in heartbeat.filesystems:
            fs_metrics = FilesystemMetrics(
                server_id=heartbeat.server_id,
                timestamp=heartbeat.timestamp,
                mount_point=fs.mount_point,
                device=fs.device,
                fs_type=fs.fs_type,
                total_bytes=fs.total_bytes,
                used_bytes=fs.used_bytes,
                available_bytes=fs.available_bytes,
                percent=fs.percent,
            )
            session.add(fs_metrics)

    # Store per-interface network metrics if provided (US0179)
    if heartbeat.network_interfaces:
        # Store latest snapshot in server record (for quick API response)
        server.network_interfaces = [
            {
                "name": iface.name,
                "rx_bytes": iface.rx_bytes,
                "tx_bytes": iface.tx_bytes,
                "rx_packets": iface.rx_packets,
                "tx_packets": iface.tx_packets,
                "is_up": iface.is_up,
            }
            for iface in heartbeat.network_interfaces
        ]

        # Store historical records (for trend analysis)
        for iface in heartbeat.network_interfaces:
            iface_metrics = NetworkInterfaceMetrics(
                server_id=heartbeat.server_id,
                timestamp=heartbeat.timestamp,
                interface_name=iface.name,
                rx_bytes=iface.rx_bytes,
                tx_bytes=iface.tx_bytes,
                rx_packets=iface.rx_packets,
                tx_packets=iface.tx_packets,
                is_up=iface.is_up,
            )
            session.add(iface_metrics)

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

    # Load notifications config (needed for alerts)
    notifications_data = await get_config_value(session, "notifications")
    notifications = (
        NotificationsConfig(**notifications_data) if notifications_data else DEFAULT_NOTIFICATIONS
    )

    # US0152: Action completion notifications removed (EP0013)
    # Notifications now triggered by synchronous command execution (US0153)

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

    # US0152: pending_commands is deprecated - always return empty array
    # Commands are now executed via synchronous SSH (EP0013: US0151, US0153)
    # The pending_commands field is kept for backward compatibility with v1.0 agents
    pending_commands: list[PendingCommand] = []

    # Return response with empty pending_commands (backward compatible)
    return HeartbeatResponse(
        status="ok",
        server_registered=server_registered,
        pending_commands=pending_commands,
        results_acknowledged=results_acknowledged,
    )
