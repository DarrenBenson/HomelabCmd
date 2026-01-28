# US0012: Alert Deduplication, Auto-Resolve, and Notification Cooldowns

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** only one active alert per condition per server, with periodic reminders for ongoing issues
**So that** I'm not overwhelmed with duplicates but still reminded about unresolved problems

## Context

### Persona Reference

**Darren** - Concerned about alert fatigue. Doesn't want 100 alerts when disk stays at 85% for hours, but does want reminders if he hasn't addressed it.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Without deduplication and cooldowns, every heartbeat with disk at 85% would create a new alert. This story ensures:

1. Only one active alert exists per server per metric type
2. Re-notifications are sent based on severity-specific cooldowns
3. Alerts auto-resolve when conditions clear, with optional notification

### Notification Cooldowns

Different severities warrant different reminder frequencies:

| Severity | Cooldown | Rationale |
|----------|----------|-----------|
| CRITICAL | 30 minutes | Urgent, needs attention but not spammy |
| HIGH | 4 hours | Important, less urgent |
| RESOLVED | Once | User wants to know when fixed |

## Acceptance Criteria

### AC1: No duplicate alerts

- **Given** an open disk alert exists for "omv-mediaserver"
- **When** another disk threshold breach is detected
- **Then** no new alert is created

### AC2: Auto-resolve when condition clears

- **Given** an open disk alert exists (triggered at 85%)
- **When** disk usage drops to 75%
- **Then** the alert is automatically resolved

### AC3: Auto-resolve marked correctly

- **Given** an alert is auto-resolved
- **When** viewing the alert
- **Then** `auto_resolved` flag is true and `resolved_at` is set

### AC4: New alert after resolution

- **Given** a disk alert was resolved
- **When** disk usage exceeds threshold again
- **Then** a new alert is created

### AC5: Offline alert auto-resolves on heartbeat

- **Given** an offline alert exists for a server
- **When** a heartbeat is received from that server
- **Then** the offline alert is auto-resolved

### AC6: Critical alert re-notification after cooldown

- **Given** a critical disk alert was notified 35 minutes ago
- **And** the condition still persists
- **When** the next heartbeat is processed
- **Then** a re-notification is sent (cooldown of 30 min expired)

### AC7: High alert re-notification after cooldown

- **Given** a high memory alert was notified 5 hours ago
- **And** the condition still persists
- **When** the next heartbeat is processed
- **Then** a re-notification is sent (cooldown of 4 hours expired)

### AC8: No re-notification within cooldown

- **Given** a critical alert was notified 10 minutes ago
- **And** the condition still persists
- **When** the next heartbeat is processed
- **Then** no re-notification is sent (within 30 min cooldown)

### AC9: Notification on remediation (configurable)

- **Given** `notify_on_remediation` is enabled
- **When** an alert is auto-resolved
- **Then** a "resolved" notification is sent

### AC10: Consecutive breach count resets on resolve

- **Given** an alert state has `consecutive_breaches = 5`
- **When** the metric drops below threshold
- **Then** `consecutive_breaches` resets to 0

## Scope

### In Scope

- Duplicate detection before alert creation
- Auto-resolve logic when condition clears
- Setting `auto_resolved` flag
- Different alert types tracked separately (disk, memory, cpu, offline)
- Notification cooldown per severity level
- `last_notified_at` tracking per alert state
- Re-notification when cooldown expires
- Configurable `notify_on_remediation` setting

### Out of Scope

- Manual resolution (US0014 - via API)
- Acknowledgement (US0014 - via API)
- Per-metric cooldown overrides (using per-severity for simplicity)

## Technical Notes

### Cooldown Configuration

```python
class CooldownConfig(BaseModel):
    """Notification cooldown settings per severity."""

    critical_minutes: int = Field(default=30, ge=5, le=1440)
    high_minutes: int = Field(default=240, ge=15, le=1440)  # 4 hours
```

### Deduplication Logic

