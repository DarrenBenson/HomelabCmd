# US0013: Slack Webhook Integration

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to receive Slack notifications when critical or high alerts occur
**So that** I'm immediately aware of issues even when not looking at the dashboard

## Context

### Persona Reference

**Darren** - Receives Slack notifications on mobile. Already uses UptimeKuma with Slack, so this matches existing workflow.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When a critical or high severity alert is created (or re-notified after cooldown), a formatted message is sent to a configured Slack webhook. The message includes server info, the issue, current values, and suggested actions. Message formatting follows the brand guide colour scheme.

### Notification Triggers

| Event | Notification | Condition |
|-------|--------------|-----------|
| New critical alert | Yes | `notify_on_critical` enabled |
| New high alert | Yes | `notify_on_high` enabled |
| Re-notification (cooldown expired) | Yes | Same as above |
| Alert resolved | Yes | `notify_on_remediation` enabled |

**Note:** Medium and Low severity levels are not used in the alerting model (no triggers defined).

## Acceptance Criteria

### AC1: Slack webhook configured via settings

- **Given** the Slack webhook URL is set in system settings
- **When** an alert is triggered
- **Then** Slack notifications are enabled

### AC2: Critical alerts send Slack notification

- **Given** Slack is configured and `notify_on_critical` is enabled
- **When** a critical severity alert is created
- **Then** a Slack message is sent immediately

### AC3: High severity alerts send Slack notification

- **Given** Slack is configured and `notify_on_high` is enabled
- **When** a high severity alert is created
- **Then** a Slack message is sent immediately

### AC4: Message formatting matches brand

- **Given** a critical disk alert is sent
- **When** viewing in Slack
- **Then** message has red colour bar, server name, issue details, current value

### AC5: Notification failure triggers retry queue

- **Given** Slack webhook is unreachable
- **When** attempting to send notification
- **Then** notification is queued for retry (3 attempts, exponential backoff) and alert creation succeeds

### AC6: Queued notifications retried

- **Given** notifications are in the retry queue
- **When** the retry interval elapses
- **Then** notifications are retried with exponential backoff (5s, 15s, 45s)

### AC7: Failed notifications eventually dropped

- **Given** a notification has failed 3 retry attempts
- **When** the final retry fails
- **Then** the notification is logged as failed and dropped from queue

### AC8: Remediation notification sent

- **Given** `notify_on_remediation` is enabled
- **When** an alert is auto-resolved
- **Then** a green "Resolved" Slack message is sent

### AC9: Cooldown-aware notifications

- **Given** a critical alert was notified 35 minutes ago (cooldown 30 min)
- **And** the condition still persists
- **When** the next heartbeat triggers re-notification
- **Then** a Slack message is sent with "[Reminder]" prefix

## Scope

### In Scope

- Slack webhook HTTP POST
- Message formatting with Block Kit
- Severity-based colour coding (Critical: red, High: amber, Resolved: green)
- Error handling and logging
- Configuration via system settings (webhook URL + toggles)
- Notifications for critical and high severity only
- Notification queue with retry (3 attempts, exponential backoff)
- Rate limiting awareness (back-off on 429)
- Remediation notifications
- Reminder prefix for re-notifications

### Out of Scope

- Medium/low severity notifications (no triggers defined)
- Multiple Slack channels
- Other notification platforms (email, Discord, etc.)
- Test webhook button (future enhancement)

## UI/UX Requirements

N/A - Slack message format only.

### Slack Message Format (Alert)

```json
{
  "attachments": [
    {
      "color": "#F87171",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "Critical: Disk Usage Alert"
          }
        },
        {
          "type": "section",
          "fields": [
            {
              "type": "mrkdwn",
              "text": "*Server:*\nomv-mediaserver"
            },
            {
              "type": "mrkdwn",
              "text": "*Current Value:*\n96%"
            },
            {
              "type": "mrkdwn",
              "text": "*Threshold:*\n95% (critical)"
            },
            {
              "type": "mrkdwn",
              "text": "*Time:*\n2026-01-19 10:30 UTC"
            }
          ]
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": "*Suggestion:* Check for large log files or run disk cleanup"
            }
          ]
        }
      ]
    }
  ]
}
```

### Slack Message Format (Resolved)

