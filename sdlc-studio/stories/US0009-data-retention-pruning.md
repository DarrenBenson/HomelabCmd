# US0009: Data Retention and Pruning

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** old metrics data to be automatically deleted
**So that** the database doesn't grow unbounded and performance remains good

## Context

### Persona Reference

**Darren** - Runs the hub 24/7 and expects it to manage itself. Doesn't want to manually clear old data or deal with disk full issues.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With 11 servers reporting every 60 seconds, the metrics table grows by ~15,840 rows per day. Over 30 days, this is ~475,000 rows. A daily pruning job deletes metrics older than 30 days to keep the database size manageable and query performance fast.

## Acceptance Criteria

### AC1: Metrics older than 30 days are deleted

- **Given** metrics exist that are >30 days old
- **When** the daily pruning job runs
- **Then** those metrics are permanently deleted

### AC2: Pruning job runs daily

- **Given** the hub is running
- **When** midnight (UTC) occurs
- **Then** the pruning job executes

### AC3: Recent data is preserved

- **Given** metrics exist from the last 30 days
- **When** the pruning job runs
- **Then** those metrics are NOT deleted

### AC4: Pruning handles large volumes

- **Given** many records need deletion (>10,000)
- **When** the pruning job runs
- **Then** deletion completes without blocking other operations

### AC5: Pruning logged

- **Given** the pruning job completes
- **When** checking logs
- **Then** number of deleted records is logged

## Scope

### In Scope

- Daily scheduled pruning job
- Metrics table cleanup (>30 days)
- Batch deletion for performance
- Logging of pruning activity

### Out of Scope

- Configurable retention period (fixed 30 days for MVP)
- Alert history pruning (EP0002)
- Action audit log retention (EP0004, may have different policy)
- Database vacuum/optimise (manual task if needed)

## UI/UX Requirements

N/A - Background job only.

## Technical Notes

### Background Scheduler

```python
@scheduler.scheduled_job('cron', hour=0, minute=0)  # Midnight UTC
async def prune_old_metrics():
    retention_cutoff = datetime.utcnow() - timedelta(days=30)

    # Batch delete for performance
    while True:
        result = await db.execute(
            delete(Metrics)
            .where(Metrics.timestamp < retention_cutoff)
            .limit(10000)  # Batch size
        )
        deleted = result.rowcount
        logger.info(f"Pruned {deleted} old metrics")
        if deleted < 10000:
            break
```

### Data Considerations

- Expected daily deletion: ~15,840 rows (if all servers reporting)
- Batch deletion prevents long-running transactions
- Consider running VACUUM periodically (manual or weekly job)

**TRD Reference:** [§5 Data Architecture](../trd.md#5-data-architecture)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No old metrics exist | Job runs, deletes 0, logs result |
| Very large backlog (initial cleanup) | Batch processing handles gracefully |
| Job fails mid-execution | Logs error; retries next day; partial cleanup is OK |
| Database locked | Retry with exponential backoff |
| Hub not running at midnight | Job runs on next startup (catchup) |

## Test Scenarios

- [x] Pruning job deletes metrics older than 30 days
- [x] Pruning job preserves metrics within 30 days
- [x] Pruning job logs number of deleted records
- [x] Batch deletion works for large volumes
- [x] Job scheduled to run at midnight UTC
- [x] Database remains responsive during pruning

## Definition of Done


**Story-specific additions:**

- [x] Pruning tested with realistic data volumes
- [x] Job run time acceptable (<60 seconds for typical load)
- [x] No database locks during normal operation

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Done |
| US0008: Server Status Detection | Story | Done (shares scheduler) |

## Estimation

**Story Points:** 2

**Complexity:** Low - simple scheduled deletion

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | Implementation complete - CronTrigger pruning job, 110 tests passing |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
