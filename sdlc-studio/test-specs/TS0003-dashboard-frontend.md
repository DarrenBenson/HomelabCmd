# TS0003: Dashboard Frontend Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Last Updated:** 2026-01-19

## Overview

Test specification for the Dashboard frontend including React component unit tests, API client tests, and Playwright E2E tests. This spec covers US0005 (Dashboard Server List) acceptance criteria with comprehensive coverage of loading states, error handling, grid layout, and brand compliance.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0005](../../stories/US0005-dashboard-server-list.md) | Dashboard Server List | High |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Dashboard component, API client, servers API module |
| Integration | No | Covered by E2E with mocked API |
| API | No | Backend API tests in TS0001/TS0002 |
| E2E | Yes | User flows, visual verification, performance |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, npm, Docker Compose (for E2E) |
| Unit Test Framework | Vitest + React Testing Library |
| E2E Test Framework | Playwright |
| Test Data | Mocked API responses |

---

## Test Cases

### TC001: Dashboard renders loading spinner

**Type:** Unit
**Priority:** High
**Story:** US0005
**Automated:** Yes (`frontend/src/pages/Dashboard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the Dashboard component mounts | Component rendered |
| 2 | When API request is in progress | Loading state active |
| 3 | Then loading spinner is visible | Loader2 spinner displayed |

#### Assertions

- [x] Loading spinner has `animate-spin` class
- [x] Spinner is centered on screen
- [x] Spinner uses `status-info` colour

---

### TC002: Dashboard renders error state with retry

**Type:** Unit
**Priority:** High
**Story:** US0005
**Automated:** Yes (`frontend/src/pages/Dashboard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API request fails | Error thrown |
| 2 | When no cached data exists | Error state shown |
| 3 | Then error message and retry button visible | User can retry |

#### Assertions

- [x] Error message displays the error text
- [x] Retry button is present and visible
- [x] AlertCircle icon is shown

---

### TC003: Dashboard renders empty state with guidance

**Type:** Unit
**Priority:** Medium
**Story:** US0005
**Automated:** Yes (`frontend/src/pages/Dashboard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API returns empty servers array | No servers |
| 2 | When component renders | Empty state shown |
| 3 | Then guidance text visible | "Deploy the agent..." |

#### Assertions

- [x] "No servers registered" heading visible
- [x] Guidance text includes "Deploy the agent"
- [x] ServerOff icon displayed

---

### TC004: Dashboard renders server grid (AC1)

**Type:** Unit
**Priority:** High
**Story:** US0005 AC1
**Automated:** Yes (`frontend/src/pages/Dashboard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API returns multiple servers | Servers data |
| 2 | When component renders | Server cards displayed |
| 3 | Then cards in responsive CSS grid | Grid layout applied |

#### Assertions

- [x] All server cards rendered
- [x] Grid has responsive breakpoints (1/2/3/4 columns)
- [x] Each server displays correctly

---

### TC005: Dashboard shows server count in header

**Type:** Unit
**Priority:** Medium
**Story:** US0005
**Automated:** Yes (`frontend/src/pages/Dashboard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given multiple servers loaded | Servers data |
| 2 | When component renders | Header visible |
| 3 | Then server count displayed | "X servers" text |

#### Assertions

- [x] Correct count displayed (e.g., "3 servers")
- [x] Singular form used for 1 server
- [x] Count uses monospace font

---

### TC006: Dashboard auto-refreshes every 30s

**Type:** Unit
**Priority:** High
**Story:** US0005
**Automated:** Yes (`frontend/src/pages/Dashboard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given component mounted | Polling starts |
| 2 | When 30 seconds pass | API called again |
| 3 | Then data refreshes | New data displayed |

#### Assertions

- [x] Initial API call made on mount
- [x] Subsequent calls at 30s intervals
- [x] Interval cleared on unmount

---

### TC007: API client includes authentication header

**Type:** Unit
**Priority:** High
**Story:** US0005
**Automated:** Yes (`frontend/src/api/client.test.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API client configured | Client ready |
| 2 | When making request | Headers included |
| 3 | Then X-API-Key header present | Authenticated |

#### Assertions

- [x] X-API-Key header included in request
- [x] Content-Type set to application/json
- [x] API key value from environment

---

### TC008: API client handles errors correctly

**Type:** Unit
**Priority:** High
**Story:** US0005
**Automated:** Yes (`frontend/src/api/client.test.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API returns error status | 4xx/5xx response |
| 2 | When response processed | Error thrown |
| 3 | Then ApiError with status | Error caught |

#### Assertions

- [x] ApiError thrown for non-ok responses
- [x] Status code preserved in error
- [x] Error message includes status

---

### TC009: Server grid visible without scrolling (E2E) (AC1)

**Type:** E2E
**Priority:** High
**Story:** US0005 AC1
**Automated:** Yes (`frontend/e2e/dashboard.spec.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given dashboard loads with servers | Page rendered |
| 2 | When checking card positions | Cards visible |
| 3 | Then all cards within viewport width | No horizontal scroll |

#### Assertions

- [x] Grid container uses CSS grid
- [x] Cards fit within viewport
- [x] Responsive breakpoints work

---

### TC010: Online LED pulsing green (E2E) (AC2)

**Type:** E2E
**Priority:** High
**Story:** US0005 AC2
**Automated:** Yes (`frontend/e2e/visual.spec.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given online server displayed | LED visible |
| 2 | When checking LED styles | Animation applied |
| 3 | Then LED pulses with green colour | Visual feedback |

#### Assertions

- [x] Uses Phosphor Green #4ADE80
- [x] Has animate-pulse-green class
- [x] Animation is active (not "none")

---

### TC011: Offline LED solid red (E2E) (AC3)

**Type:** E2E
**Priority:** High
**Story:** US0005 AC3
**Automated:** Yes (`frontend/e2e/dashboard.spec.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given offline server mocked | LED visible |
| 2 | When checking LED styles | Red colour |
| 3 | Then LED is solid (not pulsing) | Static display |

#### Assertions

- [x] Uses Red Alert #F87171
- [x] Has bg-status-error class
- [x] Does NOT have animate-pulse

---

### TC012: Metrics display formatted correctly (E2E) (AC4)

**Type:** E2E
**Priority:** High
**Story:** US0005 AC4
**Automated:** Yes (`frontend/e2e/dashboard.spec.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with metrics | Metrics data |
| 2 | When checking display format | Values visible |
| 3 | Then uptime shows "Xd Xh" format | Human readable |

#### Assertions

- [x] Uptime displays as "↑ 5d 2h" format
- [x] CPU/RAM/Disk show percentages
- [x] Values are rounded appropriately

---

### TC013: Page loads under 2 seconds (E2E) (AC5)

**Type:** E2E
**Priority:** High
**Story:** US0005 AC5
**Automated:** Yes (`frontend/e2e/dashboard.spec.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given fresh page load | Timer starts |
| 2 | When server cards visible | Load complete |
| 3 | Then total time < 2000ms | Performance met |

#### Assertions

- [x] Page navigation to content visible < 2s
- [x] API response time reasonable
- [x] No blocking operations

---

### TC014: Brand colours match spec (E2E) (AC6)

**Type:** E2E
**Priority:** Medium
**Story:** US0005 AC6
**Automated:** Yes (`frontend/e2e/visual.spec.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given dashboard rendered | Elements visible |
| 2 | When checking computed styles | Colours extracted |
| 3 | Then colours match brand guide | Compliance verified |

#### Assertions

- [x] Online LED: rgb(74, 222, 128) - #4ADE80
- [x] Offline LED: rgb(248, 113, 113) - #F87171
- [x] Header uses correct font family
- [x] Dark background applied

---

## Fixtures

```yaml
# Shared test data for this spec
servers:
  online_server:
    id: "server-1"
    hostname: "server-1.local"
    display_name: "Test Server 1"
    status: "online"
    latest_metrics:
      cpu_percent: 45.5
      memory_percent: 67.2
      disk_percent: 35.0
      uptime_seconds: 439200  # 5d 2h

  offline_server:
    id: "server-2"
    hostname: "server-2.local"
    display_name: "Offline Server"
    status: "offline"
    latest_metrics: null

  unknown_server:
    id: "server-3"
    hostname: "server-3.local"
    display_name: null
    status: "unknown"
    latest_metrics: null

mock_responses:
  success:
    servers: [online_server, offline_server, unknown_server]
    total: 3

  empty:
    servers: []
    total: 0

  error:
    status: 500
    body:
      detail: "Internal Server Error"
```

## Automation Status

| TC | Title | Status | Implementation | Tests |
|----|-------|--------|----------------|-------|
| TC001 | Dashboard renders loading spinner | Implemented | Dashboard.test.tsx | 2 |
| TC002 | Dashboard renders error state with retry | Implemented | Dashboard.test.tsx | 4 |
| TC003 | Dashboard renders empty state | Implemented | Dashboard.test.tsx | 3 |
| TC004 | Dashboard renders server grid (AC1) | Implemented | Dashboard.test.tsx | 3 |
| TC005 | Dashboard shows server count | Implemented | Dashboard.test.tsx | 2 |
| TC006 | Dashboard auto-refreshes every 30s | Implemented | Dashboard.test.tsx | 3 |
| TC007 | API client includes auth header | Implemented | client.test.ts | 2 |
| TC008 | API client handles errors | Implemented | client.test.ts | 4 |
| TC009 | Server grid visible (E2E) | Implemented | dashboard.spec.ts | 2 |
| TC010 | Online LED pulsing green (E2E) | Implemented | visual.spec.ts | 2 |
| TC011 | Offline LED solid red (E2E) | Implemented | dashboard.spec.ts | 2 |
| TC012 | Metrics display formatted (E2E) | Implemented | dashboard.spec.ts | 2 |
| TC013 | Page loads under 2s (E2E) | Implemented | dashboard.spec.ts | 2 |
| TC014 | Brand colours match (E2E) | Implemented | visual.spec.ts | 4 |

**Summary:**
- **Total Test Cases:** 14
- **Automated:** 14/14 (100%)
- **Unit Tests:** ~17 tests in Dashboard.test.tsx + 11 in client.test.ts + 6 in servers.test.ts
- **E2E Tests:** ~14 new tests across dashboard.spec.ts and visual.spec.ts

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |
| US0005 | [stories/US0005-dashboard-server-list.md](../../stories/US0005-dashboard-server-list.md) |

## AC Mapping

| AC | Requirement | Test Cases |
|----|-------------|------------|
| AC1 | All servers visible in grid | TC004, TC009 |
| AC2 | Pulsing green LED (online) | TC010 |
| AC3 | Solid red LED (offline) | TC011 |
| AC4 | Metrics display (CPU/RAM/Disk/Uptime) | TC012 |
| AC5 | Loads in <2 seconds | TC013 |
| AC6 | Brand guide compliance | TC014 |

## Lessons Learned

### E2E Mocking Blindspot

**Issue Discovered:** During testing, the dashboard showed "--" for uptime despite backend storing the value correctly. E2E tests with mocked API responses passed because mocks included `uptime_seconds`.

**Root Cause:** The backend's `LatestMetrics` Pydantic schema and response building code omitted `uptime_seconds`, even though the database stored it. E2E tests mocked the API response with all expected fields, so they couldn't detect this backend bug.

**Resolution:**
1. Added `uptime_seconds` to `LatestMetrics` schema in `backend/src/homelab_cmd/api/schemas/server.py`
2. Added `uptime_seconds` to response building in `backend/src/homelab_cmd/api/routes/servers.py`
3. Created `tests/test_api_response_schema.py` with API contract tests

**Prevention:** For full-stack features, always include backend API tests that:
- Create real data via one endpoint
- Retrieve via the endpoint being tested
- Assert all frontend-expected fields are present in the actual response

**Reference:** See Test Strategy > API Contract Testing for the full pattern.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial spec generation for US0005 coverage |
| 2026-01-18 | Claude | Added Lessons Learned section (uptime_seconds bug) |
| 2026-01-19 | Claude | Verified all 14 test cases automated - 319 unit tests + E2E tests passing |
