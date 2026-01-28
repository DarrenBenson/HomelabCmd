# TS0046: Tiered Data Retention and Rollup

> **Status:** Complete
> **Story:** [US0046: Tiered Data Retention](../stories/US0046-tiered-data-retention.md)
> **Epic:** [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)
> **Created:** 2026-01-21
> **Last Updated:** 2026-01-21

## Overview

Test specification for tiered metrics data retention system. Covers database models, rollup job operations, and API tier selection for returning metrics from raw, hourly, or daily tables.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0046](../stories/US0046-tiered-data-retention.md) | Tiered Data Retention and Rollup | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0046 | AC1 | Hourly rollup aggregates raw data | TC01, TC02, TC03 | Covered |
| US0046 | AC2 | Daily rollup aggregates hourly data | TC04, TC05 | Covered |
| US0046 | AC3 | Data older than 12 months deleted | TC06 | Covered |
| US0046 | AC4 | Aggregates include min/max values | TC07, TC08 | Covered |
| US0046 | AC5 | Rollup jobs run on schedule | TC09 | Covered |
| US0046 | AC6 | API returns data from appropriate tier | TC10, TC11, TC12, TC13 | Covered |

**Coverage Summary:**
- Total ACs: 6
- Covered: 6
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Aggregation calculations, tier selection logic |
| Integration | Yes | Full rollup job sequence with database |
| API | Yes | Tiered query endpoint behaviour |
| E2E | No | Backend-only story, no UI |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Test database with metrics tables, APScheduler |
| External Services | None (SQLite in-memory for tests) |
| Test Data | Raw metrics spanning multiple days/hours |

---

## Test Cases

### TC01: Hourly rollup aggregates raw metrics older than 7 days

**Type:** Integration
**Priority:** High
**AC:** AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given raw metrics exist with timestamps older than 7 days | Metrics in `metrics` table |
| 2 | When `rollup_raw_to_hourly()` is called | Function executes without error |
| 3 | Then aggregated records appear in `metrics_hourly` | One record per server per hour |
| 4 | And original raw records are deleted | No raw records older than 7 days remain |

#### Test Data

```yaml
input:
  server_id: "server-001"
  metrics:
    - timestamp: "2026-01-10T10:00:00Z"  # 11 days old
      cpu_percent: 50.0
      memory_percent: 60.0
      disk_percent: 70.0
    - timestamp: "2026-01-10T10:01:00Z"
      cpu_percent: 55.0
      memory_percent: 62.0
      disk_percent: 71.0
    - timestamp: "2026-01-10T10:02:00Z"
      cpu_percent: 45.0
      memory_percent: 58.0
      disk_percent: 69.0
expected:
  metrics_hourly:
    - server_id: "server-001"
      timestamp: "2026-01-10T10:00:00Z"
      cpu_avg: 50.0
      cpu_min: 45.0
      cpu_max: 55.0
      memory_avg: 60.0
      memory_min: 58.0
      memory_max: 62.0
      disk_avg: 70.0
      disk_min: 69.0
      disk_max: 71.0
      sample_count: 3
```

#### Assertions

- [ ] `metrics_hourly` contains exactly 1 record for server-001 hour 10
- [ ] `cpu_avg` equals 50.0 (average of 50, 55, 45)
- [ ] `cpu_min` equals 45.0
- [ ] `cpu_max` equals 55.0
- [ ] `sample_count` equals 3
- [ ] Original raw metrics are deleted from `metrics` table

---

### TC02: Hourly rollup handles multiple servers

**Type:** Integration
**Priority:** High
**AC:** AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given raw metrics for 3 servers older than 7 days | Metrics spread across multiple hours |
| 2 | When `rollup_raw_to_hourly()` is called | Function completes |
| 3 | Then each server has separate hourly aggregates | No cross-server data mixing |

#### Assertions

- [ ] Each server_id has its own hourly aggregate records
- [ ] No server data is mixed with another server's data
- [ ] All servers' raw data older than 7 days is deleted

---

### TC03: Hourly rollup with no data to process

