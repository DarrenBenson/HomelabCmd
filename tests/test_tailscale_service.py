"""Tests for TailscaleService (US0076: Tailscale API Client Integration).

Tests cover:
- Successful connection test returns tailnet info
- Error handling for 401, 403, 429 responses
- Connection timeout and network error handling
- No token configured scenario
"""

from datetime import UTC
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from cryptography.fernet import Fernet

from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.tailscale_service import (
    TailscaleAuthError,
    TailscaleConnectionError,
    TailscaleNotConfiguredError,
    TailscaleRateLimitError,
    TailscaleService,
)


@pytest.fixture
def encryption_key() -> str:
    """Generate a valid Fernet encryption key for tests."""
    return Fernet.generate_key().decode()


def _create_mock_client(
    response: MagicMock | None = None, side_effect: Exception | None = None
) -> MagicMock:
    """Create a mock httpx client with common setup.

    Args:
        response: Mock response to return from get().
        side_effect: Exception to raise from get().

    Returns:
        Mock client with get() and aclose() configured.
    """
    mock_client = MagicMock()
    if side_effect:
        mock_client.get = AsyncMock(side_effect=side_effect)
    else:
        mock_client.get = AsyncMock(return_value=response)
    mock_client.aclose = AsyncMock()
    return mock_client


class TestTailscaleServiceConnection:
    """Test TailscaleService connection testing."""

    @pytest.mark.asyncio
    async def test_successful_connection_returns_tailnet_info(
        self, db_session, encryption_key
    ) -> None:
        """AC3: Successful connection shows tailnet name and device count."""
        # Store token in credential service
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-api-test-123")
        await db_session.commit()

        service = TailscaleService(credential_service)

        # Mock the httpx client response on the instance
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Tailscale API format: 'name' is FQDN, 'hostname' is short name
        mock_response.json.return_value = {
            "devices": [
                {
                    "id": "12345",
                    "name": "homeserver.darren-homelab.ts.net",
                    "hostname": "homeserver",
                    "addresses": ["100.64.0.1"],
                    "os": "linux",
                    "online": True,
                },
                {
                    "id": "12346",
                    "name": "desktop.darren-homelab.ts.net",
                    "hostname": "desktop",
                    "addresses": ["100.64.0.2"],
                    "os": "windows",
                    "online": True,
                },
            ]
        }
        service._client = _create_mock_client(response=mock_response)

        result = await service.test_connection()

        assert result.success is True
        assert result.tailnet == "darren-homelab"
        assert result.device_count == 2
        assert "darren-homelab" in result.message

        await service.close()

    @pytest.mark.asyncio
    async def test_no_token_configured_raises_error(
        self, db_session, encryption_key
    ) -> None:
        """AC4: No token configured returns appropriate error."""
        credential_service = CredentialService(db_session, encryption_key)
        service = TailscaleService(credential_service)

        with pytest.raises(TailscaleNotConfiguredError) as exc_info:
            await service.test_connection()

        assert "No Tailscale API token configured" in str(exc_info.value)

        await service.close()


