# PL0207: Tiered Data Retention and Rollup - Implementation Plan

> **Status:** Complete
> **Story:** [US0046: Tiered Data Retention and Rollup](../stories/US0046-tiered-data-retention.md)
> **Epic:** [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)
> **Created:** 2026-01-20
> **Language:** Python

## Overview

Implement tiered data retention with automatic rollup jobs that aggregate raw metrics into hourly and daily summaries. Raw metrics (60s granularity) are kept for 7 days, hourly aggregates for 90 days, and daily aggregates for 12 months. The metrics API selects the appropriate tier based on requested time range.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Hourly Rollup | Raw metrics older than 7 days aggregated into `metrics_hourly` |
| AC2 | Daily Rollup | Hourly metrics older than 90 days aggregated into `metrics_daily` |
| AC3 | 12-Month Pruning | Daily metrics older than 12 months permanently deleted |
| AC4 | Min/Max Aggregates | Each aggregate includes avg, min, max for CPU, memory, disk |
| AC5 | Scheduled Execution | Rollup jobs run at 01:00 UTC after midnight prune |
| AC6 | Tiered API Queries | API returns data from appropriate tier based on time range |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI, SQLAlchemy 2.0 (async)
- **Test Framework:** pytest
- **Scheduler:** APScheduler (existing)

### Existing Patterns
- Data retention pruning already exists in `scheduler.py` (US0009)
- Metrics model in `db/models/metrics.py`
- Metrics API in `api/routes/metrics.py`

---

## Implementation Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Create MetricsHourly and MetricsDaily models | `db/models/metrics.py` | [x] |
| 2 | Create Alembic migration for new tables | `migrations/versions/` | [x] |
| 3 | Add rollup constants (retention days) | `services/scheduler.py` | [x] |
| 4 | Implement hourly rollup function (raw → hourly) | `services/scheduler.py` | [x] |
| 5 | Implement daily rollup function (hourly → daily) | `services/scheduler.py` | [x] |
| 6 | Implement yearly pruning (daily > 12 months) | `services/scheduler.py` | [x] |
| 7 | Register rollup job at 01:00 UTC | `services/scheduler.py` | [x] |
| 8 | Add DataTier enum and tier selection logic | `api/routes/metrics.py` | [x] |
| 9 | Update metrics API to query tiered tables | `api/routes/metrics.py` | [x] |
| 10 | Write tests for rollup and tier selection | `tests/` | [x] |

---

## Implementation Details

### Database Schema

Two new tables mirroring the aggregate structure:

- `metrics_hourly` - avg/min/max for CPU, memory, disk + sample_count
- `metrics_daily` - same structure, daily granularity

Both indexed on `(server_id, timestamp)`.

### Rollup Strategy

Sequential execution at 01:00 UTC:
1. Raw → Hourly (data older than 7 days)
2. Hourly → Daily (data older than 90 days)
3. Daily pruning (data older than 365 days)

Each step uses transactions for atomicity.

### API Tier Selection

`DataTier` enum routes queries to the correct table:
- `24h` → raw metrics
- `7d` → raw (recent) + hourly (older)
- `30d` → hourly aggregates
- `12m` → daily aggregates

---

## Definition of Done

- [x] MetricsHourly and MetricsDaily models created with indices
- [x] Rollup jobs execute in correct sequence
- [x] API returns data from appropriate tier
- [x] Aggregate records contain avg, min, max values
- [x] Tests pass
- [x] No linting errors

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial plan creation |
| 2026-02-17 | Claude | Retroactively created from completed implementation |
