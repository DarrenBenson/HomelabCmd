"""Tests for Metrics History API (TSP0006: TC077).

These tests verify the metrics time-series endpoint for historical charts.

Spec Reference: sdlc-studio/testing/specs/TSP0006-server-detail-charts.md
"""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


class TestMetricsHistoryEndpoint:
    """TC077: Metrics API returns time-series data."""

    def _create_server_with_metrics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        metrics_count: int = 5,
    ) -> None:
        """Helper to create a server with historical metrics via heartbeats."""
        base_time = datetime.now(UTC) - timedelta(hours=metrics_count)
        for i in range(metrics_count):
            heartbeat_data = {
                "server_id": server_id,
                "hostname": f"{server_id}.local",
                "timestamp": (base_time + timedelta(hours=i)).isoformat(),
                "metrics": {
                    "cpu_percent": 20.0 + (i * 5),
                    "memory_percent": 50.0 + (i * 2),
                    "disk_percent": 45.0,
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

    def test_metrics_history_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /servers/{id}/metrics should return 200 with valid data."""
        self._create_server_with_metrics(client, auth_headers, "metrics-history-server")

        response = client.get(
            "/api/v1/servers/metrics-history-server/metrics",
            headers=auth_headers,
        )

        assert response.status_code == 200

    def test_metrics_history_returns_server_id(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should include server_id field."""
        self._create_server_with_metrics(client, auth_headers, "server-id-test")

        response = client.get(
            "/api/v1/servers/server-id-test/metrics",
            headers=auth_headers,
        )
        data = response.json()

        assert "server_id" in data
        assert data["server_id"] == "server-id-test"

    def test_metrics_history_returns_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should include range field matching request."""
        self._create_server_with_metrics(client, auth_headers, "range-test-server")

        response = client.get(
            "/api/v1/servers/range-test-server/metrics?range=24h",
            headers=auth_headers,
        )
        data = response.json()

        assert "range" in data
        assert data["range"] == "24h"

    def test_metrics_history_returns_resolution(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should include resolution indicating aggregation level."""
        self._create_server_with_metrics(client, auth_headers, "resolution-test")

        response = client.get(
            "/api/v1/servers/resolution-test/metrics?range=24h",
            headers=auth_headers,
        )
        data = response.json()

        assert "resolution" in data
        assert data["resolution"] == "1m"  # 24h uses raw data

    def test_metrics_history_returns_data_points_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should include data_points array."""
        self._create_server_with_metrics(client, auth_headers, "data-points-server")

        response = client.get(
            "/api/v1/servers/data-points-server/metrics",
            headers=auth_headers,
        )
        data = response.json()

        assert "data_points" in data
        assert isinstance(data["data_points"], list)

    def test_metrics_history_data_point_has_timestamp(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Each data point should have a timestamp."""
        self._create_server_with_metrics(client, auth_headers, "timestamp-test")

        response = client.get(
            "/api/v1/servers/timestamp-test/metrics",
            headers=auth_headers,
        )
        data = response.json()

        assert len(data["data_points"]) > 0
        for point in data["data_points"]:
            assert "timestamp" in point

    def test_metrics_history_data_point_has_metrics(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Each data point should have cpu, memory, and disk metrics."""
        self._create_server_with_metrics(client, auth_headers, "metrics-fields-test")

        response = client.get(
            "/api/v1/servers/metrics-fields-test/metrics",
            headers=auth_headers,
        )
        data = response.json()

        assert len(data["data_points"]) > 0
        for point in data["data_points"]:
            assert "cpu_percent" in point
            assert "memory_percent" in point
            assert "disk_percent" in point

    def test_metrics_history_returns_total_points(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should include total_points count."""
        self._create_server_with_metrics(
            client, auth_headers, "total-points-server", metrics_count=3
        )

        response = client.get(
            "/api/v1/servers/total-points-server/metrics",
            headers=auth_headers,
        )
        data = response.json()

        assert "total_points" in data
        assert data["total_points"] == len(data["data_points"])

    def test_metrics_history_7d_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """7d range should return hourly resolution."""
        self._create_server_with_metrics(client, auth_headers, "seven-day-server")

        response = client.get(
            "/api/v1/servers/seven-day-server/metrics?range=7d",
            headers=auth_headers,
        )
        data = response.json()

        assert data["range"] == "7d"
        assert data["resolution"] == "1h"

    def test_metrics_history_30d_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """30d range should return 1h resolution (queries hourly table)."""
        self._create_server_with_metrics(client, auth_headers, "thirty-day-server")

        response = client.get(
            "/api/v1/servers/thirty-day-server/metrics?range=30d",
            headers=auth_headers,
        )
        data = response.json()

        assert data["range"] == "30d"
        assert data["resolution"] == "1h"

    def test_metrics_history_requires_auth(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Endpoint should require authentication."""
        self._create_server_with_metrics(client, auth_headers, "auth-test-server")

        response = client.get("/api/v1/servers/auth-test-server/metrics")

        assert response.status_code == 401

    def test_metrics_history_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return 404 for nonexistent server."""
        response = client.get(
            "/api/v1/servers/nonexistent-server/metrics",
            headers=auth_headers,
        )

        assert response.status_code == 404

    def test_metrics_history_empty_for_no_data(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return empty data_points when no metrics exist."""
        # Create server without metrics
        server_data = {"id": "no-metrics-history", "hostname": "no-metrics.local"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get(
            "/api/v1/servers/no-metrics-history/metrics",
            headers=auth_headers,
        )
        data = response.json()

        assert response.status_code == 200
        assert data["data_points"] == []
        assert data["total_points"] == 0

    def test_metrics_history_data_ordered_by_timestamp(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Data points should be ordered by timestamp ascending."""
        self._create_server_with_metrics(client, auth_headers, "ordered-test", metrics_count=5)

        response = client.get(
            "/api/v1/servers/ordered-test/metrics",
            headers=auth_headers,
        )
        data = response.json()

        timestamps = [point["timestamp"] for point in data["data_points"]]
        assert timestamps == sorted(timestamps)
