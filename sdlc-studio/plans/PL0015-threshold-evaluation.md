# PL0015: Threshold Evaluation and Alert Generation - Implementation Plan

> **Status:** Complete
> **Story:** [US0011: Threshold Evaluation and Alert Generation](../stories/US0011-threshold-evaluation.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Integrate threshold evaluation from the existing `AlertingService` into the heartbeat flow and create persistent `Alert` records (from US0010) when alerts are triggered or resolved.

**Key insight:** The `AlertingService` already implements all threshold evaluation logic using `AlertState` for tracking consecutive breaches and cooldowns. The gap is:
1. Heartbeat endpoint doesn't call `AlertingService.evaluate_heartbeat()`
2. `AlertingService` returns `AlertEvent` objects but doesn't create persistent `Alert` records

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Disk high alert | Disk >= 80% creates HIGH alert immediately |
| AC2 | Disk critical alert | Disk >= 95% creates CRITICAL alert immediately |
| AC3 | Memory sustained alert | Memory >= 85% for 3 heartbeats creates HIGH alert |
| AC4 | CPU sustained alert | CPU >= 85% for 3 heartbeats creates HIGH alert |
| AC5 | CPU critical sustained | CPU >= 95% for 3 heartbeats creates CRITICAL alert |
| AC6 | Brief spike no alert | CPU spike (1-2 heartbeats) resets count, no alert |
| AC7 | Offline alert | Server offline creates CRITICAL alert immediately |
| AC8 | Severity escalation | HIGH alert escalates to CRITICAL when crossing critical threshold |

## Technical Context

### Current State Analysis

**What exists:**
- `AlertingService` (`services/alerting.py`) - Complete threshold evaluation logic
- `AlertState` model - Tracks consecutive breaches, cooldowns per server/metric
- `Alert` model (from US0010) - Persistent alert history (NOT yet integrated)
- Tests in `test_alerting.py` - Comprehensive tests for threshold logic
- Scheduler calls `AlertingService` for offline alerts

**What's missing:**
- Heartbeat endpoint doesn't call `AlertingService.evaluate_heartbeat()`
- `AlertingService` doesn't create/update `Alert` records
- Config needs to be loaded from database for thresholds

### Existing Patterns

**AlertingService flow:**
```python
# Current: Returns AlertEvent for notifications
events = await service.evaluate_heartbeat(...)
for event in events:
    if not event.is_resolved:
        await notifier.send_alert(event)  # Webhook notification
```

**Needed enhancement:**
```python
# Enhanced: Also creates/updates Alert records
events = await service.evaluate_heartbeat(...)
for event in events:
    if event.is_resolved:
        await resolve_alert_record(event)  # Update Alert to resolved
    else:
        await create_alert_record(event)  # Create new Alert record
    await notifier.send_alert(event)  # Send notification
```

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Core logic already exists and is tested. This story integrates existing components and adds Alert record creation. Tests can verify the integration.

### Test Priority

1. Alert records created when thresholds breached
2. Alert records resolved when conditions clear
3. Alert contains correct threshold/actual values
4. Integration with heartbeat endpoint

## Implementation Steps

### Phase 1: Enhance AlertingService to Create Alert Records

**Goal:** When `evaluate_heartbeat()` generates an alert event, also create/update persistent `Alert` records.

#### Step 1.1: Add Alert record creation method

- [ ] Add `_create_alert_record()` method to `AlertingService`
- [ ] Create `Alert` with server_id, alert_type, severity, title, message
- [ ] Include threshold_value and actual_value from AlertEvent
- [ ] Set status to "open"

**Files to modify:**
- `backend/src/homelab_cmd/services/alerting.py` - Add Alert record creation

#### Step 1.2: Add Alert resolution method

- [ ] Add `_resolve_alert_record()` method to `AlertingService`
- [ ] Find open Alert for server_id/metric_type
- [ ] Update status to "resolved", set resolved_at, auto_resolved=True

**Files to modify:**
- `backend/src/homelab_cmd/services/alerting.py` - Add resolution logic

#### Step 1.3: Integrate with existing evaluation

- [ ] In `_evaluate_metric()`, call `_create_alert_record()` when creating new alert
- [ ] In `_check_auto_resolve()`, call `_resolve_alert_record()` when resolving
- [ ] In `_resolve_offline_alert()`, call `_resolve_alert_record()`
- [ ] In `trigger_offline_alert()`, call `_create_alert_record()` for new offline alerts

**Files to modify:**
- `backend/src/homelab_cmd/services/alerting.py` - Integrate record creation

### Phase 2: Integrate with Heartbeat Endpoint

**Goal:** Call `AlertingService.evaluate_heartbeat()` when heartbeat is received.

#### Step 2.1: Load config in heartbeat endpoint

- [ ] Import config service functions
- [ ] Load thresholds and notifications config from database
- [ ] Handle case where config not yet set (use defaults)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Load config

#### Step 2.2: Call AlertingService in heartbeat

- [ ] Create `AlertingService` instance
- [ ] Call `evaluate_heartbeat()` with metrics from heartbeat
- [ ] Process returned events (create Alert records already done in Phase 1)
- [ ] Optionally send notifications (if notifier configured)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add alerting integration

### Phase 3: Integrate with Scheduler (Offline Alerts)

**Goal:** Ensure offline alerts also create Alert records.

#### Step 3.1: Update scheduler offline alert handling

- [ ] Verify `trigger_offline_alert()` creates Alert record (done in Phase 1)
- [ ] Verify offline alert resolution creates resolved Alert record

**Files to modify:**
- `backend/src/homelab_cmd/services/scheduler.py` - May need minor updates

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria via tests.

#### Step 4.1: Integration tests for Alert record creation

- [ ] Test disk alert creates Alert record
- [ ] Test CPU sustained alert creates Alert record after 3 heartbeats
- [ ] Test alert resolution creates resolved Alert record
- [ ] Test Alert contains threshold and actual values

**Files to modify:**
- `tests/test_alerting.py` - Add tests for Alert record integration

#### Step 4.2: Heartbeat integration tests

- [ ] Test heartbeat with high disk creates alert
- [ ] Test heartbeat with normal metrics creates no alert
- [ ] Test sustained CPU over 3 heartbeats creates alert

**Files to modify:**
- `tests/test_heartbeat.py` or `tests/test_alerting.py` - Integration tests

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test disk 82% creates HIGH Alert record | Pending |
| AC2 | Test disk 96% creates CRITICAL Alert record | Pending |
| AC3 | Test memory 87% x3 creates HIGH Alert record | Pending |
| AC4 | Test CPU 90% x3 creates HIGH Alert record | Pending |
| AC5 | Test CPU 96% x3 creates CRITICAL Alert record | Pending |
| AC6 | Test CPU spike then drop creates no Alert | Pending |
| AC7 | Test offline creates CRITICAL Alert record | Pending |
| AC8 | Test HIGH escalates to CRITICAL (Alert updated) | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Heartbeat with null metrics | Skip threshold check (already handled) |
| Config not yet set | Use DEFAULT_THRESHOLDS |
| Multiple alerts same heartbeat | Create multiple Alert records |
| Escalation HIGH→CRITICAL | Update existing Alert severity, don't create new |
| Alert already exists (dedup) | Don't create duplicate (handled by AlertState) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance on heartbeat | Slower response | Async operations, minimal DB queries |
| Missing Alert for escalation | Inconsistent data | Query open Alerts, update if exists |
| Transaction failure | Partial state | Single transaction for metrics + alerts |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0010: Alert Schema | Story | Done - Alert model exists |
| US0003: Heartbeat Endpoint | Story | Done - endpoint exists |
| US0008: Server Status Detection | Story | Done - offline detection works |

## Open Questions

None - all requirements clear from story and existing codebase analysis.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Integration tests for heartbeat flow
- [ ] Alert records created with correct data
- [ ] Alert records resolved on auto-resolve
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Existing tests still pass

## Notes

**Key architectural decision:** Alert records are created by `AlertingService`, not the heartbeat endpoint directly. This keeps the alerting logic centralised and testable.

**Title generation:** Alert titles should be descriptive, e.g.:
- "High disk usage on server-name (82%)"
- "Critical CPU usage on server-name (96%)"
- "Server offline: server-name"

**Existing test coverage:** `test_alerting.py` has 23 tests covering threshold logic. New tests focus on Alert record creation integration.
