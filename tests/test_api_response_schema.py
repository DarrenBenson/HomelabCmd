"""Tests for API Response Schema Validation.

These tests verify that API responses contain all expected fields that the
frontend depends on. This catches bugs where the backend stores data but
doesn't return it in the API response (like the uptime_seconds bug).

Gap Analysis:
- AC4 (US0005) requires metrics display including uptime
- Frontend expects latest_metrics to contain: cpu_percent, memory_percent,
  disk_percent, uptime_seconds
- Without these tests, the backend could store data correctly but not
  expose it in the API, breaking the frontend silently

Spec Reference: sdlc-studio/testing/specs/TSP0003-dashboard-frontend.md
"""

from fastapi.testclient import TestClient


class TestServerListResponseSchema:
    """Verify GET /api/v1/servers response contains expected fields."""

    def test_server_list_response_has_servers_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should have 'servers' array."""
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert "servers" in response.json()
        assert isinstance(response.json()["servers"], list)

    def test_server_list_response_has_total(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should have 'total' count."""
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert "total" in response.json()
        assert isinstance(response.json()["total"], int)


class TestServerResponseSchema:
    """Verify individual server response contains all expected fields."""

    def test_server_response_has_all_required_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server response should have all fields expected by frontend."""
        # Create a server
        server_data = {"id": "schema-test-server", "hostname": "schema-test.local"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/schema-test-server", headers=auth_headers)
        data = response.json()

        # Required fields
        assert "id" in data
        assert "hostname" in data
        assert "status" in data
        assert "created_at" in data
        assert "updated_at" in data

        # Optional fields should be present (even if null)
        assert "display_name" in data
        assert "ip_address" in data
        assert "last_seen" in data
        assert "latest_metrics" in data

    def test_server_in_list_has_same_schema_as_individual(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server in list should have same fields as individual GET."""
        # Create a server
        server_data = {"id": "list-schema-server", "hostname": "list-schema.local"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        # Get individual
        individual = client.get("/api/v1/servers/list-schema-server", headers=auth_headers).json()

        # Get from list
        list_response = client.get("/api/v1/servers", headers=auth_headers).json()
        from_list = next(s for s in list_response["servers"] if s["id"] == "list-schema-server")

        # Same keys should be present
        assert set(individual.keys()) == set(from_list.keys())


class TestLatestMetricsResponseSchema:
    """Verify latest_metrics contains all fields expected by frontend (AC4)."""

    def _create_server_with_full_metrics(
        self, client: TestClient, auth_headers: dict[str, str], server_id: str
    ) -> None:
        """Helper to create a server with complete metrics via heartbeat."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-18T12:00:00Z",
            "metrics": {
                "cpu_percent": 45.5,
                "memory_percent": 67.2,
                "disk_percent": 82.0,
                "uptime_seconds": 86400,
                "load_1m": 1.5,
                "load_5m": 1.2,
                "load_15m": 0.9,
            },
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

    def test_latest_metrics_includes_cpu_percent(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should include cpu_percent (AC4)."""
        self._create_server_with_full_metrics(client, auth_headers, "cpu-test-server")

        response = client.get("/api/v1/servers/cpu-test-server", headers=auth_headers)
        metrics = response.json()["latest_metrics"]

        assert metrics is not None
        assert "cpu_percent" in metrics
        assert metrics["cpu_percent"] == 45.5

    def test_latest_metrics_includes_memory_percent(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should include memory_percent (AC4)."""
        self._create_server_with_full_metrics(client, auth_headers, "mem-test-server")

        response = client.get("/api/v1/servers/mem-test-server", headers=auth_headers)
        metrics = response.json()["latest_metrics"]

        assert metrics is not None
        assert "memory_percent" in metrics
        assert metrics["memory_percent"] == 67.2

    def test_latest_metrics_includes_disk_percent(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should include disk_percent (AC4)."""
        self._create_server_with_full_metrics(client, auth_headers, "disk-test-server")

        response = client.get("/api/v1/servers/disk-test-server", headers=auth_headers)
        metrics = response.json()["latest_metrics"]

        assert metrics is not None
        assert "disk_percent" in metrics
        assert metrics["disk_percent"] == 82.0

    def test_latest_metrics_includes_uptime_seconds(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should include uptime_seconds (AC4).

        This test catches the bug where uptime was stored but not returned
        in the API response, causing the frontend to show "--" for uptime.
        """
        self._create_server_with_full_metrics(client, auth_headers, "uptime-test-server")

        response = client.get("/api/v1/servers/uptime-test-server", headers=auth_headers)
        metrics = response.json()["latest_metrics"]

        assert metrics is not None
        assert "uptime_seconds" in metrics, "uptime_seconds missing from latest_metrics"
        assert metrics["uptime_seconds"] == 86400

    def test_latest_metrics_in_server_list_includes_uptime(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics in server list should also include uptime_seconds.

        Both GET /servers and GET /servers/{id} should return the same schema.
        """
        self._create_server_with_full_metrics(client, auth_headers, "list-uptime-server")

        response = client.get("/api/v1/servers", headers=auth_headers)
        servers = response.json()["servers"]

        server = next(s for s in servers if s["id"] == "list-uptime-server")
        metrics = server["latest_metrics"]

        assert metrics is not None
        assert "uptime_seconds" in metrics, "uptime_seconds missing from list response"
        assert metrics["uptime_seconds"] == 86400

    def test_latest_metrics_is_null_when_no_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should be null when server has no metrics."""
        # Register server without heartbeat
        server_data = {"id": "no-metrics-server", "hostname": "no-metrics.local"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get("/api/v1/servers/no-metrics-server", headers=auth_headers)
        assert response.json()["latest_metrics"] is None

    def test_latest_metrics_partial_when_metrics_partial(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should handle partial metrics gracefully."""
        # Send heartbeat with only CPU
        heartbeat_data = {
            "server_id": "partial-metrics-server",
            "hostname": "partial.local",
            "timestamp": "2026-01-18T12:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        response = client.get("/api/v1/servers/partial-metrics-server", headers=auth_headers)
        metrics = response.json()["latest_metrics"]

        assert metrics is not None
        assert metrics["cpu_percent"] == 50.0
        # Other fields should be null, not missing
        assert "memory_percent" in metrics
        assert "disk_percent" in metrics
        assert "uptime_seconds" in metrics


class TestMetricsUpdatedOnHeartbeat:
    """Verify that sending a heartbeat updates the latest_metrics correctly."""

    def test_metrics_reflect_latest_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """latest_metrics should reflect the most recent heartbeat."""
        server_id = "metrics-update-server"

        # First heartbeat
        heartbeat1 = {
            "server_id": server_id,
            "hostname": "update.local",
            "timestamp": "2026-01-18T12:00:00Z",
            "metrics": {
                "cpu_percent": 25.0,
                "memory_percent": 50.0,
                "disk_percent": 75.0,
                "uptime_seconds": 3600,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat1, headers=auth_headers)

        # Verify first values
        response = client.get(f"/api/v1/servers/{server_id}", headers=auth_headers)
        metrics = response.json()["latest_metrics"]
        assert metrics["cpu_percent"] == 25.0
        assert metrics["uptime_seconds"] == 3600

        # Second heartbeat with updated values
        heartbeat2 = {
            "server_id": server_id,
            "hostname": "update.local",
            "timestamp": "2026-01-18T12:01:00Z",
            "metrics": {
                "cpu_percent": 75.0,
                "memory_percent": 80.0,
                "disk_percent": 76.0,
                "uptime_seconds": 3660,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat2, headers=auth_headers)

        # Verify updated values
        response = client.get(f"/api/v1/servers/{server_id}", headers=auth_headers)
        metrics = response.json()["latest_metrics"]
        assert metrics["cpu_percent"] == 75.0
        assert metrics["uptime_seconds"] == 3660


class TestFrontendContractCompliance:
    """Verify API response matches frontend TypeScript types.

    These tests ensure the backend response matches what the frontend expects
    based on frontend/src/types/server.ts
    """

    def test_server_response_matches_frontend_type(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should match frontend Server type structure."""
        # Create server with metrics
        heartbeat = {
            "server_id": "contract-test-server",
            "hostname": "contract.local",
            "timestamp": "2026-01-18T12:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
                "uptime_seconds": 86400,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat, headers=auth_headers)

        response = client.get("/api/v1/servers/contract-test-server", headers=auth_headers)
        data = response.json()

        # Verify structure matches frontend/src/types/server.ts Server interface
        assert isinstance(data["id"], str)
        assert isinstance(data["hostname"], str)
        assert data["display_name"] is None or isinstance(data["display_name"], str)
        assert data["status"] in ["online", "offline", "unknown"]

        # Verify latest_metrics matches LatestMetrics interface
        metrics = data["latest_metrics"]
        assert metrics is not None
        assert isinstance(metrics["cpu_percent"], (int, float)) or metrics["cpu_percent"] is None
        assert (
            isinstance(metrics["memory_percent"], (int, float)) or metrics["memory_percent"] is None
        )
        assert isinstance(metrics["disk_percent"], (int, float)) or metrics["disk_percent"] is None
        assert isinstance(metrics["uptime_seconds"], int) or metrics["uptime_seconds"] is None

    def test_servers_response_matches_frontend_type(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should match frontend ServersResponse type structure."""
        # Create a server
        heartbeat = {
            "server_id": "list-contract-server",
            "hostname": "list-contract.local",
            "timestamp": "2026-01-18T12:00:00Z",
            "metrics": {"cpu_percent": 50.0},
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat, headers=auth_headers)

        response = client.get("/api/v1/servers", headers=auth_headers)
        data = response.json()

        # Verify structure matches frontend/src/types/server.ts ServersResponse
        assert "servers" in data
        assert "total" in data
        assert isinstance(data["servers"], list)
        assert isinstance(data["total"], int)
        assert data["total"] == len(data["servers"])
