"""Tailscale API client service for device discovery.

Part of EP0008: Tailscale Integration (US0076, US0077).

Provides async HTTP client for Tailscale API with proper error handling,
timeout configuration, rate limit respect, and device discovery with caching.
"""

import logging
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta

import httpx

from homelab_cmd.services.credential_service import CredentialService

logger = logging.getLogger(__name__)


# =============================================================================
# Custom Exceptions
# =============================================================================


class TailscaleError(Exception):
    """Base exception for Tailscale API errors."""

    pass


class TailscaleAuthError(TailscaleError):
    """Authentication or permission error (401, 403)."""

    pass


class TailscaleRateLimitError(TailscaleError):
    """Rate limit exceeded (429)."""

    def __init__(self, message: str, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class TailscaleConnectionError(TailscaleError):
    """Connection or network error."""

    pass


class TailscaleNotConfiguredError(TailscaleError):
    """No Tailscale token is configured."""

    pass


# =============================================================================
# Response Dataclasses
# =============================================================================


@dataclass
class TailscaleConnectionResult:
    """Result of a Tailscale API connection test."""

    success: bool
    tailnet: str | None = None
    device_count: int = 0
    message: str = ""


@dataclass
class TailscaleDevice:
    """Transformed Tailscale device for our API.

    Part of US0077: Tailscale Device Discovery.
    """

    id: str
    name: str
    hostname: str
    tailscale_ip: str
    os: str
    os_version: str | None
    last_seen: datetime
    online: bool
    authorized: bool
    already_imported: bool = False

    @classmethod
    def from_tailscale_api(
        cls, data: dict, imported_hostnames: set[str]
    ) -> "TailscaleDevice":
        """Transform Tailscale API response to our device format.

        Args:
            data: Raw device dictionary from Tailscale API.
            imported_hostnames: Set of hostnames already registered as servers.

        Returns:
            TailscaleDevice instance.
        """
        addresses = data.get("addresses", [])
        tailscale_ip = addresses[0] if addresses else ""
        hostname = data.get("hostname", "")

        # Parse lastSeen timestamp - handle both Z suffix and +00:00
        last_seen_str = data.get("lastSeen", "")
        if last_seen_str:
            last_seen_str = last_seen_str.replace("Z", "+00:00")
            last_seen = datetime.fromisoformat(last_seen_str)
        else:
            last_seen = datetime.now(UTC)

        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            hostname=hostname,
            tailscale_ip=tailscale_ip,
            os=data.get("os", ""),
            os_version=data.get("clientVersion"),
            last_seen=last_seen,
            online=data.get("online", False),
            authorized=data.get("authorized", False),
            already_imported=hostname in imported_hostnames,
        )

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialisation."""
        return asdict(self)


@dataclass
class TailscaleDeviceListResult:
    """Result of a cached device list request.

    Part of US0077: Tailscale Device Discovery.
    """

    devices: list[TailscaleDevice]
    count: int
    cache_hit: bool
    cached_at: datetime | None


# =============================================================================
# TailscaleCache
# =============================================================================


class TailscaleCache:
    """In-memory cache for Tailscale device list with 5-minute TTL.

    Part of US0077: Tailscale Device Discovery.
    """

    TTL = timedelta(minutes=5)

    def __init__(self) -> None:
        """Initialise empty cache."""
        self._devices: list[dict] | None = None
        self._cached_at: datetime | None = None

    def get(self) -> tuple[list[dict] | None, datetime | None]:
        """Return cached devices if not expired.

        Returns:
            Tuple of (devices, cached_at) or (None, None) if cache miss.
        """
        if self._devices is not None and self._cached_at is not None:
            if datetime.now(UTC) - self._cached_at < self.TTL:
                return self._devices, self._cached_at
        return None, None

    def set(self, devices: list[dict]) -> datetime:
        """Cache devices and return the cache timestamp.

        Args:
            devices: List of device dictionaries to cache.

        Returns:
            The timestamp when the cache was set.
        """
        self._devices = devices
        self._cached_at = datetime.now(UTC)
        return self._cached_at

    def invalidate(self) -> None:
        """Clear the cache."""
        self._devices = None
        self._cached_at = None


# =============================================================================
# TailscaleService
# =============================================================================


class TailscaleService:
    """Async client for Tailscale API.

    Provides methods to interact with the Tailscale control plane API
    for device discovery and tailnet information.

    Args:
        credential_service: Service for retrieving encrypted API token.

    Attributes:
        BASE_URL: Tailscale API v2 base URL.
    """

    BASE_URL = "https://api.tailscale.com/api/v2"

    def __init__(self, credential_service: CredentialService) -> None:
        """Initialise TailscaleService with credential service.

        Args:
            credential_service: Service for retrieving encrypted API token.
        """
        self._credential_service = credential_service
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=10.0, read=30.0),
            headers={"Accept": "application/json"},
        )

    async def close(self) -> None:
        """Close the HTTP client and release resources."""
        await self._client.aclose()

    async def _get_token(self) -> str:
        """Retrieve Tailscale API token from credential service.

        Returns:
            The decrypted API token.

        Raises:
            TailscaleNotConfiguredError: If no token is configured.
        """
        token = await self._credential_service.get_credential("tailscale_token")
        if token is None:
            raise TailscaleNotConfiguredError("No Tailscale API token configured")
        return token

    async def test_connection(self) -> TailscaleConnectionResult:
        """Test connection to Tailscale API and return tailnet info.

        Calls GET /api/v2/tailnet/-/devices to validate the token and
        retrieve basic tailnet information.

        Returns:
            TailscaleConnectionResult with tailnet name and device count.

        Raises:
            TailscaleNotConfiguredError: If no token is configured.
            TailscaleAuthError: If token is invalid (401) or lacks permissions (403).
            TailscaleRateLimitError: If rate limited (429).
            TailscaleConnectionError: If connection fails or times out.
        """
        token = await self._get_token()

        try:
            response = await self._client.get(
                f"{self.BASE_URL}/tailnet/-/devices",
                headers={"Authorization": f"Bearer {token}"},
            )

            # Handle HTTP errors
            if response.status_code == 401:
                raise TailscaleAuthError("Invalid API token")

            if response.status_code == 403:
                raise TailscaleAuthError(
                    "Token lacks required permissions. Ensure token has 'devices:read' scope."
                )

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                retry_seconds = int(retry_after) if retry_after else None
                raise TailscaleRateLimitError(
                    f"Rate limit exceeded. Retry after {retry_seconds}s.",
                    retry_after=retry_seconds,
                )

            response.raise_for_status()

            # Parse successful response
            data = response.json()
            devices = data.get("devices", [])
            device_count = len(devices)

            # Extract tailnet name from first device's name (FQDN)
            tailnet = None
            if devices:
                # Name format: "hostname.tailnet-name.ts.net"
                # (hostname field is just short name, name field has FQDN)
                first_name = devices[0].get("name", "")
                if ".ts.net" in first_name:
                    # Extract tailnet name (second-to-last segment)
                    parts = first_name.rsplit(".", 3)
                    if len(parts) >= 3:
                        tailnet = parts[-3]

            logger.info(
                "Tailscale connection test successful: tailnet=%s, devices=%d",
                tailnet,
                device_count,
            )

            return TailscaleConnectionResult(
                success=True,
                tailnet=tailnet,
                device_count=device_count,
                message=f"Connected to tailnet: {tailnet or 'unknown'}",
            )

        except httpx.ConnectTimeout:
            logger.warning("Tailscale API connection timed out")
            raise TailscaleConnectionError("Connection timed out after 10s") from None

        except httpx.ConnectError as e:
            logger.warning("Could not connect to Tailscale API: %s", e)
            raise TailscaleConnectionError(
                "Could not reach Tailscale API. Check network connectivity."
            ) from e

        except httpx.ReadTimeout:
            logger.warning("Tailscale API read timed out")
            raise TailscaleConnectionError(
                "Read timed out waiting for response"
            ) from None

        except httpx.HTTPStatusError as e:
            # Catch any other HTTP errors not handled above
            logger.error("Tailscale API error: %s", e)
            raise TailscaleConnectionError(
                f"Unexpected API error: {e.response.status_code}"
            ) from e

    async def get_devices(self) -> list[dict]:
        """Retrieve all devices from the tailnet.

        Returns:
            List of device dictionaries from the Tailscale API.

        Raises:
            TailscaleNotConfiguredError: If no token is configured.
            TailscaleAuthError: If token is invalid or lacks permissions.
            TailscaleRateLimitError: If rate limited.
            TailscaleConnectionError: If connection fails.
        """
        token = await self._get_token()

        try:
            response = await self._client.get(
                f"{self.BASE_URL}/tailnet/-/devices",
                headers={"Authorization": f"Bearer {token}"},
            )

            # Handle HTTP errors
            if response.status_code == 401:
                raise TailscaleAuthError("Invalid API token")

            if response.status_code == 403:
                raise TailscaleAuthError(
                    "Token lacks required permissions. Ensure token has 'devices:read' scope."
                )

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                retry_seconds = int(retry_after) if retry_after else None
                raise TailscaleRateLimitError(
                    f"Rate limit exceeded. Retry after {retry_seconds}s.",
                    retry_after=retry_seconds,
                )

            response.raise_for_status()

            data = response.json()
            devices = data.get("devices", [])

            logger.info("Retrieved %d devices from Tailscale", len(devices))
            return devices

        except httpx.ConnectTimeout:
            raise TailscaleConnectionError("Connection timed out after 10s") from None

        except httpx.ConnectError as e:
            raise TailscaleConnectionError(
                "Could not reach Tailscale API. Check network connectivity."
            ) from e

        except httpx.ReadTimeout:
            raise TailscaleConnectionError(
                "Read timed out waiting for response"
            ) from None

        except httpx.HTTPStatusError as e:
            raise TailscaleConnectionError(
                f"Unexpected API error: {e.response.status_code}"
            ) from e

    async def get_devices_cached(
        self,
        cache: TailscaleCache,
        imported_hostnames: set[str],
        *,
        refresh: bool = False,
    ) -> TailscaleDeviceListResult:
        """Retrieve devices with caching support.

        Part of US0077: Tailscale Device Discovery.

        Args:
            cache: TailscaleCache instance for caching results.
            imported_hostnames: Set of hostnames already registered as servers.
            refresh: If True, bypass cache and fetch fresh data.

        Returns:
            TailscaleDeviceListResult with devices, count, and cache metadata.

        Raises:
            TailscaleNotConfiguredError: If no token is configured.
            TailscaleAuthError: If token is invalid or lacks permissions.
            TailscaleRateLimitError: If rate limited.
            TailscaleConnectionError: If connection fails.
        """
        cache_hit = False
        cached_at = None

        if not refresh:
            cached_devices, cached_at = cache.get()
            if cached_devices is not None:
                cache_hit = True
                logger.debug("Cache hit for Tailscale devices")
            else:
                cached_devices = None

        if not cache_hit:
            # Fetch fresh data from Tailscale API
            raw_devices = await self.get_devices()
            cached_at = cache.set(raw_devices)
            cached_devices = raw_devices
            logger.debug("Cache miss - fetched %d devices from Tailscale", len(raw_devices))

        # Transform to TailscaleDevice objects
        devices = [
            TailscaleDevice.from_tailscale_api(d, imported_hostnames)
            for d in (cached_devices or [])
        ]

        # Sort alphabetically by name
        devices.sort(key=lambda d: d.name.lower())

        return TailscaleDeviceListResult(
            devices=devices,
            count=len(devices),
            cache_hit=cache_hit,
            cached_at=cached_at,
        )
