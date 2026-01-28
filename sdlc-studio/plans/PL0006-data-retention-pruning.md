# PL0006: Data Retention and Pruning - Implementation Plan

> **Status:** Complete
> **Story:** [US0009: Data Retention and Pruning](../stories/US0009-data-retention-pruning.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

Implement automatic data retention pruning using the APScheduler infrastructure established in US0008. A daily job runs at midnight UTC to delete metrics older than 30 days. Batch deletion ensures large volumes don't block other operations.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Old metrics deleted | Metrics >30 days old permanently deleted |
| AC2 | Daily schedule | Pruning job runs at midnight UTC |
| AC3 | Recent preserved | Metrics within 30 days NOT deleted |
| AC4 | Large volumes | Batch deletion handles >10,000 records without blocking |
| AC5 | Logging | Number of deleted records logged |

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
| APScheduler | /agronholm/apscheduler | CronTrigger cron scheduled job | `CronTrigger(hour=0, minute=0)` for midnight |

**APScheduler CronTrigger Pattern (from Context7):**
```python
from apscheduler.triggers.cron import CronTrigger

# Run at midnight (00:00) daily
scheduler.add_schedule(
    prune_old_metrics,
    CronTrigger(hour=0, minute=0),
    id="prune_old_metrics",
)
```

### Existing Patterns

- **Scheduler integration:** PL0005 establishes APScheduler in `main.py` lifespan
- **Metrics model:** `metrics.py:18-99` - `Metrics` table with `timestamp` field
- **Session factory:** `session.py:54-66` - `get_session_factory()` for background tasks
- **Logging pattern:** Module-level `logger = logging.getLogger(__name__)`
- **Timestamp index:** `metrics.py:63` - `timestamp` is already indexed for efficient deletion

### Dependency on US0008

US0008 introduces the scheduler infrastructure. This story adds a second scheduled job to the same scheduler. The pruning function will be added to `services/scheduler.py` alongside `check_stale_servers()`.

## Recommended Approach

**Strategy:** Test-After
**Rationale:** The pruning logic is straightforward SQL DELETE with WHERE clause. The skeleton tests in `test_status_detection.py::TestDataPruning` provide the test structure. Core logic can be tested by calling the function directly.

### Test Priority

1. Old metrics deleted (>30 days)
2. Recent metrics preserved (<30 days)
3. Boundary case (exactly 30 days preserved)
4. Correct count returned and logged
5. Batch deletion for large volumes

### Documentation Updates Required

- [ ] None - no new API endpoints

## Implementation Steps

### Phase 1: Add Pruning Function to Scheduler Service

**Goal:** Create the core pruning logic as a testable function

#### Step 1.1: Add prune_old_metrics function

- [ ] Add `RETENTION_DAYS = 30` constant
- [ ] Add `PRUNE_BATCH_SIZE = 10000` constant
- [ ] Implement `prune_old_metrics()` async function with batch deletion

**Files to modify:**
- `backend/src/homelab_cmd/services/scheduler.py` - add pruning function

**Implementation details:**
```python
from sqlalchemy import delete, func, select

from homelab_cmd.db.models.metrics import Metrics

RETENTION_DAYS = 30
PRUNE_BATCH_SIZE = 10000


async def prune_old_metrics() -> int:
    """Delete metrics older than retention period.

    Uses batch deletion to avoid long-running transactions.

    Returns:
        Total number of metrics deleted.
    """
    retention_cutoff = datetime.now(UTC) - timedelta(days=RETENTION_DAYS)
    total_deleted = 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        while True:
            # Find IDs to delete in this batch
            # SQLite doesn't support DELETE ... LIMIT, so we select IDs first
            result = await session.execute(
                select(Metrics.id)
                .where(Metrics.timestamp < retention_cutoff)
                .limit(PRUNE_BATCH_SIZE)
            )
            ids_to_delete = [row[0] for row in result.fetchall()]

            if not ids_to_delete:
                break

            # Delete the batch
            await session.execute(
                delete(Metrics).where(Metrics.id.in_(ids_to_delete))
            )
            await session.commit()

            batch_count = len(ids_to_delete)
            total_deleted += batch_count
            logger.info("Pruned batch of %d old metrics", batch_count)

            if batch_count < PRUNE_BATCH_SIZE:
                break

    if total_deleted > 0:
        logger.info("Pruning complete: deleted %d metrics older than %d days",
                    total_deleted, RETENTION_DAYS)
    else:
        logger.info("Pruning complete: no old metrics to delete")

    return total_deleted
```

**Considerations:**
- SQLite doesn't support `DELETE ... LIMIT`, so we use a two-step approach: SELECT IDs, then DELETE by ID
- Batch deletion prevents long-running transactions that could block other operations
- Commit after each batch to release locks

### Phase 2: Schedule Pruning Job

**Goal:** Add daily pruning schedule to application startup

#### Step 2.1: Update main.py lifespan to add CronTrigger

- [ ] Import `CronTrigger` from APScheduler
- [ ] Import `prune_old_metrics` function
- [ ] Add schedule with midnight UTC trigger

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - add pruning schedule

**Implementation details:**
```python
from apscheduler.triggers.cron import CronTrigger

from homelab_cmd.services.scheduler import (
    STALE_CHECK_INTERVAL_SECONDS,
    check_stale_servers,
    prune_old_metrics,
)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ... existing startup code ...

    async with AsyncScheduler() as scheduler:
        # Stale server detection (every 60 seconds)
        await scheduler.add_schedule(
            check_stale_servers,
            IntervalTrigger(seconds=STALE_CHECK_INTERVAL_SECONDS),
            id="check_stale_servers",
        )

        # Data pruning (daily at midnight UTC)
        await scheduler.add_schedule(
            prune_old_metrics,
            CronTrigger(hour=0, minute=0),
            id="prune_old_metrics",
        )

        await scheduler.start_in_background()
        logger.info("Background scheduler started with 2 jobs")

        yield

    # ... existing shutdown code ...
```

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 3.1: Unit Tests for Pruning Logic

- [ ] Enable and update `test_status_detection.py::TestDataPruning`
- [ ] Test old metrics (>30 days) are deleted
- [ ] Test recent metrics (<30 days) are preserved
- [ ] Test boundary case (exactly 30 days preserved)
- [ ] Test correct count is returned

**Files to modify:**
- `tests/test_status_detection.py` - enable and implement tests

**Test implementation pattern:**
```python
from datetime import UTC, datetime, timedelta

from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.server import Server
from homelab_cmd.services.scheduler import prune_old_metrics


class TestDataPruning:
    """TC020: Data pruning removes old metrics."""

    async def test_old_metrics_deleted(self, db_session) -> None:
        """Metrics older than retention period should be deleted."""
        # Arrange: Create server and old metric
        server = Server(id="test-server", hostname="test.local", status="online")
        db_session.add(server)

        old_date = datetime.now(UTC) - timedelta(days=35)
        old_metric = Metrics(server_id="test-server", timestamp=old_date, cpu_percent=50.0)
        db_session.add(old_metric)
        await db_session.commit()

        # Act: Run pruning (need to mock session factory)
        deleted = await prune_old_metrics()

        # Assert
        assert deleted == 1
        result = await db_session.execute(select(Metrics))
        assert len(result.scalars().all()) == 0

    async def test_recent_metrics_preserved(self, db_session) -> None:
        """Metrics within retention period should be preserved."""
        # Create recent metric (1 day old)
        recent_date = datetime.now(UTC) - timedelta(days=1)
        # ... similar pattern
```

#### Step 3.2: Test Batch Deletion

- [ ] Create >10,000 old metrics
- [ ] Verify all are deleted
- [ ] Verify correct total count returned

#### Step 3.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test: old metrics deleted | Pending |
| AC2 | Integration: CronTrigger configured for midnight | Pending |
| AC3 | Unit test: recent metrics preserved | Pending |
| AC4 | Unit test: batch deletion with large volume | Pending |
| AC5 | Unit test: correct count logged | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| No old metrics exist | Job runs, deletes 0, logs "no old metrics" |
| Very large backlog | Batch processing handles gracefully |
| Job fails mid-execution | Partial cleanup OK; retries next day |
| Hub not running at midnight | APScheduler runs job on next startup |
| Database locked during batch | Each batch is a separate transaction |
| Boundary: exactly 30 days | Preserve (use < not <=) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Long-running deletion blocks DB | Performance degradation | Batch deletion with commits |
| Timezone confusion | Wrong data deleted | Use UTC throughout |
| First-time backlog too large | Memory issues | Batch limits rows per query |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001: Database Schema | Story | Done - Metrics model exists |
| US0008: Server Status Detection | Story | Draft - Introduces scheduler infrastructure |
| APScheduler 4.x | Library | Added in PL0005 |

## Open Questions

None - all requirements are clear from the story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing
- [x] Edge cases handled (empty table, boundary case)
- [x] Batch deletion tested with large volumes
- [x] Code follows best practices (logging, type hints, UTC datetime)
- [x] No linting errors (`ruff check`)
- [x] Pruning job scheduled at midnight UTC
- [x] Correct deletion count logged
- [x] Ready for code review

## Notes

- This story depends on US0008 for the scheduler infrastructure
- The skeleton tests in `test_status_detection.py::TestDataPruning` provide TDD scaffolding
- SQLite doesn't support `DELETE ... LIMIT`, requiring the two-step ID selection approach
- Consider running VACUUM periodically (manual task, out of scope for MVP)
- Expected daily deletion: ~15,840 rows (11 servers x 60 heartbeats/hour x 24 hours)
