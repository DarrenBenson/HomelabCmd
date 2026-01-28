"""Tests for metrics export endpoint (US0048).

Test Cases:
- TC0048-001: CSV export returns valid format
- TC0048-002: JSON export returns valid format
- TC0048-003: Export respects time range
- TC0048-004: Export filename format
- TC0048-005: Export 12m uses daily tier format
- TC0048-006: Export empty data returns headers
- TC0048-007: Export non-existent server returns 404
- TC0048-008: Export JSON contains server name

Spec Reference: sdlc-studio/testing/specs/TSP0048-metrics-data-export.md
"""

import re
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


class TestMetricsExportCSV:
    """Tests for CSV export functionality (AC2)."""

    def _create_server_with_metrics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        metrics_count: int = 10,
    ) -> None:
        """Helper to create a server with historical metrics via heartbeats."""
        base_time = datetime.now(UTC) - timedelta(hours=metrics_count)
        for i in range(metrics_count):
            heartbeat_data = {
                "server_id": server_id,
                "hostname": f"{server_id}.local",
                "timestamp": (base_time + timedelta(hours=i)).isoformat(),
                "metrics": {
                    "cpu_percent": 40.0 + i,
                    "memory_percent": 60.0 + (i * 0.5),
                    "disk_percent": 30.0,
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

    def test_export_csv_returns_valid_format(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-001: CSV export contains proper headers and data."""
        self._create_server_with_metrics(client, auth_headers, "export-csv-server")

        response = client.get(
            "/api/v1/servers/export-csv-server/metrics/export",
            params={"range": "24h", "format": "csv"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers["content-disposition"]

        lines = response.text.strip().split("\n")
        header = lines[0]
        assert "timestamp" in header
        assert "cpu_percent" in header
        assert "memory_percent" in header
        assert "disk_percent" in header
        assert len(lines) > 1  # Has data rows

    def test_export_csv_data_rows(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV export contains data rows."""
        self._create_server_with_metrics(
            client, auth_headers, "export-csv-rows-server", metrics_count=5
        )

        response = client.get(
            "/api/v1/servers/export-csv-rows-server/metrics/export",
            params={"range": "24h", "format": "csv"},
            headers=auth_headers,
        )

        lines = response.text.strip().split("\n")
        # Header + data rows (5 metrics)
        assert len(lines) == 1 + 5


class TestMetricsExportJSON:
    """Tests for JSON export functionality (AC3)."""

    def _create_server_with_metrics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        metrics_count: int = 10,
    ) -> None:
        """Helper to create a server with historical metrics via heartbeats."""
        base_time = datetime.now(UTC) - timedelta(hours=metrics_count)
        for i in range(metrics_count):
            heartbeat_data = {
                "server_id": server_id,
                "hostname": f"{server_id}.local",
                "display_name": f"Test Server {server_id}",
                "timestamp": (base_time + timedelta(hours=i)).isoformat(),
                "metrics": {
                    "cpu_percent": 40.0 + i,
                    "memory_percent": 60.0 + (i * 0.5),
                    "disk_percent": 30.0,
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

    def test_export_json_returns_valid_format(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-002: JSON export contains required fields."""
        self._create_server_with_metrics(client, auth_headers, "export-json-server")

        response = client.get(
            "/api/v1/servers/export-json-server/metrics/export",
            params={"range": "24h", "format": "json"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

        data = response.json()
        assert data["server_id"] == "export-json-server"
        assert data["range"] == "24h"
        assert "exported_at" in data
        assert "data_points" in data
        assert isinstance(data["data_points"], list)

    def test_export_json_contains_server_name(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-008: JSON export includes server display name."""
        self._create_server_with_metrics(client, auth_headers, "export-name-server")

        response = client.get(
            "/api/v1/servers/export-name-server/metrics/export",
            params={"range": "24h", "format": "json"},
            headers=auth_headers,
        )

        data = response.json()
        assert "server_name" in data
        # Server name comes from heartbeat data or hostname


class TestMetricsExportTimeRange:
    """Tests for time range handling (AC4)."""

    def _create_server_with_metrics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        hours_ago: int,
    ) -> None:
        """Create metrics at a specific time."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": (datetime.now(UTC) - timedelta(hours=hours_ago)).isoformat(),
            "metrics": {
                "cpu_percent": 45.0,
                "memory_percent": 65.0,
                "disk_percent": 30.0,
            },
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

    def test_export_respects_time_range(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-003: Export returns only data within requested range."""
        server_id = "export-range-server"

        # Create 2 points within 24h
        self._create_server_with_metrics(client, auth_headers, server_id, hours_ago=1)
        self._create_server_with_metrics(client, auth_headers, server_id, hours_ago=12)
        # Create 1 point outside 24h (2 days ago)
        self._create_server_with_metrics(client, auth_headers, server_id, hours_ago=48)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "json"},
            headers=auth_headers,
        )

        data = response.json()
        assert len(data["data_points"]) == 2  # Only recent, not old


class TestMetricsExportFilename:
    """Tests for filename format (AC5)."""

    def _create_server_with_metrics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
    ) -> None:
        """Helper to create a server with historical metrics via heartbeats."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": datetime.now(UTC).isoformat(),
            "metrics": {
                "cpu_percent": 45.0,
                "memory_percent": 65.0,
                "disk_percent": 30.0,
            },
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

    def test_export_filename_format_csv(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-004: Filename follows pattern for CSV."""
        server_id = "filename-csv-server"
        self._create_server_with_metrics(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "30d", "format": "csv"},
            headers=auth_headers,
        )

        content_disposition = response.headers["content-disposition"]
        # Should match: filename-csv-server-metrics-30d-2026-01-21.csv
        assert server_id in content_disposition
        assert "30d" in content_disposition
        assert ".csv" in content_disposition
        assert re.search(r"\d{4}-\d{2}-\d{2}", content_disposition)

    def test_export_filename_format_json(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Filename follows pattern for JSON."""
        server_id = "filename-json-server"
        self._create_server_with_metrics(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "7d", "format": "json"},
            headers=auth_headers,
        )

        content_disposition = response.headers["content-disposition"]
        assert server_id in content_disposition
        assert "7d" in content_disposition
        assert ".json" in content_disposition


class TestMetricsExportTiers:
    """Tests for data tier selection."""

    def _create_server_with_metrics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
    ) -> None:
        """Helper to create a server with historical metrics via heartbeats."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": datetime.now(UTC).isoformat(),
            "metrics": {
                "cpu_percent": 45.0,
                "memory_percent": 65.0,
                "disk_percent": 30.0,
            },
        }
        response = client.post(
            "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
        )
        assert response.status_code == 200

    def test_export_24h_uses_raw_format(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """24-hour export uses simple raw format."""
        server_id = "tier-24h-server"
        self._create_server_with_metrics(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "csv"},
            headers=auth_headers,
        )

        lines = response.text.strip().split("\n")
        header = lines[0]
        assert "cpu_percent" in header
        assert "memory_percent" in header
        assert "disk_percent" in header
        # Should NOT have aggregate columns
        assert "cpu_avg" not in header
        assert "cpu_min" not in header

    def test_export_30d_uses_hourly_format(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """30-day export uses hourly aggregate format with avg/min/max columns."""
        server_id = "tier-30d-server"
        self._create_server_with_metrics(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "30d", "format": "csv"},
            headers=auth_headers,
        )

        lines = response.text.strip().split("\n")
        header = lines[0]
        # 30d tier uses HOURLY table which has aggregate columns
        assert "cpu_avg" in header
        assert "cpu_min" in header
        assert "cpu_max" in header

    def test_export_12m_uses_daily_format(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """12-month export uses daily aggregate format with avg/min/max columns."""
        server_id = "tier-12m-server"
        self._create_server_with_metrics(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "12m", "format": "csv"},
            headers=auth_headers,
        )

        lines = response.text.strip().split("\n")
        header = lines[0]
        # 12m tier uses DAILY table which has aggregate columns
        assert "cpu_avg" in header
        assert "cpu_min" in header
        assert "cpu_max" in header


