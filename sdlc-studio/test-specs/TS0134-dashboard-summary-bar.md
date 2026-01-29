# TS0134: Dashboard Summary Bar

> **Status:** Complete
> **Story:** [US0134: Dashboard Summary Bar](../stories/US0134-dashboard-summary-bar.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for the Dashboard Summary Bar component. Verifies stat displays, count calculations, click-to-filter functionality, refresh behaviour, and conditional visibility based on fleet health.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0134](../stories/US0134-dashboard-summary-bar.md) | Dashboard Summary Bar | P1 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0134 | AC1 | Summary bar position | TC01, TC02 | Pending |
| US0134 | AC2 | Total machines count | TC03 | Pending |
| US0134 | AC3 | Online count | TC04, TC05 | Pending |
| US0134 | AC4 | Offline servers count | TC06, TC07 | Pending |
| US0134 | AC5 | Workstation status | TC08, TC09 | Pending |
| US0134 | AC6 | Click to filter | TC10, TC11, TC12 | Pending |
| US0134 | AC7 | Refresh button | TC13, TC14 | Pending |
| US0134 | AC8 | All healthy state | TC15, TC16 | Pending |

**Coverage:** 8/8 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Component rendering, count calculations, conditional logic |
| Integration | Yes | Dashboard integration, filter state management |
| E2E | No | Coverage via existing dashboard E2E tests |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js, Vitest, React Testing Library |
| External Services | None (uses mock data) |
| Test Data | Mock machine arrays with various statuses |

---

## Test Cases

### TC01: Summary bar renders at top of dashboard

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard renders with machines | Dashboard loaded |
| When | SummaryBar component mounts | Component present in DOM |
| Then | SummaryBar appears before MachineSection | Summary bar positioned above machine cards |

**Assertions:**
- [ ] SummaryBar has `data-testid="summary-bar"`
- [ ] SummaryBar renders before section headers in DOM order
- [ ] SummaryBar has full-width styling (`w-full` or equivalent)

---

### TC02: Summary bar has subtle background

**Type:** Unit | **Priority:** P1 | **Story:** US0134 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SummaryBar renders | Component visible |
| When | Inspecting styles | Background class applied |
| Then | Background is subtle (bg-bg-secondary/50 or similar) | Background visible but not prominent |

**Assertions:**
- [ ] SummaryBar container has background class
- [ ] SummaryBar has rounded corners
- [ ] SummaryBar has padding for content spacing

---

### TC03: Total machines count displays correctly

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 13 machines in the fleet | machines array with 13 items |
| When | SummaryBar renders | Stats calculated |
| Then | "Machines" stat shows "13" | Correct total displayed |

**Assertions:**
- [ ] Stat with label "Machines" exists
- [ ] Stat value shows "13" (machine count)
- [ ] Computer/Monitor icon displayed with stat

---

### TC04: Online count shows correct number with green styling

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 10 machines with status="online" | machines array with online machines |
| When | SummaryBar renders | Online count calculated |
| Then | "Online" stat shows "10" with green colour | Correct count and styling |

**Assertions:**
- [ ] Stat with label "Online" exists
- [ ] Stat value shows "10"
- [ ] Stat has green text colour class (text-status-success or text-green-*)
- [ ] CheckCircle icon displayed

---

### TC05: Online count includes both servers and workstations

**Type:** Unit | **Priority:** P1 | **Story:** US0134 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 8 online servers + 2 online workstations | Mixed machine types |
| When | SummaryBar renders | Total online calculated |
| Then | "Online" stat shows "10" | Both types counted |

**Assertions:**
- [ ] Online count is 10 (8 servers + 2 workstations)
- [ ] Machine type does not affect online counting

---

### TC06: Offline servers stat appears when servers are offline

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 1 server with status="offline" | Server offline |
| When | SummaryBar renders | Offline servers detected |
| Then | "Servers Offline" stat shows "1" with red styling | Alert displayed |

**Assertions:**
- [ ] Stat with label "Servers Offline" exists
- [ ] Stat value shows "1"
- [ ] Stat has red text colour class (text-status-error or text-red-*)
- [ ] AlertTriangle icon displayed
- [ ] Stat is clickable (has cursor-pointer or button role)

