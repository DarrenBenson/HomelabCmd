"""Tailscale configuration and discovery API endpoints.

Part of EP0008: Tailscale Integration (US0076, US0077, US0078).

Provides endpoints for:
- Saving/removing Tailscale API tokens
- Testing connection to Tailscale API
- Checking configuration status
- Device discovery with caching (US0077)
- Device import as monitored server (US0078)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.tailscale import (
    TailscaleDeviceListResponse,
    TailscaleDeviceSchema,
    TailscaleImportCheckResponse,
    TailscaleImportedMachine,
    TailscaleImportRequest,
    TailscaleImportResponse,
    TailscaleStatusResponse,
    TailscaleTestResponse,
    TailscaleTokenRequest,
    TailscaleTokenResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.tailscale_service import (
    TailscaleAuthError,
    TailscaleCache,
    TailscaleConnectionError,
    TailscaleNotConfiguredError,
    TailscaleRateLimitError,
    TailscaleService,
)


def _get_credential_service(session: AsyncSession) -> CredentialService:
    """Create a CredentialService with the encryption key from settings.

    Args:
        session: Database session for credential operations.

    Returns:
        CredentialService instance configured with the encryption key.
    """
    settings = get_settings()
    return CredentialService(session, settings.encryption_key or "")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings/tailscale", tags=["Configuration"])


def _mask_token(token: str) -> str:
    """Mask a token for display, showing only first 8 characters.

    Args:
        token: The full token string.

    Returns:
        Masked token like "tskey-ap..." or first 8 chars + "...".
    """
    if len(token) <= 8:
        return token
    return f"{token[:8]}..."


@router.get(
    "/status",
    response_model=TailscaleStatusResponse,
    operation_id="get_tailscale_status",
    summary="Get Tailscale configuration status",
    responses={**AUTH_RESPONSES},
)
async def get_status(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleStatusResponse:
    """Get the current Tailscale configuration status.

    Returns whether a Tailscale API token is configured, and if so,
    shows a masked version of the token for identification.
    """
    credential_service = _get_credential_service(session)
    token = await credential_service.get_credential("tailscale_token")

    if token:
        return TailscaleStatusResponse(
            configured=True,
            masked_token=_mask_token(token),
        )

    return TailscaleStatusResponse(configured=False)


@router.post(
    "/token",
    response_model=TailscaleTokenResponse,
    operation_id="save_tailscale_token",
    summary="Save Tailscale API token",
    responses={
        **AUTH_RESPONSES,
        400: {"description": "Token cannot be empty"},
    },
)
async def save_token(
    request: TailscaleTokenRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleTokenResponse:
    """Save a Tailscale API token.

    The token is encrypted and stored in the database. It can be used
    for subsequent API calls to Tailscale for device discovery.

    Token format is not validated - invalid tokens will return 401
    when tested or used for API calls.
    """
    credential_service = _get_credential_service(session)
    await credential_service.store_credential("tailscale_token", request.token)
    await session.commit()

    logger.info("Tailscale API token saved")

    return TailscaleTokenResponse(
        success=True,
        message="Tailscale token saved",
    )


@router.delete(
    "/token",
    response_model=TailscaleTokenResponse,
    operation_id="remove_tailscale_token",
    summary="Remove Tailscale API token",
    responses={**AUTH_RESPONSES},
)
async def remove_token(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleTokenResponse:
    """Remove the stored Tailscale API token.

    After removal, Tailscale-based device discovery will be unavailable
    until a new token is configured.
    """
    credential_service = _get_credential_service(session)
    deleted = await credential_service.delete_credential("tailscale_token")
    await session.commit()

    if deleted:
        logger.info("Tailscale API token removed")
        return TailscaleTokenResponse(
            success=True,
            message="Tailscale token removed",
        )

    return TailscaleTokenResponse(
        success=True,
        message="No Tailscale token was configured",
    )


@router.post(
    "/test",
    response_model=TailscaleTestResponse,
    operation_id="test_tailscale_connection",
    summary="Test Tailscale API connection",
    responses={
        **AUTH_RESPONSES,
        503: {"description": "Connection to Tailscale API failed"},
    },
)
async def test_connection(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleTestResponse:
    """Test connection to the Tailscale API using the stored token.

    Validates the token by calling the Tailscale API to retrieve
    device information. Returns tailnet name and device count on success.

    Possible error codes:
    - TAILSCALE_NOT_CONFIGURED: No token has been saved
    - TAILSCALE_AUTH_ERROR: Token is invalid or lacks permissions
    - TAILSCALE_RATE_LIMIT: Too many requests to Tailscale API
    - TAILSCALE_CONNECTION_ERROR: Network or connection failure
    """
    credential_service = _get_credential_service(session)
    tailscale_service = TailscaleService(credential_service)

    try:
        result = await tailscale_service.test_connection()

        return TailscaleTestResponse(
            success=True,
            tailnet=result.tailnet,
            device_count=result.device_count,
            message=result.message,
        )

    except TailscaleNotConfiguredError:
        return TailscaleTestResponse(
            success=False,
            error="No Tailscale API token configured",
            code="TAILSCALE_NOT_CONFIGURED",
        )

    except TailscaleAuthError as e:
        return TailscaleTestResponse(
            success=False,
            error=str(e),
            code="TAILSCALE_AUTH_ERROR",
        )

    except TailscaleRateLimitError as e:
        return TailscaleTestResponse(
            success=False,
            error=str(e),
            code="TAILSCALE_RATE_LIMIT",
        )

    except TailscaleConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "TAILSCALE_CONNECTION_ERROR",
                "message": str(e),
            },
        ) from e

    finally:
        await tailscale_service.close()


# =============================================================================
# Device Discovery Router (US0077) and Import Router (US0078)
# =============================================================================

# Module-level cache instance (shared across requests)
_device_cache = TailscaleCache()

# Supported OS values for filtering
VALID_OS_VALUES = {"linux", "windows", "macos", "ios", "android"}

devices_router = APIRouter(prefix="/tailscale", tags=["Tailscale"])


@devices_router.get(
    "/devices",
    response_model=TailscaleDeviceListResponse,
    operation_id="list_tailscale_devices",
    summary="List Tailscale devices",
    responses={
        **AUTH_RESPONSES,
        401: {"description": "Tailscale token not configured or invalid"},
        503: {"description": "Connection to Tailscale API failed"},
    },
)
async def list_devices(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
    online: bool | None = Query(None, description="Filter by online status"),
    os: str | None = Query(None, description="Filter by OS (linux, windows, macos, ios, android)"),
    refresh: bool = Query(False, description="Bypass cache and fetch fresh data"),
) -> TailscaleDeviceListResponse:
    """List all devices in the Tailscale tailnet.

    Part of US0077: Tailscale Device Discovery.

    Returns a list of all devices with caching support. Results are cached
    for 5 minutes to avoid excessive API calls. Use refresh=true to bypass cache.

    Filtering:
    - online: Filter by online status (true/false)
    - os: Filter by OS type (linux, windows, macos, ios, android)
    - Filters can be combined

    Error codes:
    - TAILSCALE_NOT_CONFIGURED: No token has been saved
    - TAILSCALE_AUTH_ERROR: Token is invalid or expired
    - TAILSCALE_RATE_LIMIT: Too many requests to Tailscale API
    - TAILSCALE_CONNECTION_ERROR: Network or connection failure
    """
    credential_service = _get_credential_service(session)
    tailscale_service = TailscaleService(credential_service)

    try:
        # Get all server hostnames to check for already_imported
        result = await session.execute(select(Server.hostname))
        imported_hostnames = {row[0] for row in result.fetchall() if row[0]}

        # Get devices with caching
        device_list = await tailscale_service.get_devices_cached(
            cache=_device_cache,
            imported_hostnames=imported_hostnames,
            refresh=refresh,
        )

        devices = device_list.devices

        # Apply filters
        if online is not None:
            devices = [d for d in devices if d.online == online]

        if os is not None:
            # Validate OS value - ignore invalid values per edge case #7
            os_lower = os.lower()
            if os_lower in VALID_OS_VALUES:
                devices = [d for d in devices if d.os.lower() == os_lower]
            else:
                logger.warning("Invalid OS filter value ignored: %s", os)

        # Convert to response schema
        return TailscaleDeviceListResponse(
            devices=[
                TailscaleDeviceSchema(
                    id=d.id,
                    name=d.name,
                    hostname=d.hostname,
                    tailscale_ip=d.tailscale_ip,
                    os=d.os,
                    os_version=d.os_version,
                    last_seen=d.last_seen,
                    online=d.online,
                    authorized=d.authorized,
                    already_imported=d.already_imported,
                )
                for d in devices
            ],
            count=len(devices),
            cache_hit=device_list.cache_hit,
            cached_at=device_list.cached_at,
        )

    except TailscaleNotConfiguredError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "TAILSCALE_NOT_CONFIGURED",
                "message": "Tailscale API token not configured",
            },
        ) from None

    except TailscaleAuthError as e:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "TAILSCALE_AUTH_ERROR",
                "message": str(e),
            },
        ) from e

    except TailscaleRateLimitError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "TAILSCALE_RATE_LIMIT",
                "message": str(e),
                "retry_after": e.retry_after,
            },
        ) from e

    except TailscaleConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "TAILSCALE_CONNECTION_ERROR",
                "message": str(e),
            },
        ) from e

    finally:
        await tailscale_service.close()


# =============================================================================
# Device Import Endpoints (US0078)
# =============================================================================


@devices_router.post(
    "/import",
    response_model=TailscaleImportResponse,
    status_code=201,
    operation_id="import_tailscale_device",
    summary="Import Tailscale device as server",
    responses={
        **AUTH_RESPONSES,
        400: {"description": "Validation error"},
        409: {"description": "Machine with hostname already exists"},
    },
)
async def import_device(
    request: TailscaleImportRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleImportResponse:
    """Import a Tailscale device as a monitored server.

    Part of US0078: Machine Registration via Tailscale.

    Creates a new Server record with Tailscale-specific fields populated.
    The server_id is derived from the hostname (first segment, lowercase).

    Error codes:
    - DUPLICATE_MACHINE: A server with this tailscale_hostname already exists
    """
    # Check for duplicate by tailscale_hostname
    result = await session.execute(
        select(Server).where(Server.tailscale_hostname == request.tailscale_hostname)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_MACHINE",
                "message": f"A machine with hostname {request.tailscale_hostname} already exists",
                "existing_machine_id": existing.id,
            },
        )

    # Also check if server_id would collide (different tailscale hostname but same short name)
    server_id = request.tailscale_hostname.split(".")[0].lower()
    result = await session.execute(select(Server).where(Server.id == server_id))
    existing_by_id = result.scalar_one_or_none()
    if existing_by_id:
        # Append a suffix to make it unique
        import uuid

        server_id = f"{server_id}-{uuid.uuid4().hex[:6]}"

    # Create server record
    server = Server(
        id=server_id,
        hostname=request.tailscale_hostname,
        display_name=request.display_name,
        tailscale_hostname=request.tailscale_hostname,
        tailscale_device_id=request.tailscale_device_id,
        machine_type=request.machine_type,
        tdp_watts=request.tdp,
        machine_category=request.category_id,
    )
    session.add(server)
    await session.commit()
    await session.refresh(server)

    logger.info(
        "Imported Tailscale device as server: %s (%s)",
        server.display_name,
        server.tailscale_hostname,
    )

    return TailscaleImportResponse(
        success=True,
        machine=TailscaleImportedMachine(
            id=server.id,
            server_id=server.id,
            display_name=server.display_name or "",
            tailscale_hostname=server.tailscale_hostname or "",
            tailscale_device_id=server.tailscale_device_id or "",
            machine_type=server.machine_type,
            status=server.status,
            created_at=server.created_at,
        ),
        message=f"Imported {request.display_name} successfully",
    )


@devices_router.get(
    "/import/check",
    response_model=TailscaleImportCheckResponse,
    operation_id="check_tailscale_import",
    summary="Check if device is already imported",
    responses={**AUTH_RESPONSES},
)
async def check_import(
    hostname: str = Query(..., description="Tailscale hostname to check"),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleImportCheckResponse:
    """Check if a Tailscale device has already been imported.

    Part of US0078: Machine Registration via Tailscale.

    Returns import status and machine details if the device is already
    registered as a server.
    """
    result = await session.execute(
        select(Server).where(Server.tailscale_hostname == hostname)
    )
    server = result.scalar_one_or_none()

    if server:
        return TailscaleImportCheckResponse(
            imported=True,
            machine_id=server.id,
            display_name=server.display_name,
            imported_at=server.created_at,
        )

    return TailscaleImportCheckResponse(imported=False)
