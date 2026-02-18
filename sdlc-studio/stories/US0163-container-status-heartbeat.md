# US0163: Container Service Status in Heartbeat

> **Status:** Done
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-02-01
> **Story Points:** 3
> **Priority:** P1

---

## User Story

**As a** homelab operator (Darren)
**I want** the agent to report basic Docker status in its heartbeat
**So that** I can see container counts on the dashboard without SSH

## Context

### Background
Complements the SSH-based container listing (US0158) with lightweight summary data sent via the agent heartbeat. This avoids SSH overhead for the dashboard card view while still showing running/total container counts.

---

## Acceptance Criteria

### AC1: Heartbeat Payload
- [x] Heartbeat includes `docker_status` object

### AC2: Status Fields
- [x] Reports: running_containers, stopped_containers, total_containers

### AC3: Conditional Collection
- [x] Only included if Docker installed

### AC4: Low Overhead
- [x] Single `docker ps` command for efficiency

### AC5: Server Model Storage
- [x] Server model stores latest docker status

### AC6: Dashboard Badge
- [x] Dashboard card shows container count badge (e.g. "8/10")

---

## Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0157 | Prerequisite | Docker detection | Done |

---

## Implementation

See [WF0212: Container Service Status in Heartbeat Workflow](../workflows/WF0212-container-status-heartbeat.md) for implementation details.

### Artifacts

| Type | Path |
|------|------|
| Agent | agent/collectors.py |
| Agent | agent/heartbeat.py |
| Schema | backend/src/homelab_cmd/api/schemas/heartbeat.py |
| Schema | backend/src/homelab_cmd/api/schemas/server.py |
| Model | backend/src/homelab_cmd/db/models/server.py |
| Route | backend/src/homelab_cmd/api/routes/agents.py |
| Migration | migrations/versions/q6r7s8t9u0v1_add_docker_status_to_server.py |
| Type | frontend/src/types/server.ts |
| Component | frontend/src/components/ServerCard.tsx |
| Backend Tests | tests/test_heartbeat_docker_status.py (8 tests) |
| Frontend Tests | frontend/src/components/ServerCard.test.tsx (4 new tests) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | Claude | Implemented as part of EP0014 batch |
| 2026-02-18 | Claude | Retroactive story file created from epic specification |
