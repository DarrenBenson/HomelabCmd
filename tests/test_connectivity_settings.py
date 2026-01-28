"""Tests for Connectivity Mode Management (US0080).

TDD: Tests written first, implementation follows.

Tests cover:
- AC1: Connectivity settings page (two mode options)
- AC2: Tailscale Mode configuration (requires valid token)
- AC3: Direct SSH Mode configuration (no token required)
- AC4: Mode auto-detection
- AC5: Dashboard status bar endpoint
- AC6: SSH configuration shared between modes

Edge cases:
- Switch to Tailscale without token (400 error)
- Tailscale token expires (fall back to direct_ssh)
- Invalid mode value (422 error)
- SSH username empty (400 error)
- SSH username invalid characters (400 error)
- First startup with no configuration (default to direct_ssh)
"""

from unittest.mock import AsyncMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def encryption_key() -> str:
    """Generate a valid Fernet encryption key for tests."""
    return Fernet.generate_key().decode()


# =============================================================================
# Phase 1: Connectivity Schemas Tests
# =============================================================================


class TestConnectivitySchemas:
    """Tests for Pydantic connectivity schemas."""

    def test_connectivity_mode_literal_valid(self) -> None:
        """AC1: Valid modes are 'tailscale' and 'direct_ssh'."""
        from homelab_cmd.api.schemas.connectivity import ConnectivityUpdateRequest

        # Valid tailscale mode
        request = ConnectivityUpdateRequest(mode="tailscale")
        assert request.mode == "tailscale"

        # Valid direct_ssh mode
        request = ConnectivityUpdateRequest(mode="direct_ssh")
        assert request.mode == "direct_ssh"

    def test_connectivity_mode_literal_invalid(self) -> None:
        """Edge case: Invalid mode values are rejected."""
        from pydantic import ValidationError

        from homelab_cmd.api.schemas.connectivity import ConnectivityUpdateRequest

        with pytest.raises(ValidationError) as exc_info:
            ConnectivityUpdateRequest(mode="invalid_mode")

        assert "mode" in str(exc_info.value)

    def test_ssh_username_valid(self) -> None:
        """AC6: Valid SSH usernames are accepted."""
        from homelab_cmd.api.schemas.connectivity import ConnectivityUpdateRequest

        # Standard username
        request = ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="homelabcmd")
        assert request.ssh_username == "homelabcmd"

        # Username starting with underscore
        request = ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="_backup")
        assert request.ssh_username == "_backup"

        # Username with numbers and hyphens
        request = ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="user-123")
        assert request.ssh_username == "user-123"

    def test_ssh_username_empty_rejected(self) -> None:
        """Edge case: Empty SSH username is rejected."""
        from pydantic import ValidationError

        from homelab_cmd.api.schemas.connectivity import ConnectivityUpdateRequest

        with pytest.raises(ValidationError) as exc_info:
            ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="")

        error_str = str(exc_info.value)
        assert "ssh_username" in error_str

    def test_ssh_username_invalid_characters_rejected(self) -> None:
        """Edge case: SSH username with invalid characters is rejected."""
        from pydantic import ValidationError

        from homelab_cmd.api.schemas.connectivity import ConnectivityUpdateRequest

        # Uppercase not allowed
        with pytest.raises(ValidationError):
            ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="Admin")

        # Spaces not allowed
        with pytest.raises(ValidationError):
            ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="my user")

        # Starting with number not allowed
        with pytest.raises(ValidationError):
            ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="123user")

        # Special characters not allowed
        with pytest.raises(ValidationError):
            ConnectivityUpdateRequest(mode="direct_ssh", ssh_username="user@host")

    def test_ssh_username_too_long_rejected(self) -> None:
        """Edge case: SSH username over 32 characters is rejected."""
        from pydantic import ValidationError

        from homelab_cmd.api.schemas.connectivity import ConnectivityUpdateRequest

        # 33 characters (exceeds 32 limit)
        long_username = "a" * 33
        with pytest.raises(ValidationError):
            ConnectivityUpdateRequest(mode="direct_ssh", ssh_username=long_username)


# =============================================================================
# Phase 2: ConnectivityService Tests
# =============================================================================


