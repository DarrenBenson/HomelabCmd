"""Command execution module for the HomelabCmd agent (US0027).

This module handles secure command execution with whitelist validation,
timeout enforcement, and output capture.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

# Maximum output size (10KB as per US0025)
MAX_OUTPUT_SIZE = 10000

# Default command timeout in seconds
DEFAULT_TIMEOUT = 30

# Pi-hole restart delay in seconds (30 minutes) - AC6
PIHOLE_RESTART_DELAY = 30 * 60

# Command whitelist patterns (US0027 - AC4, US0052, US0074)
# Each pattern is a regex that commands must match exactly
# Note: APT::Sandbox::User=root disables apt's privilege dropping which can fail on some systems
# DEBIAN_FRONTEND=noninteractive and Dpkg options ensure non-interactive execution (US0074)
APT_OPTIONS = '-q -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"'
DEBIAN_FRONTEND = "DEBIAN_FRONTEND=noninteractive"

COMMAND_WHITELIST: dict[str, str] = {
    "restart_service": r"^systemctl restart [a-zA-Z0-9_-]+$",
    "clear_logs": r"^journalctl --vacuum-time=\d+[dhms]$",
    "apply_updates": rf"^{DEBIAN_FRONTEND} apt-get update && {DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS}$",
    # US0052: APT package update actions
    "apt_update": rf"^{DEBIAN_FRONTEND} apt-get update -q -o APT::Sandbox::User=root$",
    "apt_upgrade": rf"^{DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS} -o APT::Sandbox::User=root$",
    "apt_install": rf"^{DEBIAN_FRONTEND} apt-get install {APT_OPTIONS} -o APT::Sandbox::User=root [a-zA-Z0-9_.+ -]+$",
    "echo_no_security": r"^echo 'No security packages to upgrade'$",
}

# Track last Pi-hole restart timestamps (server_id -> datetime)
_pihole_last_restart: dict[str, datetime] = {}


def is_whitelisted(command: str) -> bool:
    """Check if a command matches any whitelist pattern.

    Args:
        command: The shell command to validate

    Returns:
        True if command matches a whitelist pattern, False otherwise
    """
    for pattern in COMMAND_WHITELIST.values():
        if re.match(pattern, command):
            return True
    return False


def check_pihole_delay(command: str, server_id: str) -> tuple[bool, int]:
    """Check if Pi-hole restart should be delayed (AC6).

    Pi-hole restarts are staggered by 30 minutes to prevent DNS outages
    when multiple Pi-hole servers need restarting.

    Args:
        command: The command to execute
        server_id: The server identifier

    Returns:
        Tuple of (should_delay, delay_seconds_remaining)
    """
    # Check if this is a Pi-hole restart
    if "pihole" not in command.lower():
        return (False, 0)

    last_restart = _pihole_last_restart.get(server_id)
    if last_restart is None:
        return (False, 0)

    elapsed = (datetime.now(UTC) - last_restart).total_seconds()
    if elapsed < PIHOLE_RESTART_DELAY:
        remaining = int(PIHOLE_RESTART_DELAY - elapsed)
        return (True, remaining)

    return (False, 0)


def record_pihole_restart(command: str, server_id: str) -> None:
    """Record a Pi-hole restart timestamp.

    Args:
        command: The command that was executed
        server_id: The server identifier
    """
    if "pihole" in command.lower():
        _pihole_last_restart[server_id] = datetime.now(UTC)
        logger.info("Recorded Pi-hole restart for server %s", server_id)


@dataclass
class CommandResult:
    """Result of command execution."""

    action_id: int
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    executed_at: datetime
    completed_at: datetime
    is_background: bool = False


async def execute_command(
    action_id: int,
    command: str,
    timeout: int = DEFAULT_TIMEOUT,
    use_sudo: bool = False,
    server_id: str | None = None,
) -> CommandResult:
    """Execute a command with whitelist validation and timeout.

    Args:
        action_id: ID of the action being executed
        command: Shell command to execute
        timeout: Maximum execution time in seconds
        use_sudo: Whether to prefix command with sudo
        server_id: Server ID for Pi-hole tracking (optional)

    Returns:
        CommandResult with execution details
    """
    executed_at = datetime.now(UTC)

    # Validate against whitelist (AC4)
    if not is_whitelisted(command):
        logger.warning("Command not in whitelist: %s", command)
        return CommandResult(
            action_id=action_id,
            success=False,
            exit_code=-1,
            stdout="",
            stderr="Command not in whitelist",
            executed_at=executed_at,
            completed_at=datetime.now(UTC),
        )

    # Check Pi-hole delay (AC6)
    if server_id:
        should_delay, delay_seconds = check_pihole_delay(command, server_id)
        if should_delay:
            logger.info(
                "Pi-hole restart delayed by %d seconds for server %s",
                delay_seconds,
                server_id,
            )
            return CommandResult(
                action_id=action_id,
                success=False,
                exit_code=-2,  # Special code for delayed
                stdout="",
                stderr=f"Pi-hole restart delayed - another restart occurred recently. Retry in {delay_seconds} seconds.",
                executed_at=executed_at,
                completed_at=datetime.now(UTC),
            )

    # Optionally prefix with sudo (AC5)
    exec_command = f"sudo {command}" if use_sudo else command

    # US0074: Detached background execution for long-running apt actions
    is_apt_upgrade = "apt-get dist-upgrade" in command or "apt-get upgrade" in command or "apt-get install" in command
    if is_apt_upgrade:
        logger.info(
            "Executing long-running command in background (action %d): %s", action_id, exec_command
        )
        # For background execution, we start the process and return immediately
        # The agent loop will poll for its completion using a marker file or similar
        # For now, we'll implement a simple "fire and forget" that logs to a file
        log_file = f"/tmp/homelab-action-{action_id}.log"
        done_file = f"/tmp/homelab-action-{action_id}.done"
        # We use setsid to detach and redirect output to a file
        # We also write the exit code to a .done file when finished
        background_cmd = (
            f'setsid bash -c "{exec_command} > {log_file} 2>&1; echo $? > {done_file}" &'
        )

        try:
            # We use a shell here to handle the backgrounding operator '&'
            await asyncio.create_subprocess_shell(background_cmd)

            return CommandResult(
                action_id=action_id,
                success=True,
                exit_code=0,
                stdout=f"Started background execution. Output redirected to {log_file}",
                stderr="",
                executed_at=executed_at,
                completed_at=datetime.now(UTC),
                is_background=True,
            )
        except Exception as e:
            logger.exception("Failed to start background command: %s", e)
            return CommandResult(
                action_id=action_id,
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Failed to start background execution: {e}",
                executed_at=executed_at,
                completed_at=datetime.now(UTC),
            )

    logger.info("Executing command (action %d): %s", action_id, exec_command)

    proc = None
    try:
        proc = await asyncio.create_subprocess_shell(
            exec_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Wait with timeout (AC3)
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=timeout,
        )

        completed_at = datetime.now(UTC)
        exit_code = proc.returncode or 0

        # Truncate output to prevent memory issues (AC2)
        stdout_str = stdout.decode(errors="replace")[:MAX_OUTPUT_SIZE]
        stderr_str = stderr.decode(errors="replace")[:MAX_OUTPUT_SIZE]

        logger.info(
            "Command completed (action %d): exit_code=%d",
            action_id,
            exit_code,
        )

        # Record Pi-hole restart if successful
        if exit_code == 0 and server_id:
            record_pihole_restart(command, server_id)

        return CommandResult(
            action_id=action_id,
            success=exit_code == 0,
            exit_code=exit_code,
            stdout=stdout_str,
            stderr=stderr_str,
            executed_at=executed_at,
            completed_at=completed_at,
        )

    except TimeoutError:
        logger.warning(
            "Command timed out after %d seconds (action %d)",
            timeout,
            action_id,
        )
        # Kill the process
        if proc:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass

        return CommandResult(
            action_id=action_id,
            success=False,
            exit_code=-1,
            stdout="",
            stderr=f"Command timed out after {timeout} seconds",
            executed_at=executed_at,
            completed_at=datetime.now(UTC),
        )

    except Exception as e:
        logger.exception("Command execution failed (action %d): %s", action_id, e)
        return CommandResult(
            action_id=action_id,
            success=False,
            exit_code=-1,
            stdout="",
            stderr=str(e),
            executed_at=executed_at,
            completed_at=datetime.now(UTC),
        )
