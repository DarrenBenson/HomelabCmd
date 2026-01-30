"""Tests for SSH Executor command execution (US0151).

Tests the execute() method added to SSHPooledExecutor for synchronous
command execution with timeout support.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from paramiko import SSHException

from homelab_cmd.services.ssh_executor import (
    CommandResult,
    CommandTimeoutError,
    HostKeyChangedError,
    SSHAuthenticationError,
    SSHConnectionError,
    SSHKeyNotConfiguredError,
    SSHPooledExecutor,
)


@pytest.fixture
def mock_credential_service():
    """Create mock credential service."""
    service = MagicMock()
    service.get_credential = AsyncMock(return_value="mock-ssh-key-content")
    return service


@pytest.fixture
def mock_host_key_service():
    """Create mock host key service."""
    service = MagicMock()
    service.get_host_key = AsyncMock(return_value=None)
    service.store_host_key = AsyncMock()
    service.update_last_seen = AsyncMock()
    return service


@pytest.fixture
def executor(mock_credential_service, mock_host_key_service):
    """Create SSH executor with mocked dependencies."""
    return SSHPooledExecutor(mock_credential_service, mock_host_key_service)


@pytest.fixture
def mock_server():
    """Create mock server with tailscale hostname."""
    server = MagicMock()
    server.id = "test-server"
    server.tailscale_hostname = "test-server.tailnet.ts.net"
    server.ssh_username = None
    return server


class TestCommandResultDataclass:
    """Tests for CommandResult dataclass."""

    def test_command_result_fields(self):
        """Verify CommandResult has expected fields."""
        result = CommandResult(
            exit_code=0,
            stdout="output",
            stderr="",
            duration_ms=100,
            hostname="test.local",
        )
        assert result.exit_code == 0
        assert result.stdout == "output"
        assert result.stderr == ""
        assert result.duration_ms == 100
        assert result.hostname == "test.local"

    def test_command_result_with_error(self):
        """Verify CommandResult captures error output."""
        result = CommandResult(
            exit_code=1,
            stdout="",
            stderr="command not found",
            duration_ms=50,
            hostname="test.local",
        )
        assert result.exit_code == 1
        assert result.stderr == "command not found"


class TestCommandTimeoutError:
    """Tests for CommandTimeoutError exception."""

    def test_timeout_error_message(self):
        """Verify timeout error includes hostname, command, and timeout."""
        error = CommandTimeoutError(
            hostname="server.local",
            command="sleep 60",
            timeout=30,
        )
        assert "server.local" in str(error)
        assert "30s" in str(error)
        assert "sleep 60" in str(error)

    def test_timeout_error_truncates_long_command(self):
        """Long commands should be truncated in error message."""
        long_command = "echo " + "x" * 100
        error = CommandTimeoutError(
            hostname="server.local",
            command=long_command,
            timeout=30,
        )
        assert "..." in str(error)

    def test_timeout_error_attributes(self):
        """Verify error stores hostname, command, timeout."""
        error = CommandTimeoutError(
            hostname="server.local",
            command="test",
            timeout=30,
            partial_stdout="partial",
            partial_stderr="err",
        )
        assert error.hostname == "server.local"
        assert error.command == "test"
        assert error.timeout == 30
        assert error.partial_stdout == "partial"
        assert error.partial_stderr == "err"


class TestExecuteValidation:
    """Tests for execute() input validation."""

    @pytest.mark.asyncio
    async def test_empty_command_raises_valueerror(self, executor, mock_server):
        """Empty command string should raise ValueError."""
        with pytest.raises(ValueError, match="Command cannot be empty"):
            await executor.execute(mock_server, "")

    @pytest.mark.asyncio
    async def test_whitespace_command_raises_valueerror(self, executor, mock_server):
        """Whitespace-only command should raise ValueError."""
        with pytest.raises(ValueError, match="Command cannot be empty"):
            await executor.execute(mock_server, "   ")

    @pytest.mark.asyncio
    async def test_no_tailscale_hostname_raises_valueerror(self, executor):
        """Server without tailscale_hostname should raise ValueError."""
        server = MagicMock()
        server.id = "test-server"
        server.tailscale_hostname = None

        with pytest.raises(ValueError, match="no tailscale_hostname"):
            await executor.execute(server, "hostname")


class TestExecuteSuccess:
    """Tests for successful command execution."""

    @pytest.mark.asyncio
    async def test_valid_command_returns_success(
        self, executor, mock_server, mock_credential_service
    ):
        """Valid command returns CommandResult with exit code 0."""
        mock_client = MagicMock()
        mock_transport = MagicMock()
        mock_transport.is_active.return_value = True
        mock_transport.get_remote_server_key.return_value = MagicMock(
            asbytes=lambda: b"key", get_name=lambda: "ssh-rsa", get_base64=lambda: "base64"
        )
        mock_client.get_transport.return_value = mock_transport

        # Mock stdout/stderr
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"test output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        # Mock the connection
        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            result = await executor.execute(mock_server, "hostname")

            assert isinstance(result, CommandResult)
            assert result.exit_code == 0
            assert result.stdout == "test output"
            assert result.stderr == ""
            assert result.duration_ms >= 0
            assert result.hostname == mock_server.tailscale_hostname

    @pytest.mark.asyncio
    async def test_command_with_non_zero_exit(
        self, executor, mock_server, mock_credential_service
    ):
        """Command with non-zero exit returns result with exit code."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b""
        mock_stdout.channel.recv_exit_status.return_value = 1
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b"error: command failed"
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            result = await executor.execute(mock_server, "invalid-command")

            assert result.exit_code == 1
            assert result.stderr == "error: command failed"


