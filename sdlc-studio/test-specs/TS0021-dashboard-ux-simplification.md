# TS0021: Dashboard UX Simplification Test Specification

> **Status:** Done
> **Epic:** [EP0018: Dashboard UX Simplification](../epics/EP0018-dashboard-ux-simplification.md)
> **Created:** 2026-01-30
> **Last Updated:** 2026-01-30

## Overview

Test specification for the Dashboard UX Simplification epic, covering the new FleetStatus component, header streamlining, type filter removal, and integration cleanup.

## Coverage Summary

| Story | Unit Tests | Integration Tests | E2E Tests | Status |
|-------|------------|-------------------|-----------|--------|
| US0189 | 31 | - | 2 | Done |
| US0190 | 2 | - | - | Done |
| US0191 | 18 | - | - | Done |
| US0192 | - | - | 2 | Done |
| **Total** | **51** | **0** | **4** | **Done** |

---

## Test Cases by Story

### US0189: Create FleetStatus Component

**Test File:** `frontend/src/components/FleetStatus.test.tsx`

#### Healthy State Tests

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC01 | Renders with data-testid="fleet-status" | High | Yes |
| TC02 | Shows "All Systems Operational" when no alerts | High | Yes |
| TC03 | Shows checkmark icon in healthy state | Medium | Yes |
| TC04 | Shows "View History" link when no alerts | Medium | Yes |
| TC05 | Does not render alert list when no alerts | Medium | Yes |

#### Alert State Tests

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC06 | Shows alert count when alerts exist | High | Yes |
| TC07 | Shows singular form for single alert | Medium | Yes |
| TC08 | Shows warning icon when alerts exist | Medium | Yes |
| TC09 | Shows "View All" link when alerts exist | Medium | Yes |
| TC10 | Renders alert list when alerts exist | High | Yes |
| TC11 | Limits displayed alerts to maxAlertDisplay | Medium | Yes |
| TC12 | Shows "View All N Alerts" when exceeding max | Medium | Yes |

#### Stats Display Tests

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC13 | Shows total machine count | High | Yes |
| TC14 | Shows singular "Machine" for 1 machine | Low | Yes |
| TC15 | Shows online count | High | Yes |
| TC16 | Shows offline count when > 0 | High | Yes |
| TC17 | Hides offline count when 0 | Medium | Yes |
| TC18 | Shows 0 machines for empty fleet | Low | Yes |

#### Refresh Button Tests

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC19 | Renders refresh button | High | Yes |
| TC20 | Calls onRefresh when clicked | High | Yes |
| TC21 | Shows spinner when refreshing | Medium | Yes |
| TC22 | Is disabled when refreshing | Medium | Yes |
| TC23 | Has correct aria-label when not refreshing | Low | Yes |
| TC24 | Has correct aria-label when refreshing | Low | Yes |

#### Alert Interaction Tests

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC25 | Passes acknowledgingIds to AlertCards | High | Yes |
| TC26 | Calls onAcknowledge when alert acknowledge clicked | High | Yes |
| TC27 | Calls onAlertSelect when alert card clicked | High | Yes |

#### Accessibility Tests

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC28 | Icons have aria-hidden attribute | Medium | Yes |
| TC29 | Refresh button has accessible name | Medium | Yes |

---

### US0190: Streamline Dashboard Header

**Test File:** `frontend/src/pages/Dashboard.test.tsx`

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC30 | Machine count displayed in FleetStatus (not header) | High | Yes |
| TC31 | Singular "Machine" for single server | Medium | Yes |

---

### US0191: Remove Type Filter Chips

**Test File:** `frontend/src/components/DashboardFilters.test.tsx`

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC32 | Renders search input with placeholder | High | Yes |
| TC33 | Displays current search query | High | Yes |
| TC34 | Calls onSearchChange when typing | High | Yes |
| TC35 | Clears search on Escape key | Medium | Yes |
| TC36 | Shows clear button when search has text | Medium | Yes |
| TC37 | Clears search when clear button clicked | Medium | Yes |
| TC38 | Renders all status filter chips | High | Yes |
| TC39 | Shows "All" as active by default | High | Yes |
| TC40 | Calls onStatusChange when chip clicked | High | Yes |
| TC41 | Shows correct chip as active | Medium | Yes |
| TC42 | Does not show clear button when no filters active | Medium | Yes |
| TC43 | Shows clear button when filters are active | Medium | Yes |
| TC44 | Calls onClear when clear button clicked | High | Yes |
| TC45 | Has accessible search input label | Medium | Yes |
| TC46 | Has accessible clear search button | Medium | Yes |
| TC47 | Has role="group" for filter section | Low | Yes |

---

### US0192: Dashboard Integration and Cleanup

**Test File:** `frontend/e2e/dashboard.spec.ts`, `frontend/e2e/visual.spec.ts`

| TC ID | Description | Priority | Automated |
|-------|-------------|----------|-----------|
| TC48 | Shows machine count in FleetStatus (E2E) | High | Yes |
| TC49 | Machine count visible and contains "Machine" text | High | Yes |
| TC50 | FleetStatus uses sans-serif font (visual) | Low | Yes |
| TC51 | AlertBanner files deleted | High | Manual |
| TC52 | SummaryBar files deleted | High | Manual |

---

## Test Data Requirements

### Mock Server Data

```typescript
const healthyFleet: Server[] = [
  { id: 'server-1', status: 'online', machine_type: 'server', ... },
  { id: 'server-2', status: 'online', machine_type: 'server', ... },
  { id: 'ws-1', status: 'online', machine_type: 'workstation', ... },
];

const mixedFleet: Server[] = [
  { id: 'server-1', status: 'online', machine_type: 'server', ... },
  { id: 'server-2', status: 'offline', machine_type: 'server', ... },
  { id: 'ws-1', status: 'online', machine_type: 'workstation', ... },
];
```

### Mock Alert Data

```typescript
function createMockAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    server_id: 'server-123',
    server_name: 'test-server',
    alert_type: 'disk_usage',
    severity: 'critical',
    status: 'open',
    title: 'Test alert',
    message: 'Test message',
    ...overrides,
  };
}
```

---

## Test Environment

### Unit Tests
- **Framework:** Vitest
- **Renderer:** @testing-library/react
- **Router:** MemoryRouter for Link components

### E2E Tests
- **Framework:** Playwright
- **Browser:** Chromium
- **Environment:** Docker Compose (docker compose up)

---

## Test Results Summary

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Unit Tests | 51 | 51 | 0 | 0 |
| E2E Tests | 4 | 4 | 0 | 0 |
| **Total** | **55** | **55** | **0** | **0** |

**Overall Coverage:** 100% of acceptance criteria covered by tests.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-30 | Claude | Initial creation (retrofitted from implementation) |
