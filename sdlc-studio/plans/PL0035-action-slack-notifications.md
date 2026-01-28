# PL0035: Action Execution Slack Notifications - Implementation Plan

> **Status:** Complete
> **Story:** [US0032: Action Execution Slack Notifications](../stories/US0032-action-slack-notifications.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** Python (backend), TypeScript (frontend)

## Overview

Extend the existing Slack notification system to send notifications when remediation actions complete or fail. Failure notifications are always sent by default; success notifications are configurable and disabled by default. This completes the final story in EP0004.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Notification on failure | Send Slack notification with failure details when action fails |
| AC2 | Notification on success | Send notification when action completes successfully (if enabled) |
| AC3 | Failure includes error details | Server, action type, and stderr summary in failure notification |
| AC4 | Success is brief | Brief confirmation message for successful actions |
| AC5 | Settings configurable | Toggle for "notify_on_action_success" in settings |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12+ (backend), TypeScript (frontend)
- **Framework:** FastAPI, React
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use `httpx` with timeouts (existing pattern in notifier.py)
- Specific exception handling (existing pattern)
- Type hints on all functions

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| httpx | /encode/httpx | async POST with retry | AsyncClient, timeout, raise_for_status |
| FastAPI | /tiangolo/fastapi | dependency injection | Depends, async session |

### Existing Patterns

The codebase has well-established patterns for Slack notifications:

1. **SlackNotifier class** (`backend/src/homelab_cmd/services/notifier.py`):
   - `AlertEvent` NamedTuple for alert notifications
   - `send_alert()` method with config-based filtering
   - `_format_message()` routing to specific formatters
   - Retry logic with exponential backoff

2. **NotificationsConfig** (`backend/src/homelab_cmd/api/schemas/config.py`):
   - Boolean flags: `notify_on_critical`, `notify_on_high`, `notify_on_remediation`
   - Config stored as JSON in database

3. **Heartbeat processing** (`backend/src/homelab_cmd/api/routes/agents.py`):
   - `_process_command_results()` processes action completion
   - Notifications sent after metric evaluation

4. **Frontend settings** (`frontend/src/pages/Settings.tsx`):
   - Toggle checkboxes for notification preferences

## Recommended Approach

**Strategy:** Hybrid (Test key logic first, then integration)

**Rationale:** This extends existing, well-tested patterns. The new code follows established conventions, making it straightforward. Write unit tests for formatters first, then integration tests for the full flow.

### Test Priority

1. Notification formatting (success/failure message structure)
2. Config toggle behaviour (notify_on_action_failure, notify_on_action_success)
3. Integration: action completion triggers notification

### Documentation Updates Required

- [ ] TS0009 test spec - mark TC173, TC174 as automated
- [ ] Update EP0004 epic status if all stories complete

## Implementation Steps

### Phase 1: Schema Changes

**Goal:** Add new notification configuration fields

#### Step 1.1: Update NotificationsConfig

- [ ] Add `notify_on_action_failure: bool = True` to `NotificationsConfig`
- [ ] Add `notify_on_action_success: bool = False` to `NotificationsConfig`
- [ ] Add corresponding fields to `NotificationsUpdate` schema

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/config.py` - Add new boolean fields

**Considerations:**
No database migration required - settings stored as JSON in Config table.

### Phase 2: Notifier Changes

**Goal:** Add action notification support to SlackNotifier

#### Step 2.1: Create ActionEvent type

- [ ] Define `ActionEvent` NamedTuple with fields:
  - `action_id: int`
  - `server_id: str`
  - `server_name: str`
  - `action_type: str`
  - `service_name: str | None`
  - `is_success: bool`
  - `exit_code: int | None`
  - `stderr: str | None`

**Files to modify:**
- `backend/src/homelab_cmd/services/notifier.py` - Add ActionEvent class

#### Step 2.2: Add message formatters

- [ ] Add `_format_action_message(event: ActionEvent)` - router method
- [ ] Add `_format_action_success_message(event)` - brief green message
- [ ] Add `_format_action_failure_message(event)` - detailed red message with error

**Files to modify:**
- `backend/src/homelab_cmd/services/notifier.py` - Add formatter methods

**Message Formats:**

Success (AC4 - brief):
```json
{
  "attachments": [{
    "color": "#22C55E",
    "blocks": [{
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": ":white_check_mark: *Action Completed:* Restart plex on omv-mediaserver"
      }
    }]
  }]
}
```

Failure (AC3 - detailed):
```json
{
  "attachments": [{
    "color": "#F87171",
    "blocks": [
      {"type": "header", "text": {"type": "plain_text", "text": "Action Failed"}},
      {"type": "section", "fields": [
        {"type": "mrkdwn", "text": "*Server:*\nomv-mediaserver"},
        {"type": "mrkdwn", "text": "*Action:*\nRestart plex"}
      ]},
      {"type": "section", "text": {"type": "mrkdwn", "text": "*Error:*\n```\nFailed to restart...\n```"}},
      {"type": "context", "elements": [{"type": "mrkdwn", "text": "Action #42"}]}
    ]
  }]
}
```

#### Step 2.3: Add send_action_notification method

- [ ] Add `send_action_notification(event, config)` method
- [ ] Check `config.notify_on_action_failure` for failures
- [ ] Check `config.notify_on_action_success` for successes
- [ ] Reuse `_send_with_retry()` for reliability

**Files to modify:**
- `backend/src/homelab_cmd/services/notifier.py` - Add send method

### Phase 3: Heartbeat Integration

**Goal:** Trigger action notifications when commands complete

#### Step 3.1: Modify _process_command_results return type

- [ ] Change return type from `list[int]` to `list[RemediationAction]`
- [ ] Return the completed action objects (needed for notification)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Modify helper function

#### Step 3.2: Load notifications config unconditionally

- [ ] Move notifications config loading outside `if heartbeat.metrics:` block
- [ ] Config needed for both alert and action notifications

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Restructure config loading

#### Step 3.3: Add action notification logic

- [ ] After processing command results, send notifications for each completed action
- [ ] Create `ActionEvent` for each completed action
- [ ] Call `notifier.send_action_notification()` for each event

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add notification calls

**Code location:** After line 165 (after `_process_command_results()` call)

### Phase 4: Frontend Settings

**Goal:** Add UI controls for action notification settings

#### Step 4.1: Update TypeScript types

- [ ] Add `notify_on_action_failure: boolean` to NotificationSettings type
- [ ] Add `notify_on_action_success: boolean` to NotificationSettings type

**Files to modify:**
- `frontend/src/types/settings.ts` - Add new fields

#### Step 4.2: Add toggle controls

- [ ] Add checkbox for "Notify on action failure" (default: checked)
- [ ] Add checkbox for "Notify on action success" (default: unchecked)
- [ ] Wire up to existing settings update logic

**Files to modify:**
- `frontend/src/pages/Settings.tsx` - Add toggle UI elements

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Unit Tests

- [ ] Test `_format_action_success_message()` output structure
- [ ] Test `_format_action_failure_message()` output structure
- [ ] Test stderr truncation to 500 characters
- [ ] Test `send_action_notification()` respects config flags

**Files to create:**
- `tests/test_action_notifications.py` - New test file

#### Step 5.2: Integration Tests

- [ ] Test action failure triggers notification
- [ ] Test action success triggers notification (when enabled)
- [ ] Test action success does NOT trigger notification (when disabled)
- [ ] Test webhook failure doesn't break action completion flow

**Files to modify:**
- `tests/test_action_notifications.py` - Add integration tests

#### Step 5.3: Frontend Tests

- [ ] Test new toggles render correctly
- [ ] Test toggle state changes call API

**Files to modify:**
- `frontend/src/pages/Settings.test.tsx` - Add tests for new toggles

#### Step 5.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Integration test: failed action sends notification | Pending |
| AC2 | Integration test: success notification when enabled | Pending |
| AC3 | Unit test: failure message includes server, type, stderr | Pending |
| AC4 | Unit test: success message is brief single block | Pending |
| AC5 | Frontend test: toggle renders and updates | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Slack webhook fails | Log error, don't block action completion (existing pattern) |
| Very long stderr (>500 chars) | Truncate to 500 characters |
| Webhook not configured | Skip notification silently |
| Multiple actions complete in one heartbeat | Send notification for each |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notifications too noisy | Low | Success notifications disabled by default |
| Config loading change breaks metrics | Low | Config loading is simple, well-tested |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0013: Slack Webhook Integration | Story | Done - existing notifier |
| US0025: Heartbeat Command Channel | Story | Done - action processing |

## Open Questions

(None - all requirements clear from story)

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Frontend tests updated and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Manual verification in browser (settings toggles)

## Notes

This is the final story in EP0004 (Remediation Engine). Once complete:
1. Mark US0032 as Done
2. Update TS0009 to Complete (all 33 test cases automated)
3. Verify EP0004 epic can be marked Done
