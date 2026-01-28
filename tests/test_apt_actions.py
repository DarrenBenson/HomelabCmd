"""Tests for APT package update actions (US0052).

This module tests the extension of the Remediation Engine to support
apt update/upgrade actions via the existing action queue infrastructure.

Test Cases Covered:
- TC190-TC206: API endpoints, whitelist validation, approval workflow
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from homelab_cmd.api.schemas.actions import ActionType


class TestAptActionTypes:
    """Test that new APT action types are defined correctly."""

    def test_apt_update_action_type_exists(self):
        """TC191: Verify apt_update is a valid action type."""
        assert hasattr(ActionType, "APT_UPDATE")
        assert ActionType.APT_UPDATE.value == "apt_update"

    def test_apt_upgrade_all_action_type_exists(self):
        """TC193: Verify apt_upgrade_all is a valid action type."""
        assert hasattr(ActionType, "APT_UPGRADE_ALL")
        assert ActionType.APT_UPGRADE_ALL.value == "apt_upgrade_all"

    def test_apt_upgrade_security_action_type_exists(self):
        """TC196: Verify apt_upgrade_security is a valid action type."""
        assert hasattr(ActionType, "APT_UPGRADE_SECURITY")
        assert ActionType.APT_UPGRADE_SECURITY.value == "apt_upgrade_security"


class TestAptActionAPI:
    """Test APT action creation via API."""

    def _create_server(self, client: TestClient, auth_headers: dict, server_id: str) -> None:
        """Helper to create a server via heartbeat."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

    def _pause_server(self, client: TestClient, auth_headers: dict, server_id: str) -> None:
        """Helper to set server to paused (maintenance) mode."""
        client.put(
            f"/api/v1/servers/{server_id}",
            json={"is_paused": True},
            headers=auth_headers,
        )

    def test_create_apt_update_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC190: Create apt_update action via API."""
        server_id = "apt-test-server-1"
        self._create_server(client, auth_headers, server_id)

        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["action_type"] == "apt_update"
        assert "DEBIAN_FRONTEND=noninteractive" in data["command"]
        assert "apt-get update -q -o APT::Sandbox::User=root" in data["command"]
        assert data["status"] == "approved"  # Non-paused server

    def test_create_apt_upgrade_all_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC192: Create apt_upgrade_all action via API."""
        server_id = "apt-test-server-2"
        self._create_server(client, auth_headers, server_id)

        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_upgrade_all"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["action_type"] == "apt_upgrade_all"
        assert "DEBIAN_FRONTEND=noninteractive" in data["command"]
        assert "apt-get dist-upgrade" in data["command"]
        assert "--force-confold" in data["command"]
        assert data["status"] == "approved"

    def test_create_apt_upgrade_security_with_packages(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC194: Create apt_upgrade_security with security packages."""
        server_id = "apt-sec-pkg-server"
        # Create server with security packages
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
            "packages": [
                {
                    "name": "openssl",
                    "current_version": "3.0.13",
                    "new_version": "3.0.14",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "libssl3",
                    "current_version": "3.0.13",
                    "new_version": "3.0.14",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_upgrade_security"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["action_type"] == "apt_upgrade_security"
        # Command should contain security package names
        assert "DEBIAN_FRONTEND=noninteractive" in data["command"]
        assert "apt-get install" in data["command"]
        assert "--force-confold" in data["command"]
        assert "openssl" in data["command"]
        assert "libssl3" in data["command"]

    def test_create_apt_upgrade_security_no_packages(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC195: Create apt_upgrade_security with no security packages."""
        server_id = "apt-no-sec-server"
        # Create server with only non-security packages
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
            "packages": [
                {
                    "name": "vim",
                    "current_version": "9.0.1",
                    "new_version": "9.0.2",
                    "repository": "bookworm",
                    "is_security": False,
                },
            ],
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_upgrade_security"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["command"] == "echo 'No security packages to upgrade'"


class TestAptActionApproval:
    """Test approval workflow for APT actions."""

    def _create_server(self, client: TestClient, auth_headers: dict, server_id: str) -> None:
        """Helper to create a server via heartbeat."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

    def test_apt_action_requires_approval_on_paused_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC197: apt action requires approval on paused server."""
        server_id = "apt-paused-server"
        self._create_server(client, auth_headers, server_id)

        # Pause the server (use dedicated pause endpoint)
        client.put(
            f"/api/v1/servers/{server_id}/pause",
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["approved_by"] is None

    def test_apt_action_auto_approved_on_normal_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC198: apt action auto-approved on normal server."""
        server_id = "apt-normal-server"
        self._create_server(client, auth_headers, server_id)

        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "approved"
        assert data["approved_by"] == "auto"


class TestAptActionDuplicates:
    """Test duplicate APT action prevention."""

    def _create_server(self, client: TestClient, auth_headers: dict, server_id: str) -> None:
        """Helper to create a server via heartbeat."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

    def test_duplicate_apt_action_rejected(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC199: Duplicate apt action rejected while one is pending/approved/executing."""
        server_id = "apt-dup-server"
        self._create_server(client, auth_headers, server_id)

        # Create first action
        response1 = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Try to create duplicate
        response2 = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response2.status_code == 409
        data = response2.json()
        assert data["detail"]["code"] == "CONFLICT"

    def test_different_apt_action_types_conflict(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Different apt action types on same server should conflict."""
        server_id = "apt-cross-dup-server"
        self._create_server(client, auth_headers, server_id)

        # Create apt_update action
        response1 = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Try to create apt_upgrade_all (should conflict)
        response2 = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_upgrade_all"},
            headers=auth_headers,
        )
        assert response2.status_code == 409


class TestExecutorWhitelist:
    """Test agent executor whitelist validation for APT commands."""

    def test_apt_update_in_whitelist(self):
        """TC191: apt-get update command passes whitelist validation."""
        from agent.executor import DEBIAN_FRONTEND, is_whitelisted

        assert (
            is_whitelisted(f"{DEBIAN_FRONTEND} apt-get update -q -o APT::Sandbox::User=root")
            is True
        )

    def test_apt_upgrade_in_whitelist(self):
        """TC193: apt-get dist-upgrade -y command passes whitelist validation."""
        from agent.executor import APT_OPTIONS, DEBIAN_FRONTEND, is_whitelisted

        assert (
            is_whitelisted(f"{DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS} -o APT::Sandbox::User=root")
            is True
        )

    def test_apt_install_packages_in_whitelist(self):
        """TC196: apt-get install -y <packages> command passes whitelist validation."""
        from agent.executor import APT_OPTIONS, DEBIAN_FRONTEND, is_whitelisted

        assert (
            is_whitelisted(
                f"{DEBIAN_FRONTEND} apt-get install {APT_OPTIONS} -o APT::Sandbox::User=root openssl libssl3"
            )
            is True
        )

    def test_echo_no_security_in_whitelist(self):
        """Verify echo command for no security packages is whitelisted."""
        from agent.executor import is_whitelisted

        assert is_whitelisted("echo 'No security packages to upgrade'") is True

    def test_apt_remove_not_in_whitelist(self):
        """TC200: apt remove command is not in whitelist (security)."""
        from agent.executor import is_whitelisted

        assert is_whitelisted("apt remove openssl") is False

    def test_command_injection_blocked(self):
        """TC206: Command injection via package name is blocked."""
        from agent.executor import is_whitelisted

        assert is_whitelisted("apt install -y openssl; rm -rf /") is False
        assert is_whitelisted("apt install -y $(cat /etc/passwd)") is False


class TestAptActionResults:
    """Test APT action result recording."""

    def _create_server(self, client: TestClient, auth_headers: dict, server_id: str) -> None:
        """Helper to create a server via heartbeat."""
        heartbeat_data = {
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-20T10:00:00Z",
            "metrics": {
                "cpu_percent": 50.0,
                "memory_percent": 60.0,
                "disk_percent": 70.0,
            },
        }
        client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

    def test_action_history_shows_apt_results(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC204: Action history shows apt action with full results."""
        server_id = "apt-history-server"
        self._create_server(client, auth_headers, server_id)

        # Create action
        response = client.post(
            "/api/v1/actions",
            json={"server_id": server_id, "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        action_id = response.json()["id"]

        # Get action by ID
        response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["action_type"] == "apt_update"
        assert "DEBIAN_FRONTEND=noninteractive" in data["command"]
        assert "apt-get update" in data["command"]

        # List actions filtered by server
        response = client.get(f"/api/v1/actions?server_id={server_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        apt_actions = [a for a in data["actions"] if a["action_type"] == "apt_update"]
        assert len(apt_actions) >= 1


class TestAptCommandExecution:
    """Test APT command execution with timeout."""

    @pytest.mark.asyncio
    async def test_apt_command_execution_with_timeout(self):
        """TC201: apt command executed with extended timeout."""
        from agent.executor import APT_OPTIONS, DEBIAN_FRONTEND, execute_command

        with patch("agent.executor.asyncio.create_subprocess_shell") as mock_proc:
            mock_proc.return_value.communicate.return_value = (b"Success", b"")
            mock_proc.return_value.returncode = 0

            result = await execute_command(
                action_id=1,
                command=f"{DEBIAN_FRONTEND} apt-get dist-upgrade {APT_OPTIONS} -o APT::Sandbox::User=root",
                timeout=600,  # 10 minute timeout
            )

            assert result.success is True
