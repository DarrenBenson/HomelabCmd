# PL0020: Alert List and Detail Views - Implementation Plan

> **Status:** Complete
> **Story:** [US0016: Alert List and Detail Views](../stories/US0016-alert-list-view.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Language:** TypeScript

## Overview

Implement a dedicated alerts page with full filtering, pagination, and detail view capabilities. Users can view all alerts (active and historical), filter by status/severity/server, and manage alerts through acknowledge and resolve actions. Filters are URL-persisted for shareable links.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Alert list displays | All alerts shown in table/list format |
| AC2 | Filter by status | Filter dropdown for open/acknowledged/resolved |
| AC3 | Filter by severity | Filter dropdown for critical/high/medium/low |
| AC4 | Alert detail view | Click row opens detail panel with full info |
| AC5 | Acknowledge from list | Acknowledge button updates status inline |
| AC6 | Resolve from detail | Resolve button in detail view updates status |
| AC7 | Pagination works | Pagination controls for >50 alerts |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React with React Router v6
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

- Use `useSearchParams` hook for URL-persisted filter state
- Reset pagination to page 1 when filters change
- Optimistic UI updates with rollback on error
- Follow existing component patterns (AlertCard, AlertBanner)

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| React Router | /remix-run/react-router | useSearchParams for URL filters | `setSearchParams(prev => { prev.set("key", value); return prev })` |

### Existing Patterns

**API Client:** `src/api/client.ts` - Generic fetch wrapper with `api.get<T>(endpoint)`

**Alert Types:** `src/types/alert.ts` - AlertStatus, AlertSeverity, Alert, AlertsResponse interfaces

**Alert API:** `src/api/alerts.ts` - `getAlerts(status)`, `acknowledgeAlert(id)` functions exist

**Backend API (verified):**
- `GET /api/v1/alerts?status=&severity=&server_id=&limit=&offset=` - Full filter support
- `GET /api/v1/alerts/{id}` - Single alert details
- `POST /api/v1/alerts/{id}/acknowledge` - Acknowledge action
- `POST /api/v1/alerts/{id}/resolve` - Resolve action

**Routing:** `src/App.tsx` - React Router with `/`, `/servers/:serverId`, `/settings` routes

**Components:** AlertCard and AlertBanner exist with severity colour styling

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is primarily a UI feature with multiple interacting components. Building the UI first allows for better UX iteration, then comprehensive tests verify the behaviour.

### Test Priority

1. AlertsPage filter state synchronisation with URL
2. AlertDetailPanel acknowledge/resolve actions
3. Pagination boundary conditions

### Documentation Updates Required

- [ ] None required (UI feature only)

## Implementation Steps

### Phase 1: Extend Frontend API Layer

**Goal:** Add full filter support and resolve endpoint to API functions

#### Step 1.1: Extend Alert Types

- [x] Add `AlertFilters` interface for filter parameters
- [x] Add `AlertResolveResponse` interface

**Files to modify:**
- `frontend/src/types/alert.ts` - Add AlertFilters and resolve response types

**Considerations:**
Match backend parameter names exactly: status, severity, server_id, limit, offset

#### Step 1.2: Extend API Functions

- [x] Update `getAlerts()` to accept full filter object
- [x] Add `resolveAlert(alertId)` function
- [x] Add `getAlert(alertId)` function for single alert fetch

**Files to modify:**
- `frontend/src/api/alerts.ts` - Extend getAlerts, add resolveAlert and getAlert

### Phase 2: Create Core Components

**Goal:** Build the AlertsPage and supporting components

#### Step 2.1: Create AlertsPage Component

- [x] Create page with filter dropdowns (status, severity, server)
- [x] Sync filter state with URL using `useSearchParams`
- [x] Implement alert list with table layout
- [x] Add loading, error, and empty states
- [x] Wire acknowledge action (reuse pattern from Dashboard)

**Files to create:**
- `frontend/src/pages/AlertsPage.tsx` - Main alerts page component

**Considerations:**
- Reset to page 1 when filters change
- Use existing AlertCard styling patterns for severity colours
- Follow Dashboard pattern for optimistic acknowledge updates

#### Step 2.2: Create AlertDetailPanel Component

- [x] Create slide-out or modal panel for alert details
- [x] Display all alert fields (server, type, threshold, actual, timestamps)
- [x] Add Acknowledge button (if status is open)
- [x] Add Resolve button (if status is not resolved)
- [x] Handle action success/failure with appropriate feedback

**Files to create:**
- `frontend/src/components/AlertDetailPanel.tsx` - Alert detail view component

**Considerations:**
- Use same severity/status colour patterns as AlertCard
- Relative time with hover for absolute timestamp
- Disable buttons during action in progress

#### Step 2.3: Create Pagination Component

- [x] Create reusable pagination component
- [x] Display current page, total pages, total items
- [x] Previous/Next navigation buttons
- [x] Callback for page changes

**Files to create:**
- `frontend/src/components/Pagination.tsx` - Reusable pagination component

**Considerations:**
- Handle edge cases: first page (no prev), last page (no next)
- Calculate total pages from total items and page size

### Phase 3: Routing and Navigation

**Goal:** Integrate AlertsPage into the application

#### Step 3.1: Add Alerts Route

- [x] Add `/alerts` route to App.tsx
- [x] Import AlertsPage component

**Files to modify:**
- `frontend/src/App.tsx` - Add alerts route

#### Step 3.2: Wire AlertBanner Navigation

- [x] Update "View All" link to navigate to `/alerts?status=open`
- [x] Update "View History" link to navigate to `/alerts`
- [x] Use React Router Link component

**Files to modify:**
- `frontend/src/components/AlertBanner.tsx` - Wire navigation links

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: AlertsPage Unit Tests

- [x] Test filter dropdowns render and function
- [x] Test URL params sync (read and write)
- [x] Test loading, error, empty states
- [x] Test acknowledge action updates list
- [x] Test pagination controls

**Files to create:**
- `frontend/src/pages/AlertsPage.test.tsx` - AlertsPage tests

#### Step 4.2: AlertDetailPanel Unit Tests

- [x] Test detail panel displays all alert info
- [x] Test acknowledge button functionality
- [x] Test resolve button functionality
- [x] Test close panel action

**Files to create:**
- `frontend/src/components/AlertDetailPanel.test.tsx` - AlertDetailPanel tests

#### Step 4.3: Pagination Unit Tests

- [x] Test renders with correct info
- [x] Test first page (prev disabled)
- [x] Test last page (next disabled)
- [x] Test page navigation callbacks

**Files to create:**
- `frontend/src/components/Pagination.test.tsx` - Pagination tests

#### Step 4.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Navigate to /alerts, verify table displays | Pass |
| AC2 | Select "Open" filter, verify only open alerts shown | Pass |
| AC3 | Select "Critical" filter, verify only critical alerts shown | Pass |
| AC4 | Click alert row, verify detail panel opens | Pass |
| AC5 | Click acknowledge in list, verify status updates | Pass |
| AC6 | Click resolve in detail, verify status updates | Pass |
| AC7 | Create >50 alerts, verify pagination controls work | Pass |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| No alerts match filter | Show "No alerts found" message with reset filters link |
| API error fetching alerts | Show error state with retry button |
| Acknowledge/resolve fails | Show error toast, don't change UI state |
| Multiple filters combined | All filters applied together with AND logic |
| Empty server dropdown | Fetch servers on page load for dropdown options |
| Alert changes while viewing | Refresh on panel close or manual refresh button |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| URL params out of sync | Confusing UX | Use single source of truth (useSearchParams) |
| Large alert history | Slow loading | Pagination limits to 20 per page |
| Race conditions on actions | Inconsistent state | Disable buttons during action, track loading state |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0014: Alert API | Story | Done - All endpoints exist and verified |
| US0015: Dashboard Alerts | Story | Review - AlertBanner exists with navigation placeholders |
| React Router v6 | Library | Already installed, useSearchParams available |

## Open Questions

None - all technical questions resolved during planning.

## Definition of Done Checklist

- [x] All 7 acceptance criteria implemented
- [x] Unit tests written and passing
- [x] Edge cases handled
- [x] Code follows existing patterns
- [x] No linting errors
- [x] All severity colours match brand guide
- [x] Status colours match brand guide
- [x] Filters are URL-persisted (shareable links)
- [x] Ready for code review

## Notes

- Backend API already fully supports all required operations
- Reuse AlertCard severity colour patterns for consistency
- Consider adding server dropdown from servers API for filter
- Page size of 20 items matches story requirement
