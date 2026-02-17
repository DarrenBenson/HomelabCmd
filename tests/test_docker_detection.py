"""Tests for Docker detection via agent heartbeat (US0157 - EP0014).

These tests verify that:
- Agent can report docker_installed status via heartbeat
- has_docker field is stored in server model
- has_docker is returned in server API responses
"""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient


class TestDockerDetectionHeartbeat:
    """Tests for Docker detection via heartbeat (US0157)."""

    def test_docker_installed_true_stored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """docker_installed=true in heartbeat sets has_docker=True on server."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "docker-test-1", "hostname": "docker.local"},
            headers=auth_headers,
        )

        # Send heartbeat with docker_installed=true
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "docker-test-1",
                "hostname": "docker.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify has_docker is set on server
        server_response = client.get("/api/v1/servers/docker-test-1", headers=auth_headers)
        assert server_response.status_code == 200
        assert server_response.json()["has_docker"] is True

    def test_docker_installed_false_stored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """docker_installed=false in heartbeat sets has_docker=False on server."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "docker-test-2", "hostname": "no-docker.local"},
            headers=auth_headers,
        )

        # Send heartbeat with docker_installed=false
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "docker-test-2",
                "hostname": "no-docker.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": False,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify has_docker is set on server
        server_response = client.get("/api/v1/servers/docker-test-2", headers=auth_headers)
        assert server_response.status_code == 200
        assert server_response.json()["has_docker"] is False

    def test_docker_installed_not_sent_preserves_null(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """When docker_installed is not sent, has_docker remains null."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "docker-test-3", "hostname": "unknown.local"},
            headers=auth_headers,
        )

        # Send heartbeat without docker_installed field
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "docker-test-3",
                "hostname": "unknown.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify has_docker is null (not set)
        server_response = client.get("/api/v1/servers/docker-test-3", headers=auth_headers)
        assert server_response.status_code == 200
        assert server_response.json()["has_docker"] is None

    def test_docker_status_updated_on_subsequent_heartbeats(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Docker status can be updated by subsequent heartbeats."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "docker-test-4", "hostname": "docker.local"},
            headers=auth_headers,
        )

        # First heartbeat: no docker
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "docker-test-4",
                "hostname": "docker.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": False,
            },
            headers=auth_headers,
        )
        server = client.get("/api/v1/servers/docker-test-4", headers=auth_headers).json()
        assert server["has_docker"] is False

        # Second heartbeat: docker now installed
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "docker-test-4",
                "hostname": "docker.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": True,
            },
            headers=auth_headers,
        )
        server = client.get("/api/v1/servers/docker-test-4", headers=auth_headers).json()
        assert server["has_docker"] is True


class TestDockerDetectionAPIResponse:
    """Tests for has_docker in API responses (US0157)."""

    def test_server_list_includes_has_docker(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server list response includes has_docker field."""
        # Create server with docker
        client.post(
            "/api/v1/servers",
            json={"id": "docker-list-1", "hostname": "docker.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "docker-list-1",
                "hostname": "docker.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "docker_installed": True,
            },
            headers=auth_headers,
        )

        # Get server list
        response = client.get("/api/v1/servers", headers=auth_headers)
        assert response.status_code == 200
        servers = response.json()["servers"]
        docker_server = next((s for s in servers if s["id"] == "docker-list-1"), None)
        assert docker_server is not None
        assert docker_server["has_docker"] is True
