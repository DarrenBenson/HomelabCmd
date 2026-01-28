"""Discovery API endpoints.

Provides endpoints for network device discovery.

US0041: Network Discovery
US0069: Service Discovery During Agent Installation
"""

import asyncio
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.discovery import (
    DiscoveredService,
    DiscoveryDevice,
    DiscoveryProgress,
    DiscoveryRequest,
    DiscoveryResponse,
    DiscoverySettings,
    DiscoverySettingsUpdate,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
)
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus
from homelab_cmd.db.session import get_async_session, get_session_factory
from homelab_cmd.services.discovery import get_discovery_service
from homelab_cmd.services.ssh import get_ssh_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discovery", tags=["Discovery"])

# =============================================================================
# Service Discovery (US0069)
# =============================================================================

# System services to filter out by default
SYSTEM_SERVICE_PATTERNS = [
    r"^systemd-",
    r"^dbus",
    r"^getty@",
    r"^ssh\.service$",
    r"^sshd$",
    r"^user@",
    r"^user-runtime-dir@",
    r"^polkit",
    r"^ModemManager",
    r"^NetworkManager",
    r"^accounts-daemon",
    r"^udisks",
    r"^upower",
    r"^avahi",
    r"^colord",
    r"^packagekit",
    r"^rsyslog",
    r"^cron",
    r"^snapd",
    r"^thermald",
    r"^irqbalance",
    r"^multipathd",
    r"^unattended-upgrades",
    r"^fwupd",
    r"^bolt",
    r"^switcheroo-control",
    r"^power-profiles-daemon",
    r"^rtkit-daemon",
    r"^wpa_supplicant",
    r"^cups",
    r"^bluetooth",
    r"^serial-getty@",
]


def is_system_service(name: str) -> bool:
    """Check if service is a system service that should be filtered."""
    for pattern in SYSTEM_SERVICE_PATTERNS:
        if re.match(pattern, name, re.IGNORECASE):
            return True
    return False


@router.post(
    "/services",
    response_model=ServiceDiscoveryResponse,
    operation_id="discover_services",
    summary="Discover running services on a remote host",
    responses={
        **AUTH_RESPONSES,
        502: {"description": "SSH connection failed"},
        504: {"description": "Discovery timed out"},
    },
)
async def discover_services(
    request: ServiceDiscoveryRequest,
    include_system: bool = False,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServiceDiscoveryResponse:
    """Discover running systemd services on a remote host via SSH.

    US0073: Added key_id support for SSH key selection.

    Returns a list of running services that can be selected for monitoring.
    System services (systemd-*, dbus, etc.) are filtered by default.

    Args:
        request: Service discovery request with SSH connection details.
        include_system: If True, include system services in results.
        session: Database session for loading key usernames.

    Returns:
        List of discovered services with name, status, and description.

    Raises:
        HTTPException: If SSH connection fails or times out.
    """
    ssh_service = get_ssh_service()

    # Validate key_id if provided (US0073)
    key_id = request.key_id
    if key_id and key_id.strip():
        key_id = key_id.strip()
        available_keys = ssh_service.get_available_keys()
        if key_id not in available_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SSH key '{key_id}' not found",
            )
    else:
        key_id = None

    # Load key_usernames from database (US0072/US0073)
    result = await session.execute(select(Config).where(Config.key == "ssh"))
    config = result.scalar_one_or_none()
    db_config = config.value if config else {}
    key_usernames = db_config.get("key_usernames", {})

    # Command to list running services with descriptions
    # Format: unit|sub-state|description
    command = (
        "systemctl list-units --type=service --state=running "
        "--no-legend --no-pager --plain | "
        "while read -r unit load active sub desc; do "
        'echo "$unit|$sub|$desc"; '
        "done"
    )

    try:
        logger.debug(
            "Service discovery for %s:%d as %s (key_id=%s)",
            request.hostname,
            request.port,
            request.username,
            key_id,
        )
        result = await ssh_service.execute_command(
            hostname=request.hostname,
            port=request.port,
            username=request.username,
            command=command,
            command_timeout=30,
            key_usernames=key_usernames,
            key_filter=key_id,
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Service discovery timed out after 30 seconds",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"SSH connection failed: {e}",
        ) from e

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list services: {result.stderr or result.error}",
        )

    services: list[DiscoveredService] = []
    filtered_count = 0

    for line in result.stdout.strip().split("\n"):
        if not line or "|" not in line:
            continue

        parts = line.split("|", 2)
        if len(parts) < 2:
            continue

        # Remove .service suffix from unit name
        name = parts[0].replace(".service", "").strip()
        service_status = parts[1].strip()
        description = parts[2].strip() if len(parts) > 2 else ""

        # Filter system services unless requested
        if not include_system and is_system_service(name):
            filtered_count += 1
            continue

        services.append(
            DiscoveredService(
                name=name,
                status=service_status,
                description=description,
            )
        )

    # Sort by name for consistent display
    services.sort(key=lambda s: s.name.lower())

    return ServiceDiscoveryResponse(
        services=services,
        total=len(services),
        filtered=filtered_count,
    )


# =============================================================================
# Network Discovery (US0041)
# =============================================================================

# Default discovery settings
DEFAULT_DISCOVERY_SETTINGS = DiscoverySettings()


async def get_discovery_config(session: AsyncSession) -> DiscoverySettings:
    """Get discovery settings from database or return defaults."""
    result = await session.execute(select(Config).where(Config.key == "discovery"))
    config = result.scalar_one_or_none()
    if config and config.value:
        return DiscoverySettings(**config.value)
    return DEFAULT_DISCOVERY_SETTINGS


