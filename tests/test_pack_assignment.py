"""Tests for pack assignment API endpoints.

Part of EP0010: Configuration Management - US0121 Pack Assignment per Machine.
"""

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from homelab_cmd.services.config_pack_service import ConfigPackService


@pytest.fixture
def temp_packs_dir(tmp_path: Path) -> Path:
    """Create a temporary directory with test packs."""
    # Create base pack
    base_data = {
        "name": "Base Pack",
        "description": "Essential configuration",
    }
    (tmp_path / "base.yaml").write_text(yaml.dump(base_data))

    # Create developer-lite pack
    dev_lite_data = {
        "name": "Developer Lite",
        "description": "Basic development tools",
        "extends": "base",
    }
    (tmp_path / "developer-lite.yaml").write_text(yaml.dump(dev_lite_data))

    # Create developer-max pack
    dev_max_data = {
        "name": "Developer Max",
        "description": "Full development environment",
        "extends": "developer-lite",
    }
    (tmp_path / "developer-max.yaml").write_text(yaml.dump(dev_max_data))

    return tmp_path


@pytest.fixture
def setup_test_packs(temp_packs_dir: Path):
    """Set up test packs for API tests."""
    import homelab_cmd.api.routes.config_packs as config_packs_module

    original_service = config_packs_module._service
    config_packs_module._service = ConfigPackService(packs_dir=temp_packs_dir)

    yield config_packs_module._service

    config_packs_module._service = original_service


@pytest.fixture
def server_data() -> dict:
    """Return sample server data for tests."""
    return {
        "id": "pack-test-server",
        "hostname": "pack-test.local",
        "machine_type": "server",
    }


class TestPackAssignmentAPI:
    """API integration tests for pack assignment endpoints."""

    def test_get_assigned_packs_unauthorized(self, client: TestClient) -> None:
        """Test that getting packs requires authentication."""
        response = client.get("/api/v1/servers/test-server/config/packs")
        assert response.status_code == 401

    def test_get_assigned_packs_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test getting packs for nonexistent server returns 404."""
        response = client.get(
            "/api/v1/servers/nonexistent-server/config/packs", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "NOT_FOUND"

    def test_get_assigned_packs_default(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
    ) -> None:
        """Test that default assigned packs is ['base'] for server type."""
        # Create a server via API
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Get assigned packs
        response = client.get(
            f"/api/v1/servers/{server_data['id']}/config/packs", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["server_id"] == server_data["id"]
        assert data["assigned_packs"] == ["base"]
        assert data["drift_detection_enabled"] is True

    def test_get_assigned_packs_workstation_default(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that default assigned packs is ['base', 'developer-lite'] for workstation type."""
        workstation_data = {
            "id": "test-workstation",
            "hostname": "workstation.local",
            "machine_type": "workstation",
        }
        response = client.post("/api/v1/servers", json=workstation_data, headers=auth_headers)
        assert response.status_code == 201

        # Get assigned packs
        response = client.get(
            f"/api/v1/servers/{workstation_data['id']}/config/packs", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["assigned_packs"] == ["base", "developer-lite"]

    def test_update_assigned_packs_unauthorized(self, client: TestClient) -> None:
        """Test that updating packs requires authentication."""
        response = client.put(
            "/api/v1/servers/test-server/config/packs", json={"packs": ["base"]}
        )
        assert response.status_code == 401

    def test_update_assigned_packs_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test updating packs for nonexistent server returns 404."""
        response = client.put(
            "/api/v1/servers/nonexistent-server/config/packs",
            json={"packs": ["base"]},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_assigned_packs_success(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
        setup_test_packs,
    ) -> None:
        """Test updating assigned packs succeeds."""
        # Create server
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Update packs
        response = client.put(
            f"/api/v1/servers/{server_data['id']}/config/packs",
            json={"packs": ["base", "developer-max"]},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["server_id"] == server_data["id"]
        assert data["assigned_packs"] == ["base", "developer-max"]

        # Verify persistence by fetching again
        response = client.get(
            f"/api/v1/servers/{server_data['id']}/config/packs", headers=auth_headers
        )
        assert response.json()["assigned_packs"] == ["base", "developer-max"]

    def test_update_assigned_packs_base_required(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
        setup_test_packs,
    ) -> None:
        """Test that base pack cannot be removed."""
        # Create server
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Try to update without base pack
        response = client.put(
            f"/api/v1/servers/{server_data['id']}/config/packs",
            json={"packs": ["developer-lite"]},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "BASE_PACK_REQUIRED"

    def test_update_assigned_packs_unknown_pack(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
        setup_test_packs,
    ) -> None:
        """Test that unknown pack name is rejected."""
        # Create server
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Try to update with unknown pack
        response = client.put(
            f"/api/v1/servers/{server_data['id']}/config/packs",
            json={"packs": ["base", "unknown-pack"]},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "UNKNOWN_PACK"
        assert "unknown-pack" in response.json()["detail"]["message"]

    def test_update_assigned_packs_empty_array(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
        setup_test_packs,
    ) -> None:
        """Test that empty packs array is rejected (base required)."""
        # Create server
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Try to update with empty array - should be rejected by schema (min_length=1)
        response = client.put(
            f"/api/v1/servers/{server_data['id']}/config/packs",
            json={"packs": []},
            headers=auth_headers,
        )

        assert response.status_code == 422  # Pydantic validation error

    def test_server_response_includes_assigned_packs(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
    ) -> None:
        """Test that server response includes assigned_packs field."""
        # Create server
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Get server details
        response = client.get(
            f"/api/v1/servers/{server_data['id']}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "assigned_packs" in data
        assert "drift_detection_enabled" in data
        assert data["assigned_packs"] == ["base"]
        assert data["drift_detection_enabled"] is True


class TestPackAssignmentDefaultLogic:
    """Tests for default pack assignment logic."""

    def test_server_type_gets_base_only(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that server machine_type gets only base pack."""
        server_data = {
            "id": "server-type-test",
            "hostname": "server.local",
            "machine_type": "server",
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

        # Check assigned packs
        response = client.get(
            f"/api/v1/servers/{server_data['id']}/config/packs", headers=auth_headers
        )
        assert response.json()["assigned_packs"] == ["base"]

    def test_workstation_type_gets_base_and_developer_lite(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test that workstation machine_type gets base and developer-lite packs."""
        workstation_data = {
            "id": "workstation-type-test",
            "hostname": "workstation.local",
            "machine_type": "workstation",
        }
        response = client.post("/api/v1/servers", json=workstation_data, headers=auth_headers)
        assert response.status_code == 201

        # Check assigned packs
        response = client.get(
            f"/api/v1/servers/{workstation_data['id']}/config/packs", headers=auth_headers
        )
        assert response.json()["assigned_packs"] == ["base", "developer-lite"]

    def test_machine_type_change_does_not_update_packs(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_data: dict,
        setup_test_packs,
    ) -> None:
        """Test that changing machine_type does not auto-update packs."""
        # Create server with custom packs
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        client.put(
            f"/api/v1/servers/{server_data['id']}/config/packs",
            json={"packs": ["base", "developer-max"]},
            headers=auth_headers,
        )

        # Change machine type from server to workstation
        response = client.put(
            f"/api/v1/servers/{server_data['id']}",
            json={"machine_type": "workstation"},
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Packs should remain unchanged (user choice preserved)
        response = client.get(
            f"/api/v1/servers/{server_data['id']}/config/packs", headers=auth_headers
        )
        assert response.json()["assigned_packs"] == ["base", "developer-max"]
