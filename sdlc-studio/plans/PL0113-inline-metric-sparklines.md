# PL0113: Inline Metric Sparklines - Implementation Plan

> **Status:** Draft
> **Story:** [US0113: Inline Metric Sparklines](../stories/US0113-inline-metric-sparklines.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Add inline CPU, RAM, and Disk sparkline charts to server cards on the dashboard. Sparklines show the 30-minute trend with colour coding to indicate whether usage is increasing (red/amber), stable (grey), or decreasing (green). This allows operators to spot trending issues without clicking into detail pages.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Backend sparkline endpoint | GET /api/v1/servers/{id}/metrics/sparkline returns ~30 points for 30m |
| AC2 | CPU/RAM/Disk sparklines on card | 60x20px sparklines showing trends on ServerCard |
| AC3 | Sparkline tooltip | Hover shows value and timestamp at that point |
| AC4 | Trend colour coding | Green=down, Grey=stable, Red/amber=up based on trend |
| AC5 | Handle missing data | Show placeholder for insufficient data (<5 points) |
| AC6 | Efficient batch fetch | Parallel requests for multiple servers, progressive render |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (Backend), TypeScript (Frontend)
- **Framework:** FastAPI (Backend), React 19 + Recharts 3.6 (Frontend)
- **Test Framework:** pytest (Backend), Vitest (Frontend)

### Relevant Best Practices
- Backend: Use Pydantic schemas for API contracts
- Frontend: Use custom hooks for data fetching
- Both: Type-safe interfaces between layers

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| Recharts | /recharts/recharts | LineChart with ResponsiveContainer, Tooltip |
| FastAPI | /tiangolo/fastapi | Query parameters, Path parameters |

### Existing Patterns

- **Backend metrics:** `GET /api/v1/servers/{server_id}/metrics` returns MetricsHistoryResponse
- **Frontend charts:** MetricsChart.tsx uses Recharts LineChart with custom tooltip
- **API client:** `api.get<T>()` pattern in frontend/src/api/client.ts
- **Metrics storage:** Raw metrics in Metrics table with idx_metrics_server_timestamp index

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story with visual components. Backend has clear API contract suitable for testing. Frontend sparkline requires visual validation to ensure readability at small size.

### Test Priority
1. Backend sparkline endpoint returns correct data structure
2. Backend handles missing/empty metrics gracefully
3. Frontend component renders without errors for all states

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add SparklinePoint and SparklineResponse schemas | `schemas/metrics.py` | - | [ ] |
| 2 | Add sparkline endpoint to metrics router | `routes/metrics.py` | 1 | [ ] |
| 3 | Create frontend API client for sparkline | `api/metrics.ts` | 2 | [ ] |
| 4 | Create MetricSparkline component | `components/MetricSparkline.tsx` | 3 | [ ] |
| 5 | Integrate sparkline into ServerCard | `components/ServerCard.tsx` | 4 | [ ] |
| 6 | Add backend tests | `tests/test_api_metrics.py` | 2 | [ ] |
| 7 | Add frontend tests | `components/MetricSparkline.test.tsx` | 4 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2 | None (backend) |
| B | 3, 4, 5 | Group A complete |
| C | 6, 7 | Groups A, B complete |

---

## Implementation Phases

### Phase 1: Backend Sparkline Endpoint
**Goal:** Create API endpoint returning sparkline data

- [ ] Add SparklinePoint schema (timestamp, value)
- [ ] Add SparklineResponse schema (server_id, metric, period, data)
- [ ] Add GET /api/v1/servers/{server_id}/metrics/sparkline endpoint
- [ ] Query Metrics table for last 30 minutes
- [ ] Downsample to ~30 points using step sampling
- [ ] Handle 404 for unknown server

**Files:**
- `backend/src/homelab_cmd/api/schemas/metrics.py` - Add schemas
- `backend/src/homelab_cmd/api/routes/metrics.py` - Add endpoint

### Phase 2: Frontend API Client
**Goal:** Create typed API client for fetching sparkline data

- [ ] Create frontend/src/api/metrics.ts
- [ ] Define SparklinePoint and SparklineResponse types
- [ ] Add getSparklineData(serverId, metric?) function
- [ ] Handle API errors gracefully

**Files:**
- `frontend/src/api/metrics.ts` - New file

### Phase 3: MetricSparkline Component
**Goal:** Create sparkline React component with trend colouring

- [ ] Create MetricSparkline.tsx component
- [ ] Use Recharts LineChart with 60x20px dimensions
- [ ] Calculate trend from data points
- [ ] Apply colour based on trend (green/grey/amber)
- [ ] Add custom tooltip showing value and formatted time
- [ ] Handle loading state with skeleton
- [ ] Handle error state with dash icon
- [ ] Handle insufficient data with "No trend" text

**Files:**
- `frontend/src/components/MetricSparkline.tsx` - New file

### Phase 4: ServerCard Integration
**Goal:** Display sparkline on server cards

- [ ] Import MetricSparkline in ServerCard
- [ ] Add sparkline below CPU metric
- [ ] Pass server.id to component
- [ ] Ensure sparkline loads without blocking card

**Files:**
- `frontend/src/components/ServerCard.tsx` - Modify

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Backend test + curl | `routes/metrics.py` | Pending |
| AC2 | Visual inspection | `MetricSparkline.tsx` | Pending |
| AC3 | Manual hover test | `MetricSparkline.tsx` | Pending |
| AC4 | Visual + unit test | `MetricSparkline.tsx` | Pending |
| AC5 | Unit test | `MetricSparkline.test.tsx` | Pending |
| AC6 | DevTools Network tab | `ServerCard.tsx` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Server has no metrics | Return empty data array; component shows "No trend" text | 1, 3 |
| 2 | Server has <5 data points | Component shows flat grey line with "Insufficient data" | 3 |
| 3 | Metric values all identical | Trend calculation returns 0 → grey line (stable) | 3 |
| 4 | API request fails | Component catches error, shows dash "-" icon | 3 |
| 5 | Server offline (no recent metrics) | API returns available data; component shows greyed styling | 3 |
| 6 | Very high variance (0-100% swings) | Set Recharts Y-axis domain to [0, 100] | 3 |
| 7 | 50+ servers on dashboard | Parallel fetches; progressive render; lazy load if needed | 3, 4 |
| 8 | Negative trend calculation | Clamp trend percentage to [-100, 100] range | 3 |

**Coverage:** 8/8 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with many servers | Slow dashboard load | Parallel fetches, lazy loading if needed |
| Sparkline too small to read | Poor UX | Test at 60x20px, can adjust size |
| Metric data gaps | Broken lines | Use connectNulls prop in Recharts |
| API rate limiting | Failed requests | Stagger requests if needed |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)

---

## Notes

- Recharts already in use in MetricsChart.tsx - reuse same patterns
- Existing colour palette: CPU=#22D3EE (cyan), but using trend colours here
- Consider adding memory/disk sparklines in future (out of scope for this story)
