"""Server registration API endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from homelab_cmd.api.deps import get_credential_service, verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, CONFLICT_RESPONSE, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.actions import ActionListResponse, ActionResponse
from homelab_cmd.api.schemas.server import (
    LatestMetrics,
    PackageListResponse,
    PackageResponse,
    PackAssignmentRequest,
    PackAssignmentResponse,
    ServerCreate,
    ServerCredentialsResponse,
    ServerCredentialStatus,
    ServerListResponse,
    ServerResponse,
    ServerUpdate,
    StoreServerCredentialRequest,
    StoreServerCredentialResponse,
)
from homelab_cmd.db.models.alert import Alert, AlertStatus
from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.remediation import RemediationAction
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.credential_service import (
    ALLOWED_CREDENTIAL_TYPES,
    CredentialService,
)

router = APIRouter(prefix="/servers", tags=["Servers"])


@router.get(
    "",
    response_model=ServerListResponse,
    operation_id="list_servers",
    summary="List all registered servers",
    responses={**AUTH_RESPONSES},
)
async def list_servers(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerListResponse:
    """List all registered servers.

    Returns a list of all servers with their current status, basic information,
    latest metrics, and active alert counts (US0110).

    Performance: Uses a single query with window function to fetch latest metrics
    for all servers (O(1) queries instead of O(N) - fixes BG0020).
    """
    # Subquery: rank metrics by timestamp per server, keeping only the latest (rn=1)
    # Uses row_number() window function partitioned by server_id
    metrics_ranked = (
        select(
            Metrics,
            func.row_number()
            .over(partition_by=Metrics.server_id, order_by=desc(Metrics.timestamp))
            .label("rn"),
        )
    ).subquery()

    # Alias the subquery so we can reference its columns
    MetricsRanked = aliased(Metrics, metrics_ranked)

    # US0110: Subquery for active alert counts per server
    # Uses existing index: idx_alerts_server_status on (server_id, status)
    alert_counts = (
        select(
            Alert.server_id,
            func.count(Alert.id).label("active_count"),
        )
        .where(Alert.status == AlertStatus.OPEN.value)
        .group_by(Alert.server_id)
    ).subquery()

    # Main query: LEFT JOIN servers with their latest metrics (rn=1) and alert counts
    # This fetches all servers, metrics, and alert counts in a single query
    stmt = (
        select(Server, MetricsRanked, alert_counts.c.active_count)
        .outerjoin(
            metrics_ranked,
            (Server.id == metrics_ranked.c.server_id) & (metrics_ranked.c.rn == 1),
        )
        .outerjoin(
            alert_counts,
            Server.id == alert_counts.c.server_id,
        )
    )

    result = await session.execute(stmt)
    rows = result.all()

    # US0110: Build a map of server_id -> alert summaries (titles)
    # Separate query to get up to 3 alert titles per server for tooltip
    alert_summaries_stmt = (
        select(Alert.server_id, Alert.title)
        .where(Alert.status == AlertStatus.OPEN.value)
        .order_by(Alert.server_id, desc(Alert.created_at))
    )
    alert_result = await session.execute(alert_summaries_stmt)
    alert_rows = alert_result.all()

    # Group alerts by server_id, keeping max 3 per server
    server_alert_summaries: dict[str, list[str]] = {}
    for server_id, title in alert_rows:
        if server_id not in server_alert_summaries:
            server_alert_summaries[server_id] = []
        if len(server_alert_summaries[server_id]) < 3:
            server_alert_summaries[server_id].append(title)

    # Build response - each row is (Server, Metrics or None, active_count or None)
    server_responses = []
    for server, latest_metrics_record, active_count in rows:
        response = ServerResponse.model_validate(server)

        if latest_metrics_record:
            response.latest_metrics = LatestMetrics(
                cpu_percent=latest_metrics_record.cpu_percent,
                memory_percent=latest_metrics_record.memory_percent,
                memory_total_mb=latest_metrics_record.memory_total_mb,
                memory_used_mb=latest_metrics_record.memory_used_mb,
                disk_percent=latest_metrics_record.disk_percent,
                disk_total_gb=latest_metrics_record.disk_total_gb,
                disk_used_gb=latest_metrics_record.disk_used_gb,
                network_rx_bytes=latest_metrics_record.network_rx_bytes,
                network_tx_bytes=latest_metrics_record.network_tx_bytes,
                load_1m=latest_metrics_record.load_1m,
                load_5m=latest_metrics_record.load_5m,
                load_15m=latest_metrics_record.load_15m,
                uptime_seconds=latest_metrics_record.uptime_seconds,
            )

        # US0110: Populate alert count and summaries
        response.active_alert_count = active_count or 0
        response.active_alert_summaries = server_alert_summaries.get(server.id, [])

        server_responses.append(response)

    return ServerListResponse(
        servers=server_responses,
        total=len(rows),
    )


@router.post(
    "",
    response_model=ServerResponse,
    status_code=201,
    operation_id="create_server",
    summary="Register a new server",
    responses={**AUTH_RESPONSES, **CONFLICT_RESPONSE},
)
async def register_server(
    server_data: ServerCreate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Register a new server.

    Creates a new server with the provided configuration. The server status
    will be set to 'unknown' until a heartbeat is received from the agent.
    """
    # Check for existing server
    existing = await session.get(Server, server_data.id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFLICT", "message": f"Server '{server_data.id}' already exists"},
        )

    # US0121: Set default assigned packs based on machine type
    default_packs = get_default_packs(server_data.machine_type)

    server = Server(
        id=server_data.id,
        hostname=server_data.hostname,
        display_name=server_data.display_name,
        ip_address=server_data.ip_address,
        tdp_watts=server_data.tdp_watts,
        machine_type=server_data.machine_type,
        status=ServerStatus.UNKNOWN.value,
        assigned_packs=default_packs,
    )
    session.add(server)
    await session.flush()
    await session.refresh(server)
    return ServerResponse.model_validate(server)