class TestMetricsExportEdgeCases:
    """Tests for edge cases."""

    def _create_server_only(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
    ) -> None:
        """Create a server without metrics."""
        data = {
            "id": server_id,
            "hostname": f"{server_id}.local",
            "display_name": f"Test Server {server_id}",
        }
        response = client.post("/api/v1/servers", json=data, headers=auth_headers)
        assert response.status_code == 201  # Created

    def test_export_empty_data_returns_headers_csv(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-006: Export with no data returns file with headers only."""
        server_id = "empty-data-server"
        self._create_server_only(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "csv"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        lines = response.text.strip().split("\n")
        assert len(lines) == 1  # Header only
        assert "timestamp" in lines[0]

    def test_export_empty_data_returns_empty_array_json(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """JSON export with no data returns empty data_points array."""
        server_id = "empty-json-server"
        self._create_server_only(client, auth_headers, server_id)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "json"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data_points"] == []

    def test_export_nonexistent_server_returns_404(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """TC0048-007: Export for non-existent server returns 404."""
        response = client.get(
            "/api/v1/servers/nonexistent-export-server/metrics/export",
            params={"range": "24h", "format": "csv"},
            headers=auth_headers,
        )

        assert response.status_code == 404

    def test_export_invalid_format_returns_422(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Invalid format parameter returns validation error."""
        # Create a server first
        self._create_server_only(client, auth_headers, "invalid-format-server")

        response = client.get(
            "/api/v1/servers/invalid-format-server/metrics/export",
            params={"range": "24h", "format": "xml"},
            headers=auth_headers,
        )

        assert response.status_code == 422

    def test_export_missing_range_returns_422(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Missing range parameter returns validation error."""
        # Create a server first
        self._create_server_only(client, auth_headers, "missing-range-server")

        response = client.get(
            "/api/v1/servers/missing-range-server/metrics/export",
            params={"format": "csv"},
            headers=auth_headers,
        )

        assert response.status_code == 422


class TestMetricsExportDataIntegrity:
    """Tests for data integrity in exports."""

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
                    "cpu_percent": 40.0 + i,
                    "memory_percent": 60.0 + (i * 0.5),
                    "disk_percent": 30.0,
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

    def test_export_csv_values_match_json(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV and JSON exports contain same number of records."""
        server_id = "integrity-match-server"
        self._create_server_with_metrics(client, auth_headers, server_id, metrics_count=3)

        csv_response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "csv"},
            headers=auth_headers,
        )
        json_response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "json"},
            headers=auth_headers,
        )

        csv_lines = csv_response.text.strip().split("\n")
        json_data = json_response.json()

        # Both should have same number of records
        assert len(csv_lines) - 1 == len(json_data["data_points"])

    def test_export_json_data_point_structure(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """JSON data points have correct structure."""
        server_id = "integrity-struct-server"
        self._create_server_with_metrics(client, auth_headers, server_id, metrics_count=1)

        response = client.get(
            f"/api/v1/servers/{server_id}/metrics/export",
            params={"range": "24h", "format": "json"},
            headers=auth_headers,
        )

        data = response.json()
        assert len(data["data_points"]) > 0
        point = data["data_points"][0]

        assert "timestamp" in point
        assert "cpu_percent" in point
        assert "memory_percent" in point
        assert "disk_percent" in point
