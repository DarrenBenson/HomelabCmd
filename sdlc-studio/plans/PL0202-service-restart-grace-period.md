# PL0202: Service Restart Grace Period

> **Story:** [US0185: Service Restart Grace Period](../stories/US0185-service-restart-grace-period.md)
> **Status:** Done
> **Approach:** Test-After
> **Created:** 2026-01-31
> **Completed:** 2026-01-31

## Overview

Implement a grace period after service restart to prevent alert spam during the expected startup window. When a service is restarted (manually or via remediation), no "service stopped" alert fires for a configurable period (default 60 seconds).

---

## Acceptance Criteria Summary

| AC | Description | Implementation |
|----|-------------|----------------|
| AC1 | Configurable grace period setting | Add `service_restart_grace_seconds` to config schema |
| AC2 | Grace period after manual restart | Set `last_restart_at` on restart action execution |
| AC3 | Grace period after remediation restart | Set `last_restart_at` on remediation command completion |
| AC4 | Alert fires after grace period if still down | Alerting checks timestamp vs grace period |
| AC5 | Grace period visible in UI | Frontend shows "Restarting (Xs remaining)" |

---

## Technical Context

### Current Implementation

- **Service alerts:** `alerting.py:_evaluate_single_service()` creates alerts when expected services are stopped/failed
- **Restart actions:** `services.py:restart_service()` creates `RemediationAction` records
- **Config system:** Uses `config.py:get_config_value()` to retrieve settings from DB

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/homelab_cmd/db/models/service.py` | Service models (ExpectedService, ServiceStatus) |
| `backend/src/homelab_cmd/services/alerting.py` | Alert evaluation logic |
| `backend/src/homelab_cmd/api/routes/services.py` | Service restart endpoint |
| `backend/src/homelab_cmd/api/schemas/config.py` | Configuration schemas |
| `frontend/src/components/ServiceStatus.tsx` | Service status display |

### Integration Points

1. **AlertState table:** Already tracks alert state per server/metric - we'll track restart time per service
2. **Config table:** Add `service_restart_grace_seconds` as new config key
3. **ExpectedService model:** Add `last_restart_at` column

---

## Recommended Approach

**Test-After** approach recommended because:
- Modifying existing alerting logic (integration-focused)
- Changes span backend alerting, API, and frontend
- Low-medium complexity with well-defined behaviour

---

## Implementation Tasks

### Phase 1: Backend Model & Migration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add `last_restart_at` column to `ExpectedService` model | [x] | DateTime, nullable |
| 2 | Create Alembic migration for new column | [x] | `add_service_last_restart_at.py` |
| 3 | Add `service_restart_grace_seconds` to config defaults | [x] | Default: 60 |

### Phase 2: Backend Alert Logic

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | Update `_evaluate_single_service()` to check grace period | [x] | Skip alert if in grace period |
| 5 | Add helper function `_is_in_grace_period()` | [x] | Calculate from `last_restart_at` |
| 6 | Update alert message for post-grace-period failures | [x] | "failed to start after restart" |

### Phase 3: Backend Restart Tracking

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7 | Update `restart_service()` to set `last_restart_at` | [x] | On action creation |
| 8 | Update SSH command execution to set `last_restart_at` | [x] | On command completion |
| 9 | Clear `last_restart_at` when service starts successfully | [x] | In alerting evaluation |

### Phase 4: API Schema Updates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Add `last_restart_at` to `ExpectedServiceResponse` | [x] | Optional datetime |
| 11 | Add `grace_period_remaining` computed field | [x] | Seconds remaining |
| 12 | Add `service_restart_grace_seconds` to config response | [x] | Global setting |

### Phase 5: Frontend Display

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13 | Update service types with `last_restart_at` | [x] | `types/service.ts` |
| 14 | Add grace period calculation utility | [x] | `lib/serviceUtils.ts` |
| 15 | Update ServiceStatus component for "Restarting (Xs)" | [x] | Countdown display |
| 16 | Add real-time countdown update | [x] | useEffect with interval |

### Phase 6: Testing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Write backend unit tests for grace period logic | [x] | All edge cases |
| 18 | Write frontend tests for countdown display | [x] | Timer behaviour |
| 19 | Run lint and type checks | [x] | Verify no regressions |

---

## Edge Case Handling

| # | Scenario | Implementation |
|---|----------|----------------|
| 1 | Service stops during grace period (not restart-related) | Grace period still applies - any stop during grace is suppressed |
| 2 | Multiple restarts in quick succession | Reset `last_restart_at` on each restart - grace period restarts |
| 3 | Hub restarts during grace period | `last_restart_at` persisted in DB - grace period survives restart |
| 4 | Grace period set to 0 | Skip grace period check - immediate alerting behaviour |
| 5 | Service starts before grace period ends | Clear `last_restart_at` and show "running" status |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Clock drift between hub and agent | Low | Low | Use server-side timestamps only |
| Grace period hiding real failures | Medium | Medium | Show "Restarting" status clearly in UI |
| Config not loaded | Low | Medium | Use sensible default (60s) |

---

## Definition of Done

- [ ] All acceptance criteria implemented and verified
- [ ] Unit tests cover all edge cases
- [ ] Frontend shows "Restarting (Xs remaining)" countdown
- [ ] Alert fires with correct message after grace period
- [ ] Migration applies cleanly
- [ ] Lint and type checks pass
- [ ] Code reviewed

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `backend/src/homelab_cmd/db/models/service.py` | Modify | Add `last_restart_at` to `ExpectedService` |
| `migrations/versions/*_add_service_last_restart_at.py` | Create | New column migration |
| `backend/src/homelab_cmd/services/alerting.py` | Modify | Grace period check in `_evaluate_single_service()` |
| `backend/src/homelab_cmd/api/routes/services.py` | Modify | Set `last_restart_at` on restart |
| `backend/src/homelab_cmd/api/schemas/service.py` | Modify | Add fields to response schemas |
| `backend/src/homelab_cmd/api/schemas/config.py` | Modify | Add `service_restart_grace_seconds` |
| `backend/src/homelab_cmd/api/routes/config.py` | Modify | Include new config in defaults |
| `frontend/src/types/service.ts` | Modify | Add `last_restart_at`, `grace_period_remaining` |
| `frontend/src/components/ServiceStatus.tsx` | Modify | Countdown display |
| `frontend/src/lib/serviceUtils.ts` | Create | Grace period calculation |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial plan creation |
