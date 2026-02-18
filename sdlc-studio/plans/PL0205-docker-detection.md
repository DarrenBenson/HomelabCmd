# PL0205: Docker Detection - Implementation Plan

> **Status:** Done
> **Story:** [US0157: Docker Detection](../stories/US0157-docker-detection.md)
> **Epic:** [EP0014: Docker Container Monitoring](../epics/EP0014-docker-container-monitoring.md)
> **Created:** 2026-02-01
> **Language:** Python (Backend/Agent), TypeScript (Frontend)

## Overview

Implement Docker installation detection in the HomelabCmd agent, store the detection result in the server model, and display a Docker badge on the dashboard for Docker-enabled servers. This is the foundation story for EP0014 - all subsequent container monitoring features depend on this detection.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Heartbeat Docker Status | Agent heartbeat includes `docker_installed: boolean` |
| AC2 | Docker Detection via CLI | Detect via `docker --version` with 5s timeout |
| AC3 | Server Model Storage | `has_docker` field persists across heartbeats |
| AC4 | API Returns Docker Status | `GET /api/v1/servers/{id}` includes `has_docker` |
| AC5 | Dashboard Docker Badge | Server cards show Docker icon when `has_docker: true` |
| AC6 | Both Docker Variants | Detect docker.io and Docker CE installations |
| AC7 | Timeout Handling | Command timeout doesn't hang agent |

---

## Technical Context

### Language & Framework
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0
- **Agent:** Python 3.11+, subprocess
- **Frontend:** TypeScript, React 18, Tailwind CSS
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices
- Use `subprocess.run()` with explicit `timeout` parameter
- Catch specific exceptions (`FileNotFoundError`, `subprocess.TimeoutExpired`)
- Use Pydantic Field with description for schema documentation
- SQLAlchemy `mapped_column` with `Boolean` type for model fields

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Pydantic schema Field definitions |
| SQLAlchemy | /sqlalchemy/sqlalchemy | mapped_column with Boolean type |
| Alembic | /sqlalchemy/alembic | batch_alter_table for SQLite |

### Existing Patterns

**Agent Detection (collectors.py:459-485):**
```python
def is_running_in_container() -> bool:
    """Detect if agent is running inside a container."""
    if Path("/.dockerenv").exists():
        return True
    # ... additional checks
```

**Heartbeat Schema (heartbeat.py:369-445):**
```python
update_available: bool = Field(
    False,
    description="True if agent detected a newer version is available",
)
```

**Server Model (server.py:35-89):**
```python
is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
auto_update_agent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Straightforward feature with clear implementation path across agent, backend, and frontend. The pattern is well-established in the codebase. Write code first, then comprehensive tests.

### Test Priority
1. Agent detection function (unit test with mocked subprocess)
2. Heartbeat processing (integration test)
3. API response includes `has_docker` (API test)
4. Frontend badge rendering (component test)

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add `detect_docker()` function | `agent/collectors.py` | - | [ ] |
| 2 | Add `docker_installed` to heartbeat payload | `agent/heartbeat.py` | 1 | [ ] |
| 3 | Add `docker_installed` field to HeartbeatRequest schema | `backend/.../schemas/heartbeat.py` | - | [ ] |
| 4 | Add `has_docker` field to Server model | `backend/.../db/models/server.py` | - | [ ] |
| 5 | Create Alembic migration | `migrations/versions/` | 4 | [ ] |
| 6 | Update heartbeat processing to store `has_docker` | `backend/.../api/routes/agents.py` | 3, 4 | [ ] |
| 7 | Add `has_docker` to ServerResponse schema | `backend/.../schemas/server.py` | 4 | [ ] |
| 8 | Add `has_docker` to frontend Server type | `frontend/src/types/server.ts` | - | [ ] |
| 9 | Add Docker badge to ServerCard | `frontend/src/components/ServerCard.tsx` | 8 | [ ] |
| 10 | Write backend tests | `tests/test_docker_detection.py` | 3-7 | [ ] |
| 11 | Write frontend tests | `frontend/src/components/ServerCard.test.tsx` | 9 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Agent | 1, 2 | None |
| Backend Schema | 3, 4, 7 | None |
| Backend Logic | 5, 6 | 3, 4 |
| Frontend | 8, 9 | None |
| Tests | 10, 11 | All implementation |

---

## Implementation Phases

### Phase 1: Agent Detection
**Goal:** Add Docker detection to agent heartbeat

- [ ] Create `detect_docker()` function in `agent/collectors.py`
- [ ] Add `docker_installed` to heartbeat payload in `agent/heartbeat.py`
- [ ] Handle timeout and missing Docker gracefully

**Files:**
- `agent/collectors.py` - Add detection function after `is_running_in_container()`
- `agent/heartbeat.py` - Add field to heartbeat dict

**Code:**
```python
# agent/collectors.py
def detect_docker() -> bool:
    """Detect if Docker is installed and accessible.

    Checks if `docker --version` succeeds within 5 seconds.
    Works with both docker.io and Docker CE.
    """
    try:
        result = subprocess.run(
            ['docker', '--version'],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
```

### Phase 2: Backend Schema & Model
**Goal:** Add storage and API support for Docker status

- [ ] Add `docker_installed` field to HeartbeatRequest schema
- [ ] Add `has_docker` column to Server model
- [ ] Create Alembic migration for new column
- [ ] Update heartbeat processing to store value
- [ ] Add `has_docker` to ServerResponse schema

**Files:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add field to HeartbeatRequest
- `backend/src/homelab_cmd/db/models/server.py` - Add column
- `migrations/versions/p5q6r7s8t9u0_add_has_docker_to_server.py` - New migration
- `backend/src/homelab_cmd/api/routes/agents.py` - Update receive_heartbeat()
- `backend/src/homelab_cmd/api/schemas/server.py` - Add to response

**Migration:**
```python
def upgrade() -> None:
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('has_docker', sa.Boolean(), nullable=True)
        )

