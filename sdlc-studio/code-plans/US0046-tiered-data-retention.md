# Code Plan: US0046 Tiered Data Retention and Rollup

> **Story:** [US0046](../stories/US0046-tiered-data-retention.md)
> **Status:** Draft
> **Created:** 2026-01-21

## Overview

Implement tiered data retention with automatic rollup of raw metrics into hourly and daily aggregates. This extends US0009's pruning to support 12-month trend analysis while reducing storage by ~95%.

**Retention Tiers:**
| Tier | Granularity | Retention | Source Table | Target Table |
|------|-------------|-----------|--------------|--------------|
| Raw | 60 seconds | 7 days | `metrics` | - |
| Hourly | 1 hour | 90 days | `metrics` | `metrics_hourly` |
| Daily | 1 day | 12 months | `metrics_hourly` | `metrics_daily` |

---

## Implementation Tasks

### Task 1: Create New Database Models

**File:** `backend/src/homelab_cmd/db/models/metrics.py`

Add two new SQLAlchemy models:

```python
class MetricsHourly(Base):
    """Hourly aggregated metrics (90-day retention)."""

    __tablename__ = "metrics_hourly"

    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("servers.id", ondelete="CASCADE"), index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # Hour start
    cpu_avg: Mapped[float | None] = mapped_column(Float)
    cpu_min: Mapped[float | None] = mapped_column(Float)
    cpu_max: Mapped[float | None] = mapped_column(Float)
    memory_avg: Mapped[float | None] = mapped_column(Float)
    memory_min: Mapped[float | None] = mapped_column(Float)
    memory_max: Mapped[float | None] = mapped_column(Float)
    disk_avg: Mapped[float | None] = mapped_column(Float)
    disk_min: Mapped[float | None] = mapped_column(Float)
    disk_max: Mapped[float | None] = mapped_column(Float)
    sample_count: Mapped[int] = mapped_column(Integer)

    __table_args__ = (Index("idx_metrics_hourly_server_ts", "server_id", "timestamp"),)


class MetricsDaily(Base):
    """Daily aggregated metrics (12-month retention)."""

    __tablename__ = "metrics_daily"
    # Same structure as MetricsHourly
    # timestamp is day start (00:00:00 UTC)
```

**AC Coverage:** AC4 (min/max values)

---

### Task 2: Create Alembic Migration

**File:** `backend/alembic/versions/XXXX_add_tiered_metrics_tables.py`

```python
def upgrade() -> None:
    op.create_table(
        "metrics_hourly",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("server_id", sa.String(36), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cpu_avg", sa.Float(), nullable=True),
        sa.Column("cpu_min", sa.Float(), nullable=True),
        sa.Column("cpu_max", sa.Float(), nullable=True),
        sa.Column("memory_avg", sa.Float(), nullable=True),
        sa.Column("memory_min", sa.Float(), nullable=True),
        sa.Column("memory_max", sa.Float(), nullable=True),
        sa.Column("disk_avg", sa.Float(), nullable=True),
        sa.Column("disk_min", sa.Float(), nullable=True),
        sa.Column("disk_max", sa.Float(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], ["servers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_metrics_hourly_server_ts", "metrics_hourly", ["server_id", "timestamp"])

    op.create_table(
        "metrics_daily",
        # Same columns as metrics_hourly
    )
    op.create_index("idx_metrics_daily_server_ts", "metrics_daily", ["server_id", "timestamp"])


def downgrade() -> None:
    op.drop_table("metrics_daily")
    op.drop_table("metrics_hourly")
```

---

### Task 3: Implement Rollup Functions

**File:** `backend/src/homelab_cmd/services/scheduler.py`

Add new constants:

```python
# Tiered retention periods
RAW_RETENTION_DAYS = 7      # Keep raw data for 7 days
HOURLY_RETENTION_DAYS = 90  # Keep hourly aggregates for 90 days
DAILY_RETENTION_DAYS = 365  # Keep daily aggregates for 12 months
```

Add rollup functions:

