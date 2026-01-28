"""Scan API endpoints for ad-hoc device scanning.

Provides endpoints for SSH configuration, connection testing, and scan execution.
This is the foundation for EP0006: Ad-hoc Scanning.

US0037: SSH Key Configuration
US0038: Scan Initiation
US0040: Scan History View
US0071: SSH Key Manager UI
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.scan import (
    ScanInitiatedResponse,
    ScanListResponse,
    ScanRequest,
    ScanStatusResponse,
    SetDefaultKeyResponse,
    SSHConfig,
    SSHConfigResponse,
    SSHConfigUpdate,
    SSHKeyListResponse,
    SSHKeyMetadata,
    SSHKeyUploadRequest,
    TestConnectionRequest,
    TestConnectionResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.scan import Scan, ScanStatus, ScanType
from homelab_cmd.db.session import get_async_session, get_session_factory
from homelab_cmd.services.scan import get_scan_service
from homelab_cmd.services.ssh import SSHKeyError, get_ssh_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Scanning"])

# Config key for SSH settings stored in database
SSH_CONFIG_KEY = "ssh"


async def get_ssh_config_value(session: AsyncSession) -> dict | None:
    """Get SSH configuration from database."""
    result = await session.execute(select(Config).where(Config.key == SSH_CONFIG_KEY))
    config = result.scalar_one_or_none()
    return config.value if config else None


async def set_ssh_config_value(session: AsyncSession, value: dict) -> None:
    """Set SSH configuration in database (upsert)."""
    result = await session.execute(select(Config).where(Config.key == SSH_CONFIG_KEY))
    config = result.scalar_one_or_none()

    if config:
        config.value = value
    else:
        config = Config(key=SSH_CONFIG_KEY, value=value)
        session.add(config)

    await session.flush()


@router.get(
    "/settings/ssh",
    response_model=SSHConfig,
    operation_id="get_ssh_settings",
    summary="Get SSH configuration",
    responses={**AUTH_RESPONSES},
)
async def get_ssh_settings(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHConfig:
    """Get current SSH configuration for ad-hoc scanning.

    Returns the SSH key path, discovered keys, and default connection settings.
    The key_path is configured via environment variable HOMELAB_CMD_SSH_KEY_PATH.
    """
    settings = get_settings()
    ssh_service = get_ssh_service()

    # Get database overrides
    db_config = await get_ssh_config_value(session)

    # Merge settings: environment defaults + database overrides
    default_username = settings.ssh_default_username
    default_port = settings.ssh_default_port

    if db_config:
        default_username = db_config.get("default_username", default_username)
        default_port = db_config.get("default_port", default_port)

    return SSHConfig(
        key_path=str(settings.ssh_key_path),
        keys_found=ssh_service.get_available_keys(),
        default_username=default_username,
        default_port=default_port,
    )


@router.put(
    "/settings/ssh",
    response_model=SSHConfigResponse,
    operation_id="update_ssh_settings",
    summary="Update SSH configuration",
    responses={**AUTH_RESPONSES},
)
async def update_ssh_settings(
    update: SSHConfigUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHConfigResponse:
    """Update SSH configuration for ad-hoc scanning.

    Allows updating the default username and port for SSH connections.
    The key_path cannot be changed (set via environment variable).

    Partial updates are supported - only provided fields are updated.
    """
    settings = get_settings()
    ssh_service = get_ssh_service()

    # Get current config from database
    current_config = await get_ssh_config_value(session) or {}
    updated_fields: list[str] = []

    # Apply updates
    if update.default_username is not None:
        if current_config.get("default_username") != update.default_username:
            current_config["default_username"] = update.default_username
            updated_fields.append("default_username")

    if update.default_port is not None:
        if current_config.get("default_port") != update.default_port:
            current_config["default_port"] = update.default_port
            updated_fields.append("default_port")

    # Save if changes were made
    if updated_fields:
        await set_ssh_config_value(session, current_config)
        await session.commit()

    # Return current state
    return SSHConfigResponse(
        updated=updated_fields,
        config=SSHConfig(
            key_path=str(settings.ssh_key_path),
            keys_found=ssh_service.get_available_keys(),
            default_username=current_config.get("default_username", settings.ssh_default_username),
            default_port=current_config.get("default_port", settings.ssh_default_port),
        ),
    )


# =============================================================================
# US0071: SSH Key Management Endpoints
# =============================================================================


@router.get(
    "/settings/ssh/keys",
    response_model=SSHKeyListResponse,
    operation_id="list_ssh_keys",
    summary="List SSH keys with metadata",
    responses={**AUTH_RESPONSES},
)
async def list_ssh_keys(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHKeyListResponse:
    """List all configured SSH keys with their metadata.

    US0071: SSH Key Manager UI - AC1
    US0072: SSH Key Username Association
    US0093: Unified SSH Key Management - includes is_default field

    Returns key metadata (name, type, fingerprint, created date, username, is_default)
    but NEVER returns the private key content.
    """
    ssh_service = get_ssh_service()

    # Get config including default_key_id and key_usernames
    db_config = await get_ssh_config_value(session) or {}
    default_key_id = db_config.get("default_key_id")
    key_usernames = db_config.get("key_usernames", {})

    # Get keys with default status
    keys = ssh_service.list_keys_with_metadata(default_key_id=default_key_id)

    return SSHKeyListResponse(
        keys=[
            SSHKeyMetadata(
                id=key.id,
                name=key.name,
                type=key.type,
                fingerprint=key.fingerprint,
                created_at=key.created_at,
                username=key_usernames.get(key.id),
                is_default=key.is_default,
            )
            for key in keys
        ]
    )


@router.post(
    "/settings/ssh/keys",
    response_model=SSHKeyMetadata,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_ssh_key",
    summary="Upload an SSH private key",
    responses={
        **AUTH_RESPONSES,
        400: {"description": "Invalid key format or password-protected"},
        409: {"description": "Key with same name already exists"},
    },
)
async def upload_ssh_key(
    request: SSHKeyUploadRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SSHKeyMetadata:
    """Upload a new SSH private key.

    US0071: SSH Key Manager UI - AC2
    US0072: SSH Key Username Association

    The key name will be sanitised to contain only safe characters
    (alphanumeric, underscore, hyphen). The key file will be stored
    with 600 permissions.

    Note: Password-protected keys are not supported.
    """
    ssh_service = get_ssh_service()

    try:
        key_metadata = ssh_service.upload_key(request.name, request.private_key)

        # Store username in database if provided
        if request.username:
            db_config = await get_ssh_config_value(session) or {}
            key_usernames = db_config.get("key_usernames", {})
            key_usernames[key_metadata.id] = request.username
            db_config["key_usernames"] = key_usernames
            await set_ssh_config_value(session, db_config)
            await session.commit()

        return SSHKeyMetadata(
            id=key_metadata.id,
            name=key_metadata.name,
            type=key_metadata.type,
            fingerprint=key_metadata.fingerprint,
            created_at=key_metadata.created_at,
            username=request.username,
        )
    except SSHKeyError as e:
        error_message = str(e)
        if "already exists" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=error_message,
            ) from None
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message,
        ) from None


@router.delete(
    "/settings/ssh/keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_ssh_key",
    summary="Delete an SSH key",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Key not found"},
    },
)
async def delete_ssh_key(
    key_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> None:
    """Delete an SSH key by ID.

    US0071: SSH Key Manager UI - AC3
    US0072: SSH Key Username Association
    US0093: Unified SSH Key Management - auto-promotes default if deleted key was default

    Permanently removes the key file from the server and its username association.
    If the deleted key was the default, the next available key is promoted to default.
    """
    ssh_service = get_ssh_service()

    try:
        # Get the sanitised key ID that will be deleted
        sanitised_key_id = ssh_service.sanitise_key_name(key_id)

        # Get config before deletion
        db_config = await get_ssh_config_value(session) or {}
        was_default = db_config.get("default_key_id") == sanitised_key_id

        # Delete the key
        ssh_service.delete_key(key_id)

        # Remove username from database if present
        key_usernames = db_config.get("key_usernames", {})
        if sanitised_key_id in key_usernames:
            del key_usernames[sanitised_key_id]
            db_config["key_usernames"] = key_usernames

        # Auto-promote default if needed (US0093 - Edge Case 4)
        if was_default:
            next_key = ssh_service.get_next_available_key(exclude_key_id=sanitised_key_id)
            if next_key:
                db_config["default_key_id"] = next_key
                logger.info("Auto-promoted '%s' as new default key", next_key)
            else:
                # No keys remaining, clear default
                db_config.pop("default_key_id", None)
                logger.info("No remaining keys, cleared default_key_id")

        await set_ssh_config_value(session, db_config)
        await session.commit()
    except SSHKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from None


@router.put(
    "/settings/ssh/keys/{key_id}/default",
    response_model=SetDefaultKeyResponse,
    operation_id="set_default_ssh_key",
    summary="Set a key as the default SSH key",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Key not found"},
    },
)
async def set_default_ssh_key(
    key_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SetDefaultKeyResponse:
    """Set an SSH key as the default key for operations.

    US0093: Unified SSH Key Management - AC5

    The default key is auto-selected when no specific key is requested.
    Only one key can be the default at a time.

    Args:
        key_id: The key identifier (filename) to set as default.

    Returns:
        SetDefaultKeyResponse with success status and message.
    """
    ssh_service = get_ssh_service()

    # Sanitise and validate the key exists
    sanitised_key_id = ssh_service.sanitise_key_name(key_id)
    if not ssh_service.key_exists(sanitised_key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SSH key '{key_id}' not found",
        )

    # Update the default_key_id in config
    db_config = await get_ssh_config_value(session) or {}
    db_config["default_key_id"] = sanitised_key_id
    await set_ssh_config_value(session, db_config)
    await session.commit()

    logger.info("Set '%s' as default SSH key", sanitised_key_id)

    return SetDefaultKeyResponse(
        success=True,
        message=f"Key '{sanitised_key_id}' set as default",
    )


@router.post(
    "/scan/test",
    response_model=TestConnectionResponse,
    operation_id="test_ssh_connection",
    summary="Test SSH connection to a host",
    responses={**AUTH_RESPONSES},
)
async def test_ssh_connection(
    request: TestConnectionRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TestConnectionResponse:
    """Test SSH connection to a remote host.

    Attempts to connect to the specified host using configured SSH keys.
    Keys are tried in order (Ed25519, ECDSA, RSA, DSA) until one succeeds.

    Uses the default username and port from configuration if not specified.
    Per-key username associations are used when available (US0072).

    Returns:
        - status: "success" or "failed"
        - remote_hostname: hostname reported by the remote system (on success)
        - response_time_ms: connection time in milliseconds (on success)
        - error: error message (on failure)
    """
    settings = get_settings()
    ssh_service = get_ssh_service()

    # Get config overrides from database
    db_config = await get_ssh_config_value(session) or {}

    # Determine connection parameters
    username = request.username
    if username is None:
        username = db_config.get("default_username", settings.ssh_default_username)

    port = request.port
    if port is None:
        port = db_config.get("default_port", settings.ssh_default_port)

    # Get key_usernames for per-key username associations (US0072)
    key_usernames = db_config.get("key_usernames", {})

    # Test the connection
    result = await ssh_service.test_connection(
        hostname=request.hostname,
        port=port,
        username=username,
        key_usernames=key_usernames,
    )

    return TestConnectionResponse(
        status="success" if result.success else "failed",
        hostname=result.hostname,
        remote_hostname=result.remote_hostname,
        response_time_ms=result.response_time_ms,
        error=result.error,
    )


# =============================================================================
# US0038: Scan Initiation Endpoints
# =============================================================================


async def run_scan_background(scan_id: int) -> None:
    """Run a scan in the background.

    Creates its own database session since this runs outside the request context.

    Args:
        scan_id: ID of the scan to execute.
    """
    session_maker = get_session_factory()
    scan_service = get_scan_service()

    async with session_maker() as session:
        try:
            # Fetch the scan record
            result = await session.execute(select(Scan).where(Scan.id == scan_id))
            scan = result.scalar_one_or_none()

            if scan is None:
                logger.error("Scan %d not found for background execution", scan_id)
                return

            if scan.status != ScanStatus.PENDING.value:
                logger.warning("Scan %d is not pending (status=%s), skipping", scan_id, scan.status)
                return

            # Execute the scan
            await scan_service.execute_scan(scan, session)

        except Exception as e:
            logger.exception("Background scan %d failed: %s", scan_id, e)
            # Try to update the scan status to failed
            try:
                result = await session.execute(select(Scan).where(Scan.id == scan_id))
                scan = result.scalar_one_or_none()
                if scan:
                    scan.status = ScanStatus.FAILED.value
                    scan.error = str(e)
                    await session.commit()
            except Exception:
                logger.exception("Failed to update scan status after error")


@router.post(
    "/scans",
    response_model=ScanInitiatedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="create_scan",
    summary="Initiate a scan on a remote host",
    responses={**AUTH_RESPONSES},
)
async def initiate_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ScanInitiatedResponse:
    """Initiate a scan on a remote host via SSH.

    Creates a scan record and starts the scan in the background.
    Returns immediately with the scan ID for status polling.

    US0038: Scan Initiation

    Scan types:
    - quick: Basic system info (OS, hostname, uptime, disk, memory)
    - full: Detailed info (includes packages, processes, network interfaces)

    Returns:
        202 Accepted with scan_id for polling status.
    """
    settings = get_settings()

    # Get config overrides from database
    db_config = await get_ssh_config_value(session) or {}

    # Determine connection parameters
    username = request.username
    if username is None:
        username = db_config.get("default_username", settings.ssh_default_username)

    port = request.port
    if port is None:
        port = db_config.get("default_port", settings.ssh_default_port)

    # Validate scan type
    scan_type = request.scan_type
    if scan_type not in [ScanType.QUICK.value, ScanType.FULL.value]:
        scan_type = ScanType.QUICK.value

    # Create scan record
    scan = Scan(
        hostname=request.hostname,
        port=port,
        username=username,
        scan_type=scan_type,
        status=ScanStatus.PENDING.value,
        progress=0,
    )
    session.add(scan)
    await session.commit()
    await session.refresh(scan)

    # Start scan in background
    background_tasks.add_task(run_scan_background, scan.id)

    return ScanInitiatedResponse(
        scan_id=scan.id,
        status=scan.status,
        hostname=scan.hostname,
        scan_type=scan.scan_type,
        started_at=scan.started_at,
    )


@router.get(
    "/scans/{scan_id}",
    response_model=ScanStatusResponse,
    operation_id="get_scan_status",
    summary="Get scan status and results",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Scan not found"},
    },
)
async def get_scan_status(
    scan_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ScanStatusResponse:
    """Get the status and results of a scan.

    US0038: Scan Initiation

    Returns the current status, progress, and results (when completed).
    Poll this endpoint to track scan progress.

    Returns:
        - status: pending, running, completed, or failed
        - progress: 0-100 percentage
        - current_step: description of current operation (while running)
        - results: scan data (when completed)
        - error: error message (when failed)
    """
    result = await session.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()

    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan {scan_id} not found",
        )

    return ScanStatusResponse(
        scan_id=scan.id,
        status=scan.status,
        hostname=scan.hostname,
        scan_type=scan.scan_type,
        progress=scan.progress,
        current_step=scan.current_step,
        started_at=scan.started_at,
        completed_at=scan.completed_at,
        results=scan.results,
        error=scan.error,
    )


@router.get(
    "/scans",
    response_model=ScanListResponse,
    operation_id="list_scans",
    summary="List recent scans",
    responses={**AUTH_RESPONSES},
)
async def list_scans(
    limit: int = 20,
    offset: int = 0,
    hostname: str | None = None,
    scan_status: str | None = None,
    scan_type: str | None = None,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ScanListResponse:
    """List recent scans with optional filtering.

    US0038: Scan Initiation
    US0040: Scan History View

    Args:
        limit: Maximum number of scans to return (default 20, max 100).
        offset: Number of scans to skip for pagination.
        hostname: Optional hostname filter.
        scan_status: Optional status filter (completed, failed, pending, running).
        scan_type: Optional scan type filter (quick, full).

    Returns:
        List of scans ordered by creation time (newest first).
    """
    # Clamp limit
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    # Build query with filters
    query = select(Scan).order_by(desc(Scan.created_at))

    if hostname:
        query = query.where(Scan.hostname == hostname)

    if scan_status and scan_status in [s.value for s in ScanStatus]:
        query = query.where(Scan.status == scan_status)

    if scan_type and scan_type in [t.value for t in ScanType]:
        query = query.where(Scan.scan_type == scan_type)

    # Get total count with same filters
    count_query = select(Scan)
    if hostname:
        count_query = count_query.where(Scan.hostname == hostname)
    if scan_status and scan_status in [s.value for s in ScanStatus]:
        count_query = count_query.where(Scan.status == scan_status)
    if scan_type and scan_type in [t.value for t in ScanType]:
        count_query = count_query.where(Scan.scan_type == scan_type)

    count_result = await session.execute(count_query)
    total = len(count_result.scalars().all())

    # Get paginated results
    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    scans = result.scalars().all()

    return ScanListResponse(
        scans=[
            ScanStatusResponse(
                scan_id=scan.id,
                status=scan.status,
                hostname=scan.hostname,
                scan_type=scan.scan_type,
                progress=scan.progress,
                current_step=scan.current_step,
                started_at=scan.started_at,
                completed_at=scan.completed_at,
                results=scan.results,
                error=scan.error,
            )
            for scan in scans
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


# =============================================================================
# US0040: Scan History View - Delete Endpoint
# =============================================================================


@router.delete(
    "/scans/{scan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_scan",
    summary="Delete a scan",
    responses={
        **AUTH_RESPONSES,
        404: {"description": "Scan not found"},
    },
)
async def delete_scan(
    scan_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> None:
    """Delete a scan record.

    US0040: Scan History View

    Permanently removes a scan and its results from the database.
    This action cannot be undone.

    Returns:
        204 No Content on success.
        404 Not Found if scan does not exist.
    """
    result = await session.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()

    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan {scan_id} not found",
        )

    await session.delete(scan)
    await session.commit()
