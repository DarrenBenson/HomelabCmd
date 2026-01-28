"""Slack notification service for alerting and action notifications.

This module handles sending formatted Slack notifications for:
- New alerts (critical/high severity)
- Re-notifications (reminder when cooldown expires)
- Resolution notifications (when alerts auto-resolve)
- Action completion/failure notifications (US0032)

Implements retry logic with exponential backoff for failed notifications.
"""

import asyncio
import logging
from collections import deque
from datetime import UTC, datetime
from typing import NamedTuple

import httpx

from homelab_cmd.api.schemas.config import NotificationsConfig
from homelab_cmd.services.alerting import AlertEvent

logger = logging.getLogger(__name__)

# Slack colour codes matching brand guide
COLOURS = {
    "critical": "#F87171",  # Red Alert
    "high": "#FBBF24",  # Amber Alert
    "medium": "#60A5FA",  # Blue (informational)
    "resolved": "#22C55E",  # Green
}

# Suggestions per alert type
SUGGESTIONS = {
    "cpu": "Identify and throttle CPU-intensive processes",
    "memory": "Check for memory leaks or restart high-usage services",
    "disk": "Check for large log files or run disk cleanup",
    "offline": "Check network connectivity and server power",
    "service": "Check service logs and consider restarting the service",
}

# Retry configuration
MAX_RETRIES = 3
MAX_QUEUE_SIZE = 100
RETRY_DELAYS = [5, 15, 45]  # seconds

# Action notification configuration (US0032)
MAX_STDERR_LENGTH = 500  # Truncate stderr in notifications

# Action type display names
ACTION_TYPE_LABELS = {
    "restart_service": "Restart Service",
    "clear_logs": "Clear Logs",
    "custom": "Custom Command",
}


class ActionEvent(NamedTuple):
    """An action completion event for notification (US0032).

    Contains details about a remediation action that completed or failed.
    """

    action_id: int
    server_id: str
    server_name: str
    action_type: str
    service_name: str | None
    is_success: bool
    exit_code: int | None
    stderr: str | None


class QueuedNotification(NamedTuple):
    """A notification queued for retry."""

    event: AlertEvent
    attempt: int
    scheduled_at: datetime


