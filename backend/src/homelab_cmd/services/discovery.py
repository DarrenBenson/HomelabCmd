"""Discovery service for network device scanning.

This module provides network discovery functionality using TCP port 22 scanning
to find SSH-capable devices on the local subnet.

US0041: Network Discovery
US0070: GUID-Based Server Identity (adds GUID matching for discovery)
"""

import asyncio
import ipaddress
import logging
import re
import socket
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.config import get_settings
from homelab_cmd.db.models.config import Config
from homelab_cmd.db.models.discovery import Discovery, DiscoveryStatus
from homelab_cmd.db.models.server import Server
from homelab_cmd.services.ssh import get_ssh_service

# UUID v4 validation pattern for GUID matching
UUID_V4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# Config key for SSH settings stored in database
SSH_CONFIG_KEY = "ssh"

logger = logging.getLogger(__name__)

# Configuration
MAX_CONCURRENT_CONNECTIONS = 50
DEFAULT_TIMEOUT_SECONDS = 0.5
MAX_SUBNET_HOSTS = 65534  # /16 subnet


@dataclass
class DiscoveredDevice:
    """A discovered device on the network.

    US0073: Network Discovery Key Selection - added ssh_key_used field.
    """

    ip: str
    hostname: str | None
    response_time_ms: int
    is_monitored: bool = False
    ssh_auth_status: str = "untested"  # untested, success, failed
    ssh_auth_error: str | None = None
    ssh_key_used: str | None = None  # Name of key that succeeded


