# PL0010: Historical Metrics and Charts - Implementation Plan

> **Status:** Complete
> **Story:** [US0007: Historical Metrics and Charts](../stories/US0007-historical-metrics-charts.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python (backend), TypeScript (frontend)

## Overview

Implement historical metrics charts for the server detail view. This requires a new backend API endpoint that returns time-series data with aggregation, frontend chart components using Recharts, and integration into the existing ServerDetail page.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Charts display on server detail | Time-series charts for CPU, RAM, and Disk are displayed |
| AC2 | Time range selection works | Selecting different ranges (24h/7d/30d) updates charts |
| AC3 | Charts render correctly for 30 days | Chart renders smoothly with appropriate data aggregation |
| AC4 | Hover shows data point details | Tooltip shows timestamp and exact value |
| AC5 | API returns time-series data | `/api/v1/servers/{server_id}/metrics` returns time-series data |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Framework:** FastAPI (backend), React 19 + Vite (frontend)
- **Test Framework:** pytest (backend), Vitest + React Testing Library (frontend)
- **Database:** SQLite (development/production)

### Relevant Best Practices

- British English in comments and UI strings
- Dense, economical code
- Type hints required (Python), strict TypeScript
- No over-engineering - implement only what's requested

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | time-series endpoint query params | Query parameter validation |
| Recharts | /recharts/recharts | LineChart AreaChart responsive | ResponsiveContainer, LineChart |
| SQLAlchemy | /sqlalchemy/sqlalchemy | async session time range query | select with where clause filtering |

### Existing Patterns

**Backend Routes:**
- Routes in `backend/src/homelab_cmd/api/routes/` use APIRouter with prefix and tags
- All endpoints require API key authentication via `verify_api_key` dependency
- Response schemas in `backend/src/homelab_cmd/api/schemas/`
- Database queries use async SQLAlchemy with `get_async_session` dependency

**Frontend Components:**
- API client in `frontend/src/api/client.ts` with `api.get<T>()` pattern
- Types in `frontend/src/types/server.ts`
- Components use Tailwind CSS with custom theme colours
- Custom Gauge component already exists for circular visualisation

**Database:**
- Metrics model stores full data including cpu_percent, memory_percent, disk_percent
- Composite index `idx_metrics_server_timestamp` optimised for time-range queries
- Data pruned daily via `prune_old_metrics` job

## Recommended Approach

**Strategy:** Hybrid
**Rationale:** TDD for backend API (clear contract and aggregation logic), Test-After for frontend (visual components benefit from seeing rendered output).

### Test Priority

1. Backend: Metrics history endpoint returns correct structure
2. Backend: Aggregation logic produces correct averages
3. Frontend: Chart components render with mock data

### Documentation Updates Required

- [ ] Update TRD with new endpoint details (if not already documented)
- [ ] No README changes required

## Implementation Steps

### Phase 1: Backend - Metrics History API

**Goal:** Create `/api/v1/servers/{server_id}/metrics` endpoint that returns historical time-series data with appropriate aggregation.

#### Step 1.1: Create Response Schemas

- [ ] Create `backend/src/homelab_cmd/api/schemas/metrics.py`
- [ ] Define `MetricPoint` schema with timestamp and metric values
- [ ] Define `MetricsHistoryResponse` schema with server_id, range, data_points

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/metrics.py` - New schema file

**Schema structure:**
```python
class MetricPoint(BaseModel):
    timestamp: datetime
    cpu_percent: float | None
    memory_percent: float | None
    disk_percent: float | None

class MetricsHistoryResponse(BaseModel):
    server_id: str
    range: str  # "24h" | "7d" | "30d"
    resolution: str  # "1m" | "1h" | "4h"
    data_points: list[MetricPoint]
    total_points: int
```

#### Step 1.2: Create Metrics Route

- [ ] Create `backend/src/homelab_cmd/api/routes/metrics.py`
- [ ] Implement GET endpoint with `server_id` path param and `range` query param
- [ ] Query metrics within time range
- [ ] Apply aggregation for 7d and 30d ranges

**Files to create:**
- `backend/src/homelab_cmd/api/routes/metrics.py` - New route file

**Aggregation approach:**
- 24h: Return raw data points (no aggregation)
- 7d: Group by hour, calculate averages in Python
- 30d: Group by 4-hour periods, calculate averages in Python

**Considerations:**
- SQLite doesn't support `date_trunc()`, so aggregation done in Python
- Limit response to reasonable size (max ~1500 points)
- Handle server not found with 404

#### Step 1.3: Register Route

- [ ] Import metrics router in `backend/src/homelab_cmd/main.py`
- [ ] Add `app.include_router()` call

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add router registration

### Phase 2: Frontend - Types and API Client

**Goal:** Add TypeScript types and API function to fetch metrics history.

#### Step 2.1: Add TypeScript Types

- [ ] Add `TimeRange` type alias
- [ ] Add `MetricPoint` interface
- [ ] Add `MetricsHistoryResponse` interface

**Files to modify:**
- `frontend/src/types/server.ts` - Add new interfaces

#### Step 2.2: Add API Function

- [ ] Add `getMetricsHistory(serverId: string, range: TimeRange)` function
- [ ] Follow existing pattern from `getServer()`

**Files to modify:**
- `frontend/src/api/servers.ts` - Add new function

### Phase 3: Frontend - Install Recharts

**Goal:** Add Recharts dependency for charting.

#### Step 3.1: Install Dependency

- [ ] Add recharts to package.json
- [ ] Run npm install (handled during implementation)

**Files to modify:**
- `frontend/package.json` - Add recharts dependency

### Phase 4: Frontend - Chart Components

**Goal:** Create reusable chart components following brand guide colours.

#### Step 4.1: Create TimeRangeSelector Component

- [ ] Create component with 24h/7d/30d buttons
- [ ] Handle selection state
- [ ] Use ghost button styling per brand guide

**Files to create:**
- `frontend/src/components/TimeRangeSelector.tsx`

#### Step 4.2: Create MetricsChart Component

- [ ] Create line chart component using Recharts
- [ ] Support multiple metrics (cpu, memory, disk)
- [ ] Implement tooltip with formatted values
- [ ] Use brand colours (Terminal Cyan #22D3EE)
- [ ] Responsive container for different screen sizes

**Files to create:**
- `frontend/src/components/MetricsChart.tsx`

**Styling:**
- Line colour: #22D3EE (Terminal Cyan)
- Grid lines: #161B22 (Console Grey)
- Axis labels: #C9D1D9 (Soft White)
- Background: transparent (inherits from card)

### Phase 5: Integration

**Goal:** Add historical charts section to ServerDetail page.

#### Step 5.1: Integrate into ServerDetail

- [ ] Add state for timeRange and metricsHistory
- [ ] Add useEffect to fetch history when range changes
- [ ] Add "Historical Metrics" card section
- [ ] Include TimeRangeSelector and MetricsChart components
- [ ] Handle loading and error states

**Files to modify:**
- `frontend/src/pages/ServerDetail.tsx` - Add charts section

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met.

#### Step 6.1: Backend Unit Tests

- [ ] Test endpoint returns correct structure
- [ ] Test 24h range returns raw data
- [ ] Test 7d range returns hourly aggregates
- [ ] Test 30d range returns 4-hour aggregates
- [ ] Test server not found returns 404
- [ ] Test empty data returns empty array

**Files to create:**
- `tests/test_metrics_history.py` - New test file

#### Step 6.2: Frontend Component Tests

- [ ] Test MetricsChart renders with mock data
- [ ] Test TimeRangeSelector handles clicks
- [ ] Test API function calls correct endpoint

**Files to create:**
- `frontend/src/components/MetricsChart.test.tsx`
- `frontend/src/components/TimeRangeSelector.test.tsx`

#### Step 6.3: Manual Verification (MANDATORY)

- [ ] Rebuild Docker containers
- [ ] Load server detail page in browser
- [ ] Verify charts display with real data
- [ ] Test all three time ranges
- [ ] Verify tooltip shows correct values on hover
- [ ] Check chart colours match brand guide

#### Step 6.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Visual: Charts visible on server detail page | Pending |
| AC2 | Click each range button, verify chart updates | Pending |
| AC3 | Select 30d, verify chart renders smoothly | Pending |
| AC4 | Hover over chart, verify tooltip appears | Pending |
| AC5 | curl API endpoint, verify JSON structure | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| No historical data | Display "No data available for this period" message |
| Partial data (gaps) | Chart draws line segments, gaps visible as breaks |
| Server not found | Return 404 from API |
| Invalid range parameter | Return 400 with validation error |
| Very new server | Show available data, empty chart for missing periods |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large data payloads | Slow page load | Aggregation reduces points; max ~1500 |
| Recharts bundle size | Increased frontend size | Tree-shaking; only import needed components |
| SQLite aggregation limitations | Complex Python code | Keep aggregation logic simple and tested |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0006: Server Detail View | Story | Done |
| US0001: Database Schema | Story | Done |
| Recharts library | External | To be installed |

## Open Questions

- [x] Network I/O charts included? **No - deferred per story scope**
- [x] Load average charts included? **No - deferred per story scope**
- [x] Should history auto-refresh? **No - manual refresh only**

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors (`ruff check`, `npm run lint`)
- [ ] Documentation updated (if needed)
- [ ] Manual verification against running system completed
- [ ] Charts render in <500ms
- [ ] Data aggregation tested for 30-day range
- [ ] Chart colours match brand guide
- [ ] Recharts properly typed with TypeScript

## Notes

- The database already stores full metrics via heartbeat - only the API endpoint is new
- Composite index `idx_metrics_server_timestamp` already optimised for this query pattern
- Start with CPU/Memory/Disk charts only; load average and network I/O deferred
- Consider adding a loading skeleton while charts load for better UX