class TestTailscaleServiceErrorHandling:
    """Test error handling for various HTTP responses."""

    @pytest.mark.asyncio
    async def test_401_raises_auth_error(self, db_session, encryption_key) -> None:
        """AC4: 401 response raises TailscaleAuthError with 'Invalid API token'."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "invalid-token")
        await db_session.commit()

        service = TailscaleService(credential_service)

        mock_response = MagicMock()
        mock_response.status_code = 401
        service._client = _create_mock_client(response=mock_response)

        with pytest.raises(TailscaleAuthError) as exc_info:
            await service.test_connection()

        assert "Invalid API token" in str(exc_info.value)

        await service.close()

    @pytest.mark.asyncio
    async def test_403_raises_auth_error_with_permissions_message(
        self, db_session, encryption_key
    ) -> None:
        """AC4: 403 response raises TailscaleAuthError with permissions message."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "no-perms-token")
        await db_session.commit()

        service = TailscaleService(credential_service)

        mock_response = MagicMock()
        mock_response.status_code = 403
        service._client = _create_mock_client(response=mock_response)

        with pytest.raises(TailscaleAuthError) as exc_info:
            await service.test_connection()

        assert "lacks required permissions" in str(exc_info.value)
        assert "devices:read" in str(exc_info.value)

        await service.close()

    @pytest.mark.asyncio
    async def test_429_raises_rate_limit_error_with_retry_after(
        self, db_session, encryption_key
    ) -> None:
        """AC5: 429 response raises TailscaleRateLimitError with retry delay."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "rate-limited-token")
        await db_session.commit()

        service = TailscaleService(credential_service)

        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "60"}
        service._client = _create_mock_client(response=mock_response)

        with pytest.raises(TailscaleRateLimitError) as exc_info:
            await service.test_connection()

        assert exc_info.value.retry_after == 60
        assert "Rate limit exceeded" in str(exc_info.value)

        await service.close()

    @pytest.mark.asyncio
    async def test_connection_timeout_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """AC4: Connection timeout raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "timeout-token")
        await db_session.commit()

        service = TailscaleService(credential_service)
        service._client = _create_mock_client(
            side_effect=httpx.ConnectTimeout("timeout")
        )

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.test_connection()

        assert "timed out" in str(exc_info.value).lower()

        await service.close()

    @pytest.mark.asyncio
    async def test_network_error_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """AC4: Network unreachable raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "network-error-token")
        await db_session.commit()

        service = TailscaleService(credential_service)
        service._client = _create_mock_client(
            side_effect=httpx.ConnectError("Network unreachable")
        )

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.test_connection()

        assert "Could not reach" in str(exc_info.value)

        await service.close()

    @pytest.mark.asyncio
    async def test_read_timeout_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """AC4: Read timeout raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "read-timeout-token")
        await db_session.commit()

        service = TailscaleService(credential_service)
        service._client = _create_mock_client(
            side_effect=httpx.ReadTimeout("read timeout")
        )

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.test_connection()

        assert "Read timed out" in str(exc_info.value)

        await service.close()


class TestTailscaleServiceConfiguration:
    """Test httpx client configuration."""

    def test_client_configured_with_correct_timeouts(
        self, db_session, encryption_key
    ) -> None:
        """AC1: httpx client has 10s connect and 30s read timeouts."""
        credential_service = CredentialService(db_session, encryption_key)
        service = TailscaleService(credential_service)

        # Check the timeout configuration
        timeout = service._client.timeout
        assert timeout.connect == 10.0
        assert timeout.read == 30.0

    def test_base_url_is_correct(self, db_session, encryption_key) -> None:
        """AC1: Base URL is https://api.tailscale.com/api/v2."""
        credential_service = CredentialService(db_session, encryption_key)
        service = TailscaleService(credential_service)

        assert service.BASE_URL == "https://api.tailscale.com/api/v2"