```python
async def should_create_alert(server_id: str, metric_type: str) -> bool:
    """Check if an alert should be created (no active alert exists)."""
    state = await get_alert_state(server_id, metric_type)

    # If no state or no active severity, can create
    if state is None or state.current_severity is None:
        return True

    return False
```

### Cooldown-Aware Re-notification

```python
async def should_notify(
    state: AlertState,
    cooldowns: CooldownConfig
) -> bool:
    """Check if enough time has passed since last notification."""
    if state.last_notified_at is None:
        return True  # Never notified

    cooldown_minutes = (
        cooldowns.critical_minutes
        if state.current_severity == 'critical'
        else cooldowns.high_minutes
    )

    elapsed = datetime.now(UTC) - state.last_notified_at
    return elapsed >= timedelta(minutes=cooldown_minutes)
```

### Auto-Resolve Logic

```python
async def check_and_auto_resolve(
    server_id: str,
    metrics: Metrics,
    thresholds: ThresholdsConfig
) -> list[AlertState]:
    """Check if any alerts should be auto-resolved."""
    resolved_states = []
    states = await get_alert_states(server_id)

    for state in states:
        if state.current_severity is None:
            continue

        should_resolve = False
        threshold = None

        if state.metric_type == 'disk':
            threshold = thresholds.disk.high_percent
            should_resolve = metrics.disk_percent < threshold
        elif state.metric_type == 'memory':
            threshold = thresholds.memory.high_percent
            should_resolve = metrics.memory_percent < threshold
        elif state.metric_type == 'cpu':
            threshold = thresholds.cpu.high_percent
            should_resolve = metrics.cpu_percent < threshold
        # Offline resolved separately when heartbeat received

        if should_resolve:
            state.current_severity = None
            state.consecutive_breaches = 0
            state.resolved_at = datetime.now(UTC)
            resolved_states.append(state)

    return resolved_states
```

**TRD Reference:** [§4 API Contracts - Alerts](../trd.md#4-api-contracts)

### API Contracts

N/A - internal logic, no new API endpoints.

### Data Requirements

- Query for existing alert states must be efficient
- Index on `(server_id, metric_type)` (enforced by UNIQUE constraint)
- `last_notified_at` tracked per alert state for cooldown logic

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Acknowledged alert, still breaching | Don't create new alert (still active) |
| Multiple metric types breached | Each type tracked separately |
| Threshold oscillation (85% -> 79% -> 82%) | Alert resolves at 79%, new alert at 82% |
| Very rapid heartbeats | Deduplication handles race conditions |
| Auto-resolve fails | Log error, don't crash; retry on next heartbeat |
| Cooldown during severity escalation | Reset cooldown timer on escalation |
| Notification service unavailable | Mark for retry, don't block alert processing |

## Test Scenarios

- [ ] Second threshold breach doesn't create duplicate
- [ ] Alert auto-resolves when metric drops below threshold
- [ ] `auto_resolved` flag set correctly
- [ ] `resolved_at` timestamp set correctly
- [ ] New alert created after previous resolved
- [ ] Different alert types don't interfere
- [ ] Acknowledged alerts don't get duplicated
- [ ] Offline alert resolves on heartbeat
- [ ] Critical alert re-notified after 30 min cooldown
- [ ] High alert re-notified after 4 hour cooldown
- [ ] No re-notification within cooldown period
- [ ] Remediation notification sent when configured
- [ ] Consecutive breach count resets on resolve

## Definition of Done


**Story-specific additions:**

- [ ] Deduplication tested with concurrent requests
- [ ] Auto-resolve tested for all alert types
- [ ] Cooldown logic tested for each severity
- [ ] Re-notification timing verified

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0010: Alert Schema | Story | Done |
| US0011: Threshold Evaluation | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - state management, cooldown timing

## Open Questions

None - `notify_on_remediation` resolved as configurable (default: true).

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Major revision: added notification cooldowns, re-notification logic, resolved open question |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
