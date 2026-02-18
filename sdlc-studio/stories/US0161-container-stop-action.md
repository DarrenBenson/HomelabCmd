# US0161: Container Stop Action

> **Status:** Done
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-02-01
> **Story Points:** 3
> **Priority:** P0

---

## User Story

**As a** homelab operator (Darren)
**I want** to stop a running container from the dashboard
**So that** I can gracefully shut down services

## Context

### Background
Part of EP0014 container actions. Supports a configurable timeout (default 10 seconds) for graceful shutdown. Includes a confirmation dialog before stopping to prevent accidental shutdowns.

---

## Acceptance Criteria

### AC1: API Endpoint
- [x] `POST /api/v1/servers/{id}/containers/{container_id}/stop`

### AC2: SSH Execution
- [x] Executes `docker stop {container_name}` via SSH

### AC3: Graceful Timeout
- [x] Default timeout: 10 seconds (graceful shutdown)

### AC4: Response
- [x] Returns success/failure with docker output

### AC5: UI Refresh
- [x] Container list refreshed after action

### AC6: Confirmation
- [x] Confirmation dialog before stopping

### AC7: Audit Trail
- [x] Audit log entry created

---

## Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0158 | Prerequisite | Container listing API | Done |

---

## Implementation

See [WF0210: Container Stop Action Workflow](../workflows/WF0210-container-stop-action.md) for implementation details.

### Artifacts

| Type | Path |
|------|------|
| Service | backend/src/homelab_cmd/services/container_service.py |
| Route | backend/src/homelab_cmd/api/routes/containers.py |
| API Client | frontend/src/api/containers.ts |
| Widget | frontend/src/components/widgets/ContainersWidget.tsx |
| Tests | tests/test_container_actions.py (11 additional tests) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Implemented as part of EP0014 batch |
| 2026-02-18 | Claude | Retroactive story file created from epic specification |
