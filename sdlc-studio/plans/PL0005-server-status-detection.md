# PL0005: Server Status Detection - Implementation Plan

> **Status:** Complete
> **Story:** [US0008: Server Status Detection](../stories/US0008-server-status-detection.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

Implement automatic server status detection using APScheduler. Servers will be marked offline after 180 seconds (3 missed heartbeats) of no communication. A background job runs every 60 seconds to check for stale servers.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Offline marking | Server marked offline after 180+ seconds without heartbeat |
| AC2 | Periodic check | Background job runs every 60 seconds |
| AC3 | Recovery | Server returns to online when heartbeat received |
| AC4 | New servers | Auto-registered servers start as online (handled in US0003) |
| AC5 | Dashboard status | Status changes reflected in API responses (no code needed) |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with async/await
- **Test Framework:** pytest + pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use timezone-aware datetime with `datetime.now(UTC)`
- Use `logging` module, not print statements
- Specific exception handling
- Type hints on all functions

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| APScheduler | /agronholm/apscheduler | async scheduler FastAPI lifespan | AsyncScheduler, IntervalTrigger, start_in_background |

**APScheduler Key Pattern (from Context7):**
```python
from apscheduler import AsyncScheduler
from apscheduler.triggers.interval import IntervalTrigger

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncScheduler() as scheduler:
        await scheduler.add_schedule(task, IntervalTrigger(seconds=60), id="job_id")
        await scheduler.start_in_background()
        yield
```

### Existing Patterns

- **Lifespan context manager:** `main.py:26-44` - existing async lifespan pattern
- **Database session:** `session.py:69-84` - `get_async_session()` for dependency injection
- **Server model:** `server.py:19-25` - `ServerStatus` enum with ONLINE/OFFLINE/UNKNOWN
- **Heartbeat sets online:** `agents.py:48-50` - already sets status to ONLINE on heartbeat (AC3 satisfied)
- **Logging pattern:** Module-level `logger = logging.getLogger(__name__)`

## Recommended Approach

**Strategy:** Test-After
**Rationale:** The scheduler integration is straightforward and the story already has skeleton tests in `test_status_detection.py`. The core logic (querying stale servers, updating status) can be tested independently from the scheduler mechanism.

### Test Priority

1. Stale server detection logic (server marked offline after threshold)
2. Recent server stays online (boundary conditions)
3. Status recovery on heartbeat (already covered by existing tests)
4. Scheduler lifecycle (integration test)

### Documentation Updates Required

- [ ] None - no new API endpoints

## Implementation Steps

### Phase 1: Add APScheduler Dependency

**Goal:** Add APScheduler to project dependencies

#### Step 1.1: Update pyproject.toml

- [ ] Add `apscheduler>=4.0.0` to dependencies

**Files to modify:**
- `pyproject.toml` - add APScheduler dependency

**Considerations:**
APScheduler 4.x uses the new `AsyncScheduler` API (different from 3.x `AsyncIOScheduler`). Context7 documentation confirms the pattern.

### Phase 2: Implement Stale Server Detection Service

**Goal:** Create the core detection logic as a testable service

#### Step 2.1: Create scheduler service module

- [ ] Create `backend/src/homelab_cmd/services/` directory
- [ ] Create `backend/src/homelab_cmd/services/__init__.py`
- [ ] Create `backend/src/homelab_cmd/services/scheduler.py` with:
  - `check_stale_servers()` async function
  - `OFFLINE_THRESHOLD_SECONDS = 180` constant
  - `STALE_CHECK_INTERVAL_SECONDS = 60` constant

**Files to create:**
- `backend/src/homelab_cmd/services/__init__.py` - package init
- `backend/src/homelab_cmd/services/scheduler.py` - scheduler service

**Implementation details:**
```python
"""Background scheduler for server status detection."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.session import get_session_factory

logger = logging.getLogger(__name__)

OFFLINE_THRESHOLD_SECONDS = 180
STALE_CHECK_INTERVAL_SECONDS = 60


async def check_stale_servers() -> int:
    """Check for and mark stale servers as offline.

    Returns:
        Number of servers marked offline.
    """
    stale_threshold = datetime.now(UTC) - timedelta(seconds=OFFLINE_THRESHOLD_SECONDS)

    session_factory = get_session_factory()
    async with session_factory() as session:
        # Find online servers with last_seen older than threshold
        result = await session.execute(
            select(Server)
            .where(Server.status == ServerStatus.ONLINE.value)
            .where(Server.last_seen < stale_threshold)
        )
        stale_servers = result.scalars().all()

        count = 0
        for server in stale_servers:
            server.status = ServerStatus.OFFLINE.value
            logger.info(
                "Server %s marked offline (last seen: %s)",
                server.id,
                server.last_seen,
            )
            count += 1

        await session.commit()

    if count > 0:
        logger.info("Marked %d server(s) as offline", count)

    return count
```

### Phase 3: Integrate Scheduler with Application Lifespan

**Goal:** Start/stop scheduler with application lifecycle

#### Step 3.1: Update main.py lifespan

- [ ] Import APScheduler components
- [ ] Create scheduler in lifespan context
- [ ] Add stale check schedule with 60-second interval
- [ ] Start scheduler in background
- [ ] Ensure proper shutdown

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - integrate scheduler in lifespan

**Implementation details:**
```python
from apscheduler import AsyncScheduler
from apscheduler.triggers.interval import IntervalTrigger

from homelab_cmd.services.scheduler import (
    STALE_CHECK_INTERVAL_SECONDS,
    check_stale_servers,
)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ... existing startup code ...

    # Start background scheduler
    async with AsyncScheduler() as scheduler:
        await scheduler.add_schedule(
            check_stale_servers,
            IntervalTrigger(seconds=STALE_CHECK_INTERVAL_SECONDS),
            id="check_stale_servers",
        )
        await scheduler.start_in_background()
        logger.info("Background scheduler started")

        yield

        # Scheduler auto-stops when exiting async context
        logger.info("Background scheduler stopped")

    # ... existing shutdown code ...
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Unit Tests for Stale Detection

- [ ] Enable and update `test_status_detection.py::TestOfflineDetection`
- [ ] Test server marked offline after 180s
- [ ] Test status change is logged
- [ ] Test multiple servers can go offline together

**Files to modify:**
- `tests/test_status_detection.py` - enable and implement tests

#### Step 4.2: Unit Tests for Online Server Preservation

- [ ] Enable and update `test_status_detection.py::TestOnlineServerStaysOnline`
- [ ] Test server stays online when last_seen is recent
- [ ] Test boundary case at exactly 180 seconds

#### Step 4.3: Integration Tests

- [ ] Test scheduler starts with application
- [ ] Test scheduler stops on shutdown

#### Step 4.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test: server offline after 180s | Pending |
| AC2 | Integration test: job runs on interval | Pending |
| AC3 | Existing heartbeat tests verify recovery | Pending |
| AC4 | Existing heartbeat tests verify new server = online | Pending |
| AC5 | API response includes status field | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Hub restarts with stale servers | First job run marks them offline; they recover on next heartbeat |
| Network glitch causes brief outage | May mark offline temporarily; recovers quickly on heartbeat |
| Server in maintenance | Marked offline (no maintenance mode in MVP) |
| Many servers offline at once | All detected in same job run |
| Scheduler fails to start | Log error; status detection won't work but app continues |
| last_seen is None | Skip server (new server that hasn't sent heartbeat yet) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| APScheduler API mismatch | Build failure | Use Context7-verified patterns for v4.x |
| Memory leak in scheduler | Performance degradation | Use proper async context manager lifecycle |
| Race condition with heartbeat | Incorrect status | Both update same field; last write wins (acceptable) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001: Database Schema | Story | Done - Server model exists |
| US0003: Heartbeat Endpoint | Story | Done - Sets status to online |
| APScheduler 4.x | Library | Add to pyproject.toml |

## Open Questions

None - all requirements are clear from the story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing
- [x] Edge cases handled (None last_seen, multiple servers)
- [x] Code follows best practices (logging, type hints, UTC datetime)
- [x] No linting errors (`ruff check`)
- [x] Background scheduler properly initialised on startup
- [x] Scheduler properly shut down on container stop
- [x] Logging shows stale check runs and status changes
- [x] Ready for code review

## Notes

- The existing skeleton tests in `test_status_detection.py` provide TDD scaffolding
- AC3 (recovery on heartbeat) is already implemented in `agents.py:48-50`
- AC4 (new servers start online) is already implemented in `agents.py:41`
- AC5 (dashboard reflects changes) requires no code - status is already in API responses
- Consider adding `/api/v1/system/health` scheduler status in future
