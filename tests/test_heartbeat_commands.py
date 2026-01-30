"""Tests for Heartbeat Command Channel Deprecation (US0152).

These tests verify backward compatibility with v1.0 agents during the
migration to synchronous SSH command execution (EP0013).

Test cases from TS0191:
- TC01: Heartbeat without command_results accepted
- TC02: Response has empty pending_commands (always)
- TC05: V1.0 agent heartbeat with command_results accepted
- TC06: Deprecation warning contains agent info
"""

import logging
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

# =============================================================================
# TC01/TC02: New v2.0 agent heartbeat format
# =============================================================================


class TestV2AgentHeartbeat:
    """Tests for v2.0 agent heartbeat format (no command channel)."""

    def test_heartbeat_without_command_results_accepted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC01: V2.0 heartbeat without command_results is valid."""
        client.post(
            "/api/v1/servers",
            json={"id": "v2-agent-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "v2-agent-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "metrics": {
                    "cpu_percent": 45.5,
                    "memory_percent": 62.0,
                    "disk_percent": 78.0,
                },
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_heartbeat_response_always_has_empty_pending_commands(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC02: Response always returns empty pending_commands array."""
        # Create server with an approved action
        client.post(
            "/api/v1/servers",
            json={"id": "empty-commands-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        # Create action that would have been delivered in v1.0
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "empty-commands-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        )

        # Send heartbeat - should return empty pending_commands even with approved action
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "empty-commands-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "pending_commands" in data
        assert data["pending_commands"] == []  # Always empty in v2.0

    def test_approved_action_not_delivered_via_heartbeat(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """US0152: Approved actions are no longer delivered via heartbeat."""
        # Create server and approved action
        client.post(
            "/api/v1/servers",
            json={"id": "no-delivery-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "no-delivery-test",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        ).json()

        # Verify action is approved
        action_before = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_before["status"] == "approved"

        # Send heartbeat
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "no-delivery-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["pending_commands"] == []

        # Verify action status is STILL approved (not changed to executing)
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_after["status"] == "approved"  # Not 'executing'


# =============================================================================
# TC05/TC06: Backward compatibility with v1.0 agents
# =============================================================================


class TestV1AgentBackwardCompatibility:
    """Tests for backward compatibility with v1.0 agents."""

    def test_heartbeat_with_command_results_accepted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC05: V1.0 heartbeat with command_results is accepted (backward compat)."""
        client.post(
            "/api/v1/servers",
            json={"id": "v1-agent-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        # V1.0 agent sends command_results (deprecated)
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "v1-agent-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "metrics": {
                    "cpu_percent": 45.5,
                    "memory_percent": 62.0,
                    "disk_percent": 78.0,
                },
                "command_results": [
                    {
                        "action_id": 123,
                        "exit_code": 0,
                        "stdout": "Service restarted",
                        "stderr": "",
                        "executed_at": "2026-01-29T11:59:00Z",
                        "completed_at": "2026-01-29T11:59:01Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        # Results are ignored but heartbeat succeeds
        assert data["results_acknowledged"] == []

    def test_deprecation_warning_logged_for_command_results(
        self, client: TestClient, auth_headers: dict[str, str], caplog: "pytest.LogCaptureFixture"
    ) -> None:
        """TC06: Deprecation warning logged when v1.0 agent sends command_results."""
        client.post(
            "/api/v1/servers",
            json={"id": "deprecation-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        with caplog.at_level(logging.WARNING):
            response = client.post(
                "/api/v1/agents/heartbeat",
                json={
                    "server_id": "deprecation-test",
                    "hostname": "test.local",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "command_results": [
                        {
                            "action_id": 456,
                            "exit_code": 0,
                            "stdout": "",
                            "stderr": "",
                            "executed_at": "2026-01-29T12:00:00Z",
                            "completed_at": "2026-01-29T12:00:01Z",
                        }
                    ],
                },
                headers=auth_headers,
            )

        assert response.status_code == 200

        # Verify deprecation warning was logged
        warning_logged = any(
            "deprecation-test" in record.message
            and "deprecated" in record.message.lower()
            and "command_results" in record.message
            for record in caplog.records
        )
        assert warning_logged, "Expected deprecation warning with server_id and 'command_results'"

    def test_command_results_ignored_not_processed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC05: Command results from v1.0 agents are ignored (not processed)."""
        # Create server and an approved action
        client.post(
            "/api/v1/servers",
            json={"id": "ignored-results-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "ignored-results-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        # Send heartbeat with command_results for this action
        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "ignored-results-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action["id"],
                        "exit_code": 0,
                        "stdout": "Service restarted",
                        "stderr": "",
                        "executed_at": "2026-01-29T12:00:00Z",
                        "completed_at": "2026-01-29T12:00:01Z",
                    }
                ],
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        # Results should NOT be acknowledged (they're ignored)
        assert action["id"] not in response.json()["results_acknowledged"]

        # Verify action status was NOT updated
        action_after = client.get(f"/api/v1/actions/{action['id']}", headers=auth_headers).json()
        assert action_after["status"] == "approved"  # Not 'completed'

    def test_empty_command_results_no_warning(
        self, client: TestClient, auth_headers: dict[str, str], caplog: "pytest.LogCaptureFixture"
    ) -> None:
        """Empty command_results array doesn't trigger deprecation warning."""
        client.post(
            "/api/v1/servers",
            json={"id": "empty-results-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        with caplog.at_level(logging.WARNING):
            response = client.post(
                "/api/v1/agents/heartbeat",
                json={
                    "server_id": "empty-results-test",
                    "hostname": "test.local",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "command_results": [],  # Empty array
                },
                headers=auth_headers,
            )

        assert response.status_code == 200

        # No deprecation warning for empty array
        deprecation_logged = any(
            "deprecated" in record.message.lower() and "empty-results-test" in record.message
            for record in caplog.records
        )
        assert not deprecation_logged


# =============================================================================
# TC08: Metrics continue flowing after migration
# =============================================================================


class TestMetricsContinueFlowing:
    """Tests that metrics continue working after command channel removal."""

    def test_metrics_recorded_with_v2_format(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """TC08: Metrics recorded correctly with v2.0 heartbeat format."""
        client.post(
            "/api/v1/servers",
            json={"id": "metrics-v2-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "metrics-v2-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "metrics": {
                    "cpu_percent": 45.5,
                    "memory_percent": 62.0,
                    "disk_percent": 78.0,
                },
            },
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify server status updated
        server = client.get("/api/v1/servers/metrics-v2-test", headers=auth_headers).json()
        assert server["status"] == "online"
        assert server["last_seen"] is not None

    def test_server_status_updated_without_metrics(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server status updated even without metrics payload."""
        client.post(
            "/api/v1/servers",
            json={"id": "status-only-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "status-only-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify server is online
        server = client.get("/api/v1/servers/status-only-test", headers=auth_headers).json()
        assert server["status"] == "online"


# =============================================================================
# Response format tests (still applicable)
# =============================================================================


class TestHeartbeatResponseFormat:
    """Tests for heartbeat response format with deprecated command channel."""

    def test_response_has_results_acknowledged_field(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat response includes results_acknowledged field (for v1.0 compat)."""
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
        assert data["results_acknowledged"] == []  # Always empty in v2.0

    def test_response_has_pending_commands_as_empty_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Heartbeat response has pending_commands as empty array."""
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
        assert data["pending_commands"] == []  # Always empty in v2.0
