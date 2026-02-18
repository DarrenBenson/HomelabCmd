# US0160: Container Start Action

> **Status:** Done
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-02-01
> **Story Points:** 3
> **Priority:** P0

---

## User Story

**As a** homelab operator (Darren)
**I want** to start a stopped container from the dashboard
**So that** I can bring services back online

## Context

### Background
Part of EP0014 container actions. Uses the SSH executor infrastructure to run `docker start` on the target machine. Includes audit logging for all container actions.

---

## Acceptance Criteria

### AC1: API Endpoint
- [x] `POST /api/v1/servers/{id}/containers/{container_id}/start`

### AC2: SSH Execution
- [x] Executes `docker start {container_name}` via SSH

### AC3: Response
- [x] Returns success/failure with docker output

### AC4: UI Refresh
- [x] Container list refreshed after action

### AC5: Loading State
- [x] Button disabled while action in progress

### AC6: Notification
- [x] Toast notification on success/failure

### AC7: Audit Trail
- [x] Audit log entry created

---

## Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0158 | Prerequisite | Container listing API | Done |

---

## Implementation

See [WF0209: Container Start Action Workflow](../workflows/WF0209-container-start-action.md) for implementation details.

### Artifacts

| Type | Path |
|------|------|
| Schema | backend/src/homelab_cmd/api/schemas/containers.py |
| Service | backend/src/homelab_cmd/services/container_service.py |
| Route | backend/src/homelab_cmd/api/routes/containers.py |
| API Client | frontend/src/api/containers.ts |
| Widget | frontend/src/components/widgets/ContainersWidget.tsx |
| Backend Tests | tests/test_container_actions.py (9 tests) |
| Frontend Tests | frontend/src/components/widgets/ContainersWidget.test.tsx (6 new tests) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Implemented as part of EP0014 batch |
| 2026-02-18 | Claude | Retroactive story file created from epic specification |