class TestConnectivityService:
    """Tests for ConnectivityService business logic."""

    @pytest.mark.asyncio
    async def test_detect_mode_no_token_returns_direct_ssh(
        self, db_session, encryption_key
    ) -> None:
        """AC4/Edge case 8: Without token, auto-detect returns direct_ssh."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        mode = await service.detect_connectivity_mode()

        assert mode == "direct_ssh"

    @pytest.mark.asyncio
    async def test_detect_mode_with_valid_token_returns_tailscale(
        self, db_session, encryption_key
    ) -> None:
        """AC4: With valid token, auto-detect returns tailscale."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        # Store a token first
        await credential_service.store_credential("tailscale_token", "tskey-api-test123")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Mock the Tailscale API test to succeed
        with patch.object(
            service, "_test_tailscale_connection", new_callable=AsyncMock
        ) as mock_test:
            mock_test.return_value = True
            mode = await service.detect_connectivity_mode()

        assert mode == "tailscale"

    @pytest.mark.asyncio
    async def test_detect_mode_with_invalid_token_falls_back(
        self, db_session, encryption_key
    ) -> None:
        """Edge case 2: Invalid/expired token falls back to direct_ssh."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        # Store a token
        await credential_service.store_credential("tailscale_token", "tskey-api-expired")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Mock the Tailscale API test to fail
        with patch.object(
            service, "_test_tailscale_connection", new_callable=AsyncMock
        ) as mock_test:
            mock_test.return_value = False
            mode = await service.detect_connectivity_mode()

        assert mode == "direct_ssh"

    @pytest.mark.asyncio
    async def test_get_connectivity_status_direct_ssh_mode(
        self, db_session, encryption_key
    ) -> None:
        """AC3: Direct SSH mode status shows no token required."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        status = await service.get_connectivity_status()

        assert status.mode == "direct_ssh"
        assert status.mode_auto_detected is True
        assert status.tailscale.configured is False

    @pytest.mark.asyncio
    async def test_get_connectivity_status_tailscale_mode(
        self, db_session, encryption_key
    ) -> None:
        """AC2: Tailscale mode status shows tailnet info."""
        from homelab_cmd.api.routes.config import set_config_value
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        # Store token and set mode
        await credential_service.store_credential("tailscale_token", "tskey-api-test")
        await set_config_value(db_session, "connectivity_mode", {"mode": "tailscale"})
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Mock tailscale service for device count
        with patch.object(
            service, "_get_tailscale_info", new_callable=AsyncMock
        ) as mock_info:
            mock_info.return_value = {
                "configured": True,
                "connected": True,
                "tailnet": "test-tailnet.github",
                "device_count": 5,
            }
            status = await service.get_connectivity_status()

        assert status.mode == "tailscale"
        assert status.tailscale.configured is True
        assert status.tailscale.device_count == 5

    @pytest.mark.asyncio
    async def test_update_mode_to_tailscale_without_token_fails(
        self, db_session, encryption_key
    ) -> None:
        """Edge case 1: Cannot switch to Tailscale without token."""
        from homelab_cmd.services.connectivity_service import (
            ConnectivityService,
            TailscaleTokenRequiredError,
        )
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        with pytest.raises(TailscaleTokenRequiredError):
            await service.update_connectivity_mode("tailscale", "homelabcmd")

    @pytest.mark.asyncio
    async def test_update_mode_to_direct_ssh_succeeds(
        self, db_session, encryption_key
    ) -> None:
        """AC3: Can switch to Direct SSH mode without token."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        result = await service.update_connectivity_mode("direct_ssh", "testuser")
        await db_session.commit()

        assert result.success is True
        assert result.mode == "direct_ssh"

    @pytest.mark.asyncio
    async def test_update_mode_persists_to_database(
        self, db_session, encryption_key
    ) -> None:
        """AC1: Mode persists to database."""
        from homelab_cmd.api.routes.config import get_config_value
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        await service.update_connectivity_mode("direct_ssh", "homelabcmd")
        await db_session.commit()

        # Read back from database
        config = await get_config_value(db_session, "connectivity_mode")
        assert config is not None
        assert config.get("mode") == "direct_ssh"

    @pytest.mark.asyncio
    async def test_ssh_username_persists_to_database(
        self, db_session, encryption_key
    ) -> None:
        """AC6: SSH username persists to database."""
        from homelab_cmd.api.routes.config import get_config_value
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        await service.update_connectivity_mode("direct_ssh", "customuser")
        await db_session.commit()

        # Read back from database
        config = await get_config_value(db_session, "ssh_username")
        assert config is not None
        assert config.get("username") == "customuser"

    @pytest.mark.asyncio
    async def test_get_status_bar_info_tailscale(
        self, db_session, encryption_key
    ) -> None:
        """AC5: Status bar shows Tailscale mode with device count."""
        from homelab_cmd.api.routes.config import set_config_value
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-api-test")
        await set_config_value(db_session, "connectivity_mode", {"mode": "tailscale"})
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        with patch.object(
            service, "_get_tailscale_device_count", new_callable=AsyncMock
        ) as mock_count:
            mock_count.return_value = 11
            status_bar = await service.get_status_bar_info()

        assert status_bar.mode == "tailscale"
        assert status_bar.display == "Tailscale (11 devices)"
        assert status_bar.healthy is True

    @pytest.mark.asyncio
    async def test_get_status_bar_info_direct_ssh(
        self, db_session, encryption_key
    ) -> None:
        """AC5: Status bar shows Direct SSH mode."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        status_bar = await service.get_status_bar_info()

        assert status_bar.mode == "direct_ssh"
        assert status_bar.display == "Direct SSH"
        assert status_bar.healthy is True


