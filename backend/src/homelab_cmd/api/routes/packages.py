"""Package status API endpoints.

Part of US0198: Package Held Back Status Indicator.

Provides enhanced package status endpoints that distinguish between
upgradable and held-back packages.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.packages import (
    PackageInfoResponse,
    PackageStatusResponse,
    PackageSummaryResponse,
)
from homelab_cmd.db.models import Config
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session, get_session_factory
from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService
from homelab_cmd.services.package_parser import (
    PackageStatus,
    get_package_status_from_commands,
    parse_apt_policy_phased,
)
from homelab_cmd.services.ssh_executor import (
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["Packages"])


# Commands to gather package status
APT_LIST_CMD = "apt list --upgradable 2>/dev/null | tail -n +2"
APT_MARK_CMD = "apt-mark showhold 2>/dev/null"
APT_SIMULATE_CMD = "DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade --simulate 2>&1"


def _get_apt_policy_cmd(package_name: str) -> str:
    """Get apt policy command for a specific package."""
    return f"apt policy {package_name} 2>/dev/null"


@router.get(
    "/{server_id}/packages/status",
    response_model=PackageStatusResponse,
    operation_id="get_package_status",
    summary="Get package status with held-back detection",
    description="""
Get detailed package status for a server, distinguishing between
upgradable packages and held-back packages.

**Held-back packages** are packages that have updates available but will NOT
be installed when running `apt-get upgrade` or `apt-get dist-upgrade`. This
can occur due to:

- **Phased rollouts**: Ubuntu/Debian gradually roll out updates to reduce risk.
  The percentage indicates how many systems have received the update.
- **Dependency conflicts**: Upgrading would require removing another package.
- **Manual holds**: Package explicitly held via `apt-mark hold`.

