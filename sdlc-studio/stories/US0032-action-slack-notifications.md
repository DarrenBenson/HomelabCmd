# US0032: Action Execution Slack Notifications

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2
> **Updated:** 2026-01-19

## User Story

**As a** Darren (Homelab Operator)
**I want** Slack notifications when actions complete or fail
**So that** I'm informed of remediation results without checking the dashboard

## Context

### Persona Reference

**Darren** - Receives Slack notifications on mobile. Wants to know if the restart worked while away from desk.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Extends the Slack integration (US0013) to send notifications when remediation actions complete or fail. Success notifications are optional; failure notifications are always sent.

## Acceptance Criteria

### AC1: Notification on failure

- **Given** an action fails execution
- **When** the result is reported
- **Then** a Slack notification is sent with failure details

### AC2: Notification on success (configurable)

- **Given** action success notifications are enabled
- **When** an action completes successfully
- **Then** a Slack notification is sent

### AC3: Failure includes error details

- **Given** an action fails
- **When** the notification is sent
- **Then** it includes server, action type, and stderr summary

### AC4: Success is brief

- **Given** an action succeeds
- **When** the notification is sent
- **Then** it is a brief confirmation message

### AC5: Notification settings configurable

- **Given** notification settings
- **When** accessing settings
- **Then** "Notify on action success" can be toggled

## Scope

### In Scope

- Slack notification on action completion
- Configurable success notification setting
- Failure notification with error details
- Integration with existing Slack webhook (US0013)

### Out of Scope

- Notification on approval/rejection
- Per-action notification settings
- Other notification channels (email, Discord)

## Technical Notes

### Slack Message Format

**Failure:**
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "❌ Action Failed"
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
          "text": "*Action:*\nRestart plex"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Error:*\n```\nFailed to restart plex.service: Unit plex.service not found.\n```"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "Action #42 | <https://homelab-cmd/actions/42|View Details>"
        }
      ]
    }
  ]
}
```

**Success:**
```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "✅ *Action Completed:* Restart plex on omv-mediaserver"
      }
    }
  ]
}
```

### API Contracts

**Settings endpoint (extends US0013):**

**GET /api/v1/settings/notifications**
```json
Response 200:
{
  "slack_webhook_url": "https://hooks.slack.com/...",
  "notify_on_alert": true,
  "notify_on_action_failure": true,
  "notify_on_action_success": false
}
```

**PUT /api/v1/settings/notifications**
```json
Request:
{
  "notify_on_action_success": true
}
```

**TRD Reference:** [§4 API Contracts - Notifications](../trd.md#4-api-contracts)

### Data Requirements

- New settings: notify_on_action_failure (default true), notify_on_action_success (default false)
- Notification sent after action status update

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Slack webhook fails | Log error, don't block action completion |
| Very long stderr | Truncate to 500 characters |
| Webhook not configured | Skip notification silently |

## Test Scenarios

- [ ] Failure notification sent
- [ ] Success notification sent when enabled
- [ ] Success notification not sent when disabled
- [ ] Failure includes error summary
- [ ] Long errors truncated
- [ ] Webhook failure doesn't break action flow
- [ ] Settings can be updated

## Definition of Done


**Story-specific additions:**

- [ ] Notification format matches brand guide
- [ ] Mobile rendering tested

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0013: Slack Webhook Integration | Story | Draft |
| US0025: Heartbeat Command Channel | Story | Draft |

## Estimation

**Story Points:** 2

**Complexity:** Low - extends existing notification system

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Updated dependencies (US0028 merged into US0025) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
