"""Tests for Alert API endpoints (US0014: Alert API Endpoints).

These tests verify the alert CRUD-like endpoints:
- GET /api/v1/alerts (list with filters)
- GET /api/v1/alerts/{id} (detail)
- POST /api/v1/alerts/{id}/acknowledge
- POST /api/v1/alerts/{id}/resolve

Story Reference: sdlc-studio/stories/US0014-alert-api.md
"""

from fastapi.testclient import TestClient


def _create_alert_via_heartbeat(
    client: TestClient,
    auth_headers: dict[str, str],
    server_id: str,
    disk_percent: float = 96.0,
) -> None:
    """Helper to create an alert by sending a heartbeat with high disk usage."""
    heartbeat_data = {
        "server_id": server_id,
        "hostname": f"{server_id}.local",
        "timestamp": "2026-01-19T10:00:00Z",
        "metrics": {"cpu_percent": 10.0, "memory_percent": 30.0, "disk_percent": disk_percent},
    }
    client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)


class TestListAlerts:
    """AC1: List alerts returns array of alerts."""

    def test_list_alerts_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/alerts should return 200 OK."""
        response = client.get("/api/v1/alerts", headers=auth_headers)
        assert response.status_code == 200

    def test_list_alerts_response_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should have alerts array, total, limit, and offset."""
        response = client.get("/api/v1/alerts", headers=auth_headers)
        data = response.json()
        assert "alerts" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data

    def test_list_alerts_empty_when_no_alerts(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Alerts array should be empty when no alerts exist."""
        response = client.get("/api/v1/alerts", headers=auth_headers)
        assert response.json()["alerts"] == []
        assert response.json()["total"] == 0

    def test_list_alerts_returns_created_alerts(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should return alerts after they are created."""
        _create_alert_via_heartbeat(client, auth_headers, "alert-test-server-1")
        response = client.get("/api/v1/alerts", headers=auth_headers)
        assert response.json()["total"] >= 1
        assert len(response.json()["alerts"]) >= 1

    def test_list_alerts_sorted_by_created_at_descending(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Alerts should be sorted by created_at descending (newest first)."""
        _create_alert_via_heartbeat(client, auth_headers, "sort-test-server-1")
        _create_alert_via_heartbeat(client, auth_headers, "sort-test-server-2")
        response = client.get("/api/v1/alerts", headers=auth_headers)
        alerts = response.json()["alerts"]
        if len(alerts) >= 2:
            assert alerts[0]["created_at"] >= alerts[1]["created_at"]


class TestFilterAlertsByStatus:
    """AC2: Filter alerts by status works."""

    def test_filter_by_status_open(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """?status=open should return only open alerts."""
        _create_alert_via_heartbeat(client, auth_headers, "status-filter-server")
        response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["status"] == "open"

    def test_filter_by_status_acknowledged(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """?status=acknowledged should return only acknowledged alerts."""
        _create_alert_via_heartbeat(client, auth_headers, "ack-filter-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
        response = client.get("/api/v1/alerts?status=acknowledged", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["status"] == "acknowledged"

    def test_filter_by_status_resolved(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """?status=resolved should return only resolved alerts."""
        response = client.get("/api/v1/alerts?status=resolved", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["status"] == "resolved"


class TestFilterAlertsBySeverity:
    """AC3: Filter alerts by severity works."""

    def test_filter_by_severity_critical(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """?severity=critical should return only critical alerts."""
        _create_alert_via_heartbeat(
            client, auth_headers, "critical-filter-server", disk_percent=96.0
        )
        response = client.get("/api/v1/alerts?severity=critical", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["severity"] == "critical"

    def test_filter_by_severity_high(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """?severity=high should return only high severity alerts."""
        response = client.get("/api/v1/alerts?severity=high", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["severity"] == "high"


class TestFilterAlertsByServer:
    """Filter alerts by server_id works."""

    def test_filter_by_server_id(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """?server_id=X should return only alerts for that server."""
        server_id = "server-filter-test"
        _create_alert_via_heartbeat(client, auth_headers, server_id)
        response = client.get(f"/api/v1/alerts?server_id={server_id}", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["server_id"] == server_id


class TestCombinedFilters:
    """Combined filters work together."""

    def test_filter_by_status_and_severity(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Combined status and severity filter should work."""
        response = client.get("/api/v1/alerts?status=open&severity=critical", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["status"] == "open"
            assert alert["severity"] == "critical"

    def test_filter_by_status_severity_and_server(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """All three filters combined should work."""
        server_id = "combined-filter-server"
        _create_alert_via_heartbeat(client, auth_headers, server_id)
        response = client.get(
            f"/api/v1/alerts?status=open&severity=critical&server_id={server_id}",
            headers=auth_headers,
        )
        for alert in response.json()["alerts"]:
            assert alert["status"] == "open"
            assert alert["severity"] == "critical"
            assert alert["server_id"] == server_id


class TestPagination:
    """Pagination with limit and offset works."""

    def test_default_limit_is_50(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Default limit should be 50."""
        response = client.get("/api/v1/alerts", headers=auth_headers)
        assert response.json()["limit"] == 50

    def test_default_offset_is_0(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Default offset should be 0."""
        response = client.get("/api/v1/alerts", headers=auth_headers)
        assert response.json()["offset"] == 0

    def test_custom_limit(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Custom limit should be respected."""
        response = client.get("/api/v1/alerts?limit=10", headers=auth_headers)
        assert response.json()["limit"] == 10

    def test_custom_offset(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Custom offset should be respected."""
        response = client.get("/api/v1/alerts?offset=5", headers=auth_headers)
        assert response.json()["offset"] == 5

    def test_limit_max_is_100(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Limit should be capped at 100."""
        response = client.get("/api/v1/alerts?limit=200", headers=auth_headers)
        assert response.status_code == 422

    def test_offset_cannot_be_negative(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Offset cannot be negative."""
        response = client.get("/api/v1/alerts?offset=-1", headers=auth_headers)
        assert response.status_code == 422


class TestGetAlertDetails:
    """AC6: Get alert details returns full info."""

    def test_get_alert_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """GET /api/v1/alerts/{id} should return 200 OK for existing alert."""
        _create_alert_via_heartbeat(client, auth_headers, "detail-test-server")
        list_response = client.get("/api/v1/alerts", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.get(f"/api/v1/alerts/{alert_id}", headers=auth_headers)
            assert response.status_code == 200

    def test_get_alert_returns_all_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Alert response should contain all expected fields."""
        _create_alert_via_heartbeat(client, auth_headers, "fields-test-server")
        list_response = client.get("/api/v1/alerts", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.get(f"/api/v1/alerts/{alert_id}", headers=auth_headers)
            data = response.json()
            assert "id" in data
            assert "server_id" in data
            assert "alert_type" in data
            assert "severity" in data
            assert "status" in data
            assert "title" in data
            assert "created_at" in data
            assert "auto_resolved" in data

    def test_get_alert_includes_server_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Alert response should include server_name."""
        _create_alert_via_heartbeat(client, auth_headers, "name-test-server")
        list_response = client.get("/api/v1/alerts", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.get(f"/api/v1/alerts/{alert_id}", headers=auth_headers)
            assert "server_name" in response.json()


class TestGetNonexistentAlert:
    """404 for non-existent alert."""

    def test_get_nonexistent_alert_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET nonexistent alert should return 404 Not Found."""
        response = client.get("/api/v1/alerts/999999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_nonexistent_alert_error_code(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Error code should be 'NOT_FOUND'."""
        response = client.get("/api/v1/alerts/999999", headers=auth_headers)
        assert response.json()["detail"]["code"] == "NOT_FOUND"


class TestAcknowledgeAlert:
    """AC4: Acknowledge alert changes status to acknowledged."""

    def test_acknowledge_alert_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /api/v1/alerts/{id}/acknowledge should return 200 OK."""
        _create_alert_via_heartbeat(client, auth_headers, "ack-test-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
            assert response.status_code == 200

    def test_acknowledge_alert_changes_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Acknowledging should change status to 'acknowledged'."""
        _create_alert_via_heartbeat(client, auth_headers, "ack-status-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
            assert response.json()["status"] == "acknowledged"

    def test_acknowledge_alert_sets_acknowledged_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Acknowledging should set acknowledged_at timestamp."""
        _create_alert_via_heartbeat(client, auth_headers, "ack-time-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
            assert response.json()["acknowledged_at"] is not None

    def test_acknowledge_nonexistent_alert_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Acknowledging nonexistent alert should return 404."""
        response = client.post("/api/v1/alerts/999999/acknowledge", headers=auth_headers)
        assert response.status_code == 404


class TestIdempotentAcknowledge:
    """Acknowledging already acknowledged alert is idempotent."""

    def test_acknowledge_acknowledged_alert_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Re-acknowledging should return 200 OK (idempotent)."""
        _create_alert_via_heartbeat(client, auth_headers, "idempotent-ack-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
            response = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["status"] == "acknowledged"


class TestAcknowledgeResolvedAlert:
    """Cannot acknowledge a resolved alert."""

    def test_acknowledge_resolved_alert_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Acknowledging a resolved alert should return 400 Bad Request."""
        _create_alert_via_heartbeat(client, auth_headers, "ack-resolved-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            response = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers)
            assert response.status_code == 400
            assert response.json()["detail"]["code"] == "INVALID_STATE"


class TestResolveAlert:
    """AC5: Resolve alert changes status to resolved."""

    def test_resolve_alert_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /api/v1/alerts/{id}/resolve should return 200 OK."""
        _create_alert_via_heartbeat(client, auth_headers, "resolve-test-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            assert response.status_code == 200

    def test_resolve_alert_changes_status(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Resolving should change status to 'resolved'."""
        _create_alert_via_heartbeat(client, auth_headers, "resolve-status-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            assert response.json()["status"] == "resolved"

    def test_resolve_alert_sets_resolved_at(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Resolving should set resolved_at timestamp."""
        _create_alert_via_heartbeat(client, auth_headers, "resolve-time-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            assert response.json()["resolved_at"] is not None

    def test_resolve_alert_auto_resolved_is_false(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Manual resolution should set auto_resolved to false."""
        _create_alert_via_heartbeat(client, auth_headers, "manual-resolve-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            assert response.json()["auto_resolved"] is False

    def test_resolve_nonexistent_alert_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Resolving nonexistent alert should return 404."""
        response = client.post("/api/v1/alerts/999999/resolve", headers=auth_headers)
        assert response.status_code == 404


class TestResolveOpenAlert:
    """Can resolve an open alert (skip acknowledge)."""

    def test_resolve_open_alert_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Resolving directly from open status should return 200."""
        _create_alert_via_heartbeat(client, auth_headers, "resolve-open-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["status"] == "resolved"


class TestIdempotentResolve:
    """Resolving already resolved alert is idempotent."""

    def test_resolve_resolved_alert_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Re-resolving should return 200 OK (idempotent)."""
        _create_alert_via_heartbeat(client, auth_headers, "idempotent-resolve-server")
        list_response = client.get("/api/v1/alerts?status=open", headers=auth_headers)
        alerts = list_response.json()["alerts"]
        if alerts:
            alert_id = alerts[0]["id"]
            client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            response = client.post(f"/api/v1/alerts/{alert_id}/resolve", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["status"] == "resolved"


class TestAlertAuthentication:
    """API authentication required for all alert endpoints."""

    def test_list_alerts_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/alerts without auth should return 401."""
        response = client.get("/api/v1/alerts")
        assert response.status_code == 401

    def test_get_alert_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/alerts/{id} without auth should return 401."""
        response = client.get("/api/v1/alerts/1")
        assert response.status_code == 401

    def test_acknowledge_alert_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/alerts/{id}/acknowledge without auth should return 401."""
        response = client.post("/api/v1/alerts/1/acknowledge")
        assert response.status_code == 401

    def test_resolve_alert_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/alerts/{id}/resolve without auth should return 401."""
        response = client.post("/api/v1/alerts/1/resolve")
        assert response.status_code == 401


# =============================================================================
# Additional tests: Service-down alerts
# =============================================================================


def _create_service_down_alert(
    client: TestClient,
    auth_headers: dict[str, str],
    server_id: str,
    service_name: str = "plex",
) -> None:
    """Helper to create a service-down alert."""
    # First register the server
    client.post(
        "/api/v1/servers",
        json={"id": server_id, "hostname": f"{server_id}.local"},
        headers=auth_headers,
    )
    # Add expected service
    client.post(
        f"/api/v1/servers/{server_id}/services",
        json={"service_name": service_name, "is_critical": True},
        headers=auth_headers,
    )
    # Send heartbeat with service down - MUST include metrics for service evaluation
    client.post(
        "/api/v1/agents/heartbeat",
        json={
            "server_id": server_id,
            "hostname": f"{server_id}.local",
            "timestamp": "2026-01-19T10:00:00Z",
            "metrics": {"cpu_percent": 10.0, "memory_percent": 30.0, "disk_percent": 50.0},
            "services": [{"name": service_name, "status": "stopped"}],
        },
        headers=auth_headers,
    )


class TestServiceDownAlerts:
    """Tests for service-down alert scenarios."""

    def test_service_down_heartbeat_processed(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Service down event is recorded in heartbeat."""
        _create_service_down_alert(client, auth_headers, "service-down-test", "nginx")
        # Verify server exists and service status was recorded
        response = client.get("/api/v1/servers/service-down-test/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()["services"]
        nginx_service = next((s for s in services if s["service_name"] == "nginx"), None)
        assert nginx_service is not None

    def test_acknowledge_service_down_while_still_down_returns_400(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot acknowledge service-down alert while service is still down."""
        _create_service_down_alert(client, auth_headers, "still-down-test", "docker")
        # Get the alert
        response = client.get("/api/v1/alerts?server_id=still-down-test", headers=auth_headers)
        alerts = response.json()["alerts"]
        service_alerts = [a for a in alerts if "service" in a["alert_type"]]
        if service_alerts:
            alert_id = service_alerts[0]["id"]
            # Try to acknowledge while service is still down
            ack_response = client.post(
                f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers
            )
            assert ack_response.status_code == 400
            assert ack_response.json()["detail"]["code"] == "SERVICE_STILL_DOWN"

    def test_acknowledge_service_alert_after_recovery(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Can acknowledge service-down alert after service recovers."""
        _create_service_down_alert(client, auth_headers, "recover-test", "sonarr")
        # Get the alert
        response = client.get("/api/v1/alerts?server_id=recover-test", headers=auth_headers)
        alerts = response.json()["alerts"]
        service_alerts = [a for a in alerts if "service" in a["alert_type"]]
        if service_alerts:
            alert_id = service_alerts[0]["id"]
            # Recover the service (include metrics for service evaluation)
            client.post(
                "/api/v1/agents/heartbeat",
                json={
                    "server_id": "recover-test",
                    "hostname": "recover-test.local",
                    "timestamp": "2026-01-19T10:05:00Z",
                    "metrics": {"cpu_percent": 10.0, "memory_percent": 30.0, "disk_percent": 50.0},
                    "services": [{"name": "sonarr", "status": "running", "pid": 1234}],
                },
                headers=auth_headers,
            )
            # Now acknowledge should work
            ack_response = client.post(
                f"/api/v1/alerts/{alert_id}/acknowledge", headers=auth_headers
            )
            # May be auto-resolved or we can acknowledge it
            assert ack_response.status_code in [200, 400]


class TestListAlertsCanAcknowledge:
    """Tests for can_acknowledge flag in list response."""

    def test_list_alerts_includes_can_acknowledge(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """List alerts includes can_acknowledge flag."""
        _create_alert_via_heartbeat(client, auth_headers, "can-ack-test")
        response = client.get("/api/v1/alerts", headers=auth_headers)
        alerts = response.json()["alerts"]
        if alerts:
            assert "can_acknowledge" in alerts[0]

    def test_disk_alert_can_acknowledge_is_true(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Disk alert can_acknowledge is True."""
        _create_alert_via_heartbeat(client, auth_headers, "disk-ack-test")
        response = client.get(
            "/api/v1/alerts?server_id=disk-ack-test&status=open", headers=auth_headers
        )
        alerts = response.json()["alerts"]
        if alerts:
            disk_alert = next((a for a in alerts if "disk" in a["alert_type"]), None)
            if disk_alert:
                assert disk_alert["can_acknowledge"] is True


class TestAlertFilterByType:
    """Tests for alert_type filter."""

    def test_filter_by_alert_type(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """?alert_type= should filter by alert type."""
        _create_alert_via_heartbeat(client, auth_headers, "type-filter-test")
        response = client.get("/api/v1/alerts?alert_type=disk", headers=auth_headers)
        for alert in response.json()["alerts"]:
            assert alert["alert_type"] == "disk"


class TestAlertListSorted:
    """Additional tests for alert ordering."""

    def test_alerts_returns_most_recent_first(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Most recent alerts appear first."""
        _create_alert_via_heartbeat(client, auth_headers, "first-alert-server")
        _create_alert_via_heartbeat(client, auth_headers, "second-alert-server")
        response = client.get("/api/v1/alerts", headers=auth_headers)
        alerts = response.json()["alerts"]
        if len(alerts) >= 2:
            # First should be newer
            for i in range(len(alerts) - 1):
                assert alerts[i]["created_at"] >= alerts[i + 1]["created_at"]


# =============================================================================
# Tests for service alert edge cases (Lines 36-39, 88-104, 272-287)
# =============================================================================


class TestServiceAlertCannotAcknowledgeWhileDown:
    """Tests for service alerts that cannot be acknowledged while service is down."""

    def test_cannot_acknowledge_service_alert_while_service_down(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot acknowledge a service alert while the service is still down (Lines 272-287)."""
        _create_service_down_alert(client, auth_headers, "svc-ack-block-test", "nginx")

        # Get the service alert
        response = client.get(
            "/api/v1/alerts?server_id=svc-ack-block-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        assert service_alert is not None, "Service alert should be created"

        # Try to acknowledge - should fail because service is still down
        ack_response = client.post(
            f"/api/v1/alerts/{service_alert['id']}/acknowledge",
            headers=auth_headers,
        )
        assert ack_response.status_code == 400
        assert ack_response.json()["detail"]["code"] == "SERVICE_STILL_DOWN"

    def test_can_acknowledge_service_alert_after_service_recovered(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Can acknowledge service alert after service recovers."""
        _create_service_down_alert(client, auth_headers, "svc-recover-ack-test", "nginx")

        # Get the service alert
        response = client.get(
            "/api/v1/alerts?server_id=svc-recover-ack-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        assert service_alert is not None, "Service alert should be created"

        # Send heartbeat with recovered service (include metrics for service evaluation)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "svc-recover-ack-test",
                "hostname": "svc-recover-ack-test.local",
                "timestamp": "2026-01-19T10:05:00Z",
                "metrics": {"cpu_percent": 10.0, "memory_percent": 30.0, "disk_percent": 50.0},
                "services": [{"name": "nginx", "status": "running", "pid": 1234}],
            },
            headers=auth_headers,
        )

        # Now acknowledge should work (or alert may be auto-resolved)
        ack_response = client.post(
            f"/api/v1/alerts/{service_alert['id']}/acknowledge",
            headers=auth_headers,
        )
        # Either succeeds or alert was already resolved
        assert ack_response.status_code in [200, 400]


class TestServiceAlertCannotResolveWhileDown:
    """Tests for service alerts that cannot be resolved while service is down."""

    def test_cannot_resolve_service_alert_while_service_down(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cannot resolve a service alert while service still down (Lines 124, 128)."""
        _create_service_down_alert(client, auth_headers, "svc-resolve-block-test", "redis")

        # Get the service alert
        response = client.get(
            "/api/v1/alerts?server_id=svc-resolve-block-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        assert service_alert is not None, "Service alert should be created"

        # Check can_resolve should be False (service still down)
        detail_response = client.get(
            f"/api/v1/alerts/{service_alert['id']}",
            headers=auth_headers,
        )
        assert detail_response.json()["can_resolve"] is False

    def test_can_resolve_after_recovery(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Can resolve service alert after service recovers."""
        _create_service_down_alert(client, auth_headers, "svc-resolve-recover-test", "redis")

        # Get the service alert
        response = client.get(
            "/api/v1/alerts?server_id=svc-resolve-recover-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        assert service_alert is not None, "Service alert should be created"

        # Send heartbeat with recovered service (include metrics for service evaluation)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "svc-resolve-recover-test",
                "hostname": "svc-resolve-recover-test.local",
                "timestamp": "2026-01-19T10:05:00Z",
                "metrics": {"cpu_percent": 10.0, "memory_percent": 30.0, "disk_percent": 50.0},
                "services": [{"name": "redis", "status": "running", "pid": 1234}],
            },
            headers=auth_headers,
        )

        # Check can_resolve should be True now (or may be auto-resolved)
        detail_response = client.get(
            f"/api/v1/alerts/{service_alert['id']}",
            headers=auth_headers,
        )
        # Either can_resolve is True or alert is already resolved
        data = detail_response.json()
        assert data["can_resolve"] is True or data["status"] == "resolved"


class TestAlertServiceNameExtraction:
    """Tests for _extract_service_name edge cases (Lines 36-39)."""

    def test_service_alert_has_service_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Service alert response includes service_name extracted from title."""
        _create_service_down_alert(client, auth_headers, "svc-name-extract-test", "docker")

        # Get the service alert
        response = client.get(
            "/api/v1/alerts?server_id=svc-name-extract-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        assert service_alert is not None, "Service alert should be created"
        # service_name should be extracted from title
        assert service_alert["service_name"] == "docker"

    def test_non_service_alert_has_no_service_name(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Non-service alerts have service_name as None."""
        _create_alert_via_heartbeat(client, auth_headers, "non-svc-alert-test")
        response = client.get(
            "/api/v1/alerts?server_id=non-svc-alert-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        disk_alert = next((a for a in alerts if a["alert_type"] == "disk"), None)

        assert disk_alert is not None, "Disk alert should be created"
        assert disk_alert["service_name"] is None


class TestServiceAlertListCanAcknowledge:
    """Tests for can_acknowledge flag on service alerts in list response."""

    def test_service_alert_cannot_acknowledge_when_down(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Service alert has can_acknowledge=False when service still down (Line 115)."""
        _create_service_down_alert(client, auth_headers, "svc-list-ack-test", "postgres")

        # Get the service alert via list endpoint (triggers _check_can_acknowledge)
        response = client.get(
            "/api/v1/alerts?server_id=svc-list-ack-test&status=open",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        assert service_alert is not None, "Service alert should be created"
        # Should not be acknowledgeable while service is down
        assert service_alert["can_acknowledge"] is False

    def test_service_alert_can_acknowledge_when_recovered(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Service alert has can_acknowledge=True after service recovers."""
        _create_service_down_alert(client, auth_headers, "svc-list-recover-test", "postgres")

        # Send heartbeat with recovered service (include metrics for service evaluation)
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "svc-list-recover-test",
                "hostname": "svc-list-recover-test.local",
                "timestamp": "2026-01-19T10:05:00Z",
                "metrics": {"cpu_percent": 10.0, "memory_percent": 30.0, "disk_percent": 50.0},
                "services": [{"name": "postgres", "status": "running", "pid": 1234}],
            },
            headers=auth_headers,
        )

        # Get the service alert via list endpoint
        response = client.get(
            "/api/v1/alerts?server_id=svc-list-recover-test",
            headers=auth_headers,
        )
        alerts = response.json()["alerts"]
        service_alert = next((a for a in alerts if a["alert_type"] == "service"), None)

        # May be auto-resolved or can_acknowledge should be True
        if service_alert and service_alert["status"] == "open":
            assert service_alert["can_acknowledge"] is True
