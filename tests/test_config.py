"""Tests for Configuration API (US0043: System Settings Configuration).

These tests verify the config endpoints for alert thresholds and notification settings.
Tests the new nested schema with per-metric threshold settings and cooldown configuration.

Spec Reference: sdlc-studio/stories/US0043-system-settings-configuration.md
"""

from fastapi.testclient import TestClient


class TestGetConfig:
    """Test GET /api/v1/config endpoint."""

    def test_get_config_returns_200(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """GET /api/v1/config should return 200 OK."""
        response = client.get("/api/v1/config", headers=auth_headers)
        assert response.status_code == 200

    def test_get_config_returns_thresholds_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain nested thresholds object."""
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert "thresholds" in data

        # Per-metric threshold objects
        for metric in ["cpu", "memory", "disk"]:
            assert metric in data["thresholds"]
            assert "high_percent" in data["thresholds"][metric]
            assert "critical_percent" in data["thresholds"][metric]
            assert "sustained_heartbeats" in data["thresholds"][metric]

        # Server offline setting
        assert "server_offline_seconds" in data["thresholds"]

    def test_get_config_returns_notifications_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should contain nested notifications object."""
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert "notifications" in data
        assert "slack_webhook_url" in data["notifications"]
        assert "cooldowns" in data["notifications"]
        assert "critical_minutes" in data["notifications"]["cooldowns"]
        assert "high_minutes" in data["notifications"]["cooldowns"]
        assert "notify_on_critical" in data["notifications"]
        assert "notify_on_high" in data["notifications"]
        assert "notify_on_remediation" in data["notifications"]

    def test_get_config_returns_default_thresholds(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should return sensible threshold defaults."""
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        thresholds = data["thresholds"]

        # CPU defaults: 85% high, 95% critical, 3 heartbeats
        assert thresholds["cpu"]["high_percent"] == 85
        assert thresholds["cpu"]["critical_percent"] == 95
        assert thresholds["cpu"]["sustained_heartbeats"] == 3

        # Memory defaults: 85% high, 95% critical, 3 heartbeats
        assert thresholds["memory"]["high_percent"] == 85
        assert thresholds["memory"]["critical_percent"] == 95
        assert thresholds["memory"]["sustained_heartbeats"] == 3

        # Disk defaults: 80% high, 95% critical, immediate (0 heartbeats)
        assert thresholds["disk"]["high_percent"] == 80
        assert thresholds["disk"]["critical_percent"] == 95
        assert thresholds["disk"]["sustained_heartbeats"] == 0

        # Server offline default: 180 seconds
        assert thresholds["server_offline_seconds"] == 180

    def test_get_config_returns_default_notifications(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should return sensible notification defaults."""
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        notifications = data["notifications"]

        # Slack webhook empty by default
        assert notifications["slack_webhook_url"] == ""

        # Cooldown defaults
        assert notifications["cooldowns"]["critical_minutes"] == 30
        assert notifications["cooldowns"]["high_minutes"] == 240

        # Notification toggles
        assert notifications["notify_on_critical"] is True
        assert notifications["notify_on_high"] is True
        assert notifications["notify_on_remediation"] is True

    def test_get_config_requires_auth(self, client: TestClient) -> None:
        """GET /api/v1/config without auth should return 401."""
        response = client.get("/api/v1/config")
        assert response.status_code == 401


class TestUpdateThresholds:
    """Test PUT /api/v1/config/thresholds endpoint."""

    def test_update_thresholds_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PUT /api/v1/config/thresholds should return 200 OK."""
        update_data = {"cpu": {"high_percent": 80}}
        response = client.put("/api/v1/config/thresholds", json=update_data, headers=auth_headers)
        assert response.status_code == 200

    def test_update_thresholds_returns_updated_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should list which fields were updated with dotted paths."""
        update_data = {"cpu": {"high_percent": 80}}
        response = client.put("/api/v1/config/thresholds", json=update_data, headers=auth_headers)
        data = response.json()
        assert "updated" in data
        assert "cpu.high_percent" in data["updated"]

    def test_update_thresholds_returns_new_values(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should return updated thresholds object."""
        update_data = {
            "cpu": {"high_percent": 80},
            "disk": {"critical_percent": 90},
        }
        response = client.put("/api/v1/config/thresholds", json=update_data, headers=auth_headers)
        data = response.json()
        assert data["thresholds"]["cpu"]["high_percent"] == 80
        assert data["thresholds"]["disk"]["critical_percent"] == 90

    def test_update_thresholds_persists(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updated thresholds should persist in database."""
        update_data = {"disk": {"high_percent": 75}}
        client.put("/api/v1/config/thresholds", json=update_data, headers=auth_headers)

        response = client.get("/api/v1/config", headers=auth_headers)
        assert response.json()["thresholds"]["disk"]["high_percent"] == 75

    def test_update_thresholds_partial_update_same_metric(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Partial updates within a metric should not affect other metric fields."""
        # First update cpu high_percent
        client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"high_percent": 80}},
            headers=auth_headers,
        )

        # Then update cpu sustained_heartbeats separately
        client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"sustained_heartbeats": 5}},
            headers=auth_headers,
        )

        # Verify both are set correctly
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert data["thresholds"]["cpu"]["high_percent"] == 80
        assert data["thresholds"]["cpu"]["sustained_heartbeats"] == 5
        # critical_percent should still be default
        assert data["thresholds"]["cpu"]["critical_percent"] == 95

    def test_update_thresholds_partial_update_different_metrics(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updates to one metric should not affect other metrics."""
        # Update cpu
        client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"high_percent": 80}},
            headers=auth_headers,
        )

        # Update memory
        client.put(
            "/api/v1/config/thresholds",
            json={"memory": {"high_percent": 75}},
            headers=auth_headers,
        )

        # Verify cpu not affected
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert data["thresholds"]["cpu"]["high_percent"] == 80
        assert data["thresholds"]["memory"]["high_percent"] == 75

    def test_update_thresholds_validates_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Invalid percentage values should be rejected."""
        # Test value > 100
        response = client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"high_percent": 150}},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # Test value < 0
        response = client.put(
            "/api/v1/config/thresholds",
            json={"memory": {"critical_percent": -10}},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_thresholds_validates_critical_higher_than_high(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Critical threshold must be higher than high threshold."""
        # Set high to 90, critical to 80 (invalid)
        response = client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"high_percent": 90, "critical_percent": 80}},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_thresholds_validates_offline_seconds(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """server_offline_seconds must be >= 30."""
        response = client.put(
            "/api/v1/config/thresholds",
            json={"server_offline_seconds": 10},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_thresholds_validates_sustained_heartbeats(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """sustained_heartbeats must be between 0 and 10."""
        response = client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"sustained_heartbeats": 15}},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_thresholds_requires_auth(self, client: TestClient) -> None:
        """PUT /api/v1/config/thresholds without auth should return 401."""
        response = client.put("/api/v1/config/thresholds", json={})
        assert response.status_code == 401


class TestUpdateNotifications:
    """Test PUT /api/v1/config/notifications endpoint."""

    def test_update_notifications_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """PUT /api/v1/config/notifications should return 200 OK."""
        update_data = {"slack_webhook_url": "https://hooks.slack.com/test"}
        response = client.put(
            "/api/v1/config/notifications", json=update_data, headers=auth_headers
        )
        assert response.status_code == 200

    def test_update_notifications_returns_updated_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should list which fields were updated."""
        update_data = {"notify_on_critical": False}
        response = client.put(
            "/api/v1/config/notifications", json=update_data, headers=auth_headers
        )
        data = response.json()
        assert "updated" in data
        assert "notify_on_critical" in data["updated"]

    def test_update_notifications_cooldowns_updated_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should list cooldown fields with dotted paths."""
        update_data = {"cooldowns": {"critical_minutes": 15}}
        response = client.put(
            "/api/v1/config/notifications", json=update_data, headers=auth_headers
        )
        data = response.json()
        assert "updated" in data
        assert "cooldowns.critical_minutes" in data["updated"]

    def test_update_notifications_returns_new_values(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Response should return updated notifications object."""
        update_data = {
            "slack_webhook_url": "https://hooks.slack.com/test",
            "notify_on_critical": False,
        }
        response = client.put(
            "/api/v1/config/notifications", json=update_data, headers=auth_headers
        )
        data = response.json()
        assert data["notifications"]["slack_webhook_url"] == "https://hooks.slack.com/test"
        assert data["notifications"]["notify_on_critical"] is False

    def test_update_notifications_cooldowns(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should be able to update cooldown settings."""
        update_data = {"cooldowns": {"critical_minutes": 15, "high_minutes": 120}}
        response = client.put(
            "/api/v1/config/notifications", json=update_data, headers=auth_headers
        )
        data = response.json()
        assert data["notifications"]["cooldowns"]["critical_minutes"] == 15
        assert data["notifications"]["cooldowns"]["high_minutes"] == 120

    def test_update_notifications_persists(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updated notifications should persist in database."""
        update_data = {"slack_webhook_url": "https://hooks.slack.com/persistent"}
        client.put("/api/v1/config/notifications", json=update_data, headers=auth_headers)

        response = client.get("/api/v1/config", headers=auth_headers)
        assert (
            response.json()["notifications"]["slack_webhook_url"]
            == "https://hooks.slack.com/persistent"
        )

    def test_update_notifications_partial_update(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Partial updates should not affect other fields."""
        # First update webhook
        client.put(
            "/api/v1/config/notifications",
            json={"slack_webhook_url": "https://hooks.slack.com/test"},
            headers=auth_headers,
        )

        # Then update notify_on_high separately
        client.put(
            "/api/v1/config/notifications",
            json={"notify_on_high": False},
            headers=auth_headers,
        )

        # Verify both are set correctly
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert data["notifications"]["slack_webhook_url"] == "https://hooks.slack.com/test"
        assert data["notifications"]["notify_on_high"] is False

    def test_update_notifications_partial_cooldown_update(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Partial cooldown updates should not affect other cooldown fields."""
        # First update critical_minutes
        client.put(
            "/api/v1/config/notifications",
            json={"cooldowns": {"critical_minutes": 15}},
            headers=auth_headers,
        )

        # Then update high_minutes separately
        client.put(
            "/api/v1/config/notifications",
            json={"cooldowns": {"high_minutes": 120}},
            headers=auth_headers,
        )

        # Verify both are set correctly
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert data["notifications"]["cooldowns"]["critical_minutes"] == 15
        assert data["notifications"]["cooldowns"]["high_minutes"] == 120

    def test_update_notifications_validates_cooldown_range(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Cooldown values must be within valid range."""
        # critical_minutes min is 5
        response = client.put(
            "/api/v1/config/notifications",
            json={"cooldowns": {"critical_minutes": 1}},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # high_minutes min is 15
        response = client.put(
            "/api/v1/config/notifications",
            json={"cooldowns": {"high_minutes": 5}},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # max is 1440 (24 hours)
        response = client.put(
            "/api/v1/config/notifications",
            json={"cooldowns": {"critical_minutes": 2000}},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_update_notifications_requires_auth(self, client: TestClient) -> None:
        """PUT /api/v1/config/notifications without auth should return 401."""
        response = client.put("/api/v1/config/notifications", json={})
        assert response.status_code == 401


class TestTestWebhook:
    """Test POST /api/v1/config/test-webhook endpoint."""

    def test_test_webhook_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/config/test-webhook without auth should return 401."""
        response = client.post(
            "/api/v1/config/test-webhook",
            json={"webhook_url": "https://hooks.slack.com/test"},
        )
        assert response.status_code == 401

    def test_test_webhook_handles_invalid_url(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test webhook should handle invalid URL and return failure."""
        response = client.post(
            "/api/v1/config/test-webhook",
            json={"webhook_url": "https://invalid.local/webhook"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    def test_test_webhook_returns_200(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test webhook endpoint should return 200 (even if webhook fails)."""
        # Use a URL that will fail but won't timeout
        response = client.post(
            "/api/v1/config/test-webhook",
            json={"webhook_url": "https://hooks.slack.com/services/invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Should have success field
        assert "success" in data

    def test_test_webhook_response_structure(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Test webhook response should have success and message/error fields."""
        response = client.post(
            "/api/v1/config/test-webhook",
            json={"webhook_url": "https://hooks.slack.com/services/invalid"},
            headers=auth_headers,
        )
        data = response.json()
        assert "success" in data
        # Either message (on success) or error (on failure) should be present
        assert "message" in data or "error" in data


class TestConfigWithExistingData:
    """Test config endpoints when data already exists in DB."""

    def test_get_config_returns_persisted_thresholds(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/config should return persisted threshold values."""
        # First update thresholds
        client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"high_percent": 70, "critical_percent": 85}},
            headers=auth_headers,
        )

        # Get config should show updated values
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert data["thresholds"]["cpu"]["high_percent"] == 70
        assert data["thresholds"]["cpu"]["critical_percent"] == 85

    def test_get_config_returns_persisted_notifications(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /api/v1/config should return persisted notification values."""
        # First update notifications
        client.put(
            "/api/v1/config/notifications",
            json={"slack_webhook_url": "https://hooks.slack.com/persisted"},
            headers=auth_headers,
        )

        # Get config should show updated values
        response = client.get("/api/v1/config", headers=auth_headers)
        data = response.json()
        assert data["notifications"]["slack_webhook_url"] == "https://hooks.slack.com/persisted"

    def test_update_thresholds_merges_with_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updating thresholds should merge with existing DB values."""
        # First update CPU thresholds
        client.put(
            "/api/v1/config/thresholds",
            json={"cpu": {"high_percent": 70}},
            headers=auth_headers,
        )

        # Then update memory thresholds
        response = client.put(
            "/api/v1/config/thresholds",
            json={"memory": {"high_percent": 75}},
            headers=auth_headers,
        )
        data = response.json()

        # Both should be updated
        assert data["thresholds"]["cpu"]["high_percent"] == 70
        assert data["thresholds"]["memory"]["high_percent"] == 75

    def test_update_notifications_merges_with_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Updating notifications should merge with existing DB values."""
        # First update webhook
        client.put(
            "/api/v1/config/notifications",
            json={"slack_webhook_url": "https://hooks.slack.com/merged"},
            headers=auth_headers,
        )

        # Then update cooldowns
        response = client.put(
            "/api/v1/config/notifications",
            json={"cooldowns": {"critical_minutes": 20}},
            headers=auth_headers,
        )
        data = response.json()

        # Both should be updated
        assert data["notifications"]["slack_webhook_url"] == "https://hooks.slack.com/merged"
        assert data["notifications"]["cooldowns"]["critical_minutes"] == 20


class TestUpdateThresholdsServerOffline:
    """Tests for server_offline_seconds threshold updates."""

    def test_update_server_offline_seconds(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should be able to update server_offline_seconds."""
        response = client.put(
            "/api/v1/config/thresholds",
            json={"server_offline_seconds": 300},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["thresholds"]["server_offline_seconds"] == 300
        assert "server_offline_seconds" in data["updated"]

    def test_server_offline_seconds_persists(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """server_offline_seconds should persist in database."""
        client.put(
            "/api/v1/config/thresholds",
            json={"server_offline_seconds": 240},
            headers=auth_headers,
        )

        response = client.get("/api/v1/config", headers=auth_headers)
        assert response.json()["thresholds"]["server_offline_seconds"] == 240


class TestUpdateAllNotificationFields:
    """Tests for updating all notification boolean fields."""

    def test_update_notify_on_high(self, client: TestClient, auth_headers: dict[str, str]) -> None:
        """Should be able to update notify_on_high."""
        response = client.put(
            "/api/v1/config/notifications",
            json={"notify_on_high": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notifications"]["notify_on_high"] is False

    def test_update_notify_on_remediation(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should be able to update notify_on_remediation."""
        response = client.put(
            "/api/v1/config/notifications",
            json={"notify_on_remediation": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["notifications"]["notify_on_remediation"] is False

    def test_update_multiple_notification_fields(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Should be able to update multiple notification fields at once."""
        response = client.put(
            "/api/v1/config/notifications",
            json={
                "slack_webhook_url": "https://hooks.slack.com/multi",
                "notify_on_critical": False,
                "notify_on_high": False,
                "notify_on_remediation": False,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notifications"]["slack_webhook_url"] == "https://hooks.slack.com/multi"
        assert data["notifications"]["notify_on_critical"] is False
        assert data["notifications"]["notify_on_high"] is False
        assert data["notifications"]["notify_on_remediation"] is False