@router.get(
    "/{server_id}",
    response_model=ServerResponse,
    operation_id="get_server",
    summary="Get server details by ID",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Get server details by ID.

    Returns full server details including OS information and latest metrics
    (if available).
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Query the most recent metrics for this server
    result = await session.execute(
        select(Metrics)
        .where(Metrics.server_id == server_id)
        .order_by(desc(Metrics.timestamp))
        .limit(1)
    )
    latest_metrics_record = result.scalar_one_or_none()

    # Build response with latest metrics if available
    response = ServerResponse.model_validate(server)
    if latest_metrics_record:
        response.latest_metrics = LatestMetrics(
            cpu_percent=latest_metrics_record.cpu_percent,
            memory_percent=latest_metrics_record.memory_percent,
            memory_total_mb=latest_metrics_record.memory_total_mb,
            memory_used_mb=latest_metrics_record.memory_used_mb,
            disk_percent=latest_metrics_record.disk_percent,
            disk_total_gb=latest_metrics_record.disk_total_gb,
            disk_used_gb=latest_metrics_record.disk_used_gb,
            network_rx_bytes=latest_metrics_record.network_rx_bytes,
            network_tx_bytes=latest_metrics_record.network_tx_bytes,
            load_1m=latest_metrics_record.load_1m,
            load_5m=latest_metrics_record.load_5m,
            load_15m=latest_metrics_record.load_15m,
            uptime_seconds=latest_metrics_record.uptime_seconds,
        )

    return response


@router.put(
    "/{server_id}",
    response_model=ServerResponse,
    operation_id="update_server",
    summary="Update server configuration",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def update_server(
    server_id: str,
    server_data: ServerUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Update server configuration.

    Updates the specified fields of a server. Only provided fields are updated;
    omitted fields retain their current values.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    update_data = server_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)

    await session.flush()
    await session.refresh(server)
    return ServerResponse.model_validate(server)


@router.delete(
    "/{server_id}",
    status_code=204,
    operation_id="delete_server",
    summary="Delete a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def delete_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> None:
    """Delete a server and its associated metrics.

    Permanently removes a server and all associated metrics data.
    This action cannot be undone.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    await session.delete(server)


@router.put(
    "/{server_id}/pause",
    response_model=ServerResponse,
    operation_id="pause_server",
    summary="Pause a server (enable maintenance mode)",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def pause_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Pause a server, enabling maintenance mode.

    When a server is paused, new remediation actions require manual approval
    instead of being auto-approved.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    server.is_paused = True
    server.paused_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(server)
    return ServerResponse.model_validate(server)


@router.put(
    "/{server_id}/unpause",
    response_model=ServerResponse,
    operation_id="unpause_server",
    summary="Unpause a server (disable maintenance mode)",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def unpause_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Unpause a server, disabling maintenance mode.

    New remediation actions will be auto-approved again.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    server.is_paused = False
    server.paused_at = None
    await session.flush()
    await session.refresh(server)
    return ServerResponse.model_validate(server)


@router.get(
    "/{server_id}/actions",
    response_model=ActionListResponse,
    operation_id="list_server_actions",
    summary="List remediation actions for a specific server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def list_server_actions(
    server_id: str,
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Maximum results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionListResponse:
    """List remediation actions for a specific server.

    Returns actions sorted by creation date (newest first).
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Build query
    query = select(RemediationAction).where(RemediationAction.server_id == server_id)
    count_query = (
        select(func.count())
        .select_from(RemediationAction)
        .where(RemediationAction.server_id == server_id)
    )

    # Apply status filter
    if status:
        query = query.where(RemediationAction.status == status)
        count_query = count_query.where(RemediationAction.status == status)

    # Get total count
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
    "/{server_id}/packages",
    response_model=PackageListResponse,
    operation_id="get_server_packages",
    summary="Get pending package updates for a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_server_packages(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> PackageListResponse:
    """Get list of pending package updates for a server.

    Returns all packages that have updates available, including version
    information and whether the update is security-related.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Load pending packages
    # Import here to avoid circular imports
    from homelab_cmd.db.models.pending_package import PendingPackage

    result = await session.execute(
        select(PendingPackage)
        .where(PendingPackage.server_id == server_id)
        .order_by(PendingPackage.name)
    )
    packages = result.scalars().all()

    # Count security packages
    security_count = sum(1 for p in packages if p.is_security)

    return PackageListResponse(
        server_id=server_id,
        last_checked=server.last_seen,
        total_count=len(packages),
        security_count=security_count,
        packages=[PackageResponse.model_validate(p) for p in packages],
    )


# ===========================================================================
# Per-Server Credential Endpoints (US0087)
# ===========================================================================

# Credential types relevant for per-server configuration
# tailscale_token is excluded (global only)
PER_SERVER_CREDENTIAL_TYPES = ["ssh_private_key", "sudo_password", "ssh_password"]


@router.get(
    "/{server_id}/credentials",
    response_model=ServerCredentialsResponse,
    operation_id="list_server_credentials",
    summary="List credential status for a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def list_server_credentials(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
    credential_service: CredentialService = Depends(get_credential_service),
) -> ServerCredentialsResponse:
    """List credential status for a server (US0087 AC1).

    Returns which credential types are configured and their scope
    (per-server or global fallback). Never returns actual credential values.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    credentials = []
    for cred_type in PER_SERVER_CREDENTIAL_TYPES:
        scope = await credential_service.get_credential_scope(cred_type, server_id)
        credentials.append(
            ServerCredentialStatus(
                credential_type=cred_type,
                configured=scope != "none",
                scope=scope,
            )
        )

    return ServerCredentialsResponse(
        server_id=server_id,
        ssh_username=server.ssh_username,
        sudo_mode=server.sudo_mode,
        credentials=credentials,
    )


@router.post(
    "/{server_id}/credentials",
    response_model=StoreServerCredentialResponse,
    operation_id="store_server_credential",
    summary="Store a per-server credential",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "Invalid credential type",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "INVALID_CREDENTIAL_TYPE",
                            "message": "Invalid credential type 'invalid'. Valid types: ssh_password, ssh_private_key, sudo_password",
                        }
                    }
                }
            },
        },
    },
)
async def store_server_credential(
    server_id: str,
    request: StoreServerCredentialRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
    credential_service: CredentialService = Depends(get_credential_service),
) -> StoreServerCredentialResponse:
    """Store a per-server credential (US0087 AC2).

    The credential value is encrypted before storage.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Validate credential type
    if request.credential_type not in ALLOWED_CREDENTIAL_TYPES:
        valid_types = ", ".join(
            sorted(t for t in ALLOWED_CREDENTIAL_TYPES if t != "tailscale_token")
        )
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_CREDENTIAL_TYPE",
                "message": f"Invalid credential type '{request.credential_type}'. Valid types: {valid_types}",
            },
        )

    await credential_service.store_credential(
        credential_type=request.credential_type,
        plaintext_value=request.value,
        server_id=server_id,
    )
    await session.commit()

    return StoreServerCredentialResponse(
        credential_type=request.credential_type,
        server_id=server_id,
    )


@router.delete(
    "/{server_id}/credentials/{credential_type}",
    operation_id="delete_server_credential",
    summary="Delete a per-server credential",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "Invalid credential type",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "INVALID_CREDENTIAL_TYPE",
                            "message": "Invalid credential type 'invalid'",
                        }
                    }
                }
            },
        },
    },
)
async def delete_server_credential(
    server_id: str,
    credential_type: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
    credential_service: CredentialService = Depends(get_credential_service),
) -> dict:
    """Delete a per-server credential (US0087 AC3).

    After deletion, the server will fall back to the global credential
    (if one exists) for this credential type.
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Validate credential type
    if credential_type not in ALLOWED_CREDENTIAL_TYPES:
        valid_types = ", ".join(
            sorted(t for t in ALLOWED_CREDENTIAL_TYPES if t != "tailscale_token")
        )
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_CREDENTIAL_TYPE",
                "message": f"Invalid credential type '{credential_type}'. Valid types: {valid_types}",
            },
        )

    deleted = await credential_service.delete_credential(
        credential_type=credential_type,
        server_id=server_id,
    )
    await session.commit()

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": f"No per-server credential of type '{credential_type}' found",
            },
        )

    return {"message": "Credential deleted successfully", "fallback_to_global": True}


