"""Tests for health check endpoint."""

import time

from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Tests for GET /api/v1/system/health."""

    def test_health_returns_200(self, client: TestClient) -> None:
        """Health endpoint should return 200 OK."""
        response = client.get("/api/v1/system/health")

        assert response.status_code == 200

    def test_health_response_schema(self, client: TestClient) -> None:
        """Health response should have all required fields."""
        response = client.get("/api/v1/system/health")
        data = response.json()

        assert "status" in data
        assert "version" in data
        assert "uptime_seconds" in data
        assert "database" in data
        assert "timestamp" in data

    def test_health_status_is_healthy(self, client: TestClient) -> None:
        """Health status should be 'healthy'."""
        response = client.get("/api/v1/system/health")
        data = response.json()

        assert data["status"] == "healthy"

    def test_health_version_is_string(self, client: TestClient) -> None:
        """Version should be a non-empty string."""
        response = client.get("/api/v1/system/health")
        data = response.json()

        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0

    def test_health_uptime_is_non_negative(self, client: TestClient) -> None:
        """Uptime should be a non-negative integer."""
        response = client.get("/api/v1/system/health")
        data = response.json()

        assert isinstance(data["uptime_seconds"], int)
        assert data["uptime_seconds"] >= 0

    def test_health_uptime_increments(self, client: TestClient) -> None:
        """Uptime should increment over time."""
        response1 = client.get("/api/v1/system/health")
        uptime1 = response1.json()["uptime_seconds"]

        # Wait briefly
        time.sleep(1.1)

        response2 = client.get("/api/v1/system/health")
        uptime2 = response2.json()["uptime_seconds"]

        assert uptime2 >= uptime1 + 1

    def test_health_database_status(self, client: TestClient) -> None:
        """Database status should be present."""
        response = client.get("/api/v1/system/health")
        data = response.json()

        assert data["database"] in ["connected", "disconnected"]

    def test_health_timestamp_format(self, client: TestClient) -> None:
        """Timestamp should be in ISO 8601 format."""
        response = client.get("/api/v1/system/health")
        data = response.json()

        # Check basic format: YYYY-MM-DDTHH:MM:SSZ
        timestamp = data["timestamp"]
        assert "T" in timestamp
        assert timestamp.endswith("Z")
        assert len(timestamp) == 20  # 2026-01-18T10:30:00Z

    def test_health_no_auth_required(self, client: TestClient) -> None:
        """Health endpoint should work without authentication."""
        # Explicitly test without any headers
        response = client.get("/api/v1/system/health", headers={})

        assert response.status_code == 200
