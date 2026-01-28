"""Connectivity Settings API endpoints for US0080.

Provides endpoints for managing connectivity mode (Tailscale vs Direct SSH).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.connectivity import (
    ConnectivityStatusBarResponse,
    ConnectivityStatusResponse,
    ConnectivityUpdateRequest,
    ConnectivityUpdateResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.connectivity_service import (
    ConnectivityService,
    TailscaleTokenRequiredError,
)
from homelab_cmd.services.credential_service import CredentialService

router = APIRouter(prefix="/settings/connectivity", tags=["Configuration"])


def _get_credential_service(session: AsyncSession) -> CredentialService:
    """Create CredentialService with encryption key from settings."""
    settings = get_settings()
    return CredentialService(session, settings.encryption_key or "")


def _get_connectivity_service(
    session: AsyncSession,
    credential_service: CredentialService,
) -> ConnectivityService:
    """Create ConnectivityService with dependencies."""
    return ConnectivityService(session, credential_service)


@router.get(
    "",
    response_model=ConnectivityStatusResponse,
    responses=AUTH_RESPONSES,
    summary="Get connectivity status",
    description="Get current connectivity mode and configuration status.",
    operation_id="get_connectivity_status",
)
async def get_connectivity_status(
    _: str = Depends(verify_api_key),
    session: AsyncSession = Depends(get_async_session),
) -> ConnectivityStatusResponse:
    """Get full connectivity configuration status.

    Returns current mode, Tailscale connection info, and SSH configuration.
    Mode is auto-detected if not explicitly set.
    """
    credential_service = _get_credential_service(session)
    service = _get_connectivity_service(session, credential_service)

    return await service.get_connectivity_status()


@router.put(
    "",
    response_model=ConnectivityUpdateResponse,
    responses={
        **AUTH_RESPONSES,
        400: {
            "description": "Tailscale mode requires valid token",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "TAILSCALE_TOKEN_REQUIRED",
                            "message": "Tailscale mode requires a valid API token",
                        }
                    }
                }
            },
        },
    },
    summary="Update connectivity mode",
    description="Update connectivity mode and SSH username.",
    operation_id="update_connectivity_mode",
)
async def update_connectivity_mode(
    request: ConnectivityUpdateRequest,
    _: str = Depends(verify_api_key),
    session: AsyncSession = Depends(get_async_session),
) -> ConnectivityUpdateResponse:
    """Update connectivity mode.

    Validates that Tailscale mode requires a valid API token.
    Clears SSH connection pool on mode change.
    """
    credential_service = _get_credential_service(session)
    service = _get_connectivity_service(session, credential_service)

    try:
        result = await service.update_connectivity_mode(
            request.mode, request.ssh_username
        )
        await session.commit()
        return result
    except TailscaleTokenRequiredError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "TAILSCALE_TOKEN_REQUIRED",
                "message": str(e),
            },
        ) from None


@router.get(
    "/status",
    response_model=ConnectivityStatusBarResponse,
    responses=AUTH_RESPONSES,
    summary="Get connectivity status bar info",
    description="Get minimal status for dashboard status bar.",
    operation_id="get_connectivity_status_bar",
)
async def get_connectivity_status_bar(
    _: str = Depends(verify_api_key),
    session: AsyncSession = Depends(get_async_session),
) -> ConnectivityStatusBarResponse:
    """Get minimal status for dashboard status bar.

    Returns mode, display text, and healthy status.
    Used by frontend dashboard header.
    """
    credential_service = _get_credential_service(session)
    service = _get_connectivity_service(session, credential_service)

    return await service.get_status_bar_info()
