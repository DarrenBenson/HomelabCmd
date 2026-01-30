# TS0184: Alert Sustained Duration Configuration

> **Status:** Draft
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the alert sustained duration feature that requires threshold breaches to persist for a configurable time before firing alerts. Covers the `sustained_seconds` configuration field, time-based breach evaluation, breach timer reset on condition clear, pending alerts API endpoint, and frontend UI updates.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0181](../stories/US0181-alert-sustained-duration.md) | Alert Sustained Duration Configuration | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0181 | AC1 | Configurable sustained duration per threshold | TC001, TC002, TC003 | Pending |
| US0181 | AC2 | Alert fires only after sustained breach | TC004, TC005, TC006 | Pending |
| US0181 | AC3 | Breach resets if condition clears | TC007, TC008 | Pending |
| US0181 | AC4 | UI shows pending alerts | TC015, TC016, TC017 | Pending |
| US0181 | AC5 | API supports sustained duration | TC009, TC010, TC011, TC012 | Pending |

**Coverage:** 5/5 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Validate schema fields, time-based evaluation logic, API responses |
| Integration | Yes | Validate AlertState tracking, pending alerts query, UI rendering |
| E2E | No | Manual verification sufficient for countdown display |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Test database, mock datetime for time-based tests |
| External Services | None |
| Test Data | Servers with various metric values, threshold configurations |

---

## Test Cases

### TC001: Config API returns sustained_seconds field

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A threshold configuration exists | Config in database |
| When | GET /api/v1/config/thresholds | Config fetched |
| Then | Response includes sustained_seconds field | Field present |

**Assertions:**
- [ ] Response contains "sustained_seconds" for each threshold type
- [ ] Response status is 200
- [ ] Default value is 0 (immediate firing)

---

### TC002: Config API accepts sustained_seconds in update

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | User wants to set sustained duration for CPU threshold | Update prepared |
| When | PUT /api/v1/config/thresholds with {"cpu": {"sustained_seconds": 300}} | Config updated |
| Then | Response confirms sustained_seconds is saved | 200 response |

**Assertions:**
- [ ] Response status is 200
- [ ] Response shows sustained_seconds: 300 for CPU
- [ ] Subsequent GET returns sustained_seconds: 300

---

### TC003: Config API validates sustained_seconds is non-negative

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Invalid sustained_seconds value | Negative value |
| When | PUT /api/v1/config/thresholds with {"cpu": {"sustained_seconds": -60}} | Validation runs |
| Then | Response is 422 with validation error | Rejected |

**Assertions:**
- [ ] Response status is 422
- [ ] Error message mentions invalid sustained_seconds value
- [ ] Config remains unchanged

---

### TC004: Alert fires immediately when sustained_seconds is 0

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Threshold with sustained_seconds = 0 | Immediate firing |
| When | Metric breaches threshold (CPU > 90%) | Threshold evaluated |
| Then | Alert created immediately | Alert fired |

**Assertions:**
- [ ] Alert record created in database
- [ ] Alert created_at matches evaluation time
- [ ] No "pending" state observed
- [ ] Backward compatibility maintained

---

### TC005: Alert fires only after sustained duration met

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Threshold with sustained_seconds = 300 (5 min) | Delayed firing |
| When | Metric breaches threshold at T=0 | Breach recorded |
| And | Metric still breached at T=300s | Duration met |
| Then | Alert created at T=300s | Alert fired after delay |

**Assertions:**
- [ ] No alert created at T=0
- [ ] AlertState.first_breach_at set to T=0
- [ ] Alert created when elapsed >= 300s
- [ ] Alert references original breach time

---

### TC006: Alert not fired before sustained duration

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Threshold with sustained_seconds = 300 | Delayed firing |
| When | Metric breaches at T=0, checked at T=180s | Still pending |
| Then | No alert created yet | Pending state |

**Assertions:**
- [ ] No alert record in database
- [ ] AlertState shows first_breach_at = T=0
- [ ] AlertState still active (not cleared)

---

### TC007: Breach timer resets when condition clears

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Breach started at T=0, sustained_seconds = 300 | Timer running |
| When | Metric drops below threshold at T=180s | Condition cleared |
| Then | AlertState.first_breach_at reset to null | Timer reset |

**Assertions:**
- [ ] AlertState.first_breach_at is null after clear
- [ ] No alert created
- [ ] New breach at T=200s starts fresh timer

---

### TC008: Partial breach does not accumulate

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | sustained_seconds = 300 | Delayed firing |
| When | Breach from T=0-180s (clears), breach from T=240s-540s | Two breach periods |
| Then | Alert fires at T=540s (300s after second breach start) | Fresh timer |

**Assertions:**
- [ ] First breach period does not contribute to second
- [ ] Alert fires 300s after T=240s, not after combined time
- [ ] Each breach period tracked independently

---

### TC009: GET /api/v1/alerts/pending returns pending breaches

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with active breach (not yet duration met) | Pending breach exists |
| When | GET /api/v1/alerts/pending | Pending alerts fetched |
| Then | Response includes pending breach data | Pending list returned |

**Assertions:**
- [ ] Response status is 200
- [ ] Response contains array of pending breaches
- [ ] Each breach includes server_id, metric_type, first_breach_at

---

### TC010: Pending alerts include time_until_alert calculation

**Type:** Unit | **Priority:** High | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Breach started 60s ago, sustained_seconds = 300 | 240s remaining |
| When | GET /api/v1/alerts/pending | Time calculated |
| Then | Response includes time_until_alert = 240 | Countdown shown |

**Assertions:**
- [ ] time_until_alert calculated correctly (300 - 60 = 240)
- [ ] time_until_alert decreases with each poll
- [ ] time_until_alert is 0 or negative when duration met

