# PL0186: Configuration Drift Detection - Implementation Plan

> **Status:** Draft
> **Story:** [US0122: Configuration Drift Detection](../stories/US0122-configuration-drift-detection.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python

## Overview

Implement automated configuration drift detection that runs daily at 6am, checking all machines with assigned packs against their compliance status. Creates `config_drift` alerts when previously compliant machines become non-compliant, auto-resolves when compliance is restored, and sends Slack notifications for both events.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Scheduled Compliance Check | Daily 6am job checks all machines with assigned packs |
| AC2 | Drift Detection | Creates alert when compliant→non-compliant |
| AC3 | Alert Details | Alert includes machine name, pack, mismatch count, diff link |
| AC4 | Alert Severity | Drift alerts have `warning` severity |
| AC5 | Slack Notification | Sends Slack notification with drift details |
| AC6 | Auto-Resolve | Alert resolves when machine returns to compliance |
| AC7 | Disable per Machine | Machines with `drift_detection_enabled=false` are skipped |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.12+
- **Framework:** FastAPI with APScheduler
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices
- Use async/await throughout for database and SSH operations
- Follow existing scheduler patterns in `scheduler.py`
- Use AlertingService for alert lifecycle management
- Use get_notifier() pattern for Slack notifications

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| APScheduler | /agronholm/apscheduler | CronTrigger for daily scheduling |
| FastAPI | /tiangolo/fastapi | Lifespan context for scheduler |

### Existing Patterns
- `check_stale_servers()` in `scheduler.py` - reference for scheduled job structure
- `AlertingService._create_alert_record()` - creating persistent alerts
- `AlertingService._resolve_alert_record()` - auto-resolving alerts
- `ComplianceCheckService.check_compliance()` - compliance checking (from US0117)

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Scheduler integration story coordinating existing patterns (scheduler, alerting, compliance). Unit tests can mock the service dependencies after implementation.

### Test Priority
1. Unit tests for drift detection logic (mock compliance service)
2. Unit tests for alert creation/resolution (mock alerting service)
3. Integration test for scheduler registration

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add `drift_detection_enabled` field to Server model | `db/models/server.py` | - | [ ] |
| 2 | Create Alembic migration for new field | `migrations/versions/` | 1 | [ ] |
| 3 | Add `check_config_drift()` scheduler function | `services/scheduler.py` | - | [ ] |
| 4 | Add drift alert creation logic | `services/scheduler.py` | 3 | [ ] |
| 5 | Add drift alert auto-resolve logic | `services/scheduler.py` | 4 | [ ] |
| 6 | Add Slack notification for drift events | `services/scheduler.py` | 4, 5 | [ ] |
| 7 | Register scheduler job in main.py lifespan | `main.py` | 3 | [ ] |
| 8 | Write unit tests for drift detection | `tests/test_drift_detection.py` | 3-6 | [ ] |
| 9 | Write integration tests | `tests/test_drift_scheduler.py` | 7 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 3 | None (can start in parallel) |
| B | 2, 4-6 | Task 1, 3 complete |
| C | 7-9 | All above complete |

---

## Implementation Phases

### Phase 1: Database Schema
**Goal:** Add drift_detection_enabled field to Server model

- [ ] Add `drift_detection_enabled` column to Server model (default=True)
- [ ] Create Alembic migration

**Files:** `backend/src/homelab_cmd/db/models/server.py`, `migrations/versions/`

### Phase 2: Scheduler Function
**Goal:** Implement drift detection scheduled job

- [ ] Create `check_config_drift()` async function
- [ ] Query servers with assigned packs and drift_detection_enabled=True
- [ ] Call compliance_service.check_compliance() for each
- [ ] Track previous compliance state to detect drift

**Files:** `backend/src/homelab_cmd/services/scheduler.py`

### Phase 3: Alert Management
**Goal:** Create and resolve drift alerts

- [ ] Create `config_drift` alerts when drift detected
- [ ] Set alert severity to `warning`
- [ ] Include metadata (pack_name, mismatch_count, diff_url)
- [ ] Auto-resolve alerts when compliance restored
- [ ] Send Slack notifications for both events

**Files:** `backend/src/homelab_cmd/services/scheduler.py`

### Phase 4: Scheduler Registration
**Goal:** Register job in application lifespan

- [ ] Add CronTrigger(hour=6, minute=0) job in main.py
- [ ] Use unique ID "check_config_drift"

**Files:** `backend/src/homelab_cmd/main.py`

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test scheduler job runs | `tests/test_drift_scheduler.py` | Pending |
| AC2 | Unit test drift detection logic | `tests/test_drift_detection.py` | Pending |
| AC3 | Unit test alert metadata | `tests/test_drift_detection.py` | Pending |
| AC4 | Assert alert severity is warning | `tests/test_drift_detection.py` | Pending |
| AC5 | Mock notifier, verify send_alert called | `tests/test_drift_detection.py` | Pending |
| AC6 | Test auto-resolve when compliant | `tests/test_drift_detection.py` | Pending |
| AC7 | Test disabled machines skipped | `tests/test_drift_detection.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Machine offline during check | Skip machine, log warning, continue to next | Phase 2 |
| 2 | SSH timeout | Catch SSHUnavailableError, skip machine, log error | Phase 2 |
| 3 | First check ever | Don't create drift alert (no previous state to compare) | Phase 3 |
| 4 | Multiple packs assigned | Check each pack separately, create separate alerts | Phase 3 |
| 5 | Alert already exists | Update existing alert message, don't duplicate | Phase 3 |
| 6 | Scheduler fails | Log error, let APScheduler retry next day | Phase 4 |

**Coverage:** 6/6 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| US0121 not complete | Cannot access assigned_packs field | Wait for US0121 or implement with fallback to default pack |
| Long-running checks | Scheduler blocks | Use asyncio.gather for parallel checks with timeout |
| Database session management | Session errors | Use get_session_factory() pattern with proper context |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration created and tested

---

## Notes

**Dependency:** This story requires US0121 (Pack Assignment per Machine) to be complete for the `assigned_packs` field. Implementation can proceed with the `drift_detection_enabled` field since US0117 (Compliance Checker) is complete and provides the core compliance checking logic.

**Scheduler Time:** The 6am schedule is in UTC. Consider making this configurable in future (out of scope per story).
