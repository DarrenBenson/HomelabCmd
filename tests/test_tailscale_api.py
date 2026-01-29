"""Tests for Tailscale API endpoints (US0076: Tailscale API Client Integration).

Tests cover:
- Token save/remove endpoints
- Connection test endpoint
- Status endpoint
- Authentication requirements
- Error handling
"""

from datetime import UTC
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


class TestTailscaleStatusEndpoint:
    """Test GET /api/v1/settings/tailscale/status endpoint."""

    def test_status_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/settings/tailscale/status without auth should return 401."""
        response = client.get("/api/v1/settings/tailscale/status")
        assert response.status_code == 401

    def test_status_returns_unconfigured_when_no_token(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: Status returns configured=false when no token saved."""
        response = client.get(
            "/api/v1/settings/tailscale/status",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["masked_token"] is None


class TestTailscaleSaveTokenEndpoint:
    """Test POST /api/v1/settings/tailscale/token endpoint."""

    def test_save_token_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/settings/tailscale/token without auth should return 401."""
        response = client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-test-123"},
        )
        assert response.status_code == 401

    def test_save_token_with_valid_token(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: Save valid token returns success message."""
        response = client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-abc123-EXAMPLE"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "saved" in data["message"].lower()

    def test_save_empty_token_returns_422(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: Empty token rejected with 422."""
        response = client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_save_token_then_status_shows_configured(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: After saving token, status shows configured=true with masked token."""
        # Save token
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-abc123-EXAMPLE"},
            headers=auth_headers,
        )

        # Check status
        response = client.get(
            "/api/v1/settings/tailscale/status",
            headers=auth_headers,
        )
        data = response.json()
        assert data["configured"] is True
        assert data["masked_token"] == "tskey-ap..."


class TestTailscaleRemoveTokenEndpoint:
    """Test DELETE /api/v1/settings/tailscale/token endpoint."""

    def test_remove_token_requires_auth(self, client: TestClient) -> None:
        """DELETE /api/v1/settings/tailscale/token without auth should return 401."""
        response = client.delete("/api/v1/settings/tailscale/token")
        assert response.status_code == 401

    def test_remove_existing_token(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: Remove existing token returns success."""
        # First save a token
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-to-remove"},
            headers=auth_headers,
        )

        # Remove it
        response = client.delete(
            "/api/v1/settings/tailscale/token",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "removed" in data["message"].lower()

    def test_remove_nonexistent_token_still_succeeds(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Remove when no token configured still returns success."""
        response = client.delete(
            "/api/v1/settings/tailscale/token",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_remove_token_then_status_shows_unconfigured(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """After removing token, status shows configured=false."""
        # Save and then remove token
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-temp"},
            headers=auth_headers,
        )
        client.delete(
            "/api/v1/settings/tailscale/token",
            headers=auth_headers,
        )

        # Check status
        response = client.get(
            "/api/v1/settings/tailscale/status",
            headers=auth_headers,
        )
        data = response.json()
        assert data["configured"] is False


class TestTailscaleTestConnectionEndpoint:
    """Test POST /api/v1/settings/tailscale/test endpoint."""

    def test_test_connection_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/settings/tailscale/test without auth should return 401."""
        response = client.post("/api/v1/settings/tailscale/test")
        assert response.status_code == 401

    def test_test_connection_no_token_returns_error(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: Test connection without token returns TAILSCALE_NOT_CONFIGURED."""
        response = client.post(
            "/api/v1/settings/tailscale/test",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["code"] == "TAILSCALE_NOT_CONFIGURED"

    def test_test_connection_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: Successful connection shows tailnet name and device count."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-valid-token"},
            headers=auth_headers,
        )

        # Mock the TailscaleService.test_connection
        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            mock_service = AsyncMock()
            mock_result = AsyncMock()
            mock_result.success = True
            mock_result.tailnet = "darren-homelab"
            mock_result.device_count = 5
            mock_result.message = "Connected to tailnet: darren-homelab"
            mock_service.test_connection = AsyncMock(return_value=mock_result)
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/v1/settings/tailscale/test",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["tailnet"] == "darren-homelab"
            assert data["device_count"] == 5

    def test_test_connection_auth_error(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: Invalid token returns TAILSCALE_AUTH_ERROR."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-invalid-token"},
            headers=auth_headers,
        )

        # Mock auth error
        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from homelab_cmd.services.tailscale_service import TailscaleAuthError

            mock_service = AsyncMock()
            mock_service.test_connection = AsyncMock(
                side_effect=TailscaleAuthError("Invalid API token")
            )
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/v1/settings/tailscale/test",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert data["code"] == "TAILSCALE_AUTH_ERROR"
            assert "Invalid" in data["error"]

    def test_test_connection_rate_limit_error(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC5: Rate limited returns TAILSCALE_RATE_LIMIT."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-rate-limited"},
            headers=auth_headers,
        )

        # Mock rate limit error
        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from homelab_cmd.services.tailscale_service import TailscaleRateLimitError

            mock_service = AsyncMock()
            mock_service.test_connection = AsyncMock(
                side_effect=TailscaleRateLimitError("Rate limit exceeded", retry_after=60)
            )
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/v1/settings/tailscale/test",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert data["code"] == "TAILSCALE_RATE_LIMIT"

    def test_test_connection_network_error_returns_503(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: Network error returns 503 with TAILSCALE_CONNECTION_ERROR."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-network-error"},
            headers=auth_headers,
        )

        # Mock connection error
        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from homelab_cmd.services.tailscale_service import TailscaleConnectionError

            mock_service = AsyncMock()
            mock_service.test_connection = AsyncMock(
                side_effect=TailscaleConnectionError("Connection timed out after 10s")
            )
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/v1/settings/tailscale/test",
                headers=auth_headers,
            )

            assert response.status_code == 503
            data = response.json()
            assert data["detail"]["code"] == "TAILSCALE_CONNECTION_ERROR"


