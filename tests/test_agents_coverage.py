"""Tests for agents.py coverage (US0025, US0051).

These tests target specific uncovered lines in homelab_cmd/api/routes/agents.py:
- Lines 106-141: _process_command_results()
- Lines 58, 322-355: Approved action delivery
- Lines 266-277: Package update storage
- Lines 71-74: _format_pending_command() with service_name

Coverage targets: 28% → 55%+
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient

# =============================================================================
# Test Command Results Processing - Lines 106-141
# =============================================================================


class TestCommandResultsProcessing:
    """Tests for command result processing in heartbeat (US0025 - AC4, AC5)."""

    def test_command_result_updates_action_to_completed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Command result with exit_code=0 updates action to COMPLETED (Lines 128-130)."""
        # Create server and pause it to get pending actions
        client.post(
            "/api/v1/servers",
            json={"id": "cmd-result-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/cmd-result-server/pause", headers=auth_headers)

        # Create and approve action
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "cmd-result-server",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()
        action_id = action["id"]

        # Approve the action
        client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)

        # Send heartbeat to get the action delivered (marks as EXECUTING)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-result-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send heartbeat with successful command result
        result_response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-result-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action_id,
                        "exit_code": 0,
                        "stdout": "Service restarted successfully",
                        "stderr": "",
                        "executed_at": datetime.now(UTC).isoformat(),
                        "completed_at": datetime.now(UTC).isoformat(),
                    }
                ],
            },
            headers=auth_headers,
        )
        assert result_response.status_code == 200
        assert action_id in result_response.json()["results_acknowledged"]

        # Verify action status is COMPLETED
        action_response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_response.json()["status"] == "completed"

    def test_command_result_updates_action_to_failed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Command result with exit_code!=0 updates action to FAILED (Lines 131-137)."""
        # Create server and pause it
        client.post(
            "/api/v1/servers",
            json={"id": "cmd-fail-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/cmd-fail-server/pause", headers=auth_headers)

        # Create and approve action
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "cmd-fail-server",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        ).json()
        action_id = action["id"]

        client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)

        # Get action delivered (marks as EXECUTING)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-fail-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send heartbeat with failed command result
        result_response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-fail-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action_id,
                        "exit_code": 1,
                        "stdout": "",
                        "stderr": "Failed to restart nginx.service: Unit nginx.service not found.",
                        "executed_at": datetime.now(UTC).isoformat(),
                        "completed_at": datetime.now(UTC).isoformat(),
                    }
                ],
            },
            headers=auth_headers,
        )
        assert result_response.status_code == 200

        # Verify action status is FAILED
        action_response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_response.json()["status"] == "failed"
        assert action_response.json()["exit_code"] == 1

    def test_command_result_stores_stdout_stderr(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Command result stores stdout and stderr (Lines 123-126)."""
        # Create server and pause it
        client.post(
            "/api/v1/servers",
            json={"id": "cmd-output-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/cmd-output-server/pause", headers=auth_headers)

        # Create and approve action
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "cmd-output-server",
                "action_type": "restart_service",
                "service_name": "redis",
            },
            headers=auth_headers,
        ).json()
        action_id = action["id"]

        client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)

        # Get action delivered (marks as EXECUTING)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-output-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send heartbeat with command result including output
        stdout_content = "Service redis-server restarted\nPID: 12345"
        stderr_content = "Warning: deprecated config option"
        completed_time = datetime.now(UTC).isoformat()

        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-output-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action_id,
                        "exit_code": 0,
                        "stdout": stdout_content,
                        "stderr": stderr_content,
                        "executed_at": datetime.now(UTC).isoformat(),
                        "completed_at": completed_time,
                    }
                ],
            },
            headers=auth_headers,
        )

        # Verify stdout and stderr are stored
        action_response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_response.json()["stdout"] == stdout_content
        assert action_response.json()["stderr"] == stderr_content
        assert action_response.json()["completed_at"] is not None

    def test_command_result_for_unknown_action_ignored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Command result for unknown action is ignored (Lines 106-112)."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "unknown-action-server", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Send heartbeat with result for nonexistent action
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "unknown-action-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": 999999,  # Nonexistent action
                        "exit_code": 0,
                        "stdout": "",
                        "stderr": "",
                        "executed_at": datetime.now(UTC).isoformat(),
                        "completed_at": datetime.now(UTC).isoformat(),
                    }
                ],
            },
            headers=auth_headers,
        )
        # Should succeed but not acknowledge the unknown action
        assert response.status_code == 200
        assert 999999 not in response.json()["results_acknowledged"]


# =============================================================================
# Test Approved Action Delivery - Lines 58, 322-355
# =============================================================================


