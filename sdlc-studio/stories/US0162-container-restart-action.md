# US0162: Container Restart Action

> **Status:** Done
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-02-01
> **Story Points:** 2
> **Priority:** P1

---

## User Story

**As a** homelab operator (Darren)
**I want** to restart a container from the dashboard
**So that** I can quickly recover from issues

## Context

### Background
Part of EP0014 container actions. Restart is available for all containers regardless of state. Uses `docker restart` which combines stop + start in a single operation.

---

## Acceptance Criteria

### AC1: API Endpoint
- [x] `POST /api/v1/servers/{id}/containers/{container_id}/restart`

### AC2: SSH Execution
- [x] Executes `docker restart {container_name}` via SSH

### AC3: Response
- [x] Returns success/failure with docker output

### AC4: UI Refresh
- [x] Container list refreshed after action

### AC5: Audit Trail
- [x] Audit log entry created

---

## Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0160 | Prerequisite | Container start action | Done |
| US0161 | Prerequisite | Container stop action | Done |

---

## Implementation

See [WF0211: Container Restart Action Workflow](../workflows/WF0211-container-restart-action.md) for implementation details.

### Artifacts

| Type | Path |
|------|------|
| Service | backend/src/homelab_cmd/services/container_service.py |
| Route | backend/src/homelab_cmd/api/routes/containers.py |
| API Client | frontend/src/api/containers.ts |
| Widget | frontend/src/components/widgets/ContainersWidget.tsx |
| Tests | tests/test_container_actions.py (8 additional tests, 28 total) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Implemented as part of EP0014 batch |
| 2026-02-18 | Claude | Retroactive story file created from epic specification |