---

### TC07: Offline servers stat hidden when no servers offline

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC4, AC8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | All servers online | No offline servers |
| When | SummaryBar renders | Conditional render |
| Then | "Servers Offline" stat is not rendered | Stat absent from DOM |

**Assertions:**
- [ ] No element with label "Servers Offline" in document
- [ ] queryByTestId("stat-servers-offline") returns null

---

### TC08: Workstation status shows X/Y format

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 2 of 4 workstations online | Workstation array |
| When | SummaryBar renders | Workstation count calculated |
| Then | "Workstations" stat shows "2/4" | Fraction format displayed |

**Assertions:**
- [ ] Stat with label "Workstations" exists
- [ ] Stat value shows "2/4"
- [ ] Stat has neutral/blue colour (text-status-info or text-blue-*)
- [ ] Laptop icon displayed

---

### TC09: Workstation stat hidden when no workstations registered

**Type:** Unit | **Priority:** P1 | **Story:** US0134 AC5, Edge Case 4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Only servers, no workstations | Empty workstation array |
| When | SummaryBar renders | Conditional render |
| Then | "Workstations" stat is not rendered | Stat absent from DOM |

**Assertions:**
- [ ] No element with label "Workstations" in document
- [ ] queryByTestId("stat-workstations") returns null

---

### TC10: Clicking stat calls filter callback

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SummaryBar rendered with onFilter prop | onFilter callback provided |
| When | User clicks "Servers Offline" stat | Click event fires |
| Then | onFilter called with "offline-servers" | Callback invoked with filter value |

**Assertions:**
- [ ] onFilter callback called once
- [ ] onFilter called with "offline-servers" argument

---

### TC11: Click to filter updates URL (integration)

**Type:** Integration | **Priority:** P1 | **Story:** US0134 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard rendered with SummaryBar | Full dashboard context |
| When | User clicks "Online" stat | Filter activated |
| Then | URL updates with ?status=online param | URL query param set |

**Assertions:**
- [ ] URL contains "?status=online" or similar filter param
- [ ] Dashboard displays filtered machines

---

### TC12: Clear filter button appears when filtered

**Type:** Integration | **Priority:** P1 | **Story:** US0134 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Filter active via stat click | Dashboard filtered |
| When | Viewing dashboard | Clear option visible |
| Then | "Clear filter" button or link appears | User can reset filter |

**Assertions:**
- [ ] Clear filter control visible
- [ ] Clicking clear removes URL filter param

---

### TC13: Refresh button triggers data refresh

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SummaryBar rendered with onRefresh prop | onRefresh callback provided |
| When | User clicks "Refresh" button | Click event fires |
| Then | onRefresh callback called | Data refresh triggered |

**Assertions:**
- [ ] Refresh button has data-testid="refresh-button"
- [ ] onRefresh callback called once on click
- [ ] Button has RefreshCw icon

---

### TC14: Refresh button shows spinner during refresh

**Type:** Unit | **Priority:** P0 | **Story:** US0134 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | isRefreshing=true prop | Refresh in progress |
| When | SummaryBar renders | Loading state displayed |
| Then | RefreshCw icon has animate-spin class | Spinner visible |

**Assertions:**
- [ ] RefreshCw icon has `animate-spin` class when isRefreshing=true
- [ ] Refresh button is disabled during refresh
- [ ] Spinner not present when isRefreshing=false

---

### TC15: All healthy state shows success indicator

**Type:** Unit | **Priority:** P1 | **Story:** US0134 AC8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | All servers online | No offline servers |
| When | SummaryBar renders | Healthy state detected |
| Then | Success indicator visible (green checkmark or "All systems operational") | Health confirmation shown |

**Assertions:**
- [ ] Success indicator element present
- [ ] Indicator has green/success styling
- [ ] Text or icon communicates healthy status

---

### TC16: All healthy indicator hidden when servers offline

**Type:** Unit | **Priority:** P1 | **Story:** US0134 AC8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 1 server offline | Servers need attention |
| When | SummaryBar renders | Unhealthy state |
| Then | Success indicator not rendered | "Servers Offline" shown instead |

