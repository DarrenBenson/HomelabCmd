"""Tests for Slack notifier alert functionality.

These tests verify the notification service:
- Conditional sending based on configuration
- Alert message formatting
- Resolved message formatting
- Retry queue logic
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from homelab_cmd.api.schemas.config import (
    NotificationsConfig,
)
from homelab_cmd.services.alerting import AlertEvent
from homelab_cmd.services.notifier import (
    COLOURS,
    MAX_QUEUE_SIZE,
    SlackNotifier,
)


class TestSendAlertConditionalLogic:
    """Tests for conditional notification sending."""

    @pytest.mark.asyncio
    async def test_skipped_when_not_configured(self) -> None:
        """Notification should be skipped when webhook URL is empty."""
        notifier = SlackNotifier(webhook_url="")
        config = NotificationsConfig()
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        result = await notifier.send_alert(event, config)
        assert result is False

    @pytest.mark.asyncio
    async def test_critical_skipped_when_disabled(self) -> None:
        """Critical notifications should be skipped when disabled."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_critical=False)
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        result = await notifier.send_alert(event, config)
        assert result is True  # Returns True because it was intentionally skipped

    @pytest.mark.asyncio
    async def test_high_skipped_when_disabled(self) -> None:
        """High severity notifications should be skipped when disabled."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_high=False)
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="high",
            current_value=86.0,
            threshold_value=85.0,
        )

        result = await notifier.send_alert(event, config)
        assert result is True  # Returns True because it was intentionally skipped

    @pytest.mark.asyncio
    async def test_resolved_skipped_when_disabled(self) -> None:
        """Resolved notifications should be skipped when disabled."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_remediation=False)
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="resolved",
            current_value=50.0,
            threshold_value=85.0,
            is_resolved=True,
            duration_minutes=15,
        )

        result = await notifier.send_alert(event, config)
        assert result is True  # Returns True because it was intentionally skipped

    @pytest.mark.asyncio
    async def test_auto_resolve_skipped_when_disabled(self) -> None:
        """Auto-resolve notifications should be skipped when disabled (US0182)."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_auto_resolve=False)
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="resolved",
            current_value=50.0,
            threshold_value=85.0,
            is_resolved=True,
            duration_minutes=15,
        )

        result = await notifier.send_alert(event, config)
        assert result is True  # Returns True because it was intentionally skipped


class TestAlertMessageFormatting:
    """Tests for alert message formatting."""

    def test_cpu_alert_format(self) -> None:
        """CPU alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        payload = notifier._format_alert_message(event)

        assert "attachments" in payload
        assert payload["attachments"][0]["color"] == COLOURS["critical"]
        blocks = payload["attachments"][0]["blocks"]
        # Check header contains CPU and Critical
        header_text = blocks[0]["text"]["text"]
        assert "Critical" in header_text
        assert "CPU" in header_text

    def test_memory_alert_format(self) -> None:
        """Memory alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="memory",
            severity="high",
            current_value=87.0,
            threshold_value=85.0,
        )

        payload = notifier._format_alert_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "High" in header_text
        assert "MEMORY" in header_text

    def test_disk_alert_format(self) -> None:
        """Disk alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="disk",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        payload = notifier._format_alert_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "DISK" in header_text

    def test_offline_alert_format(self) -> None:
        """Offline alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="offline",
            severity="critical",
            current_value=0,
            threshold_value=0,
        )

        payload = notifier._format_alert_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "Offline" in header_text

    def test_service_alert_format(self) -> None:
        """Service alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="service:nginx",
            severity="high",
            current_value=0,
            threshold_value=0,
        )

        payload = notifier._format_alert_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "Service Alert" in header_text

    def test_reminder_prefix(self) -> None:
        """Reminder alerts should have [Reminder] prefix."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
            is_reminder=True,
        )

        payload = notifier._format_alert_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "[Reminder]" in header_text


class TestResolvedMessageFormatting:
    """Tests for resolved notification formatting."""

    def test_resolved_cpu_message(self) -> None:
        """Resolved CPU alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="resolved",
            current_value=50.0,
            threshold_value=85.0,
            is_resolved=True,
            duration_minutes=15,
        )

        payload = notifier._format_resolved_message(event)

        assert payload["attachments"][0]["color"] == COLOURS["resolved"]
        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "Resolved" in header_text
        assert "CPU" in header_text

    def test_resolved_service_message(self) -> None:
        """Resolved service alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="service:nginx",
            severity="resolved",
            current_value=0,
            threshold_value=0,
            is_resolved=True,
            duration_minutes=5,
        )

        payload = notifier._format_resolved_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "Resolved" in header_text
        assert "nginx" in header_text

    def test_resolved_offline_message(self) -> None:
        """Resolved offline alert should be formatted correctly."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="offline",
            severity="resolved",
            current_value=0,
            threshold_value=0,
            is_resolved=True,
            duration_minutes=10,
        )

        payload = notifier._format_resolved_message(event)

        blocks = payload["attachments"][0]["blocks"]
        header_text = blocks[0]["text"]["text"]
        assert "Back Online" in header_text