def downgrade() -> None:
    with op.batch_alter_table('servers', schema=None) as batch_op:
        batch_op.drop_column('has_docker')
```

### Phase 3: Frontend Display
**Goal:** Show Docker badge on server cards

- [ ] Add `has_docker` to Server type definition
- [ ] Add Docker badge with Container icon to ServerCard
- [ ] Style badge consistently with existing badges

**Files:**
- `frontend/src/types/server.ts` - Add field to interfaces
- `frontend/src/components/ServerCard.tsx` - Add badge

**Component:**
```tsx
// Import Container icon from lucide-react
import { Container } from 'lucide-react';

// In badge section (after TailscaleBadge)
{server.has_docker && (
  <span
    className="inline-flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400"
    title="Docker installed"
    data-testid="docker-badge"
  >
    <Container className="w-3.5 h-3.5" aria-hidden="true" />
  </span>
)}
```

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test agent detection | `tests/test_docker_detection.py` | Pending |
| AC2 | Unit test with mock subprocess | `tests/test_docker_detection.py` | Pending |
| AC3 | Integration test heartbeat flow | `tests/test_docker_detection.py` | Pending |
| AC4 | API test server response | `tests/test_docker_detection.py` | Pending |
| AC5 | Component test badge rendering | `ServerCard.test.tsx` | Pending |
| AC6 | Manual test on docker.io system | Manual verification | Pending |
| AC7 | Unit test timeout handling | `tests/test_docker_detection.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Docker not installed | Return `False`, no error logged | Phase 1 |
| 2 | Docker daemon not running | `docker --version` still succeeds, return `True` | Phase 1 |
| 3 | Command times out (>5s) | Catch `TimeoutExpired`, return `False` | Phase 1 |
| 4 | Docker binary not executable | Catch `FileNotFoundError`, return `False` | Phase 1 |
| 5 | Rootless Docker only | Works if user can run `docker --version` | Phase 1 |
| 6 | Docker installed after agent start | Detected on next heartbeat cycle | Phase 1 |
| 7 | Docker removed after detection | Updated to `False` on next heartbeat | Phase 2 |
| 8 | Agent running in Docker container | Detection still works for host Docker | Phase 1 |
| 9 | Permission denied for docker command | Catch exception, return `False` | Phase 1 |
| 10 | Podman installed (docker alias) | May return `True` - acceptable | Phase 1 |

**Coverage:** 10/10 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker command hangs indefinitely | Agent becomes unresponsive | Use 5-second timeout |
| Podman detected as Docker | May show features that don't work | Document in AC6 as acceptable |
| Migration fails on existing DB | Service downtime | Test migration on copy first |
| Badge clutters server card | UI becomes busy | Use small, unobtrusive icon |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration tested successfully
- [ ] Manual verification on Docker and non-Docker systems

---

## Notes

This is the foundation story for EP0014. Once Docker detection is in place, subsequent stories (US0158-US0163) can build container listing, widgets, and management actions.

The `detect_docker()` function deliberately only checks if Docker CLI is available, not if the daemon is running. This is intentional - container listing (US0158) will handle daemon availability separately.
