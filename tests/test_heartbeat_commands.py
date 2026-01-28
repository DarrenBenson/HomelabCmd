"""Tests for Heartbeat Command Channel (US0025).

Test cases from TSP0009:
- TC160: Approved action included in heartbeat response
- TC161: Command results update action status

Additional tests for complete coverage of US0025 acceptance criteria.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient

# =============================================================================
# TC160: Approved action included in heartbeat response (AC1, AC2, AC3)
# =============================================================================


class TestApprovedActionInHeartbeatResponse:
    """TC160: Approved action included in heartbeat response."""

    def test_approved_action_returned_in_pending_commands(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approved action appears in heartbeat response pending_commands."""
        # Create server and approved action
        client.post(
            "/api/v1/servers",
            json={"id": "cmd-test-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "cmd-test-server",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        )

        # Send heartbeat
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmd-test-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["pending_commands"]) == 1
        assert data["pending_commands"][0]["action_type"] == "restart_service"
        assert data["pending_commands"][0]["command"] == "systemctl restart plex"

    def test_pending_action_not_returned(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Pending (not approved) action is not included in response (AC3)."""
        # Create and pause server (actions will be pending)
        client.post(
            "/api/v1/servers",
            json={"id": "pending-cmd-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/pending-cmd-test/pause", headers=auth_headers)

        # Create action (will be pending because server is paused)
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "pending-cmd-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        )

        # Send heartbeat
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "pending-cmd-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["pending_commands"]) == 0

    def test_action_marked_as_executing_on_delivery(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Action status changes to executing when delivered (AC2)."""
        # Create server and approved action
        client.post(
            "/api/v1/servers",
            json={"id": "exec-status-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action_resp = client.post(
            "/api/v1/actions",
            json={
                "server_id": "exec-status-test",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        )
        action_id = action_resp.json()["id"]

        # Verify initial status is approved
        action_before = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers).json()
        assert action_before["status"] == "approved"

        # Send heartbeat to deliver the command
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "exec-status-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify status is now executing
        action_after = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers).json()
        assert action_after["status"] == "executing"
        assert action_after["executed_at"] is not None

    def test_executing_action_not_redelivered(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Executing action is not re-delivered on next heartbeat (AC7)."""
        # Create server and approved action
        client.post(
            "/api/v1/servers",
            json={"id": "no-redeliver-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "no-redeliver-test",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        )

        # First heartbeat - delivers command
        response1 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-redeliver-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert len(response1.json()["pending_commands"]) == 1

        # Second heartbeat - should not re-deliver
        response2 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-redeliver-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )
        assert len(response2.json()["pending_commands"]) == 0

    def test_only_oldest_action_delivered(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Only oldest approved action is delivered (AC6)."""
        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "oldest-first-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Create two actions - first one should be delivered
        first = client.post(
            "/api/v1/actions",
            json={
                "server_id": "oldest-first-test",
                "action_type": "restart_service",
                "service_name": "first-service",
            },
            headers=auth_headers,
        ).json()

        client.post(
            "/api/v1/actions",
            json={
                "server_id": "oldest-first-test",
                "action_type": "restart_service",
                "service_name": "second-service",
            },
            headers=auth_headers,
        )

        # Send heartbeat - only first action should be delivered
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "oldest-first-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        data = response.json()
        assert len(data["pending_commands"]) == 1
        assert data["pending_commands"][0]["action_id"] == first["id"]
        assert data["pending_commands"][0]["parameters"]["service_name"] == "first-service"

    def test_pending_command_includes_all_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Pending command includes all required fields."""
        # Create server and action
        client.post(
            "/api/v1/servers",
            json={"id": "fields-test-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "fields-test-server",
                "action_type": "restart_service",
                "service_name": "test-service",
            },
            headers=auth_headers,
        ).json()

        # Send heartbeat
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "fields-test-server",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        cmd = response.json()["pending_commands"][0]
        assert cmd["action_id"] == action["id"]
        assert cmd["action_type"] == "restart_service"
        assert cmd["command"] == "systemctl restart test-service"
        assert cmd["parameters"] == {"service_name": "test-service"}
        assert cmd["timeout_seconds"] == 30

    def test_empty_pending_commands_when_no_actions(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response has empty pending_commands when no actions exist."""
        # Create server with no actions
        client.post(
            "/api/v1/servers",
            json={"id": "no-actions-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-actions-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        data = response.json()
        assert data["pending_commands"] == []


# =============================================================================
# TC161: Command results update action status (AC4, AC5)
# =============================================================================


class TestCommandResultsUpdateStatus:
    """TC161: Command results update action status."""

    def test_successful_result_sets_status_completed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Successful result (exit_code=0) sets status to completed (AC5)."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "completed-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "completed-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        # Deliver action via heartbeat
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "completed-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send result in next heartbeat
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "completed-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 0,
                        "stdout": "",
                        "stderr": "",
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:32Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert action["id"] in response.json()["results_acknowledged"]

        # Verify action status
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_after["status"] == "completed"
        assert action_after["exit_code"] == 0

    def test_failed_result_sets_status_failed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Failed result (exit_code!=0) sets status to failed (AC5)."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "failed-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "failed-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()

        # Deliver action via heartbeat
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "failed-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send failed result
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "failed-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 1,
                        "stdout": "",
                        "stderr": "Job for sonarr.service failed",
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:32Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        # Verify action status
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_after["status"] == "failed"
        assert action_after["exit_code"] == 1
        assert action_after["stderr"] == "Job for sonarr.service failed"

    def test_result_stores_stdout_stderr(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Result stores stdout and stderr in database."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "output-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "output-test",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        ).json()

        # Deliver action via heartbeat
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "output-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send result with output
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "output-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 0,
                        "stdout": "Service restarted successfully",
                        "stderr": "Warning: some non-fatal issue",
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:32Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        # Verify output stored
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_after["stdout"] == "Service restarted successfully"
        assert action_after["stderr"] == "Warning: some non-fatal issue"

    def test_result_sets_completed_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Result sets completed_at timestamp."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "timestamp-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "timestamp-test",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        ).json()

        # Deliver action via heartbeat
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "timestamp-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send result
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "timestamp-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 0,
                        "stdout": "",
                        "stderr": "",
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:35Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        # Verify timestamp
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_after["completed_at"] is not None

    def test_result_for_unknown_action_ignored(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Result for unknown action is ignored (doesn't fail heartbeat)."""
        # Create server only (no action)
        client.post(
            "/api/v1/servers",
            json={"id": "unknown-action-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Send result for non-existent action
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "unknown-action-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": 999999,
                        "exit_code": 0,
                        "stdout": "",
                        "stderr": "",
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:32Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert 999999 not in response.json()["results_acknowledged"]

    def test_duplicate_result_handled_gracefully(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Duplicate result submission is idempotent."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "duplicate-result-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "duplicate-result-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        # Deliver action
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "duplicate-result-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send first result
        result_payload = {
            "action_id": action["id"],
            "exit_code": 0,
            "stdout": "",
            "stderr": "",
            "executed_at": "2026-01-18T10:31:30Z",
            "completed_at": "2026-01-18T10:31:32Z",
        }
        response1 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "duplicate-result-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [result_payload],
            },
            headers=auth_headers,
        )
        assert response1.status_code == 200
        assert action["id"] in response1.json()["results_acknowledged"]

        # Send duplicate result - should be ignored but not fail
        response2 = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "duplicate-result-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [result_payload],
            },
            headers=auth_headers,
        )
        assert response2.status_code == 200
        # Action already completed, so not acknowledged again
        assert action["id"] not in response2.json()["results_acknowledged"]

    def test_result_with_no_command_results_field(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat without command_results field still works."""
        client.post(
            "/api/v1/servers",
            json={"id": "no-results-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-results-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["results_acknowledged"] == []


# =============================================================================
# Additional tests: Output truncation
# =============================================================================


class TestOutputTruncation:
    """Tests for output size limits (10KB)."""

    def test_large_stdout_truncated(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Large stdout is truncated to 10KB."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "truncate-stdout-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "truncate-stdout-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        # Deliver action
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "truncate-stdout-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send result with very large stdout (15KB)
        large_output = "x" * 15000
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "truncate-stdout-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 0,
                        "stdout": large_output,
                        "stderr": "",
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:32Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        # Verify truncation
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert len(action_after["stdout"]) == 10000

    def test_large_stderr_truncated(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Large stderr is truncated to 10KB."""
        # Create server and deliver action
        client.post(
            "/api/v1/servers",
            json={"id": "truncate-stderr-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "truncate-stderr-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()

        # Deliver action
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "truncate-stderr-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Send result with very large stderr (15KB)
        large_error = "e" * 15000
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "truncate-stderr-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 1,
                        "stdout": "",
                        "stderr": large_error,
                        "executed_at": "2026-01-18T10:31:30Z",
                        "completed_at": "2026-01-18T10:31:32Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        # Verify truncation
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert len(action_after["stderr"]) == 10000


# =============================================================================
# Response format tests
# =============================================================================


class TestHeartbeatResponseFormat:
    """Tests for heartbeat response format with command channel."""

    def test_response_has_results_acknowledged_field(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat response includes results_acknowledged field."""
        client.post(
            "/api/v1/servers",
            json={"id": "ack-field-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "ack-field-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        data = response.json()
        assert "results_acknowledged" in data
        assert isinstance(data["results_acknowledged"], list)

    def test_response_has_pending_commands_as_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat response has pending_commands as array."""
        client.post(
            "/api/v1/servers",
            json={"id": "cmds-array-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "cmds-array-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        data = response.json()
        assert "pending_commands" in data
        assert isinstance(data["pending_commands"], list)
