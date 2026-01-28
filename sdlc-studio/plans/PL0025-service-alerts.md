# PL0025: Service-Down Alert Generation - Implementation Plan

> **Status:** Complete
> **Story:** [US0021: Service-Down Alert Generation](../stories/US0021-service-alerts.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Extend the alerting system to generate alerts when monitored services stop or fail. When a heartbeat reports a service as stopped/failed, and that service is in the expected services list (enabled), an alert is created. Critical services generate high severity alerts; non-critical services generate medium severity alerts. Alerts auto-resolve when services come back up.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Alert on critical service stopped | Critical service stopped creates HIGH severity alert |
| AC2 | Alert on non-critical service stopped | Non-critical service stopped creates MEDIUM severity alert |
| AC3 | No alert for unconfigured services | Services not in expected_services list are ignored |
| AC4 | No alert for disabled services | Services with enabled=false are ignored |
| AC5 | Alert includes service name | Alert title contains the service name |
| AC6 | Slack notification for critical | Slack message sent for critical service alerts |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12
- **Framework:** FastAPI with SQLAlchemy 2.0
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling (not bare except)
- Logging with structured messages
- Async/await patterns for database operations

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| SQLAlchemy | /sqlalchemy/sqlalchemy | async select queries | select().where(), scalar_one_or_none() |

### Existing Patterns

From codebase exploration:

1. **Alerting Service:** `backend/src/homelab_cmd/services/alerting.py`
   - `AlertingService` class with `evaluate_heartbeat()` method
   - `_evaluate_metric()` for single metric evaluation
   - `_create_alert_record()` for persistent alerts
   - `_check_auto_resolve()` for resolution
   - `AlertEvent` named tuple for notification events

2. **Alert State Tracking:** `backend/src/homelab_cmd/db/models/alert_state.py`
   - `AlertState` model for deduplication (one alert per server/metric)
   - `MetricType` enum: CPU, MEMORY, DISK, OFFLINE
   - Needs extension for SERVICE type

3. **Heartbeat Processing:** `backend/src/homelab_cmd/api/routes/agents.py`
   - Services stored in `ServiceStatus` table
   - Alert evaluation called after metrics
   - Needs extension to evaluate service status

4. **Slack Notifier:** `backend/src/homelab_cmd/services/notifier.py`
   - `SUGGESTIONS` dict for metric-specific suggestions
   - `_format_alert_message()` for Slack payload
   - Handles offline with special formatting

Reference files:
- `backend/src/homelab_cmd/services/alerting.py` - AlertingService class
- `backend/src/homelab_cmd/db/models/alert_state.py` - MetricType enum
- `backend/src/homelab_cmd/api/routes/agents.py` - receive_heartbeat()
- `backend/src/homelab_cmd/services/notifier.py` - SlackNotifier

## Recommended Approach

**Strategy:** TDD
**Rationale:** Service alerting integrates with existing alert infrastructure. Writing tests first ensures correct integration with deduplication, auto-resolve, and Slack notification without breaking existing functionality.

### Test Priority

1. Critical service stopped creates HIGH alert
2. Non-critical service stopped creates MEDIUM alert
3. Unconfigured/disabled services are ignored
4. Alert auto-resolves when service starts
5. No duplicate alerts for same service
6. Slack notification format includes service name

### Documentation Updates Required

- [ ] None required (internal feature)

## Implementation Steps

### Phase 1: Extend Alert State Model

**Goal:** Add SERVICE metric type for alert state tracking

#### Step 1.1: Add SERVICE to MetricType enum

- [ ] Add `SERVICE = "service"` to `MetricType` enum

**Files to modify:**
- `backend/src/homelab_cmd/db/models/alert_state.py` - Add enum value

**Considerations:**
- Existing `AlertState` table uses `metric_type` as String(20), so no migration needed
- SERVICE alerts will also need a service_name identifier for deduplication

#### Step 1.2: Create ServiceAlertState concept

Service alerts need unique deduplication per (server_id, service_name), not just (server_id, metric_type). Options:

**Option A:** Encode service_name in metric_type field as `service:plex`
**Option B:** Add optional `service_name` column to AlertState with unique constraint

**Recommendation:** Option A - simpler, no migration, follows existing pattern where metric_type is the dedup key.

- [ ] Use `f"service:{service_name}"` as metric_type for service alerts

### Phase 2: Extend AlertingService

**Goal:** Add service status evaluation to heartbeat processing

#### Step 2.1: Write tests for service alert evaluation

- [ ] Create `tests/test_service_alerting.py`
- [ ] Test critical service stopped creates HIGH alert
- [ ] Test non-critical service stopped creates MEDIUM alert
- [ ] Test unconfigured service ignored
- [ ] Test disabled service ignored
- [ ] Test auto-resolve when service starts
- [ ] Test no duplicate alerts

**Files to create:**
- `tests/test_service_alerting.py` - New test file

#### Step 2.2: Add evaluate_services method

- [ ] Add `evaluate_services()` method to `AlertingService`
- [ ] Query expected_services for the server
- [ ] Compare with reported service statuses
- [ ] Create alerts for stopped/failed services (enabled, expected)
- [ ] Auto-resolve alerts for running services

**Files to modify:**
- `backend/src/homelab_cmd/services/alerting.py` - Add method

**Method signature:**
```python
async def evaluate_services(
    self,
    server_id: str,
    server_name: str,
    services: list[ServiceStatusData],
    notifications: NotificationsConfig,
) -> list[AlertEvent]:
```

#### Step 2.3: Add _evaluate_single_service helper

- [ ] Implement `_evaluate_single_service()` for one service
- [ ] Check if service is expected and enabled
- [ ] Determine severity from is_critical flag
- [ ] Create/update AlertState for service
- [ ] Create Alert record if new alert
- [ ] Return AlertEvent for notification

**Logic:**
```python
# Dedup key: f"service:{service_name}"
metric_type = f"service:{service_name}"
state = await self._get_or_create_state(server_id, metric_type)

if status in ['stopped', 'failed']:
    severity = AlertSeverity.HIGH if is_critical else AlertSeverity.MEDIUM
    if state.current_severity is None:
        # New alert
        state.current_severity = severity.value
        await self._create_service_alert_record(...)
        return AlertEvent(...)
elif status == 'running':
    if state.current_severity is not None:
        # Auto-resolve
        await self._resolve_service_alert(...)
        return AlertEvent(is_resolved=True, ...)
```

#### Step 2.4: Add _create_service_alert_record helper

- [ ] Create `_create_service_alert_record()` method
- [ ] Generate descriptive title: "Service {name} is {status}"
- [ ] Generate message with server and service details
- [ ] Set alert_type to "service"
- [ ] Store service_name in alert (needs to extend Alert model or use message)

**Files to modify:**
- `backend/src/homelab_cmd/services/alerting.py` - Add method

**Alert title format:** "Service plex is stopped on mediaserver"
**Alert message format:** "Expected service plex on mediaserver is stopped."

#### Step 2.5: Add _resolve_service_alert helper

- [ ] Create `_resolve_service_alert()` method
- [ ] Find open service alert for this server/service
- [ ] Mark as resolved, auto_resolved=True

**Files to modify:**
- `backend/src/homelab_cmd/services/alerting.py` - Add method

### Phase 3: Integrate with Heartbeat Processing

**Goal:** Call service evaluation in heartbeat endpoint

#### Step 3.1: Update receive_heartbeat endpoint

- [ ] After storing service status, call `alerting_service.evaluate_services()`
- [ ] Pass service status data from heartbeat
- [ ] Add returned events to the events list for notification

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add service evaluation call

**Integration point:**
```python
# After existing: events = await alerting_service.evaluate_heartbeat(...)

if heartbeat.services:
    service_events = await alerting_service.evaluate_services(
        server_id=heartbeat.server_id,
        server_name=server.hostname,
        services=heartbeat.services,
        notifications=notifications,
    )
    events.extend(service_events)
```

### Phase 4: Extend Slack Notifier

**Goal:** Add service-specific suggestion to Slack notifications

#### Step 4.1: Add service suggestion

- [ ] Add "service" key to SUGGESTIONS dict
- [ ] Message: "Check service logs and consider restarting"

**Files to modify:**
- `backend/src/homelab_cmd/services/notifier.py` - Add to SUGGESTIONS dict

#### Step 4.2: Handle service alerts in _format_alert_message

- [ ] Check if metric_type starts with "service:"
- [ ] Extract service name from metric_type
- [ ] Format header as "Service Alert" instead of "{METRIC} Usage Alert"
- [ ] Show service name in fields instead of percentage

**Files to modify:**
- `backend/src/homelab_cmd/services/notifier.py` - Update formatting

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Unit Tests

- [ ] Test evaluate_services with critical service stopped
- [ ] Test evaluate_services with non-critical service stopped
- [ ] Test evaluate_services ignores unconfigured services
- [ ] Test evaluate_services ignores disabled services
- [ ] Test auto-resolve when service starts
- [ ] Test deduplication (no duplicate alerts)

#### Step 5.2: Integration Tests

- [ ] Test full heartbeat with service status triggers alert
- [ ] Test Slack notification sent for critical service
- [ ] Test alert appears in GET /api/v1/alerts

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test critical service stopped creates HIGH alert | Pass |
| AC2 | Test non-critical service stopped creates MEDIUM alert | Pass |
| AC3 | Test unconfigured service creates no alert | Pass |
| AC4 | Test disabled service creates no alert | Pass |
| AC5 | Verify alert title contains service name | Pass |
| AC6 | Test Slack message sent for critical | Pass |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Service flaps (stop/start quickly) | Alert created, then auto-resolved (expected behaviour) |
| Multiple services down simultaneously | One alert per service, all processed in same heartbeat |
| Service was never running before | Alert on first "stopped" status (expected) |
| Service status "unknown" | No alert (might be configuration error, too noisy) |
| Expected service deleted while alert open | Existing alert remains, no new alerts created |
| Service name with special characters | URL-safe in metric_type key (colon separator only issue) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Service flapping causes alert spam | Medium | Single alert per service, auto-resolve on running |
| Metric type key collision | Low | Use "service:" prefix to namespace |
| Open question: grace period | Low | Defer to future enhancement (noted in story) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0010: Alert Schema | Story | Done - Alert model exists |
| US0011: Threshold Evaluation | Story | Done - AlertingService exists |
| US0012: Alert Deduplication | Story | Done - AlertState exists |
| US0017: Service Schema | Story | Done - ExpectedService model exists |
| US0018: Agent Service Collection | Story | Done - ServiceStatus stored |

## Open Questions

- [ ] Grace period before alerting (service might restart quickly) - Owner: Darren - **Deferred to future enhancement**

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (13 tests in test_service_alerting.py)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Integration with existing alert system verified
- [x] Slack notifications tested
- [x] Ready for code review

## Notes

- Using `service:{name}` as metric_type allows reuse of existing AlertState deduplication without schema changes
- MEDIUM severity for non-critical services aligns with AlertSeverity enum (already defined but unused)
- Service alerts don't have threshold values, so threshold_value will be 0 in alert records
- Auto-resolve happens on first "running" heartbeat after alert, no sustained threshold needed
