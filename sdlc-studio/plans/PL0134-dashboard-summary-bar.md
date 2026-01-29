# PL0134: Dashboard Summary Bar - Implementation Plan

> **Status:** Complete
> **Story:** [US0134: Dashboard Summary Bar](../stories/US0134-dashboard-summary-bar.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript

## Overview

Create a SummaryBar component that displays at-a-glance fleet health information at the top of the dashboard. The bar shows total machines, online count, offline servers (critical), and workstation status, with click-to-filter functionality and a refresh button.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Summary bar position | Bar appears at top of dashboard, spans full width, subtle background |
| AC2 | Total machines count | Shows total machines with computer icon |
| AC3 | Online count | Shows online count with green colour and check icon |
| AC4 | Offline servers count | Shows offline servers with red colour and alert icon (only when > 0) |
| AC5 | Workstation status | Shows X/Y format with neutral/blue colour |
| AC6 | Click to filter | Clicking stat filters dashboard, updates URL query param |
| AC7 | Refresh button | Refresh button fetches new data with loading spinner |
| AC8 | All healthy state | Hides "Servers Offline" when 0, shows success indicator |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 18
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices
- Avoid `any` types - use explicit types for props and state
- Explicit return types for exported functions
- Use discriminated unions for component state variations
- Readonly arrays for function arguments

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| React | /facebook/react | useState, useCallback for click handlers |
| lucide-react | - | Monitor, CheckCircle, AlertTriangle, Laptop, RefreshCw icons |

### Existing Patterns
- `DashboardFilters.tsx` - Similar filter component pattern
- `CostBadge.tsx` - Badge/stat display pattern
- `ConnectivityStatusBar.tsx` - Status bar pattern
- Dashboard.tsx already has `refreshData` callback and filter state via URL params

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI component with visual styling, uses existing data, low complexity. Easier to iterate on visual design first, then add tests.

### Test Priority
1. Stat count calculations (unit tests)
2. Click-to-filter functionality (integration tests)
3. Conditional visibility (offline servers hidden when 0)

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create SummaryBar component with props interface | `SummaryBar.tsx` | - | [ ] |
| 2 | Implement Stat sub-component | `SummaryBar.tsx` | 1 | [ ] |
| 3 | Add count calculations for all stats | `SummaryBar.tsx` | 2 | [ ] |
| 4 | Add click handlers with filter callback | `SummaryBar.tsx` | 3 | [ ] |
| 5 | Add refresh button with loading state | `SummaryBar.tsx` | 4 | [ ] |
| 6 | Add conditional "All healthy" indicator | `SummaryBar.tsx` | 3 | [ ] |
| 7 | Integrate SummaryBar into Dashboard.tsx | `Dashboard.tsx` | 5 | [ ] |
| 8 | Wire up filter state to URL params | `Dashboard.tsx` | 7 | [ ] |
| 9 | Write unit tests for SummaryBar | `SummaryBar.test.tsx` | 6 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2, 3 | None - core component structure |
| B | 4, 5, 6 | Group A - interactive features |
| C | 7, 8 | Group B - integration |
| D | 9 | Group C - tests |

---

## Implementation Phases

### Phase 1: SummaryBar Component Structure
**Goal:** Create the basic SummaryBar component with stat display

- [ ] Create `SummaryBar.tsx` with props interface
- [ ] Implement `Stat` sub-component with icon, label, value props
- [ ] Add count calculations (total, online, offline servers, workstations)
- [ ] Style with Tailwind: flex, gap, padding, rounded, bg-bg-secondary/50

**Files:** `frontend/src/components/SummaryBar.tsx` - New component

### Phase 2: Interactive Features
**Goal:** Add click-to-filter and refresh functionality

- [ ] Add `onClick` prop to Stat component
- [ ] Implement filter callbacks for each clickable stat
- [ ] Add RefreshCw button with `isRefreshing` prop for spinner
- [ ] Add "All healthy" indicator when offline servers = 0

**Files:** `frontend/src/components/SummaryBar.tsx` - Add handlers

### Phase 3: Dashboard Integration
**Goal:** Integrate SummaryBar into Dashboard and wire up filters

- [ ] Import and render SummaryBar in Dashboard.tsx
- [ ] Pass machines, onFilter, onRefresh, isRefreshing props
- [ ] Wire filter callback to update URL search params
- [ ] Add "Clear filter" button when filter active

**Files:** `frontend/src/pages/Dashboard.tsx` - Integration

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Visual inspection + test | `SummaryBar.test.tsx` | Pending |
| AC2 | Unit test count calculation | `SummaryBar.test.tsx` | Pending |
| AC3 | Unit test online count + class check | `SummaryBar.test.tsx` | Pending |
| AC4 | Unit test offline servers conditional render | `SummaryBar.test.tsx` | Pending |
| AC5 | Unit test workstation X/Y format | `SummaryBar.test.tsx` | Pending |
| AC6 | Integration test click handler | `SummaryBar.test.tsx` | Pending |
| AC7 | Unit test refresh button and spinner | `SummaryBar.test.tsx` | Pending |
| AC8 | Unit test "all healthy" indicator | `SummaryBar.test.tsx` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | No machines registered | Show "0 Machines" with link to add first | 2 |
| 2 | All machines online | Hide "Servers Offline", show success indicator | 2 |
| 3 | All servers offline | "Servers Offline" shows with high prominence | 2 |
| 4 | No workstations | Hide workstations stat entirely | 2 |
| 5 | Refresh fails | Show error toast, keep existing counts | 3 |
| 6 | Click stat while filtered | Clears existing filter, applies new one | 3 |
| 7 | 0 workstations online | Show "0/4" (not highlighted as error) | 2 |
| 8 | Very long refresh time (>5s) | Show loading state, allow cancel | 2 |

**Coverage:** 8/8 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Filter state conflicts with existing DashboardFilters | Medium | Integrate with existing URL param system |
| Mobile responsiveness (AC8 from US0133) | Low | Use flex-wrap, test at mobile breakpoints |
| Stat clicks interfering with drag-drop | Low | Summary bar outside DndContext |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] US0133 AC8 responsiveness verified on mobile

---

## Notes

- SummaryBar uses existing machine data from Dashboard - no new API calls needed
- Filter integration uses existing URL param system from US0112
- Refresh button calls existing `refreshData()` in Dashboard
- Mobile responsiveness from US0133 AC8 should be verified during implementation