**Type:** Unit
**Priority:** Medium
**AC:** AC1 (Edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no raw metrics older than 7 days | Empty result set |
| 2 | When `rollup_raw_to_hourly()` is called | Function completes |
| 3 | Then returns (0, 0) for counts | No records created or deleted |

#### Assertions

- [ ] Function returns `(0, 0)` tuple (aggregates_created, records_deleted)
- [ ] No error raised
- [ ] Log message indicates 0 records processed

---

### TC04: Daily rollup aggregates hourly metrics older than 90 days

**Type:** Integration
**Priority:** High
**AC:** AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given hourly metrics exist older than 90 days | Records in `metrics_hourly` |
| 2 | When `rollup_hourly_to_daily()` is called | Function executes |
| 3 | Then aggregated records appear in `metrics_daily` | One record per server per day |
| 4 | And original hourly records are deleted | No hourly records older than 90 days |

#### Test Data

```yaml
input:
  server_id: "server-001"
  metrics_hourly:
    - timestamp: "2025-10-20T08:00:00Z"  # 93 days old
      cpu_avg: 40.0
      cpu_min: 35.0
      cpu_max: 45.0
      sample_count: 60
    - timestamp: "2025-10-20T09:00:00Z"
      cpu_avg: 50.0
      cpu_min: 45.0
      cpu_max: 55.0
      sample_count: 60
expected:
  metrics_daily:
    - server_id: "server-001"
      timestamp: "2025-10-20T00:00:00Z"
      cpu_avg: 45.0  # Average of hourly averages
      cpu_min: 35.0  # Min of all hourly mins
      cpu_max: 55.0  # Max of all hourly maxes
      sample_count: 120
```

#### Assertions

- [ ] `metrics_daily` contains 1 record for the day
- [ ] `cpu_min` is the minimum of all hourly `cpu_min` values
- [ ] `cpu_max` is the maximum of all hourly `cpu_max` values
- [ ] `sample_count` is the sum of all hourly sample counts

---

### TC05: Daily rollup preserves data gaps

**Type:** Integration
**Priority:** Medium
**AC:** AC2 (Edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given hourly data with gaps (server offline) | Missing hours in data |
| 2 | When daily rollup occurs | Function completes |
| 3 | Then daily aggregate reflects actual samples | sample_count shows true count |

#### Assertions

- [ ] Days with gaps have lower sample_count
- [ ] No interpolation occurs for missing hours
- [ ] Gaps are preserved accurately

---

### TC06: Daily metrics older than 12 months are deleted

**Type:** Integration
**Priority:** High
**AC:** AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given daily metrics exist older than 365 days | Old records in `metrics_daily` |
| 2 | When `prune_old_daily_metrics()` is called | Function executes |
| 3 | Then those records are permanently deleted | No records older than 12 months |

#### Test Data

```yaml
input:
  server_id: "server-001"
  metrics_daily:
    - timestamp: "2025-01-01T00:00:00Z"  # 385 days old
      cpu_avg: 40.0
    - timestamp: "2025-12-01T00:00:00Z"  # 51 days old (keep)
      cpu_avg: 50.0
expected:
  deleted_count: 1
  remaining:
    - timestamp: "2025-12-01T00:00:00Z"
```

#### Assertions

- [ ] Records older than 365 days are deleted
- [ ] Records within 365 days are retained
- [ ] Function returns correct deleted count

---

### TC07: Aggregate records contain all required fields

**Type:** Unit
**Priority:** High
**AC:** AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given raw metrics with varying values | CPU, memory, disk percentages |
| 2 | When hourly rollup creates aggregate | MetricsHourly record created |
| 3 | Then record contains avg, min, max for all metrics | All 9 aggregate fields populated |

#### Assertions

- [ ] `cpu_avg`, `cpu_min`, `cpu_max` all populated
- [ ] `memory_avg`, `memory_min`, `memory_max` all populated
- [ ] `disk_avg`, `disk_min`, `disk_max` all populated
- [ ] `sample_count` matches input record count

---

### TC08: Aggregation handles null values

**Type:** Unit
**Priority:** Medium
**AC:** AC4 (Edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given raw metrics where some values are null | Mixed null/value data |
| 2 | When aggregation occurs | Nulls excluded from calculation |
| 3 | Then aggregate reflects only non-null values | Correct averages |

#### Assertions

- [ ] Null values are excluded from AVG calculation
- [ ] MIN/MAX only consider non-null values
- [ ] If all values null, aggregate field is null

---

### TC09: Rollup job runs at scheduled time

**Type:** Integration
**Priority:** High
**AC:** AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given rollup job is scheduled for 01:00 UTC | CronTrigger configured |
| 2 | When 01:00 UTC occurs | Scheduler triggers job |
| 3 | Then all rollup operations execute in sequence | Raw->hourly, hourly->daily, prune daily |

#### Assertions

- [ ] Job registered with scheduler under id "run_metrics_rollup"
- [ ] CronTrigger set to hour=1, minute=0
- [ ] Job executes all three rollup phases
- [ ] Logging shows execution times

---

### TC10: API returns raw data for 24h range

**Type:** API
**Priority:** High
**AC:** AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given raw metrics exist for last 24 hours | Recent data in `metrics` table |
| 2 | When GET `/servers/{id}/metrics?range=24h` | API called |
| 3 | Then response contains raw metrics at 1m resolution | `resolution: "1m"` |

#### Test Data

```yaml
request:
  method: GET
  url: /api/v1/servers/server-001/metrics?range=24h
  headers:
    X-API-Key: test-api-key
expected:
  status: 200
  body:
    server_id: "server-001"
    range: "24h"
    resolution: "1m"
    data_points: [...]
```

#### Assertions

- [ ] Response status is 200
- [ ] `resolution` is "1m"
- [ ] Data points are from raw `metrics` table
- [ ] Points within last 24 hours only

---

### TC11: API returns hourly data for 30d range

**Type:** API
**Priority:** High
**AC:** AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given hourly metrics exist for last 30 days | Data in `metrics_hourly` |
| 2 | When GET `/servers/{id}/metrics?range=30d` | API called |
| 3 | Then response contains hourly aggregates at 1h resolution | `resolution: "1h"` |

#### Assertions

- [ ] Response status is 200
- [ ] `resolution` is "1h"
- [ ] Data points are from `metrics_hourly` table
- [ ] Points within last 30 days only

---

### TC12: API returns daily data for 12m range

**Type:** API
**Priority:** High
**AC:** AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given daily metrics exist for last 12 months | Data in `metrics_daily` |
| 2 | When GET `/servers/{id}/metrics?range=12m` | API called |
| 3 | Then response contains daily aggregates at 1d resolution | `resolution: "1d"` |

#### Assertions

- [ ] Response status is 200
- [ ] `resolution` is "1d"
- [ ] Data points are from `metrics_daily` table
- [ ] Points within last 12 months only

---

### TC13: API handles missing tier data gracefully

**Type:** API
**Priority:** Medium
**AC:** AC6 (Edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no data exists in `metrics_daily` | Empty table |
| 2 | When GET `/servers/{id}/metrics?range=12m` | API called |
| 3 | Then response returns empty data_points | No error |

#### Assertions

- [ ] Response status is 200
- [ ] `data_points` is empty array
- [ ] `total_points` is 0
- [ ] No 500 error

---

### TC14: Rollup transaction rolls back on failure

**Type:** Integration
**Priority:** High
**AC:** Edge case
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given raw metrics ready for rollup | Data in `metrics` |
| 2 | When rollup fails mid-execution (simulated) | Error during insert |
| 3 | Then transaction is rolled back | No partial aggregates |
| 4 | And original raw data is preserved | No data loss |

#### Assertions

- [ ] No records in `metrics_hourly` from failed batch
- [ ] All original raw records still in `metrics`
- [ ] Error logged with details
- [ ] Next run can retry successfully

---

## Fixtures

```yaml
# Shared test data for this spec

servers:
  - id: "server-001"
    hostname: "nas-01.local"
  - id: "server-002"
    hostname: "docker-01.local"
  - id: "server-003"
    hostname: "pve-01.local"

raw_metrics_old:  # Older than 7 days
  server_id: "server-001"
  timestamps:
    - "2026-01-10T10:00:00Z"
    - "2026-01-10T10:01:00Z"
    - "2026-01-10T10:02:00Z"
  cpu_percent: [50.0, 55.0, 45.0]
  memory_percent: [60.0, 62.0, 58.0]
  disk_percent: [70.0, 71.0, 69.0]

hourly_metrics_old:  # Older than 90 days
  server_id: "server-001"
  timestamps:
    - "2025-10-20T08:00:00Z"
    - "2025-10-20T09:00:00Z"
  cpu_avg: [40.0, 50.0]
  cpu_min: [35.0, 45.0]
  cpu_max: [45.0, 55.0]

daily_metrics_old:  # Older than 12 months
  server_id: "server-001"
  timestamps:
    - "2025-01-01T00:00:00Z"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Hourly rollup aggregates raw metrics | Pending | - |
| TC02 | Hourly rollup handles multiple servers | Pending | - |
| TC03 | Hourly rollup with no data | Pending | - |
| TC04 | Daily rollup aggregates hourly metrics | Pending | - |
| TC05 | Daily rollup preserves data gaps | Pending | - |
| TC06 | Daily metrics pruning | Pending | - |
| TC07 | Aggregate fields populated | Pending | - |
| TC08 | Aggregation handles nulls | Pending | - |
| TC09 | Scheduled job execution | Pending | - |
| TC10 | API 24h range | Pending | - |
| TC11 | API 30d range | Pending | - |
| TC12 | API 12m range | Pending | - |
| TC13 | API empty tier data | Pending | - |
| TC14 | Rollup transaction rollback | Pending | - |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0007](../epics/EP0007-analytics-reporting.md) |
| Story | [US0046](../stories/US0046-tiered-data-retention.md) |
| Code Plan | [US0046](../code-plans/US0046-tiered-data-retention.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial spec generation |
