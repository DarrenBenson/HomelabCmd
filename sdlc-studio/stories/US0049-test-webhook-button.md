# US0049: Test Webhook Button

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-19
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** to test my Slack webhook URL from the Settings page
**So that** I can verify the integration works before relying on it for alerts

## Context

### Persona Reference

**Darren** - Wants confidence that notifications will work when needed. Prefers to test configurations immediately rather than wait for an actual alert.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The Settings page (US0043) allows configuring a Slack webhook URL, but there's no way to verify it works without triggering a real alert. A "Test" button provides immediate feedback.

## Acceptance Criteria

### AC1: Test button visible when URL entered

- **Given** the Slack webhook URL field has a value
- **When** viewing the Notification Settings section
- **Then** a "Test" button is displayed next to the input field

### AC2: Test button hidden when URL empty

- **Given** the Slack webhook URL field is empty
- **When** viewing the Notification Settings section
- **Then** no Test button is displayed

### AC3: Test sends sample message

- **Given** a valid Slack webhook URL is entered
- **When** clicking the Test button
- **Then** a test message is sent to Slack with format:
  - Header: "HomelabCmd Test"
  - Body: "Webhook configured successfully!"
  - Colour: Blue (info)
  - Timestamp

### AC4: Success feedback shown

- **Given** the test message was sent successfully
- **When** Slack returns 200 OK
- **Then** a success toast/message appears: "Test message sent!"

### AC5: Failure feedback shown

- **Given** the webhook URL is invalid or unreachable
- **When** the test fails
- **Then** an error message appears with the reason (e.g., "Invalid webhook URL", "Connection failed")

### AC6: Button shows loading state

- **Given** the Test button is clicked
- **When** waiting for the response
- **Then** the button shows a loading spinner and is disabled

## Scope

### In Scope

- Test button on Settings page
- Backend endpoint to send test message
- Success/failure feedback
- Loading state during test

### Out of Scope

- Testing other notification channels (email, Discord)
- Customising test message content
- Saving test results

## UI/UX Requirements

### Test Button Placement

```
Slack Webhook URL
┌─────────────────────────────────────────────────────────┐ ┌──────────┐
│ https://hooks.slack.com/services/...                    │ │   Test   │
└─────────────────────────────────────────────────────────┘ └──────────┘
Leave empty to disable Slack notifications.
```

### Test Message Format (Slack)

```json
{
  "attachments": [
    {
      "color": "#3B82F6",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "HomelabCmd Test"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Webhook configured successfully!"
          }
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": "Sent at 2026-01-19 10:30 UTC"
            }
          ]
        }
      ]
    }
  ]
}
```

## Technical Notes

### API Endpoint

```
POST /api/v1/config/test-webhook
Content-Type: application/json

{
  "webhook_url": "https://hooks.slack.com/services/..."
}

Response 200:
{
  "success": true,
  "message": "Test message sent successfully"
}

Response 400:
{
  "success": false,
  "error": "Invalid webhook URL format"
}

Response 502:
{
  "success": false,
  "error": "Slack returned error: invalid_payload"
}
```

### Implementation Notes

- Use httpx for async HTTP POST to Slack
- Timeout: 10 seconds
- Do not store the webhook URL from this endpoint (use the existing PUT endpoint for that)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Empty URL | Button hidden, no API call |
| Malformed URL | Client-side validation error |
| Slack returns 404 | Show "Invalid webhook URL" |
| Slack returns other error | Show Slack's error message |
| Network timeout | Show "Connection timed out" |
| Rate limited (429) | Show "Too many requests, try again later" |

## Test Scenarios

- [ ] Test button appears when URL entered
- [ ] Test button hidden when URL empty
- [ ] Successful test shows success message
- [ ] Failed test shows error message
- [ ] Button disabled during request
- [ ] Timeout handled gracefully

## Definition of Done


## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0043: System Settings Configuration | Story | Done |

## Estimation

**Story Points:** 2

**Complexity:** Low - Simple endpoint and UI addition

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