class DiscoveryService:
    """Service for discovering devices on the network.

    Uses TCP port 22 scanning to find SSH-capable devices.
    """

    def __init__(self, timeout: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        """Initialise the discovery service.

        Args:
            timeout: Connection timeout in seconds.
        """
        self.timeout = timeout
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_CONNECTIONS)

    @staticmethod
    def parse_subnet(subnet: str) -> ipaddress.IPv4Network:
        """Parse and validate a subnet in CIDR notation.

        Args:
            subnet: Subnet in CIDR notation (e.g., "192.168.1.0/24").

        Returns:
            IPv4Network object.

        Raises:
            ValueError: If subnet is invalid or too large.
        """
        try:
            network = ipaddress.ip_network(subnet, strict=False)
        except ValueError as e:
            raise ValueError(f"Invalid subnet: {subnet}") from e

        if not isinstance(network, ipaddress.IPv4Network):
            raise ValueError("Only IPv4 subnets are supported")

        host_count = network.num_addresses - 2  # Exclude network and broadcast
        if host_count > MAX_SUBNET_HOSTS:
            raise ValueError(
                f"Subnet too large. Maximum allowed is /16 ({MAX_SUBNET_HOSTS} hosts). "
                f"Subnet {subnet} has {host_count} hosts."
            )

        return network

    @staticmethod
    def get_host_ips(network: ipaddress.IPv4Network) -> list[str]:
        """Get list of host IPs from a network (excluding network and broadcast).

        Args:
            network: IPv4Network object.

        Returns:
            List of IP addresses as strings.
        """
        return [str(ip) for ip in network.hosts()]

    async def discover_host(self, ip: str) -> DiscoveredDevice | None:
        """Check if a host responds on TCP port 22.

        Args:
            ip: IP address to check.

        Returns:
            DiscoveredDevice if host responds, None otherwise.
        """
        async with self._semaphore:
            start_time = time.monotonic()
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, 22),
                    timeout=self.timeout,
                )
                response_time_ms = int((time.monotonic() - start_time) * 1000)
                writer.close()
                await writer.wait_closed()

                # Try reverse DNS lookup
                hostname = await self._get_hostname(ip)

                return DiscoveredDevice(
                    ip=ip,
                    hostname=hostname,
                    response_time_ms=response_time_ms,
                )
            except (TimeoutError, ConnectionRefusedError, OSError):
                return None

    @staticmethod
    async def _get_hostname(ip: str) -> str | None:
        """Perform reverse DNS lookup for an IP address.

        Args:
            ip: IP address to look up.

        Returns:
            Hostname if resolvable, None otherwise.
        """
        try:
            # Run blocking DNS lookup in thread pool
            result = await asyncio.get_event_loop().run_in_executor(None, socket.gethostbyaddr, ip)
            return result[0]
        except (socket.herror, socket.gaierror):
            return None

    async def get_agent_guid(
        self,
        ip: str,
        username: str | None = None,
        port: int | None = None,
    ) -> str | None:
        """Query agent's GUID via SSH by reading the config file.

        US0070 - AC7: Discovery matches by GUID.

        Args:
            ip: IP address of the device.
            username: SSH username (uses settings default if not provided).
            port: SSH port (uses settings default if not provided).

        Returns:
            The agent's GUID if found and valid, None otherwise.
        """
        try:
            ssh_service = get_ssh_service()
            # Read server_guid from agent config file
            result = await ssh_service.execute_command(
                hostname=ip,
                port=port,
                username=username,
                command="grep server_guid /etc/homelab-agent/config.yaml 2>/dev/null | cut -d: -f2 | tr -d ' \"'",
                command_timeout=10,
            )

            if result.success and result.stdout:
                guid = result.stdout.strip().lower()
                # Validate UUID v4 format
                if UUID_V4_PATTERN.match(guid):
                    logger.debug("Found agent GUID %s on %s", guid, ip)
                    return guid

            logger.debug("No valid GUID found on %s", ip)
            return None

        except Exception as e:
            logger.debug("Could not query agent GUID from %s: %s", ip, e)
            return None

    async def check_is_monitored(
        self,
        session: AsyncSession,
        ip: str,
        hostname: str | None = None,
        ssh_success: bool = False,
        ssh_username: str | None = None,
        ssh_port: int | None = None,
    ) -> bool:
        """Check if an IP address belongs to a registered server.

        Matching priority (US0070):
        1. If SSH available, try GUID match (most reliable)
        2. Fall back to IP/hostname matching

        Checks multiple fields since servers can be registered different ways:
        - GUID matches (if SSH available to query agent config)
        - ip_address field matches the IP
        - Server ID matches IP pattern (e.g., "10-0-0-115" for "10.0.0.115")
        - hostname field contains the IP (some servers store IP in hostname)
        - hostname matches discovered hostname (case-insensitive, without domain)

        Args:
            session: Database session.
            ip: IP address to check.
            hostname: Optional discovered hostname to also check.
            ssh_success: Whether SSH authentication succeeded (enables GUID query).
            ssh_username: SSH username for GUID query.
            ssh_port: SSH port for GUID query.

        Returns:
            True if IP is a registered server, False otherwise.
        """
        from sqlalchemy import func, or_

        # 1. If SSH available, try GUID match first (most reliable, US0070)
        if ssh_success:
            agent_guid = await self.get_agent_guid(ip, ssh_username, ssh_port)
            if agent_guid:
                result = await session.execute(select(Server).where(Server.guid == agent_guid))
                if result.scalar_one_or_none() is not None:
                    logger.debug("Matched server by GUID %s for %s", agent_guid, ip)
                    return True

        # 2. Fall back to IP/hostname matching
        # Convert IP to ID format: "10.0.0.115" -> "10-0-0-115"
        ip_as_id = ip.replace(".", "-")

        conditions = [
            Server.ip_address == ip,
            Server.id == ip_as_id,
            Server.hostname == ip,  # Some servers store IP in hostname field
        ]

        # Also check hostname match (without domain, case-insensitive)
        if hostname:
            # Extract base hostname: "StudyPC.local.lan" -> "studypc"
            base_hostname = hostname.split(".")[0].lower()
            conditions.append(func.lower(Server.hostname) == base_hostname)
            conditions.append(func.lower(Server.id) == base_hostname)

        result = await session.execute(select(Server).where(or_(*conditions)))
        return result.scalar_one_or_none() is not None

    async def test_ssh_auth(
        self,
        ip: str,
        username: str | None = None,
        port: int | None = None,
        key_id: str | None = None,
        key_usernames: dict[str, str] | None = None,
    ) -> tuple[str, str | None, str | None]:
        """Test SSH authentication for a discovered device.

        US0073: Network Discovery Key Selection - added key_id parameter.

        Args:
            ip: IP address to test.
            username: SSH username (uses settings default if not provided).
            port: SSH port (uses settings default if not provided).
            key_id: Specific SSH key to use. If None, all keys are tried.
            key_usernames: Dict mapping key names to their associated usernames.

        Returns:
            Tuple of (status, error_message, key_used).
            Status is 'success' or 'failed'.
            key_used is the name of the key that succeeded (if any).
        """
        try:
            ssh_service = get_ssh_service()

            # If key_id specified, only try that key
            if key_id:
                result = await ssh_service.test_connection_with_key(
                    ip, port=port, username=username, key_id=key_id, key_usernames=key_usernames
                )
                if result.success:
                    return ("success", None, key_id)
                else:
                    return ("failed", result.error, None)
            else:
                # Try all keys and track which one succeeded
                result = await ssh_service.test_connection(
                    ip, port=port, username=username, key_usernames=key_usernames
                )
                if result.success:
                    # Get the key that succeeded from the result
                    key_used = getattr(result, "key_used", None)
                    return ("success", None, key_used)
                else:
                    return ("failed", result.error, None)
        except Exception as e:
            logger.warning("SSH auth test failed for %s: %s", ip, e)
            return ("failed", str(e), None)

    async def discover_subnet(
        self,
        discovery: Discovery,
        session: AsyncSession,
        key_id: str | None = None,
    ) -> list[DiscoveredDevice]:
        """Discover all responding hosts in a subnet.

        US0073: Network Discovery Key Selection - added key_id parameter.

        Updates the discovery record with progress as scanning proceeds.

        Args:
            discovery: Discovery record to update.
            session: Database session.
            key_id: Specific SSH key to use. If None, all keys are tried.

        Returns:
            List of discovered devices.
        """
        # Get SSH config from database (for username/port)
        settings = get_settings()
        ssh_username = settings.ssh_default_username
        ssh_port = settings.ssh_default_port

        result = await session.execute(select(Config).where(Config.key == SSH_CONFIG_KEY))
        ssh_config = result.scalar_one_or_none()
        key_usernames: dict[str, str] = {}
        if ssh_config and ssh_config.value:
            ssh_username = ssh_config.value.get("default_username", ssh_username)
            ssh_port = ssh_config.value.get("default_port", ssh_port)
            key_usernames = ssh_config.value.get("key_usernames", {})

        logger.info(
            "Discovery using SSH config: username=%s, port=%d, key_id=%s",
            ssh_username,
            ssh_port,
            key_id or "all keys",
        )

        # Parse subnet and get host IPs
        network = self.parse_subnet(discovery.subnet)
        host_ips = self.get_host_ips(network)

        # Update discovery with total count
        discovery.progress_total = len(host_ips)
        discovery.status = DiscoveryStatus.RUNNING.value
        discovery.started_at = datetime.now(UTC)
        await session.commit()

        # Discover hosts concurrently
        discovered: list[DiscoveredDevice] = []
        scanned = 0
        batch_size = 10

        # Process in batches for progress updates
        for i in range(0, len(host_ips), batch_size):
            batch = host_ips[i : i + batch_size]
            tasks = [self.discover_host(ip) for ip in batch]
            results = await asyncio.gather(*tasks)

            for device in results:
                if device is not None:
                    # Test SSH auth first (needed for GUID lookup)
                    auth_status, auth_error, key_used = await self.test_ssh_auth(
                        device.ip,
                        username=ssh_username,
                        port=ssh_port,
                        key_id=key_id,
                        key_usernames=key_usernames,
                    )
                    device.ssh_auth_status = auth_status
                    device.ssh_auth_error = auth_error
                    device.ssh_key_used = key_used

                    # Check if monitored (pass hostname and SSH status for GUID matching)
                    device.is_monitored = await self.check_is_monitored(
                        session,
                        device.ip,
                        device.hostname,
                        ssh_success=(auth_status == "success"),
                        ssh_username=ssh_username,
                        ssh_port=ssh_port,
                    )
                    discovered.append(device)

            scanned += len(batch)
            discovery.progress_scanned = scanned
            discovery.devices_found = len(discovered)
            await session.commit()

        return discovered

    async def execute_discovery(
        self,
        discovery: Discovery,
        session: AsyncSession,
        key_id: str | None = None,
    ) -> None:
        """Execute a full discovery scan.

        US0073: Network Discovery Key Selection - added key_id parameter.

        Updates the discovery record with results when complete.

        Args:
            discovery: Discovery record to execute.
            session: Database session.
            key_id: Specific SSH key to use. If None, all keys are tried.
        """
        try:
            devices = await self.discover_subnet(discovery, session, key_id=key_id)

            # Store results
            discovery.devices = [
                {
                    "ip": d.ip,
                    "hostname": d.hostname,
                    "response_time_ms": d.response_time_ms,
                    "is_monitored": d.is_monitored,
                    "ssh_auth_status": d.ssh_auth_status,
                    "ssh_auth_error": d.ssh_auth_error,
                    "ssh_key_used": d.ssh_key_used,
                }
                for d in devices
            ]
            discovery.status = DiscoveryStatus.COMPLETED.value
            discovery.completed_at = datetime.now(UTC)
            await session.commit()

            logger.info(
                "Discovery %d completed: found %d devices on %s",
                discovery.id,
                len(devices),
                discovery.subnet,
            )

        except Exception as e:
            logger.exception("Discovery %d failed: %s", discovery.id, e)
            discovery.status = DiscoveryStatus.FAILED.value
            discovery.error = str(e)
            discovery.completed_at = datetime.now(UTC)
            await session.commit()


# Module-level instance
_discovery_service: DiscoveryService | None = None


def get_discovery_service() -> DiscoveryService:
    """Get the discovery service instance.

    Returns:
        Singleton DiscoveryService instance.
    """
    global _discovery_service
    if _discovery_service is None:
        _discovery_service = DiscoveryService()
    return _discovery_service