class TestTokenMasking:
    """Test token masking in responses."""

    def test_token_masked_shows_first_8_chars(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: Token masked shows first 8 chars + '...'."""
        # Save a token
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-longtoken123456789"},
            headers=auth_headers,
        )

        # Check status shows masked value
        response = client.get(
            "/api/v1/settings/tailscale/status",
            headers=auth_headers,
        )
        data = response.json()
        assert data["masked_token"] == "tskey-ap..."
        # Verify full token is not exposed
        assert "longtoken" not in str(data)


# =============================================================================
# US0077: Tailscale Device Discovery API Tests
# =============================================================================


class TestTailscaleDeviceListEndpoint:
    """Test GET /api/v1/tailscale/devices endpoint (US0077)."""

    def test_list_devices_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/tailscale/devices without auth should return 401."""
        response = client.get("/api/v1/tailscale/devices")
        assert response.status_code == 401

    def test_list_devices_no_token_returns_401(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: No token configured returns 401 TAILSCALE_NOT_CONFIGURED."""
        response = client.get(
            "/api/v1/tailscale/devices",
            headers=auth_headers,
        )
        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["code"] == "TAILSCALE_NOT_CONFIGURED"

    def test_list_devices_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC1: Returns list of devices with required fields."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-valid"},
            headers=auth_headers,
        )

        # Mock the TailscaleService.get_devices_cached
        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from datetime import datetime

            from homelab_cmd.services.tailscale_service import (
                TailscaleDevice,
                TailscaleDeviceListResult,
            )

            mock_service = AsyncMock()
            mock_result = TailscaleDeviceListResult(
                devices=[
                    TailscaleDevice(
                        id="12345",
                        name="homeserver.tailnet.ts.net",
                        hostname="homeserver",
                        tailscale_ip="100.64.0.1",
                        os="linux",
                        os_version="1.56.0",
                        last_seen=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
                        online=True,
                        authorized=True,
                        already_imported=False,
                    ),
                ],
                count=1,
                cache_hit=False,
                cached_at=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
            )
            mock_service.get_devices_cached = AsyncMock(return_value=mock_result)
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 1
            assert data["cache_hit"] is False
            assert len(data["devices"]) == 1

            device = data["devices"][0]
            assert device["id"] == "12345"
            assert device["hostname"] == "homeserver"
            assert device["tailscale_ip"] == "100.64.0.1"
            assert device["os"] == "linux"
            assert device["online"] is True
            assert device["already_imported"] is False

    def test_list_devices_filter_by_online(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: Filter by online=true returns only online devices."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-valid"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from datetime import datetime

            from homelab_cmd.services.tailscale_service import (
                TailscaleDevice,
                TailscaleDeviceListResult,
            )

            mock_service = AsyncMock()
            # Return both online and offline devices
            mock_result = TailscaleDeviceListResult(
                devices=[
                    TailscaleDevice(
                        id="1", name="online-server", hostname="online",
                        tailscale_ip="100.64.0.1", os="linux", os_version=None,
                        last_seen=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
                        online=True, authorized=True, already_imported=False,
                    ),
                    TailscaleDevice(
                        id="2", name="offline-server", hostname="offline",
                        tailscale_ip="100.64.0.2", os="linux", os_version=None,
                        last_seen=datetime(2025, 1, 26, 9, 0, 0, tzinfo=UTC),
                        online=False, authorized=True, already_imported=False,
                    ),
                ],
                count=2,
                cache_hit=False,
                cached_at=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
            )
            mock_service.get_devices_cached = AsyncMock(return_value=mock_result)
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices?online=true",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 1
            assert data["devices"][0]["hostname"] == "online"

    def test_list_devices_filter_by_os(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: Filter by os=linux returns only Linux devices."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-valid"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from datetime import datetime

            from homelab_cmd.services.tailscale_service import (
                TailscaleDevice,
                TailscaleDeviceListResult,
            )

            mock_service = AsyncMock()
            mock_result = TailscaleDeviceListResult(
                devices=[
                    TailscaleDevice(
                        id="1", name="linux-server", hostname="linux-server",
                        tailscale_ip="100.64.0.1", os="linux", os_version=None,
                        last_seen=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
                        online=True, authorized=True, already_imported=False,
                    ),
                    TailscaleDevice(
                        id="2", name="windows-pc", hostname="windows-pc",
                        tailscale_ip="100.64.0.2", os="windows", os_version=None,
                        last_seen=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
                        online=True, authorized=True, already_imported=False,
                    ),
                ],
                count=2,
                cache_hit=False,
                cached_at=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
            )
            mock_service.get_devices_cached = AsyncMock(return_value=mock_result)
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices?os=linux",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 1
            assert data["devices"][0]["os"] == "linux"

    def test_list_devices_refresh_bypasses_cache(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: refresh=true bypasses cache and returns cache_hit=false."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-valid"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from datetime import datetime

            from homelab_cmd.services.tailscale_service import TailscaleDeviceListResult

            mock_service = AsyncMock()
            mock_result = TailscaleDeviceListResult(
                devices=[],
                count=0,
                cache_hit=False,
                cached_at=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
            )
            mock_service.get_devices_cached = AsyncMock(return_value=mock_result)
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices?refresh=true",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["cache_hit"] is False

            # Verify refresh=True was passed to service
            mock_service.get_devices_cached.assert_called_once()
            call_kwargs = mock_service.get_devices_cached.call_args.kwargs
            assert call_kwargs.get("refresh") is True

    def test_list_devices_invalid_os_filter_ignored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Edge case #7: Invalid OS value is ignored, returns all devices."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-valid"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from datetime import datetime

            from homelab_cmd.services.tailscale_service import (
                TailscaleDevice,
                TailscaleDeviceListResult,
            )

            mock_service = AsyncMock()
            mock_result = TailscaleDeviceListResult(
                devices=[
                    TailscaleDevice(
                        id="1", name="server", hostname="server",
                        tailscale_ip="100.64.0.1", os="linux", os_version=None,
                        last_seen=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
                        online=True, authorized=True, already_imported=False,
                    ),
                ],
                count=1,
                cache_hit=False,
                cached_at=datetime(2025, 1, 26, 10, 0, 0, tzinfo=UTC),
            )
            mock_service.get_devices_cached = AsyncMock(return_value=mock_result)
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            # Invalid OS value "invalidOS"
            response = client.get(
                "/api/v1/tailscale/devices?os=invalidOS",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            # All devices returned since invalid OS filter is ignored
            assert data["count"] == 1

    def test_list_devices_auth_error_returns_401(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC5: Invalid or expired token returns 401 TAILSCALE_AUTH_ERROR."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-invalid"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from homelab_cmd.services.tailscale_service import TailscaleAuthError

            mock_service = AsyncMock()
            mock_service.get_devices_cached = AsyncMock(
                side_effect=TailscaleAuthError("Token expired or invalid")
            )
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices",
                headers=auth_headers,
            )

            assert response.status_code == 401
            data = response.json()
            assert data["detail"]["code"] == "TAILSCALE_AUTH_ERROR"

    def test_list_devices_rate_limit_returns_503(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC6: Rate limit returns 503 TAILSCALE_RATE_LIMIT with retry_after."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-ratelimited"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from homelab_cmd.services.tailscale_service import TailscaleRateLimitError

            mock_service = AsyncMock()
            mock_service.get_devices_cached = AsyncMock(
                side_effect=TailscaleRateLimitError("Rate limited", retry_after=60)
            )
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices",
                headers=auth_headers,
            )

            assert response.status_code == 503
            data = response.json()
            assert data["detail"]["code"] == "TAILSCALE_RATE_LIMIT"
            assert data["detail"]["retry_after"] == 60

    def test_list_devices_connection_error_returns_503(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC7: Connection error returns 503 TAILSCALE_CONNECTION_ERROR."""
        # Save token first
        client.post(
            "/api/v1/settings/tailscale/token",
            json={"token": "tskey-api-networkerror"},
            headers=auth_headers,
        )

        with patch(
            "homelab_cmd.api.routes.tailscale.TailscaleService"
        ) as mock_service_class:
            from homelab_cmd.services.tailscale_service import TailscaleConnectionError

            mock_service = AsyncMock()
            mock_service.get_devices_cached = AsyncMock(
                side_effect=TailscaleConnectionError("Connection timed out")
            )
            mock_service.close = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.get(
                "/api/v1/tailscale/devices",
                headers=auth_headers,
            )

            assert response.status_code == 503
            data = response.json()
            assert data["detail"]["code"] == "TAILSCALE_CONNECTION_ERROR"


# =============================================================================
# US0078: Tailscale Device Import API Tests
# =============================================================================


class TestTailscaleImportEndpoint:
    """Test POST /api/v1/tailscale/import endpoint (US0078)."""

    def test_import_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/tailscale/import without auth should return 401."""
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "123",
                "tailscale_hostname": "test.example.ts.net",
                "tailscale_ip": "100.64.0.1",
                "os": "linux",
                "display_name": "Test Server",
                "machine_type": "server",
            },
        )
        assert response.status_code == 401

    def test_import_success(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC1: Import creates server record and returns machine details."""
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-001",
                "tailscale_hostname": "homeserver.example.ts.net",
                "tailscale_ip": "100.64.0.1",
                "os": "linux",
                "display_name": "Home Server",
                "machine_type": "server",
                "tdp": 65,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["machine"]["display_name"] == "Home Server"
        assert data["machine"]["tailscale_hostname"] == "homeserver.example.ts.net"
        assert data["machine"]["tailscale_device_id"] == "device-001"
        assert data["machine"]["machine_type"] == "server"
        assert "id" in data["machine"]

    def test_import_with_workstation_type(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC1: Import with machine_type=workstation succeeds."""
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-002",
                "tailscale_hostname": "desktop.example.ts.net",
                "tailscale_ip": "100.64.0.2",
                "os": "windows",
                "display_name": "My Desktop",
                "machine_type": "workstation",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["machine"]["machine_type"] == "workstation"

    def test_import_duplicate_hostname_returns_409(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC2: Importing same hostname twice returns 409 DUPLICATE_MACHINE."""
        # First import
        client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-003",
                "tailscale_hostname": "duplicate.example.ts.net",
                "tailscale_ip": "100.64.0.3",
                "os": "linux",
                "display_name": "First Import",
                "machine_type": "server",
            },
            headers=auth_headers,
        )

        # Second import with same hostname
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-004",
                "tailscale_hostname": "duplicate.example.ts.net",
                "tailscale_ip": "100.64.0.4",
                "os": "linux",
                "display_name": "Second Import",
                "machine_type": "server",
            },
            headers=auth_headers,
        )
        assert response.status_code == 409
        data = response.json()
        assert data["detail"]["code"] == "DUPLICATE_MACHINE"
        assert "existing_machine_id" in data["detail"]

    def test_import_validation_display_name_required(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: Empty display_name fails validation."""
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-005",
                "tailscale_hostname": "noname.example.ts.net",
                "tailscale_ip": "100.64.0.5",
                "os": "linux",
                "display_name": "",
                "machine_type": "server",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_import_validation_tdp_must_be_positive(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: TDP must be positive if provided."""
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-006",
                "tailscale_hostname": "badtdp.example.ts.net",
                "tailscale_ip": "100.64.0.6",
                "os": "linux",
                "display_name": "Bad TDP Server",
                "machine_type": "server",
                "tdp": -10,
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_import_optional_tdp_null(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC1: TDP is optional and can be null."""
        response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-007",
                "tailscale_hostname": "notdp.example.ts.net",
                "tailscale_ip": "100.64.0.7",
                "os": "linux",
                "display_name": "No TDP Server",
                "machine_type": "server",
                "tdp": None,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201


class TestTailscaleImportCheckEndpoint:
    """Test GET /api/v1/tailscale/import/check endpoint (US0078)."""

    def test_check_import_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/tailscale/import/check without auth should return 401."""
        response = client.get(
            "/api/v1/tailscale/import/check?hostname=test.example.ts.net"
        )
        assert response.status_code == 401

    def test_check_import_not_imported(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: Check for non-imported hostname returns imported=false."""
        response = client.get(
            "/api/v1/tailscale/import/check?hostname=notimported.example.ts.net",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] is False
        assert data["machine_id"] is None

    def test_check_import_already_imported(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: Check for imported hostname returns imported=true with details."""
        # First import a device
        import_response = client.post(
            "/api/v1/tailscale/import",
            json={
                "tailscale_device_id": "device-008",
                "tailscale_hostname": "checkme.example.ts.net",
                "tailscale_ip": "100.64.0.8",
                "os": "linux",
                "display_name": "Check Me Server",
                "machine_type": "server",
            },
            headers=auth_headers,
        )
        assert import_response.status_code == 201

        # Now check if it's imported
        response = client.get(
            "/api/v1/tailscale/import/check?hostname=checkme.example.ts.net",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] is True
        assert data["machine_id"] is not None
        assert data["display_name"] == "Check Me Server"
        assert data["imported_at"] is not None

    def test_check_import_missing_hostname_param(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC4: Missing hostname query param returns 422."""
        response = client.get(
            "/api/v1/tailscale/import/check",
            headers=auth_headers,
        )
        assert response.status_code == 422