```json
{
  "attachments": [
    {
      "color": "#22C55E",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "Resolved: Disk Usage Alert"
          }
        },
        {
          "type": "section",
          "fields": [
            {
              "type": "mrkdwn",
              "text": "*Server:*\nomv-mediaserver"
            },
            {
              "type": "mrkdwn",
              "text": "*Current Value:*\n72%"
            },
            {
              "type": "mrkdwn",
              "text": "*Duration:*\n45 minutes"
            }
          ]
        }
      ]
    }
  ]
}
```

### Colour Mapping

| Severity | Colour | Hex |
|----------|--------|-----|
| Critical | Red Alert | #F87171 |
| High | Amber Alert | #FBBF24 |
| Resolved | Green | #22C55E |

**Brand Guide Reference:** See [brand-guide.md](../brand-guide.md) for colour specifications.

## Technical Notes

### API Contracts

Internal service, no external API. Uses httpx to POST to Slack:

```python
class SlackNotifier:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        self.client = httpx.AsyncClient()

    async def send_alert_notification(
        self,
        server_name: str,
        metric_type: str,
        severity: str,
        current_value: float,
        threshold_value: float,
        is_reminder: bool = False
    ) -> bool:
        """Send alert notification to Slack."""
        prefix = "[Reminder] " if is_reminder else ""
        payload = self._format_alert_message(
            prefix, server_name, metric_type, severity,
            current_value, threshold_value
        )
        return await self._send(payload)

    async def send_resolved_notification(
        self,
        server_name: str,
        metric_type: str,
        current_value: float,
        duration_minutes: int
    ) -> bool:
        """Send resolution notification to Slack."""
        payload = self._format_resolved_message(
            server_name, metric_type, current_value, duration_minutes
        )
        return await self._send(payload)

    async def _send(self, payload: dict) -> bool:
        try:
            response = await self.client.post(
                self.webhook_url,
                json=payload,
                timeout=10.0
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False
```

**TRD Reference:** [§4 API Contracts - Alerts](../trd.md#4-api-contracts)

### Configuration Schema

```python
class NotificationsConfig(BaseModel):
    slack_webhook_url: str = ""
    cooldowns: CooldownConfig  # From US0012
    notify_on_critical: bool = True
    notify_on_high: bool = True
    notify_on_remediation: bool = True
```

### Suggestions per Alert Type

| Alert Type | Suggestion |
|------------|------------|
| disk | Check for large log files or run disk cleanup |
| memory | Check for memory leaks or restart high-usage services |
| cpu | Identify and throttle CPU-intensive processes |
| offline | Check network connectivity and server power |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Webhook URL not configured | Skip notifications, log warning on startup |
| Webhook returns error (5xx) | Queue for retry with exponential backoff |
| Webhook timeout | Queue for retry with exponential backoff |
| Rate limiting by Slack (429) | Back-off per Retry-After header, queue notification |
| Invalid webhook URL | Log error, don't retry (permanent failure) |
| Multiple alerts at once | Send individually (no batching for MVP) |
| 3 retries exhausted | Log failure, drop notification, continue |
| Queue grows too large (>100) | Drop oldest notifications, log warning |

## Test Scenarios

- [ ] Critical alert sends Slack notification
- [ ] High alert sends Slack notification
- [ ] Disabled notification types are not sent
- [ ] Message format correct (colour, fields)
- [ ] Webhook failure queues notification for retry
- [ ] Missing webhook URL disables notifications gracefully
- [ ] Suggestion text matches alert type
- [ ] Failed notifications retried with exponential backoff
- [ ] Notifications dropped after 3 failed attempts
- [ ] Rate limiting (429) triggers appropriate back-off
- [ ] Remediation notification sent when enabled
- [ ] Reminder prefix added for re-notifications
- [ ] Resolved message shows duration

## Definition of Done


**Story-specific additions:**

- [ ] Slack message tested with real webhook
- [ ] Message renders correctly on mobile Slack
- [ ] Configuration documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0010: Alert Schema | Story | Done |
| US0011: Threshold Evaluation | Story | Done |
| US0012: Alert Deduplication | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - HTTP integration with formatting

## Open Questions

None - all notification preferences resolved in alerting model redesign.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | QA enhancement: Added notification queue with retry (3 attempts, exponential backoff), rate limiting handling |
| 2026-01-19 | Claude | Major revision: Removed Medium/Low severities, added remediation notifications, added reminder prefix, aligned with cooldown model |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
