"""Tests for Expected Services API endpoints (US0019).

These tests verify the CRUD operations for expected services configuration.

Spec Reference: sdlc-studio/stories/US0019-expected-services-api.md
"""

from fastapi.testclient import TestClient


class TestListServerServices:
    """Tests for GET /api/v1/servers/{server_id}/services (AC1)."""

    def test_list_services_returns_empty_for_new_server(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Server with no configured services returns empty array."""
        create_server(client, auth_headers, "test-list-empty")
        response = client.get("/api/v1/servers/test-list-empty/services", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["services"] == []
        assert response.json()["total"] == 0

    def test_list_services_returns_all_configured(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Lists all expected services for a server."""
        create_server(client, auth_headers, "test-list-all")
        client.post(
            "/api/v1/servers/test-list-all/services",
            json={"service_name": "plex", "is_critical": True},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/servers/test-list-all/services",
            json={"service_name": "sonarr"},
            headers=auth_headers,
        )
        response = client.get("/api/v1/servers/test-list-all/services", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["total"] == 2
        service_names = [s["service_name"] for s in response.json()["services"]]
        assert "plex" in service_names
        assert "sonarr" in service_names

    def test_list_services_includes_current_status(
        self, client: TestClient, auth_headers: dict[str, str], create_server, send_heartbeat
    ) -> None:
        """List includes current_status when service status is available."""
        create_server(client, auth_headers, "test-status-server")
        client.post(
            "/api/v1/servers/test-status-server/services",
            json={"service_name": "nginx"},
            headers=auth_headers,
        )
        send_heartbeat(
            client,
            auth_headers,
            "test-status-server",
            services=[
                {
                    "name": "nginx",
                    "status": "running",
                    "pid": 1234,
                    "memory_mb": 50.5,
                    "cpu_percent": 1.2,
                }
            ],
        )
        response = client.get("/api/v1/servers/test-status-server/services", headers=auth_headers)
        assert response.status_code == 200
        service = response.json()["services"][0]
        assert service["service_name"] == "nginx"
        assert service["current_status"]["status"] == "running"
        assert service["current_status"]["pid"] == 1234

    def test_list_services_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.get("/api/v1/servers/nonexistent-server/services", headers=auth_headers)
        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_list_services_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.get("/api/v1/servers/any-server/services")
        assert response.status_code == 401


class TestCreateExpectedService:
    """Tests for POST /api/v1/servers/{server_id}/services (AC2)."""

    def test_create_service_with_minimal_fields(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Create service with only required field (service_name)."""
        create_server(client, auth_headers, "test-create-minimal")
        response = client.post(
            "/api/v1/servers/test-create-minimal/services",
            json={"service_name": "docker"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["service_name"] == "docker"
        assert data["display_name"] is None
        assert data["is_critical"] is False
        assert data["enabled"] is True

    def test_create_service_with_all_fields(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Create service with all optional fields."""
        create_server(client, auth_headers, "test-create-all")
        response = client.post(
            "/api/v1/servers/test-create-all/services",
            json={"service_name": "plex", "display_name": "Plex Media Server", "is_critical": True},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["service_name"] == "plex"
        assert data["display_name"] == "Plex Media Server"
        assert data["is_critical"] is True

    def test_create_service_critical_flag(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Create service with is_critical flag (AC5)."""
        create_server(client, auth_headers, "test-critical-flag")
        response = client.post(
            "/api/v1/servers/test-critical-flag/services",
            json={"service_name": "pihole-ftl", "is_critical": True},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["is_critical"] is True

    def test_create_duplicate_service_returns_409(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Creating service with existing name returns 409 Conflict."""
        create_server(client, auth_headers, "test-duplicate")
        client.post(
            "/api/v1/servers/test-duplicate/services",
            json={"service_name": "nginx"},
            headers=auth_headers,
        )
        response = client.post(
            "/api/v1/servers/test-duplicate/services",
            json={"service_name": "nginx"},
            headers=auth_headers,
        )
        assert response.status_code == 409
        assert "CONFLICT" in response.json()["detail"]["code"]

    def test_create_service_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.post(
            "/api/v1/servers/nonexistent-server/services",
            json={"service_name": "test"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_create_service_validates_service_name(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Invalid service name format returns 422."""
        create_server(client, auth_headers, "test-validate")
        response = client.post(
            "/api/v1/servers/test-validate/services",
            json={"service_name": "Invalid_Name"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_create_service_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.post("/api/v1/servers/any-server/services", json={"service_name": "test"})
        assert response.status_code == 401


class TestUpdateExpectedService:
    """Tests for PUT /api/v1/servers/{server_id}/services/{service_name} (AC3)."""

    def test_update_display_name(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Update only display_name field."""
        create_server(client, auth_headers, "test-update-name")
        client.post(
            "/api/v1/servers/test-update-name/services",
            json={"service_name": "plex"},
            headers=auth_headers,
        )
        response = client.put(
            "/api/v1/servers/test-update-name/services/plex",
            json={"display_name": "Plex Media Server"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["display_name"] == "Plex Media Server"
        assert response.json()["is_critical"] is False
        assert response.json()["enabled"] is True

    def test_update_critical_flag(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Update is_critical flag (AC5)."""
        create_server(client, auth_headers, "test-update-critical")
        client.post(
            "/api/v1/servers/test-update-critical/services",
            json={"service_name": "nginx", "is_critical": False},
            headers=auth_headers,
        )
        response = client.put(
            "/api/v1/servers/test-update-critical/services/nginx",
            json={"is_critical": True},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_critical"] is True

    def test_update_enabled_flag(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Update enabled flag to disable monitoring."""
        create_server(client, auth_headers, "test-update-enabled")
        client.post(
            "/api/v1/servers/test-update-enabled/services",
            json={"service_name": "docker"},
            headers=auth_headers,
        )
        response = client.put(
            "/api/v1/servers/test-update-enabled/services/docker",
            json={"enabled": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["enabled"] is False

    def test_update_multiple_fields(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Update multiple fields at once."""
        create_server(client, auth_headers, "test-update-multi")
        client.post(
            "/api/v1/servers/test-update-multi/services",
            json={"service_name": "sonarr"},
            headers=auth_headers,
        )
        response = client.put(
            "/api/v1/servers/test-update-multi/services/sonarr",
            json={"display_name": "Sonarr", "is_critical": True, "enabled": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "Sonarr"
        assert data["is_critical"] is True
        assert data["enabled"] is False

    def test_update_service_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.put(
            "/api/v1/servers/nonexistent-server/services/test",
            json={"is_critical": True},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_service_404_for_nonexistent_service(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Returns 404 when service doesn't exist."""
        create_server(client, auth_headers, "test-update-404")
        response = client.put(
            "/api/v1/servers/test-update-404/services/nonexistent",
            json={"is_critical": True},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_service_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.put(
            "/api/v1/servers/any-server/services/test", json={"is_critical": True}
        )
        assert response.status_code == 401


class TestDeleteExpectedService:
    """Tests for DELETE /api/v1/servers/{server_id}/services/{service_name} (AC4)."""

    def test_delete_service(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Delete an expected service."""
        create_server(client, auth_headers, "test-delete")
        client.post(
            "/api/v1/servers/test-delete/services",
            json={"service_name": "nginx"},
            headers=auth_headers,
        )
        response = client.delete("/api/v1/servers/test-delete/services/nginx", headers=auth_headers)
        assert response.status_code == 204
        list_response = client.get("/api/v1/servers/test-delete/services", headers=auth_headers)
        assert list_response.json()["total"] == 0

    def test_delete_service_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.delete(
            "/api/v1/servers/nonexistent-server/services/test", headers=auth_headers
        )
        assert response.status_code == 404

    def test_delete_service_404_for_nonexistent_service(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Returns 404 when service doesn't exist."""
        create_server(client, auth_headers, "test-delete-404")
        response = client.delete(
            "/api/v1/servers/test-delete-404/services/nonexistent", headers=auth_headers
        )
        assert response.status_code == 404

    def test_delete_service_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.delete("/api/v1/servers/any-server/services/test")
        assert response.status_code == 401


class TestServiceNameValidation:
    """Tests for service name validation."""

    def test_valid_service_names(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Valid systemd-style service names are accepted."""
        create_server(client, auth_headers, "test-valid-names")
        valid_names = [
            "simple",
            "with-hyphen",
            "with_underscore",
            "with.dot",
            "docker.service",
            "user@1000.service",
        ]
        for name in valid_names:
            response = client.post(
                "/api/v1/servers/test-valid-names/services",
                json={"service_name": name},
                headers=auth_headers,
            )
            assert response.status_code == 201, f"Name '{name}' should be valid"

    def test_invalid_service_names(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Invalid service names are rejected."""
        create_server(client, auth_headers, "test-invalid-names")
        invalid_names = ["UPPERCASE", "with spaces", "special!char", ""]
        for name in invalid_names:
            response = client.post(
                "/api/v1/servers/test-invalid-names/services",
                json={"service_name": name},
                headers=auth_headers,
            )
            assert response.status_code == 422, f"Name '{name}' should be invalid"


class TestRestartService:
    """Tests for POST /api/v1/servers/{server_id}/services/{service_name}/restart."""

    def test_restart_service_auto_approved(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Restart action is auto-approved when server is not paused."""
        create_server(client, auth_headers, "test-restart-auto")
        response = client.post(
            "/api/v1/servers/test-restart-auto/services/nginx/restart",
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "approved"
        assert data["action_type"] == "restart_service"
        assert data["service_name"] == "nginx"
        assert data["command"] == "systemctl restart nginx"
        assert "action_id" in data

    def test_restart_service_pending_when_paused(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Restart action is pending when server is paused (maintenance mode)."""
        create_server(client, auth_headers, "test-restart-paused")
        # Pause the server
        client.put("/api/v1/servers/test-restart-paused/pause", headers=auth_headers)

        response = client.post(
            "/api/v1/servers/test-restart-paused/services/docker/restart",
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["action_type"] == "restart_service"
        assert data["service_name"] == "docker"

    def test_restart_service_duplicate_409(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Returns 409 when restart action already exists for service."""
        create_server(client, auth_headers, "test-restart-dup")
        # Pause server so action stays pending
        client.put("/api/v1/servers/test-restart-dup/pause", headers=auth_headers)

        # Create first restart action
        response1 = client.post(
            "/api/v1/servers/test-restart-dup/services/plex/restart",
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Try to create duplicate
        response2 = client.post(
            "/api/v1/servers/test-restart-dup/services/plex/restart",
            headers=auth_headers,
        )
        assert response2.status_code == 409
        assert "existing_action_id" in response2.json()["detail"]

    def test_restart_service_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.post(
            "/api/v1/servers/nonexistent-server/services/nginx/restart",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_restart_service_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.post("/api/v1/servers/any-server/services/nginx/restart")
        assert response.status_code == 401

    def test_restart_service_returns_action_id(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Restart response includes action ID for tracking."""
        create_server(client, auth_headers, "test-restart-id")
        response = client.post(
            "/api/v1/servers/test-restart-id/services/sonarr/restart",
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert "action_id" in response.json()
        assert isinstance(response.json()["action_id"], int)

    def test_restart_allowed_for_different_services(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Can create restart actions for different services on same server."""
        create_server(client, auth_headers, "test-restart-multi")
        client.put("/api/v1/servers/test-restart-multi/pause", headers=auth_headers)

        # Restart first service
        response1 = client.post(
            "/api/v1/servers/test-restart-multi/services/nginx/restart",
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Restart second service - should succeed
        response2 = client.post(
            "/api/v1/servers/test-restart-multi/services/docker/restart",
            headers=auth_headers,
        )
        assert response2.status_code == 201