class TestRetryLogic:
    """Tests for retry queue logic."""

    def test_queue_on_rate_limit(self) -> None:
        """Should queue notification when rate limited."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        notifier._queue_for_retry(event, attempt=1)

        assert len(notifier.retry_queue) == 1
        queued = notifier.retry_queue[0]
        assert queued.event == event
        assert queued.attempt == 2  # Next attempt number

    @pytest.mark.asyncio
    async def test_process_respects_delay(self) -> None:
        """Process should respect retry delays."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        # Queue an item that was just added
        notifier._queue_for_retry(event, attempt=1)

        # Processing immediately should not process (delay not elapsed)
        processed = await notifier.process_retry_queue()
        # The first retry delay is 5 seconds, so nothing should be processed yet
        assert processed == 0

    def test_overflow_drops_oldest(self) -> None:
        """Queue overflow should drop oldest notification."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")

        # Fill the queue to max capacity
        for i in range(MAX_QUEUE_SIZE):
            event = AlertEvent(
                server_id=f"server-{i}",
                server_name=f"Server {i}",
                metric_type="cpu",
                severity="critical",
                current_value=96.0,
                threshold_value=95.0,
            )
            notifier._queue_for_retry(event, attempt=1)

        # Get the first item's server_id before adding new one
        first_server_id = notifier.retry_queue[0].event.server_id

        # Add one more to trigger overflow
        new_event = AlertEvent(
            server_id="new-server",
            server_name="New Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )
        notifier._queue_for_retry(new_event, attempt=1)

        # Queue should still be at max size
        assert len(notifier.retry_queue) == MAX_QUEUE_SIZE

        # First item should have been dropped (oldest)
        assert notifier.retry_queue[0].event.server_id != first_server_id

        # New item should be at the end
        assert notifier.retry_queue[-1].event.server_id == "new-server"


class TestHTTPErrorHandling:
    """Tests for HTTP error and timeout handling (lines 183-201)."""

    @pytest.mark.asyncio
    async def test_http_status_error_queues_for_retry(self) -> None:
        """HTTPStatusError should queue for retry when under MAX_RETRIES."""
        from unittest.mock import Mock

        import httpx

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        # Create a proper mock request and response for httpx
        mock_request = Mock()
        mock_request.url = "https://hooks.slack.com/test"

        # Simulate a 500 server error - raise directly from post
        http_error = httpx.HTTPStatusError(
            "Server Error",
            request=mock_request,
            response=Mock(status_code=500),
        )

        with patch.object(notifier.client, "post", side_effect=http_error):
            result = await notifier.send_alert(event, config)
            assert result is False
            # Should have queued for retry
            assert len(notifier.retry_queue) == 1

    @pytest.mark.asyncio
    async def test_http_status_error_drops_after_max_retries(self) -> None:
        """HTTPStatusError should drop notification after MAX_RETRIES."""
        from unittest.mock import Mock

        import httpx

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        mock_request = Mock()
        mock_request.url = "https://hooks.slack.com/test"

        http_error = httpx.HTTPStatusError(
            "Server Error",
            request=mock_request,
            response=Mock(status_code=500),
        )

        payload = notifier._format_message(event)
        with patch.object(notifier.client, "post", side_effect=http_error):
            # Attempt 3 is MAX_RETRIES, should not queue
            result = await notifier._send_with_retry(event, payload, attempt=3)
            assert result is False
            # Should NOT have queued - notification dropped
            assert len(notifier.retry_queue) == 0

    @pytest.mark.asyncio
    async def test_timeout_error_queues_for_retry(self) -> None:
        """TimeoutException should queue for retry when under MAX_RETRIES."""
        import httpx

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        with patch.object(
            notifier.client, "post", side_effect=httpx.TimeoutException("Timeout")
        ):
            result = await notifier.send_alert(event, config)
            assert result is False
            # Should have queued for retry
            assert len(notifier.retry_queue) == 1

    @pytest.mark.asyncio
    async def test_timeout_error_drops_after_max_retries(self) -> None:
        """TimeoutException should drop notification after MAX_RETRIES."""
        import httpx

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        payload = notifier._format_message(event)
        with patch.object(
            notifier.client, "post", side_effect=httpx.TimeoutException("Timeout")
        ):
            # Attempt 3 is MAX_RETRIES, should not queue
            result = await notifier._send_with_retry(event, payload, attempt=3)
            assert result is False
            # Should NOT have queued - notification dropped
            assert len(notifier.retry_queue) == 0

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_false(self) -> None:
        """Unexpected Exception should return False without queueing."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        with patch.object(
            notifier.client, "post", side_effect=RuntimeError("Unexpected error")
        ):
            result = await notifier.send_alert(event, config)
            assert result is False
            # Should NOT have queued - unexpected errors are not retried
            assert len(notifier.retry_queue) == 0


