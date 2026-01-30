# US0181: Alert Sustained Duration Configuration

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** alerts to only fire after a condition is sustained for a configurable duration
**So that** I don't receive false positive alerts from transient spikes

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Wants reliable alerts without notification fatigue from momentary spikes.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, alerts fire immediately when a threshold is breached (e.g., CPU > 90%). This can cause false positives from brief transient spikes that resolve on their own. Industry-standard alerting systems (Prometheus, Datadog, etc.) support "sustained duration" or "for" clauses that require the condition to persist for a specified time before firing.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| PRD | Performance | False positive rate < 5% | Sustained duration helps achieve this |
| EP0002 | Architecture | Threshold checks on heartbeat | Need to track breach start time |
| TRD | Data | SQLite storage | Store breach_started_at timestamp |

---

## Acceptance Criteria

### AC1: Configurable sustained duration per threshold

- **Given** I am configuring alert thresholds
- **When** I set a threshold (e.g., CPU > 90%)
- **Then** I can also configure a sustained duration (e.g., 5 minutes)
- **And** the default sustained duration is 0 (immediate firing, current behaviour)

### AC2: Alert fires only after sustained breach

- **Given** a threshold has a sustained duration of 5 minutes
- **When** the condition is breached
- **Then** no alert fires immediately
- **And** the breach start time is recorded
- **And** the alert fires only if the condition remains breached for 5 continuous minutes

### AC3: Breach resets if condition clears

- **Given** a condition has been breached for 3 minutes (threshold: 5 min)
- **When** the condition clears (metric goes below threshold)
- **Then** the breach timer resets
- **And** no alert is fired

### AC4: UI shows pending alerts

- **Given** a condition is breached but duration not yet met
- **When** I view the dashboard
- **Then** I can see "pending" alerts with countdown/timer
- **And** the pending alert shows time until it will fire

### AC5: API supports sustained duration

- **Given** the alert configuration API
- **When** I configure a threshold
- **Then** I can specify `sustained_seconds` parameter
- **And** the API returns current sustained_seconds for each threshold

---

## Scope

### In Scope

- Sustained duration field per threshold type
- Breach start timestamp tracking
- Timer reset on condition clear
- UI for configuring sustained duration
- Pending alert visibility
- Default to 0 (backwards compatible)

### Out of Scope

- Per-server override of sustained duration
- Complex alert rules (AND/OR conditions)
- Percentage-based duration (e.g., "breached 80% of last 10 minutes")

---

## Technical Notes

### Implementation Approach

1. **Schema changes:**
   ```python
   class ThresholdConfig(Base):
       # Existing fields...
       sustained_seconds: int = 0  # Default: immediate

   class PendingBreach(Base):
       server_id: str
       threshold_type: str
       breach_started_at: datetime
       current_value: float
   ```

2. **Threshold evaluation logic:**
   ```python
   def evaluate_threshold(server, metric_type, value, threshold):
       if value > threshold.value:
           pending = get_or_create_pending_breach(server, metric_type)
           if pending.breach_started_at + sustained_seconds <= now:
               create_alert(...)
               delete_pending_breach(pending)
       else:
           delete_pending_breach(server, metric_type)  # Reset timer
   ```

3. **API changes:**
   - `GET /api/v1/config/thresholds` - returns sustained_seconds
   - `PUT /api/v1/config/thresholds` - accepts sustained_seconds
   - `GET /api/v1/alerts/pending` - returns pending breaches

### Files to Modify

- `backend/src/homelab_cmd/db/models/config.py` - Add sustained_seconds
- `backend/src/homelab_cmd/db/models/pending_breach.py` - New model
- `backend/src/homelab_cmd/services/alerting.py` - Update evaluation logic
- `backend/src/homelab_cmd/api/routes/config.py` - API updates
- `frontend/src/pages/SettingsPage.tsx` - UI for sustained duration
- Alembic migration for schema changes

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | sustained_seconds = 0 | Immediate firing (current behaviour) |
| 2 | Server goes offline during breach | Clear pending breach |
| 3 | Hub restarts during breach | Pending breaches lost (acceptable) |
| 4 | Multiple thresholds breached | Track each independently |
| 5 | Threshold config changed mid-breach | Apply new duration to existing breach |

---

## Test Scenarios

- [ ] Alert fires immediately when sustained_seconds = 0
- [ ] Alert fires after sustained duration met
- [ ] Breach timer resets when condition clears
- [ ] Pending breaches visible in API
- [ ] UI shows pending alerts with countdown
- [ ] Multiple servers with different breach states
- [ ] Threshold config change applies to pending breach

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0011 | Threshold evaluation logic | Done |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - requires schema change, state tracking, and UI updates

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0002 open question |