class TestApprovedActionDelivery:
    """Tests for approved action delivery via heartbeat (US0025 - AC1, AC2, AC6)."""

    def test_approved_action_returned_in_pending_commands(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approved action returned in pending_commands (Lines 343-352)."""
        # Create server and pause it
        client.post(
            "/api/v1/servers",
            json={"id": "delivery-test-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/delivery-test-server/pause", headers=auth_headers)

        # Create and approve action
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "delivery-test-server",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()
        action_id = action["id"]

        client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)

        # Send heartbeat to receive the pending command
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "delivery-test-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify pending_commands contains the action
        pending = response.json()["pending_commands"]
        assert len(pending) == 1
        assert pending[0]["action_id"] == action_id
        assert pending[0]["action_type"] == "restart_service"
        assert pending[0]["command"] == "systemctl restart plex"
        assert pending[0]["parameters"]["service_name"] == "plex"
        assert pending[0]["timeout_seconds"] == 30

    def test_action_marked_executing_on_delivery(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Action marked as EXECUTING when delivered (Lines 344-346)."""
        # Create server and pause it
        client.post(
            "/api/v1/servers",
            json={"id": "executing-test-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/executing-test-server/pause", headers=auth_headers)

        # Create and approve action
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "executing-test-server",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()
        action_id = action["id"]

        client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)

        # Verify action is approved
        action_before = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_before.json()["status"] == "approved"
        assert action_before.json()["executed_at"] is None

        # Send heartbeat to trigger delivery
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "executing-test-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify action is now EXECUTING
        action_after = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_after.json()["status"] == "executing"
        assert action_after.json()["executed_at"] is not None


# =============================================================================
# Test Package Updates Storage - Lines 266-277
# =============================================================================


class TestPackageUpdatesStorage:
    """Tests for package update storage in heartbeat (US0051 - AC2)."""

    def test_packages_stored_from_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Packages array stored in database (Lines 266-277)."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "pkg-storage-server", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Send heartbeat with packages
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "pkg-storage-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "packages": [
                    {
                        "name": "openssl",
                        "current_version": "3.0.13-1~deb12u1",
                        "new_version": "3.0.14-1~deb12u1",
                        "repository": "bookworm-security",
                        "is_security": True,
                    },
                    {
                        "name": "vim",
                        "current_version": "9.0.1378-2",
                        "new_version": "9.0.1378-3",
                        "repository": "bookworm",
                        "is_security": False,
                    },
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify packages stored via API
        packages_response = client.get(
            "/api/v1/servers/pkg-storage-server/packages", headers=auth_headers
        )
        assert packages_response.status_code == 200

        packages = packages_response.json()["packages"]
        assert len(packages) == 2

        # Find the security package
        security_pkg = next((p for p in packages if p["name"] == "openssl"), None)
        assert security_pkg is not None
        assert security_pkg["current_version"] == "3.0.13-1~deb12u1"
        assert security_pkg["new_version"] == "3.0.14-1~deb12u1"
        assert security_pkg["is_security"] is True

    def test_packages_replaced_on_subsequent_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Subsequent heartbeat replaces packages (Lines 260-264)."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "pkg-replace-server", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Send first heartbeat with packages
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "pkg-replace-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "packages": [
                    {
                        "name": "package-a",
                        "current_version": "1.0",
                        "new_version": "1.1",
                        "repository": "main",
                        "is_security": False,
                    },
                    {
                        "name": "package-b",
                        "current_version": "2.0",
                        "new_version": "2.1",
                        "repository": "main",
                        "is_security": False,
                    },
                ],
            },
            headers=auth_headers,
        )

        # Send second heartbeat with different packages (fewer packages)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "pkg-replace-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "packages": [
                    {
                        "name": "package-c",
                        "current_version": "3.0",
                        "new_version": "3.1",
                        "repository": "security",
                        "is_security": True,
                    },
                ],
            },
            headers=auth_headers,
        )

        # Verify only new packages exist
        packages_response = client.get(
            "/api/v1/servers/pkg-replace-server/packages", headers=auth_headers
        )
        packages = packages_response.json()["packages"]
        assert len(packages) == 1
        assert packages[0]["name"] == "package-c"


# =============================================================================
# Test Format Pending Command with Service Name - Lines 71-74
# =============================================================================


class TestFormatPendingCommand:
    """Tests for _format_pending_command with service_name (Lines 70-80)."""

    def test_pending_command_includes_service_name_parameter(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PendingCommand includes service_name in parameters (Lines 71-72)."""
        # Create server and pause it
        client.post(
            "/api/v1/servers",
            json={"id": "format-cmd-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/format-cmd-server/pause", headers=auth_headers)

        # Create action with service_name
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "format-cmd-server",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        ).json()
        action_id = action["id"]

        client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)

        # Send heartbeat to receive the command
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "format-cmd-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify parameters include service_name
        pending = response.json()["pending_commands"]
        assert len(pending) == 1
        assert "service_name" in pending[0]["parameters"]
        assert pending[0]["parameters"]["service_name"] == "radarr"