class TestExecuteTimeout:
    """Tests for command timeout handling."""

    @pytest.mark.asyncio
    async def test_command_timeout_raises_error(self, executor, mock_server):
        """Command exceeding timeout should raise CommandTimeoutError."""
        mock_client = MagicMock()

        async def slow_to_thread(fn, *args, **kwargs):
            await asyncio.sleep(10)  # Longer than timeout
            return {"exit_code": 0, "stdout": "", "stderr": ""}

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client
            with patch(
                "homelab_cmd.services.ssh_executor.asyncio.to_thread",
                side_effect=slow_to_thread,
            ):
                with pytest.raises(CommandTimeoutError) as exc_info:
                    await executor.execute(mock_server, "sleep 60", timeout=1)

                assert exc_info.value.timeout == 1
                assert exc_info.value.hostname == mock_server.tailscale_hostname


class TestExecuteConnectionReuse:
    """Tests for connection pooling during execution."""

    @pytest.mark.asyncio
    async def test_multiple_commands_reuse_connection(
        self, executor, mock_server, mock_credential_service
    ):
        """Multiple commands to same server should reuse connection."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            await executor.execute(mock_server, "command1")
            await executor.execute(mock_server, "command2")
            await executor.execute(mock_server, "command3")

            # get_connection should be called for each execute
            # (connection reuse is handled within get_connection)
            assert mock_get_conn.call_count == 3


class TestExecuteErrorHandling:
    """Tests for error handling during execution."""

    @pytest.mark.asyncio
    async def test_ssh_key_not_configured(self, executor, mock_server, mock_credential_service):
        """Missing SSH key should raise SSHKeyNotConfiguredError."""
        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.side_effect = SSHKeyNotConfiguredError()

            with pytest.raises(SSHKeyNotConfiguredError):
                await executor.execute(mock_server, "hostname")

    @pytest.mark.asyncio
    async def test_authentication_failure(self, executor, mock_server):
        """Auth failure should raise SSHAuthenticationError."""
        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.side_effect = SSHAuthenticationError(
                hostname="test.local",
                username="test",
            )

            with pytest.raises(SSHAuthenticationError):
                await executor.execute(mock_server, "hostname")

    @pytest.mark.asyncio
    async def test_connection_error_after_retries(self, executor, mock_server):
        """Connection failure after retries should raise SSHConnectionError."""
        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.side_effect = SSHConnectionError(
                hostname="test.local",
                last_error=OSError("Network unreachable"),
                attempts=3,
            )

            with pytest.raises(SSHConnectionError):
                await executor.execute(mock_server, "hostname")

    @pytest.mark.asyncio
    async def test_host_key_changed_error(self, executor, mock_server):
        """Host key change should raise HostKeyChangedError."""
        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.side_effect = HostKeyChangedError(
                hostname="test.local",
                old_fingerprint="SHA256:old",
                new_fingerprint="SHA256:new",
            )

            with pytest.raises(HostKeyChangedError):
                await executor.execute(mock_server, "hostname")

    @pytest.mark.asyncio
    async def test_connection_dropped_mid_command_retries(
        self, executor, mock_server, mock_credential_service
    ):
        """Connection dropped during command should retry with new connection."""
        mock_client = MagicMock()
        mock_client2 = MagicMock()

        # First call fails with SSHException
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""

        # Second client succeeds
        mock_client2.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        call_count = 0

        async def get_connection_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_client  # First connection (will fail on exec)
            return mock_client2  # Second connection (succeeds)

        def exec_side_effect(*args, **kwargs):
            raise SSHException("Connection lost")

        mock_client.exec_command.side_effect = exec_side_effect

        with patch.object(
            executor, "get_connection", side_effect=get_connection_side_effect
        ):
            # The execute method should catch the SSHException and retry
            result = await executor.execute(mock_server, "hostname")

            assert result.exit_code == 0
            assert call_count == 2  # Initial connection + retry


class TestExecuteLogging:
    """Tests for execution logging (AC4)."""

    @pytest.mark.asyncio
    async def test_successful_command_logs_info(
        self, executor, mock_server, mock_credential_service, caplog
    ):
        """Successful commands should log at INFO level."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            import logging

            with caplog.at_level(logging.INFO):
                await executor.execute(mock_server, "hostname")

            # Should have logged the execution
            assert any("Executing command" in record.message for record in caplog.records)
            assert any("Command completed" in record.message for record in caplog.records)

    @pytest.mark.asyncio
    async def test_failed_command_logs_warning(
        self, executor, mock_server, mock_credential_service, caplog
    ):
        """Failed commands should log at WARNING level."""
        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b""
        mock_stdout.channel.recv_exit_status.return_value = 1
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b"error"
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            import logging

            with caplog.at_level(logging.WARNING):
                await executor.execute(mock_server, "invalid-command")

            # Should have logged with exit code
            assert any("exit_code=1" in record.message for record in caplog.records)


