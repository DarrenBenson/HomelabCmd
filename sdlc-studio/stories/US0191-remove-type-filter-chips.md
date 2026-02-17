# US0191: Remove Type Filter Chips

> **Status:** Done
> **Epic:** [EP0018: Dashboard UX Simplification](../epics/EP0018-dashboard-ux-simplification.md)
> **Owner:** Darren
> **Reviewer:** Claude
> **Created:** 2026-01-30

## User Story

**As a** Homelab Admin
**I want** fewer filter options on the dashboard
**So that** I can quickly find what I need without excessive choices

## Context

### Persona Reference
**Homelab Admin** - Technical user managing home infrastructure
[Full persona details](../personas.md#homelab-admin)

### Background
The DashboardFilters component had 8 filter chips: 5 status filters (All, Online, Offline, Warning, Paused) and 3 type filters (All Types, Servers, Workstations). User feedback confirmed type filters were rarely used because the MachineSection components already group servers and workstations separately.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Reduce filter count | Remove type filters |
| PRD | Accessibility | Keyboard navigation | Maintain filter chip focus |
| TRD | Tech Stack | TypeScript | Update type definitions |

---

## Acceptance Criteria

### AC1: Type Filters Removed from UI
- **Given** the dashboard filters are displayed
- **When** the page loads
- **Then** only status filter chips appear (All, Online, Offline, Warning, Paused)
- **And** no type filter chips appear (All Types, Servers, Workstations)

### AC2: TypeFilter Type Removed
- **Given** the DashboardFilters component
- **When** inspecting its interface
- **Then** no typeFilter or onTypeChange props exist

### AC3: URL Parameter Handling
- **Given** a URL with type parameter (e.g., /?type=server)
- **When** the dashboard loads
- **Then** the type parameter is ignored (no filtering by type)

### AC4: Clear Filters Updated
- **Given** filters are active
- **When** the user clicks "Clear filters"
- **Then** only search and status filters are cleared (no type to clear)

### AC5: hasActiveFilters Logic Updated
- **Given** the filter state
- **When** checking if filters are active
- **Then** only search query and status filter are considered (not type)

---

## Scope

### In Scope
- Remove type filter section from DashboardFilters.tsx
- Remove TypeFilter type export
- Remove typeFilter and onTypeChange props
- Update DashboardFilters.test.tsx to remove type filter tests
- Remove type filter state from Dashboard.tsx
- Update URL param handling in Dashboard.tsx

### Out of Scope
- Status filter modifications
- Search functionality changes
- MachineSection filtering logic

---

## Technical Notes

**Files:**
- `frontend/src/components/DashboardFilters.tsx`
- `frontend/src/components/DashboardFilters.test.tsx`
- `frontend/src/pages/Dashboard.tsx`

**Interface Change:**
```typescript
// Before
interface DashboardFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  typeFilter: TypeFilter;  // REMOVED
  onTypeChange: (type: TypeFilter) => void;  // REMOVED
  onClear: () => void;
  hasActiveFilters: boolean;
}

// After
interface DashboardFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}
```

### API Contracts
No API changes.

### Data Requirements
No data changes.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Old bookmark with ?type=server | Type param ignored, shows all machines |
| User expects type filters | MachineSection grouping provides same functionality |

---

## Test Scenarios

- [x] TC01: Type filter chips not rendered
- [x] TC02: Status filter chips still rendered
- [x] TC03: Clear filters works without type filter
- [x] TC04: hasActiveFilters checks only search and status
- [x] TC05: DashboardFilters accepts updated props interface
- [x] TC06: Type filter tests removed from test suite

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| None | - | - | - |

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
