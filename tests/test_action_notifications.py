"""Tests for action completion/failure Slack notifications (US0032).

This module tests:
- TC173: Failure notification sent when action fails
- TC174: Success notification sent when enabled
- Message formatting for success and failure notifications
- Configuration toggles for action notifications
"""

from unittest.mock import AsyncMock, patch

import pytest

from homelab_cmd.api.schemas.config import NotificationsConfig
from homelab_cmd.services.notifier import (
    ACTION_TYPE_LABELS,
    COLOURS,
    MAX_STDERR_LENGTH,
    ActionEvent,
    SlackNotifier,
)


class TestActionEventFormatting:
    """Test ActionEvent message formatting."""

    def test_action_event_fields(self) -> None:
        """ActionEvent has all required fields."""
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        assert event.action_id == 42
        assert event.server_id == "test-server"
        assert event.server_name == "Test Server"
        assert event.action_type == "restart_service"
        assert event.service_name == "plex"
        assert event.is_success is True
        assert event.exit_code == 0
        assert event.stderr is None

    def test_action_event_with_failure(self) -> None:
        """ActionEvent can represent a failed action."""
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Failed to restart plex.service: Unit plex.service not found.",
        )

        assert event.is_success is False
        assert event.exit_code == 1
        assert "Failed to restart" in event.stderr


class TestSuccessMessageFormatting:
    """Test successful action notification formatting (AC4 - brief)."""

    def test_success_message_uses_green_colour(self) -> None:
        """Success message uses green colour."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)

        assert payload["attachments"][0]["color"] == COLOURS["resolved"]

    def test_success_message_is_brief(self) -> None:
        """Success message has only one block (brief per AC4)."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)

        blocks = payload["attachments"][0]["blocks"]
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"

    def test_success_message_includes_action_description(self) -> None:
        """Success message includes action type and service name."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)

        text = payload["attachments"][0]["blocks"][0]["text"]["text"]
        assert "Restart Service: plex" in text
        assert "Test Server" in text
        assert ":white_check_mark:" in text

    def test_success_message_without_service_name(self) -> None:
        """Success message works without service name."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="clear_logs",
            service_name=None,
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)

        text = payload["attachments"][0]["blocks"][0]["text"]["text"]
        assert "Clear Logs" in text
        assert "Test Server" in text


