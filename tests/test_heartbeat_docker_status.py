"""Tests for US0163: Container Service Status in Heartbeat.

Tests the docker_status field in heartbeat requests and responses.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient


class TestDockerStatusHeartbeat:
    """Tests for docker_status in heartbeat."""

    def test_heartbeat_with_docker_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC1: Heartbeat includes docker_status object."""
        heartbeat_data = {
            "server_guid": "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
            "server_id": "test-docker-status",
            "hostname": "docker-host",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 8,
                "stopped_containers": 2,
                "total_containers": 10,
            },
        }

        response = client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_docker_status_stored_in_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC5: Machine model stores latest docker status."""
        heartbeat_data = {
            "server_guid": "b2c3d4e5-f6a7-4890-bcde-f12345678901",
            "server_id": "docker-status-storage",
            "hostname": "docker-host-2",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 5,
                "stopped_containers": 3,
                "total_containers": 8,
            },
        }

        client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        # Verify server has docker_status stored via API
        response = client.get(
            "/api/v1/servers/docker-status-storage",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["docker_status"] is not None
        assert data["docker_status"]["running_containers"] == 5
        assert data["docker_status"]["stopped_containers"] == 3
        assert data["docker_status"]["total_containers"] == 8

    def test_docker_status_in_server_response(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC6: API response includes docker_status."""
        # Create server with docker_status via heartbeat
        heartbeat_data = {
            "server_guid": "c3d4e5f6-a7b8-4890-8def-123456789012",
            "server_id": "docker-api-response",
            "hostname": "docker-host-3",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 12,
                "stopped_containers": 0,
                "total_containers": 12,
            },
        }

        hb_response = client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )
        assert hb_response.status_code == 200
        assert hb_response.json()["server_registered"] is True

        # Get server via API
        response = client.get(
            "/api/v1/servers/docker-api-response",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["has_docker"] is True
        assert data["docker_status"] is not None
        assert data["docker_status"]["running_containers"] == 12
        assert data["docker_status"]["stopped_containers"] == 0
        assert data["docker_status"]["total_containers"] == 12

    def test_heartbeat_without_docker_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """AC3: docker_status only included if Docker installed."""
        # Server without Docker
        heartbeat_data = {
            "server_guid": "d4e5f6a7-b8c9-4890-9ef0-234567890123",
            "server_id": "no-docker-host",
            "hostname": "no-docker",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": False,
            # No docker_status field
        }

        response = client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify server has no docker_status
        response = client.get(
            "/api/v1/servers/no-docker-host",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_docker"] is False
        assert data["docker_status"] is None

    def test_docker_status_updates_on_each_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Docker status is updated on each heartbeat."""
        server_id = "docker-status-updates"

        # First heartbeat
        heartbeat_data = {
            "server_guid": "e5f6a7b8-c9d0-4890-af01-345678901234",
            "server_id": server_id,
            "hostname": "docker-updates",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 5,
                "stopped_containers": 0,
                "total_containers": 5,
            },
        }

        client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        response = client.get(
            f"/api/v1/servers/{server_id}",
            headers=auth_headers,
        )
        assert response.json()["docker_status"]["running_containers"] == 5

        # Second heartbeat with different status
        heartbeat_data["docker_status"] = {
            "running_containers": 3,
            "stopped_containers": 2,
            "total_containers": 5,
        }

        client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        response = client.get(
            f"/api/v1/servers/{server_id}",
            headers=auth_headers,
        )
        data = response.json()
        assert data["docker_status"]["running_containers"] == 3
        assert data["docker_status"]["stopped_containers"] == 2

    def test_docker_status_all_containers_running(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test when all containers are running."""
        heartbeat_data = {
            "server_guid": "f6a7b8c9-d0e1-4890-bf12-456789012345",
            "server_id": "all-running",
            "hostname": "all-running-host",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 10,
                "stopped_containers": 0,
                "total_containers": 10,
            },
        }

        response = client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        assert response.status_code == 200

        response = client.get(
            "/api/v1/servers/all-running",
            headers=auth_headers,
        )
        data = response.json()
        assert data["docker_status"]["running_containers"] == 10
        assert data["docker_status"]["stopped_containers"] == 0

    def test_docker_status_no_containers(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test when Docker is installed but no containers exist."""
        heartbeat_data = {
            "server_guid": "a7b8c9d0-e1f2-4890-8123-567890123456",
            "server_id": "no-containers",
            "hostname": "no-containers-host",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 0,
                "stopped_containers": 0,
                "total_containers": 0,
            },
        }

        response = client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        assert response.status_code == 200

        response = client.get(
            "/api/v1/servers/no-containers",
            headers=auth_headers,
        )
        data = response.json()
        assert data["docker_status"]["total_containers"] == 0

    def test_docker_status_in_server_list(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test docker_status appears in server list response."""
        # Create server with docker_status
        heartbeat_data = {
            "server_guid": "b8c9d0e1-f2a3-4890-9234-678901234567",
            "server_id": "docker-list-test",
            "hostname": "docker-list-host",
            "timestamp": datetime.now(UTC).isoformat(),
            "docker_installed": True,
            "docker_status": {
                "running_containers": 7,
                "stopped_containers": 1,
                "total_containers": 8,
            },
        }

        client.post(
            "/api/v1/agents/heartbeat",
            json=heartbeat_data,
            headers=auth_headers,
        )

        # Get server list
        response = client.get(
            "/api/v1/servers",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our server in the list
        servers = data["servers"]
        docker_server = next(
            (s for s in servers if s["id"] == "docker-list-test"), None
        )
        assert docker_server is not None
        assert docker_server["docker_status"] is not None
        assert docker_server["docker_status"]["running_containers"] == 7