def discovery_to_response(discovery: Discovery) -> DiscoveryResponse:
    """Convert Discovery model to response schema."""
    progress = None
    if discovery.status == DiscoveryStatus.RUNNING.value:
        progress = DiscoveryProgress(
            scanned=discovery.progress_scanned,
            total=discovery.progress_total,
            percent=discovery.progress_percent,
        )

    devices = None
    if discovery.status == DiscoveryStatus.COMPLETED.value and discovery.devices:
        devices = [DiscoveryDevice(**d) for d in discovery.devices]

    return DiscoveryResponse(
        discovery_id=discovery.id,
        status=discovery.status,
        subnet=discovery.subnet,
        started_at=discovery.started_at.isoformat() if discovery.started_at else None,
        completed_at=discovery.completed_at.isoformat() if discovery.completed_at else None,
        progress=progress,
        devices_found=discovery.devices_found,
        devices=devices,
        error=discovery.error,
    )


async def run_discovery_background(discovery_id: int, key_id: str | None = None) -> None:
    """Run discovery in background task.

    US0073: Network Discovery Key Selection - added key_id parameter.

    Uses a new database session for the background operation.

    Args:
        discovery_id: ID of the discovery to execute.
        key_id: Specific SSH key to use. If None, all keys are tried.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(select(Discovery).where(Discovery.id == discovery_id))
        discovery = result.scalar_one_or_none()
        if discovery is None:
            return

        service = get_discovery_service()
        await service.execute_discovery(discovery, session, key_id=key_id)


@router.post(
    "",
    response_model=DiscoveryResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="create_discovery",
    summary="Start a network discovery",
    responses={
        **AUTH_RESPONSES,
        400: {"description": "Invalid subnet, subnet too large, or SSH key not found"},
    },
)
async def start_discovery(
    request: DiscoveryRequest = DiscoveryRequest(),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> DiscoveryResponse:
    """Start a new network discovery scan.

    US0073: Network Discovery Key Selection - supports optional key_id parameter.

    If a discovery is already running, returns the existing discovery.

    Args:
        request: Optional discovery request with subnet and key_id override.
        session: Database session.

    Returns:
        Discovery response with ID and initial status.

    Raises:
        HTTPException: If subnet is invalid, too large, or key_id doesn't exist.
    """
    # Check for existing running discovery
    result = await session.execute(
        select(Discovery).where(
            Discovery.status.in_(
                [
                    DiscoveryStatus.PENDING.value,
                    DiscoveryStatus.RUNNING.value,
                ]
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return discovery_to_response(existing)

    # Get subnet from request or settings
    settings = await get_discovery_config(session)
    subnet = request.subnet or settings.default_subnet

    # Validate subnet
    service = get_discovery_service()
    try:
        service.parse_subnet(subnet)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    # Validate key_id if provided (US0073)
    key_id = request.key_id
    if key_id and key_id.strip():
        # Normalise empty string to None
        key_id = key_id.strip()
        ssh_service = get_ssh_service()
        available_keys = ssh_service.get_available_keys()
        if key_id not in available_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SSH key '{key_id}' not found",
            )
    else:
        key_id = None

    # Create discovery record
    discovery = Discovery(
        subnet=subnet,
        status=DiscoveryStatus.PENDING.value,
    )
    session.add(discovery)
    await session.commit()
    await session.refresh(discovery)

    # Start background task with key_id
    asyncio.create_task(run_discovery_background(discovery.id, key_id=key_id))

    return discovery_to_response(discovery)


@router.get(
    "/{discovery_id}",
    response_model=DiscoveryResponse,
    operation_id="get_discovery",
    summary="Get discovery status and results",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Discovery not found"},
    },
)
async def get_discovery(
    discovery_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> DiscoveryResponse:
    """Get discovery status and results by ID.

    Args:
        discovery_id: ID of the discovery.
        session: Database session.

    Returns:
        Discovery response with current status and results.

    Raises:
        HTTPException: If discovery not found.
    """
    result = await session.execute(select(Discovery).where(Discovery.id == discovery_id))
    discovery = result.scalar_one_or_none()

    if discovery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Discovery {discovery_id} not found",
        )

    return discovery_to_response(discovery)


# Settings endpoint under /settings/discovery
settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.get(
    "/discovery",
    response_model=DiscoverySettings,
    operation_id="get_discovery_settings",
    summary="Get discovery settings",
    responses={**AUTH_RESPONSES},
)
async def get_discovery_settings(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> DiscoverySettings:
    """Get discovery settings including default subnet.

    Returns:
        Discovery settings.
    """
    return await get_discovery_config(session)


@settings_router.put(
    "/discovery",
    response_model=DiscoverySettings,
    operation_id="update_discovery_settings",
    summary="Update discovery settings",
    responses={
        **AUTH_RESPONSES,
        400: {"description": "Invalid subnet format"},
    },
)
async def update_discovery_settings(
    update: DiscoverySettingsUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> DiscoverySettings:
    """Update discovery settings.

    Args:
        update: Settings to update.
        session: Database session.

    Returns:
        Updated discovery settings.

    Raises:
        HTTPException: If subnet format is invalid.
    """
    # Get current settings
    current = await get_discovery_config(session)

    # Validate subnet if provided
    if update.default_subnet is not None:
        service = get_discovery_service()
        try:
            service.parse_subnet(update.default_subnet)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e

    # Build updated settings
    new_settings = DiscoverySettings(
        default_subnet=update.default_subnet or current.default_subnet,
        timeout_ms=update.timeout_ms if update.timeout_ms is not None else current.timeout_ms,
    )

    # Save to database
    result = await session.execute(select(Config).where(Config.key == "discovery"))
    config = result.scalar_one_or_none()

    if config:
        config.value = new_settings.model_dump()
    else:
        config = Config(key="discovery", value=new_settings.model_dump())
        session.add(config)

    await session.commit()

    return new_settings
