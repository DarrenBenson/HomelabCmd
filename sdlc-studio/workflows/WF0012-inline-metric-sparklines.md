# WF0012: Inline Metric Sparklines

> **Status:** Done
> **Story:** [US0113: Inline Metric Sparklines](../stories/US0113-inline-metric-sparklines.md)
> **Plan:** [PL0113: Inline Metric Sparklines](../plans/PL0113-inline-metric-sparklines.md)
> **Created:** 2026-01-28
> **Approach:** Test-After

## Current Phase

**Phase 8: Review** (Complete)

## Phase Progress

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Plan | Done | 2026-01-28 | 2026-01-28 |
| 2 | Test Spec | Skipped | - | - |
| 3 | Implementation | Done | 2026-01-28 | 2026-01-28 |
| 4 | Tests | Done | 2026-01-28 | 2026-01-28 |
| 5 | Test | Done | 2026-01-28 | 2026-01-28 |
| 6 | Verify | Done | 2026-01-28 | 2026-01-28 |
| 7 | Check | Done | 2026-01-28 | 2026-01-28 |
| 8 | Review | Done | 2026-01-28 | 2026-01-28 |

## Session Log

### Session 1 - 2026-01-28

- Created implementation plan PL0113
- Implemented backend sparkline endpoint:
  - Added SparklinePoint and SparklineResponse schemas
  - Added GET /api/v1/servers/{id}/metrics/sparkline endpoint
  - Supports cpu_percent, memory_percent, disk_percent metrics
  - Supports 30m, 1h, 6h periods with downsampling to ~30 points
- Implemented frontend components:
  - Created MetricSparkline.tsx with Recharts LineChart
  - Created metrics.ts API client
  - Integrated CPU sparkline into ServerCard.tsx
  - Trend colouring: green (down), grey (stable), amber (up)
  - Tooltip shows value and timestamp on hover
- Created comprehensive tests:
  - Backend: 17 sparkline tests (all passing)
  - Frontend: 19 MetricSparkline tests (all passing)
- Built and deployed locally

### Session 1 (continued) - 2026-01-28

- Extended implementation to include RAM and Disk sparklines
- Updated story scope: moved RAM/Disk from "Out of Scope" to "In Scope"
- Modified ServerCard.tsx:
  - Changed layout to show sparkline below each metric
  - Added memory_percent sparkline under RAM
  - Added disk_percent sparkline under Disk
- All 66 ServerCard tests passing
- Rebuilt and deployed

## Implementation Summary

### Files Created
- `backend/src/homelab_cmd/api/schemas/metrics.py` - Added SparklinePoint, SparklineResponse
- `backend/src/homelab_cmd/api/routes/metrics.py` - Added sparkline endpoint
- `frontend/src/api/metrics.ts` - Sparkline API client
- `frontend/src/components/MetricSparkline.tsx` - Sparkline component
- `frontend/src/components/MetricSparkline.test.tsx` - 19 unit tests

### Files Modified
- `frontend/src/components/ServerCard.tsx` - Integrated sparkline below metrics
- `tests/test_metrics_history.py` - Added 17 sparkline API tests

### Acceptance Criteria Coverage

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Backend sparkline endpoint | Done |
| AC2 | 60x20px sparkline on card | Done |
| AC3 | Hover tooltip with value/time | Done |
| AC4 | Trend colour coding | Done |
| AC5 | Handle missing data | Done |
| AC6 | Efficient batch fetch | Done |
