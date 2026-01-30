"""Heartbeat sender for the HomelabCmd monitoring agent.

This module handles sending heartbeats to the hub API with retry logic
for handling transient network failures.

US0152: Command execution has been removed from the agent. The hub now
uses SSH for synchronous command execution instead of the async channel.
"""

from __future__ import annotations

import logging
import socket
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

# Support both running as module and standalone script
try:
    from .config import AgentConfig
except ImportError:
    from config import AgentConfig

logger = logging.getLogger(__name__)


def get_agent_version() -> str:
    """Get the agent version from the VERSION file.

    Looks for VERSION file in the same directory as this module,
    or in /opt/homelab-agent/ for installed agents.

    Returns:
        Version string (e.g., "2.0.0") or "unknown" if not found.
    """
    # Try module directory first (development)
    module_dir = Path(__file__).parent
    version_file = module_dir / "VERSION"

    if version_file.exists():
        return version_file.read_text().strip()

    # Try installed location
    installed_version = Path("/opt/homelab-agent/VERSION")
    if installed_version.exists():
        return installed_version.read_text().strip()

    return "unknown"


# Constants
RETRY_COUNT = 3
RETRY_DELAY_SECONDS = 5
REQUEST_TIMEOUT = 30.0


@dataclass
class HeartbeatResult:
    """Result of heartbeat request."""

    success: bool
    server_registered: bool


def send_heartbeat(
    config: AgentConfig,
    metrics: dict[str, Any],
    os_info: dict[str, str | None],
    mac_address: str | None,  # noqa: ARG001 - collected for future use
    package_updates: dict[str, int | None] | None,
    services: list[dict[str, Any]] | None = None,
    cpu_info: dict[str, Any] | None = None,
    packages: list[dict[str, Any]] | None = None,
    filesystems: list[dict[str, Any]] | None = None,
    network_interfaces: list[dict[str, Any]] | None = None,
) -> HeartbeatResult:
    """Send heartbeat to hub API with retry logic.

    Args:
        config: Agent configuration.
        metrics: Collected system metrics.
        os_info: Operating system information.
        mac_address: Primary interface MAC address (for future schema extension).
        package_updates: Package update counts (updates_available, security_updates).
        services: List of service status dictionaries (name, status, pid, memory_mb, cpu_percent).
        cpu_info: CPU model and core count for power profile detection.
        packages: Detailed package update list (US0051).
        filesystems: Per-filesystem disk metrics (US0178).
        network_interfaces: Per-interface network metrics (US0179).

    Returns:
        HeartbeatResult with success status.

    Note:
        US0152: Command execution has been removed. The hub now uses SSH
        for synchronous command execution instead of the async channel.
    """
    url = f"{config.hub_url}/api/v1/agents/heartbeat"

    payload: dict[str, Any] = {
        "server_guid": config.server_guid,  # Permanent identity (US0070)
        "server_id": config.server_id,
        "hostname": socket.gethostname(),
        "timestamp": datetime.now(UTC).isoformat(),
        "agent_version": get_agent_version(),
        "agent_mode": config.mode,  # Operating mode (BG0017): "readonly" or "readwrite"
        "os_info": os_info,
        "metrics": metrics,
        "updates_available": package_updates.get("updates_available") if package_updates else None,
        "security_updates": package_updates.get("security_updates") if package_updates else None,
    }

    # Include CPU info for power profile detection
    if cpu_info:
        payload["cpu_info"] = cpu_info

    # Include service status if provided (US0018)
    if services:
        payload["services"] = services

    # Include detailed package list if provided (US0051)
    if packages:
        payload["packages"] = packages

    # Include per-filesystem disk metrics (US0178)
    if filesystems:
        payload["filesystems"] = filesystems

    # Include per-interface network metrics (US0179)
    if network_interfaces:
        payload["network_interfaces"] = network_interfaces

    # Build authentication headers (per-agent token preferred, fall back to legacy key)
    headers: dict[str, str] = {
        "Content-Type": "application/json",
    }
    if config.api_token:
        # Per-agent authentication (preferred)
        headers["X-Agent-Token"] = config.api_token
        headers["X-Server-GUID"] = config.server_guid
    elif config.api_key:
        # Legacy shared API key authentication
        headers["X-API-Key"] = config.api_key

    last_error: Exception | None = None

    for attempt in range(1, RETRY_COUNT + 1):
        try:
            with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
                response = client.post(url, json=payload, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    if data.get("server_registered"):
                        logger.info("Server auto-registered with hub")
                    logger.debug("Heartbeat sent successfully")

                    return HeartbeatResult(
                        success=True,
                        server_registered=data.get("server_registered", False),
                    )
                elif response.status_code == 401:
                    auth_method = "api_token" if config.api_token else "api_key"
                    logger.error("Authentication failed - check %s in configuration", auth_method)
                    return HeartbeatResult(
                        success=False,
                        server_registered=False,
                    )
                else:
                    logger.warning(
                        "Heartbeat failed (attempt %d/%d): HTTP %d",
                        attempt,
                        RETRY_COUNT,
                        response.status_code,
                    )
                    last_error = Exception(f"HTTP {response.status_code}")

        except httpx.ConnectError as e:
            logger.warning(
                "Hub connection failed (attempt %d/%d): %s",
                attempt,
                RETRY_COUNT,
                e,
            )
            last_error = e
        except httpx.TimeoutException as e:
            logger.warning(
                "Hub request timed out (attempt %d/%d): %s",
                attempt,
                RETRY_COUNT,
                e,
            )
            last_error = e
        except Exception as e:
            logger.warning(
                "Heartbeat error (attempt %d/%d): %s",
                attempt,
                RETRY_COUNT,
                e,
            )
            last_error = e

        if attempt < RETRY_COUNT:
            logger.debug("Retrying in %d seconds...", RETRY_DELAY_SECONDS)
            time.sleep(RETRY_DELAY_SECONDS)

    logger.error(
        "Failed to send heartbeat after %d attempts: %s",
        RETRY_COUNT,
        last_error,
    )
    return HeartbeatResult(
        success=False,
        server_registered=False,
    )
