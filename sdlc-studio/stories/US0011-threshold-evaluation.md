# US0011: Threshold Evaluation and Alert Generation

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** alerts to be automatically generated when metrics exceed thresholds for a sustained period
**So that** I'm aware of genuine issues without being bothered by brief spikes

## Context

### Persona Reference

**Darren** - Discovers disk full issues only when services fail. Needs proactive alerting to catch problems early, but not spam from transient CPU/memory spikes.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Metrics have different behaviours that require different alerting strategies:

| Metric Type | Behaviour | Alert Strategy |
|-------------|-----------|----------------|
| **Transient** (CPU, Memory) | Brief spikes are normal | Alert only if sustained above threshold |
| **Persistent** (Disk) | Gradual, won't self-resolve | Alert immediately, with reminder cooldowns |
| **Binary** (Offline) | Discrete state change | Alert immediately on state change |

### Severity Model

| Severity | Meaning | Trigger |
|----------|---------|---------|
| CRITICAL | Immediate action needed | Value >= critical threshold |
| HIGH | Attention needed soon | Value >= high threshold |
| RESOLVED | Issue cleared | Value below thresholds |

## Acceptance Criteria

### AC1: Disk threshold alerts (immediate)

- **Given** a server reports disk usage of 82%
- **When** the heartbeat is processed
- **Then** a high severity "disk" alert is created immediately

### AC2: Critical disk threshold (immediate)

- **Given** a server reports disk usage of 96%
- **When** the heartbeat is processed
- **Then** a critical severity "disk" alert is created immediately

### AC3: Memory threshold alerts (sustained)

- **Given** a server reports memory usage of 87% for 3 consecutive heartbeats
- **When** the third heartbeat is processed
- **Then** a high severity "memory" alert is created

### AC4: CPU threshold alerts (sustained)

- **Given** a server reports CPU usage above 86% for 3 consecutive heartbeats
- **When** the third heartbeat is processed
- **Then** a high severity "cpu" alert is created

### AC5: CPU critical threshold (sustained)

- **Given** a server reports CPU usage above 96% for 3 consecutive heartbeats
- **When** the third heartbeat is processed
- **Then** a critical severity "cpu" alert is created

### AC6: Brief spike does not alert

- **Given** a server reports CPU usage of 99%
- **When** CPU drops below threshold on next heartbeat
- **Then** no alert is created (consecutive count resets)

### AC7: Offline server alerts

- **Given** a server is marked offline (US0008)
- **When** the status changes to offline
- **Then** a critical severity "offline" alert is created immediately

### AC8: Severity escalation

- **Given** an existing high severity disk alert (at 82%)
- **When** disk usage increases to 96%
- **Then** the existing alert is escalated to critical severity

## Scope

### In Scope

- Per-metric threshold evaluation (high + critical)
- Sustained breach tracking for transient metrics (CPU, Memory)
- Immediate alerting for persistent metrics (Disk)
- Immediate alerting for binary state (Offline)
- Severity assignment based on threshold tier
- Severity escalation when crossing critical threshold
- Configurable sustained_heartbeats per metric type

### Out of Scope

- Custom threshold configuration UI (US0043)
- Alert deduplication (US0012)
- Notification cooldowns (US0012)

## Technical Notes

### Default Thresholds

```python
DEFAULT_THRESHOLDS = {
    'cpu': {
        'high_percent': 85,
        'critical_percent': 95,
        'sustained_heartbeats': 3,  # ~3 minutes
    },
    'memory': {
        'high_percent': 85,
        'critical_percent': 95,
        'sustained_heartbeats': 3,  # ~3 minutes
    },
    'disk': {
        'high_percent': 80,
        'critical_percent': 95,
        'sustained_heartbeats': 0,  # immediate
    },
    'server_offline_seconds': 180,
}
```

### Alert State Tracking

The `alert_states` table tracks consecutive breaches per server per metric:

```sql
CREATE TABLE alert_states (
    id INTEGER PRIMARY KEY,
    server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
    metric_type TEXT,  -- 'cpu', 'memory', 'disk', 'offline'
    current_severity TEXT,  -- NULL, 'critical', 'high'
    consecutive_breaches INTEGER DEFAULT 0,
    current_value REAL,
    first_breach_at TIMESTAMP,
    last_notified_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(server_id, metric_type)
);
```

### Evaluation Logic

```python
async def evaluate_metric(
    server_id: str,
    metric_type: str,
    current_value: float,
    thresholds: MetricThreshold
) -> Optional[Alert]:
    state = await get_or_create_alert_state(server_id, metric_type)

    # Determine if threshold breached
    if current_value >= thresholds.critical_percent:
        target_severity = 'critical'
    elif current_value >= thresholds.high_percent:
        target_severity = 'high'
    else:
        target_severity = None  # below thresholds

    if target_severity is None:
        # Reset consecutive count, may trigger auto-resolve
        state.consecutive_breaches = 0
        return None

    # Update consecutive breach count
    state.consecutive_breaches += 1
    state.current_value = current_value

    # Check if sustained threshold met
    if state.consecutive_breaches >= thresholds.sustained_heartbeats:
        if state.current_severity is None:
            # Create new alert
            return await create_alert(...)
        elif target_severity == 'critical' and state.current_severity == 'high':
            # Escalate existing alert
            return await escalate_alert(...)

    return None
```

**TRD Reference:** [§4 API Contracts - Alerts](../trd.md#4-api-contracts)

### Data Requirements

- Alert states persisted in `alert_states` table
- Thresholds stored in Config table (configurable via UI)
- Alert includes both threshold and actual value for context

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Multiple thresholds breached | Create/escalate multiple alerts (one per metric type) |
| Metric exactly at threshold | Trigger alert (>= comparison) |
| Metric missing (null) | Skip threshold check for that metric |
| Server already has active alert | Handle severity escalation or ignore (no duplicate) |
| Brief CPU spike (1-2 heartbeats) | Don't alert, reset count when drops |
| Consecutive breaches across restarts | State persisted in DB, survives restart |
| Oscillating values (above/below) | Each drop resets consecutive count |

## Test Scenarios

- [ ] Disk 80% creates high severity alert immediately
- [ ] Disk 95% creates critical severity alert immediately
- [ ] Memory 86% for 1 heartbeat does NOT create alert
- [ ] Memory 86% for 3 heartbeats creates high severity alert
- [ ] CPU 96% for 3 heartbeats creates critical severity alert
- [ ] CPU spike (1 heartbeat) then drop does NOT create alert
- [ ] High alert escalates to critical when crossing critical threshold
- [ ] Server offline creates critical severity alert immediately
- [ ] Alert includes correct threshold and actual values
- [ ] Consecutive count survives application restart

## Definition of Done


**Story-specific additions:**

- [ ] All metric types tested (CPU, Memory, Disk, Offline)
- [ ] Sustained threshold logic tested
- [ ] Alert state persistence tested

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0003: Heartbeat Endpoint | Story | Done |
| US0008: Server Status Detection | Story | Done |
| US0010: Alert Schema | Story | Draft |

## Estimation

**Story Points:** 8

**Complexity:** Medium-High - sustained breach tracking, state management

## Open Questions

None - all questions resolved in alerting model redesign.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Major revision: added sustained threshold tracking, per-metric config, severity escalation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