# ===========================================================================
# SSH Connection Test (US0079: SSH Connection via Tailscale)
# ===========================================================================


@router.post(
    "/{server_id}/test-ssh",
    operation_id="test_server_ssh",
    summary="Test SSH connection to server",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "SSH not configured or server has no Tailscale hostname",
            "content": {
                "application/json": {
                    "examples": {
                        "no_ssh_key": {
                            "value": {
                                "detail": {
                                    "code": "NO_SSH_KEY",
                                    "message": "No SSH key configured. Upload a key in Settings > Connectivity.",
                                }
                            }
                        },
                        "no_tailscale_hostname": {
                            "value": {
                                "detail": {
                                    "code": "NO_TAILSCALE_HOSTNAME",
                                    "message": "Machine test-server has no Tailscale hostname",
                                }
                            }
                        },
                    }
                }
            },
        },
    },
)
async def test_server_ssh(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> dict:
    """Test SSH connection to a server via Tailscale hostname.

    AC5: Connection health check endpoint.

    Attempts to establish an SSH connection to the server using its
    Tailscale hostname. Returns success/failure status with latency
    or error details.
    """
    from homelab_cmd.api.schemas.ssh import SSHTestResponse
    from homelab_cmd.config import get_settings
    from homelab_cmd.db.models.config import Config
    from homelab_cmd.services.credential_service import CredentialService
    from homelab_cmd.services.host_key_service import HostKeyService
    from homelab_cmd.services.ssh_executor import SSHPooledExecutor

    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Verify server has Tailscale hostname
    if not server.tailscale_hostname:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_TAILSCALE_HOSTNAME",
                "message": f"Machine {server_id} has no Tailscale hostname",
            },
        )

    # Check SSH key is configured
    settings = get_settings()
    credential_service = CredentialService(session, settings.encryption_key or "")

    if not await credential_service.credential_exists("ssh_private_key"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_SSH_KEY",
                "message": "No SSH key configured. Upload a key in Settings > Connectivity.",
            },
        )

    # Get default username from config
    stmt = select(Config).where(Config.key == "ssh_username")
    result = await session.execute(stmt)
    config = result.scalar_one_or_none()
    username = config.value if config else "homelabcmd"

    # Test connection
    host_key_service = HostKeyService(session)
    executor = SSHPooledExecutor(credential_service, host_key_service)

    test_result = await executor.test_connection(
        hostname=server.tailscale_hostname,
        username=username,
        machine_id=server_id,
    )

    await session.commit()

    return SSHTestResponse(
        success=test_result.success,
        hostname=test_result.hostname,
        latency_ms=test_result.latency_ms,
        host_key_fingerprint=test_result.host_key_fingerprint,
        error=test_result.error,
        attempts=test_result.attempts,
    ).model_dump()