# =============================================================================
# Phase 3: API Endpoint Tests
# =============================================================================


class TestConnectivityAPIEndpoints:
    """Tests for connectivity settings API endpoints."""

    def test_get_connectivity_status_endpoint(
        self, client, auth_headers
    ) -> None:
        """AC1: GET /api/v1/settings/connectivity returns status."""
        response = client.get(
            "/api/v1/settings/connectivity", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "mode" in data
        assert data["mode"] in ["tailscale", "direct_ssh"]
        assert "tailscale" in data
        assert "ssh" in data

    def test_update_connectivity_mode_endpoint(
        self, client, auth_headers
    ) -> None:
        """AC1: PUT /api/v1/settings/connectivity updates mode."""
        response = client.put(
            "/api/v1/settings/connectivity",
            headers=auth_headers,
            json={"mode": "direct_ssh", "ssh_username": "homelabcmd"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["mode"] == "direct_ssh"

    def test_update_to_tailscale_without_token_returns_400(
        self, client, auth_headers
    ) -> None:
        """Edge case 1: PUT to tailscale without token returns 400."""
        response = client.put(
            "/api/v1/settings/connectivity",
            headers=auth_headers,
            json={"mode": "tailscale", "ssh_username": "homelabcmd"},
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "TAILSCALE_TOKEN_REQUIRED"

    def test_update_with_invalid_mode_returns_422(
        self, client, auth_headers
    ) -> None:
        """Edge case 3: PUT with invalid mode returns 422."""
        response = client.put(
            "/api/v1/settings/connectivity",
            headers=auth_headers,
            json={"mode": "invalid_mode", "ssh_username": "homelabcmd"},
        )

        assert response.status_code == 422

    def test_update_with_empty_username_returns_422(
        self, client, auth_headers
    ) -> None:
        """Edge case 4: PUT with empty username returns 422."""
        response = client.put(
            "/api/v1/settings/connectivity",
            headers=auth_headers,
            json={"mode": "direct_ssh", "ssh_username": ""},
        )

        assert response.status_code == 422

    def test_get_status_bar_endpoint(
        self, client, auth_headers
    ) -> None:
        """AC5: GET /api/v1/settings/connectivity/status returns status bar info."""
        response = client.get(
            "/api/v1/settings/connectivity/status", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "mode" in data
        assert "display" in data
        assert "healthy" in data

    def test_connectivity_requires_auth(self, client) -> None:
        """API endpoints require authentication."""
        # No auth header
        response = client.get("/api/v1/settings/connectivity")
        assert response.status_code == 401

        response = client.put(
            "/api/v1/settings/connectivity",
            json={"mode": "direct_ssh", "ssh_username": "test"},
        )
        assert response.status_code == 401

        response = client.get("/api/v1/settings/connectivity/status")
        assert response.status_code == 401


# =============================================================================
# Phase 4: SSH Configuration Shared Tests
# =============================================================================


class TestSSHConfigurationShared:
    """Tests for shared SSH configuration between modes."""

    @pytest.mark.asyncio
    async def test_ssh_username_shared_between_modes(
        self, db_session, encryption_key
    ) -> None:
        """AC6: SSH username is shared between connectivity modes."""
        from homelab_cmd.api.routes.config import get_config_value, set_config_value
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        # Set username in direct_ssh mode
        await service.update_connectivity_mode("direct_ssh", "shared_user")
        await db_session.commit()

        # Verify username is stored
        config = await get_config_value(db_session, "ssh_username")
        assert config.get("username") == "shared_user"

        # Store token and switch to tailscale mode
        await credential_service.store_credential("tailscale_token", "tskey-api-test")
        await db_session.commit()

        with patch.object(
            service, "_test_tailscale_connection", new_callable=AsyncMock
        ) as mock_test:
            mock_test.return_value = True
            await service.update_connectivity_mode("tailscale", "shared_user")
            await db_session.commit()

        # Username should still be the same
        config = await get_config_value(db_session, "ssh_username")
        assert config.get("username") == "shared_user"

    @pytest.mark.asyncio
    async def test_ssh_key_status_included_in_both_modes(
        self, db_session, encryption_key
    ) -> None:
        """AC6: SSH key status is included in connectivity status."""
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        # Get status without SSH key
        status = await service.get_connectivity_status()
        assert status.ssh.key_configured is False

        # Upload SSH key
        await credential_service.store_credential(
            "ssh_private_key", "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----"
        )
        await db_session.commit()

        # Get status with SSH key
        status = await service.get_connectivity_status()
        assert status.ssh.key_configured is True


# =============================================================================
# Phase 5: Integration Tests (No Internal Method Mocking)
# =============================================================================


class TestConnectivityServiceIntegration:
    """Integration tests that verify service composition without mocking internal methods.

    These tests catch API signature mismatches between services that unit tests
    with mocked internal methods would miss.
    """

    @pytest.mark.asyncio
    async def test_tailscale_service_instantiation_signature(
        self, db_session, encryption_key
    ) -> None:
        """Verify TailscaleService is instantiated with correct constructor args.

        This catches API signature mismatches between ConnectivityService
        and TailscaleService that mocked tests would miss.

        Bug prevented: TailscaleService(token, base_url) vs TailscaleService(credential_service)
        """
        from unittest.mock import MagicMock, patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Store a token so the code path reaches TailscaleService instantiation
        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test-123")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Patch httpx.AsyncClient.get to avoid real API call, but NOT the TailscaleService constructor
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 401  # Simulate auth error
            mock_response.json.return_value = {"message": "Unauthorized"}
            mock_get.return_value = mock_response

            # This will instantiate real TailscaleService - catches signature errors
            result = await service._test_tailscale_connection()

            # Auth error expected, but instantiation should succeed
            assert result is False

            # CRITICAL: Verify the HTTP call was actually made.
            # If TailscaleService constructor failed (e.g., wrong args), the
            # exception handler would return False but mock_get.called would be False.
            assert mock_get.called, (
                "HTTP mock was not called - TailscaleService may have failed to instantiate. "
                "Check constructor signature matches TailscaleService(credential_service)."
            )

    @pytest.mark.asyncio
    async def test_get_tailscale_info_instantiates_service_correctly(
        self, db_session, encryption_key
    ) -> None:
        """Verify _get_tailscale_info instantiates TailscaleService correctly.

        Tests the TailscaleService instantiation path in _get_tailscale_info().
        """
        from unittest.mock import MagicMock, patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test-456")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Patch at httpx level to avoid real network call
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 403
            mock_response.json.return_value = {"error": "forbidden"}
            mock_get.return_value = mock_response

            # This exercises the real TailscaleService instantiation
            info = await service._get_tailscale_info()

            # Token exists but connection failed
            assert info["configured"] is True
            assert info["connected"] is False

            # Verify HTTP call was made (proves TailscaleService instantiated correctly)
            assert mock_get.called, (
                "HTTP mock was not called - TailscaleService constructor may have failed."
            )

    @pytest.mark.asyncio
    async def test_get_tailscale_device_count_instantiates_service_correctly(
        self, db_session, encryption_key
    ) -> None:
        """Verify _get_tailscale_device_count instantiates TailscaleService correctly.

        Tests the TailscaleService instantiation path in _get_tailscale_device_count().
        """
        from unittest.mock import MagicMock, patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test-789")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Patch at httpx level
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_response.json.return_value = {"error": "internal error"}
            mock_get.return_value = mock_response

            # This exercises real TailscaleService and TailscaleCache instantiation
            count = await service._get_tailscale_device_count()

            # Error expected, should return 0 gracefully
            assert count == 0

            # Verify HTTP call was made (proves TailscaleService instantiated correctly)
            assert mock_get.called, (
                "HTTP mock was not called - TailscaleService constructor may have failed."
            )


# =============================================================================
# Phase 6: Config Value Edge Case Tests
# =============================================================================


class TestConfigValueEdgeCases:
    """Tests for edge cases in config value handling.

    These tests verify the defensive code that handles string config values,
    empty dicts, and other malformed data that could occur from legacy data
    or database corruption.

    Bug prevented: Code calling .get() on string values instead of dicts.
    """

    @pytest.mark.asyncio
    async def test_get_connectivity_status_with_string_mode_config(
        self, db_session, encryption_key
    ) -> None:
        """Config stored as string instead of dict should be handled."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Directly insert string value to simulate legacy/corrupted data
        config = Config(key="connectivity_mode", value="tailscale")
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        with patch.object(service, "_get_tailscale_info", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "configured": False,
                "connected": False,
                "tailnet": None,
                "device_count": 0,
            }
            status = await service.get_connectivity_status()

        assert status.mode == "tailscale"
        assert status.mode_auto_detected is False

    @pytest.mark.asyncio
    async def test_get_status_bar_info_with_string_mode_config(
        self, db_session, encryption_key
    ) -> None:
        """Status bar should handle string config values."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert string value directly
        config = Config(key="connectivity_mode", value="direct_ssh")
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        status_bar = await service.get_status_bar_info()

        assert status_bar.mode == "direct_ssh"
        assert status_bar.display == "Direct SSH"

    @pytest.mark.asyncio
    async def test_get_ssh_info_with_string_username_config(
        self, db_session, encryption_key
    ) -> None:
        """SSH username as string instead of dict should be handled."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert string username directly (legacy format)
        config = Config(key="ssh_username", value="customuser")
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        ssh_info = await service._get_ssh_info()

        assert ssh_info.username == "customuser"

    @pytest.mark.asyncio
    async def test_get_connectivity_status_with_empty_dict_config(
        self, db_session, encryption_key
    ) -> None:
        """Empty dict config triggers auto-detection (empty dict is falsy)."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert empty dict - this is falsy in Python, so triggers auto-detect
        config = Config(key="connectivity_mode", value={})
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        status = await service.get_connectivity_status()

        # Empty dict is falsy, so mode is auto-detected (no token = direct_ssh)
        assert status.mode == "direct_ssh"
        assert status.mode_auto_detected is True

    @pytest.mark.asyncio
    async def test_get_connectivity_status_with_dict_missing_mode_key(
        self, db_session, encryption_key
    ) -> None:
        """Dict with content but missing 'mode' key should use default."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert dict with other keys but no 'mode' key
        config = Config(key="connectivity_mode", value={"other_key": "value"})
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        with patch.object(service, "_get_tailscale_info", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "configured": False,
                "connected": False,
                "tailnet": None,
                "device_count": 0,
            }
            status = await service.get_connectivity_status()

        # Should use default "direct_ssh" when 'mode' key is missing from truthy dict
        assert status.mode == "direct_ssh"
        assert status.mode_auto_detected is False

    @pytest.mark.asyncio
    async def test_get_ssh_info_with_empty_dict_username_config(
        self, db_session, encryption_key
    ) -> None:
        """Empty dict for SSH username should use default."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert empty dict - missing 'username' key
        config = Config(key="ssh_username", value={})
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        ssh_info = await service._get_ssh_info()

        # Should use default username
        assert ssh_info.username == "homelabcmd"

    @pytest.mark.asyncio
    async def test_get_status_bar_with_empty_dict_mode_config(
        self, db_session, encryption_key
    ) -> None:
        """Status bar with empty dict config should use default mode."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert empty dict
        config = Config(key="connectivity_mode", value={})
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        status_bar = await service.get_status_bar_info()

        # Should default to direct_ssh
        assert status_bar.mode == "direct_ssh"
        assert status_bar.display == "Direct SSH"

    @pytest.mark.asyncio
    async def test_config_with_integer_value_handled_gracefully(
        self, db_session, encryption_key
    ) -> None:
        """Non-string, non-dict config values should be handled."""
        from homelab_cmd.db.models.config import Config
        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        # Insert integer value (weird edge case)
        config = Config(key="connectivity_mode", value=123)
        db_session.add(config)
        await db_session.commit()

        credential_service = CredentialService(db_session, encryption_key)
        service = ConnectivityService(db_session, credential_service)

        with patch.object(service, "_get_tailscale_info", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "configured": False,
                "connected": False,
                "tailnet": None,
                "device_count": 0,
            }
            status = await service.get_connectivity_status()

        # Should use default when value is neither dict nor string
        assert status.mode == "direct_ssh"
        assert status.mode_auto_detected is False


# =============================================================================
# Phase 7: Exception Handling Regression Tests (BG0021)
# =============================================================================


class TestExceptionHandlingBG0021:
    """Regression tests for BG0021: Broad Exception Handling.

    Verifies that:
    1. TailscaleError exceptions are caught and handled gracefully
    2. Other exceptions (programming errors) propagate correctly
    3. asyncio.CancelledError propagates correctly (not caught)

    Bug prevented: Silent failures from catching Exception instead of specific types.
    """

    @pytest.mark.asyncio
    async def test_tailscale_error_caught_gracefully(
        self, db_session, encryption_key
    ) -> None:
        """TailscaleError should be caught and return safe default."""
        from unittest.mock import patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService
        from homelab_cmd.services.tailscale_service import TailscaleConnectionError

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Simulate TailscaleConnectionError - should be caught
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = TailscaleConnectionError("Connection refused")

            result = await service._test_tailscale_connection()

        # Should return False, not raise
        assert result is False

    @pytest.mark.asyncio
    async def test_attribute_error_propagates(
        self, db_session, encryption_key
    ) -> None:
        """Programming errors (AttributeError) should NOT be caught.

        BG0021 fix: Only TailscaleError subclasses should be caught,
        not programming errors like AttributeError.
        """
        from unittest.mock import patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Simulate programming error - should NOT be caught
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = AttributeError("Bug in code")

            with pytest.raises(AttributeError) as exc_info:
                await service._test_tailscale_connection()

            assert "Bug in code" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_cancelled_error_propagates(
        self, db_session, encryption_key
    ) -> None:
        """asyncio.CancelledError should NOT be caught.

        BG0021 fix: CancelledError must propagate to allow proper async cancellation.
        Catching it breaks asyncio task cancellation semantics.
        """
        import asyncio
        from unittest.mock import patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # Simulate task cancellation - should NOT be caught
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = asyncio.CancelledError()

            with pytest.raises(asyncio.CancelledError):
                await service._test_tailscale_connection()

    @pytest.mark.asyncio
    async def test_get_tailscale_info_catches_only_tailscale_errors(
        self, db_session, encryption_key
    ) -> None:
        """_get_tailscale_info should only catch TailscaleError, not all exceptions."""
        from unittest.mock import patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService
        from homelab_cmd.services.tailscale_service import TailscaleAuthError

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # TailscaleAuthError should be caught
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = TailscaleAuthError("Invalid token")

            info = await service._get_tailscale_info()

        # Should return safe defaults, not raise
        assert info["configured"] is True
        assert info["connected"] is False

    @pytest.mark.asyncio
    async def test_get_device_count_catches_only_tailscale_errors(
        self, db_session, encryption_key
    ) -> None:
        """_get_tailscale_device_count should only catch TailscaleError."""
        from unittest.mock import patch

        from homelab_cmd.services.connectivity_service import ConnectivityService
        from homelab_cmd.services.credential_service import CredentialService
        from homelab_cmd.services.tailscale_service import TailscaleRateLimitError

        credential_service = CredentialService(db_session, encryption_key)
        await credential_service.store_credential("tailscale_token", "tskey-test")
        await db_session.commit()

        service = ConnectivityService(db_session, credential_service)

        # TailscaleRateLimitError should be caught
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = TailscaleRateLimitError("Rate limited")

            count = await service._get_tailscale_device_count()

        # Should return 0, not raise
        assert count == 0