class TestRetryQueueProcessing:
    """Tests for retry queue processing (lines 250-253)."""

    @pytest.mark.asyncio
    async def test_process_retry_queue_when_items_due(self) -> None:
        """Should process items when their delay has elapsed."""
        from datetime import timedelta

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        # Manually add an item with a past scheduled time
        from homelab_cmd.services.notifier import QueuedNotification

        past_time = datetime.now(UTC) - timedelta(seconds=60)  # 60 seconds ago
        notifier.retry_queue.append(
            QueuedNotification(event=event, attempt=2, scheduled_at=past_time)
        )

        # Mock successful send on retry
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        with patch.object(notifier.client, "post", return_value=mock_response):
            processed = await notifier.process_retry_queue()
            assert processed == 1
            assert len(notifier.retry_queue) == 0  # Queue should be empty

    @pytest.mark.asyncio
    async def test_process_retry_queue_empty(self) -> None:
        """Should return 0 when queue is empty."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        processed = await notifier.process_retry_queue()
        assert processed == 0

    @pytest.mark.asyncio
    async def test_process_retry_queue_multiple_items(self) -> None:
        """Should process multiple due items."""
        from datetime import timedelta

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")

        # Add two items with past scheduled times
        from homelab_cmd.services.notifier import QueuedNotification

        past_time = datetime.now(UTC) - timedelta(seconds=60)

        for i in range(2):
            event = AlertEvent(
                server_id=f"test-server-{i}",
                server_name=f"Test Server {i}",
                metric_type="cpu",
                severity="critical",
                current_value=96.0,
                threshold_value=95.0,
            )
            notifier.retry_queue.append(
                QueuedNotification(event=event, attempt=2, scheduled_at=past_time)
            )

        # Mock successful sends
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        with patch.object(notifier.client, "post", return_value=mock_response):
            processed = await notifier.process_retry_queue()
            assert processed == 2
            assert len(notifier.retry_queue) == 0


class TestNotifierWebhook:
    """Tests for webhook sending."""

    @pytest.mark.asyncio
    async def test_successful_send(self) -> None:
        """Successful webhook send should return True."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        with patch.object(notifier.client, "post", return_value=mock_response) as mock_post:
            result = await notifier.send_alert(event, config)
            assert result is True
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_rate_limited_queues_retry(self) -> None:
        """Rate limited response should queue for retry."""
        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = AlertEvent(
            server_id="test-server",
            server_name="Test Server",
            metric_type="cpu",
            severity="critical",
            current_value=96.0,
            threshold_value=95.0,
        )

        mock_response = AsyncMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "60"}

        with patch.object(notifier.client, "post", return_value=mock_response):
            result = await notifier.send_alert(event, config)
            assert result is False
            assert len(notifier.retry_queue) == 1