# ===========================================================================
# Pack Assignment Endpoints (US0121)
# ===========================================================================


def get_default_packs(machine_type: str) -> list[str]:
    """Get default packs based on machine type.

    Args:
        machine_type: Either 'server' or 'workstation'

    Returns:
        List of default pack names
    """
    if machine_type == "workstation":
        return ["base", "developer-lite"]
    return ["base"]


@router.get(
    "/{server_id}/config/packs",
    response_model=PackAssignmentResponse,
    operation_id="get_assigned_packs",
    summary="Get assigned configuration packs for a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_assigned_packs(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> PackAssignmentResponse:
    """Get configuration packs assigned to a server (US0121 AC3).

    Returns the list of assigned packs for this server.
    If assigned_packs is NULL, returns the default ["base"].
    """
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Handle NULL assigned_packs - treat as ["base"]
    assigned_packs = server.assigned_packs if server.assigned_packs else ["base"]

    return PackAssignmentResponse(
        server_id=server_id,
        assigned_packs=assigned_packs,
        drift_detection_enabled=server.drift_detection_enabled,
    )


@router.put(
    "/{server_id}/config/packs",
    response_model=PackAssignmentResponse,
    operation_id="update_assigned_packs",
    summary="Update assigned configuration packs for a server",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "Invalid pack assignment",
            "content": {
                "application/json": {
                    "examples": {
                        "base_required": {
                            "value": {
                                "detail": {
                                    "code": "BASE_PACK_REQUIRED",
                                    "message": "Base pack is required and cannot be removed",
                                }
                            }
                        },
                        "unknown_pack": {
                            "value": {
                                "detail": {
                                    "code": "UNKNOWN_PACK",
                                    "message": "Unknown pack: invalid-pack",
                                }
                            }
                        },
                    }
                }
            },
        },
    },
)
async def update_assigned_packs(
    server_id: str,
    request: PackAssignmentRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> PackAssignmentResponse:
    """Update configuration packs assigned to a server (US0121 AC2).

    Validates that:
    1. The base pack is always included
    2. All specified pack names are valid (exist in config-packs/)
    """
    from homelab_cmd.services.config_pack_service import ConfigPackService

    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Validate base pack is included
    if "base" not in request.packs:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BASE_PACK_REQUIRED",
                "message": "Base pack is required and cannot be removed",
            },
        )

    # Validate all pack names exist
    pack_service = ConfigPackService()
    available_packs = {p.name for p in pack_service.list_packs()}

    for pack_name in request.packs:
        if pack_name not in available_packs:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "UNKNOWN_PACK",
                    "message": f"Unknown pack: {pack_name}",
                },
            )

    # Update server's assigned packs
    server.assigned_packs = request.packs
    await session.flush()
    await session.refresh(server)

    return PackAssignmentResponse(
        server_id=server_id,
        assigned_packs=server.assigned_packs,
        drift_detection_enabled=server.drift_detection_enabled,
    )


