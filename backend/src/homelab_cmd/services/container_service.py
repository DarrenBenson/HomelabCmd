"""Container service for listing Docker containers via SSH (US0158 - EP0014)."""

import json
import logging
import re
from datetime import UTC, datetime
from typing import NamedTuple

from homelab_cmd.db.models.server import Server
from homelab_cmd.services.ssh_executor import SSHPooledExecutor

logger = logging.getLogger(__name__)

# Cache configuration
CACHE_TTL_SECONDS = 60


class CachedContainers(NamedTuple):
    """Cached container list with timestamp."""

    containers: list[dict]
    fetched_at: datetime


# Module-level cache: server_id -> CachedContainers
_container_cache: dict[str, CachedContainers] = {}


def clear_container_cache(server_id: str | None = None) -> None:
    """Clear container cache for a server or all servers.

    Args:
        server_id: If provided, clear only that server's cache. Otherwise clear all.
    """
    if server_id:
        _container_cache.pop(server_id, None)
    else:
        _container_cache.clear()


class ContainerService:
    """Service for listing and managing Docker containers via SSH."""

    def __init__(self, ssh_executor: SSHPooledExecutor) -> None:
        """Initialise container service.

        Args:
            ssh_executor: Pooled SSH executor for running commands.
        """
        self.ssh_executor = ssh_executor

    async def list_containers(
        self,
        server: Server,
        force_refresh: bool = False,
        username: str | None = None,
    ) -> tuple[list[dict], bool, datetime, str | None]:
        """List Docker containers on a server via SSH.

        Args:
            server: Server model with hostname/IP for SSH.
            force_refresh: If True, bypass cache.
            username: SSH username (falls back to server.ssh_username if not provided).

        Returns:
            Tuple of (containers, cached, fetched_at, error).
            - containers: List of container dictionaries.
            - cached: Whether result was from cache.
            - fetched_at: Timestamp when data was fetched.
            - error: Error message if command failed, None otherwise.
        """
        # Check cache first (unless force refresh)
        if not force_refresh and server.id in _container_cache:
            cached = _container_cache[server.id]
            age_seconds = (datetime.now(UTC) - cached.fetched_at).total_seconds()
            if age_seconds < CACHE_TTL_SECONDS:
                logger.debug(
                    "Returning cached containers for %s (age: %.1fs)",
                    server.id,
                    age_seconds,
                )
                return cached.containers, True, cached.fetched_at, None

        # Execute docker ps via SSH
        # Using JSON format for reliable parsing
        # Use sudo to ensure access to Docker socket
        result = await self.ssh_executor.execute(
            server=server,
            command="sudo docker ps -a --no-trunc --format '{{json .}}'",
            timeout=30,
            username=username,
        )

        containers: list[dict] = []
        error: str | None = None
        if result.exit_code == 0 and result.stdout:
            containers = self._parse_docker_output(result.stdout)
        elif result.exit_code != 0:
            error = result.stderr or f"docker command failed with exit code {result.exit_code}"
            logger.warning(
                "docker ps failed on %s (exit %d): %s",
                server.id,
                result.exit_code,
                error,
            )

        # Sort: running containers first, then alphabetically by name
        containers.sort(key=lambda c: (c["state"] != "running", c["name"].lower()))

        # Cache result (only if successful)
        fetched_at = datetime.now(UTC)
        if not error:
            _container_cache[server.id] = CachedContainers(containers, fetched_at)

        logger.debug(
            "Fetched %d containers from %s in %dms",
            len(containers),
            server.id,
            result.duration_ms,
        )

        return containers, False, fetched_at, error

    def _parse_docker_output(self, output: str) -> list[dict]:
        """Parse docker ps JSON output into container dictionaries.

        Args:
            output: Raw stdout from docker ps --format json.

        Returns:
            List of container dictionaries.
        """
        containers = []
        for line in output.strip().split("\n"):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                container = {
                    "id": data.get("ID", "")[:12],  # Short ID
                    "name": data.get("Names", "").lstrip("/"),
                    "image": data.get("Image", ""),
                    "state": data.get("State", "unknown").lower(),
                    "status": data.get("Status", ""),
                    "ports": data.get("Ports") or None,
                    "created_at": data.get("CreatedAt"),
                    "uptime_seconds": (
                        self._parse_uptime(data.get("Status", ""))
                        if data.get("State", "").lower() == "running"
                        else None
                    ),
                }
                containers.append(container)
            except json.JSONDecodeError as e:
                logger.warning("Failed to parse container JSON: %s - %s", line[:100], e)
        return containers

    def _parse_uptime(self, status: str) -> int | None:
        """Parse Docker status string to extract uptime in seconds.

        Docker status strings look like:
        - "Up 12 days"
        - "Up 3 hours"
        - "Up 45 minutes"
        - "Up 2 weeks"
        - "Up About an hour"
        - "Up Less than a second"

        Args:
            status: Docker status string.

        Returns:
            Uptime in seconds, or None if not parseable.
        """
        if not status.lower().startswith("up "):
            return None

        uptime_part = status[3:].strip()

        # Handle special cases
        if "less than a second" in uptime_part.lower():
            return 0
        if "about an hour" in uptime_part.lower():
            return 3600
        if "about a minute" in uptime_part.lower():
            return 60

        # Parse "N unit" format
        match = re.match(r"(\d+)\s*(\w+)", uptime_part)
        if not match:
            return None

        try:
            value = int(match.group(1))
            unit = match.group(2).lower()

            if unit.startswith("second"):
                return value
            elif unit.startswith("minute"):
                return value * 60
            elif unit.startswith("hour"):
                return value * 3600
            elif unit.startswith("day"):
                return value * 86400
            elif unit.startswith("week"):
                return value * 604800
            elif unit.startswith("month"):
                return value * 2592000  # Approximate: 30 days
            elif unit.startswith("year"):
                return value * 31536000  # Approximate: 365 days
        except ValueError:
            pass

        return None

    async def start_container(
        self,
        server: Server,
        container_id: str,
        username: str | None = None,
    ) -> tuple[bool, str | None, int | None, int | None]:
        """Start a stopped Docker container via SSH (US0160).

        Args:
            server: Server model with hostname/IP for SSH.
            container_id: Container ID or name to start.
            username: SSH username (falls back to server.ssh_username if not provided).

        Returns:
            Tuple of (success, output, exit_code, duration_ms).
            - success: True if exit code is 0.
            - output: Docker command output (stdout or stderr).
            - exit_code: Command exit code.
            - duration_ms: Command duration in milliseconds.
        """
        # Sanitise container_id - only allow alphanumeric, dash, underscore
        import re as regex

        if not regex.match(r"^[a-zA-Z0-9_-]+$", container_id):
            logger.warning("Invalid container_id: %s", container_id)
            return False, "Invalid container ID format", None, None

        result = await self.ssh_executor.execute(
            server=server,
            command=f"sudo docker start {container_id}",
            timeout=30,
            username=username,
        )

        success = result.exit_code == 0
        output = result.stdout if success else (result.stderr or result.stdout)

        logger.info(
            "Container start %s on %s: exit=%d, duration=%dms",
            container_id,
            server.id,
            result.exit_code,
            result.duration_ms,
        )

        # Clear cache so next list_containers call fetches fresh data
        clear_container_cache(server.id)

        return success, output, result.exit_code, result.duration_ms

    async def stop_container(
        self,
        server: Server,
        container_id: str,
        timeout_seconds: int = 10,
        username: str | None = None,
    ) -> tuple[bool, str | None, int | None, int | None]:
        """Stop a running Docker container via SSH (US0161).

        Args:
            server: Server model with hostname/IP for SSH.
            container_id: Container ID or name to stop.
            timeout_seconds: Graceful shutdown timeout (default 10s per AC3).
            username: SSH username (falls back to server.ssh_username if not provided).

        Returns:
            Tuple of (success, output, exit_code, duration_ms).
            - success: True if exit code is 0.
            - output: Docker command output (stdout or stderr).
            - exit_code: Command exit code.
            - duration_ms: Command duration in milliseconds.
        """
        # Sanitise container_id - only allow alphanumeric, dash, underscore
        if not re.match(r"^[a-zA-Z0-9_-]+$", container_id):
            logger.warning("Invalid container_id: %s", container_id)
            return False, "Invalid container ID format", None, None

        # Clamp timeout to reasonable bounds (1-300 seconds)
        timeout_seconds = max(1, min(300, timeout_seconds))

        result = await self.ssh_executor.execute(
            server=server,
            command=f"sudo docker stop -t {timeout_seconds} {container_id}",
            timeout=timeout_seconds + 30,  # Extra time for SSH overhead
            username=username,
        )

        success = result.exit_code == 0
        output = result.stdout if success else (result.stderr or result.stdout)

        logger.info(
            "Container stop %s on %s: exit=%d, duration=%dms",
            container_id,
            server.id,
            result.exit_code,
            result.duration_ms,
        )

        # Clear cache so next list_containers call fetches fresh data
        clear_container_cache(server.id)

        return success, output, result.exit_code, result.duration_ms

    async def restart_container(
        self,
        server: Server,
        container_id: str,
        username: str | None = None,
    ) -> tuple[bool, str | None, int | None, int | None]:
        """Restart a Docker container via SSH (US0162).

        Args:
            server: Server model with hostname/IP for SSH.
            container_id: Container ID or name to restart.
            username: SSH username (falls back to server.ssh_username if not provided).

        Returns:
            Tuple of (success, output, exit_code, duration_ms).
            - success: True if exit code is 0.
            - output: Docker command output (stdout or stderr).
            - exit_code: Command exit code.
            - duration_ms: Command duration in milliseconds.
        """
        # Sanitise container_id - only allow alphanumeric, dash, underscore
        if not re.match(r"^[a-zA-Z0-9_-]+$", container_id):
            logger.warning("Invalid container_id: %s", container_id)
            return False, "Invalid container ID format", None, None

        result = await self.ssh_executor.execute(
            server=server,
            command=f"sudo docker restart {container_id}",
            timeout=40,  # Allow time for stop + start
            username=username,
        )

        success = result.exit_code == 0
        output = result.stdout if success else (result.stderr or result.stdout)

        logger.info(
            "Container restart %s on %s: exit=%d, duration=%dms",
            container_id,
            server.id,
            result.exit_code,
            result.duration_ms,
        )

        # Clear cache so next list_containers call fetches fresh data
        clear_container_cache(server.id)

        return success, output, result.exit_code, result.duration_ms
