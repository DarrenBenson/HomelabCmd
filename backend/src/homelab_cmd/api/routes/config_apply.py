"""Configuration pack apply and remove API endpoints.

Part of EP0010: Configuration Management:
- US0119: Apply Configuration Pack
- US0123: Remove Configuration Pack
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import get_async_session, verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.routes.config_packs import get_config_pack_service
from homelab_cmd.api.schemas.config_apply import (
    ApplyInitiatedResponse,
    ApplyPreviewResponse,
    ApplyRequest,
    ApplyStatusResponse,
    RemovePreviewResponse,
    RemoveRequest,
    RemoveResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models import ConfigApply
from homelab_cmd.db.session import get_session_factory
from homelab_cmd.services.config_apply_service import (
    ApplyAlreadyRunningError,
    ConfigApplyService,
    ServerNotFoundError,
    SSHUnavailableError,
)
from homelab_cmd.services.config_pack_service import ConfigPackError
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.ssh_executor import SSHPooledExecutor

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Configuration"])


def get_config_apply_service(
    session: AsyncSession,
) -> ConfigApplyService:
    """Get the config apply service instance.

    Args:
        session: Database session for credential and host key services.

    Returns:
        ConfigApplyService instance.
    """
    settings = get_settings()
    credential_service = CredentialService(session, settings.encryption_key or "")
    host_key_service = HostKeyService(session)
    ssh_executor = SSHPooledExecutor(credential_service, host_key_service)
    pack_service = get_config_pack_service()
    return ConfigApplyService(pack_service, ssh_executor)


async def run_apply_background(apply_id: int) -> None:
    """Run an apply operation in the background.

    Creates its own database session since this runs outside the request context.

    Args:
        apply_id: ID of the apply operation to execute.
    """
    session_maker = get_session_factory()

    async with session_maker() as session:
        try:
            # Fetch the apply record
            result = await session.execute(
                select(ConfigApply).where(ConfigApply.id == apply_id)
            )
            apply_record = result.scalar_one_or_none()

            if apply_record is None:
                logger.error("Apply %d not found for background execution", apply_id)
                return

            if not apply_record.is_pending:
                logger.warning(
                    "Apply %d is not pending (status=%s), skipping",
                    apply_id,
                    apply_record.status,
                )
                return

            # Create service and execute
            apply_service = get_config_apply_service(session)
            await apply_service.execute_apply(apply_record, session)

        except Exception as e:
            logger.exception("Background apply %d failed: %s", apply_id, e)
            # Try to update the apply status to failed
            try:
                result = await session.execute(
                    select(ConfigApply).where(ConfigApply.id == apply_id)
                )
                apply_record = result.scalar_one_or_none()
                if apply_record:
                    from datetime import UTC, datetime

                    from homelab_cmd.db.models import ConfigApplyStatus

                    apply_record.status = ConfigApplyStatus.FAILED.value
                    apply_record.error = str(e)
                    apply_record.completed_at = datetime.now(UTC)
                    await session.commit()
            except Exception:
                logger.exception("Failed to update apply status after error")


@router.post(
    "/servers/{server_id}/config/apply",
    response_model=ApplyInitiatedResponse | ApplyPreviewResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="apply_config_pack",
    summary="Apply a configuration pack to a server",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        409: {"description": "Apply operation already running for this server"},
    },
)
async def apply_config_pack(
    server_id: str,
    request: ApplyRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ApplyInitiatedResponse | ApplyPreviewResponse:
    """Apply a configuration pack to a server.

    Part of US0119: AC1 - Apply Endpoint, AC2 - Dry-Run Option.

    If dry_run=true, returns a preview of changes without applying.
    Otherwise, creates an apply operation and executes it in the background.

    Args:
        server_id: Server identifier.
        request: Apply request with pack_name and dry_run flag.
        background_tasks: FastAPI background tasks for async execution.

    Returns:
        ApplyPreviewResponse if dry_run=true, ApplyInitiatedResponse otherwise.

    Raises:
        404: Server or pack not found.
        409: Apply operation already running for server.
    """
    apply_service = get_config_apply_service(session)

    # Handle dry-run preview
    if request.dry_run:
        try:
            return await apply_service.get_preview(session, server_id, request.pack_name)
        except ServerNotFoundError as e:
            raise HTTPException(
                status_code=404, detail=f"Server not found: {server_id}"
            ) from e
        except ConfigPackError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e

    # Create and start apply operation
    try:
        apply_record = await apply_service.create_apply(
            session=session,
            server_id=server_id,
            pack_name=request.pack_name,
            triggered_by="user",
        )
    except ServerNotFoundError as e:
        raise HTTPException(
            status_code=404, detail=f"Server not found: {server_id}"
        ) from e
    except ApplyAlreadyRunningError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except ConfigPackError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    # Start background execution
    background_tasks.add_task(run_apply_background, apply_record.id)

    return ApplyInitiatedResponse(
        apply_id=apply_record.id,
        server_id=server_id,
        pack_name=request.pack_name,
        status=apply_record.status,
        started_at=apply_record.started_at,
    )


@router.get(
    "/servers/{server_id}/config/apply/{apply_id}",
    response_model=ApplyStatusResponse,
    operation_id="get_apply_status",
    summary="Get apply operation status",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_apply_status(
    server_id: str,
    apply_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ApplyStatusResponse:
    """Get the status and progress of an apply operation.

    Part of US0119: AC5 - Progress Tracking, AC6 - Result Details.

    Poll this endpoint to track apply progress and get results.

    Args:
        server_id: Server identifier.
        apply_id: Apply operation ID.

    Returns:
        ApplyStatusResponse with current status, progress, and results.

    Raises:
        404: Apply operation not found or doesn't belong to server.
    """
    apply_service = get_config_apply_service(session)
    apply_record = await apply_service.get_apply_status(session, apply_id)

    if not apply_record:
        raise HTTPException(
            status_code=404, detail=f"Apply operation {apply_id} not found"
        )

    if apply_record.server_id != server_id:
        raise HTTPException(
            status_code=404,
            detail=f"Apply operation {apply_id} does not belong to server {server_id}",
        )

    # Convert stored results back to ApplyItemResult format
    from homelab_cmd.api.schemas.config_apply import ApplyItemResult

    items = []
    if apply_record.results:
        for r in apply_record.results:
            items.append(
                ApplyItemResult(
                    item=r.get("item", ""),
                    action=r.get("action", ""),
                    success=r.get("success", False),
                    error=r.get("error"),
                )
            )

    return ApplyStatusResponse(
        apply_id=apply_record.id,
        server_id=apply_record.server_id,
        pack_name=apply_record.pack_name,
        status=apply_record.status,
        progress=apply_record.progress,
        current_item=apply_record.current_item,
        items_total=apply_record.items_total,
        items_completed=apply_record.items_completed,
        items_failed=apply_record.items_failed,
        items=items,
        started_at=apply_record.started_at,
        completed_at=apply_record.completed_at,
        error=apply_record.error,
    )


# US0123: Remove Configuration Pack endpoints


@router.delete(
    "/servers/{server_id}/config/apply",
    response_model=RemoveResponse | RemovePreviewResponse,
    operation_id="remove_config_pack",
    summary="Remove a configuration pack from a server",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        503: {"description": "SSH connection unavailable"},
    },
)
async def remove_config_pack(
    server_id: str,
    request: RemoveRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> RemoveResponse | RemovePreviewResponse:
    """Remove a configuration pack from a server.

    Part of US0123: AC1 - Remove Endpoint, AC5 - Confirmation Required.

    If confirm=false (default), returns a preview of items to remove.
    If confirm=true, executes the removal:
    - Files are deleted with backups created at {path}.homelabcmd.bak
    - Packages are NOT uninstalled (may break dependencies)
    - Environment variables are removed from shell config

    Args:
        server_id: Server identifier.
        request: Remove request with pack_name and confirm flag.

    Returns:
        RemovePreviewResponse if confirm=false, RemoveResponse if confirm=true.

    Raises:
        404: Server or pack not found.
        503: SSH connection unavailable.
    """
    apply_service = get_config_apply_service(session)

    # Handle preview mode (confirm=false)
    if not request.confirm:
        try:
            return await apply_service.get_remove_preview(
                session, server_id, request.pack_name
            )
        except ServerNotFoundError as e:
            raise HTTPException(
                status_code=404, detail=f"Server not found: {server_id}"
            ) from e
        except ConfigPackError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e

    # Execute removal (confirm=true)
    try:
        return await apply_service.remove_pack(session, server_id, request.pack_name)
    except ServerNotFoundError as e:
        raise HTTPException(
            status_code=404, detail=f"Server not found: {server_id}"
        ) from e
    except SSHUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ConfigPackError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
