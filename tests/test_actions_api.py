"""Tests for Action Queue API endpoints.

Test cases from TSP0009:
- TC152: Server model has is_paused flag
- TC153: PUT /servers/{id}/pause enables maintenance mode
- TC154: PUT /servers/{id}/unpause disables maintenance mode
- TC155: GET /actions lists all actions
- TC156: GET /actions/{id} returns action details
- TC157: Action on normal server auto-approves
- TC158: Action on paused server remains pending
- TC159: Command whitelist enforced
"""

from fastapi.testclient import TestClient

# =============================================================================
# TC152: Server model has is_paused flag
# =============================================================================


class TestServerIsPausedFlag:
    """TC152: Server model has is_paused flag."""

    def test_is_paused_in_server_response(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Server response includes is_paused field."""
        # Create a server
        client.post(
            "/api/v1/servers",
            json={"id": "is-paused-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        # Check the response includes is_paused
        response = client.get("/api/v1/servers/is-paused-test", headers=auth_headers)
        assert "is_paused" in response.json()

    def test_is_paused_defaults_to_false(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """is_paused defaults to False for new servers."""
        client.post(
            "/api/v1/servers",
            json={"id": "default-false-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/servers/default-false-test", headers=auth_headers)
        assert response.json()["is_paused"] is False


# =============================================================================
# TC153: PUT /servers/{id}/pause enables maintenance mode
# =============================================================================


class TestPauseServer:
    """TC153: PUT /servers/{id}/pause enables maintenance mode."""

    def test_pause_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """PUT /servers/{id}/pause returns 200."""
        client.post(
            "/api/v1/servers",
            json={"id": "pause-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.put("/api/v1/servers/pause-test/pause", headers=auth_headers)
        assert response.status_code == 200

    def test_pause_sets_is_paused_true(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Pause sets is_paused to True."""
        client.post(
            "/api/v1/servers",
            json={"id": "pause-true-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.put("/api/v1/servers/pause-true-test/pause", headers=auth_headers)
        assert response.json()["is_paused"] is True

    def test_pause_sets_paused_at(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Pause sets paused_at timestamp."""
        client.post(
            "/api/v1/servers",
            json={"id": "pause-at-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.put("/api/v1/servers/pause-at-test/pause", headers=auth_headers)
        assert response.json()["paused_at"] is not None

    def test_pause_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Pause returns 404 for nonexistent server."""
        response = client.put("/api/v1/servers/nonexistent/pause", headers=auth_headers)
        assert response.status_code == 404


# =============================================================================
# TC154: PUT /servers/{id}/unpause disables maintenance mode
# =============================================================================


class TestUnpauseServer:
    """TC154: PUT /servers/{id}/unpause disables maintenance mode."""

    def test_unpause_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """PUT /servers/{id}/unpause returns 200."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "unpause-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/unpause-test/pause", headers=auth_headers)

        response = client.put("/api/v1/servers/unpause-test/unpause", headers=auth_headers)
        assert response.status_code == 200

    def test_unpause_sets_is_paused_false(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Unpause sets is_paused to False."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "unpause-false-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/unpause-false-test/pause", headers=auth_headers)

        response = client.put("/api/v1/servers/unpause-false-test/unpause", headers=auth_headers)
        assert response.json()["is_paused"] is False

    def test_unpause_clears_paused_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Unpause clears paused_at timestamp."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "unpause-at-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/unpause-at-test/pause", headers=auth_headers)

        response = client.put("/api/v1/servers/unpause-at-test/unpause", headers=auth_headers)
        assert response.json()["paused_at"] is None

    def test_unpause_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Unpause returns 404 for nonexistent server."""
        response = client.put("/api/v1/servers/nonexistent/unpause", headers=auth_headers)
        assert response.status_code == 404


# =============================================================================
# TC155: GET /actions lists all actions
# =============================================================================


class TestListActions:
    """TC155: GET /actions lists all actions."""

    def test_list_actions_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /actions returns 200."""
        response = client.get("/api/v1/actions", headers=auth_headers)
        assert response.status_code == 200

    def test_list_actions_returns_actions_array(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response contains actions array."""
        response = client.get("/api/v1/actions", headers=auth_headers)
        data = response.json()
        assert "actions" in data
        assert isinstance(data["actions"], list)

    def test_list_actions_includes_pagination(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response includes pagination fields."""
        response = client.get("/api/v1/actions", headers=auth_headers)
        data = response.json()
        assert "total" in data
        assert "limit" in data
        assert "offset" in data

    def test_list_actions_supports_status_filter(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """List supports ?status filter."""
        # Create a server and action
        client.post(
            "/api/v1/servers",
            json={"id": "status-filter-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "status-filter-test",
                "action_type": "restart_service",
                "service_name": "test-service",
            },
            headers=auth_headers,
        )

        # Filter by status
        response = client.get("/api/v1/actions?status=approved", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for action in data["actions"]:
            assert action["status"] == "approved"

    def test_list_actions_supports_server_id_filter(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """List supports ?server_id filter."""
        # Create a server and action
        client.post(
            "/api/v1/servers",
            json={"id": "server-filter-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "server-filter-test",
                "action_type": "restart_service",
                "service_name": "filter-test",
            },
            headers=auth_headers,
        )

        response = client.get("/api/v1/actions?server_id=server-filter-test", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for action in data["actions"]:
            assert action["server_id"] == "server-filter-test"


# =============================================================================
# TC156: GET /actions/{id} returns action details
# =============================================================================


class TestGetAction:
    """TC156: GET /actions/{id} returns action details."""

    def test_get_action_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """GET /actions/{id} returns 200."""
        # Create a server and action
        client.post(
            "/api/v1/servers",
            json={"id": "get-action-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "get-action-test",
                "action_type": "restart_service",
                "service_name": "get-test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_get_action_returns_all_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Get returns all action fields."""
        # Create a server and action
        client.post(
            "/api/v1/servers",
            json={"id": "all-fields-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "all-fields-test",
                "action_type": "restart_service",
                "service_name": "fields-test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        response = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers)
        data = response.json()

        # Check required fields
        assert "id" in data
        assert "server_id" in data
        assert "action_type" in data
        assert "status" in data
        assert "command" in data
        assert "created_at" in data
        assert "created_by" in data

        # Check optional execution fields exist (even if null)
        assert "executed_at" in data
        assert "completed_at" in data
        assert "exit_code" in data
        assert "stdout" in data
        assert "stderr" in data

    def test_get_action_404_for_nonexistent(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Get returns 404 for nonexistent action."""
        response = client.get("/api/v1/actions/999999", headers=auth_headers)
        assert response.status_code == 404


# =============================================================================
# TC157: Action on normal server auto-approves
# =============================================================================


class TestNormalServerAutoApproval:
    """TC157: Action on normal server auto-approves."""

    def test_action_status_is_approved(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Action on normal server has status APPROVED."""
        # Create a normal server
        client.post(
            "/api/v1/servers",
            json={"id": "auto-approve-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "auto-approve-test",
                "action_type": "restart_service",
                "service_name": "auto-approve-test",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["status"] == "approved"

    def test_approved_by_is_auto(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """approved_by is 'auto' for auto-approved actions."""
        client.post(
            "/api/v1/servers",
            json={"id": "approved-by-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approved-by-test",
                "action_type": "restart_service",
                "service_name": "approved-by-test",
            },
            headers=auth_headers,
        )
        assert response.json()["approved_by"] == "auto"

    def test_approved_at_is_set(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """approved_at is set for auto-approved actions."""
        client.post(
            "/api/v1/servers",
            json={"id": "approved-at-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approved-at-test",
                "action_type": "restart_service",
                "service_name": "approved-at-test",
            },
            headers=auth_headers,
        )
        assert response.json()["approved_at"] is not None


# =============================================================================
# TC158: Action on paused server remains pending
# =============================================================================


class TestPausedServerPending:
    """TC158: Action on paused server remains pending."""

    def test_action_status_is_pending(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Action on paused server has status PENDING."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "pending-status-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/pending-status-test/pause", headers=auth_headers)

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "pending-status-test",
                "action_type": "restart_service",
                "service_name": "pending-test",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["status"] == "pending"

    def test_approved_by_is_null(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """approved_by is null for pending actions."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "null-approved-by-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/null-approved-by-test/pause", headers=auth_headers)

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "null-approved-by-test",
                "action_type": "restart_service",
                "service_name": "null-approved-test",
            },
            headers=auth_headers,
        )
        assert response.json()["approved_by"] is None

    def test_approved_at_is_null(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """approved_at is null for pending actions."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "null-approved-at-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/null-approved-at-test/pause", headers=auth_headers)

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "null-approved-at-test",
                "action_type": "restart_service",
                "service_name": "null-at-test",
            },
            headers=auth_headers,
        )
        assert response.json()["approved_at"] is None


# =============================================================================
# TC159: Command whitelist enforced
# =============================================================================


class TestCommandWhitelist:
    """TC159: Command whitelist enforced."""

    def test_invalid_action_type_returns_422(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Invalid action type returns 422."""
        client.post(
            "/api/v1/servers",
            json={"id": "invalid-type-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "invalid-type-test",
                "action_type": "dangerous_command",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422  # Pydantic validation for invalid enum

    def test_restart_service_is_whitelisted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """restart_service action type is whitelisted."""
        client.post(
            "/api/v1/servers",
            json={"id": "whitelist-restart-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "whitelist-restart-test",
                "action_type": "restart_service",
                "service_name": "whitelist-test",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert "systemctl restart" in response.json()["command"]

    def test_clear_logs_is_whitelisted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """clear_logs action type is whitelisted."""
        client.post(
            "/api/v1/servers",
            json={"id": "whitelist-logs-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "whitelist-logs-test",
                "action_type": "clear_logs",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert "journalctl" in response.json()["command"]


# =============================================================================
# Additional tests: Server-specific actions endpoint
# =============================================================================


class TestServerActions:
    """Tests for GET /servers/{id}/actions endpoint."""

    def test_server_actions_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /servers/{id}/actions returns 200."""
        client.post(
            "/api/v1/servers",
            json={"id": "server-actions-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.get("/api/v1/servers/server-actions-test/actions", headers=auth_headers)
        assert response.status_code == 200

    def test_server_actions_filters_by_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns only actions for the specified server."""
        client.post(
            "/api/v1/servers",
            json={"id": "server-filter-actions", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "server-filter-actions",
                "action_type": "restart_service",
                "service_name": "server-filter-test",
            },
            headers=auth_headers,
        )

        response = client.get("/api/v1/servers/server-filter-actions/actions", headers=auth_headers)
        data = response.json()

        for action in data["actions"]:
            assert action["server_id"] == "server-filter-actions"

    def test_server_actions_supports_status_filter(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Supports ?status filter."""
        client.post(
            "/api/v1/servers",
            json={"id": "status-filter-server", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "status-filter-server",
                "action_type": "restart_service",
                "service_name": "status-filter-test",
            },
            headers=auth_headers,
        )

        response = client.get(
            "/api/v1/servers/status-filter-server/actions?status=approved",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_server_actions_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Returns 404 for nonexistent server."""
        response = client.get("/api/v1/servers/nonexistent/actions", headers=auth_headers)
        assert response.status_code == 404


# =============================================================================
# Additional tests: Error cases
# =============================================================================


class TestActionErrorCases:
    """Additional error case tests."""

    def test_create_action_404_for_nonexistent_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Create action returns 404 for nonexistent server."""
        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "nonexistent-server",
                "action_type": "restart_service",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_restart_service_requires_service_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """restart_service action requires service_name."""
        client.post(
            "/api/v1/servers",
            json={"id": "missing-service-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "missing-service-test",
                "action_type": "restart_service",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_duplicate_pending_action_returns_409(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Duplicate pending action returns 409 Conflict."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "duplicate-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/duplicate-test/pause", headers=auth_headers)

        # Create first pending action
        response1 = client.post(
            "/api/v1/actions",
            json={
                "server_id": "duplicate-test",
                "action_type": "restart_service",
                "service_name": "duplicate-test",
            },
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Attempt to create duplicate
        response2 = client.post(
            "/api/v1/actions",
            json={
                "server_id": "duplicate-test",
                "action_type": "restart_service",
                "service_name": "duplicate-test",
            },
            headers=auth_headers,
        )
        assert response2.status_code == 409


# =============================================================================
# TC175: Action audit trail complete
# =============================================================================


class TestActionAuditTrail:
    """TC175: Action audit trail complete - verify full lifecycle tracking."""

    def test_complete_lifecycle_audit_trail(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Full action lifecycle has complete audit trail."""
        from datetime import UTC, datetime

        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "audit-trail-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        # 1. Create action - should be auto-approved
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "audit-trail-test",
                "action_type": "restart_service",
                "service_name": "audit-test",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        action = create_response.json()
        action_id = action["id"]

        # Verify created_at and created_by captured
        assert action["created_at"] is not None
        assert action["created_by"] == "dashboard"
        assert action["status"] == "approved"
        assert action["approved_at"] is not None
        assert action["approved_by"] == "auto"

        # 2. Deliver via heartbeat - transitions to executing
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "audit-trail-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # Verify executed_at captured
        action_executing = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers).json()
        assert action_executing["status"] == "executing"
        assert action_executing["executed_at"] is not None

        # 3. Report results - transitions to completed
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "audit-trail-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action_id,
                        "exit_code": 0,
                        "stdout": "Service restarted",
                        "stderr": "",
                        "executed_at": datetime.now(UTC).isoformat(),
                        "completed_at": datetime.now(UTC).isoformat(),
                    }
                ],
            },
            headers=auth_headers,
        )

        # 4. Verify complete audit trail
        final_action = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers).json()

        # All timestamps captured
        assert final_action["created_at"] is not None
        assert final_action["approved_at"] is not None
        assert final_action["executed_at"] is not None
        assert final_action["completed_at"] is not None

        # All actors captured
        assert final_action["created_by"] == "dashboard"
        assert final_action["approved_by"] == "auto"

        # Final status
        assert final_action["status"] == "completed"
        assert final_action["exit_code"] == 0

    def test_rejected_lifecycle_audit_trail(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Rejected action lifecycle has complete audit trail."""
        # Create and pause server
        client.post(
            "/api/v1/servers",
            json={"id": "reject-audit-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-audit-test/pause", headers=auth_headers)

        # 1. Create action - should be pending
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-audit-test",
                "action_type": "restart_service",
                "service_name": "reject-audit",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        action = create_response.json()
        action_id = action["id"]

        # Verify created_at and created_by captured
        assert action["created_at"] is not None
        assert action["created_by"] == "dashboard"
        assert action["status"] == "pending"

        # 2. Reject action
        client.post(
            f"/api/v1/actions/{action_id}/reject",
            json={"reason": "Service recovered automatically"},
            headers=auth_headers,
        )

        # 3. Verify rejection audit trail
        final_action = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers).json()

        assert final_action["status"] == "rejected"
        assert final_action["rejected_at"] is not None
        assert final_action["rejected_by"] == "dashboard"
        assert final_action["rejection_reason"] == "Service recovered automatically"

        # No execution timestamps
        assert final_action["executed_at"] is None
        assert final_action["completed_at"] is None

    def test_failed_lifecycle_audit_trail(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Failed action lifecycle has complete audit trail."""
        from datetime import UTC, datetime

        # Create server
        client.post(
            "/api/v1/servers",
            json={"id": "failed-audit-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        # 1. Create action
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "failed-audit-test",
                "action_type": "restart_service",
                "service_name": "failed-test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        # 2. Deliver via heartbeat
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "failed-audit-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
            },
            headers=auth_headers,
        )

        # 3. Report failure
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "failed-audit-test",
                "hostname": "test.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "command_results": [
                    {
                        "action_id": action_id,
                        "exit_code": 1,
                        "stdout": "",
                        "stderr": "Job for service failed",
                        "executed_at": datetime.now(UTC).isoformat(),
                        "completed_at": datetime.now(UTC).isoformat(),
                    }
                ],
            },
            headers=auth_headers,
        )

        # 4. Verify failed audit trail
        final_action = client.get(f"/api/v1/actions/{action_id}", headers=auth_headers).json()

        assert final_action["status"] == "failed"
        assert final_action["exit_code"] == 1
        assert final_action["stderr"] == "Job for service failed"
        assert final_action["completed_at"] is not None


# =============================================================================
# Additional tests: APT Actions and action_type filter
# =============================================================================


class TestAptActions:
    """Tests for APT action types."""

    def test_apt_update_is_whitelisted(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """apt_update action type is whitelisted."""
        create_server(client, auth_headers, "apt-update-test")
        response = client.post(
            "/api/v1/actions",
            json={"server_id": "apt-update-test", "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["command"] == "DEBIAN_FRONTEND=noninteractive apt-get update -q -o APT::Sandbox::User=root"

    def test_apt_upgrade_all_is_whitelisted(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """apt_upgrade_all action type is whitelisted."""
        create_server(client, auth_headers, "apt-upgrade-test")
        response = client.post(
            "/api/v1/actions",
            json={"server_id": "apt-upgrade-test", "action_type": "apt_upgrade_all"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["command"] == 'DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -q -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" -o APT::Sandbox::User=root'

    def test_apt_upgrade_security_no_packages(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """apt_upgrade_security returns echo when no security packages."""
        create_server(client, auth_headers, "apt-security-test")
        response = client.post(
            "/api/v1/actions",
            json={"server_id": "apt-security-test", "action_type": "apt_upgrade_security"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert "No security packages" in response.json()["command"]

    def test_apt_upgrade_security_with_packages(
        self, client: TestClient, auth_headers: dict[str, str], send_heartbeat
    ) -> None:
        """apt_upgrade_security builds command with security packages."""
        # Create server with security packages via heartbeat
        send_heartbeat(
            client,
            auth_headers,
            "apt-security-pkgs",
            packages=[
                {
                    "name": "openssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
                {
                    "name": "libssl",
                    "current_version": "1.0",
                    "new_version": "1.1",
                    "repository": "bookworm-security",
                    "is_security": True,
                },
            ],
        )
        response = client.post(
            "/api/v1/actions",
            json={"server_id": "apt-security-pkgs", "action_type": "apt_upgrade_security"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert "apt-get install -q -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\" -o APT::Sandbox::User=root" in response.json()["command"]
        assert "openssl" in response.json()["command"]
        assert "libssl" in response.json()["command"]

    def test_duplicate_apt_action_returns_409(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Duplicate APT action returns 409 Conflict."""
        create_server(client, auth_headers, "apt-dup-test")
        # Pause to keep action pending/approved
        client.put("/api/v1/servers/apt-dup-test/pause", headers=auth_headers)

        # Create first APT action
        response1 = client.post(
            "/api/v1/actions",
            json={"server_id": "apt-dup-test", "action_type": "apt_update"},
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Try to create another APT action - should conflict
        response2 = client.post(
            "/api/v1/actions",
            json={"server_id": "apt-dup-test", "action_type": "apt_upgrade_all"},
            headers=auth_headers,
        )
        assert response2.status_code == 409
        assert "APT action is already pending" in response2.json()["detail"]["message"]


class TestListActionsActionTypeFilter:
    """Tests for action_type filter in list_actions."""

    def test_list_actions_supports_action_type_filter(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """List supports ?action_type filter."""
        create_server(client, auth_headers, "action-type-filter")
        # Create different action types
        client.post(
            "/api/v1/actions",
            json={
                "server_id": "action-type-filter",
                "action_type": "restart_service",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        client.post(
            "/api/v1/actions",
            json={"server_id": "action-type-filter", "action_type": "clear_logs"},
            headers=auth_headers,
        )

        # Filter by action_type
        response = client.get("/api/v1/actions?action_type=restart_service", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for action in data["actions"]:
            assert action["action_type"] == "restart_service"


class TestApproveAction:
    """Tests for POST /actions/{id}/approve endpoint."""

    def test_approve_pending_action(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Can approve a pending action."""
        create_server(client, auth_headers, "approve-test")
        client.put("/api/v1/servers/approve-test/pause", headers=auth_headers)

        # Create pending action
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approve-test",
                "action_type": "restart_service",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        # Approve it
        response = client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert response.json()["approved_by"] == "dashboard"
        assert response.json()["approved_at"] is not None

    def test_approve_non_pending_returns_409(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Cannot approve a non-pending action."""
        create_server(client, auth_headers, "approve-conflict-test")

        # Create auto-approved action
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approve-conflict-test",
                "action_type": "restart_service",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        # Try to approve already approved action
        response = client.post(f"/api/v1/actions/{action_id}/approve", headers=auth_headers)
        assert response.status_code == 409

    def test_approve_nonexistent_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approve nonexistent action returns 404."""
        response = client.post("/api/v1/actions/999999/approve", headers=auth_headers)
        assert response.status_code == 404


class TestRejectAction:
    """Tests for POST /actions/{id}/reject endpoint."""

    def test_reject_pending_action(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Can reject a pending action with reason."""
        create_server(client, auth_headers, "reject-test")
        client.put("/api/v1/servers/reject-test/pause", headers=auth_headers)

        # Create pending action
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-test",
                "action_type": "restart_service",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        # Reject it
        response = client.post(
            f"/api/v1/actions/{action_id}/reject",
            json={"reason": "No longer needed"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"
        assert response.json()["rejected_by"] == "dashboard"
        assert response.json()["rejected_at"] is not None
        assert response.json()["rejection_reason"] == "No longer needed"

    def test_reject_non_pending_returns_409(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """Cannot reject a non-pending action."""
        create_server(client, auth_headers, "reject-conflict-test")

        # Create auto-approved action
        create_response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-conflict-test",
                "action_type": "restart_service",
                "service_name": "test",
            },
            headers=auth_headers,
        )
        action_id = create_response.json()["id"]

        # Try to reject already approved action
        response = client.post(
            f"/api/v1/actions/{action_id}/reject",
            json={"reason": "Testing"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    def test_reject_nonexistent_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Reject nonexistent action returns 404."""
        response = client.post(
            "/api/v1/actions/999999/reject",
            json={"reason": "Testing"},
            headers=auth_headers,
        )
        assert response.status_code == 404


# =============================================================================
# BG0011: Inactive servers should not allow action creation
# =============================================================================


class TestInactiveServerActions:
    """BG0011: Inactive servers should reject action creation.

    These tests use a synchronous approach by creating the server and then
    using a separate async test to verify the database state change.
    """

    def test_action_on_active_server_succeeds(
        self, client: TestClient, auth_headers: dict[str, str], create_server
    ) -> None:
        """BG0011: Active server still allows action creation."""
        create_server(client, auth_headers, "active-action-test")

        # Server is active by default (is_inactive=False)
        response = client.post(
            "/api/v1/actions",
            json={
                "server_id": "active-action-test",
                "action_type": "restart_service",
                "service_name": "test-service",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