class TestExecuteUsernameResolution:
    """Tests for SSH username resolution."""

    @pytest.mark.asyncio
    async def test_uses_server_ssh_username_override(
        self, executor, mock_server, mock_credential_service
    ):
        """Per-server SSH username should be used if set."""
        mock_server.ssh_username = "custom-user"

        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            await executor.execute(mock_server, "hostname")

            # Verify get_connection was called with custom username
            mock_get_conn.assert_called_once()
            call_args = mock_get_conn.call_args
            assert call_args[0][1] == "custom-user"  # username is second positional arg

    @pytest.mark.asyncio
    async def test_falls_back_to_global_username(
        self, executor, mock_server, mock_credential_service
    ):
        """Should use global SSH username if server has none."""
        mock_server.ssh_username = None
        mock_credential_service.get_credential = AsyncMock(
            side_effect=lambda key: "global-user" if key == "ssh_username" else "key-content"
        )

        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            await executor.execute(mock_server, "hostname")

            call_args = mock_get_conn.call_args
            assert call_args[0][1] == "global-user"

    @pytest.mark.asyncio
    async def test_defaults_to_homelabcmd_username(
        self, executor, mock_server, mock_credential_service
    ):
        """Should default to 'homelabcmd' if no username configured."""
        mock_server.ssh_username = None
        mock_credential_service.get_credential = AsyncMock(return_value=None)

        mock_client = MagicMock()
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"output"
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            await executor.execute(mock_server, "hostname")

            call_args = mock_get_conn.call_args
            assert call_args[0][1] == "homelabcmd"


class TestOutputLimiting:
    """Tests for output size limiting."""

    @pytest.mark.asyncio
    async def test_large_output_is_limited(self, executor, mock_server):
        """Output exceeding 10KB should be truncated."""
        mock_client = MagicMock()
        # The mock should simulate read(max_output) returning limited data
        large_output = b"x" * (10 * 1024)  # Exactly 10KB

        mock_stdout = MagicMock()
        mock_stdout.read.return_value = large_output
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

        with patch.object(executor, "get_connection", new_callable=AsyncMock) as mock_get_conn:
            mock_get_conn.return_value = mock_client

            result = await executor.execute(mock_server, "generate-large-output")

            # Output should be limited to 10KB
            assert len(result.stdout) <= 10 * 1024
            # Verify read was called with max_output limit
            mock_stdout.read.assert_called_with(10 * 1024)


class TestExponentialBackoff:
    """Tests for retry timing (edge case from story)."""

    @pytest.mark.asyncio
    async def test_connection_error_uses_existing_retry_logic(
        self, executor, mock_server
    ):
        """Connection errors should use SSHPooledExecutor's existing retry logic."""
        # The execute() method delegates to get_connection() which has retry logic
        # This test verifies the integration
        with patch.object(
            executor, "get_connection", new_callable=AsyncMock
        ) as mock_get_conn:
            mock_get_conn.side_effect = SSHConnectionError(
                hostname="test.local",
                last_error=TimeoutError("Connection timed out"),
                attempts=3,
            )

            with pytest.raises(SSHConnectionError) as exc_info:
                await executor.execute(mock_server, "hostname")

            # Verify error includes attempt count
            assert exc_info.value.attempts == 3
