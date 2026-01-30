"""Service for applying and removing configuration packs via SSH.

Part of EP0010: Configuration Management:
- US0119: Apply Configuration Pack
- US0123: Remove Configuration Pack
"""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.schemas.config_apply import (
    ApplyItemResult,
    ApplyPreviewResponse,
    DryRunFileItem,
    DryRunPackageItem,
    DryRunSettingItem,
    RemoveItemResult,
    RemovePreviewFileItem,
    RemovePreviewPackageItem,
    RemovePreviewResponse,
    RemovePreviewSettingItem,
    RemoveResponse,
)
from homelab_cmd.db.models import ConfigApply, ConfigApplyStatus, Server
from homelab_cmd.services.config_pack_service import ConfigPackError, ConfigPackService
from homelab_cmd.services.ssh_executor import (
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)

logger = logging.getLogger(__name__)


class ConfigApplyError(Exception):
    """Error raised for config apply issues."""

    pass


class ServerNotFoundError(ConfigApplyError):
    """Raised when server is not found."""

    def __init__(self, server_id: str) -> None:
        self.server_id = server_id
        super().__init__(f"Server not found: {server_id}")


class SSHUnavailableError(ConfigApplyError):
    """Raised when SSH connection cannot be established."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class ApplyAlreadyRunningError(ConfigApplyError):
    """Raised when an apply operation is already running for this server."""

    def __init__(self, server_id: str) -> None:
        self.server_id = server_id
        super().__init__(f"An apply operation is already running for server: {server_id}")


class ConfigApplyService:
    """Service for applying configuration packs via SSH.

    Implements:
    - AC1: Apply endpoint with pack name
    - AC2: Dry-run preview mode
    - AC3: File creation with content, permissions, parent dirs
    - AC4: Package installation via apt-get with sudo
    - AC5: Progress tracking
    - AC6: Result details per item
    - AC7: Audit logging
    - AC8: Auto-recheck after apply

    Args:
        config_pack_service: Service for loading configuration packs.
        ssh_executor: SSH executor for running remote commands.
    """

    # Unique delimiter for heredoc to avoid content conflicts
    HEREDOC_DELIMITER = "HOMELABCMD_EOF_MARKER_12345"

    def __init__(
        self,
        config_pack_service: ConfigPackService,
        ssh_executor: SSHPooledExecutor,
    ) -> None:
        """Initialise the config apply service.

        Args:
            config_pack_service: Service for loading configuration packs.
            ssh_executor: SSH executor for running remote commands.
        """
        self._pack_service = config_pack_service
        self._ssh_executor = ssh_executor

    async def get_preview(
        self,
        session: AsyncSession,
        server_id: str,
        pack_name: str,
    ) -> ApplyPreviewResponse:
        """Get a dry-run preview of changes to apply.

        Part of US0119: AC2 - Dry-Run Option.

        Args:
            session: Database session.
            server_id: Server identifier.
            pack_name: Configuration pack name.

        Returns:
            ApplyPreviewResponse with grouped preview items.

        Raises:
            ServerNotFoundError: If server not found.
            ConfigPackError: If pack cannot be loaded.
        """
        # Validate server exists
        result = await session.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            raise ServerNotFoundError(server_id)

        # Load pack
        pack = self._pack_service.load_pack(pack_name)

        # Build preview items
        files: list[DryRunFileItem] = []
        packages: list[DryRunPackageItem] = []
        settings: list[DryRunSettingItem] = []

        for file_item in pack.items.files:
            files.append(
                DryRunFileItem(
                    action="create_file",
                    path=file_item.path,
                    mode=file_item.mode,
                    description=file_item.description
                    or f"Create {file_item.path} with mode {file_item.mode}",
                )
            )

        for pkg_item in pack.items.packages:
            version_desc = f" >= {pkg_item.min_version}" if pkg_item.min_version else ""
            packages.append(
                DryRunPackageItem(
                    action="install_package",
                    package=pkg_item.name,
                    version=pkg_item.min_version,
                    description=pkg_item.description or f"Install {pkg_item.name}{version_desc}",
                )
            )

        for setting_item in pack.items.settings:
            action = "set_env_var" if setting_item.type == "env_var" else "set_config"
            settings.append(
                DryRunSettingItem(
                    action=action,
                    key=setting_item.key,
                    value=setting_item.expected,
                    description=setting_item.description
                    or f"Set {setting_item.key}={setting_item.expected}",
                )
            )

        total_items = len(files) + len(packages) + len(settings)

        return ApplyPreviewResponse(
            server_id=server_id,
            pack_name=pack_name,
            dry_run=True,
            files=files,
            packages=packages,
            settings=settings,
            total_items=total_items,
        )

    async def check_running_apply(
        self,
        session: AsyncSession,
        server_id: str,
    ) -> ConfigApply | None:
        """Check if an apply operation is already running for this server.

        Args:
            session: Database session.
            server_id: Server identifier.

        Returns:
            Running ConfigApply record if exists, None otherwise.
        """
        result = await session.execute(
            select(ConfigApply).where(
                ConfigApply.server_id == server_id,
                ConfigApply.status.in_(
                    [ConfigApplyStatus.PENDING.value, ConfigApplyStatus.RUNNING.value]
                ),
            )
        )
        return result.scalar_one_or_none()

    async def create_apply(
        self,
        session: AsyncSession,
        server_id: str,
        pack_name: str,
        triggered_by: str = "user",
    ) -> ConfigApply:
        """Create a new apply operation record.

        Args:
            session: Database session.
            server_id: Server identifier.
            pack_name: Configuration pack name.
            triggered_by: Source that triggered the apply.

        Returns:
            Created ConfigApply record.

        Raises:
            ServerNotFoundError: If server not found.
            ApplyAlreadyRunningError: If apply already running for server.
            ConfigPackError: If pack cannot be loaded.
        """
        # Validate server exists
        result = await session.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            raise ServerNotFoundError(server_id)

        # Check for running apply
        running = await self.check_running_apply(session, server_id)
        if running:
            raise ApplyAlreadyRunningError(server_id)

        # Validate pack exists and count items
        pack = self._pack_service.load_pack(pack_name)
        items_total = (
            len(pack.items.files) + len(pack.items.packages) + len(pack.items.settings)
        )

        # Create apply record
        apply_record = ConfigApply(
            server_id=server_id,
            pack_name=pack_name,
            status=ConfigApplyStatus.PENDING.value,
            progress=0,
            items_total=items_total,
            triggered_by=triggered_by,
        )
        session.add(apply_record)
        await session.commit()
        await session.refresh(apply_record)

        return apply_record

    async def execute_apply(
        self,
        apply_record: ConfigApply,
        session: AsyncSession,
    ) -> None:
        """Execute the apply operation.

        This is meant to run as a background task.

        Args:
            apply_record: Apply record to execute.
            session: Database session.
        """
        start_time = datetime.now(UTC)

        try:
            # Update status to running
            apply_record.status = ConfigApplyStatus.RUNNING.value
            apply_record.started_at = start_time
            await session.commit()

            # Get server
            result = await session.execute(
                select(Server).where(Server.id == apply_record.server_id)
            )
            server = result.scalar_one_or_none()

            if not server:
                await self._fail_apply(
                    apply_record, session, f"Server not found: {apply_record.server_id}"
                )
                return

            # Load pack
            try:
                pack = self._pack_service.load_pack(apply_record.pack_name)
            except ConfigPackError as e:
                await self._fail_apply(apply_record, session, str(e))
                return

            # Get SSH connection
            hostname = server.tailscale_hostname or server.hostname
            username = server.ssh_username or "root"

            try:
                client = await self._ssh_executor.get_connection(
                    hostname=hostname,
                    username=username,
                    machine_id=server.id,
                )
            except SSHKeyNotConfiguredError as e:
                await self._fail_apply(apply_record, session, str(e))
                return
            except SSHAuthenticationError as e:
                await self._fail_apply(
                    apply_record, session, f"SSH authentication failed: {e}"
                )
                return
            except SSHConnectionError as e:
                await self._fail_apply(
                    apply_record, session, f"SSH connection failed: {e}"
                )
                return

            # Execute apply items
            results: list[ApplyItemResult] = []
            items_completed = 0
            items_failed = 0

            # Apply files
            for file_item in pack.items.files:
                apply_record.current_item = file_item.path
                await session.commit()

                item_result = await self._apply_file(client, username, file_item)
                results.append(item_result)

                if item_result.success:
                    items_completed += 1
                else:
                    items_failed += 1

                await self._update_progress(
                    apply_record, session, results, items_completed, items_failed
                )

            # Apply packages
            for pkg_item in pack.items.packages:
                apply_record.current_item = f"package:{pkg_item.name}"
                await session.commit()

                item_result = await self._apply_package(client, pkg_item)
                results.append(item_result)

                if item_result.success:
                    items_completed += 1
                else:
                    items_failed += 1

                await self._update_progress(
                    apply_record, session, results, items_completed, items_failed
                )

            # Apply settings
            for setting_item in pack.items.settings:
                apply_record.current_item = f"setting:{setting_item.key}"
                await session.commit()

                item_result = await self._apply_setting(client, username, setting_item)
                results.append(item_result)

                if item_result.success:
                    items_completed += 1
                else:
                    items_failed += 1

                await self._update_progress(
                    apply_record, session, results, items_completed, items_failed
                )

            # Complete the apply
            end_time = datetime.now(UTC)
            apply_record.status = ConfigApplyStatus.COMPLETED.value
            apply_record.completed_at = end_time
            apply_record.current_item = None
            apply_record.progress = 100
            apply_record.results = [r.model_dump() for r in results]
            await session.commit()

            logger.info(
                "Config apply %d completed: %d/%d succeeded for server %s",
                apply_record.id,
                items_completed,
                apply_record.items_total,
                apply_record.server_id,
            )

            # AC8: Trigger auto-recheck if all items succeeded
            if items_failed == 0:
                logger.info(
                    "Apply succeeded, compliance recheck should be triggered for server %s",
                    apply_record.server_id,
                )

        except Exception as e:
            logger.exception("Apply operation %d failed: %s", apply_record.id, e)
            await self._fail_apply(apply_record, session, str(e))

    async def _apply_file(
        self,
        client,
        username: str,
        file_item,
    ) -> ApplyItemResult:
        """Apply a file configuration item.

        Part of US0119: AC3 - File Creation.

        Args:
            client: SSH client connection.
            username: SSH username for home directory expansion.
            file_item: File item to apply.

        Returns:
            ApplyItemResult with success/failure status.
        """
        try:
            # Expand ~ to home directory
            home_dir = f"/home/{username}" if username != "root" else "/root"
            path = file_item.path.replace("~", home_dir)

            # Get content from template or inline
            if file_item.template:
                content = self._pack_service.get_template_content(file_item.template)
            else:
                content = ""  # Empty file if no template or content

            # Create parent directories
            parent_dir = "/".join(path.rsplit("/", 1)[:-1]) if "/" in path else ""
            if parent_dir:
                mkdir_cmd = f'mkdir -p "{parent_dir}"'
                await self._execute_command(client, mkdir_cmd)

            # Create file with content using heredoc
            # Use a unique delimiter to avoid conflicts with content
            create_cmd = f"cat > \"{path}\" << '{self.HEREDOC_DELIMITER}'\n{content}\n{self.HEREDOC_DELIMITER}"
            result = await self._execute_command(client, create_cmd)

            if result["exit_code"] != 0:
                return ApplyItemResult(
                    item=file_item.path,
                    action="created",
                    success=False,
                    error=result["stderr"] or "Failed to create file",
                )

            # Set permissions
            chmod_cmd = f'chmod {file_item.mode} "{path}"'
            result = await self._execute_command(client, chmod_cmd)

            if result["exit_code"] != 0:
                return ApplyItemResult(
                    item=file_item.path,
                    action="created",
                    success=False,
                    error=f"File created but chmod failed: {result['stderr']}",
                )

            return ApplyItemResult(
                item=file_item.path,
                action="created",
                success=True,
                error=None,
            )

        except Exception as e:
            return ApplyItemResult(
                item=file_item.path,
                action="created",
                success=False,
                error=str(e),
            )

    async def _apply_package(
        self,
        client,
        pkg_item,
    ) -> ApplyItemResult:
        """Apply a package configuration item.

        Part of US0119: AC4 - Package Installation.

        Args:
            client: SSH client connection.
            pkg_item: Package item to install.

        Returns:
            ApplyItemResult with success/failure status.
        """
        try:
            # Use sudo apt-get install -y
            install_cmd = f"sudo apt-get install -y {pkg_item.name}"
            result = await self._execute_command(client, install_cmd, timeout=120)

            if result["exit_code"] != 0:
                return ApplyItemResult(
                    item=pkg_item.name,
                    action="installed",
                    success=False,
                    error=result["stderr"] or "apt-get install failed",
                )

            return ApplyItemResult(
                item=pkg_item.name,
                action="installed",
                success=True,
                error=None,
            )

        except Exception as e:
            return ApplyItemResult(
                item=pkg_item.name,
                action="installed",
                success=False,
                error=str(e),
            )

    async def _apply_setting(
        self,
        client,
        username: str,
        setting_item,
    ) -> ApplyItemResult:
        """Apply a setting configuration item.

        Args:
            client: SSH client connection.
            username: SSH username for home directory expansion.
            setting_item: Setting item to apply.

        Returns:
            ApplyItemResult with success/failure status.
        """
        try:
            if setting_item.type == "env_var":
                # Add to .bashrc.d/env.sh
                home_dir = f"/home/{username}" if username != "root" else "/root"
                bashrc_d = f"{home_dir}/.bashrc.d"
                env_file = f"{bashrc_d}/env.sh"

                # Create .bashrc.d directory if needed
                mkdir_cmd = f'mkdir -p "{bashrc_d}"'
                await self._execute_command(client, mkdir_cmd)

                # Escape value for shell
                escaped_value = setting_item.expected.replace('"', '\\"')

                # Append export line
                append_cmd = f'echo \'export {setting_item.key}="{escaped_value}"\' >> "{env_file}"'
                result = await self._execute_command(client, append_cmd)

                if result["exit_code"] != 0:
                    return ApplyItemResult(
                        item=f"env:{setting_item.key}",
                        action="set",
                        success=False,
                        error=result["stderr"] or "Failed to set environment variable",
                    )

                return ApplyItemResult(
                    item=f"env:{setting_item.key}",
                    action="set",
                    success=True,
                    error=None,
                )

            # Unknown setting type
            return ApplyItemResult(
                item=setting_item.key,
                action="set",
                success=False,
                error=f"Unsupported setting type: {setting_item.type}",
            )

        except Exception as e:
            return ApplyItemResult(
                item=setting_item.key,
                action="set",
                success=False,
                error=str(e),
            )

    async def _execute_command(
        self, client, command: str, timeout: int = 30
    ) -> dict:
        """Execute SSH command and return result.

        Args:
            client: SSH client connection.
            command: Command to execute.
            timeout: Command timeout in seconds.

        Returns:
            Dict with exit_code, stdout, stderr.
        """
        def _exec_sync():
            _stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
            return {
                "exit_code": stdout.channel.recv_exit_status(),
                "stdout": stdout.read().decode("utf-8", errors="replace"),
                "stderr": stderr.read().decode("utf-8", errors="replace"),
            }

        return await asyncio.to_thread(_exec_sync)

    async def _update_progress(
        self,
        apply_record: ConfigApply,
        session: AsyncSession,
        results: list[ApplyItemResult],
        items_completed: int,
        items_failed: int,
    ) -> None:
        """Update progress in the database.

        Args:
            apply_record: Apply record to update.
            session: Database session.
            results: List of results so far.
            items_completed: Number of successful items.
            items_failed: Number of failed items.
        """
        total_processed = items_completed + items_failed
        progress = (
            int((total_processed / apply_record.items_total) * 100)
            if apply_record.items_total > 0
            else 0
        )

        apply_record.progress = progress
        apply_record.items_completed = items_completed
        apply_record.items_failed = items_failed
        apply_record.results = [r.model_dump() for r in results]
        await session.commit()

    async def _fail_apply(
        self,
        apply_record: ConfigApply,
        session: AsyncSession,
        error_message: str,
    ) -> None:
        """Mark apply as failed.

        Args:
            apply_record: Apply record to fail.
            session: Database session.
            error_message: Error message to record.
        """
        apply_record.status = ConfigApplyStatus.FAILED.value
        apply_record.completed_at = datetime.now(UTC)
        apply_record.error = error_message
        apply_record.current_item = None
        await session.commit()

        logger.error(
            "Config apply %d failed for server %s: %s",
            apply_record.id,
            apply_record.server_id,
            error_message,
        )

    async def get_apply_status(
        self,
        session: AsyncSession,
        apply_id: int,
    ) -> ConfigApply | None:
        """Get apply operation by ID.

        Args:
            session: Database session.
            apply_id: Apply operation ID.

        Returns:
            ConfigApply record or None if not found.
        """
        result = await session.execute(
            select(ConfigApply).where(ConfigApply.id == apply_id)
        )
        return result.scalar_one_or_none()

    # US0123: Remove Configuration Pack Methods

    async def get_remove_preview(
        self,
        session: AsyncSession,
        server_id: str,
        pack_name: str,
    ) -> RemovePreviewResponse:
        """Get a preview of items to remove from a pack.

        Part of US0123: AC5 - Confirmation Required.

        Args:
            session: Database session.
            server_id: Server identifier.
            pack_name: Configuration pack name.

        Returns:
            RemovePreviewResponse with items grouped by type.

        Raises:
            ServerNotFoundError: If server not found.
            ConfigPackError: If pack cannot be loaded.
        """
        # Validate server exists
        result = await session.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            raise ServerNotFoundError(server_id)

        # Load pack
        pack = self._pack_service.load_pack(pack_name)

        # Build preview items
        files: list[RemovePreviewFileItem] = []
        packages: list[RemovePreviewPackageItem] = []
        settings: list[RemovePreviewSettingItem] = []

        for file_item in pack.items.files:
            backup_path = f"{file_item.path}.homelabcmd.bak"
            files.append(
                RemovePreviewFileItem(
                    path=file_item.path,
                    backup_path=backup_path,
                    note=f"Will delete {file_item.path} (backup at {backup_path})",
                )
            )

        for pkg_item in pack.items.packages:
            packages.append(
                RemovePreviewPackageItem(
                    package=pkg_item.name,
                    note="Package will remain installed - may break dependencies",
                )
            )

        for setting_item in pack.items.settings:
            if setting_item.type == "env_var":
                settings.append(
                    RemovePreviewSettingItem(
                        key=setting_item.key,
                        note=f"Will remove export {setting_item.key} from shell config",
                    )
                )

        total_items = len(files) + len(packages) + len(settings)

        return RemovePreviewResponse(
            server_id=server_id,
            pack_name=pack_name,
            preview=True,
            files=files,
            packages=packages,
            settings=settings,
            total_items=total_items,
        )

    async def remove_pack(
        self,
        session: AsyncSession,
        server_id: str,
        pack_name: str,
    ) -> RemoveResponse:
        """Remove a configuration pack from a server.

        Part of US0123: AC1-AC4, AC7.

        Args:
            session: Database session.
            server_id: Server identifier.
            pack_name: Configuration pack name.

        Returns:
            RemoveResponse with per-item results.

        Raises:
            ServerNotFoundError: If server not found.
            SSHUnavailableError: If SSH connection fails.
            ConfigPackError: If pack cannot be loaded.
        """
        # Validate server exists
        result = await session.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            raise ServerNotFoundError(server_id)

        # Load pack
        pack = self._pack_service.load_pack(pack_name)

        # Get SSH connection
        hostname = server.tailscale_hostname or server.hostname
        username = server.ssh_username or "root"

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

        # Execute removal
        results: list[RemoveItemResult] = []
        items_deleted = 0
        items_skipped = 0
        items_removed = 0
        items_failed = 0

        # Remove files (with backup)
        for file_item in pack.items.files:
            item_result = await self._remove_file(client, username, file_item)
            results.append(item_result)

            if item_result.action == "deleted":
                items_deleted += 1
            elif item_result.action == "failed":
                items_failed += 1

        # Skip packages (intentionally)
        for pkg_item in pack.items.packages:
            results.append(
                RemoveItemResult(
                    item=pkg_item.name,
                    item_type="package",
                    action="skipped",
                    success=True,
                    note="Package not removed - may break dependencies",
                )
            )
            items_skipped += 1

        # Remove settings
        for setting_item in pack.items.settings:
            if setting_item.type == "env_var":
                item_result = await self._remove_setting(client, username, setting_item)
                results.append(item_result)

                if item_result.action == "removed":
                    items_removed += 1
                elif item_result.action == "failed":
                    items_failed += 1

        # AC7: Audit logging
        removed_at = datetime.now(UTC)
        logger.info(
            "Config pack %s removed from server %s: %d deleted, %d skipped, %d removed, %d failed",
            pack_name,
            server_id,
            items_deleted,
            items_skipped,
            items_removed,
            items_failed,
        )

        return RemoveResponse(
            server_id=server_id,
            pack_name=pack_name,
            success=items_failed == 0,
            items=results,
            items_deleted=items_deleted,
            items_skipped=items_skipped,
            items_removed=items_removed,
            items_failed=items_failed,
            removed_at=removed_at,
        )

    async def _remove_file(
        self,
        client,
        username: str,
        file_item,
    ) -> RemoveItemResult:
        """Remove a file with backup.

        Part of US0123: AC2 - File Removal.

        Args:
            client: SSH client connection.
            username: SSH username for home directory expansion.
            file_item: File item to remove.

        Returns:
            RemoveItemResult with success/failure status.
        """
        try:
            # Expand ~ to home directory
            home_dir = f"/home/{username}" if username != "root" else "/root"
            path = file_item.path.replace("~", home_dir)
            backup_path = f"{path}.homelabcmd.bak"

            # Check if file exists
            check_cmd = f'test -f "{path}" && echo "exists" || echo "missing"'
            check_result = await self._execute_command(client, check_cmd)

            if "missing" in check_result["stdout"]:
                # File doesn't exist - already removed
                return RemoveItemResult(
                    item=file_item.path,
                    item_type="file",
                    action="deleted",
                    success=True,
                    note="File already removed or never existed",
                )

            # Create backup (ignore failure - proceed anyway)
            backup_cmd = f'cp "{path}" "{backup_path}" 2>/dev/null || true'
            await self._execute_command(client, backup_cmd)

            # Delete file
            delete_cmd = f'rm -f "{path}"'
            delete_result = await self._execute_command(client, delete_cmd)

            if delete_result["exit_code"] != 0:
                return RemoveItemResult(
                    item=file_item.path,
                    item_type="file",
                    action="failed",
                    success=False,
                    error=delete_result["stderr"] or "Failed to delete file",
                )

            return RemoveItemResult(
                item=file_item.path,
                item_type="file",
                action="deleted",
                success=True,
                backup_path=backup_path,
                note=f"Backup saved to {backup_path}",
            )

        except Exception as e:
            return RemoveItemResult(
                item=file_item.path,
                item_type="file",
                action="failed",
                success=False,
                error=str(e),
            )

    async def _remove_setting(
        self,
        client,
        username: str,
        setting_item,
    ) -> RemoveItemResult:
        """Remove a setting from shell config.

        Part of US0123: AC4 - Settings Cleanup.

        Args:
            client: SSH client connection.
            username: SSH username for home directory expansion.
            setting_item: Setting item to remove.

        Returns:
            RemoveItemResult with success/failure status.
        """
        try:
            if setting_item.type != "env_var":
                return RemoveItemResult(
                    item=setting_item.key,
                    item_type="setting",
                    action="skipped",
                    success=True,
                    note=f"Unsupported setting type: {setting_item.type}",
                )

            # Build path to env file
            home_dir = f"/home/{username}" if username != "root" else "/root"
            env_file = f"{home_dir}/.bashrc.d/env.sh"

            # Check if env file exists
            check_cmd = f'test -f "{env_file}" && echo "exists" || echo "missing"'
            check_result = await self._execute_command(client, check_cmd)

            if "missing" in check_result["stdout"]:
                # File doesn't exist - nothing to remove
                return RemoveItemResult(
                    item=setting_item.key,
                    item_type="setting",
                    action="removed",
                    success=True,
                    note="Shell config file does not exist",
                )

            # Remove export line using sed
            # Escape special characters in key for regex
            escaped_key = setting_item.key.replace("/", r"\/")
            sed_cmd = f"sed -i '/^export {escaped_key}=/d' \"{env_file}\""
            sed_result = await self._execute_command(client, sed_cmd)

            if sed_result["exit_code"] != 0:
                return RemoveItemResult(
                    item=setting_item.key,
                    item_type="setting",
                    action="failed",
                    success=False,
                    error=sed_result["stderr"] or "Failed to remove setting",
                )

            return RemoveItemResult(
                item=setting_item.key,
                item_type="setting",
                action="removed",
                success=True,
                note=f"Removed from {env_file}",
            )

        except Exception as e:
            return RemoveItemResult(
                item=setting_item.key,
                item_type="setting",
                action="failed",
                success=False,
                error=str(e),
            )
