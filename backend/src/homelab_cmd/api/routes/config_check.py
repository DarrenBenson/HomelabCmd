"""Configuration compliance check API endpoints.

Part of EP0010: Configuration Management - US0117 Configuration Compliance Checker.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import get_async_session, verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.routes.config_packs import get_config_pack_service
from homelab_cmd.api.schemas.config_check import (
    ComplianceMachineSummary,
    ComplianceSummaryResponse,
    ComplianceSummaryStats,
    ConfigCheckHistoryItem,
    ConfigCheckHistoryResponse,
    ConfigCheckRequest,
    ConfigCheckResponse,
    ConfigDiffResponse,
    DiffMismatchItem,
    DiffSummary,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models import ConfigCheck, Server
from homelab_cmd.services.compliance_service import (
    ComplianceCheckService,
    SSHUnavailableError,
)
from homelab_cmd.services.config_pack_service import ConfigPackError, ConfigPackService
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.ssh_executor import SSHPooledExecutor

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Configuration"])

# Service instances (singletons)
_ssh_executor: SSHPooledExecutor | None = None
_compliance_service: ComplianceCheckService | None = None


def get_ssh_executor(
    session: AsyncSession = Depends(get_async_session),
) -> SSHPooledExecutor:
    """Get the SSH executor instance."""
    global _ssh_executor
    if _ssh_executor is None:
        settings = get_settings()
        credential_service = CredentialService(session, settings.encryption_key or "")
        host_key_service = HostKeyService(session)
        _ssh_executor = SSHPooledExecutor(credential_service, host_key_service)
    return _ssh_executor


def get_compliance_service(
    pack_service: ConfigPackService = Depends(get_config_pack_service),
    ssh_executor: SSHPooledExecutor = Depends(get_ssh_executor),
) -> ComplianceCheckService:
    """Get the compliance check service instance."""
    return ComplianceCheckService(pack_service, ssh_executor)


@router.post(
    "/servers/{server_id}/config/check",
    response_model=ConfigCheckResponse,
    operation_id="check_server_compliance",
    summary="Check server configuration compliance",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        503: {"description": "SSH connection unavailable"},
    },
)
async def check_compliance(
    server_id: str,
    request: ConfigCheckRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ConfigCheckResponse:
    """Check a server's configuration compliance against a pack.

    Connects to the server via SSH and verifies:
    - File existence, permissions, and content hashes
    - Package installation status and versions
    - Environment variable values

    Args:
        server_id: Server identifier
        request: Request containing pack_name

    Returns:
        Compliance check result with any mismatches found.

    Raises:
        404: Server or pack not found
        503: SSH connection unavailable
    """
    # Get server
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(status_code=404, detail=f"Server not found: {server_id}")

    # Create service instances with session
    settings = get_settings()
    credential_service = CredentialService(session, settings.encryption_key or "")
    host_key_service = HostKeyService(session)
    ssh_executor = SSHPooledExecutor(credential_service, host_key_service)
    pack_service = get_config_pack_service()
    compliance_service = ComplianceCheckService(pack_service, ssh_executor)

    try:
        return await compliance_service.check_compliance(
            session=session,
            server=server,
            pack_name=request.pack_name,
        )
    except ConfigPackError as e:
        logger.warning("Pack not found for compliance check: %s", e)
        raise HTTPException(status_code=404, detail=str(e)) from e
    except SSHUnavailableError as e:
        logger.warning("SSH unavailable for server %s: %s", server_id, e)
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get(
    "/servers/{server_id}/config/checks",
    response_model=ConfigCheckHistoryResponse,
    operation_id="get_server_compliance_history",
    summary="Get server compliance check history",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_compliance_history(
    server_id: str,
    limit: int = 10,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ConfigCheckHistoryResponse:
    """Get compliance check history for a server.

    Args:
        server_id: Server identifier
        limit: Maximum number of checks to return

    Returns:
        List of past compliance checks for the server.
    """
    # Verify server exists
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(status_code=404, detail=f"Server not found: {server_id}")

    # Get recent checks
    result = await session.execute(
        select(ConfigCheck)
        .where(ConfigCheck.server_id == server_id)
        .order_by(ConfigCheck.checked_at.desc())
        .limit(limit)
    )
    checks = result.scalars().all()

    return ConfigCheckHistoryResponse(
        server_id=server_id,
        checks=[
            ConfigCheckHistoryItem(
                id=check.id,
                pack_name=check.pack_name,
                is_compliant=check.is_compliant,
                mismatch_count=len(check.mismatches) if check.mismatches else 0,
                checked_at=check.checked_at,
                check_duration_ms=check.check_duration_ms,
            )
            for check in checks
        ],
        total=len(checks),
    )


def _get_mismatch_category(mismatch_type: str) -> str:
    """Map mismatch type to category.

    Args:
        mismatch_type: The type of mismatch.

    Returns:
        Category string: 'files', 'packages', or 'settings'.
    """
    if mismatch_type in ("missing_file", "wrong_permissions", "wrong_content"):
        return "files"
    elif mismatch_type in ("missing_package", "wrong_version"):
        return "packages"
    else:
        return "settings"


@router.get(
    "/servers/{server_id}/config/diff",
    response_model=ConfigDiffResponse,
    operation_id="get_config_diff",
    summary="Get configuration diff for a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_config_diff(
    server_id: str,
    pack: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ConfigDiffResponse:
    """Get configuration diff view for a server.

    Returns the most recent compliance check result formatted as a diff view
    with summary statistics and categorised mismatches.

    Part of EP0010: Configuration Management - US0118 Configuration Diff View.

    Args:
        server_id: Server identifier.
        pack: Name of the configuration pack to get diff for.

    Returns:
        ConfigDiffResponse with summary and categorised mismatches.

    Raises:
        404: Server not found or no compliance check exists for pack.
    """
    # Verify server exists
    result = await session.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(status_code=404, detail=f"Server not found: {server_id}")

    # Get most recent compliance check for this pack
    result = await session.execute(
        select(ConfigCheck)
        .where(ConfigCheck.server_id == server_id)
        .where(ConfigCheck.pack_name == pack)
        .order_by(ConfigCheck.checked_at.desc())
        .limit(1)
    )
    check = result.scalar_one_or_none()

    if not check:
        raise HTTPException(
            status_code=404,
            detail=f"No compliance check found for server {server_id} with pack {pack}",
        )

    # Convert mismatches to enhanced format with categories
    mismatches_raw = check.mismatches or []
    mismatches = [
        DiffMismatchItem(
            type=m.get("type", "wrong_setting"),
            category=_get_mismatch_category(m.get("type", "wrong_setting")),
            item=m.get("item", ""),
            expected=m.get("expected", {}),
            actual=m.get("actual", {}),
            diff=m.get("diff"),
        )
        for m in mismatches_raw
    ]

    # Calculate summary statistics
    # Note: total_items is estimated from mismatches + compliant (we mark all as mismatched for now)
    mismatch_count = len(mismatches)
    summary = DiffSummary(
        total_items=mismatch_count,  # Simplified - we only track mismatches
        compliant=0 if mismatch_count > 0 else 1,
        mismatched=mismatch_count,
    )

    return ConfigDiffResponse(
        server_id=server_id,
        pack_name=check.pack_name,
        is_compliant=check.is_compliant,
        summary=summary,
        mismatches=mismatches,
        checked_at=check.checked_at,
    )


# US0120: Compliance Dashboard Widget endpoint


@router.get(
    "/config/compliance",
    response_model=ComplianceSummaryResponse,
    operation_id="get_compliance_summary",
    summary="Get fleet-wide compliance summary",
    responses={**AUTH_RESPONSES},
)
async def get_compliance_summary(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ComplianceSummaryResponse:
    """Get compliance summary across all servers for dashboard widget.

    Returns summary counts (compliant/non-compliant/never-checked) and
    per-machine status with most recent check result.

    Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.

    Returns:
        ComplianceSummaryResponse with summary stats and per-machine status.
    """
    # Get all servers
    servers_result = await session.execute(select(Server))
    servers = servers_result.scalars().all()

    machines: list[ComplianceMachineSummary] = []
    compliant_count = 0
    non_compliant_count = 0
    never_checked_count = 0

    for server in servers:
        # Get most recent compliance check for this server
        check_result = await session.execute(
            select(ConfigCheck)
            .where(ConfigCheck.server_id == server.id)
            .order_by(ConfigCheck.checked_at.desc())
            .limit(1)
        )
        latest_check = check_result.scalar_one_or_none()

        if latest_check is None:
            # Never checked - use assigned pack if available, default to "base"
            never_checked_count += 1
            assigned_packs = server.assigned_packs if server.assigned_packs else ["base"]
            # Use last assigned pack (most specific, e.g., developer-max over base)
            assigned_pack = assigned_packs[-1] if assigned_packs else "base"
            machines.append(
                ComplianceMachineSummary(
                    id=server.id,
                    display_name=server.display_name or server.hostname or server.id,
                    status="never_checked",
                    pack=assigned_pack,
                    mismatch_count=None,
                    checked_at=None,
                )
            )
        elif latest_check.is_compliant:
            # Compliant - use currently assigned pack for future checks
            compliant_count += 1
            assigned_packs = server.assigned_packs if server.assigned_packs else ["base"]
            current_pack = assigned_packs[-1] if assigned_packs else "base"
            machines.append(
                ComplianceMachineSummary(
                    id=server.id,
                    display_name=server.display_name or server.hostname or server.id,
                    status="compliant",
                    pack=current_pack,
                    mismatch_count=0,
                    checked_at=latest_check.checked_at,
                )
            )
        else:
            # Non-compliant - use currently assigned pack for future checks
            non_compliant_count += 1
            mismatch_count = (
                len(latest_check.mismatches) if latest_check.mismatches else 0
            )
            assigned_packs = server.assigned_packs if server.assigned_packs else ["base"]
            current_pack = assigned_packs[-1] if assigned_packs else "base"
            machines.append(
                ComplianceMachineSummary(
                    id=server.id,
                    display_name=server.display_name or server.hostname or server.id,
                    status="non_compliant",
                    pack=current_pack,
                    mismatch_count=mismatch_count,
                    checked_at=latest_check.checked_at,
                )
            )

    return ComplianceSummaryResponse(
        summary=ComplianceSummaryStats(
            compliant=compliant_count,
            non_compliant=non_compliant_count,
            never_checked=never_checked_count,
            total=len(servers),
        ),
        machines=machines,
    )
