"""Main entry point for the HomelabCmd monitoring agent.

This module provides the CLI interface and main loop for the agent.
Includes command execution support (US0027).

Usage:
    python -m agent [-c CONFIG] [-v]
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Support both running as module (python -m agent) and standalone script
if __name__ == "__main__" and __package__ is None:
    # Running as standalone script - add parent dir to path for imports
    sys.path.insert(0, str(Path(__file__).parent))
    from collectors import (
        get_all_services_status,
        get_cpu_info,
        get_filesystem_metrics,
        get_mac_address,
        get_metrics,
        get_network_interfaces,
        get_os_info,
        get_package_update_list,
        get_package_updates,
    )
    from config import AgentConfig, load_config
    from executor import MAX_OUTPUT_SIZE, execute_command
    from heartbeat import HeartbeatResult, PendingCommand, send_heartbeat
else:
    # Running as module
    from .collectors import (
        get_all_services_status,
        get_cpu_info,
        get_filesystem_metrics,
        get_mac_address,
        get_metrics,
        get_network_interfaces,
        get_os_info,
        get_package_update_list,
        get_package_updates,
    )
    from .config import AgentConfig, load_config
    from .executor import MAX_OUTPUT_SIZE, execute_command
    from .heartbeat import HeartbeatResult, PendingCommand, send_heartbeat

logger = logging.getLogger(__name__)

# Pending command results to send in next heartbeat
_pending_results: list[dict[str, Any]] = []

# Background tasks tracking (action_id -> start_time)
_background_tasks: dict[int, datetime] = {}


async def check_background_tasks() -> list[dict[str, Any]]:
    """Check for completion of background tasks and return results.

    Returns:
        List of command result dicts for completed background tasks.
    """
    completed_results = []
    finished_ids = []

    for action_id, start_time in _background_tasks.items():
        log_file = Path(f"/tmp/homelab-action-{action_id}.log")
        done_file = Path(f"/tmp/homelab-action-{action_id}.done")

        if done_file.exists():
            try:
                # Read exit code
                exit_code_str = done_file.read_text().strip()
                exit_code = int(exit_code_str) if exit_code_str.isdigit() else -1

                stdout = ""
                if log_file.exists():
                    stdout = log_file.read_text(errors="replace")
                    if len(stdout) > MAX_OUTPUT_SIZE:
                        stdout = stdout[-MAX_OUTPUT_SIZE:]

                now = datetime.now(UTC).isoformat()
                completed_results.append(
                    {
                        "action_id": action_id,
                        "exit_code": exit_code,
                        "stdout": stdout,
                        "stderr": "",
                        "executed_at": start_time.isoformat(),
                        "completed_at": now,
                    }
                )
                finished_ids.append(action_id)

                # Cleanup
                try:
                    done_file.unlink()
                    # We leave the log file for now or delete it too?
                    # AC says capture output, so once reported we can delete
                    log_file.unlink()
                except Exception:
                    pass

            except Exception as e:
                logger.error("Error processing completed background task %d: %s", action_id, e)

    # Remove finished tasks from tracking
    for action_id in finished_ids:
        del _background_tasks[action_id]

    return completed_results


async def process_command(
    cmd: PendingCommand,
    config: AgentConfig,
) -> dict[str, Any]:
    """Process a pending command and return the result (US0027).

    Args:
        cmd: The pending command to execute
        config: Agent configuration

    Returns:
        Command result dict for inclusion in heartbeat
    """
    logger.info(
        "Processing command (action %d): %s",
        cmd.action_id,
        cmd.action_type,
    )

    result = await execute_command(
        action_id=cmd.action_id,
        command=cmd.command,
        timeout=cmd.timeout_seconds,
        use_sudo=config.use_sudo,
        server_id=config.server_id,
    )

    # If it's a background task, track it
    if result.is_background:
        _background_tasks[result.action_id] = result.executed_at

    return {
        "action_id": result.action_id,
        "exit_code": result.exit_code,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "executed_at": result.executed_at.isoformat(),
        "completed_at": result.completed_at.isoformat(),
    }


def process_pending_commands(
    commands: list[PendingCommand],
    config: AgentConfig,
) -> list[dict[str, Any]]:
    """Process all pending commands synchronously (US0027).

    Args:
        commands: List of pending commands from heartbeat response
        config: Agent configuration

    Returns:
        List of command result dicts
    """
    if not commands:
        return []

    if not config.command_execution_enabled:
        logger.warning(
            "Received %d command(s) but command execution is disabled",
            len(commands),
        )
        return []

    results = []
    for cmd in commands:
        try:
            result = asyncio.run(process_command(cmd, config))
            results.append(result)
        except Exception as e:
            logger.exception(
                "Failed to execute command (action %d): %s",
                cmd.action_id,
                e,
            )
            # Report failure
            from datetime import UTC, datetime

            now = datetime.now(UTC).isoformat()
            results.append(
                {
                    "action_id": cmd.action_id,
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": f"Execution failed: {e}",
                    "executed_at": now,
                    "completed_at": now,
                }
            )

    return results


def main() -> int:
    """Main entry point for the agent.

    Returns:
        Exit code (0 for success, non-zero for error).
    """
    global _pending_results

    parser = argparse.ArgumentParser(
        description="HomelabCmd monitoring agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m agent                    Run with default config
  python -m agent -c /path/config    Run with custom config
  python -m agent -v                 Enable verbose logging
        """,
    )
    parser.add_argument(
        "-c",
        "--config",
        default="/etc/homelab-agent/config.yaml",
        help="Path to configuration file (default: /etc/homelab-agent/config.yaml)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    # Configure logging for systemd journald
    # Simple format works best with journald
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    # Load configuration
    try:
        config = load_config(Path(args.config))
        logger.info("Configuration loaded from %s", args.config)
    except FileNotFoundError as e:
        logger.error("Configuration error: %s", e)
        return 1
    except ValueError as e:
        logger.error("Invalid configuration: %s", e)
        return 1

    logger.info(
        "Starting homelab-agent for server '%s' (hub: %s)",
        config.server_id,
        config.hub_url,
    )

    # Log command execution status (US0027)
    if config.command_execution_enabled:
        logger.info(
            "Command execution enabled (sudo=%s, timeout=%ds)",
            config.use_sudo,
            config.command_timeout,
        )
    else:
        logger.info("Command execution disabled")

    # Collect OS info once at startup (doesn't change)
    os_info = get_os_info()
    logger.info(
        "OS: %s %s (kernel %s, %s)",
        os_info.get("distribution") or "Unknown",
        os_info.get("version") or "",
        os_info.get("kernel") or "Unknown",
        os_info.get("architecture") or "Unknown",
    )

    # Collect CPU info once at startup (doesn't change)
    cpu_info = get_cpu_info()
    logger.info(
        "CPU: %s (%d cores)",
        cpu_info.get("cpu_model") or "Unknown",
        cpu_info.get("cpu_cores") or 0,
    )

    # Main loop
    while True:
        try:
            # Collect metrics
            logger.debug("Collecting metrics...")
            metrics = get_metrics()
            mac_address = get_mac_address()
            packages = get_package_update_list()
            filesystems = get_filesystem_metrics()
            network_interfaces = get_network_interfaces()

            # Derive counts from detailed package list to ensure consistency
            # (apt-get -s upgrade can miss packages that need dist-upgrade)
            package_updates: dict[str, int | None] | None = None
            if packages:
                package_updates = {
                    "updates_available": len(packages),
                    "security_updates": sum(1 for p in packages if p.get("is_security")),
                }
            else:
                package_updates = get_package_updates()

            # Collect service status if configured (US0018)
            services = None
            if config.monitored_services:
                logger.debug("Collecting status for %d services...", len(config.monitored_services))
                services = get_all_services_status(config.monitored_services)

            # Check for completed background tasks
            completed_background_results = asyncio.run(check_background_tasks())
            if completed_background_results:
                _pending_results.extend(completed_background_results)

            # Send heartbeat with any pending results (US0027)
            result: HeartbeatResult = send_heartbeat(
                config,
                metrics,
                os_info,
                mac_address,
                package_updates,
                services,
                command_results=_pending_results if _pending_results else None,
                cpu_info=cpu_info,
                packages=packages if packages else None,
                filesystems=filesystems if filesystems else None,
                network_interfaces=network_interfaces if network_interfaces else None,
            )

            # Clear results that were acknowledged
            if result.results_acknowledged:
                _pending_results = [
                    r for r in _pending_results if r["action_id"] not in result.results_acknowledged
                ]

            # Process any pending commands from heartbeat response (US0027)
            if result.pending_commands:
                new_results = process_pending_commands(result.pending_commands, config)
                _pending_results.extend(new_results)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            return 0
        except Exception as e:
            logger.exception("Unexpected error in main loop: %s", e)

        # Wait for next interval
        logger.debug("Sleeping for %d seconds...", config.heartbeat_interval)
        try:
            time.sleep(config.heartbeat_interval)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