class TestActionNotifications:
    """Tests for action notification methods (US0032) - lines 467-638."""

    @pytest.mark.asyncio
    async def test_send_action_notification_success(self) -> None:
        """Should send action success notification."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        with patch.object(notifier.client, "post", return_value=mock_response):
            result = await notifier.send_action_notification(event, config)
            assert result is True

    @pytest.mark.asyncio
    async def test_send_action_notification_failure(self) -> None:
        """Should send action failure notification."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig()
        event = ActionEvent(
            action_id=2,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr="Service not found",
        )

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        with patch.object(notifier.client, "post", return_value=mock_response):
            result = await notifier.send_action_notification(event, config)
            assert result is True

    @pytest.mark.asyncio
    async def test_send_action_notification_skipped_when_not_configured(self) -> None:
        """Should skip when webhook not configured."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="")
        config = NotificationsConfig()
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        result = await notifier.send_action_notification(event, config)
        assert result is False

    @pytest.mark.asyncio
    async def test_send_action_notification_skipped_when_success_disabled(self) -> None:
        """Should skip success notification when disabled in config."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_action_success=False)
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        result = await notifier.send_action_notification(event, config)
        assert result is True  # Returns True because intentionally skipped

    @pytest.mark.asyncio
    async def test_send_action_notification_skipped_when_failure_disabled(self) -> None:
        """Should skip failure notification when disabled in config."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_action_failure=False)
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        result = await notifier.send_action_notification(event, config)
        assert result is True  # Returns True because intentionally skipped

    @pytest.mark.asyncio
    async def test_action_notification_rate_limited(self) -> None:
        """Should handle rate limiting for action notifications."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_action_failure=True)  # Enable failure notifications
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,  # Use failure event since success is disabled by default
            exit_code=1,
            stderr="Error",
        )

        mock_response = AsyncMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "60"}

        with patch.object(notifier.client, "post", return_value=mock_response):
            result = await notifier.send_action_notification(event, config)
            assert result is False
            # Action notifications don't queue for retry
            assert len(notifier.retry_queue) == 0

    @pytest.mark.asyncio
    async def test_action_notification_http_error(self) -> None:
        """Should handle HTTP error for action notifications."""
        from unittest.mock import Mock

        import httpx

        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_action_failure=True)
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        http_error = httpx.HTTPStatusError(
            "Server Error",
            request=Mock(),
            response=Mock(status_code=500),
        )

        with patch.object(notifier.client, "post", side_effect=http_error):
            result = await notifier.send_action_notification(event, config)
            assert result is False

    @pytest.mark.asyncio
    async def test_action_notification_timeout(self) -> None:
        """Should handle timeout for action notifications."""
        import httpx

        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_action_failure=True)
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        with patch.object(
            notifier.client, "post", side_effect=httpx.TimeoutException("Timeout")
        ):
            result = await notifier.send_action_notification(event, config)
            assert result is False

    @pytest.mark.asyncio
    async def test_action_notification_unexpected_error(self) -> None:
        """Should handle unexpected error for action notifications."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        config = NotificationsConfig(notify_on_action_failure=True)
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        with patch.object(
            notifier.client, "post", side_effect=RuntimeError("Unexpected error")
        ):
            result = await notifier.send_action_notification(event, config)
            assert result is False


class TestActionMessageFormatting:
    """Tests for action message formatting methods."""

    def test_format_action_success_message(self) -> None:
        """Should format successful action message."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)

        assert "attachments" in payload
        assert payload["attachments"][0]["color"] == "#22C55E"  # Green/resolved
        blocks = payload["attachments"][0]["blocks"]
        text = blocks[0]["text"]["text"]
        assert "Action Completed" in text
        assert "nginx" in text
        assert "Test Server" in text

    def test_format_action_failure_message(self) -> None:
        """Should format failed action message with error details."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr="Service nginx not found",
        )

        payload = notifier._format_action_failure_message(event)

        assert "attachments" in payload
        assert payload["attachments"][0]["color"] == "#F87171"  # Red/critical
        blocks = payload["attachments"][0]["blocks"]
        # Check header
        assert blocks[0]["text"]["text"] == "Action Failed"
        # Check error section exists
        error_blocks = [b for b in blocks if "Error" in str(b)]
        assert len(error_blocks) > 0
        # Check action ID in context
        context_blocks = [b for b in blocks if b.get("type") == "context"]
        assert len(context_blocks) > 0
        assert "42" in str(context_blocks[0])

    def test_format_action_message_without_service_name(self) -> None:
        """Should format action message without service name."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="clear_logs",
            service_name=None,
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)

        blocks = payload["attachments"][0]["blocks"]
        text = blocks[0]["text"]["text"]
        assert "Clear Logs" in text
        assert "Test Server" in text

    def test_format_action_failure_truncates_long_stderr(self) -> None:
        """Should truncate long stderr in failure message."""
        from homelab_cmd.services.notifier import ActionEvent

        notifier = SlackNotifier(webhook_url="https://hooks.slack.com/test")
        long_error = "x" * 1000  # Longer than MAX_STDERR_LENGTH
        event = ActionEvent(
            action_id=1,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="nginx",
            is_success=False,
            exit_code=1,
            stderr=long_error,
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        error_section = [b for b in blocks if "Error" in str(b)][0]
        error_text = error_section["text"]["text"]
        # Should be truncated with ellipsis
        assert "..." in error_text
        # Error text (including markdown) should be less than original
        assert len(error_text) < len(long_error)
