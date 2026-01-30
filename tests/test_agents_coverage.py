"""Tests for agents.py coverage (US0051, US0152).

These tests target specific functionality in homelab_cmd/api/routes/agents.py:
- Package update storage (US0051)
- Backward compatibility for v1.0 agents (US0152)

Note: Command channel tests (US0025) were removed in US0152 (EP0013).
Commands are now executed via synchronous SSH, not agent heartbeat channel.
See test_heartbeat_commands.py for deprecation/backward compat tests.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient

# =============================================================================
# Test Command Results Backward Compatibility (US0152)
# =============================================================================


class TestCommandResultsBackwardCompatibility:
    """Tests for v1.0 agent backward compatibility (US0152)."""

    def test_command_results_accepted_but_ignored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """V1.0 heartbeat with command_results is accepted but ignored (US0152)."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "cmd-result-server", "hostname": "test.local"},
            headers=auth_headers,
        )

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

        # Send heartbeat with command_results (v1.0 format)
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
        # Results are NOT acknowledged - command channel deprecated
        assert action_id not in result_response.json()["results_acknowledged"]

        # Verify action status is STILL approved (not updated)
        action_response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_response.json()["status"] == "approved"  # Not 'completed'

    def test_command_result_for_unknown_action_accepted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Command result for unknown action is gracefully handled (v1.0 compat)."""
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
        # Should succeed - command_results are ignored
        assert response.status_code == 200
        assert 999999 not in response.json()["results_acknowledged"]


# =============================================================================
# Test Approved Action NOT Delivered (US0152 - Command Channel Removed)
# =============================================================================


class TestApprovedActionNotDelivered:
    """Tests verifying approved actions are NOT delivered via heartbeat (US0152)."""

    def test_approved_action_not_in_pending_commands(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approved actions are NOT returned in pending_commands (US0152)."""
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

        # Send heartbeat
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

        # Verify pending_commands is EMPTY (no delivery via heartbeat)
        pending = response.json()["pending_commands"]
        assert len(pending) == 0

    def test_action_not_marked_executing_on_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Action is NOT marked as EXECUTING when heartbeat received (US0152)."""
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

        # Send heartbeat
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "executing-test-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify action is STILL approved (NOT executing)
        action_after = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert action_after.json()["status"] == "approved"  # Not 'executing'


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