**Assertions:**
- [ ] Success indicator not in document
- [ ] "Servers Offline" stat visible instead

---

## Edge Case Tests

### TC17: No machines registered

**Type:** Unit | **Priority:** P2 | **Story:** Edge Case 1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Empty machines array | No machines |
| When | SummaryBar renders | Empty state |
| Then | Shows "0 Machines" with link to add | Helpful empty state |

**Assertions:**
- [ ] Machines count shows "0"
- [ ] Add machine link/button visible

---

### TC18: Workstations all offline shows non-error styling

**Type:** Unit | **Priority:** P2 | **Story:** Edge Case 7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 0 of 4 workstations online | All workstations offline |
| When | SummaryBar renders | Normal state (not error) |
| Then | Shows "0/4" with neutral styling (not red) | Expected behaviour acknowledged |

**Assertions:**
- [ ] Stat value shows "0/4"
- [ ] Stat does NOT have red/error styling
- [ ] Stat has neutral/blue colour

---

### TC19: Mobile responsiveness (US0133 AC8)

**Type:** Unit | **Priority:** P1 | **Story:** US0133 AC8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SummaryBar at mobile viewport (<768px) | Mobile view |
| When | Checking layout | Responsive styling |
| Then | Stats wrap or stack vertically | All info visible |

**Assertions:**
- [ ] SummaryBar has `flex-wrap` class
- [ ] No horizontal overflow on mobile
- [ ] All stats remain visible (not truncated)

---

## Fixtures

```yaml
fixtures:
  mixed_fleet:
    servers:
      - id: "server-1"
        hostname: "homeserver"
        status: "online"
        machine_type: "server"
      - id: "server-2"
        hostname: "mediaserver"
        status: "online"
        machine_type: "server"
      - id: "server-3"
        hostname: "cloudserver"
        status: "offline"
        machine_type: "server"
    workstations:
      - id: "ws-1"
        hostname: "study-pc"
        status: "online"
        machine_type: "workstation"
      - id: "ws-2"
        hostname: "laptop"
        status: "offline"
        machine_type: "workstation"

  all_healthy:
    servers:
      - id: "server-1"
        status: "online"
        machine_type: "server"
      - id: "server-2"
        status: "online"
        machine_type: "server"
    workstations:
      - id: "ws-1"
        status: "online"
        machine_type: "workstation"

  servers_only:
    servers:
      - id: "server-1"
        status: "online"
        machine_type: "server"
    workstations: []

  empty_fleet:
    servers: []
    workstations: []
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Summary bar renders at top | Done | SummaryBar.test.tsx |
| TC02 | Summary bar has subtle background | Done | SummaryBar.test.tsx |
| TC03 | Total machines count | Done | SummaryBar.test.tsx |
| TC04 | Online count with green styling | Done | SummaryBar.test.tsx |
| TC05 | Online count includes all types | Done | SummaryBar.test.tsx |
| TC06 | Offline servers stat appears | Done | SummaryBar.test.tsx |
| TC07 | Offline servers stat hidden when 0 | Done | SummaryBar.test.tsx |
| TC08 | Workstation X/Y format | Done | SummaryBar.test.tsx |
| TC09 | Workstation stat hidden when none | Done | SummaryBar.test.tsx |
| TC10 | Click stat calls filter callback | Done | SummaryBar.test.tsx |
| TC11 | Click to filter updates URL | Done | Dashboard integration |
| TC12 | Clear filter button appears | Done | DashboardFilters (existing) |
| TC13 | Refresh button triggers refresh | Done | SummaryBar.test.tsx |
| TC14 | Refresh button shows spinner | Done | SummaryBar.test.tsx |
| TC15 | All healthy success indicator | Done | SummaryBar.test.tsx |
| TC16 | Healthy indicator hidden when offline | Done | SummaryBar.test.tsx |
| TC17 | No machines registered | Done | SummaryBar.test.tsx |
| TC18 | Workstations all offline non-error | Done | SummaryBar.test.tsx |
| TC19 | Mobile responsiveness | Done | SummaryBar.test.tsx (flex-wrap)

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0134](../plans/PL0134-dashboard-summary-bar.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec with 19 test cases |
