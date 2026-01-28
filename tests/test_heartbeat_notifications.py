"""Tests for Heartbeat Notification Integration (US0012).

These tests verify that the heartbeat endpoint correctly sends notifications
to the SlackNotifier when alert events are triggered.

Spec Reference:
- sdlc-studio/stories/US0012-alert-deduplication.md
"""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


class TestHeartbeatSendsNotifications:
    """Test that heartbeat endpoint sends notifications for alert events."""

    def test_heartbeat_sends_notification_on_disk_alert(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Disk breach should trigger notification (AC9)."""
        # Configure webhook URL in config first
        config_data = {
            "notifications": {
                "slack_webhook_url": "https://hooks.slack.com/test",
                "notify_on_critical": True,
                "notify_on_high": True,
                "notify_on_remediation": True,
            }
        }
        client.put(
            "/api/v1/config/notifications", json=config_data["notifications"], headers=auth_headers
        )

        with patch("homelab_cmd.api.routes.agents.get_notifier") as mock_get_notifier:
            mock_notifier = AsyncMock()
            mock_notifier.send_alert = AsyncMock(return_value=True)
            mock_get_notifier.return_value = mock_notifier

            # Send heartbeat with disk breach
            heartbeat_data = {
                "server_id": "test-notify-server",
                "hostname": "test-notify-server",
                "timestamp": "2026-01-19T10:30:00Z",
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 50.0,
                    "disk_percent": 85.0,  # Above 80% threshold
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

            # Verify notifier was called
            mock_get_notifier.assert_called_once_with("https://hooks.slack.com/test")
            assert mock_notifier.send_alert.called

            # Verify the event has correct data
            call_args = mock_notifier.send_alert.call_args
            event = call_args[0][0]  # First positional arg
            assert event.server_id == "test-notify-server"
            assert event.metric_type == "disk"
            assert event.severity == "high"
            assert not event.is_resolved

    def test_heartbeat_sends_resolution_notification_when_enabled(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Resolution notification should be sent when notify_on_remediation=True (AC9)."""
        # Configure webhook with remediation notifications enabled
        config_data = {
            "slack_webhook_url": "https://hooks.slack.com/test",
            "notify_on_critical": True,
            "notify_on_high": True,
            "notify_on_remediation": True,
        }
        client.put("/api/v1/config/notifications", json=config_data, headers=auth_headers)

        with patch("homelab_cmd.api.routes.agents.get_notifier") as mock_get_notifier:
            mock_notifier = AsyncMock()
            mock_notifier.send_alert = AsyncMock(return_value=True)
            mock_get_notifier.return_value = mock_notifier

            # First heartbeat - create alert
            heartbeat_data = {
                "server_id": "test-resolve-server",
                "hostname": "test-resolve-server",
                "timestamp": "2026-01-19T10:30:00Z",
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 50.0,
                    "disk_percent": 85.0,
                },
            }
            client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

            # Reset mock
            mock_notifier.send_alert.reset_mock()

            # Second heartbeat - resolve alert
            heartbeat_data["metrics"]["disk_percent"] = 70.0
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

            # Verify resolution notification was sent
            assert mock_notifier.send_alert.called
            call_args = mock_notifier.send_alert.call_args
            event = call_args[0][0]
            assert event.is_resolved

    def test_heartbeat_no_notification_without_webhook(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """No notification should be sent if webhook URL not configured."""
        # Clear any existing webhook config
        config_data = {
            "slack_webhook_url": "",  # Empty webhook
        }
        client.put("/api/v1/config/notifications", json=config_data, headers=auth_headers)

        with patch("homelab_cmd.api.routes.agents.get_notifier") as mock_get_notifier:
            # Send heartbeat with breach
            heartbeat_data = {
                "server_id": "test-no-webhook-server",
                "hostname": "test-no-webhook-server",
                "timestamp": "2026-01-19T10:30:00Z",
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 50.0,
                    "disk_percent": 85.0,
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

            # Verify notifier was NOT called (no webhook configured)
            mock_get_notifier.assert_not_called()

    def test_heartbeat_no_notification_when_below_threshold(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """No notification should be sent when metrics are below threshold."""
        config_data = {
            "slack_webhook_url": "https://hooks.slack.com/test",
        }
        client.put("/api/v1/config/notifications", json=config_data, headers=auth_headers)

        with patch("homelab_cmd.api.routes.agents.get_notifier") as mock_get_notifier:
            mock_notifier = AsyncMock()
            mock_notifier.send_alert = AsyncMock(return_value=True)
            mock_get_notifier.return_value = mock_notifier

            # Send heartbeat with normal metrics
            heartbeat_data = {
                "server_id": "test-normal-server",
                "hostname": "test-normal-server",
                "timestamp": "2026-01-19T10:30:00Z",
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 50.0,
                    "disk_percent": 50.0,  # Below threshold
                },
            }
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

            # Notifier should not be called (no events to send)
            # Note: get_notifier might be called but send_alert should not
            if mock_get_notifier.called:
                mock_notifier.send_alert.assert_not_called()


class TestHeartbeatDeduplication:
    """Test that duplicate alerts don't create duplicate notifications."""

    def test_no_duplicate_notification_within_cooldown(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Second breach within cooldown should not send notification (AC8)."""
        config_data = {
            "slack_webhook_url": "https://hooks.slack.com/test",
        }
        client.put("/api/v1/config/notifications", json=config_data, headers=auth_headers)

        with patch("homelab_cmd.api.routes.agents.get_notifier") as mock_get_notifier:
            mock_notifier = AsyncMock()
            mock_notifier.send_alert = AsyncMock(return_value=True)
            mock_get_notifier.return_value = mock_notifier

            # First heartbeat - creates alert and sends notification
            heartbeat_data = {
                "server_id": "test-dedup-server",
                "hostname": "test-dedup-server",
                "timestamp": "2026-01-19T10:30:00Z",
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 50.0,
                    "disk_percent": 85.0,
                },
            }
            client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

            first_call_count = mock_notifier.send_alert.call_count
            assert first_call_count == 1  # First alert notification

            # Second heartbeat - same breach, within cooldown
            response = client.post(
                "/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers
            )
            assert response.status_code == 200

            # Should NOT have sent another notification (deduplication)
            assert mock_notifier.send_alert.call_count == first_call_count


class TestHeartbeatAutoResolve:
    """Test auto-resolve notification flow."""

    def test_auto_resolve_sets_flag_and_notifies(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Auto-resolved alert should have auto_resolved=True and send notification (AC3)."""
        config_data = {
            "slack_webhook_url": "https://hooks.slack.com/test",
            "notify_on_remediation": True,
        }
        client.put("/api/v1/config/notifications", json=config_data, headers=auth_headers)

        with patch("homelab_cmd.api.routes.agents.get_notifier") as mock_get_notifier:
            mock_notifier = AsyncMock()
            mock_notifier.send_alert = AsyncMock(return_value=True)
            mock_get_notifier.return_value = mock_notifier

            # Create alert
            heartbeat_data = {
                "server_id": "test-autoresolve-server",
                "hostname": "test-autoresolve-server",
                "timestamp": "2026-01-19T10:30:00Z",
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 50.0,
                    "disk_percent": 85.0,
                },
            }
            client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

            # Reset and resolve
            mock_notifier.send_alert.reset_mock()
            heartbeat_data["metrics"]["disk_percent"] = 70.0
            client.post("/api/v1/agents/heartbeat", json=heartbeat_data, headers=auth_headers)

            # Verify resolved notification sent
            assert mock_notifier.send_alert.called
            event = mock_notifier.send_alert.call_args[0][0]
            assert event.is_resolved
            assert event.metric_type == "disk"
