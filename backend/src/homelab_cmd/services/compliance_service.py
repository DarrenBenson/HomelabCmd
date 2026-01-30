"""Service for checking configuration compliance via SSH.

Part of EP0010: Configuration Management - US0117 Configuration Compliance Checker.
"""

import asyncio
import logging
import re
from datetime import UTC, datetime

from packaging import version
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.schemas.config_check import (
    ConfigCheckResponse,
    MismatchActual,
    MismatchExpected,
    MismatchItem,
)
from homelab_cmd.db.models import ConfigCheck, Server
from homelab_cmd.services.config_pack_service import ConfigPackError, ConfigPackService
from homelab_cmd.services.ssh_executor import (
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)

logger = logging.getLogger(__name__)


class ComplianceCheckError(Exception):
    """Error raised for compliance check issues."""

    pass


class ServerNotFoundError(ComplianceCheckError):
    """Raised when server is not found."""

    def __init__(self, server_id: str) -> None:
        self.server_id = server_id
        super().__init__(f"Server not found: {server_id}")


class SSHUnavailableError(ComplianceCheckError):
    """Raised when SSH connection cannot be established."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class ComplianceCheckService:
    """Service for checking configuration compliance via SSH.

    Compares a server's current state against a configuration pack
    to identify mismatches in files, packages, and settings.
    """

    def __init__(
        self,
        config_pack_service: ConfigPackService,
        ssh_executor: SSHPooledExecutor,
    ) -> None:
        """Initialise the compliance check service.

        Args:
            config_pack_service: Service for loading configuration packs.
            ssh_executor: SSH executor for running remote commands.
        """
        self._pack_service = config_pack_service
        self._ssh_executor = ssh_executor

    async def check_compliance(
        self,
        session: AsyncSession,
        server: Server,
        pack_name: str,
    ) -> ConfigCheckResponse:
        """Check a server's compliance against a configuration pack.

        Args:
            session: Database session for storing results.
            server: Server to check.
            pack_name: Name of the configuration pack.

        Returns:
            ConfigCheckResponse with compliance status and mismatches.

        Raises:
            ConfigPackError: If pack cannot be loaded.
            SSHUnavailableError: If SSH connection fails.
        """
        start_time = datetime.now(UTC)

        # Load the configuration pack
        try:
            pack = self._pack_service.load_pack(pack_name)
        except ConfigPackError:
            raise

        # Handle empty pack
        if not pack.items.files and not pack.items.packages and not pack.items.settings:
            return self._create_compliant_response(server.id, pack_name, start_time)

        # Get SSH connection - prefer Tailscale hostname, then IP address, then hostname
        hostname = server.tailscale_hostname or server.ip_address or server.hostname
        # Use server-specific username, or fall back to configured default from DB
        from homelab_cmd.config import get_settings
        from homelab_cmd.db.models import Config

        settings = get_settings()
        default_username = settings.ssh_default_username

        # Get default username from DB config if set
        db_config_result = await session.execute(
            select(Config).where(Config.key == "ssh")
        )
        db_config_row = db_config_result.scalar_one_or_none()
        if db_config_row and db_config_row.value:
            default_username = db_config_row.value.get("default_username", default_username)

        username = server.ssh_username or default_username
        # Config user for file path expansion (defaults to SSH username)
        config_user = server.config_user or username

        try:
            client = await self._ssh_executor.get_connection(
                hostname=hostname,
                username=username,
                machine_id=server.id,
            )
        except SSHKeyNotConfiguredError as e:
            raise SSHUnavailableError(str(e)) from e
        except SSHAuthenticationError as e:
            raise SSHUnavailableError(f"SSH authentication failed: {e}") from e
        except SSHConnectionError as e:
            raise SSHUnavailableError(f"SSH connection failed: {e}") from e

        mismatches: list[MismatchItem] = []

        # Check files (use config_user for home directory expansion)
        # Use sudo when SSH user differs from config user
        if pack.items.files:
            use_sudo = config_user != username
            file_mismatches = await self._check_files(
                client, config_user, pack.items.files, use_sudo=use_sudo
            )
            mismatches.extend(file_mismatches)

        # Check packages
        if pack.items.packages:
            package_mismatches = await self._check_packages(client, pack.items.packages)
            mismatches.extend(package_mismatches)

        # Check settings
        if pack.items.settings:
            setting_mismatches = await self._check_settings(client, pack.items.settings)
            mismatches.extend(setting_mismatches)

        # Calculate duration
        end_time = datetime.now(UTC)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        # Create response
        is_compliant = len(mismatches) == 0
        response = ConfigCheckResponse(
            server_id=server.id,
            pack_name=pack_name,
            is_compliant=is_compliant,
            mismatches=mismatches,
            checked_at=end_time,
            check_duration_ms=duration_ms,
        )

        # Store result in database
        await self._store_result(session, response)

        return response

    async def _check_files(
        self,
        client,
        username: str,
        files: list,
        use_sudo: bool = True,
    ) -> list[MismatchItem]:
        """Check file compliance.

        Args:
            client: SSH client connection.
            username: Config user for home directory expansion.
            files: List of FileItem objects to check.
            use_sudo: Whether to use sudo for file access (needed when SSH user
                differs from config user).

        Returns:
            List of mismatches found.
        """
        if not files:
            return []

        mismatches = []

        # Build batch command for all files
        # Expand ~ to actual home directory
        home_dir = f"/home/{username}" if username != "root" else "/root"

        paths = []
        for f in files:
            path = f.path.replace("~", home_dir)
            paths.append(path)

        # Batch command that outputs structured data
        # Format: PATH|EXISTS|MODE|HASH
        # Use sudo -n (non-interactive) when SSH user differs from config user
        commands = []
        sudo_prefix = "sudo -n " if use_sudo else ""
        for path in paths:
            # Check for both files and directories
            cmd = (
                f'path="{path}"; '
                f'if {sudo_prefix}test -e "$path"; then '
                f'if {sudo_prefix}test -d "$path"; then '
                f'echo "$path|EXISTS|dir|"; '
                f'else '
                f'mode=$({sudo_prefix}stat -c "%a" "$path" 2>/dev/null || echo "ERROR"); '
                f'hash=$({sudo_prefix}sha256sum "$path" 2>/dev/null | cut -d" " -f1 || echo "ERROR"); '
                f'echo "$path|EXISTS|$mode|$hash"; '
                f'fi; '
                f'else echo "$path|MISSING||"; fi'
            )
            commands.append(cmd)

        batch_command = " && ".join(commands)

        try:
            result = await asyncio.to_thread(
                self._execute_command, client, batch_command
            )
        except Exception as e:
            logger.warning("Failed to check files via SSH: %s", e)
            return mismatches

        # Parse results
        lines = result.strip().split("\n") if result.strip() else []
        for i, line in enumerate(lines):
            if not line or i >= len(files):
                continue

            file_item = files[i]
            parts = line.split("|")
            if len(parts) < 4:
                continue

            _path, exists_str, mode, file_hash = parts[0], parts[1], parts[2], parts[3]

            if exists_str == "MISSING":
                mismatches.append(
                    MismatchItem(
                        type="missing_file",
                        item=file_item.path,
                        expected=MismatchExpected(exists=True, mode=file_item.mode),
                        actual=MismatchActual(exists=False),
                    )
                )
            else:
                # File/directory exists - check permissions
                # Skip mode comparison for directories (mode == "dir")
                # Skip mode comparison for symlinks (mode == "777")
                expected_mode = file_item.mode.lstrip("0") if file_item.mode else None
                actual_mode = mode.lstrip("0") if mode else None

                # Directories and symlinks get special handling
                is_directory = mode == "dir"
                is_symlink = mode == "777"  # Symlinks always report 777

                if (
                    expected_mode
                    and actual_mode
                    and expected_mode != actual_mode
                    and not is_directory
                    and not is_symlink
                ):
                    mismatches.append(
                        MismatchItem(
                            type="wrong_permissions",
                            item=file_item.path,
                            expected=MismatchExpected(exists=True, mode=file_item.mode),
                            actual=MismatchActual(exists=True, mode=mode),
                        )
                    )

                # Check content hash if specified
                if file_item.content_hash:
                    expected_hash = file_item.content_hash
                    if expected_hash.startswith("sha256:"):
                        expected_hash = expected_hash[7:]

                    if file_hash and file_hash != expected_hash and file_hash != "ERROR":
                        mismatches.append(
                            MismatchItem(
                                type="wrong_content",
                                item=file_item.path,
                                expected=MismatchExpected(
                                    exists=True, hash=file_item.content_hash
                                ),
                                actual=MismatchActual(exists=True, hash=f"sha256:{file_hash}"),
                            )
                        )

        return mismatches

    async def _check_packages(
        self,
        client,
        packages: list,
    ) -> list[MismatchItem]:
        """Check package compliance.

        Args:
            client: SSH client connection.
            packages: List of PackageItem objects to check.

        Returns:
            List of mismatches found.
        """
        if not packages:
            return []

        mismatches = []

        # Get all package names
        package_names = [p.name for p in packages]

        # Query dpkg for package status
        # Format: package<tab>version<tab>status
        command = (
            f"dpkg-query -W -f='${{Package}}\\t${{Version}}\\t${{Status}}\\n' "
            f"{' '.join(package_names)} 2>/dev/null || true"
        )

        try:
            result = await asyncio.to_thread(self._execute_command, client, command)
        except Exception as e:
            logger.warning("Failed to check packages via SSH: %s", e)
            return mismatches

        # Parse results into dict
        installed_packages: dict[str, str] = {}
        for line in result.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                pkg_name, pkg_version, status = parts[0], parts[1], parts[2]
                if "install ok installed" in status:
                    installed_packages[pkg_name] = pkg_version

        # Check each required package
        for pkg in packages:
            if pkg.name not in installed_packages:
                mismatches.append(
                    MismatchItem(
                        type="missing_package",
                        item=pkg.name,
                        expected=MismatchExpected(installed=True),
                        actual=MismatchActual(installed=False),
                    )
                )
            elif pkg.min_version:
                # Check version
                installed_ver = installed_packages[pkg.name]
                try:
                    # Strip epoch and debian revision for comparison
                    clean_installed = self._clean_version(installed_ver)
                    clean_required = self._clean_version(pkg.min_version)

                    if version.parse(clean_installed) < version.parse(clean_required):
                        mismatches.append(
                            MismatchItem(
                                type="wrong_version",
                                item=pkg.name,
                                expected=MismatchExpected(
                                    installed=True, min_version=pkg.min_version
                                ),
                                actual=MismatchActual(
                                    installed=True, version=installed_ver
                                ),
                            )
                        )
                except Exception as e:
                    logger.warning(
                        "Failed to compare versions for %s: %s vs %s - %s",
                        pkg.name,
                        installed_ver,
                        pkg.min_version,
                        e,
                    )

        return mismatches

    async def _check_settings(
        self,
        client,
        settings: list,
    ) -> list[MismatchItem]:
        """Check setting compliance.

        Args:
            client: SSH client connection.
            settings: List of SettingItem objects to check.

        Returns:
            List of mismatches found.
        """
        if not settings:
            return []

        mismatches = []

        # Only support env_var type for now
        env_settings = [s for s in settings if s.type == "env_var"]

        if not env_settings:
            return mismatches

        # Build command to echo all env vars
        echo_commands = [f'echo "{s.key}=${{{s.key}}}"' for s in env_settings]
        command = " && ".join(echo_commands)

        try:
            result = await asyncio.to_thread(self._execute_command, client, command)
        except Exception as e:
            logger.warning("Failed to check settings via SSH: %s", e)
            return mismatches

        # Parse results
        env_values: dict[str, str] = {}
        for line in result.strip().split("\n"):
            if "=" in line:
                key, value = line.split("=", 1)
                env_values[key] = value

        # Check each setting
        for setting in env_settings:
            actual_value = env_values.get(setting.key, "")
            if actual_value != setting.expected:
                mismatches.append(
                    MismatchItem(
                        type="wrong_setting",
                        item=setting.key,
                        expected=MismatchExpected(value=setting.expected),
                        actual=MismatchActual(value=actual_value),
                    )
                )

        return mismatches

    def _execute_command(self, client, command: str) -> str:
        """Execute SSH command and return stdout.

        Args:
            client: SSH client connection.
            command: Command to execute.

        Returns:
            Command stdout as string.
        """
        _stdin, stdout, _stderr = client.exec_command(command, timeout=30)
        return stdout.read().decode("utf-8", errors="replace")

    def _clean_version(self, ver: str) -> str:
        """Clean version string for comparison.

        Removes epoch (1:), debian revision (-1ubuntu1), etc.

        Args:
            ver: Raw version string.

        Returns:
            Cleaned version string.
        """
        # Remove epoch (e.g., "1:8.5.0" -> "8.5.0")
        if ":" in ver:
            ver = ver.split(":", 1)[1]

        # Remove debian revision (e.g., "8.5.0-1ubuntu1" -> "8.5.0")
        ver = re.split(r"[-+~]", ver)[0]

        return ver

    def _create_compliant_response(
        self,
        server_id: str,
        pack_name: str,
        start_time: datetime,
    ) -> ConfigCheckResponse:
        """Create a compliant response for empty packs."""
        end_time = datetime.now(UTC)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)
        return ConfigCheckResponse(
            server_id=server_id,
            pack_name=pack_name,
            is_compliant=True,
            mismatches=[],
            checked_at=end_time,
            check_duration_ms=duration_ms,
        )

    async def _store_result(
        self,
        session: AsyncSession,
        response: ConfigCheckResponse,
    ) -> None:
        """Store compliance check result in database.

        Args:
            session: Database session.
            response: Compliance check response to store.
        """
        check = ConfigCheck(
            server_id=response.server_id,
            pack_name=response.pack_name,
            is_compliant=response.is_compliant,
            mismatches=[m.model_dump() for m in response.mismatches],
            checked_at=response.checked_at,
            check_duration_ms=response.check_duration_ms,
        )
        session.add(check)
        await session.commit()
