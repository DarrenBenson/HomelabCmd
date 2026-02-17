"""Unit tests for ConfigApplyService.

Part of EP0010: Configuration Management:
- US0119 Apply Configuration Pack
- US0123 Remove Configuration Pack

These tests cover the service layer methods that were previously untested,
focusing on execute_apply, _apply_file, _apply_package, _apply_setting,
remove_pack, _remove_file, and _remove_setting.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from homelab_cmd.services.config_apply_service import (
    ApplyAlreadyRunningError,
    ConfigApplyError,
    ConfigApplyService,
    ServerNotFoundError,
    SSHUnavailableError,
)
from homelab_cmd.services.ssh_executor import (
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
)


@pytest.fixture
def mock_config_pack_service():
    """Create mock ConfigPackService."""
    service = MagicMock()

    # Create mock pack with all item types
    mock_pack = MagicMock()
    mock_pack.items.files = []
    mock_pack.items.packages = []
    mock_pack.items.settings = []

    service.load_pack.return_value = mock_pack
    service.get_template_content.return_value = "template content"

    return service


@pytest.fixture
def mock_ssh_executor():
    """Create mock SSHPooledExecutor."""
    executor = MagicMock()
    executor.get_connection = AsyncMock()
    return executor


@pytest.fixture
def config_apply_service(mock_config_pack_service, mock_ssh_executor):
    """Create ConfigApplyService with mocked dependencies."""
    return ConfigApplyService(mock_config_pack_service, mock_ssh_executor)


@pytest.fixture
def mock_session():
    """Create mock async database session."""
    session = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def mock_server():
    """Create mock Server model."""
    server = MagicMock()
    server.id = "test-server-id"
    server.tailscale_hostname = "test.tailnet.ts.net"
    server.hostname = "test.local"
    server.ssh_username = "testuser"
    return server


@pytest.fixture
def mock_apply_record():
    """Create mock ConfigApply record."""
    record = MagicMock()
    record.id = 1
    record.server_id = "test-server-id"
    record.pack_name = "test-pack"
    record.status = "pending"
    record.progress = 0
    record.items_total = 3
    record.items_completed = 0
    record.items_failed = 0
    record.current_item = None
    record.results = []
    record.started_at = None
    record.completed_at = None
    record.error = None
    return record


class TestConfigApplyServiceErrors:
    """Tests for custom error classes."""

    def test_server_not_found_error(self):
        """Test ServerNotFoundError includes server_id."""
        error = ServerNotFoundError("test-server")
        assert error.server_id == "test-server"
        assert "test-server" in str(error)

    def test_ssh_unavailable_error(self):
        """Test SSHUnavailableError message."""
        error = SSHUnavailableError("Connection refused")
        assert "Connection refused" in str(error)

    def test_apply_already_running_error(self):
        """Test ApplyAlreadyRunningError includes server_id."""
        error = ApplyAlreadyRunningError("server-123")
        assert error.server_id == "server-123"
        assert "already running" in str(error)

    def test_config_apply_error_base(self):
        """Test base ConfigApplyError."""
        error = ConfigApplyError("Generic error")
        assert "Generic error" in str(error)


class TestExecuteApply:
    """Tests for execute_apply method."""

    @pytest.mark.asyncio
    async def test_execute_apply_server_not_found(
        self, config_apply_service, mock_session, mock_apply_record
    ):
        """Test execute_apply handles missing server."""
        # Server not found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        # Should mark as failed
        assert mock_apply_record.status == "failed"
        assert "Server not found" in mock_apply_record.error

    @pytest.mark.asyncio
    async def test_execute_apply_pack_not_found(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_config_pack_service,
    ):
        """Test execute_apply handles missing pack."""
        from homelab_cmd.services.config_pack_service import ConfigPackError

        # Server exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        # Pack not found
        mock_config_pack_service.load_pack.side_effect = ConfigPackError("Pack not found")

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "failed"
        assert "Pack not found" in mock_apply_record.error

    @pytest.mark.asyncio
    async def test_execute_apply_ssh_key_not_configured(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
    ):
        """Test execute_apply handles missing SSH key."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_ssh_executor.get_connection.side_effect = SSHKeyNotConfiguredError()

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "failed"
        assert "SSH key" in mock_apply_record.error

    @pytest.mark.asyncio
    async def test_execute_apply_ssh_auth_failure(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
    ):
        """Test execute_apply handles SSH authentication failure."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_ssh_executor.get_connection.side_effect = SSHAuthenticationError(
            hostname="test.local", username="testuser"
        )

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "failed"
        assert "authentication" in mock_apply_record.error.lower()

    @pytest.mark.asyncio
    async def test_execute_apply_ssh_connection_failure(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
    ):
        """Test execute_apply handles SSH connection failure."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_ssh_executor.get_connection.side_effect = SSHConnectionError(
            hostname="test.local", last_error=OSError("Connection refused"), attempts=3
        )

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "failed"
        assert "connection" in mock_apply_record.error.lower()

    @pytest.mark.asyncio
    async def test_execute_apply_success_with_files(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
        mock_config_pack_service,
    ):
        """Test execute_apply successfully applies file items."""
        # Setup server lookup
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        # Setup pack with file items
        mock_file_item = MagicMock()
        mock_file_item.path = "~/.bashrc.d/test.sh"
        mock_file_item.mode = "0644"
        mock_file_item.template = "test.sh"
        mock_file_item.description = "Test file"

        mock_pack = MagicMock()
        mock_pack.items.files = [mock_file_item]
        mock_pack.items.packages = []
        mock_pack.items.settings = []
        mock_config_pack_service.load_pack.return_value = mock_pack

        # Setup SSH client
        mock_client = MagicMock()
        mock_ssh_executor.get_connection.return_value = mock_client

        # Mock exec_command to return success
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_apply_record.items_total = 1

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "completed"
        assert mock_apply_record.progress == 100

    @pytest.mark.asyncio
    async def test_execute_apply_success_with_packages(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
        mock_config_pack_service,
    ):
        """Test execute_apply successfully applies package items."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        # Setup pack with package items
        mock_pkg_item = MagicMock()
        mock_pkg_item.name = "curl"
        mock_pkg_item.min_version = "8.0.0"
        mock_pkg_item.description = "HTTP client"

        mock_pack = MagicMock()
        mock_pack.items.files = []
        mock_pack.items.packages = [mock_pkg_item]
        mock_pack.items.settings = []
        mock_config_pack_service.load_pack.return_value = mock_pack

        mock_client = MagicMock()
        mock_ssh_executor.get_connection.return_value = mock_client

        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_apply_record.items_total = 1

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "completed"

    @pytest.mark.asyncio
    async def test_execute_apply_success_with_settings(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
        mock_config_pack_service,
    ):
        """Test execute_apply successfully applies setting items."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        # Setup pack with setting items
        mock_setting_item = MagicMock()
        mock_setting_item.key = "EDITOR"
        mock_setting_item.expected = "vim"
        mock_setting_item.type = "env_var"
        mock_setting_item.description = "Default editor"

        mock_pack = MagicMock()
        mock_pack.items.files = []
        mock_pack.items.packages = []
        mock_pack.items.settings = [mock_setting_item]
        mock_config_pack_service.load_pack.return_value = mock_pack

        mock_client = MagicMock()
        mock_ssh_executor.get_connection.return_value = mock_client

        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_apply_record.items_total = 1

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "completed"

    @pytest.mark.asyncio
    async def test_execute_apply_handles_exception(
        self,
        config_apply_service,
        mock_session,
        mock_apply_record,
        mock_server,
        mock_ssh_executor,
        mock_config_pack_service,
    ):
        """Test execute_apply handles unexpected exceptions during connection."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        # Raise unexpected error during SSH connection
        mock_ssh_executor.get_connection.side_effect = RuntimeError("Unexpected error")

        mock_pack = MagicMock()
        mock_pack.items.files = []
        mock_pack.items.packages = []
        mock_pack.items.settings = []
        mock_config_pack_service.load_pack.return_value = mock_pack
        mock_apply_record.items_total = 0

        await config_apply_service.execute_apply(mock_apply_record, mock_session)

        assert mock_apply_record.status == "failed"
        assert "Unexpected error" in mock_apply_record.error


class TestApplyFile:
    """Tests for _apply_file method."""

    @pytest.mark.asyncio
    async def test_apply_file_success(self, config_apply_service, mock_config_pack_service):
        """Test _apply_file creates file successfully."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file_item = MagicMock()
        mock_file_item.path = "~/.bashrc.d/test.sh"
        mock_file_item.mode = "0644"
        mock_file_item.template = "test.sh"

        result = await config_apply_service._apply_file(mock_client, "testuser", mock_file_item)

        assert result.success is True
        assert result.action == "created"

    @pytest.mark.asyncio
    async def test_apply_file_expands_tilde_for_user(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file expands ~ to /home/user."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file_item = MagicMock()
        mock_file_item.path = "~/.bashrc"
        mock_file_item.mode = "0644"
        mock_file_item.template = None

        await config_apply_service._apply_file(mock_client, "testuser", mock_file_item)

        # Verify command contains expanded path
        calls = mock_client.exec_command.call_args_list
        mkdir_call = calls[0][0][0]
        assert "/home/testuser" in mkdir_call

    @pytest.mark.asyncio
    async def test_apply_file_expands_tilde_for_root(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file expands ~ to /root for root user."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file_item = MagicMock()
        mock_file_item.path = "~/.bashrc"
        mock_file_item.mode = "0644"
        mock_file_item.template = None

        await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        calls = mock_client.exec_command.call_args_list
        mkdir_call = calls[0][0][0]
        assert "/root" in mkdir_call

    @pytest.mark.asyncio
    async def test_apply_file_creates_parent_directory(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file creates parent directories with mkdir -p."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file_item = MagicMock()
        mock_file_item.path = "/etc/myapp/config/test.conf"
        mock_file_item.mode = "0644"
        mock_file_item.template = None

        await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        calls = mock_client.exec_command.call_args_list
        mkdir_call = calls[0][0][0]
        assert "mkdir -p" in mkdir_call
        assert "/etc/myapp/config" in mkdir_call

    @pytest.mark.asyncio
    async def test_apply_file_uses_heredoc_delimiter(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file uses unique heredoc delimiter."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file_item = MagicMock()
        mock_file_item.path = "/etc/test.conf"
        mock_file_item.mode = "0644"
        mock_file_item.template = "test.conf"

        await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        calls = mock_client.exec_command.call_args_list
        # Second call should be the cat heredoc
        cat_call = calls[1][0][0]
        assert ConfigApplyService.HEREDOC_DELIMITER in cat_call

    @pytest.mark.asyncio
    async def test_apply_file_sets_permissions(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file sets chmod permissions."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file_item = MagicMock()
        mock_file_item.path = "/etc/test.conf"
        mock_file_item.mode = "0755"
        mock_file_item.template = None

        await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        calls = mock_client.exec_command.call_args_list
        # Third call should be chmod
        chmod_call = calls[2][0][0]
        assert "chmod 0755" in chmod_call

    @pytest.mark.asyncio
    async def test_apply_file_failure_on_create(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file handles file creation failure."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()
            if call_count == 1:  # mkdir
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b""
            else:  # cat (failure)
                mock_stdout.channel.recv_exit_status.return_value = 1
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b"Permission denied"
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_file_item = MagicMock()
        mock_file_item.path = "/etc/test.conf"
        mock_file_item.mode = "0644"
        mock_file_item.template = None

        result = await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        assert result.success is False
        assert "Permission denied" in result.error or "Failed to create" in result.error

    @pytest.mark.asyncio
    async def test_apply_file_failure_on_chmod(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file handles chmod failure."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()
            if call_count <= 2:  # mkdir and cat
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b""
            else:  # chmod (failure)
                mock_stdout.channel.recv_exit_status.return_value = 1
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b"chmod failed"
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_file_item = MagicMock()
        mock_file_item.path = "/etc/test.conf"
        mock_file_item.mode = "0644"
        mock_file_item.template = None

        result = await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        assert result.success is False
        assert "chmod failed" in result.error

    @pytest.mark.asyncio
    async def test_apply_file_handles_exception(
        self, config_apply_service, mock_config_pack_service
    ):
        """Test _apply_file handles unexpected exceptions."""
        mock_client = MagicMock()
        mock_client.exec_command.side_effect = RuntimeError("Unexpected error")

        mock_file_item = MagicMock()
        mock_file_item.path = "/etc/test.conf"
        mock_file_item.mode = "0644"
        mock_file_item.template = None

        result = await config_apply_service._apply_file(mock_client, "root", mock_file_item)

        assert result.success is False
        assert "Unexpected error" in result.error


class TestApplyPackage:
    """Tests for _apply_package method."""

    @pytest.mark.asyncio
    async def test_apply_package_success(self, config_apply_service):
        """Test _apply_package installs package successfully."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"Package installed"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_pkg_item = MagicMock()
        mock_pkg_item.name = "curl"

        result = await config_apply_service._apply_package(mock_client, mock_pkg_item)

        assert result.success is True
        assert result.item == "curl"
        assert result.action == "installed"

    @pytest.mark.asyncio
    async def test_apply_package_uses_sudo_apt(self, config_apply_service):
        """Test _apply_package uses sudo apt-get install -y."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_pkg_item = MagicMock()
        mock_pkg_item.name = "nginx"

        await config_apply_service._apply_package(mock_client, mock_pkg_item)

        call_args = mock_client.exec_command.call_args
        cmd = call_args[0][0]
        assert "sudo" in cmd
        assert "apt-get install -y" in cmd
        assert "nginx" in cmd

    @pytest.mark.asyncio
    async def test_apply_package_uses_extended_timeout(self, config_apply_service):
        """Test _apply_package uses 120s timeout."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_pkg_item = MagicMock()
        mock_pkg_item.name = "nginx"

        await config_apply_service._apply_package(mock_client, mock_pkg_item)

        call_args = mock_client.exec_command.call_args
        assert call_args[1]["timeout"] == 120

    @pytest.mark.asyncio
    async def test_apply_package_failure(self, config_apply_service):
        """Test _apply_package handles installation failure."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 100
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b"E: Unable to locate package fake-package"
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_pkg_item = MagicMock()
        mock_pkg_item.name = "fake-package"

        result = await config_apply_service._apply_package(mock_client, mock_pkg_item)

        assert result.success is False
        assert "Unable to locate package" in result.error

    @pytest.mark.asyncio
    async def test_apply_package_handles_exception(self, config_apply_service):
        """Test _apply_package handles unexpected exceptions."""
        mock_client = MagicMock()
        mock_client.exec_command.side_effect = RuntimeError("Network error")

        mock_pkg_item = MagicMock()
        mock_pkg_item.name = "curl"

        result = await config_apply_service._apply_package(mock_client, mock_pkg_item)

        assert result.success is False
        assert "Network error" in result.error


class TestApplySetting:
    """Tests for _apply_setting method."""

    @pytest.mark.asyncio
    async def test_apply_setting_env_var_success(self, config_apply_service):
        """Test _apply_setting creates env var successfully."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_setting = MagicMock()
        mock_setting.key = "EDITOR"
        mock_setting.expected = "vim"
        mock_setting.type = "env_var"

        result = await config_apply_service._apply_setting(mock_client, "testuser", mock_setting)

        assert result.success is True
        assert "env:EDITOR" in result.item
        assert result.action == "set"

    @pytest.mark.asyncio
    async def test_apply_setting_creates_bashrc_d_directory(self, config_apply_service):
        """Test _apply_setting creates .bashrc.d directory."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_setting = MagicMock()
        mock_setting.key = "PATH_ADDON"
        mock_setting.expected = "/opt/bin"
        mock_setting.type = "env_var"

        await config_apply_service._apply_setting(mock_client, "testuser", mock_setting)

        calls = mock_client.exec_command.call_args_list
        mkdir_call = calls[0][0][0]
        assert "mkdir -p" in mkdir_call
        assert ".bashrc.d" in mkdir_call

    @pytest.mark.asyncio
    async def test_apply_setting_escapes_value(self, config_apply_service):
        """Test _apply_setting escapes special characters in value."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_setting = MagicMock()
        mock_setting.key = "TEST_VAR"
        mock_setting.expected = 'value with "quotes"'
        mock_setting.type = "env_var"

        await config_apply_service._apply_setting(mock_client, "testuser", mock_setting)

        calls = mock_client.exec_command.call_args_list
        echo_call = calls[1][0][0]
        assert '\\"' in echo_call  # Escaped quotes

    @pytest.mark.asyncio
    async def test_apply_setting_unsupported_type(self, config_apply_service):
        """Test _apply_setting handles unsupported setting types."""
        mock_client = MagicMock()

        mock_setting = MagicMock()
        mock_setting.key = "UNSUPPORTED"
        mock_setting.expected = "value"
        mock_setting.type = "unknown_type"

        result = await config_apply_service._apply_setting(mock_client, "testuser", mock_setting)

        assert result.success is False
        assert "Unsupported setting type" in result.error

    @pytest.mark.asyncio
    async def test_apply_setting_failure(self, config_apply_service):
        """Test _apply_setting handles failure."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()
            if call_count == 1:  # mkdir
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b""
            else:  # echo (failure)
                mock_stdout.channel.recv_exit_status.return_value = 1
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b"Cannot write to file"
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_setting = MagicMock()
        mock_setting.key = "TEST"
        mock_setting.expected = "value"
        mock_setting.type = "env_var"

        result = await config_apply_service._apply_setting(mock_client, "testuser", mock_setting)

        assert result.success is False

    @pytest.mark.asyncio
    async def test_apply_setting_handles_exception(self, config_apply_service):
        """Test _apply_setting handles unexpected exceptions."""
        mock_client = MagicMock()
        mock_client.exec_command.side_effect = RuntimeError("Error")

        mock_setting = MagicMock()
        mock_setting.key = "TEST"
        mock_setting.expected = "value"
        mock_setting.type = "env_var"

        result = await config_apply_service._apply_setting(mock_client, "testuser", mock_setting)

        assert result.success is False
        assert "Error" in result.error


class TestRemovePack:
    """Tests for remove_pack method (US0123)."""

    @pytest.mark.asyncio
    async def test_remove_pack_server_not_found(
        self, config_apply_service, mock_session
    ):
        """Test remove_pack raises error when server not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        with pytest.raises(ServerNotFoundError):
            await config_apply_service.remove_pack(mock_session, "unknown", "test-pack")

    @pytest.mark.asyncio
    async def test_remove_pack_ssh_key_not_configured(
        self,
        config_apply_service,
        mock_session,
        mock_server,
        mock_ssh_executor,
    ):
        """Test remove_pack raises SSHUnavailableError when no SSH key."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_ssh_executor.get_connection.side_effect = SSHKeyNotConfiguredError()

        with pytest.raises(SSHUnavailableError):
            await config_apply_service.remove_pack(
                mock_session, mock_server.id, "test-pack"
            )

    @pytest.mark.asyncio
    async def test_remove_pack_ssh_auth_failure(
        self,
        config_apply_service,
        mock_session,
        mock_server,
        mock_ssh_executor,
    ):
        """Test remove_pack raises SSHUnavailableError on auth failure."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_ssh_executor.get_connection.side_effect = SSHAuthenticationError(
            hostname="test.local", username="testuser"
        )

        with pytest.raises(SSHUnavailableError) as exc_info:
            await config_apply_service.remove_pack(
                mock_session, mock_server.id, "test-pack"
            )
        assert "authentication" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_remove_pack_ssh_connection_failure(
        self,
        config_apply_service,
        mock_session,
        mock_server,
        mock_ssh_executor,
    ):
        """Test remove_pack raises SSHUnavailableError on connection failure."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_ssh_executor.get_connection.side_effect = SSHConnectionError(
            hostname="test.local", last_error=OSError(), attempts=3
        )

        with pytest.raises(SSHUnavailableError) as exc_info:
            await config_apply_service.remove_pack(
                mock_session, mock_server.id, "test-pack"
            )
        assert "connection" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_remove_pack_success(
        self,
        config_apply_service,
        mock_session,
        mock_server,
        mock_ssh_executor,
        mock_config_pack_service,
    ):
        """Test remove_pack successfully removes items."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        # Setup pack with items
        mock_file = MagicMock()
        mock_file.path = "~/.bashrc.d/test.sh"
        mock_pkg = MagicMock()
        mock_pkg.name = "curl"
        mock_setting = MagicMock()
        mock_setting.key = "EDITOR"
        mock_setting.type = "env_var"

        mock_pack = MagicMock()
        mock_pack.items.files = [mock_file]
        mock_pack.items.packages = [mock_pkg]
        mock_pack.items.settings = [mock_setting]
        mock_config_pack_service.load_pack.return_value = mock_pack

        # Setup SSH client
        mock_client = MagicMock()
        mock_ssh_executor.get_connection.return_value = mock_client

        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"exists"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        response = await config_apply_service.remove_pack(
            mock_session, mock_server.id, "test-pack"
        )

        assert response.success is True
        assert response.items_skipped == 1  # Package skipped
        assert len(response.items) == 3

    @pytest.mark.asyncio
    async def test_remove_pack_packages_are_skipped(
        self,
        config_apply_service,
        mock_session,
        mock_server,
        mock_ssh_executor,
        mock_config_pack_service,
    ):
        """Test remove_pack skips packages (AC3)."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_server
        mock_session.execute.return_value = mock_result

        mock_pkg = MagicMock()
        mock_pkg.name = "curl"

        mock_pack = MagicMock()
        mock_pack.items.files = []
        mock_pack.items.packages = [mock_pkg]
        mock_pack.items.settings = []
        mock_config_pack_service.load_pack.return_value = mock_pack

        mock_client = MagicMock()
        mock_ssh_executor.get_connection.return_value = mock_client

        response = await config_apply_service.remove_pack(
            mock_session, mock_server.id, "test-pack"
        )

        assert response.items_skipped == 1
        assert response.items[0].action == "skipped"
        # Note contains info about dependencies
        assert "dependencies" in response.items[0].note.lower()


class TestRemoveFile:
    """Tests for _remove_file method (US0123 AC2)."""

    @pytest.mark.asyncio
    async def test_remove_file_success_with_backup(self, config_apply_service):
        """Test _remove_file creates backup and deletes file."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()
            mock_stdout.channel.recv_exit_status.return_value = 0
            mock_stderr.read.return_value = b""

            if "test -f" in cmd:
                mock_stdout.read.return_value = b"exists"
            else:
                mock_stdout.read.return_value = b""
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_file = MagicMock()
        mock_file.path = "/etc/test.conf"

        result = await config_apply_service._remove_file(mock_client, "root", mock_file)

        assert result.success is True
        assert result.action == "deleted"
        assert result.backup_path is not None
        assert ".homelabcmd.bak" in result.backup_path

    @pytest.mark.asyncio
    async def test_remove_file_already_missing(self, config_apply_service):
        """Test _remove_file handles already-removed file."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"missing"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file = MagicMock()
        mock_file.path = "/etc/nonexistent.conf"

        result = await config_apply_service._remove_file(mock_client, "root", mock_file)

        assert result.success is True
        assert result.action == "deleted"
        assert "already" in result.note.lower() or "never existed" in result.note.lower()

    @pytest.mark.asyncio
    async def test_remove_file_failure(self, config_apply_service):
        """Test _remove_file handles deletion failure."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()

            if "test -f" in cmd:
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b"exists"
                mock_stderr.read.return_value = b""
            elif "cp " in cmd:
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b""
            elif "rm -f" in cmd:
                mock_stdout.channel.recv_exit_status.return_value = 1
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b"Permission denied"
            else:
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b""
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_file = MagicMock()
        mock_file.path = "/etc/protected.conf"

        result = await config_apply_service._remove_file(mock_client, "root", mock_file)

        assert result.success is False
        assert result.action == "failed"

    @pytest.mark.asyncio
    async def test_remove_file_expands_tilde(self, config_apply_service):
        """Test _remove_file expands ~ to home directory."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"exists"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_file = MagicMock()
        mock_file.path = "~/.bashrc.d/test.sh"

        await config_apply_service._remove_file(mock_client, "testuser", mock_file)

        calls = mock_client.exec_command.call_args_list
        check_call = calls[0][0][0]
        assert "/home/testuser" in check_call

    @pytest.mark.asyncio
    async def test_remove_file_handles_exception(self, config_apply_service):
        """Test _remove_file handles unexpected exceptions."""
        mock_client = MagicMock()
        mock_client.exec_command.side_effect = RuntimeError("Network error")

        mock_file = MagicMock()
        mock_file.path = "/etc/test.conf"

        result = await config_apply_service._remove_file(mock_client, "root", mock_file)

        assert result.success is False
        assert result.action == "failed"
        assert "Network error" in result.error


class TestRemoveSetting:
    """Tests for _remove_setting method (US0123 AC4)."""

    @pytest.mark.asyncio
    async def test_remove_setting_success(self, config_apply_service):
        """Test _remove_setting removes setting successfully."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()
            mock_stdout.channel.recv_exit_status.return_value = 0
            mock_stderr.read.return_value = b""

            if "test -f" in cmd:
                mock_stdout.read.return_value = b"exists"
            else:
                mock_stdout.read.return_value = b""
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_setting = MagicMock()
        mock_setting.key = "EDITOR"
        mock_setting.type = "env_var"

        result = await config_apply_service._remove_setting(mock_client, "testuser", mock_setting)

        assert result.success is True
        assert result.action == "removed"

    @pytest.mark.asyncio
    async def test_remove_setting_uses_sed(self, config_apply_service):
        """Test _remove_setting uses sed to remove export lines."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"exists"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_setting = MagicMock()
        mock_setting.key = "MY_VAR"
        mock_setting.type = "env_var"

        await config_apply_service._remove_setting(mock_client, "testuser", mock_setting)

        calls = mock_client.exec_command.call_args_list
        sed_call = calls[1][0][0]
        assert "sed -i" in sed_call
        assert "export MY_VAR=" in sed_call

    @pytest.mark.asyncio
    async def test_remove_setting_env_file_missing(self, config_apply_service):
        """Test _remove_setting handles missing env file."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"missing"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        mock_setting = MagicMock()
        mock_setting.key = "EDITOR"
        mock_setting.type = "env_var"

        result = await config_apply_service._remove_setting(mock_client, "testuser", mock_setting)

        assert result.success is True
        assert result.action == "removed"
        assert "does not exist" in result.note

    @pytest.mark.asyncio
    async def test_remove_setting_unsupported_type(self, config_apply_service):
        """Test _remove_setting handles unsupported setting types."""
        mock_client = MagicMock()

        mock_setting = MagicMock()
        mock_setting.key = "UNKNOWN"
        mock_setting.type = "unsupported_type"

        result = await config_apply_service._remove_setting(mock_client, "testuser", mock_setting)

        assert result.success is True
        assert result.action == "skipped"
        assert "Unsupported" in result.note

    @pytest.mark.asyncio
    async def test_remove_setting_sed_failure(self, config_apply_service):
        """Test _remove_setting handles sed failure."""
        mock_client = MagicMock()

        call_count = 0
        def exec_side_effect(cmd, timeout=30):
            nonlocal call_count
            call_count += 1
            mock_stdout = MagicMock()
            mock_stderr = MagicMock()

            if "test -f" in cmd:
                mock_stdout.channel.recv_exit_status.return_value = 0
                mock_stdout.read.return_value = b"exists"
                mock_stderr.read.return_value = b""
            else:  # sed
                mock_stdout.channel.recv_exit_status.return_value = 1
                mock_stdout.read.return_value = b""
                mock_stderr.read.return_value = b"sed: error"
            return (MagicMock(), mock_stdout, mock_stderr)

        mock_client.exec_command.side_effect = exec_side_effect

        mock_setting = MagicMock()
        mock_setting.key = "EDITOR"
        mock_setting.type = "env_var"

        result = await config_apply_service._remove_setting(mock_client, "testuser", mock_setting)

        assert result.success is False
        assert result.action == "failed"

    @pytest.mark.asyncio
    async def test_remove_setting_handles_exception(self, config_apply_service):
        """Test _remove_setting handles unexpected exceptions."""
        mock_client = MagicMock()
        mock_client.exec_command.side_effect = RuntimeError("Error")

        mock_setting = MagicMock()
        mock_setting.key = "EDITOR"
        mock_setting.type = "env_var"

        result = await config_apply_service._remove_setting(mock_client, "testuser", mock_setting)

        assert result.success is False
        assert result.action == "failed"
        assert "Error" in result.error


class TestExecuteCommand:
    """Tests for _execute_command method."""

    @pytest.mark.asyncio
    async def test_execute_command_success(self, config_apply_service):
        """Test _execute_command returns result dict."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"output"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        result = await config_apply_service._execute_command(mock_client, "echo test")

        assert result["exit_code"] == 0
        assert result["stdout"] == "output"
        assert result["stderr"] == ""

    @pytest.mark.asyncio
    async def test_execute_command_with_timeout(self, config_apply_service):
        """Test _execute_command passes timeout to SSH."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b""
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        await config_apply_service._execute_command(mock_client, "test", timeout=60)

        call_args = mock_client.exec_command.call_args
        assert call_args[1]["timeout"] == 60

    @pytest.mark.asyncio
    async def test_execute_command_handles_unicode(self, config_apply_service):
        """Test _execute_command handles non-UTF8 output."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"valid \xff invalid"
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        result = await config_apply_service._execute_command(mock_client, "test")

        # Should not raise, should use replacement character
        assert "valid" in result["stdout"]


class TestUpdateProgress:
    """Tests for _update_progress method."""

    @pytest.mark.asyncio
    async def test_update_progress(self, config_apply_service, mock_session, mock_apply_record):
        """Test _update_progress updates record."""
        from homelab_cmd.api.schemas.config_apply import ApplyItemResult

        results = [
            ApplyItemResult(item="test1", action="created", success=True, error=None),
            ApplyItemResult(item="test2", action="installed", success=False, error="Error"),
        ]

        await config_apply_service._update_progress(
            mock_apply_record, mock_session, results, items_completed=1, items_failed=1
        )

        assert mock_apply_record.items_completed == 1
        assert mock_apply_record.items_failed == 1
        assert mock_apply_record.progress == 66  # 2/3 * 100
        mock_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_update_progress_zero_total(
        self, config_apply_service, mock_session, mock_apply_record
    ):
        """Test _update_progress handles zero total items."""
        mock_apply_record.items_total = 0

        await config_apply_service._update_progress(
            mock_apply_record, mock_session, [], items_completed=0, items_failed=0
        )

        assert mock_apply_record.progress == 0


class TestFailApply:
    """Tests for _fail_apply method."""

    @pytest.mark.asyncio
    async def test_fail_apply_sets_status(
        self, config_apply_service, mock_session, mock_apply_record
    ):
        """Test _fail_apply sets failed status."""
        await config_apply_service._fail_apply(
            mock_apply_record, mock_session, "Test error message"
        )

        assert mock_apply_record.status == "failed"
        assert mock_apply_record.error == "Test error message"
        assert mock_apply_record.completed_at is not None
        assert mock_apply_record.current_item is None
        mock_session.commit.assert_called()
