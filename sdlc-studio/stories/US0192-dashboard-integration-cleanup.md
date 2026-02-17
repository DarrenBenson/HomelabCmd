# US0192: Dashboard Integration and Cleanup

> **Status:** Done
> **Epic:** [EP0018: Dashboard UX Simplification](../epics/EP0018-dashboard-ux-simplification.md)
> **Owner:** Darren
> **Reviewer:** Claude
> **Created:** 2026-01-30

## User Story

**As a** Developer
**I want** the dashboard to use the new FleetStatus component and have old components removed
**So that** the codebase is clean and maintainable

## Context

### Persona Reference
**Developer** - Maintainer of the HomelabCmd codebase
[Full persona details](../personas.md#developer)

### Background
After creating FleetStatus and updating DashboardFilters, the Dashboard.tsx needs to be updated to use the new components and the old AlertBanner and SummaryBar components need to be deleted along with their tests.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Maintainability | Remove dead code | Delete unused files |
| PRD | Performance | Build size | Smaller bundle |
| TRD | Tech Stack | TypeScript | No type errors |

---

## Acceptance Criteria

### AC1: FleetStatus Replaces AlertBanner and SummaryBar
- **Given** the Dashboard component
- **When** rendering the main content area
- **Then** FleetStatus is rendered instead of AlertBanner and SummaryBar

### AC2: Old Components Deleted
- **Given** the components directory
- **When** checking for AlertBanner and SummaryBar
- **Then** the following files are deleted:
  - `AlertBanner.tsx`
  - `AlertBanner.test.tsx`
  - `SummaryBar.tsx`
  - `SummaryBar.test.tsx`

### AC3: Imports Updated
- **Given** the Dashboard.tsx file
- **When** inspecting imports
- **Then** FleetStatus is imported and AlertBanner/SummaryBar imports are removed

### AC4: Section Visibility Logic Updated
- **Given** the machine sections
- **When** filters are applied
- **Then** section visibility is determined by filtered results (not type filter)

### AC5: Unit Tests Pass
- **Given** the updated codebase
- **When** running unit tests
- **Then** all tests pass (302 tests for changed components)

### AC6: E2E Tests Updated
- **Given** E2E tests referencing old selectors
- **When** running E2E tests
- **Then** tests use new selectors (fleet-status, stat-machines)

### AC7: Build Succeeds
- **Given** the updated codebase
- **When** running `npm run build`
- **Then** build completes without errors

---

## Scope

### In Scope
- Replace AlertBanner + SummaryBar with FleetStatus in Dashboard.tsx
- Remove unused imports
- Delete AlertBanner.tsx, AlertBanner.test.tsx
- Delete SummaryBar.tsx, SummaryBar.test.tsx
- Update Dashboard.test.tsx for new selectors
- Update dashboard.spec.ts E2E tests
- Update visual.spec.ts E2E tests

### Out of Scope
- Changes to FleetStatus component (done in US0189)
- Changes to DashboardFilters (done in US0191)

---

## Technical Notes

**Files Modified:**
- `frontend/src/pages/Dashboard.tsx` - Replace components, remove imports
- `frontend/src/pages/Dashboard.test.tsx` - Update selectors
- `frontend/src/__tests__/pages/Dashboard.test.tsx` - Update selectors
- `frontend/e2e/dashboard.spec.ts` - Update selectors
- `frontend/e2e/visual.spec.ts` - Update selectors

**Files Deleted:**
- `frontend/src/components/AlertBanner.tsx`
- `frontend/src/components/AlertBanner.test.tsx`
- `frontend/src/components/SummaryBar.tsx`
- `frontend/src/components/SummaryBar.test.tsx`

### API Contracts
No API changes.

### Data Requirements
No data changes.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Missing FleetStatus import | TypeScript compilation error (caught by build) |
| Old test selectors | E2E test failures (updated in this story) |

---

## Test Scenarios

- [x] TC01: FleetStatus rendered in Dashboard
- [x] TC02: AlertBanner not rendered in Dashboard
- [x] TC03: SummaryBar not rendered in Dashboard
- [x] TC04: AlertBanner.tsx deleted
- [x] TC05: SummaryBar.tsx deleted
- [x] TC06: Unit tests pass (302 tests)
- [x] TC07: Build succeeds
- [x] TC08: Dashboard E2E tests use stat-machines selector
- [x] TC09: Visual E2E tests use FleetStatus selector

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0189 | Precedes | FleetStatus component exists | Done |
| US0190 | Precedes | Header changes complete | Done |
| US0191 | Precedes | Type filter removed | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

---

## Estimation

**Story Points:** 3
**Complexity:** Low

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-30 | Darren | Initial creation (retrofitted) |
| 2026-01-30 | Claude | Implementation complete |
