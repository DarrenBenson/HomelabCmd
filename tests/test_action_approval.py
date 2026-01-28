"""Tests for Action Approval API endpoints (US0026).

Test cases from TSP0009:
- TC165: POST /actions/{id}/approve approves pending action
- TC166: POST /actions/{id}/reject rejects pending action
- TC167: Cannot approve non-PENDING action
"""

from fastapi.testclient import TestClient

# =============================================================================
# TC165: POST /actions/{id}/approve approves pending action
# =============================================================================


class TestApproveAction:
    """TC165: POST /actions/{id}/approve approves pending action."""

    def test_approve_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """POST /actions/{id}/approve returns 200."""
        # Create paused server and pending action
        client.post(
            "/api/v1/servers",
            json={"id": "approve-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/approve-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approve-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_approve_changes_status_to_approved(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approve changes status to approved (AC1)."""
        # Create paused server and pending action
        client.post(
            "/api/v1/servers",
            json={"id": "approve-status-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/approve-status-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approve-status-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()
        assert action["status"] == "pending"

        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.json()["status"] == "approved"

    def test_approve_sets_approved_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approve sets approved_at timestamp (AC4)."""
        client.post(
            "/api/v1/servers",
            json={"id": "approved-at-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/approved-at-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approved-at-test",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        ).json()
        assert action["approved_at"] is None

        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.json()["approved_at"] is not None

    def test_approve_sets_approved_by_dashboard(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approve sets approved_by to 'dashboard' (AC4)."""
        client.post(
            "/api/v1/servers",
            json={"id": "approved-by-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/approved-by-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "approved-by-test",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        ).json()
        assert action["approved_by"] is None

        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.json()["approved_by"] == "dashboard"

    def test_approve_404_for_nonexistent_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Approve returns 404 for nonexistent action."""
        response = client.post(
            "/api/v1/actions/999999/approve",
            headers=auth_headers,
        )
        assert response.status_code == 404


# =============================================================================
# TC166: POST /actions/{id}/reject rejects pending action
# =============================================================================


class TestRejectAction:
    """TC166: POST /actions/{id}/reject rejects pending action."""

    def test_reject_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """POST /actions/{id}/reject returns 200."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Service recovered automatically"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_reject_changes_status_to_rejected(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Reject changes status to rejected (AC2)."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-status-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-status-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-status-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()
        assert action["status"] == "pending"

        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Not needed"},
            headers=auth_headers,
        )
        assert response.json()["status"] == "rejected"

    def test_reject_stores_reason(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Reject stores the rejection reason (AC2)."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-reason-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-reason-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-reason-test",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        ).json()

        reason = "Service recovered automatically - no action needed"
        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": reason},
            headers=auth_headers,
        )
        assert response.json()["rejection_reason"] == reason

    def test_reject_sets_rejected_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Reject sets rejected_at timestamp."""
        client.post(
            "/api/v1/servers",
            json={"id": "rejected-at-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/rejected-at-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "rejected-at-test",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        ).json()
        assert action["rejected_at"] is None

        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Not needed"},
            headers=auth_headers,
        )
        assert response.json()["rejected_at"] is not None

    def test_reject_sets_rejected_by_dashboard(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Reject sets rejected_by to 'dashboard'."""
        client.post(
            "/api/v1/servers",
            json={"id": "rejected-by-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/rejected-by-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "rejected-by-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()
        assert action["rejected_by"] is None

        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Not needed"},
            headers=auth_headers,
        )
        assert response.json()["rejected_by"] == "dashboard"

    def test_reject_requires_reason(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Reject returns 422 if reason not provided (AC5)."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-no-reason-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-no-reason-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-no-reason-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()

        # Empty body - no reason provided
        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_reject_requires_non_empty_reason(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Reject returns 422 if reason is empty string (AC5)."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-empty-reason-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-empty-reason-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-empty-reason-test",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        ).json()

        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_reject_404_for_nonexistent_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Reject returns 404 for nonexistent action."""
        response = client.post(
            "/api/v1/actions/999999/reject",
            json={"reason": "Not needed"},
            headers=auth_headers,
        )
        assert response.status_code == 404


# =============================================================================
# TC167: Cannot approve non-PENDING action
# =============================================================================


class TestCannotApproveNonPending:
    """TC167: Cannot approve non-PENDING action."""

    def test_cannot_approve_approved_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot approve already approved action (AC3)."""
        # Create normal server (action auto-approved)
        client.post(
            "/api/v1/servers",
            json={"id": "already-approved-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "already-approved-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()
        assert action["status"] == "approved"

        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.status_code == 409

    def test_cannot_approve_rejected_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot approve already rejected action (AC3)."""
        client.post(
            "/api/v1/servers",
            json={"id": "already-rejected-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/already-rejected-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "already-rejected-test",
                "action_type": "restart_service",
                "service_name": "sonarr",
            },
            headers=auth_headers,
        ).json()

        # Reject first
        client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Not needed"},
            headers=auth_headers,
        )

        # Try to approve
        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.status_code == 409

    def test_cannot_reject_approved_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot reject already approved action (AC3)."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-approved-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-approved-test",
                "action_type": "restart_service",
                "service_name": "radarr",
            },
            headers=auth_headers,
        ).json()
        assert action["status"] == "approved"

        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Changed my mind"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    def test_cannot_reject_rejected_action(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot reject already rejected action (AC3)."""
        client.post(
            "/api/v1/servers",
            json={"id": "reject-rejected-test", "hostname": "test.local"},
            headers=auth_headers,
        )
        client.put("/api/v1/servers/reject-rejected-test/pause", headers=auth_headers)

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "reject-rejected-test",
                "action_type": "restart_service",
                "service_name": "nginx",
            },
            headers=auth_headers,
        ).json()

        # Reject first
        client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Not needed"},
            headers=auth_headers,
        )

        # Try to reject again
        response = client.post(
            f"/api/v1/actions/{action['id']}/reject",
            json={"reason": "Different reason"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    def test_conflict_error_includes_current_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Conflict error message includes current status."""
        client.post(
            "/api/v1/servers",
            json={"id": "conflict-message-test", "hostname": "test.local"},
            headers=auth_headers,
        )

        action = client.post(
            "/api/v1/actions",
            json={
                "server_id": "conflict-message-test",
                "action_type": "restart_service",
                "service_name": "plex",
            },
            headers=auth_headers,
        ).json()

        response = client.post(
            f"/api/v1/actions/{action['id']}/approve",
            headers=auth_headers,
        )
        assert response.status_code == 409
        assert "approved" in response.json()["detail"]["message"]