```python
async def rollup_raw_to_hourly() -> tuple[int, int]:
    """Roll up raw metrics older than 7 days into hourly aggregates.

    Returns:
        Tuple of (aggregates_created, raw_records_deleted)
    """
    cutoff = datetime.now(UTC) - timedelta(days=RAW_RETENTION_DAYS)
    aggregates_created = 0
    records_deleted = 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        # Group raw metrics by server_id and hour
        # Calculate avg, min, max for CPU, memory, disk
        # Insert into metrics_hourly
        # Delete processed raw records
        # All within transaction for atomicity

    return aggregates_created, records_deleted


async def rollup_hourly_to_daily() -> tuple[int, int]:
    """Roll up hourly metrics older than 90 days into daily aggregates.

    Returns:
        Tuple of (aggregates_created, hourly_records_deleted)
    """
    cutoff = datetime.now(UTC) - timedelta(days=HOURLY_RETENTION_DAYS)
    # Similar logic to rollup_raw_to_hourly

    return aggregates_created, records_deleted


async def prune_old_daily_metrics() -> int:
    """Delete daily metrics older than 12 months.

    Returns:
        Number of records deleted
    """
    cutoff = datetime.now(UTC) - timedelta(days=DAILY_RETENTION_DAYS)
    # Batch delete logic (reuse pattern from prune_old_metrics)

    return records_deleted
```

**AC Coverage:** AC1, AC2, AC3, AC4

---

### Task 4: Create Orchestrating Rollup Job

**File:** `backend/src/homelab_cmd/services/scheduler.py`

```python
async def run_metrics_rollup() -> dict[str, int]:
    """Run all rollup operations in sequence.

    Runs after the midnight prune job at 01:00 UTC.

    Returns:
        Dictionary with counts for each operation
    """
    logger.info("Starting metrics rollup job")
    start_time = time.monotonic()

    results = {}

    # Step 1: Raw -> Hourly (data older than 7 days)
    hourly_created, raw_deleted = await rollup_raw_to_hourly()
    results["hourly_created"] = hourly_created
    results["raw_deleted"] = raw_deleted
    logger.info("Raw to hourly: %d aggregates created, %d records deleted",
                hourly_created, raw_deleted)

    # Step 2: Hourly -> Daily (data older than 90 days)
    daily_created, hourly_deleted = await rollup_hourly_to_daily()
    results["daily_created"] = daily_created
    results["hourly_deleted"] = hourly_deleted
    logger.info("Hourly to daily: %d aggregates created, %d records deleted",
                daily_created, hourly_deleted)

    # Step 3: Delete daily older than 12 months
    daily_deleted = await prune_old_daily_metrics()
    results["daily_deleted"] = daily_deleted
    logger.info("Daily pruned: %d records deleted", daily_deleted)

    elapsed = time.monotonic() - start_time
    logger.info("Metrics rollup completed in %.2f seconds", elapsed)

    return results
```

**AC Coverage:** AC5

---

### Task 5: Register Rollup Job in Scheduler

**File:** `backend/src/homelab_cmd/main.py`

Add schedule for rollup job at 01:00 UTC (after midnight prune):

```python
from homelab_cmd.services.scheduler import (
    check_stale_servers,
    prune_old_metrics,
    run_metrics_rollup,  # New import
)

# In lifespan():
await scheduler.add_schedule(
    run_metrics_rollup,
    CronTrigger(hour=1, minute=0),  # 01:00 UTC, after midnight prune
    id="run_metrics_rollup",
)
```

**AC Coverage:** AC5

---

### Task 6: Update Metrics API for Tiered Queries

**File:** `backend/src/homelab_cmd/api/schemas/metrics.py`

Add new TimeRange option:

```python
class TimeRange(str, Enum):
    """Time range for metrics history."""
    HOURS_24 = "24h"
    DAYS_7 = "7d"
    DAYS_30 = "30d"
    MONTHS_12 = "12m"  # New option
```

**File:** `backend/src/homelab_cmd/api/routes/metrics.py`

Update `get_metrics_history()` to query appropriate tier:

```python
async def get_metrics_history(
    server_id: str,
    range: TimeRange = Query(default=TimeRange.HOURS_24),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> MetricsHistoryResponse:
    # Tier selection logic
    if range == TimeRange.HOURS_24:
        # Query raw metrics table (existing logic)
        resolution = "1m"
    elif range == TimeRange.DAYS_7:
        # Query raw metrics with hourly aggregation (existing logic)
        resolution = "1h"
    elif range == TimeRange.DAYS_30:
        # Query metrics_hourly table directly
        resolution = "1h"
    elif range == TimeRange.MONTHS_12:
        # Query metrics_daily table
        resolution = "1d"

    # Return merged/formatted results
```

