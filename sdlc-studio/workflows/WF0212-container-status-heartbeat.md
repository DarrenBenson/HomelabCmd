# WF0212: Container Service Status in Heartbeat Workflow

> **Status:** Done
> **Story:** US0163: Container Service Status in Heartbeat
> **Plan:** PL0211: Container Service Status in Heartbeat
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
| 2026-02-01 | 3 | Implemented `get_docker_status()` in agent/collectors.py |
| 2026-02-01 | 3 | Added docker_status parameter to agent/heartbeat.py |
| 2026-02-01 | 3 | Added DockerStatus schema to backend heartbeat schemas |
| 2026-02-01 | 3 | Added docker_status JSON field to Server model |
| 2026-02-01 | 3 | Updated heartbeat route to store docker_status |
| 2026-02-01 | 3 | Added DockerStatusResponse to server API schema |
| 2026-02-01 | 3 | Added DockerStatus type to frontend server.ts |
| 2026-02-01 | 3 | Updated ServerCard to show container count badge |
| 2026-02-01 | 3 | Created database migration for docker_status column |
| 2026-02-01 | 4 | Added 8 backend tests for docker_status in heartbeat |
| 2026-02-01 | 4 | Added 4 frontend tests for container count badge |
| 2026-02-01 | 5 | All 8 backend tests passing |
| 2026-02-01 | 5 | All 106 ServerCard tests passing |
| 2026-02-01 | 6 | All acceptance criteria verified |
| 2026-02-01 | 7 | Lint checks passing |
| 2026-02-01 | 8 | Implementation complete

---

## Implementation Plan

### Agent Tasks

1. Add `get_docker_status()` function to agent collectors
2. Include `docker_status` in heartbeat payload
3. Only collect if Docker is installed (AC3)
4. Use single `docker ps -a` command for efficiency (AC4)

### Backend Tasks

1. Update heartbeat schema to accept `docker_status` object
2. Add `docker_status` JSON field to Server model
3. Store docker status on heartbeat receipt
4. Include docker status in server API response

### Frontend Tasks

1. Add Docker container badge to ServerCard
2. Show running/total format (e.g., "8/10")
3. Only display if has_docker is true

---

## Acceptance Criteria Checklist

| AC | Description | Status |
|----|-------------|--------|
| 1 | Heartbeat includes `docker_status` object | ✅ Done |
| 2 | Reports: running_containers, stopped_containers, total_containers | ✅ Done |
| 3 | Only included if Docker installed | ✅ Done |
| 4 | Low overhead (single `docker ps` command) | ✅ Done |
| 5 | Machine model stores latest docker status | ✅ Done |
| 6 | Dashboard card shows container count badge | ✅ Done |

---

## Artifacts

| Type | Path | Status |
|------|------|--------|
| Workflow | sdlc-studio/workflows/WF0212-container-status-heartbeat.md | Done |
| Agent | agent/collectors.py | Done |
| Agent | agent/heartbeat.py | Done |
| Agent | agent/__main__.py | Done |
| Schema | backend/src/homelab_cmd/api/schemas/heartbeat.py | Done |
| Schema | backend/src/homelab_cmd/api/schemas/server.py | Done |
| Model | backend/src/homelab_cmd/db/models/server.py | Done |
| Route | backend/src/homelab_cmd/api/routes/agents.py | Done |
| Migration | migrations/versions/q6r7s8t9u0v1_add_docker_status_to_server.py | Done |
| Type | frontend/src/types/server.ts | Done |
| Component | frontend/src/components/ServerCard.tsx | Done |
| Tests | tests/test_heartbeat_docker_status.py | Done (8 tests) |
| Tests | frontend/src/components/ServerCard.test.tsx | Done (4 new tests)
