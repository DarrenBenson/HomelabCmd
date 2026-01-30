"""Agent deployment service for remote agent management.

This module handles:
- Building agent tarballs with pre-configured settings
- Installing agents on remote devices via SSH
- Upgrading existing agents
- Removing agents (marking inactive or complete deletion)

EP0007: Agent Management
"""

from __future__ import annotations

import base64
import io
import logging
import tarfile
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.config import get_settings
from homelab_cmd.db.models.agent_credential import AgentCredential
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.models.service import ExpectedService
from homelab_cmd.services.ssh import SSHConnectionService
from homelab_cmd.services.token_service import TokenService

if TYPE_CHECKING:
    from homelab_cmd.services.credential_service import CredentialService

logger = logging.getLogger(__name__)

# Agent files to include in tarball (relative to agent directory)
AGENT_FILES = [
    "__init__.py",
    "__main__.py",
    "config.py",
    "collectors.py",
    "heartbeat.py",
    "executor.py",
    "homelab-agent.service",
    "install.sh",
    "requirements.txt",
    "VERSION",
]

# Installation directory on target
INSTALL_DIR = "/opt/homelab-agent"
CONFIG_DIR = "/etc/homelab-agent"


@dataclass
class DeploymentResult:
    """Result of an agent deployment operation."""

    success: bool
    server_id: str | None = None
    message: str = ""
    error: str | None = None
    agent_version: str | None = None


def get_agent_version() -> str:
    """Get the current agent version from the VERSION file.

    Returns:
        Version string (e.g., "1.0.0") or "unknown".
    """
    # Check Docker path first
    docker_version_file = Path("/app/agent/VERSION")
    if docker_version_file.exists():
        return docker_version_file.read_text().strip()

    # Fall back to relative path from source (development mode)
    services_dir = Path(__file__).parent
    homelab_cmd_dir = services_dir.parent
    src_dir = homelab_cmd_dir.parent
    backend_dir = src_dir.parent
    project_dir = backend_dir.parent
    agent_dir = project_dir / "agent"

    version_file = agent_dir / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()

    return "unknown"


def _get_agent_source_path() -> Path:
    """Get the path to the agent source directory.

    Returns:
        Path to agent directory.

    Raises:
        FileNotFoundError: If agent directory cannot be located.
    """
    # Check Docker path first (/app/agent/)
    docker_agent_dir = Path("/app/agent")
    if docker_agent_dir.exists():
        return docker_agent_dir

    # Fall back to relative path from source (development mode)
    # Path from backend/src/homelab_cmd/services/agent_deploy.py to agent/
    services_dir = Path(__file__).parent
    homelab_cmd_dir = services_dir.parent
    src_dir = homelab_cmd_dir.parent
    backend_dir = src_dir.parent
    project_dir = backend_dir.parent
    agent_dir = project_dir / "agent"

    if not agent_dir.exists():
        raise FileNotFoundError(f"Agent source directory not found: {agent_dir}")

    return agent_dir


def build_agent_tarball(
    hub_url: str,
    server_id: str,
    server_guid: str,
    api_token: str,
    heartbeat_interval: int = 60,
    monitored_services: list[str] | None = None,
    core_services: list[str] | None = None,
    command_execution_enabled: bool = False,
    use_sudo: bool = False,
) -> bytes:
    """Build a tarball of the agent with pre-configured config.yaml.

    Args:
        hub_url: URL of the HomelabCmd server.
        server_id: Unique identifier for the server.
        server_guid: Unique GUID for per-agent authentication.
        api_token: Per-agent API token for authentication.
        heartbeat_interval: Heartbeat interval in seconds.
        monitored_services: List of services to monitor.
        core_services: List of core services (critical alerts on failure).
        command_execution_enabled: Enable remote command execution.
        use_sudo: Use sudo for commands.

    Returns:
        Bytes of the gzipped tarball.
    """
    agent_dir = _get_agent_source_path()

    # Create tarball in memory
    tar_buffer = io.BytesIO()

    with tarfile.open(fileobj=tar_buffer, mode="w:gz") as tar:
        # Add agent files to /opt/homelab-agent/
        for filename in AGENT_FILES:
            src_path = agent_dir / filename
            if src_path.exists():
                arcname = f"{INSTALL_DIR}/{filename}"
                tar.add(str(src_path), arcname=arcname)
            else:
                logger.warning("Agent file not found: %s", src_path)

        # Create config.yaml content
        config_data = {
            "hub_url": hub_url,
            "server_id": server_id,
            "server_guid": server_guid,
            "api_token": api_token,
            "heartbeat_interval": heartbeat_interval,
        }

        if monitored_services:
            config_data["monitored_services"] = monitored_services

        # US0069: Add core_services for service classification
        if core_services:
            config_data["core_services"] = core_services

        if command_execution_enabled:
            config_data["mode"] = "readwrite"  # Enable command execution mode
            config_data["command_execution"] = {
                "enabled": True,
                "use_sudo": use_sudo,
                "timeout_seconds": 30,
            }

        config_yaml = yaml.dump(config_data, default_flow_style=False)

        # Add config.yaml to /etc/homelab-agent/
        config_info = tarfile.TarInfo(name=f"{CONFIG_DIR}/config.yaml")
        config_bytes = config_yaml.encode("utf-8")
        config_info.size = len(config_bytes)
        config_info.mode = 0o600  # Secure permissions
        tar.addfile(config_info, io.BytesIO(config_bytes))

    return tar_buffer.getvalue()