class TestTailscaleServiceGetDevices:
    """Test TailscaleService.get_devices method."""

    @pytest.mark.asyncio
    async def test_get_devices_returns_device_list(
        self, db_session, encryption_key
    ) -> None:
        """get_devices returns list of devices from API."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-api-test-123")
        await db_session.commit()

        service = TailscaleService(credential_service)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "devices": [
                {"id": "1", "name": "server1", "online": True},
                {"id": "2", "name": "server2", "online": False},
            ]
        }
        service._client = _create_mock_client(response=mock_response)

        devices = await service.get_devices()

        assert len(devices) == 2
        assert devices[0]["name"] == "server1"
        assert devices[1]["name"] == "server2"

        await service.close()

    @pytest.mark.asyncio
    async def test_get_devices_no_token_raises_error(
        self, db_session, encryption_key
    ) -> None:
        """get_devices with no token raises TailscaleNotConfiguredError."""
        credential_service = CredentialService(db_session, encryption_key)
        service = TailscaleService(credential_service)

        with pytest.raises(TailscaleNotConfiguredError):
            await service.get_devices()

        await service.close()

    @pytest.mark.asyncio
    async def test_get_devices_connect_timeout_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """get_devices with connect timeout raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "timeout-token")
        await db_session.commit()

        service = TailscaleService(credential_service)
        service._client = _create_mock_client(
            side_effect=httpx.ConnectTimeout("connect timeout")
        )

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.get_devices()

        assert "timed out" in str(exc_info.value).lower()
        await service.close()

    @pytest.mark.asyncio
    async def test_get_devices_connect_error_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """get_devices with network error raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "network-error-token")
        await db_session.commit()

        service = TailscaleService(credential_service)
        service._client = _create_mock_client(
            side_effect=httpx.ConnectError("Network unreachable")
        )

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.get_devices()

        assert "Could not reach" in str(exc_info.value)
        await service.close()

    @pytest.mark.asyncio
    async def test_get_devices_read_timeout_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """get_devices with read timeout raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "read-timeout-token")
        await db_session.commit()

        service = TailscaleService(credential_service)
        service._client = _create_mock_client(
            side_effect=httpx.ReadTimeout("read timeout")
        )

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.get_devices()

        assert "Read timed out" in str(exc_info.value)
        await service.close()

    @pytest.mark.asyncio
    async def test_get_devices_http_status_error_raises_connection_error(
        self, db_session, encryption_key
    ) -> None:
        """get_devices with unexpected HTTP error raises TailscaleConnectionError."""
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "http-error-token")
        await db_session.commit()

        service = TailscaleService(credential_service)

        # Create a mock response for HTTPStatusError
        mock_response = MagicMock()
        mock_response.status_code = 503
        http_error = httpx.HTTPStatusError(
            "Service unavailable", request=MagicMock(), response=mock_response
        )
        service._client = _create_mock_client(side_effect=http_error)

        with pytest.raises(TailscaleConnectionError) as exc_info:
            await service.get_devices()

        assert "503" in str(exc_info.value)
        await service.close()


# =============================================================================
# US0077: Tailscale Device Discovery - Cache Tests
# =============================================================================


class TestTailscaleCache:
    """Test TailscaleCache functionality (US0077)."""

    def test_cache_initially_returns_none(self) -> None:
        """New cache returns (None, None)."""
        from homelab_cmd.services.tailscale_service import TailscaleCache

        cache = TailscaleCache()
        devices, cached_at = cache.get()

        assert devices is None
        assert cached_at is None

    def test_cache_set_returns_timestamp(self) -> None:
        """set() returns a timestamp and stores devices."""
        from datetime import datetime

        from homelab_cmd.services.tailscale_service import TailscaleCache

        cache = TailscaleCache()
        devices = [{"id": "1", "name": "test-device"}]

        cached_at = cache.set(devices)

        assert cached_at is not None
        assert isinstance(cached_at, datetime)
        assert cached_at.tzinfo == UTC

    def test_cache_get_returns_cached_devices(self) -> None:
        """get() returns cached devices before TTL expires."""
        from homelab_cmd.services.tailscale_service import TailscaleCache

        cache = TailscaleCache()
        devices = [{"id": "1", "name": "test-device"}]
        cache.set(devices)

        result_devices, result_cached_at = cache.get()

        assert result_devices == devices
        assert result_cached_at is not None

    def test_cache_invalidate_clears_cache(self) -> None:
        """invalidate() clears the cache."""
        from homelab_cmd.services.tailscale_service import TailscaleCache

        cache = TailscaleCache()
        cache.set([{"id": "1", "name": "test-device"}])

        cache.invalidate()

        devices, cached_at = cache.get()
        assert devices is None
        assert cached_at is None

    def test_cache_returns_none_after_ttl(self) -> None:
        """get() returns (None, None) after TTL expires."""
        from datetime import datetime, timedelta
        from unittest.mock import patch

        from homelab_cmd.services.tailscale_service import TailscaleCache

        cache = TailscaleCache()
        devices = [{"id": "1", "name": "test-device"}]
        cache.set(devices)

        # Simulate time passing beyond TTL (5 minutes + 1 second)
        future_time = datetime.now(UTC) + timedelta(minutes=5, seconds=1)
        with patch(
            "homelab_cmd.services.tailscale_service.datetime"
        ) as mock_datetime:
            mock_datetime.now.return_value = future_time

            result_devices, result_cached_at = cache.get()

        assert result_devices is None
        assert result_cached_at is None


