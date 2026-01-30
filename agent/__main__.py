"""Main entry point for the HomelabCmd monitoring agent.

This module provides the CLI interface and main loop for the agent.
The agent collects metrics and sends them to the hub via heartbeat.

US0152: Command execution has been removed - the hub now uses SSH
for synchronous command execution instead of the async channel.

Usage:
    python -m agent [-c CONFIG] [-v]
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

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
    from config import load_config
    from heartbeat import HeartbeatResult, send_heartbeat
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
    from .config import load_config
    from .heartbeat import HeartbeatResult, send_heartbeat

logger = logging.getLogger(__name__)


def main() -> int:
    """Main entry point for the agent.

    Returns:
        Exit code (0 for success, non-zero for error).
    """
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

    # US0152: Command execution removed - hub uses SSH now
    logger.info("Agent mode: metrics collection only (v2.0)")

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

    # Main loop - metrics collection only
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

            # Send heartbeat (metrics only - no command results)
            result: HeartbeatResult = send_heartbeat(
                config,
                metrics,
                os_info,
                mac_address,
                package_updates,
                services,
                cpu_info=cpu_info,
                packages=packages if packages else None,
                filesystems=filesystems if filesystems else None,
                network_interfaces=network_interfaces if network_interfaces else None,
            )

            if not result.success:
                logger.warning("Heartbeat failed")

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