class TestFailureMessageFormatting:
    """Test failed action notification formatting (AC3 - detailed with error)."""

    def test_failure_message_uses_red_colour(self) -> None:
        """Failure message uses red colour."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Service not found",
        )

        payload = notifier._format_action_failure_message(event)

        assert payload["attachments"][0]["color"] == COLOURS["critical"]

    def test_failure_message_includes_header(self) -> None:
        """Failure message includes header block."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Service not found",
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        assert blocks[0]["type"] == "header"
        assert "Action Failed" in blocks[0]["text"]["text"]

    def test_failure_message_includes_server_and_action(self) -> None:
        """Failure message includes server name and action type (AC3)."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Service not found",
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        section = blocks[1]
        assert section["type"] == "section"
        fields = section["fields"]

        server_field = next(f for f in fields if "Server" in f["text"])
        assert "Test Server" in server_field["text"]

        action_field = next(f for f in fields if "Action" in f["text"])
        assert "Restart Service: plex" in action_field["text"]

    def test_failure_message_includes_stderr(self) -> None:
        """Failure message includes stderr summary (AC3)."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Failed to restart plex.service: Unit plex.service not found.",
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        # Find the error block
        error_block = next(
            (b for b in blocks if b["type"] == "section" and "Error" in str(b.get("text", {}))),
            None,
        )
        assert error_block is not None
        assert "Failed to restart" in error_block["text"]["text"]

    def test_failure_message_truncates_long_stderr(self) -> None:
        """Failure message truncates stderr to 500 characters."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        long_stderr = "X" * 600  # Longer than MAX_STDERR_LENGTH
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr=long_stderr,
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        error_block = next(
            (b for b in blocks if b["type"] == "section" and "Error" in str(b.get("text", {}))),
            None,
        )
        assert error_block is not None
        # Should be truncated to 500 chars plus "..."
        assert len("X" * MAX_STDERR_LENGTH + "...") <= len(error_block["text"]["text"])
        assert "..." in error_block["text"]["text"]

    def test_failure_message_includes_action_id(self) -> None:
        """Failure message includes action ID in context."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        context_block = next((b for b in blocks if b["type"] == "context"), None)
        assert context_block is not None
        assert "Action #42" in str(context_block)

    def test_failure_message_without_stderr(self) -> None:
        """Failure message handles missing stderr gracefully."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr=None,
        )

        payload = notifier._format_action_failure_message(event)

        blocks = payload["attachments"][0]["blocks"]
        # Should not have an error section if stderr is None
        error_blocks = [
            b for b in blocks if b["type"] == "section" and "Error" in str(b.get("text", {}))
        ]
        assert len(error_blocks) == 0


class TestSendActionNotification:
    """Test send_action_notification with config toggles."""

    @pytest.mark.asyncio
    async def test_skips_when_webhook_not_configured(self) -> None:
        """Notification skipped when webhook URL is empty."""
        notifier = SlackNotifier("")  # Empty webhook
        config = NotificationsConfig(
            slack_webhook_url="",
            notify_on_action_failure=True,
            notify_on_action_success=True,
        )
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        result = await notifier.send_action_notification(event, config)

        assert result is False  # Not configured

    @pytest.mark.asyncio
    async def test_failure_skipped_when_disabled(self) -> None:
        """Failure notification skipped when notify_on_action_failure=False."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            notify_on_action_failure=False,  # Disabled
            notify_on_action_success=False,
        )
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        result = await notifier.send_action_notification(event, config)

        assert result is True  # Skipped by config (returns True to indicate "handled")

    @pytest.mark.asyncio
    async def test_success_skipped_when_disabled(self) -> None:
        """Success notification skipped when notify_on_action_success=False."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            notify_on_action_failure=True,
            notify_on_action_success=False,  # Disabled (default)
        )
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        result = await notifier.send_action_notification(event, config)

        assert result is True  # Skipped by config

    @pytest.mark.asyncio
    async def test_failure_sent_when_enabled(self) -> None:
        """Failure notification sent when notify_on_action_failure=True."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            notify_on_action_failure=True,
            notify_on_action_success=False,
        )
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=False,
            exit_code=1,
            stderr="Error",
        )

        with patch.object(notifier, "_send_action_with_retry", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = True
            result = await notifier.send_action_notification(event, config)

        assert result is True
        mock_send.assert_called_once()
        # Verify the payload is a failure message
        payload = mock_send.call_args[0][1]
        assert payload["attachments"][0]["color"] == COLOURS["critical"]

    @pytest.mark.asyncio
    async def test_success_sent_when_enabled(self) -> None:
        """Success notification sent when notify_on_action_success=True."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            notify_on_action_failure=True,
            notify_on_action_success=True,  # Enabled
        )
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="restart_service",
            service_name="plex",
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        with patch.object(notifier, "_send_action_with_retry", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = True
            result = await notifier.send_action_notification(event, config)

        assert result is True
        mock_send.assert_called_once()
        # Verify the payload is a success message
        payload = mock_send.call_args[0][1]
        assert payload["attachments"][0]["color"] == COLOURS["resolved"]


class TestActionTypeLabels:
    """Test action type display labels."""

    def test_restart_service_label(self) -> None:
        """restart_service has proper label."""
        assert ACTION_TYPE_LABELS["restart_service"] == "Restart Service"

    def test_clear_logs_label(self) -> None:
        """clear_logs has proper label."""
        assert ACTION_TYPE_LABELS["clear_logs"] == "Clear Logs"

    def test_custom_label(self) -> None:
        """custom has proper label."""
        assert ACTION_TYPE_LABELS["custom"] == "Custom Command"

    def test_unknown_type_uses_raw_value(self) -> None:
        """Unknown action type falls back to raw value."""
        notifier = SlackNotifier("https://hooks.slack.com/test")
        event = ActionEvent(
            action_id=42,
            server_id="test-server",
            server_name="Test Server",
            action_type="unknown_type",  # Not in labels
            service_name=None,
            is_success=True,
            exit_code=0,
            stderr=None,
        )

        payload = notifier._format_action_success_message(event)
        text = payload["attachments"][0]["blocks"][0]["text"]["text"]
        assert "unknown_type" in text


class TestMaxStderrLength:
    """Test stderr truncation constant."""

    def test_max_stderr_length_is_500(self) -> None:
        """MAX_STDERR_LENGTH is 500 characters."""
        assert MAX_STDERR_LENGTH == 500