class TestTailscaleDeviceTransform:
    """Test TailscaleDevice.from_tailscale_api transformation (US0077)."""

    def test_transforms_full_device_data(self) -> None:
        """Transforms complete Tailscale API response."""
        from homelab_cmd.services.tailscale_service import TailscaleDevice

        raw_data = {
            "id": "12345",
            "name": "homeserver.darren-homelab.ts.net",
            "hostname": "homeserver",
            "addresses": ["100.64.0.1", "fd7a:115c:a1e0::1"],
            "os": "linux",
            "clientVersion": "1.56.0",
            "lastSeen": "2025-01-26T10:00:00Z",
            "online": True,
            "authorized": True,
        }
        imported_hostnames: set[str] = set()

        device = TailscaleDevice.from_tailscale_api(raw_data, imported_hostnames)

        assert device.id == "12345"
        assert device.name == "homeserver.darren-homelab.ts.net"
        assert device.hostname == "homeserver"
        assert device.tailscale_ip == "100.64.0.1"  # First address
        assert device.os == "linux"
        assert device.os_version == "1.56.0"
        assert device.online is True
        assert device.authorized is True
        assert device.already_imported is False

    def test_sets_already_imported_flag(self) -> None:
        """Sets already_imported=True when hostname matches existing server."""
        from homelab_cmd.services.tailscale_service import TailscaleDevice

        raw_data = {
            "id": "12345",
            "name": "homeserver.darren-homelab.ts.net",
            "hostname": "homeserver",
            "addresses": ["100.64.0.1"],
            "os": "linux",
            "online": True,
            "authorized": True,
        }
        imported_hostnames = {"homeserver", "nas"}

        device = TailscaleDevice.from_tailscale_api(raw_data, imported_hostnames)

        assert device.already_imported is True

    def test_handles_missing_addresses(self) -> None:
        """Handles device with no addresses."""
        from homelab_cmd.services.tailscale_service import TailscaleDevice

        raw_data = {
            "id": "12345",
            "name": "device",
            "hostname": "device",
            "addresses": [],
            "os": "linux",
            "online": False,
            "authorized": True,
        }

        device = TailscaleDevice.from_tailscale_api(raw_data, set())

        assert device.tailscale_ip == ""

    def test_handles_missing_client_version(self) -> None:
        """os_version is None when clientVersion not provided."""
        from homelab_cmd.services.tailscale_service import TailscaleDevice

        raw_data = {
            "id": "12345",
            "name": "device",
            "hostname": "device",
            "addresses": ["100.64.0.1"],
            "os": "linux",
            "online": True,
            "authorized": True,
        }

        device = TailscaleDevice.from_tailscale_api(raw_data, set())

        assert device.os_version is None


