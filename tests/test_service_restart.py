"""Tests for Service Restart Action API endpoint (US0022).

These tests verify the POST /api/v1/servers/{server_id}/services/{service_name}/restart
endpoint for queuing service restart actions.

Spec Reference: sdlc-studio/stories/US0022-service-restart-action.md
"""

from fastapi.testclient import TestClient


class TestRestartServiceEndpoint:
    """Tests for POST /servers/{server_id}/services/{service_name}/restart (AC1)."""

    def test_restart_creates_action(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """POST creates a restart action, auto-approved when server not paused (AC1, AC3)."""
        # Register server (not paused by default)
        server_data = {"id": "restart-test-server", "hostname": "restart-test-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Queue restart
        response = client.post(
            "/api/v1/servers/restart-test-server/services/plex/restart",
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        # Auto-approved when server not in maintenance mode
        assert data["status"] == "approved"

    def test_restart_returns_action_details(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response includes action_id, command, status, etc. (AC2)."""
        # Register server
        server_data = {"id": "restart-details-server", "hostname": "restart-details-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Queue restart
        response = client.post(
            "/api/v1/servers/restart-details-server/services/nginx/restart",
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert "action_id" in data
        assert data["action_type"] == "restart_service"
        assert data["server_id"] == "restart-details-server"
        assert data["service_name"] == "nginx"
        assert data["command"] == "systemctl restart nginx"
        assert data["status"] == "approved"  # Auto-approved when not paused
        assert "created_at" in data

    def test_restart_generates_correct_command(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Command is 'systemctl restart {service_name}' (AC2)."""
        # Register server
        server_data = {"id": "restart-cmd-server", "hostname": "restart-cmd-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Queue restart for specific service
        response = client.post(
            "/api/v1/servers/restart-cmd-server/services/docker/restart",
            headers=auth_headers,
        )

        assert response.status_code == 201
        assert response.json()["command"] == "systemctl restart docker"

    def test_restart_pending_when_server_paused(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Action status is 'pending' when server is in maintenance mode (AC3)."""
        # Register server and pause it (PUT not POST)
        server_data = {"id": "restart-paused-server", "hostname": "restart-paused-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        client.put(
            "/api/v1/servers/restart-paused-server/pause",
            headers=auth_headers,
        )

        # Queue restart
        response = client.post(
            "/api/v1/servers/restart-paused-server/services/sonarr/restart",
            headers=auth_headers,
        )

        assert response.status_code == 201
        assert response.json()["status"] == "pending"


class TestRestartDuplicateDetection:
    """Tests for duplicate pending action detection (AC5)."""

    def test_duplicate_pending_returns_409(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Second restart for same service returns 409 (AC5)."""
        # Register server
        server_data = {"id": "restart-dup-server", "hostname": "restart-dup-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # First restart - should succeed
        response1 = client.post(
            "/api/v1/servers/restart-dup-server/services/plex/restart",
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Second restart - should fail with 409
        response2 = client.post(
            "/api/v1/servers/restart-dup-server/services/plex/restart",
            headers=auth_headers,
        )
        assert response2.status_code == 409

    def test_409_includes_existing_action_id(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """409 response includes existing_action_id (AC5)."""
        # Register server
        server_data = {"id": "restart-409-server", "hostname": "restart-409-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # First restart
        response1 = client.post(
            "/api/v1/servers/restart-409-server/services/nginx/restart",
            headers=auth_headers,
        )
        original_action_id = response1.json()["action_id"]

        # Second restart - should include original action_id
        response2 = client.post(
            "/api/v1/servers/restart-409-server/services/nginx/restart",
            headers=auth_headers,
        )

        assert response2.status_code == 409
        data = response2.json()["detail"]
        assert data["existing_action_id"] == original_action_id
        assert "already queued" in data["detail"]

    def test_different_services_can_have_pending_actions(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Different services on same server can each have pending action."""
        # Register server
        server_data = {"id": "restart-multi-server", "hostname": "restart-multi-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Restart service A
        response1 = client.post(
            "/api/v1/servers/restart-multi-server/services/plex/restart",
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Restart service B - should also succeed
        response2 = client.post(
            "/api/v1/servers/restart-multi-server/services/sonarr/restart",
            headers=auth_headers,
        )
        assert response2.status_code == 201

    def test_different_servers_can_have_pending_actions_for_same_service(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Same service name on different servers can each have pending action."""
        # Register two servers
        client.post(
            "/api/v1/servers",
            json={"id": "server-a", "hostname": "server-a"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/servers",
            json={"id": "server-b", "hostname": "server-b"},
            headers=auth_headers,
        )

        # Restart plex on server A
        response1 = client.post(
            "/api/v1/servers/server-a/services/plex/restart",
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Restart plex on server B - should also succeed
        response2 = client.post(
            "/api/v1/servers/server-b/services/plex/restart",
            headers=auth_headers,
        )
        assert response2.status_code == 201


class TestRestartErrorHandling:
    """Tests for error handling in restart endpoint."""

    def test_restart_unknown_server_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Restart on unknown server returns 404."""
        response = client.post(
            "/api/v1/servers/nonexistent-server/services/plex/restart",
            headers=auth_headers,
        )

        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_restart_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.post(
            "/api/v1/servers/any-server/services/plex/restart",
        )
        assert response.status_code == 401


class TestRestartAllowsAnyService:
    """Tests verifying restart works for any service name."""

    def test_restart_allows_running_service(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Restart is allowed even for running services (user intent)."""
        # Register server
        server_data = {"id": "restart-running-server", "hostname": "restart-running-server"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Add expected service and report it as running via heartbeat
        client.post(
            "/api/v1/servers/restart-running-server/services",
            json={"service_name": "nginx"},
            headers=auth_headers,
        )
        heartbeat_data = {
            "server_id": "restart-running-server",
            "hostname": "restart-running-server",
            "timestamp": "2026-01-19T10:30:00Z",
            "services": [{"name": "nginx", "status": "running", "pid": 1234}],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Restart should still work
        response = client.post(
            "/api/v1/servers/restart-running-server/services/nginx/restart",
            headers=auth_headers,
        )

        assert response.status_code == 201

    def test_restart_allows_unconfigured_service(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Restart works for services not in expected_services list."""
        # Register server (no expected services configured)
        server_data = {"id": "restart-unconfigured", "hostname": "restart-unconfigured"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Restart unconfigured service - should work
        response = client.post(
            "/api/v1/servers/restart-unconfigured/services/random-service/restart",
            headers=auth_headers,
        )

        assert response.status_code == 201
        assert response.json()["service_name"] == "random-service"