class AgentDeploymentService:
    """Service for managing agent deployments via SSH."""

    def __init__(
        self,
        session: AsyncSession,
        credential_service: CredentialService | None = None,
    ) -> None:
        """Initialise the deployment service.

        Args:
            session: Database session for server operations.
            credential_service: Optional credential service for retrieving stored credentials.
        """
        self.session = session
        self.ssh = SSHConnectionService()
        self.settings = get_settings()
        self.credential_service = credential_service

    async def install_agent(
        self,
        hostname: str,
        port: int = 22,
        username: str | None = None,
        server_id: str | None = None,
        display_name: str | None = None,
        monitored_services: list[str] | None = None,
        service_config: list[dict[str, str | bool]] | None = None,
        command_execution_enabled: bool = False,
        use_sudo: bool = False,
        sudo_password: str | None = None,
    ) -> DeploymentResult:
        """Install agent on a remote device via SSH.

        Args:
            hostname: Target hostname or IP address.
            port: SSH port number.
            username: SSH username.
            server_id: Server identifier (generated from hostname if not provided).
            display_name: Human-readable display name.
            monitored_services: Services to monitor (backward compat, simple list).
            service_config: Services with core/standard classification (US0069).
            command_execution_enabled: Enable remote command execution.
            use_sudo: Use sudo for commands.
            sudo_password: Password for sudo (if user requires password for sudo).

        Returns:
            DeploymentResult with success/failure details.
        """
        # Get SSH config from database (username and key_usernames)
        ssh_config = await self.session.execute(select(Config).where(Config.key == "ssh"))
        ssh_config_row = ssh_config.scalar_one_or_none()
        ssh_db_config = ssh_config_row.value if ssh_config_row else {}

        # Get default username if not provided
        if not username:
            username = ssh_db_config.get("default_username", self.settings.ssh_default_username)

        # Get key_usernames for per-key username associations (US0072/US0073)
        key_usernames = ssh_db_config.get("key_usernames", {})

        # Generate server_id from hostname if not provided
        if not server_id:
            # Convert to slug format: lowercase, replace dots and underscores with hyphens
            server_id = hostname.lower().replace(".", "-").replace("_", "-")
            # Remove any double hyphens
            while "--" in server_id:
                server_id = server_id.replace("--", "-")
            # Strip leading/trailing hyphens
            server_id = server_id.strip("-")

        # Check if server already exists with an active agent
        # Allow installation on servers that exist but have never had an agent
        # (e.g., imported from Tailscale with no heartbeats yet)
        existing = await self.session.get(Server, server_id)
        if existing and not existing.is_inactive and existing.last_seen is not None:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=f"Server '{server_id}' already exists and has an active agent",
            )

        # US0069: Merge monitored_services with service_config
        all_services = list(monitored_services or [])
        core_services: list[str] = []

        if service_config:
            for svc in service_config:
                svc_name = str(svc.get("name", ""))
                if svc_name and svc_name not in all_services:
                    all_services.append(svc_name)
                if svc.get("core"):
                    core_services.append(svc_name)

        # Generate unique GUID for per-agent authentication
        server_guid = str(uuid.uuid4())

        # Generate per-agent API token
        agent_token = TokenService.generate_agent_token(server_guid)

        # Build the tarball
        try:
            hub_url = (
                self.settings.external_url or f"http://{self.settings.host}:{self.settings.port}"
            )
            tarball = build_agent_tarball(
                hub_url=hub_url,
                server_id=server_id,
                server_guid=server_guid,
                api_token=agent_token.plaintext,
                monitored_services=all_services if all_services else None,
                core_services=core_services if core_services else None,
                command_execution_enabled=command_execution_enabled,
                use_sudo=use_sudo,
            )
        except FileNotFoundError as e:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=str(e),
            )

        # Encode tarball as base64 for transfer
        tarball_b64 = base64.b64encode(tarball).decode("ascii")

        # Determine agent mode based on command_execution_enabled
        agent_mode = "readwrite" if command_execution_enabled else "readonly"

        # Build installation command
        # The sudo commands need to run with password support
        if sudo_password:
            # Escape single quotes in password for shell safety
            escaped_pw = sudo_password.replace("'", "'\"'\"'")
            # Run all privileged commands in a single sudo bash -c so password only needed once
            install_cmd = f"""
                echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
                echo '{escaped_pw}' | sudo -S bash -c '
                    mkdir -p {INSTALL_DIR} {CONFIG_DIR} && \
                    tar -xzf /tmp/homelab-agent.tar.gz -C / && \
                    chmod 600 {CONFIG_DIR}/config.yaml && \
                    chmod +x {INSTALL_DIR}/install.sh && \
                    cd {INSTALL_DIR} && ./install.sh --remote --mode {agent_mode} && \
                    cp {INSTALL_DIR}/homelab-agent.service /etc/systemd/system/homelab-agent.service && \
                    systemctl daemon-reload && \
                    systemctl restart homelab-agent.service
                ' && \
                rm -f /tmp/homelab-agent.tar.gz
            """
        else:
            install_cmd = f"""
                echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
                sudo mkdir -p {INSTALL_DIR} {CONFIG_DIR} && \
                sudo tar -xzf /tmp/homelab-agent.tar.gz -C / && \
                sudo chmod 600 {CONFIG_DIR}/config.yaml && \
                sudo chmod +x {INSTALL_DIR}/install.sh && \
                cd {INSTALL_DIR} && sudo ./install.sh --remote --mode {agent_mode} && \
                sudo cp {INSTALL_DIR}/homelab-agent.service /etc/systemd/system/homelab-agent.service && \
                sudo systemctl daemon-reload && \
                sudo systemctl restart homelab-agent.service && \
                rm -f /tmp/homelab-agent.tar.gz
            """

        # Execute via SSH
        result = await self.ssh.execute_command(
            hostname=hostname,
            port=port,
            username=username,
            command=install_cmd,
            command_timeout=120,  # 2 minutes for installation
            key_usernames=key_usernames,
        )

        if not result.success:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=result.error or result.stderr or "Installation failed",
            )

        # Create or update server record
        agent_version = get_agent_version()

        if existing:
            # Reactivate inactive server with new GUID
            existing.is_inactive = False
            existing.inactive_since = None
            existing.agent_version = agent_version
            existing.hostname = hostname
            existing.guid = server_guid  # Update GUID on reinstall
            if display_name:
                existing.display_name = display_name
        else:
            # Create new server with GUID
            server = Server(
                id=server_id,
                hostname=hostname,
                display_name=display_name,
                status=ServerStatus.UNKNOWN.value,
                agent_version=agent_version,
                guid=server_guid,
            )
            self.session.add(server)

        if all_services:
            await self._ensure_expected_services(server_id, all_services, core_services)

        await self.session.flush()

        # Create per-agent credential record
        credential = AgentCredential(
            server_guid=server_guid,
            api_token_hash=agent_token.token_hash,
            api_token_prefix=agent_token.prefix,
            is_legacy=False,
        )
        self.session.add(credential)
        await self.session.flush()

        logger.info(
            "Created per-agent credential for server %s (prefix=%s)",
            server_id,
            agent_token.prefix,
        )

        return DeploymentResult(
            success=True,
            server_id=server_id,
            message="Agent installed successfully",
            agent_version=agent_version,
        )

    async def _ensure_expected_services(
        self, server_id: str, monitored_services: list[str], core_services: list[str]
    ) -> None:
        existing_result = await self.session.execute(
            select(ExpectedService.service_name).where(ExpectedService.server_id == server_id)
        )
        existing_services = {row[0] for row in existing_result.all()}

        for service_name in monitored_services:
            if service_name in existing_services:
                continue

            expected_service = ExpectedService(
                server_id=server_id,
                service_name=service_name,
                display_name=service_name,
                is_critical=service_name in core_services,
                enabled=True,
            )
            self.session.add(expected_service)

    async def upgrade_agent(
        self,
        server_id: str,
        sudo_password: str | None = None,
    ) -> DeploymentResult:
        """Upgrade agent on an existing server.

        Args:
            server_id: Server identifier.
            sudo_password: Password for sudo (if required).
                          If not provided, attempts to retrieve from stored credentials.

        Returns:
            DeploymentResult with success/failure details.
        """
        # Get server
        server = await self.session.get(Server, server_id)
        if not server:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=f"Server '{server_id}' not found",
            )

        if server.is_inactive:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error="Cannot upgrade inactive server. Re-install agent instead.",
            )

        if not server.ip_address and not server.hostname:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error="Server has no hostname or IP address for connection",
            )

        hostname = server.ip_address or server.hostname

        # Get key_usernames from database (US0072/US0073)
        ssh_config = await self.session.execute(select(Config).where(Config.key == "ssh"))
        ssh_config_row = ssh_config.scalar_one_or_none()
        ssh_db_config = ssh_config_row.value if ssh_config_row else {}
        key_usernames = ssh_db_config.get("key_usernames", {})

        # Use existing GUID or generate new one for upgrade
        server_guid = server.guid or str(uuid.uuid4())
        if not server.guid:
            server.guid = server_guid  # Update server with new GUID

        # Build the tarball
        try:
            hub_url = (
                self.settings.external_url or f"http://{self.settings.host}:{self.settings.port}"
            )
            tarball = build_agent_tarball(
                hub_url=hub_url,
                server_id=server_id,
                api_token=self.settings.api_key,
                server_guid=server_guid,
            )
        except FileNotFoundError as e:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=str(e),
            )

        # Encode tarball as base64
        tarball_b64 = base64.b64encode(tarball).decode("ascii")

        # Retrieve sudo password if not provided (AC3)
        if sudo_password is None and self.credential_service:
            sudo_password = await self.credential_service.get_effective_credential(
                "sudo_password", server_id
            )
            if sudo_password:
                logger.debug("Using stored sudo_password for server %s", server_id)

        # Build upgrade command (stops service, extracts, restarts)
        if sudo_password:
            # AC2: Use password pipe when sudo_password provided
            # Escape single quotes in password for shell safety
            escaped_pw = sudo_password.replace("'", "'\"'\"'")
            upgrade_cmd = f"""
                echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
                echo '{escaped_pw}' | sudo -S bash -c '
                    systemctl stop homelab-agent 2>/dev/null || true && \
                    tar -xzf /tmp/homelab-agent.tar.gz -C / --exclude="*/config.yaml" && \
                    systemctl daemon-reload && \
                    systemctl start homelab-agent
                ' && \
                rm -f /tmp/homelab-agent.tar.gz
            """
        else:
            # AC4: Passwordless sudo (backward compatible)
            upgrade_cmd = f"""
                sudo systemctl stop homelab-agent 2>/dev/null || true && \
                echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
                sudo tar -xzf /tmp/homelab-agent.tar.gz -C / --exclude='*/config.yaml' && \
                sudo systemctl daemon-reload && \
                sudo systemctl start homelab-agent && \
                rm -f /tmp/homelab-agent.tar.gz
            """

        # Execute via SSH
        result = await self.ssh.execute_command(
            hostname=hostname,
            command=upgrade_cmd,
            command_timeout=60,
            key_usernames=key_usernames,
        )

        if not result.success:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=result.error or result.stderr or "Upgrade failed",
            )

        # Update server version
        agent_version = get_agent_version()
        server.agent_version = agent_version
        await self.session.flush()

        return DeploymentResult(
            success=True,
            server_id=server_id,
            message="Agent upgraded successfully",
            agent_version=agent_version,
        )

    async def remove_agent(
        self,
        server_id: str,
        delete_completely: bool = False,
        ssh_username: str | None = None,
        ssh_password: str | None = None,
        sudo_password: str | None = None,
    ) -> DeploymentResult:
        """Remove agent from a server.

        Args:
            server_id: Server identifier.
            delete_completely: If True, delete server from database.
                             If False, mark as inactive.
            ssh_username: Optional SSH username for password authentication.
            ssh_password: Optional SSH password for authentication.
            sudo_password: Password for sudo (if required).
                          If not provided, attempts to retrieve from stored credentials.

        Returns:
            DeploymentResult with success/failure details.
        """
        # Get server
        server = await self.session.get(Server, server_id)
        if not server:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=f"Server '{server_id}' not found",
            )

        hostname = server.ip_address or server.hostname
        warnings: list[str] = []

        # Get SSH config from database (US0072/US0073)
        ssh_config = await self.session.execute(select(Config).where(Config.key == "ssh"))
        ssh_config_row = ssh_config.scalar_one_or_none()
        ssh_db_config = ssh_config_row.value if ssh_config_row else {}
        key_usernames = ssh_db_config.get("key_usernames", {})
        default_username = ssh_db_config.get("default_username")

        # Retrieve sudo password if not provided (AC3)
        if sudo_password is None and self.credential_service:
            sudo_password = await self.credential_service.get_effective_credential(
                "sudo_password", server_id
            )
            if sudo_password:
                logger.debug("Using stored sudo_password for server %s removal", server_id)

        # Try to uninstall agent via SSH (BG0012: track success for user feedback)
        if hostname:
            # Build uninstall command with sudo password support (US0086)
            if sudo_password:
                # AC2: Use password pipe when sudo_password provided
                escaped_pw = sudo_password.replace("'", "'\"'\"'")
                uninstall_cmd = f"""
                    echo '{escaped_pw}' | sudo -S bash -c '
                        systemctl stop homelab-agent 2>/dev/null || true && \
                        systemctl disable homelab-agent 2>/dev/null || true && \
                        rm -rf /opt/homelab-agent /etc/homelab-agent && \
                        rm -f /etc/systemd/system/homelab-agent.service && \
                        systemctl daemon-reload
                    '
                """
            else:
                # AC4: Passwordless sudo (backward compatible)
                uninstall_cmd = """
                    sudo systemctl stop homelab-agent 2>/dev/null || true && \
                    sudo systemctl disable homelab-agent 2>/dev/null || true && \
                    sudo rm -rf /opt/homelab-agent /etc/homelab-agent && \
                    sudo rm -f /etc/systemd/system/homelab-agent.service && \
                    sudo systemctl daemon-reload
                """

            password_auth = ssh_username is not None and ssh_password is not None
            uninstall_result = None
            used_password_auth = False

            if ssh_password and not ssh_username:
                warnings.append(
                    "ssh_password provided without ssh_username; ignoring password and "
                    "falling back to SSH keys."
                )

            if password_auth:
                uninstall_result = await self.ssh.execute_command(
                    hostname=hostname,
                    command=uninstall_cmd,
                    command_timeout=30,
                    username=ssh_username,
                    password=ssh_password,
                )

                if uninstall_result.success:
                    used_password_auth = True
                else:
                    warnings.append(
                        "Password authentication failed for uninstall attempt. "
                        "Falling back to SSH keys."
                    )

            if uninstall_result is None or not uninstall_result.success:
                uninstall_result = await self.ssh.execute_command(
                    hostname=hostname,
                    command=uninstall_cmd,
                    command_timeout=30,
                    username=default_username,
                    key_usernames=key_usernames,
                )

            if not uninstall_result.success:
                warnings.append(
                    f"Could not uninstall agent from {hostname}: "
                    f"{uninstall_result.error or uninstall_result.stderr}. "
                    "The agent may still be running. Heartbeats from this server will be rejected."
                )
                logger.warning(
                    "Could not uninstall agent from %s: %s",
                    hostname,
                    uninstall_result.error or uninstall_result.stderr,
                )
            else:
                verification_warnings = await self._verify_agent_removal(
                    hostname=hostname,
                    key_usernames=key_usernames,
                    default_username=default_username,
                    ssh_username=ssh_username if used_password_auth else None,
                    ssh_password=ssh_password if used_password_auth else None,
                    sudo_password=sudo_password,
                )
                warnings.extend(verification_warnings)
                # Continue anyway - mark as inactive even if uninstall fails
                # BG0012: Heartbeats from inactive servers are now rejected
        else:
            # BG0016: Warn user when SSH uninstall cannot be attempted
            warnings.append(
                "Could not uninstall agent: no hostname or IP address available for SSH. "
                "The agent may still be running on the remote server."
            )
            logger.warning(
                "Cannot uninstall agent from server %s: no hostname or IP available",
                server_id,
            )

        if delete_completely:
            # Delete server and all related data (cascades)
            await self.session.delete(server)
            await self.session.flush()

            message = "Server deleted completely"
            message = self._append_warnings(message, warnings)

            return DeploymentResult(
                success=True,
                server_id=server_id,
                message=message,
            )
        else:
            # Mark as inactive
            server.is_inactive = True
            server.inactive_since = datetime.now(UTC)
            server.status = ServerStatus.OFFLINE.value
            await self.session.flush()

            message = "Agent removed, server marked inactive"
            message = self._append_warnings(message, warnings)

            return DeploymentResult(
                success=True,
                server_id=server_id,
                message=message,
            )

    async def _verify_agent_removal(
        self,
        hostname: str,
        key_usernames: dict[str, str],
        default_username: str | None = None,
        ssh_username: str | None = None,
        ssh_password: str | None = None,
        sudo_password: str | None = None,
    ) -> list[str]:
        """Verify removal success by checking service status and remaining files.

        Args:
            hostname: Target hostname or IP address.
            key_usernames: SSH key usernames mapping.
            default_username: Default SSH username from database config.
            ssh_username: Optional SSH username for password authentication.
            ssh_password: Optional SSH password for authentication.
            sudo_password: Password for sudo (if required).

        Returns:
            List of warning messages from verification.
        """
        warnings: list[str] = []

        service_check = "systemctl is-active homelab-agent 2>/dev/null || true"
        service_result = await self.ssh.execute_command(
            hostname=hostname,
            command=service_check,
            command_timeout=10,
            key_usernames=key_usernames,
            username=ssh_username or default_username,
            password=ssh_password,
        )
        if not service_result.success and service_result.error:
            warnings.append("Verification warning: service status check failed or timed out.")
        elif service_result.stdout.strip() == "active":
            warnings.append("Verification warning: homelab-agent service still running.")

        file_check = (
            "for path in /opt/homelab-agent /etc/homelab-agent "
            "/etc/systemd/system/homelab-agent.service; do "
            'if [ -e "$path" ]; then echo $path; fi; done'
        )
        file_result = await self.ssh.execute_command(
            hostname=hostname,
            command=file_check,
            command_timeout=10,
            key_usernames=key_usernames,
            username=ssh_username or default_username,
            password=ssh_password,
        )
        if not file_result.success and file_result.error:
            warnings.append("Verification warning: file removal check failed or timed out.")
        else:
            remaining = [line.strip() for line in file_result.stdout.splitlines() if line.strip()]
            if remaining:
                warnings.append("Verification warning: agent files remain: " + ", ".join(remaining))

        return warnings

    @staticmethod
    def _append_warnings(message: str, warnings: list[str]) -> str:
        if not warnings:
            return message
        return message + ". Warning: " + " Warning: ".join(warnings)

    async def activate_server(self, server_id: str) -> DeploymentResult:
        """Re-activate an inactive server.

        Called via the dashboard UI when user wants to bring an inactive server
        back online. Note: heartbeat auto-reactivation was removed (BG0012) to
        prevent removed agents from re-registering.

        Args:
            server_id: Server identifier.

        Returns:
            DeploymentResult with success/failure details.
        """
        server = await self.session.get(Server, server_id)
        if not server:
            return DeploymentResult(
                success=False,
                server_id=server_id,
                error=f"Server '{server_id}' not found",
            )

        if not server.is_inactive:
            return DeploymentResult(
                success=True,
                server_id=server_id,
                message="Server is already active",
            )

        server.is_inactive = False
        server.inactive_since = None
        await self.session.flush()

        return DeploymentResult(
            success=True,
            server_id=server_id,
            message="Server activated",
        )


# Convenience function to get the service
def get_deployment_service(
    session: AsyncSession,
    credential_service: CredentialService | None = None,
) -> AgentDeploymentService:
    """Get an agent deployment service instance.

    Args:
        session: Database session.
        credential_service: Optional credential service for retrieving stored credentials.

    Returns:
        AgentDeploymentService instance.
    """
    return AgentDeploymentService(session, credential_service=credential_service)
