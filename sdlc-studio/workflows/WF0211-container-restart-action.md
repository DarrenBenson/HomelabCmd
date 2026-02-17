# WF0211: Container Restart Action Workflow

> **Status:** Done
> **Story:** US0162: Container Restart Action
> **Plan:** PL0210: Container Restart Action
> **Created:** 2026-02-01
> **Approach:** Test-After

---

## Phase Progress

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Plan | Done | 2026-02-01 | 2026-02-01 |
| 2 | Test Spec | Skipped | - | - |
| 3 | Implement | Done | 2026-02-01 | 2026-02-01 |
| 4 | Tests | Done | 2026-02-01 | 2026-02-01 |
| 5 | Test | Done | 2026-02-01 | 2026-02-01 |
| 6 | Verify | Done | 2026-02-01 | 2026-02-01 |
| 7 | Check | Done | 2026-02-01 | 2026-02-01 |
| 8 | Review | Done | 2026-02-01 | 2026-02-01 |

**Current Phase:** Complete

---

## Session Log

| Date | Phase | Notes |
|------|-------|-------|
| 2026-02-01 | 1 | Created workflow file |
| 2026-02-01 | 3 | Implemented backend restart_container method and API endpoint |
| 2026-02-01 | 3 | Implemented frontend restartContainer API function |
| 2026-02-01 | 3 | Added restart button (RotateCw icon) to ContainersWidget |
| 2026-02-01 | 4 | Added 8 tests for restart functionality |
| 2026-02-01 | 5 | All 28 container action tests passing |
| 2026-02-01 | 6 | All acceptance criteria verified |
| 2026-02-01 | 7 | Lint checks passing |
| 2026-02-01 | 8 | Frontend and backend tests passing

---

## Implementation Plan

### Backend Tasks

1. Add `restart_container` method to `ContainerService`
2. Add `POST /servers/{id}/containers/{container_id}/restart` endpoint
3. Add audit logging for container restart action

### Frontend Tasks

1. Add `restartContainer` API function
2. Update `ContainerRow` to show restart button for all containers
3. Add loading state and disable button during action
4. Show toast notification for success/failure
5. Trigger container list refresh after action

---

## Acceptance Criteria Checklist

| AC | Description | Status |
|----|-------------|--------|
| 1 | API endpoint: POST /api/v1/servers/{id}/containers/{container_id}/restart | ✅ Done |
| 2 | Executes `docker restart {container_name}` via SSH | ✅ Done |
| 3 | Returns success/failure with docker output | ✅ Done |
| 4 | Container list refreshed after action | ✅ Done |
| 5 | Audit log entry created | ✅ Done |

---

## Artifacts

| Type | Path | Status |
|------|------|--------|
| Workflow | sdlc-studio/workflows/WF0211-container-restart-action.md | Done |
| Service | backend/src/homelab_cmd/services/container_service.py | Done |
| Route | backend/src/homelab_cmd/api/routes/containers.py | Done |
| API Client | frontend/src/api/containers.ts | Done |
| Widget | frontend/src/components/widgets/ContainersWidget.tsx | Done |
| Tests | tests/test_container_actions.py | Done (28 tests)