# =============================================================================
# Historical Cost Tracking (US0183)
# =============================================================================


@router.get(
    "/{server_id}/costs/history",
    operation_id="get_server_cost_history",
    summary="Get cost history for a specific server",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "INVALID_PERIOD",
                            "message": "Invalid period. Must be one of: 7d, 30d, 90d, 12m",
                        }
                    }
                }
            },
        },
    },
)
async def get_server_cost_history(
    server_id: str,
    period: str = Query("30d", description="Period: 7d, 30d, 90d, or 12m"),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
):
    """Get historical cost data for a specific server.

    AC4: Per-server cost history.

    Args:
        server_id: The server identifier
        period: Time period ('7d', '30d', '90d', or '12m')

    Returns:
        Server cost history response
    """
    from homelab_cmd.api.routes.config import DEFAULT_COST, get_config_value
    from homelab_cmd.api.schemas.config import CostConfig
    from homelab_cmd.api.schemas.cost_history import (
        CostHistoryItem,
        ServerCostHistoryResponse,
    )
    from homelab_cmd.services.cost_history import CostHistoryService

    # Validate period
    valid_periods = ["7d", "30d", "90d", "12m"]
    if period not in valid_periods:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_PERIOD",
                "message": f"Invalid period. Must be one of: {', '.join(valid_periods)}",
            },
        )

    # Get cost configuration for currency symbol
    cost_data = await get_config_value(session, "cost")
    if cost_data:
        cost_config = CostConfig(**cost_data)
    else:
        cost_config = DEFAULT_COST

    # Get server cost history from service
    service = CostHistoryService(session)
    result = await service.get_server_history(server_id, period)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Convert to response schema
    items = [
        CostHistoryItem(
            date=item.date,
            estimated_kwh=item.estimated_kwh,
            estimated_cost=item.estimated_cost,
            electricity_rate=item.electricity_rate,
            server_id=item.server_id,
            server_hostname=item.server_hostname,
        )
        for item in result.items
    ]

    return ServerCostHistoryResponse(
        server_id=result.server_id,
        hostname=result.hostname,
        period=result.period,
        items=items,
        currency_symbol=cost_config.currency_symbol,
    )