**AC Coverage:** AC6

---

### Task 7: Update Retention Period for Raw Data

**File:** `backend/src/homelab_cmd/services/scheduler.py`

Update existing `prune_old_metrics()` to use new 7-day retention:

```python
# Change from:
RETENTION_DAYS = 30

# To:
RAW_RETENTION_DAYS = 7
```

The existing prune job at midnight will now delete raw data older than 7 days. The rollup job at 01:00 UTC handles aggregation before deletion (to catch any edge cases).

**Note:** Actually, we need to be careful here. The rollup should happen BEFORE the prune. Let me reconsider the timing:

- **Option A:** Rollup first (01:00), then prune (02:00) - safer, ensures data is aggregated before deletion
- **Option B:** Single job does rollup-then-prune atomically

**Decision:** Option B is cleaner. Modify `prune_old_metrics()` to call rollup first, or merge into a single job.

**Revised approach:** The rollup job at 01:00 UTC handles both aggregation AND deletion of processed records in a single transaction. The existing prune job at midnight can be kept for any straggler cleanup or removed.

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/homelab_cmd/db/models/metrics.py` | Modify | Add MetricsHourly, MetricsDaily models |
| `backend/alembic/versions/XXXX_*.py` | New | Migration for new tables |
| `backend/src/homelab_cmd/services/scheduler.py` | Modify | Add rollup functions, update retention constants |
| `backend/src/homelab_cmd/main.py` | Modify | Register rollup job schedule |
| `backend/src/homelab_cmd/api/schemas/metrics.py` | Modify | Add 12m TimeRange option |
| `backend/src/homelab_cmd/api/routes/metrics.py` | Modify | Add tiered query logic |

---

## Database Query Patterns

### Raw to Hourly Aggregation (SQLite compatible)

```sql
SELECT
    server_id,
    strftime('%Y-%m-%d %H:00:00', timestamp) as hour_start,
    AVG(cpu_percent) as cpu_avg,
    MIN(cpu_percent) as cpu_min,
    MAX(cpu_percent) as cpu_max,
    AVG(memory_percent) as memory_avg,
    MIN(memory_percent) as memory_min,
    MAX(memory_percent) as memory_max,
    AVG(disk_percent) as disk_avg,
    MIN(disk_percent) as disk_min,
    MAX(disk_percent) as disk_max,
    COUNT(*) as sample_count
FROM metrics
WHERE timestamp < :cutoff
GROUP BY server_id, strftime('%Y-%m-%d %H:00:00', timestamp)
```

### Hourly to Daily Aggregation

```sql
SELECT
    server_id,
    strftime('%Y-%m-%d 00:00:00', timestamp) as day_start,
    AVG(cpu_avg) as cpu_avg,  -- Average of averages (weighted by sample_count for accuracy)
    MIN(cpu_min) as cpu_min,
    MAX(cpu_max) as cpu_max,
    -- Similar for memory, disk
    SUM(sample_count) as sample_count
FROM metrics_hourly
WHERE timestamp < :cutoff
GROUP BY server_id, strftime('%Y-%m-%d 00:00:00', timestamp)
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No data to roll up | Job completes with 0 counts logged |
| Rollup fails mid-execution | Transaction rollback, retry next run |
| Server deleted mid-rollup | CASCADE delete handles orphaned records |
| Gap in data (server offline) | Gaps preserved in aggregates |
| First run (no old data) | Jobs run successfully with 0 records |

---

## Testing Strategy

1. **Unit tests:** Aggregation calculation accuracy
2. **Integration tests:** Full rollup job sequence
3. **API tests:** Tiered query returns correct data
4. **Edge case tests:** Empty data, transaction rollback

---

## Dependencies

- Alembic for migrations
- APScheduler (already in use)
- SQLAlchemy async session (already in use)

---

## Estimated Implementation Order

1. Database models and migration
2. Rollup functions (raw→hourly, hourly→daily, prune daily)
3. Scheduler job registration
4. API tier selection logic
5. Tests

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Long-running rollup blocks DB | Batch processing with commits |
| Data loss during rollup | Transactional operations |
| Incorrect aggregation | Comprehensive unit tests |
| API returns wrong tier | Explicit tier selection tests |