---

### TC011: Pending alerts empty when no active breaches

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No servers have active breaches | Clean state |
| When | GET /api/v1/alerts/pending | Empty result |
| Then | Response is empty array | No pending |

**Assertions:**
- [ ] Response status is 200
- [ ] Response is empty array []
- [ ] Not an error condition

---

### TC012: Pending alerts excludes completed/fired alerts

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Alert already fired for a breach | Alert exists |
| When | GET /api/v1/alerts/pending | Pending fetched |
| Then | Fired breach not included in pending list | Only pending shown |

**Assertions:**
- [ ] Fired alerts not in pending list
- [ ] Only breaches awaiting duration included
- [ ] Cleared breaches not included

---

### TC013: Server offline clears pending breach

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has pending CPU breach | Breach active |
| When | Server goes offline (heartbeat timeout) | Server status changes |
| Then | Pending breach cleared | Timer cancelled |

**Assertions:**
- [ ] AlertState.first_breach_at set to null
- [ ] Pending breach removed from /alerts/pending
- [ ] No alert fires for offline server

---

### TC014: Multiple thresholds tracked independently

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | CPU and memory both breaching on same server | Two breaches |
| When | CPU breach clears, memory continues | Independent tracking |
| Then | Only CPU timer resets, memory continues | Separate timers |

**Assertions:**
- [ ] CPU AlertState cleared
- [ ] Memory AlertState retains first_breach_at
- [ ] /alerts/pending shows only memory breach
- [ ] Memory alert fires at correct time

---

### TC015: Dashboard shows pending alerts section

**Type:** Integration | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | One or more pending alerts exist | Pending breaches |
| When | User views dashboard | Dashboard rendered |
| Then | Pending alerts section visible | Section shown |

**Assertions:**
- [ ] Pending alerts section rendered
- [ ] Section shows count of pending alerts
- [ ] Section is collapsible
- [ ] Empty state hidden when no pending

---

### TC016: PendingAlertCard shows countdown

**Type:** Integration | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pending alert with 240s until fire | Countdown data |
| When | Card rendered | Countdown displayed |
| Then | Card shows "within 4 min" countdown | Approximate time |

**Assertions:**
- [ ] Server name displayed
- [ ] Metric type displayed (CPU, Memory, etc.)
- [ ] Countdown shown as "within X min"
- [ ] Current value displayed

---

### TC017: Settings page shows duration selector

**Type:** Integration | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | User on Settings page, Thresholds section | Settings open |
| When | Viewing threshold configuration | Options shown |
| Then | Duration selector shows time-based options | Options available |

**Assertions:**
- [ ] Selector shows "Immediately (0s)"
- [ ] Selector shows "1 minute (60s)"
- [ ] Selector shows "3 minutes (180s)"
- [ ] Selector shows "5 minutes (300s)"
- [ ] Selected value reflects current config

---

### TC018: Threshold config change applies to existing breach

**Type:** Unit | **Priority:** Medium | **Story:** US0181

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Breach started 60s ago, sustained_seconds = 300 | 240s remaining |
| When | Config changed to sustained_seconds = 120 | Duration shortened |
| Then | Alert fires on next evaluation (duration now met) | Config applied |

**Assertions:**
- [ ] Alert fires immediately after config change
- [ ] 60s elapsed >= 120s new threshold (satisfied by re-evaluation)
- [ ] No need to wait full original duration

---

## Edge Cases

| # | Edge Case | Test Case | Handling |
|---|-----------|-----------|----------|
| 1 | sustained_seconds = 0 | TC004 | Immediate firing (backward compat) |
| 2 | Server goes offline during breach | TC013 | Clear pending breach |
| 3 | Hub restarts during breach | - | first_breach_at persisted in DB |
| 4 | Multiple thresholds breached | TC014 | Track independently via AlertState |
| 5 | Threshold config changed mid-breach | TC018 | Apply new duration immediately |

---

## Fixtures

```yaml
servers:
  - id: server-1
    server_id: test-server
    status: online
    hostname: test.local

threshold_configs:
  - metric_type: cpu_usage
    warning: 80
    critical: 90
    sustained_seconds: 300

  - metric_type: memory_usage
    warning: 85
    critical: 95
    sustained_seconds: 0  # immediate

alert_states:
  - server_id: server-1
    metric_type: cpu_usage
    first_breach_at: "2026-01-29T10:00:00Z"  # 60s ago
    current_value: 92.5

mock_datetime:
  now: "2026-01-29T10:01:00Z"  # For time-based calculations
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Config API returns sustained_seconds | Pending | - |
| TC002 | Config API accepts sustained_seconds | Pending | - |
| TC003 | Config API validates non-negative | Pending | - |
| TC004 | Alert fires immediately when 0 | Pending | - |
| TC005 | Alert fires after sustained duration | Pending | - |
| TC006 | Alert not fired before duration | Pending | - |
| TC007 | Breach timer resets on clear | Pending | - |
| TC008 | Partial breach does not accumulate | Pending | - |
| TC009 | GET /alerts/pending returns breaches | Pending | - |
| TC010 | Pending includes time_until_alert | Pending | - |
| TC011 | Pending empty when no breaches | Pending | - |
| TC012 | Pending excludes fired alerts | Pending | - |
| TC013 | Server offline clears breach | Pending | - |
| TC014 | Multiple thresholds independent | Pending | - |
| TC015 | Dashboard pending alerts section | Pending | - |
| TC016 | PendingAlertCard shows countdown | Pending | - |
| TC017 | Settings page duration selector | Pending | - |
| TC018 | Config change applies to breach | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0002](../epics/EP0002-alerting.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Implementation Plan | [PL0184](../plans/PL0184-alert-sustained-duration.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec from US0181 story plan |
