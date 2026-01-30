# PL0184: Alert Sustained Duration Configuration - Implementation Plan

> **Status:** Ready
> **Story:** [US0181: Alert Sustained Duration Configuration](../stories/US0181-alert-sustained-duration.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-29
> **Language:** Python/TypeScript

## Overview

Enhance the alerting system to support time-based sustained duration for thresholds. Currently the system uses `sustained_heartbeats` (count-based), but users want `sustained_seconds` (time-based) for more intuitive configuration. Additionally, expose pending breaches (conditions breached but duration not yet met) via API and UI.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Configurable sustained duration | Set sustained_seconds per threshold (default 0 = immediate) |
| AC2 | Sustained breach enforcement | Alert fires only after condition sustained for configured duration |
| AC3 | Breach reset on clear | Timer resets when condition clears before duration met |
| AC4 | Pending alerts UI | Show pending alerts with countdown in dashboard |
| AC5 | API support | sustained_seconds in config API, new /alerts/pending endpoint |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Framework:** FastAPI (backend), React (frontend)
- **Test Framework:** pytest, vitest

### Relevant Best Practices
- Use Pydantic for schema validation with clear defaults
- Store timestamps in UTC
- Keep backward compatibility (existing configs should work)
- Use existing AlertState table to track breach timing

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Response models, dependency injection |
| Pydantic | /pydantic/pydantic | Field validation, default values |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Column types, nullable fields |

### Existing Patterns
- `AlertState` already tracks `first_breach_at` timestamp - can be used for sustained timing
- `sustained_heartbeats` field exists in MetricThreshold - will be replaced by `sustained_seconds`
- Threshold evaluation happens in `alerting.py:_evaluate_metric()`
- Config stored in JSON format in `Config` table

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** The changes touch existing logic that already has tests. Better to implement the migration carefully, then update tests to cover new behaviour.

### Test Priority
1. Config API returns and accepts sustained_seconds
2. Alert fires only after sustained duration met
3. Breach timer resets when condition clears
4. Pending alerts API returns correct data

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add sustained_seconds to MetricThreshold schema | `schemas/config.py` | - | [ ] |
| 2 | Add migration for config value conversion | - | 1 | [ ] |
| 3 | Update AlertState to ensure first_breach_at tracking | `models/alert_state.py` | - | [ ] |
| 4 | Update threshold evaluation to use time-based check | `services/alerting.py` | 1, 3 | [ ] |
| 5 | Add /api/v1/alerts/pending endpoint | `routes/alerts.py` | 3 | [ ] |
| 6 | Add PendingBreachResponse schema | `schemas/alert.py` | - | [ ] |
| 7 | Update frontend MetricThreshold type | `types/config.ts` | 1 | [ ] |
| 8 | Update Settings page duration selector | `pages/Settings.tsx` | 7 | [ ] |
| 9 | Add pending alerts section to dashboard | `pages/Dashboard.tsx` | 5, 7 | [ ] |
| 10 | Add PendingAlertCard component | `components/PendingAlertCard.tsx` | 9 | [ ] |
| 11 | Update tests for new config format | `tests/test_config.py` | 1-4 | [ ] |
| 12 | Add tests for pending alerts API | `tests/test_alerts.py` | 5 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 3, 6 | None (schemas/models) |
| B | 4, 5 | Group A (backend logic) |
| C | 7, 8, 9, 10 | Task 1 (frontend) |
| D | 11, 12 | Groups B, C (tests) |

---

## Implementation Phases

### Phase 1: Backend Schema & Model Updates
**Goal:** Update config schema and ensure AlertState tracks breach timing

- [ ] Add `sustained_seconds` field to MetricThreshold (default 0)
- [ ] Keep `sustained_heartbeats` for backward compat, mark deprecated
- [ ] Add conversion logic: sustained_heartbeats * 60 = sustained_seconds (approx)
- [ ] Ensure AlertState.first_breach_at is populated on first breach

**Files:**
- `backend/src/homelab_cmd/api/schemas/config.py` - Add sustained_seconds field
- `backend/src/homelab_cmd/db/models/alert_state.py` - Verify first_breach_at usage

### Phase 2: Backend Logic Updates
**Goal:** Implement time-based threshold evaluation and pending alerts API

- [ ] Update `_evaluate_metric()` to check time elapsed since first_breach_at
- [ ] If elapsed >= sustained_seconds: fire alert
- [ ] If condition clears: reset AlertState (set first_breach_at to null)
- [ ] Add GET /api/v1/alerts/pending endpoint
- [ ] Return pending breaches with time_until_alert calculation

**Files:**
- `backend/src/homelab_cmd/services/alerting.py` - Time-based evaluation
- `backend/src/homelab_cmd/api/routes/alerts.py` - Pending alerts endpoint
- `backend/src/homelab_cmd/api/schemas/alert.py` - PendingBreachResponse

### Phase 3: Frontend Updates
**Goal:** Update settings UI and add pending alerts display

- [ ] Update MetricThreshold type with sustained_seconds
- [ ] Update duration selector options (0s, 60s, 180s, 300s instead of heartbeats)
- [ ] Add pending alerts API client
- [ ] Add PendingAlertCard component with countdown
- [ ] Add pending alerts section to Dashboard (collapsible)

**Files:**
- `frontend/src/types/config.ts` - Update types
- `frontend/src/pages/Settings.tsx` - Update duration selector
- `frontend/src/api/alerts.ts` - Add getPendingAlerts()
- `frontend/src/components/PendingAlertCard.tsx` - New component
- `frontend/src/pages/Dashboard.tsx` - Add pending alerts section

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Config API returns sustained_seconds | `routes/config.py` | Pending |
| AC2 | Alert fires after sustained duration | `services/alerting.py` | Pending |
| AC3 | Breach resets on condition clear | `services/alerting.py` | Pending |
| AC4 | Dashboard shows pending alerts | `pages/Dashboard.tsx` | Pending |
| AC5 | /alerts/pending endpoint works | `routes/alerts.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | sustained_seconds = 0 | Immediate firing (current behaviour preserved) | Phase 2 |
| 2 | Server goes offline during breach | Clear pending breach when server goes offline | Phase 2 |
| 3 | Hub restarts during breach | Pending breaches lost (first_breach_at persisted in DB) | Phase 2 |
| 4 | Multiple thresholds breached | Track each metric type independently via AlertState | Phase 2 |
| 5 | Threshold config changed mid-breach | Apply new duration to existing breach (re-evaluate) | Phase 2 |

**Coverage:** 5/5 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing configs | High | Provide automatic migration from heartbeats to seconds |
| Performance of pending alerts query | Medium | Index AlertState on first_breach_at |
| UI countdown accuracy | Low | Update every 10s, show "within X min" not exact seconds |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)

---

## Notes

The existing `sustained_heartbeats` field will be deprecated but kept for backward compatibility. New installs will use `sustained_seconds` with appropriate defaults. Existing configs will be auto-converted on first load.

Duration options in UI:
- Immediately (0s)
- 1 minute (60s)
- 3 minutes (180s) - recommended
- 5 minutes (300s)
