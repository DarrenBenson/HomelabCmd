"""Tests for Docker container listing via SSH (US0158 - EP0014).

These tests verify:
- Container list parsing from docker ps output
- API endpoint behaviour for Docker and non-Docker servers
- Caching behaviour
- Error handling for SSH failures
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from homelab_cmd.services.container_service import (
    ContainerService,
    clear_container_cache,
)

# =============================================================================
# Unit Tests: Container Service
# =============================================================================


class TestContainerServiceParsing:
    """Tests for docker ps output parsing."""

    def test_parse_valid_docker_output(self) -> None:
        """Parse valid JSON output from docker ps."""
        service = ContainerService(ssh_executor=MagicMock())

        output = """{"Command":"...","CreatedAt":"2026-01-15","ID":"abc123def456","Image":"plex:latest","Names":"plex","Ports":"32400/tcp","State":"running","Status":"Up 12 days"}
{"Command":"...","CreatedAt":"2026-01-10","ID":"def456ghi789","Image":"sonarr:latest","Names":"sonarr","Ports":"8989/tcp","State":"exited","Status":"Exited (0) 2 hours ago"}"""

        containers = service._parse_docker_output(output)

        assert len(containers) == 2
        assert containers[0]["id"] == "abc123def456"
        assert containers[0]["name"] == "plex"
        assert containers[0]["image"] == "plex:latest"
        assert containers[0]["state"] == "running"
        assert containers[1]["state"] == "exited"

    def test_parse_empty_output(self) -> None:
        """Handle empty docker ps output (no containers)."""
        service = ContainerService(ssh_executor=MagicMock())

        containers = service._parse_docker_output("")
        assert containers == []

        containers = service._parse_docker_output("\n\n")
        assert containers == []

    def test_parse_malformed_json_skipped(self) -> None:
        """Skip malformed JSON lines gracefully."""
        service = ContainerService(ssh_executor=MagicMock())

        output = """{"ID":"abc123","Names":"plex","Image":"plex","State":"running","Status":"Up"}
