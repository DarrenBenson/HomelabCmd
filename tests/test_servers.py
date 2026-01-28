"""Tests for Server Registration API (TSP0001: TC006-TC012).

These tests verify the server CRUD endpoints for US0002: Server Registration API.

Spec Reference: sdlc-studio/testing/specs/TSP0001-core-monitoring-api.md
"""

from fastapi.testclient import TestClient


class TestListServers:
    """TC006: List all servers returns empty array."""

    def test_list_servers_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/servers should return 200 OK."""
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert response.status_code == 200

    def test_list_servers_response_has_servers_key(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should have 'servers' key."""
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert "servers" in response.json()

    def test_list_servers_returns_empty_array_when_no_servers(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Servers array should be empty when no servers registered."""
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert response.json()["servers"] == []

    def test_list_servers_has_total_count(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should have 'total' count."""
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert response.json()["total"] == 0


class TestRegisterServer:
    """TC007: Register new server successfully."""

    def test_register_server_returns_201(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /api/v1/servers should return 201 Created."""
        server_data = {
            "id": "omv-mediaserver",
            "hostname": "omv-mediaserver",
            "display_name": "Media Server",
            "ip_address": "192.168.1.100",
            "tdp_watts": 65,
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 201

    def test_register_server_response_contains_id(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain server ID."""
        server_data = {
            "id": "omv-mediaserver",
            "hostname": "omv-mediaserver",
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.json()["id"] == "omv-mediaserver"

    def test_register_server_status_defaults_to_unknown(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """New server status should default to 'unknown'."""
        server_data = {
            "id": "omv-mediaserver",
            "hostname": "omv-mediaserver",
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.json()["status"] == "unknown"

    def test_register_server_all_fields_returned(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """All provided fields should be returned in response."""
        server_data = {
            "id": "omv-mediaserver",
            "hostname": "omv-mediaserver",
            "display_name": "Media Server",
            "ip_address": "192.168.1.100",
            "tdp_watts": 65,
        }
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        data = response.json()
        assert data["display_name"] == "Media Server"
        assert data["ip_address"] == "192.168.1.100"
        assert data["tdp_watts"] == 65


class TestDuplicateServer:
    """TC008: Duplicate server_id returns 409."""

    def test_duplicate_server_id_returns_409(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Registering duplicate server_id should return 409 Conflict."""
        server_data = {
            "id": "omv-mediaserver",
            "hostname": "omv-mediaserver",
        }
        # Register first time
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        # Try to register again
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.status_code == 409

    def test_duplicate_server_error_code_is_conflict(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Error code should be 'CONFLICT'."""
        server_data = {"id": "omv-mediaserver", "hostname": "omv-mediaserver"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        response = client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        assert response.json()["detail"]["code"] == "CONFLICT"


class TestGetServerDetails:
    """TC009: Get server details returns full data."""

    def test_get_server_details_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/servers/{id} should return 200 OK."""
        # First register a server
        server_data = {"id": "omv-mediaserver", "hostname": "omv-mediaserver"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/omv-mediaserver", headers=auth_headers)
        assert response.status_code == 200

    def test_get_server_details_all_fields_present(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """All server fields should be present in response."""
        server_data = {
            "id": "omv-mediaserver",
            "hostname": "omv-mediaserver",
            "display_name": "Media Server",
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/omv-mediaserver", headers=auth_headers)
        data = response.json()
        assert data["id"] == "omv-mediaserver"
        assert data["hostname"] == "omv-mediaserver"
        assert data["display_name"] == "Media Server"


class TestGetNonexistentServer:
    """TC010: Get nonexistent server returns 404."""

    def test_get_nonexistent_server_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET nonexistent server should return 404 Not Found."""
        response = client.get("/api/v1/servers/nonexistent", headers=auth_headers)
        assert response.status_code == 404

    def test_get_nonexistent_server_error_code_is_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Error code should be 'NOT_FOUND'."""
        response = client.get("/api/v1/servers/nonexistent", headers=auth_headers)
        assert response.json()["detail"]["code"] == "NOT_FOUND"


class TestUpdateServer:
    """TC011: Update server configuration."""

    def test_update_server_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PUT /api/v1/servers/{id} should return 200 OK."""
        # First register a server
        server_data = {"id": "omv-mediaserver", "hostname": "omv-mediaserver"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        update_data = {"display_name": "Updated Media Server"}
        response = client.put(
            "/api/v1/servers/omv-mediaserver", json=update_data, headers=auth_headers
        )
        assert response.status_code == 200

    def test_update_server_display_name_updated(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """display_name should be updated."""
        server_data = {"id": "omv-mediaserver", "hostname": "omv-mediaserver"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        update_data = {"display_name": "Updated Media Server"}
        response = client.put(
            "/api/v1/servers/omv-mediaserver", json=update_data, headers=auth_headers
        )
        assert response.json()["display_name"] == "Updated Media Server"

    def test_update_server_tdp_watts_updated(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """tdp_watts should be updated."""
        server_data = {"id": "omv-mediaserver", "hostname": "omv-mediaserver", "tdp_watts": 65}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        update_data = {"tdp_watts": 75}
        response = client.put(
            "/api/v1/servers/omv-mediaserver", json=update_data, headers=auth_headers
        )
        assert response.json()["tdp_watts"] == 75


class TestDeleteServer:
    """TC012: Delete server removes server and metrics."""

    def test_delete_server_returns_204(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """DELETE /api/v1/servers/{id} should return 204 No Content."""
        # First register a server
        server_data = {"id": "omv-testserver", "hostname": "omv-testserver"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.delete("/api/v1/servers/omv-testserver", headers=auth_headers)
        assert response.status_code == 204

    def test_delete_server_no_longer_exists(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server should no longer exist after deletion."""
        server_data = {"id": "omv-testserver", "hostname": "omv-testserver"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)
        client.delete("/api/v1/servers/omv-testserver", headers=auth_headers)

        response = client.get("/api/v1/servers/omv-testserver", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_server_associated_metrics_deleted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Associated metrics should be deleted with server (cascade delete)."""
        # Create server and metrics via heartbeat
        heartbeat_data = {
            "server_id": "cascade-test-server",
            "hostname": "cascade-test.local",
            "timestamp": "2026-01-18T12:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

        # Send another heartbeat to create more metrics
        heartbeat_data["timestamp"] = "2026-01-18T12:01:00Z"
        heartbeat_data["metrics"]["cpu_percent"] = 55.0
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

        # Verify server exists
        response = client.get("/api/v1/servers/cascade-test-server", headers=auth_headers)
        assert response.status_code == 200

        # Delete server (should cascade delete metrics)
        response = client.delete("/api/v1/servers/cascade-test-server", headers=auth_headers)
        assert response.status_code == 204

        # Verify server is gone
        response = client.get("/api/v1/servers/cascade-test-server", headers=auth_headers)
        assert response.status_code == 404
        # Note: Cascade delete of metrics is verified at database level
        # in test_database.py::TestServerMetricsCascadeDelete


class TestServerAuthentication:
    """TC006-TC012 shared: API authentication required."""

    def test_list_servers_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/servers without auth should return 401."""
        response = client.get("/api/v1/servers")
        assert response.status_code == 401

    def test_register_server_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/servers without auth should return 401."""
        server_data = {"id": "test", "hostname": "test"}
        response = client.post("/api/v1/servers", json=server_data)
        assert response.status_code == 401

    def test_get_server_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/servers/{id} without auth should return 401."""
        response = client.get("/api/v1/servers/test")
        assert response.status_code == 401

    def test_update_server_requires_auth(self, client: TestClient) -> None:
        """PUT /api/v1/servers/{id} without auth should return 401."""
        response = client.put("/api/v1/servers/test", json={})
        assert response.status_code == 401

    def test_delete_server_requires_auth(self, client: TestClient) -> None:
        """DELETE /api/v1/servers/{id} without auth should return 401."""
        response = client.delete("/api/v1/servers/test")
        assert response.status_code == 401


class TestServerCpuInfo:
    """Tests for CPU info in server response (US0053 - TS0012 - TC188, TC189)."""

    def test_server_response_includes_cpu_model(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC188: Server detail response should include cpu_model field."""
        # Create server with CPU info via heartbeat
        heartbeat_data = {
            "server_id": "cpu-api-test-server",
            "hostname": "cpu-api-test-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "cpu_info": {
                "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
                "cpu_cores": 4,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify cpu_model in GET response
        response = client.get("/api/v1/servers/cpu-api-test-server", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["cpu_model"] == "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"

    def test_server_response_includes_cpu_cores(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC189: Server detail response should include cpu_cores field."""
        # Create server with CPU info via heartbeat
        heartbeat_data = {
            "server_id": "cpu-cores-api-server",
            "hostname": "cpu-cores-api-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "cpu_info": {
                "cpu_model": "AMD Ryzen 7 5800X",
                "cpu_cores": 16,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify cpu_cores in GET response
        response = client.get("/api/v1/servers/cpu-cores-api-server", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["cpu_cores"] == 16

    def test_new_server_has_null_cpu_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """New server without heartbeat should have null CPU fields."""
        server_data = {
            "id": "no-heartbeat-cpu-server",
            "hostname": "no-heartbeat-cpu-server",
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/no-heartbeat-cpu-server", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["cpu_model"] is None
        assert response.json()["cpu_cores"] is None

    def test_server_list_includes_cpu_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server list response should include cpu_model and cpu_cores."""
        # Create server with CPU info
        heartbeat_data = {
            "server_id": "cpu-list-server",
            "hostname": "cpu-list-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "cpu_info": {
                "cpu_model": "Intel Xeon E5-2680",
                "cpu_cores": 24,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify fields in list response
        list_response = client.get("/api/v1/servers", headers=auth_headers)
        servers = list_response.json()["servers"]
        server = next(s for s in servers if s["id"] == "cpu-list-server")
        assert server["cpu_model"] == "Intel Xeon E5-2680"
        assert server["cpu_cores"] == 24


class TestServerMachineCategory:
    """Tests for machine category in server response (US0054 - TS0013 - TC218, TC219)."""

    def test_server_response_includes_machine_category(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC218: Server detail response should include machine_category field."""
        # Create server with CPU info via heartbeat (triggers auto-detection)
        heartbeat_data = {
            "server_id": "category-api-test-server",
            "hostname": "category-api-test-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "os_info": {"architecture": "x86_64"},
            "cpu_info": {
                "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
                "cpu_cores": 4,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify machine_category in GET response
        response = client.get("/api/v1/servers/category-api-test-server", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["machine_category"] == "office_laptop"

    def test_server_response_includes_machine_category_source(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC219: Server detail response should include machine_category_source field."""
        # Create server with CPU info via heartbeat (triggers auto-detection)
        heartbeat_data = {
            "server_id": "category-source-api-server",
            "hostname": "category-source-api-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "os_info": {"architecture": "x86_64"},
            "cpu_info": {
                "cpu_model": "Intel(R) Xeon(R) CPU E5-2680 v4",
                "cpu_cores": 28,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify machine_category_source in GET response
        response = client.get("/api/v1/servers/category-source-api-server", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["machine_category_source"] == "auto"

    def test_new_server_has_null_category_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """New server without heartbeat should have null category fields."""
        server_data = {
            "id": "no-category-server",
            "hostname": "no-category-server",
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/no-category-server", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["machine_category"] is None
        assert response.json()["machine_category_source"] is None

    def test_server_list_includes_category_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server list response should include machine_category and source."""
        # Create server with CPU info
        heartbeat_data = {
            "server_id": "category-list-server",
            "hostname": "category-list-server",
            "timestamp": "2026-01-20T10:30:00Z",
            "os_info": {"architecture": "aarch64"},
            "cpu_info": {
                "cpu_model": "Raspberry Pi 4 Model B",
                "cpu_cores": 4,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        # Verify fields in list response
        list_response = client.get("/api/v1/servers", headers=auth_headers)
        servers = list_response.json()["servers"]
        server = next(s for s in servers if s["id"] == "category-list-server")
        assert server["machine_category"] == "sbc"
        assert server["machine_category_source"] == "auto"

    def test_server_response_includes_idle_watts(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server detail response should include idle_watts field."""
        # Create server - idle_watts should be null initially
        server_data = {
            "id": "idle-watts-api-server",
            "hostname": "idle-watts-api-server",
        }
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/idle-watts-api-server", headers=auth_headers)
        assert response.status_code == 200
        assert "idle_watts" in response.json()
        assert response.json()["idle_watts"] is None


class TestPauseServer:
    """Tests for PUT /api/v1/servers/{server_id}/pause (maintenance mode)."""

    def test_pause_server_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Pause server should return 200 OK."""
        create_server(client, auth_headers, "test-pause")
        response = client.put("/api/v1/servers/test-pause/pause", headers=auth_headers)
        assert response.status_code == 200

    def test_pause_server_sets_is_paused_true(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Pausing server should set is_paused to true."""
        create_server(client, auth_headers, "test-pause-flag")
        response = client.put("/api/v1/servers/test-pause-flag/pause", headers=auth_headers)
        assert response.json()["is_paused"] is True

    def test_pause_server_sets_paused_at_timestamp(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Pausing server should set paused_at timestamp."""
        create_server(client, auth_headers, "test-pause-ts")
        response = client.put("/api/v1/servers/test-pause-ts/pause", headers=auth_headers)
        assert response.json()["paused_at"] is not None

    def test_pause_server_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.put("/api/v1/servers/nonexistent/pause", headers=auth_headers)
        assert response.status_code == 404
        assert "NOT_FOUND" in response.json()["detail"]["code"]

    def test_pause_server_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.put("/api/v1/servers/any-server/pause")
        assert response.status_code == 401


class TestUnpauseServer:
    """Tests for PUT /api/v1/servers/{server_id}/unpause."""

    def test_unpause_server_returns_200(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Unpause server should return 200 OK."""
        create_server(client, auth_headers, "test-unpause")
        client.put("/api/v1/servers/test-unpause/pause", headers=auth_headers)
        response = client.put("/api/v1/servers/test-unpause/unpause", headers=auth_headers)
        assert response.status_code == 200

    def test_unpause_server_sets_is_paused_false(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Unpausing server should set is_paused to false."""
        create_server(client, auth_headers, "test-unpause-flag")
        client.put("/api/v1/servers/test-unpause-flag/pause", headers=auth_headers)
        response = client.put("/api/v1/servers/test-unpause-flag/unpause", headers=auth_headers)
        assert response.json()["is_paused"] is False

    def test_unpause_server_clears_paused_at_timestamp(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Unpausing server should clear paused_at timestamp."""
        create_server(client, auth_headers, "test-unpause-ts")
        client.put("/api/v1/servers/test-unpause-ts/pause", headers=auth_headers)
        response = client.put("/api/v1/servers/test-unpause-ts/unpause", headers=auth_headers)
        assert response.json()["paused_at"] is None

    def test_unpause_server_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.put("/api/v1/servers/nonexistent/unpause", headers=auth_headers)
        assert response.status_code == 404

    def test_unpause_server_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.put("/api/v1/servers/any-server/unpause")
        assert response.status_code == 401


class TestListServerActions:
    """Tests for GET /api/v1/servers/{server_id}/actions."""

    def test_list_server_actions_returns_empty_for_new_server(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Server with no actions returns empty array."""
        create_server(client, auth_headers, "test-actions-empty")
        response = client.get("/api/v1/servers/test-actions-empty/actions", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["actions"] == []
        assert response.json()["total"] == 0

    def test_list_server_actions_returns_all_actions(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Returns all actions for a server."""
        create_server(client, auth_headers, "test-actions-list")
        client.put("/api/v1/servers/test-actions-list/pause", headers=auth_headers)

        # Create some actions
        client.post(
            "/api/v1/servers/test-actions-list/services/nginx/restart", headers=auth_headers
        )
        client.post(
            "/api/v1/servers/test-actions-list/services/docker/restart", headers=auth_headers
        )

        response = client.get("/api/v1/servers/test-actions-list/actions", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["total"] == 2
        assert len(response.json()["actions"]) == 2

    def test_list_server_actions_filter_by_status(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Can filter actions by status."""
        create_server(client, auth_headers, "test-actions-filter")
        client.put("/api/v1/servers/test-actions-filter/pause", headers=auth_headers)

        # Create pending action
        client.post(
            "/api/v1/servers/test-actions-filter/services/nginx/restart", headers=auth_headers
        )

        # Filter by pending status
        response = client.get(
            "/api/v1/servers/test-actions-filter/actions?status=pending",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert all(a["status"] == "pending" for a in response.json()["actions"])

    def test_list_server_actions_pagination(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Supports pagination with limit and offset."""
        create_server(client, auth_headers, "test-actions-page")
        client.put("/api/v1/servers/test-actions-page/pause", headers=auth_headers)

        # Create 3 actions
        for i in range(3):
            client.post(
                f"/api/v1/servers/test-actions-page/services/service{i}/restart",
                headers=auth_headers,
            )

        # Get with limit
        response = client.get(
            "/api/v1/servers/test-actions-page/actions?limit=2&offset=0",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()["actions"]) == 2
        assert response.json()["total"] == 3
        assert response.json()["limit"] == 2
        assert response.json()["offset"] == 0

    def test_list_server_actions_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.get("/api/v1/servers/nonexistent/actions", headers=auth_headers)
        assert response.status_code == 404

    def test_list_server_actions_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.get("/api/v1/servers/any-server/actions")
        assert response.status_code == 401


class TestGetServerPackages:
    """Tests for GET /api/v1/servers/{server_id}/packages."""

    def test_get_packages_returns_empty_for_new_server(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Server with no packages returns empty list."""
        create_server(client, auth_headers, "test-pkg-empty")
        response = client.get("/api/v1/servers/test-pkg-empty/packages", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["packages"] == []
        assert response.json()["total_count"] == 0
        assert response.json()["security_count"] == 0

    def test_get_packages_returns_pending_packages(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Returns pending packages from heartbeat."""
        send_heartbeat(
            client,
            auth_headers,
            "test-pkg-list",
            packages=[
                {
                    "name": "openssl",
                    "current_version": "1.0.0",
                    "new_version": "1.1.0",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "vim",
                    "current_version": "8.0",
                    "new_version": "8.2",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        )
        response = client.get("/api/v1/servers/test-pkg-list/packages", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["total_count"] == 2
        assert response.json()["security_count"] == 1
        pkg_names = [p["name"] for p in response.json()["packages"]]
        assert "openssl" in pkg_names
        assert "vim" in pkg_names

    def test_get_packages_includes_security_flag(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Packages include is_security flag."""
        send_heartbeat(
            client,
            auth_headers,
            "test-pkg-security",
            packages=[
                {
                    "name": "openssl",
                    "current_version": "1.0.0",
                    "new_version": "1.1.0",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
            ],
        )
        response = client.get("/api/v1/servers/test-pkg-security/packages", headers=auth_headers)
        assert response.status_code == 200
        pkg = response.json()["packages"][0]
        assert pkg["is_security"] is True

    def test_get_packages_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 when server doesn't exist."""
        response = client.get("/api/v1/servers/nonexistent/packages", headers=auth_headers)
        assert response.status_code == 404

    def test_get_packages_requires_auth(self, client: TestClient) -> None:
        """Returns 401 without authentication."""
        response = client.get("/api/v1/servers/any-server/packages")
        assert response.status_code == 401


class TestListServersWithMetrics:
    """Tests for list servers including latest metrics."""

    def test_list_servers_includes_latest_metrics(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """List servers should include latest_metrics when available."""
        send_heartbeat(
            client,
            auth_headers,
            "test-metrics-server",
            metrics={
                "cpu_percent": 45.5,
                "memory_percent": 60.0,
                "disk_percent": 75.0,
            },
        )
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert response.status_code == 200
        servers = response.json()["servers"]
        server = next(s for s in servers if s["id"] == "test-metrics-server")
        assert server["latest_metrics"] is not None
        assert server["latest_metrics"]["cpu_percent"] == 45.5
        assert server["latest_metrics"]["memory_percent"] == 60.0
        assert server["latest_metrics"]["disk_percent"] == 75.0

    def test_list_servers_no_metrics_for_new_server(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """New server without heartbeat has null latest_metrics."""
        create_server(client, auth_headers, "test-no-metrics")
        response = client.get("/api/v1/servers", headers=auth_headers)
        servers = response.json()["servers"]
        server = next(s for s in servers if s["id"] == "test-no-metrics")
        assert server["latest_metrics"] is None

    def test_list_servers_multiple_with_metrics(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """Multiple servers each get their own latest metrics (BG0020 regression test).

        This verifies that the optimised single-query approach correctly associates
        each server with its own latest metrics, not mixing them up.
        """
        # Create 3 servers with different metrics
        send_heartbeat(
            client,
            auth_headers,
            "server-a",
            metrics={"cpu_percent": 10.0, "memory_percent": 20.0, "disk_percent": 30.0},
        )
        send_heartbeat(
            client,
            auth_headers,
            "server-b",
            metrics={"cpu_percent": 40.0, "memory_percent": 50.0, "disk_percent": 60.0},
        )
        send_heartbeat(
            client,
            auth_headers,
            "server-c",
            metrics={"cpu_percent": 70.0, "memory_percent": 80.0, "disk_percent": 90.0},
        )

        response = client.get("/api/v1/servers", headers=auth_headers)
        assert response.status_code == 200
        servers = {s["id"]: s for s in response.json()["servers"]}

        # Each server should have its own metrics, not mixed up
        assert servers["server-a"]["latest_metrics"]["cpu_percent"] == 10.0
        assert servers["server-a"]["latest_metrics"]["memory_percent"] == 20.0

        assert servers["server-b"]["latest_metrics"]["cpu_percent"] == 40.0
        assert servers["server-b"]["latest_metrics"]["memory_percent"] == 50.0

        assert servers["server-c"]["latest_metrics"]["cpu_percent"] == 70.0
        assert servers["server-c"]["latest_metrics"]["memory_percent"] == 80.0

    def test_list_servers_latest_metrics_is_newest(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """latest_metrics should be from the most recent heartbeat (BG0020 regression test).

        Verifies that when a server has multiple metrics records, the latest one is returned.
        """
        import time

        # Send first heartbeat
        send_heartbeat(
            client,
            auth_headers,
            "server-updates",
            metrics={"cpu_percent": 25.0, "memory_percent": 35.0, "disk_percent": 45.0},
        )

        # Brief pause to ensure timestamp difference
        time.sleep(0.01)

        # Send second heartbeat with updated metrics
        send_heartbeat(
            client,
            auth_headers,
            "server-updates",
            metrics={"cpu_percent": 99.0, "memory_percent": 88.0, "disk_percent": 77.0},
        )

        response = client.get("/api/v1/servers", headers=auth_headers)
        servers = {s["id"]: s for s in response.json()["servers"]}

        # Should have the latest metrics (99, 88, 77), not the old ones (25, 35, 45)
        assert servers["server-updates"]["latest_metrics"]["cpu_percent"] == 99.0
        assert servers["server-updates"]["latest_metrics"]["memory_percent"] == 88.0
        assert servers["server-updates"]["latest_metrics"]["disk_percent"] == 77.0