class TestTailscaleServiceGetDevicesCached:
    """Test TailscaleService.get_devices_cached method (US0077)."""

    @pytest.mark.asyncio
    async def test_returns_fresh_data_on_cache_miss(
        self, db_session, encryption_key
    ) -> None:
        """Fetches from API when cache is empty."""
        from homelab_cmd.services.tailscale_service import (
            TailscaleCache,
            TailscaleService,
        )

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = TailscaleService(credential_service)
        cache = TailscaleCache()

        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "devices": [
                {
                    "id": "1",
                    "name": "server1.tailnet.ts.net",
                    "hostname": "server1",
                    "addresses": ["100.64.0.1"],
                    "os": "linux",
                    "online": True,
                    "authorized": True,
                    "lastSeen": "2025-01-26T10:00:00Z",
                },
            ]
        }
        service._client = _create_mock_client(response=mock_response)

        result = await service.get_devices_cached(
            cache=cache,
            imported_hostnames=set(),
        )

        assert result.cache_hit is False
        assert result.count == 1
        assert result.devices[0].hostname == "server1"
        assert result.cached_at is not None

        await service.close()

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_cache_hit(
        self, db_session, encryption_key
    ) -> None:
        """Returns cached data without API call when cache is valid."""
        from homelab_cmd.services.tailscale_service import (
            TailscaleCache,
            TailscaleService,
        )

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = TailscaleService(credential_service)

        # Pre-populate cache
        cache = TailscaleCache()
        cache.set([
            {
                "id": "1",
                "name": "cached-server.tailnet.ts.net",
                "hostname": "cached-server",
                "addresses": ["100.64.0.1"],
                "os": "linux",
                "online": True,
                "authorized": True,
                "lastSeen": "2025-01-26T10:00:00Z",
            },
        ])

        # Mock should NOT be called
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"devices": []}
        mock_client = _create_mock_client(response=mock_response)
        service._client = mock_client

        result = await service.get_devices_cached(
            cache=cache,
            imported_hostnames=set(),
        )

        assert result.cache_hit is True
        assert result.count == 1
        assert result.devices[0].hostname == "cached-server"
        # Verify API was not called
        mock_client.get.assert_not_called()

        await service.close()

    @pytest.mark.asyncio
    async def test_bypasses_cache_on_refresh(
        self, db_session, encryption_key
    ) -> None:
        """refresh=True bypasses cache and fetches fresh data."""
        from homelab_cmd.services.tailscale_service import (
            TailscaleCache,
            TailscaleService,
        )

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = TailscaleService(credential_service)

        # Pre-populate cache
        cache = TailscaleCache()
        cache.set([
            {
                "id": "old",
                "name": "old-server",
                "hostname": "old-server",
                "addresses": ["100.64.0.1"],
                "os": "linux",
                "online": False,
                "authorized": True,
                "lastSeen": "2025-01-26T10:00:00Z",
            },
        ])

        # Mock fresh API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "devices": [
                {
                    "id": "new",
                    "name": "new-server.tailnet.ts.net",
                    "hostname": "new-server",
                    "addresses": ["100.64.0.2"],
                    "os": "linux",
                    "online": True,
                    "authorized": True,
                    "lastSeen": "2025-01-26T11:00:00Z",
                },
            ]
        }
        service._client = _create_mock_client(response=mock_response)

        result = await service.get_devices_cached(
            cache=cache,
            imported_hostnames=set(),
            refresh=True,
        )

        assert result.cache_hit is False
        assert result.count == 1
        assert result.devices[0].hostname == "new-server"

        await service.close()

    @pytest.mark.asyncio
    async def test_sorts_devices_alphabetically(
        self, db_session, encryption_key
    ) -> None:
        """Devices are sorted alphabetically by name."""
        from homelab_cmd.services.tailscale_service import (
            TailscaleCache,
            TailscaleService,
        )

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = TailscaleService(credential_service)
        cache = TailscaleCache()

        # Mock API response with unsorted devices
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "devices": [
                {"id": "3", "name": "charlie", "hostname": "c", "addresses": ["100.64.0.3"], "os": "linux", "online": True, "authorized": True, "lastSeen": "2025-01-26T10:00:00Z"},
                {"id": "1", "name": "alpha", "hostname": "a", "addresses": ["100.64.0.1"], "os": "linux", "online": True, "authorized": True, "lastSeen": "2025-01-26T10:00:00Z"},
                {"id": "2", "name": "bravo", "hostname": "b", "addresses": ["100.64.0.2"], "os": "linux", "online": True, "authorized": True, "lastSeen": "2025-01-26T10:00:00Z"},
            ]
        }
        service._client = _create_mock_client(response=mock_response)

        result = await service.get_devices_cached(
            cache=cache,
            imported_hostnames=set(),
        )

        assert [d.name for d in result.devices] == ["alpha", "bravo", "charlie"]

        await service.close()