class SlackNotifier:
    """Slack webhook notification service.

    Sends formatted messages to a Slack webhook with:
    - Severity-based colour coding
    - Server and metric details
    - Helpful suggestions
    - Retry logic for failures
    """

    def __init__(self, webhook_url: str) -> None:
        """Initialise the Slack notifier.

        Args:
            webhook_url: Slack incoming webhook URL
        """
        self.webhook_url = webhook_url
        self.client = httpx.AsyncClient(timeout=10.0)
        self.retry_queue: deque[QueuedNotification] = deque(maxlen=MAX_QUEUE_SIZE)
        self._running = False

    async def close(self) -> None:
        """Close the HTTP client."""
        self._running = False
        await self.client.aclose()

    @property
    def is_configured(self) -> bool:
        """Check if webhook URL is configured."""
        return bool(self.webhook_url)

    async def send_alert(
        self,
        event: AlertEvent,
        config: NotificationsConfig,
    ) -> bool:
        """Send an alert notification to Slack.

        Args:
            event: Alert event to notify about
            config: Notification configuration

        Returns:
            True if notification sent successfully
        """
        if not self.is_configured:
            logger.debug("Slack webhook not configured, skipping notification")
            return False

        # Check if notification should be sent based on config
        if event.is_resolved:
            if not config.notify_on_remediation:
                logger.debug("Remediation notifications disabled, skipping")
                return True
        elif event.severity == "critical":
            if not config.notify_on_critical:
                logger.debug("Critical notifications disabled, skipping")
                return True
        elif event.severity == "high":
            if not config.notify_on_high:
                logger.debug("High notifications disabled, skipping")
                return True

        payload = self._format_message(event)
        return await self._send_with_retry(event, payload)

    async def _send_with_retry(
        self,
        event: AlertEvent,
        payload: dict,
        attempt: int = 1,
    ) -> bool:
        """Send notification with retry on failure.

        Args:
            event: Alert event being sent
            payload: Slack message payload
            attempt: Current attempt number (1-based)

        Returns:
            True if sent successfully
        """
        try:
            response = await self.client.post(self.webhook_url, json=payload)

            if response.status_code == 429:
                # Rate limited - check Retry-After header
                retry_after = int(response.headers.get("Retry-After", "60"))
                logger.warning("Slack rate limited, retry after %d seconds", retry_after)
                self._queue_for_retry(event, attempt)
                return False

            response.raise_for_status()
            logger.info(
                "Slack notification sent: %s %s for %s",
                event.severity,
                event.metric_type,
                event.server_name,
            )
            return True

        except httpx.HTTPStatusError as e:
            logger.error("Slack HTTP error: %s", e)
            if attempt < MAX_RETRIES:
                self._queue_for_retry(event, attempt)
            else:
                logger.error("Notification dropped after %d attempts", MAX_RETRIES)
            return False

        except httpx.TimeoutException:
            logger.warning("Slack request timed out (attempt %d)", attempt)
            if attempt < MAX_RETRIES:
                self._queue_for_retry(event, attempt)
            else:
                logger.error("Notification dropped after %d attempts", MAX_RETRIES)
            return False

        except Exception as e:
            logger.exception("Unexpected error sending Slack notification: %s", e)
            return False

    def _queue_for_retry(self, event: AlertEvent, attempt: int) -> None:
        """Queue a notification for retry.

        Args:
            event: Alert event to retry
            attempt: Current attempt number
        """
        if len(self.retry_queue) >= MAX_QUEUE_SIZE:
            dropped = self.retry_queue.popleft()
            logger.warning(
                "Retry queue full, dropping oldest notification: %s %s",
                dropped.event.metric_type,
                dropped.event.server_id,
            )

        delay = RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)]
        scheduled = datetime.now(UTC)

        self.retry_queue.append(
            QueuedNotification(
                event=event,
                attempt=attempt + 1,
                scheduled_at=scheduled,
            )
        )
        logger.debug("Queued notification for retry in %d seconds", delay)

    async def process_retry_queue(self) -> int:
        """Process pending retries in the queue.

        Returns:
            Number of notifications retried
        """
        if not self.retry_queue:
            return 0

        processed = 0
        now = datetime.now(UTC)

        # Process items that are due for retry
        while self.retry_queue:
            item = self.retry_queue[0]
            delay_seconds = RETRY_DELAYS[min(item.attempt - 2, len(RETRY_DELAYS) - 1)]

            if (now - item.scheduled_at).total_seconds() < delay_seconds:
                break  # Not yet due

            self.retry_queue.popleft()
            payload = self._format_message(item.event)
            await self._send_with_retry(item.event, payload, item.attempt)
            processed += 1

        return processed

    def _format_message(self, event: AlertEvent) -> dict:
        """Format an alert event as a Slack message.

        Args:
            event: Alert event to format

        Returns:
            Slack message payload dict
        """
        if event.is_resolved:
            return self._format_resolved_message(event)
        return self._format_alert_message(event)

    def _format_alert_message(self, event: AlertEvent) -> dict:
        """Format an alert notification message.

        Args:
            event: Alert event to format

        Returns:
            Slack message payload dict
        """
        prefix = "[Reminder] " if event.is_reminder else ""
        severity_label = event.severity.title()
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")

        # Handle service alerts (metric_type is "service:{name}")
        if event.metric_type.startswith("service:"):
            service_name = event.metric_type.split(":", 1)[1]
            colour = COLOURS.get(event.severity, COLOURS["high"])
            suggestion = SUGGESTIONS.get("service", "")

            header = f"{prefix}{severity_label}: Service Alert"

            blocks = [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": header},
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
                        {"type": "mrkdwn", "text": f"*Service:*\n{service_name}"},
                        {"type": "mrkdwn", "text": "*Status:*\nStopped/Failed"},
                        {"type": "mrkdwn", "text": f"*Time:*\n{timestamp}"},
                    ],
                },
            ]

            if suggestion:
                blocks.append(
                    {
                        "type": "context",
                        "elements": [{"type": "mrkdwn", "text": f"*Suggestion:* {suggestion}"}],
                    }
                )

            return {"attachments": [{"color": colour, "blocks": blocks}]}

        # Handle offline alerts
        if event.metric_type == "offline":
            colour = COLOURS.get(event.severity, COLOURS["high"])
            suggestion = SUGGESTIONS.get("offline", "")
            header = f"{prefix}{severity_label}: Server Offline"

            blocks = [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": header},
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
                        {"type": "mrkdwn", "text": "*Status:*\nOffline"},
                        {"type": "mrkdwn", "text": f"*Time:*\n{timestamp}"},
                    ],
                },
            ]

            if suggestion:
                blocks.append(
                    {
                        "type": "context",
                        "elements": [{"type": "mrkdwn", "text": f"*Suggestion:* {suggestion}"}],
                    }
                )

            return {"attachments": [{"color": colour, "blocks": blocks}]}

        # Handle metric alerts (cpu, memory, disk)
        metric_label = event.metric_type.upper()
        colour = COLOURS.get(event.severity, COLOURS["high"])
        suggestion = SUGGESTIONS.get(event.metric_type, "")

        header = f"{prefix}{severity_label}: {metric_label} Usage Alert"

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": header},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
                    {"type": "mrkdwn", "text": f"*Current Value:*\n{event.current_value:.0f}%"},
                    {
                        "type": "mrkdwn",
                        "text": f"*Threshold:*\n{event.threshold_value:.0f}% ({event.severity})",
                    },
                    {"type": "mrkdwn", "text": f"*Time:*\n{timestamp}"},
                ],
            },
        ]

        if suggestion:
            blocks.append(
                {
                    "type": "context",
                    "elements": [{"type": "mrkdwn", "text": f"*Suggestion:* {suggestion}"}],
                }
            )

        return {"attachments": [{"color": colour, "blocks": blocks}]}

    def _format_resolved_message(self, event: AlertEvent) -> dict:
        """Format a resolution notification message.

        Args:
            event: Resolved alert event to format

        Returns:
            Slack message payload dict
        """
        colour = COLOURS["resolved"]
        duration_text = f"{event.duration_minutes} minutes" if event.duration_minutes else "Unknown"

        # Handle service resolution
        if event.metric_type.startswith("service:"):
            service_name = event.metric_type.split(":", 1)[1]
            header = f"Resolved: Service {service_name} Running"

            fields = [
                {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
                {"type": "mrkdwn", "text": f"*Service:*\n{service_name}"},
                {"type": "mrkdwn", "text": f"*Duration:*\n{duration_text}"},
            ]

            blocks = [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": header},
                },
                {
                    "type": "section",
                    "fields": fields,
                },
            ]

            return {"attachments": [{"color": colour, "blocks": blocks}]}

        # Handle offline resolution
        if event.metric_type == "offline":
            header = "Resolved: Server Back Online"

            fields = [
                {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
                {"type": "mrkdwn", "text": f"*Duration:*\n{duration_text}"},
            ]

            blocks = [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": header},
                },
                {
                    "type": "section",
                    "fields": fields,
                },
            ]

            return {"attachments": [{"color": colour, "blocks": blocks}]}

        # Handle metric resolution (cpu, memory, disk)
        metric_label = event.metric_type.upper()
        header = f"Resolved: {metric_label} Usage Alert"

        fields = [
            {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
            {"type": "mrkdwn", "text": f"*Current Value:*\n{event.current_value:.0f}%"},
            {"type": "mrkdwn", "text": f"*Duration:*\n{duration_text}"},
        ]

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": header},
            },
            {
                "type": "section",
                "fields": fields,
            },
        ]

        return {"attachments": [{"color": colour, "blocks": blocks}]}

    # Action notification methods (US0032)

    async def send_action_notification(
        self,
        event: ActionEvent,
        config: NotificationsConfig,
    ) -> bool:
        """Send an action completion notification to Slack (US0032).

        Args:
            event: Action event to notify about
            config: Notification configuration

        Returns:
            True if notification sent successfully (or skipped by config)
        """
        if not self.is_configured:
            logger.debug("Slack webhook not configured, skipping action notification")
            return False

        # Check if notification should be sent based on config
        if event.is_success:
            if not config.notify_on_action_success:
                logger.debug("Action success notifications disabled, skipping")
                return True
        else:
            if not config.notify_on_action_failure:
                logger.debug("Action failure notifications disabled, skipping")
                return True

        payload = self._format_action_message(event)
        return await self._send_action_with_retry(event, payload)

    async def _send_action_with_retry(
        self,
        event: ActionEvent,
        payload: dict,
        attempt: int = 1,
    ) -> bool:
        """Send action notification with retry on failure.

        Args:
            event: Action event being sent
            payload: Slack message payload
            attempt: Current attempt number (1-based)

        Returns:
            True if sent successfully
        """
        try:
            response = await self.client.post(self.webhook_url, json=payload)

            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", "60"))
                logger.warning("Slack rate limited, retry after %d seconds", retry_after)
                # Don't queue action notifications for retry - just log and continue
                return False

            response.raise_for_status()
            logger.info(
                "Action notification sent: %s for action %d on %s",
                "success" if event.is_success else "failure",
                event.action_id,
                event.server_name,
            )
            return True

        except httpx.HTTPStatusError as e:
            logger.error("Slack HTTP error for action notification: %s", e)
            return False

        except httpx.TimeoutException:
            logger.warning("Slack request timed out for action notification (attempt %d)", attempt)
            return False

        except Exception as e:
            logger.exception("Unexpected error sending action notification: %s", e)
            return False

    def _format_action_message(self, event: ActionEvent) -> dict:
        """Format an action event as a Slack message (US0032).

        Args:
            event: Action event to format

        Returns:
            Slack message payload dict
        """
        if event.is_success:
            return self._format_action_success_message(event)
        return self._format_action_failure_message(event)

    def _format_action_success_message(self, event: ActionEvent) -> dict:
        """Format a successful action notification (AC4 - brief).

        Args:
            event: Successful action event

        Returns:
            Slack message payload dict
        """
        colour = COLOURS["resolved"]  # Green

        # Build action description
        action_label = ACTION_TYPE_LABELS.get(event.action_type, event.action_type)
        if event.service_name:
            action_desc = f"{action_label}: {event.service_name}"
        else:
            action_desc = action_label

        text = f":white_check_mark: *Action Completed:* {action_desc} on {event.server_name}"

        blocks = [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": text},
            }
        ]

        return {"attachments": [{"color": colour, "blocks": blocks}]}

    def _format_action_failure_message(self, event: ActionEvent) -> dict:
        """Format a failed action notification (AC3 - detailed with error).

        Args:
            event: Failed action event

        Returns:
            Slack message payload dict
        """
        colour = COLOURS["critical"]  # Red

        # Build action description
        action_label = ACTION_TYPE_LABELS.get(event.action_type, event.action_type)
        if event.service_name:
            action_desc = f"{action_label}: {event.service_name}"
        else:
            action_desc = action_label

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "Action Failed"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Server:*\n{event.server_name}"},
                    {"type": "mrkdwn", "text": f"*Action:*\n{action_desc}"},
                ],
            },
        ]

        # Add error details if available (truncate to 500 chars)
        if event.stderr:
            stderr_text = event.stderr[:MAX_STDERR_LENGTH]
            if len(event.stderr) > MAX_STDERR_LENGTH:
                stderr_text += "..."
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Error:*\n```\n{stderr_text}\n```"},
                }
            )

        # Add context with action ID
        blocks.append(
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"Action #{event.action_id}"}],
            }
        )

        return {"attachments": [{"color": colour, "blocks": blocks}]}


# Module-level notifier instance (initialised on demand)
_notifier: SlackNotifier | None = None


def get_notifier(webhook_url: str) -> SlackNotifier:
    """Get or create the Slack notifier instance.

    Args:
        webhook_url: Slack webhook URL

    Returns:
        SlackNotifier instance
    """
    global _notifier
    if _notifier is None or _notifier.webhook_url != webhook_url:
        if _notifier is not None:
            asyncio.create_task(_notifier.close())
        _notifier = SlackNotifier(webhook_url)
    return _notifier
