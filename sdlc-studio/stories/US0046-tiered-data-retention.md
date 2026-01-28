# US0046: Tiered Data Retention and Rollup

> **Status:** Done
> **Epic:** [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5
> **Completed:** 2026-01-21

## User Story

**As a** Darren (Homelab Operator)
**I want** old metrics to be automatically aggregated into hourly and daily summaries
**So that** I can view 12-month trends without excessive storage usage

## Context

### Persona Reference

**Darren** - Wants to see long-term trends for capacity planning but doesn't need minute-level detail for data older than a week.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, raw metrics (every 60 seconds) are kept for 30 days then deleted (US0009). This limits trend analysis to 30 days. By rolling up older data into aggregates, we can extend visibility to 12 months while reducing storage by ~95%.

**Tiered retention strategy:**

| Tier | Granularity | Retention | Rows/server |
|------|-------------|-----------|-------------|
| Raw | 60 seconds | 7 days | ~10,080 |
| Hourly | 1 hour | 90 days | ~2,160 |
| Daily | 1 day | 12 months | ~365 |

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | Extends US0009 | Build on existing retention job |
| Scope | 12-month trends | Tiered data aggregation |
| Performance | Minimal storage overhead | >90% reduction via rollups |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard < 2 seconds | Efficient aggregate queries |
| UX | Minimal maintenance | Automatic rollup jobs (01:00 UTC) |
| Reliability | No data loss | Transactional rollup operations |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Hourly rollup job aggregates raw data

- **Given** raw metrics exist older than 7 days
- **When** the hourly rollup job runs
- **Then** those metrics are aggregated into `metrics_hourly` table
- **And** the original raw records are deleted

### AC2: Daily rollup job aggregates hourly data

- **Given** hourly metrics exist older than 90 days
- **When** the daily rollup job runs
- **Then** those metrics are aggregated into `metrics_daily` table
- **And** the original hourly records are deleted

### AC3: Data older than 12 months is deleted

- **Given** daily metrics exist older than 12 months
- **When** the pruning job runs
- **Then** those daily records are permanently deleted

### AC4: Aggregates include min/max values

- **Given** metrics are being rolled up
- **When** aggregation occurs
- **Then** each aggregate record contains: avg, min, max for CPU, memory, and disk

### AC5: Rollup jobs run on schedule

- **Given** the hub is running
- **When** 01:00 UTC occurs (after midnight prune)
- **Then** the rollup jobs execute in sequence

### AC6: API returns data from appropriate tier

- **Given** a request for metrics history
- **When** the time range spans multiple tiers
- **Then** the API queries the appropriate table(s) and merges results

## Scope

### In Scope

- New database tables: `metrics_hourly`, `metrics_daily`
- Alembic migration for new tables
- Rollup scheduler jobs (after existing prune job)
- Modified retention: raw 7d, hourly 90d, daily 12m
- API updates to query tiered data
- Logging of rollup activity

### Out of Scope

- Configurable retention periods
- Rollup of network I/O metrics (CPU/RAM/Disk only for MVP)
- Backfilling historical data (starts fresh)
- UI changes (separate story US0047)

## UI/UX Requirements

N/A - Backend changes only. UI updates in US0047.

## Technical Notes

### Database Schema

```sql
CREATE TABLE metrics_hourly (
    id INTEGER PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    timestamp DATETIME NOT NULL,  -- Hour start (e.g., 2026-01-18 14:00:00)
    cpu_avg REAL,
    cpu_min REAL,
    cpu_max REAL,
    memory_avg REAL,
    memory_min REAL,
    memory_max REAL,
    disk_avg REAL,
    disk_min REAL,
    disk_max REAL,
    sample_count INTEGER NOT NULL
);

CREATE TABLE metrics_daily (
    -- Same structure as metrics_hourly
    -- timestamp is day start (e.g., 2026-01-18 00:00:00)
);

CREATE INDEX idx_metrics_hourly_server_ts ON metrics_hourly(server_id, timestamp);
CREATE INDEX idx_metrics_daily_server_ts ON metrics_daily(server_id, timestamp);
```

### Rollup Job Logic

```python
@scheduler.scheduled_job('cron', hour=1, minute=0)  # After midnight prune
async def rollup_metrics():
    # Step 1: Raw -> Hourly (data older than 7 days)
    hourly_cutoff = datetime.now(UTC) - timedelta(days=7)
    # Group by server_id, hour; calculate avg/min/max; insert to hourly; delete raw

    # Step 2: Hourly -> Daily (data older than 90 days)
    daily_cutoff = datetime.now(UTC) - timedelta(days=90)
    # Group by server_id, day; calculate avg/min/max; insert to daily; delete hourly

    # Step 3: Delete daily older than 12 months
    yearly_cutoff = datetime.now(UTC) - timedelta(days=365)
    # Delete from metrics_daily where timestamp < yearly_cutoff
```

### API Query Strategy

```python
def get_metrics_for_range(server_id: str, range: TimeRange):
    if range == '24h':
        return query_raw_metrics(...)
    elif range == '7d':
        # Mix of raw (recent) and hourly (older)
        return merge_tiered_data(raw_days=7, hourly_days=0)
    elif range == '30d':
        return query_hourly_metrics(...)
    elif range == '12m':
        return query_daily_metrics(...)
```

**TRD Reference:** [SS5 Data Architecture](../trd.md#5-data-architecture)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No data to roll up | Job runs, processes 0 records, logs result |
| Rollup fails mid-execution | Transaction rolled back; retry next day |
| Gap in data (server offline) | Gaps preserved in aggregates |
| First run (no old data yet) | Jobs run successfully with 0 records |

## Test Cases

| ID | AC | Test Description | Expected Result |
|----|----|--------------------|-----------------|
| TC1 | AC1 | Insert raw metrics older than 7 days; run hourly rollup | Records aggregated to metrics_hourly; raw deleted |
| TC2 | AC2 | Insert hourly metrics older than 90 days; run daily rollup | Records aggregated to metrics_daily; hourly deleted |
| TC3 | AC3 | Insert daily metrics older than 12 months; run prune | Daily records deleted |
| TC4 | AC4 | Verify aggregate record structure | Contains avg, min, max for CPU, memory, disk |
| TC5 | AC5 | Trigger scheduled job at 01:00 UTC | Jobs execute in sequence after prune |
| TC6 | AC6 | Request 30d metrics spanning tiers | API returns merged data from correct tiers |
| TC7 | Edge | Run rollup with no data to process | Job completes with 0 records logged |
| TC8 | Edge | Simulate rollup failure mid-execution | Transaction rolled back; no partial data |

## Quality Checklist

### Code Quality

- [ ] Migration creates new tables with indices
- [ ] Rollup jobs use transactions for atomicity
- [ ] API tier selection logic is tested
- [ ] Logging captures rollup counts and timing

### Testing

- [ ] Unit tests for aggregation calculations
- [ ] Integration tests for rollup job sequence
- [ ] Performance test with realistic data volumes
- [ ] No data loss verified during rollup transitions

### Documentation

- [ ] TRD updated with tiered retention details
- [ ] Runbook updated with rollup monitoring

## Ready Status Gate

| Gate | Criteria | Status |
|------|----------|--------|
| AC Coverage | All ACs have test cases | Pending |
| Constraints | Inherited constraints addressed | Pending |
| Dependencies | US0001, US0009 complete | Done |
| Technical | Schema and job logic defined | Done |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0009: Data Retention and Pruning | Story | Done |
| US0001: Database Schema | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - Multiple tables, scheduler coordination, API changes

## Open Questions

- [x] Include network I/O in rollups? **No - CPU/RAM/Disk only for MVP**
- [x] Include min/max in aggregates? **Yes - useful for spotting spikes**

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