This endpoint connects to the server via SSH to query apt status in real-time.
""",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        400: {
            "description": "SSH not configured or server has no connectivity",
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
                        "no_hostname": {
                            "value": {
                                "detail": {
                                    "code": "NO_HOSTNAME",
                                    "message": "Server has no hostname, IP, or Tailscale hostname configured",
                                }
                            }
                        },
                    }
                }
            },
        },
        500: {
            "description": "SSH connection or command execution error",
            "content": {
                "application/json": {
                    "example": {"detail": "SSH connection failed: Connection refused"}
                }
            },
        },
    },
)
async def get_package_status(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> PackageStatusResponse:
    """Get package status with held-back detection (US0198 AC1).

    Connects to the server via SSH to query apt status and categorise
    packages into upgradable vs held-back.

    Uses separate database sessions to avoid locking during long SSH operations.

    Args:
        server_id: The server ID to query.
        session: Database session (used only for initial lookup).

    Returns:
        PackageStatusResponse with categorised packages.

    Raises:
        HTTPException: For various error conditions.
    """
    from homelab_cmd.config import get_settings

    # Phase 1: Get server info and config from database (quick read)
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Check server has connectivity
    hostname = server.tailscale_hostname or server.ip_address or server.hostname
    if not hostname:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_HOSTNAME",
                "message": "Server has no hostname, IP, or Tailscale hostname configured",
            },
        )

    # Get default SSH username from config (stored with SSH key)
    settings = get_settings()
    default_username = settings.ssh_default_username
    ssh_config_result = await session.execute(select(Config).where(Config.key == "ssh"))
    ssh_config = ssh_config_result.scalar_one_or_none()
    if ssh_config and ssh_config.value:
        default_username = ssh_config.value.get("default_username", default_username)

    # Detach server from session before long operations
    # This allows other operations to proceed without waiting for SSH
    await session.close()

    # Phase 2: Execute SSH commands with a separate session for host key management
    # This prevents database locking during long SSH operations
    session_factory = get_session_factory()

    try:
        async with session_factory() as ssh_session:
            credential_service = CredentialService(ssh_session, settings.encryption_key or "")
            host_key_service = HostKeyService(ssh_session)
            executor = SSHPooledExecutor(credential_service, host_key_service)

            # Run the three main apt commands to gather status
            logger.info("Querying package status for server %s via SSH", server_id)

            # 1. Get upgradable packages
            apt_list_result = await executor.execute(
                server, APT_LIST_CMD, timeout=30, username=default_username
            )
            apt_list_output = apt_list_result.stdout

            # 2. Get manually held packages
            apt_mark_result = await executor.execute(
                server, APT_MARK_CMD, timeout=10, username=default_username
            )
            apt_mark_output = apt_mark_result.stdout

            # 3. Simulate upgrade to find kept-back packages
            apt_simulate_result = await executor.execute(
                server, APT_SIMULATE_CMD, timeout=60, username=default_username
            )
            apt_simulate_output = apt_simulate_result.stdout

            # Parse and categorise packages
            package_status = await get_package_status_from_commands(
                apt_list_output=apt_list_output,
                apt_mark_output=apt_mark_output,
                apt_simulate_output=apt_simulate_output,
            )

            # For held-back packages, query apt policy to detect phased rollouts
            held_back_names = [
                pkg.name for pkg in package_status.packages if pkg.status == "held_back"
            ]

            if held_back_names:
                package_status = await _enrich_with_phased_info(
                    executor, server, package_status, held_back_names, default_username
                )

        # Phase 3: Update server record with a fresh session (quick write)
        async with session_factory() as update_session:
            # Re-fetch server to ensure we have a fresh attached instance
            server_to_update = await update_session.get(Server, server_id)
            if server_to_update:
                server_to_update.updates_available = package_status.upgradable_count
                server_to_update.held_back_count = package_status.held_back_count
                server_to_update.security_updates = package_status.security_count
                await update_session.commit()
                logger.info(
                    "Updated server %s package counts: upgradable=%d, held_back=%d, security=%d",
                    server_id,
                    package_status.upgradable_count,
                    package_status.held_back_count,
                    package_status.security_count,
                )

        # Convert to response schema
        packages_response = [
            PackageInfoResponse(
                name=pkg.name,
                current_version=pkg.current_version,
                candidate_version=pkg.candidate_version,
                status=pkg.status,
                hold_reason=pkg.hold_reason,
                phased_percentage=pkg.phased_percentage,
                repository=pkg.repository,
                is_security=pkg.is_security,
            )
            for pkg in package_status.packages
        ]

        return PackageStatusResponse(
            server_id=server_id,
            last_checked=datetime.now(UTC),
            summary=PackageSummaryResponse(
                upgradable_count=package_status.upgradable_count,
                held_back_count=package_status.held_back_count,
                security_count=package_status.security_count,
            ),
            packages=packages_response,
        )

    except SSHKeyNotConfiguredError as e:
        logger.error("SSH key not configured: %s", str(e))
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_SSH_KEY",
                "message": "No SSH key configured. Upload a key in Settings > Connectivity.",
            },
        ) from e

    except SSHAuthenticationError as e:
        logger.error("SSH authentication failed for server=%s: %s", server_id, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"SSH authentication failed: {e}",
        ) from e

    except SSHConnectionError as e:
        logger.error("SSH connection failed for server=%s: %s", server_id, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"SSH connection failed: {e}",
        ) from e

    except Exception as e:
        logger.exception("Error querying package status for server=%s", server_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query package status: {e}",
        ) from e


async def _enrich_with_phased_info(
    executor: SSHPooledExecutor,
    server: Server,
    package_status: PackageStatus,
    held_back_names: list[str],
    username: str | None = None,
) -> PackageStatus:
    """Enrich held-back packages with phased rollout information.

    For each held-back package, query apt policy to check if it's
    in a phased rollout.

    Args:
        executor: SSH executor.
        server: Server model.
        package_status: Current package status.
        held_back_names: Names of held-back packages to check.
        username: SSH username to use.

    Returns:
        Updated PackageStatus with phased info.
    """
    phased_info: dict[str, int] = {}

    # Query apt policy for each held-back package
    # Batch into a single command for efficiency
    if held_back_names:
        # Build a combined command to query all packages at once
        packages_str = " ".join(held_back_names[:10])  # Limit to 10 packages
        combined_cmd = f"apt policy {packages_str} 2>/dev/null"

        try:
            policy_result = await executor.execute(
                server, combined_cmd, timeout=30, username=username
            )
            policy_output = policy_result.stdout

            # Parse phased info for each package
            for pkg_name in held_back_names[:10]:
                pct = parse_apt_policy_phased(policy_output, pkg_name)
                if pct is not None:
                    phased_info[pkg_name] = pct

        except Exception as e:
            logger.warning("Failed to query apt policy: %s", e)
            # Continue without phased info - not critical

    # Update packages with phased info
    updated_packages = []
    for pkg in package_status.packages:
        if pkg.status == "held_back" and pkg.name in phased_info:
            # Update with phased info
            from homelab_cmd.services.package_parser import PackageInfo

            updated_packages.append(
                PackageInfo(
                    name=pkg.name,
                    current_version=pkg.current_version,
                    candidate_version=pkg.candidate_version,
                    status="held_back",
                    hold_reason="phased",
                    phased_percentage=phased_info[pkg.name],
                    repository=pkg.repository,
                    is_security=pkg.is_security,
                )
            )
        else:
            updated_packages.append(pkg)

    return PackageStatus(
        upgradable_count=package_status.upgradable_count,
        held_back_count=package_status.held_back_count,
        security_count=package_status.security_count,
        packages=updated_packages,
    )
