"""Tests for compliance summary API endpoint.

Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.
"""


import pytest
from fastapi.testclient import TestClient


class TestComplianceSummaryAPIAuth:
    """Tests for authentication requirements."""

    def test_summary_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/config/compliance requires authentication."""
        response = client.get("/api/v1/config/compliance")
        assert response.status_code == 401


class TestComplianceSummaryNoServers:
    """Tests when no servers exist."""

    def test_empty_summary(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Returns empty summary when no servers exist."""
        response = client.get(
            "/api/v1/config/compliance",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["compliant"] == 0
        assert data["summary"]["non_compliant"] == 0
        assert data["summary"]["never_checked"] == 0
        assert data["summary"]["total"] == 0
        assert data["machines"] == []


class TestComplianceSummaryWithServers:
    """Tests with servers in various compliance states."""

    @pytest.fixture(autouse=True)
    def setup_servers(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ):
        """Create test servers for each test."""
        # Create test servers
        servers = [
            {"id": "compliant-server", "hostname": "compliant.local"},
            {"id": "non-compliant-server", "hostname": "noncompliant.local"},
            {"id": "unchecked-server", "hostname": "unchecked.local"},
        ]
        for server in servers:
            response = client.post(
                "/api/v1/servers",
                json=server,
                headers=auth_headers,
            )
            assert response.status_code == 201

        yield

        # Cleanup
        for server in servers:
            client.delete(
                f"/api/v1/servers/{server['id']}",
                headers=auth_headers,
            )

    def test_all_never_checked(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Returns correct counts when all servers never checked."""
        response = client.get(
            "/api/v1/config/compliance",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # All 3 servers should be never_checked since no compliance checks exist
        assert data["summary"]["compliant"] == 0
        assert data["summary"]["non_compliant"] == 0
        assert data["summary"]["never_checked"] == 3
        assert data["summary"]["total"] == 3

        # Verify machine details
        for machine in data["machines"]:
            assert machine["status"] == "never_checked"
            assert machine["pack"] is None
            assert machine["checked_at"] is None


class TestComplianceSummaryResponseFormat:
    """Tests for response format and structure."""

    @pytest.fixture(autouse=True)
    def setup_server(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ):
        """Create a test server."""
        server_data = {"id": "format-test-server", "hostname": "format.local"}
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete(
            "/api/v1/servers/format-test-server",
            headers=auth_headers,
        )

    def test_response_structure(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Verifies the response has correct structure."""
        response = client.get(
            "/api/v1/config/compliance",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verify summary structure
        assert "summary" in data
        assert "compliant" in data["summary"]
        assert "non_compliant" in data["summary"]
        assert "never_checked" in data["summary"]
        assert "total" in data["summary"]

        # Verify machines array structure
        assert "machines" in data
        assert isinstance(data["machines"], list)

        # Verify machine entry structure
        assert len(data["machines"]) == 1
        machine = data["machines"][0]
        assert "id" in machine
        assert "display_name" in machine
        assert "status" in machine
        assert "pack" in machine
        assert "mismatch_count" in machine
        assert "checked_at" in machine

    def test_display_name_fallback_to_hostname(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Uses hostname when display_name is not set."""
        response = client.get(
            "/api/v1/config/compliance",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Server was created without display_name, should fall back to hostname
        machine = data["machines"][0]
        assert machine["display_name"] == "format.local"


class TestComplianceSummaryWithDisplayName:
    """Tests for display name handling."""

    @pytest.fixture(autouse=True)
    def setup_server_with_name(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ):
        """Create a test server with display name."""
        server_data = {
            "id": "named-server",
            "hostname": "named.local",
            "display_name": "My Named Server",
        }
        response = client.post(
            "/api/v1/servers",
            json=server_data,
            headers=auth_headers,
        )
        assert response.status_code == 201
        yield
        client.delete(
            "/api/v1/servers/named-server",
            headers=auth_headers,
        )

    def test_uses_display_name_when_set(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Uses display_name when it's set."""
        response = client.get(
            "/api/v1/config/compliance",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        machine = data["machines"][0]
        assert machine["display_name"] == "My Named Server"


class TestComplianceSummaryStatusValues:
    """Tests for compliance status values."""

    def test_valid_status_values(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Verifies status field uses valid enum values."""
        # Create a server
        server_data = {"id": "status-test", "hostname": "status.local"}
        client.post("/api/v1/servers", json=server_data, headers=auth_headers)

        response = client.get(
            "/api/v1/config/compliance",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Status should be one of the valid values
        valid_statuses = ["compliant", "non_compliant", "never_checked"]
        for machine in data["machines"]:
            assert machine["status"] in valid_statuses

        # Cleanup
        client.delete("/api/v1/servers/status-test", headers=auth_headers)
