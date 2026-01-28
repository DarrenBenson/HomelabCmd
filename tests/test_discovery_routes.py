"""Tests for Discovery API endpoints (US0041: Network Discovery).

These tests verify the discovery routes:
- POST /api/v1/discovery (start discovery)
- GET /api/v1/discovery/{id} (get discovery status)
- GET /api/v1/settings/discovery (get settings)
- PUT /api/v1/settings/discovery (update settings)
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_run_discovery():
    """Fixture to mock the run_discovery_background coroutine."""

    # Mock the coroutine function itself to return a dummy coroutine
    async def dummy_coro(discovery_id):
        pass

    with patch(
        "homelab_cmd.api.routes.discovery.run_discovery_background",
        return_value=dummy_coro(1),
    ):
        yield


class TestStartDiscovery:
    """Tests for POST /api/v1/discovery endpoint."""

    def test_start_discovery_returns_202(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """Starting a discovery should return 202 Accepted."""
        response = client.post("/api/v1/discovery", headers=auth_headers)
        assert response.status_code == 202

    def test_start_discovery_returns_discovery_id(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """Response should include a discovery_id."""
        response = client.post("/api/v1/discovery", headers=auth_headers)
        data = response.json()
        assert "discovery_id" in data
        assert isinstance(data["discovery_id"], int)

    def test_start_discovery_with_custom_subnet(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """Should accept a custom subnet in the request."""
        response = client.post(
            "/api/v1/discovery",
            json={"subnet": "10.0.0.0/24"},
            headers=auth_headers,
        )
        assert response.status_code == 202
        data = response.json()
        assert data["subnet"] == "10.0.0.0/24"

    def test_start_discovery_returns_existing_if_running(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """If a discovery is already running, return the existing discovery."""
        # Start first discovery
        response1 = client.post("/api/v1/discovery", headers=auth_headers)
        discovery_id = response1.json()["discovery_id"]

        # Start second discovery - should return existing
        response2 = client.post("/api/v1/discovery", headers=auth_headers)
        assert response2.status_code == 202
        assert response2.json()["discovery_id"] == discovery_id

    def test_start_discovery_invalid_subnet_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Invalid subnet should return 400 Bad Request."""
        response = client.post(
            "/api/v1/discovery",
            json={"subnet": "invalid-subnet"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_start_discovery_requires_auth(self, client: TestClient) -> None:
        """Starting a discovery without auth should return 401."""
        response = client.post("/api/v1/discovery")
        assert response.status_code == 401


class TestGetDiscovery:
    """Tests for GET /api/v1/discovery/{discovery_id} endpoint."""

    def test_get_discovery_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """Getting an existing discovery should return 200 OK."""
        # Create a discovery first
        create_response = client.post("/api/v1/discovery", headers=auth_headers)
        discovery_id = create_response.json()["discovery_id"]

        # Get the discovery
        response = client.get(f"/api/v1/discovery/{discovery_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_get_discovery_not_found_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Getting a non-existent discovery should return 404."""
        response = client.get("/api/v1/discovery/999999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_discovery_includes_status(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """Discovery response should include status."""
        create_response = client.post("/api/v1/discovery", headers=auth_headers)
        discovery_id = create_response.json()["discovery_id"]

        response = client.get(f"/api/v1/discovery/{discovery_id}", headers=auth_headers)
        data = response.json()
        assert "status" in data
        assert data["status"] in ["pending", "running", "completed", "failed"]

    def test_get_discovery_includes_subnet(
        self, client: TestClient, auth_headers: dict[str, str], mock_run_discovery
    ) -> None:
        """Discovery response should include the subnet being scanned."""
        create_response = client.post("/api/v1/discovery", headers=auth_headers)
        discovery_id = create_response.json()["discovery_id"]

        response = client.get(f"/api/v1/discovery/{discovery_id}", headers=auth_headers)
        data = response.json()
        assert "subnet" in data

    def test_get_discovery_requires_auth(self, client: TestClient) -> None:
        """Getting a discovery without auth should return 401."""
        response = client.get("/api/v1/discovery/1")
        assert response.status_code == 401


class TestDiscoverySettings:
    """Tests for /api/v1/settings/discovery endpoints."""

    def test_get_settings_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Getting discovery settings should return 200 OK."""
        response = client.get("/api/v1/settings/discovery", headers=auth_headers)
        assert response.status_code == 200

    def test_get_settings_returns_defaults(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Default settings should be returned."""
        response = client.get("/api/v1/settings/discovery", headers=auth_headers)
        data = response.json()
        assert "default_subnet" in data
        assert "timeout_ms" in data
        # Check default values
        assert data["default_subnet"] == "192.168.1.0/24"
        assert data["timeout_ms"] == 500

    def test_update_subnet(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Updating the default subnet should work."""
        response = client.put(
            "/api/v1/settings/discovery",
            json={"default_subnet": "10.0.0.0/24"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["default_subnet"] == "10.0.0.0/24"

    def test_update_timeout(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Updating the timeout should work."""
        response = client.put(
            "/api/v1/settings/discovery",
            json={"timeout_ms": 1000},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["timeout_ms"] == 1000

    def test_update_invalid_subnet_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updating with invalid subnet should return 400."""
        response = client.put(
            "/api/v1/settings/discovery",
            json={"default_subnet": "not-a-valid-subnet"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_get_settings_requires_auth(self, client: TestClient) -> None:
        """Getting settings without auth should return 401."""
        response = client.get("/api/v1/settings/discovery")
        assert response.status_code == 401

    def test_update_settings_requires_auth(self, client: TestClient) -> None:
        """Updating settings without auth should return 401."""
        response = client.put(
            "/api/v1/settings/discovery",
            json={"timeout_ms": 1000},
        )
        assert response.status_code == 401