not valid json
{"ID":"def456","Names":"sonarr","Image":"sonarr","State":"exited","Status":"Exited"}"""

        containers = service._parse_docker_output(output)
        assert len(containers) == 2  # Invalid line skipped

    def test_parse_container_name_strips_slash(self) -> None:
        """Container names should have leading slash stripped."""
        service = ContainerService(ssh_executor=MagicMock())

        output = '{"ID":"abc123","Names":"/plex","Image":"plex","State":"running","Status":"Up"}'
        containers = service._parse_docker_output(output)

        assert containers[0]["name"] == "plex"  # Not "/plex"


class TestUptimeParsing:
    """Tests for Docker status uptime parsing."""

    def test_parse_uptime_days(self) -> None:
        """Parse 'Up X days' format."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Up 12 days") == 12 * 86400

    def test_parse_uptime_hours(self) -> None:
        """Parse 'Up X hours' format."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Up 3 hours") == 3 * 3600

    def test_parse_uptime_minutes(self) -> None:
        """Parse 'Up X minutes' format."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Up 45 minutes") == 45 * 60

    def test_parse_uptime_weeks(self) -> None:
        """Parse 'Up X weeks' format."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Up 2 weeks") == 2 * 604800

    def test_parse_uptime_about_hour(self) -> None:
        """Parse 'Up About an hour' format."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Up About an hour") == 3600

    def test_parse_uptime_less_than_second(self) -> None:
        """Parse 'Up Less than a second' format."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Up Less than a second") == 0

    def test_parse_uptime_non_running(self) -> None:
        """Return None for non-running status."""
        service = ContainerService(ssh_executor=MagicMock())
        assert service._parse_uptime("Exited (0) 2 hours ago") is None


class TestContainerSorting:
    """Tests for container list sorting."""

    @pytest.mark.asyncio
    async def test_containers_sorted_running_first(self) -> None:
        """Running containers should appear before stopped ones."""
        # Mock SSH executor
        mock_executor = MagicMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = """{"ID":"a","Names":"stopped1","Image":"img","State":"exited","Status":"Exited"}
{"ID":"b","Names":"running1","Image":"img","State":"running","Status":"Up"}
{"ID":"c","Names":"stopped2","Image":"img","State":"exited","Status":"Exited"}
{"ID":"d","Names":"running2","Image":"img","State":"running","Status":"Up"}"""
        mock_result.duration_ms = 100
        mock_executor.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_executor)

        # Clear cache to ensure fresh fetch
        clear_container_cache()

        # Create mock server
        mock_server = MagicMock()
        mock_server.id = "test-server"

        containers, cached, _, _ = await service.list_containers(mock_server)

        # Verify order: running first, then alphabetical within each group
        assert containers[0]["name"] == "running1"
        assert containers[1]["name"] == "running2"
        assert containers[2]["name"] == "stopped1"
        assert containers[3]["name"] == "stopped2"


# =============================================================================
# Integration Tests: API Endpoint
# =============================================================================


class TestContainerListEndpoint:
    """Tests for GET /servers/{id}/containers endpoint."""

    def test_list_containers_server_not_found(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Return 404 for non-existent server."""
        response = client.get(
            "/api/v1/servers/nonexistent-server/containers",
            headers=auth_headers,
        )
        assert response.status_code == 404
        detail = response.json()["detail"]
        # Detail can be a dict (custom HTTPException) or string (default)
        if isinstance(detail, dict):
            assert detail["code"] == "NOT_FOUND"
        else:
            assert "not found" in detail.lower()

    def test_list_containers_no_docker(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Return empty list for server without Docker."""
        # Create server without Docker
        create_resp = client.post(
            "/api/v1/servers",
            json={"id": "no-docker-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        assert create_resp.status_code == 201, f"Server creation failed: {create_resp.text}"

        # Send heartbeat with docker_installed=false
        hb_resp = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-docker-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": False,
            },
            headers=auth_headers,
        )
        assert hb_resp.status_code == 200, f"Heartbeat failed: {hb_resp.text}"

        response = client.get(
            "/api/v1/servers/no-docker-server/containers",
            headers=auth_headers,
        )

        assert response.status_code == 200, f"Container list failed: {response.text}"
        data = response.json()
        assert data["containers"] == []
        assert data["total"] == 0
        assert data["error"] == "Docker not installed on this server"

    def test_list_containers_no_ssh_key(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Return 200 with error when SSH key not configured."""
        # Create server with Docker but no SSH key configured
        client.post(
            "/api/v1/servers",
            json={"id": "no-tailscale-server", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Send heartbeat with docker_installed=true
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-tailscale-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": True,
            },
            headers=auth_headers,
        )

        response = client.get(
            "/api/v1/servers/no-tailscale-server/containers",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["containers"] == []
        assert data["total"] == 0
        assert "SSH key not configured" in data["error"]

    def test_list_containers_docker_unknown(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Return empty list (no error) for server with unknown Docker status."""
        # Create server without sending docker_installed in heartbeat
        client.post(
            "/api/v1/servers",
            json={"id": "unknown-docker-server", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.get(
            "/api/v1/servers/unknown-docker-server/containers",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["containers"] == []
        assert data["total"] == 0
        assert data["error"] is None  # No error - status just unknown


class TestContainerCaching:
    """Tests for container list caching."""

    @pytest.mark.asyncio
    async def test_cache_returns_cached_result(self) -> None:
        """Second call within TTL returns cached result."""
        # Clear any existing cache
        clear_container_cache()

        mock_executor = MagicMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = '{"ID":"a","Names":"plex","Image":"plex","State":"running","Status":"Up"}'
        mock_result.duration_ms = 100
        mock_executor.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_executor)

        mock_server = MagicMock()
        mock_server.id = "cache-test-server"

        # First call - should hit SSH
        containers1, cached1, _, _ = await service.list_containers(mock_server)
        assert cached1 is False
        assert mock_executor.execute.call_count == 1

        # Second call - should return cached
        containers2, cached2, _, _ = await service.list_containers(mock_server)
        assert cached2 is True
        assert mock_executor.execute.call_count == 1  # No additional call

        # Results should be identical
        assert containers1 == containers2

    @pytest.mark.asyncio
    async def test_force_refresh_bypasses_cache(self) -> None:
        """force_refresh=True bypasses cache."""
        clear_container_cache()

        mock_executor = MagicMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = '{"ID":"a","Names":"plex","Image":"plex","State":"running","Status":"Up"}'
        mock_result.duration_ms = 100
        mock_executor.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_executor)

        mock_server = MagicMock()
        mock_server.id = "force-refresh-server"

        # First call
        await service.list_containers(mock_server)
        assert mock_executor.execute.call_count == 1

        # Second call with force_refresh
        containers, cached, _, _ = await service.list_containers(mock_server, force_refresh=True)
        assert cached is False
        assert mock_executor.execute.call_count == 2


class TestContainerListResponseSchema:
    """Tests for response schema fields."""

    def test_response_includes_all_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response includes all required schema fields."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "schema-test-server", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.get(
            "/api/v1/servers/schema-test-server/containers",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check all required fields present
        assert "server_id" in data
        assert "containers" in data
        assert "total" in data
        assert "cached" in data
        assert "fetched_at" in data
        assert "error" in data

        # Check types
        assert isinstance(data["containers"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["cached"], bool)
