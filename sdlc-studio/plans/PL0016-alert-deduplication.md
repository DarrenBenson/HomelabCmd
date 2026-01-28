# PL0016: Alert Deduplication and Auto-Resolve - Implementation Plan

> **Status:** Complete
> **Story:** [US0012: Alert Deduplication, Auto-Resolve, and Notification Cooldowns](../stories/US0012-alert-deduplication.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Integrate notification sending into the heartbeat flow. Most deduplication, auto-resolve, and cooldown logic is already implemented in `AlertingService` (from US0011). The main gap is that the heartbeat endpoint doesn't send the returned `AlertEvent` objects to the `SlackNotifier`.

**Key insight:** The `AlertingService.evaluate_heartbeat()` returns `AlertEvent` objects with all the information needed for notifications (including `is_reminder`, `is_resolved`). The `SlackNotifier` already handles:
- `notify_on_critical` / `notify_on_high` filtering
- `notify_on_remediation` filtering
- Formatted Slack messages for all event types

The only missing piece is calling the notifier from the heartbeat endpoint.

## Acceptance Criteria Summary

| AC | Name | Implementation Status |
|----|------|----------------------|
| AC1 | No duplicate alerts | ✓ Already implemented (AlertState) |
| AC2 | Auto-resolve when condition clears | ✓ Already implemented (_check_auto_resolve) |
| AC3 | Auto-resolve marked correctly | ✓ Already implemented (Alert.resolve(auto=True)) |
| AC4 | New alert after resolution | ✓ Already implemented (AlertState reset) |
| AC5 | Offline alert auto-resolves on heartbeat | ✓ Already implemented (_resolve_offline_alert) |
| AC6 | Critical alert re-notification after cooldown | ✓ Already implemented (_should_notify) |
| AC7 | High alert re-notification after cooldown | ✓ Already implemented (_should_notify) |
| AC8 | No re-notification within cooldown | ✓ Already implemented (_should_notify) |
| AC9 | Notification on remediation (configurable) | **Needs integration** |
| AC10 | Consecutive breach count resets on resolve | ✓ Already implemented |

## Technical Context

### What Already Exists

**AlertingService** (`services/alerting.py`):
- `evaluate_heartbeat()` returns `list[AlertEvent]` including:
  - New alerts (severity = critical/high, is_reminder = False)
  - Re-notifications (is_reminder = True)
  - Resolved alerts (is_resolved = True)
- Deduplication via `AlertState.current_severity` check
- Cooldown via `_should_notify()` method
- Auto-resolve via `_check_auto_resolve()` method

**SlackNotifier** (`services/notifier.py`):
- `send_alert(event, config)` handles all notification logic
- Respects `notify_on_critical`, `notify_on_high`, `notify_on_remediation`
- Formats messages with severity colours and suggestions
- Includes retry logic with exponential backoff

**Heartbeat Endpoint** (`api/routes/agents.py`):
- Calls `alerting_service.evaluate_heartbeat()`
- **Gap:** Discards returned events instead of sending to notifier

### Existing Test Coverage

`tests/test_alerting.py` has comprehensive coverage:
- `TestDeduplication` - no duplicate alerts, new alert after resolution
- `TestCooldowns` - no re-notify within cooldown
- `TestAutoResolve` - disk auto-resolves, includes duration
- `TestOfflineAlerts` - offline resolves on heartbeat
- `TestAlertRecordCreation` - Alert records created/resolved

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Core logic already tested. This story adds integration (calling notifier). Integration tests can verify the full flow.

### Test Priority

1. Heartbeat with breach sends notification
2. Heartbeat with resolution sends notification (when configured)
3. Heartbeat within cooldown does not send notification
4. Verify `notify_on_remediation=False` suppresses resolved notifications

## Implementation Steps

### Phase 1: Integrate Notifier with Heartbeat

**Goal:** Send AlertEvents from heartbeat evaluation to SlackNotifier.

#### Step 1.1: Add notifier call to heartbeat endpoint

- [ ] Import `get_notifier` from `services.notifier`
- [ ] After `evaluate_heartbeat()`, iterate over returned events
- [ ] For each event, call `notifier.send_alert(event, notifications)`
- [ ] Only create notifier if webhook URL is configured

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add notification sending

**Implementation:**
```python
# After evaluate_heartbeat() call
if notifications.slack_webhook_url:
    notifier = get_notifier(notifications.slack_webhook_url)
    for event in events:
        await notifier.send_alert(event, notifications)
```

**Considerations:**
- Don't block heartbeat response on notification failures
- Notification failures should be logged but not raise exceptions
- The notifier already handles retries internally

### Phase 2: Testing & Validation

**Goal:** Verify all acceptance criteria via tests.

#### Step 2.1: Integration tests for notification flow

- [ ] Test heartbeat with high disk sends notification (mock notifier)
- [ ] Test heartbeat with remediation sends notification when enabled
- [ ] Test heartbeat with remediation does NOT send when disabled
- [ ] Test cooldown prevents re-notification

**Files to modify:**
- `tests/test_heartbeat_notifications.py` - New test file for notification integration

#### Step 2.2: Verify existing tests still pass

- [ ] Run full test suite
- [ ] Verify no regressions in alerting tests

#### Step 2.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Existing test: `test_no_duplicate_alerts` | ✓ Covered |
| AC2 | Existing test: `test_disk_auto_resolves_below_threshold` | ✓ Covered |
| AC3 | Existing test: `test_alert_record_resolved_on_auto_resolve` | ✓ Covered |
| AC4 | Existing test: `test_new_alert_after_resolution` | ✓ Covered |
| AC5 | Existing test: `test_offline_alert_resolves_on_heartbeat` | ✓ Covered |
| AC6 | New test: cooldown expired sends notification | Pending |
| AC7 | Same as AC6 (logic identical for high vs critical) | Pending |
| AC8 | Existing test: `test_no_renotify_within_cooldown` | ✓ Covered |
| AC9 | New test: remediation notification respects config | Pending |
| AC10 | Implicit in auto-resolve tests | ✓ Covered |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Webhook URL not configured | Skip notification, don't fail heartbeat |
| Notification service unavailable | Notifier queues for retry, heartbeat succeeds |
| Multiple events in one heartbeat | Send each notification (notifier handles rate limits) |
| High volume of heartbeats | Notifier has retry queue with max size |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notification latency slows heartbeat | Delayed agent response | Notification is fire-and-forget, no await on response |
| Slack rate limiting | Notifications delayed | Notifier has exponential backoff and retry queue |
| Missing webhook config | No notifications sent | Log debug message, don't fail silently |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0010: Alert Schema | Story | Done |
| US0011: Threshold Evaluation | Story | Done |

## Open Questions

None - implementation path is clear.

## Definition of Done Checklist

- [ ] Heartbeat sends notifications for alert events
- [ ] `notify_on_remediation` config respected
- [ ] Integration tests added
- [ ] Existing tests still pass
- [ ] No linting errors
- [ ] Story status updated to Done

## Notes

**Minimal change:** This story requires adding ~10 lines of code to the heartbeat endpoint. All the heavy lifting (deduplication, cooldowns, auto-resolve, notification formatting) is already implemented.

**Test approach:** Since SlackNotifier makes external HTTP calls, tests should mock the notifier to verify it's called with correct events rather than actually sending to Slack.
