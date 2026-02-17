# EP0018: Dashboard UX Simplification

> **Status:** Done
> **Owner:** Darren
> **Reviewer:** Claude
> **Created:** 2026-01-30
> **Target Release:** Phase 2 (Beta)

## Summary

Redesign the HomelabCmd dashboard to reduce clutter, eliminate redundancy, and improve visual hierarchy while keeping all frequently-used features accessible. Merges AlertBanner and SummaryBar into unified FleetStatus component, removes rarely-used type filters, and streamlines the header layout.

## Inherited Constraints

> See PRD and TRD for full constraint details. Key constraints for this epic:

| Source | Type | Constraint | Impact |
|--------|------|------------|--------|
| PRD | Performance | Dashboard loads in <2s | FleetStatus must render efficiently |
| PRD | Security | API key authentication | No changes to auth model |
| TRD | Architecture | React/TypeScript frontend | Component-based refactoring |
| TRD | Tech Stack | Tailwind CSS styling | Consistent visual design |

---

## Business Context

### Problem Statement

The dashboard has accumulated redundant information displays and excessive filter options that create visual clutter:
1. "All systems operational" shown in both AlertBanner AND SummaryBar
2. Server/machine counts repeated in header, summary bar, and section headers
3. 8 filter chips when type filters are rarely used (sections already group by type)
4. 8+ interactive elements in header competing for attention

**PRD Reference:** [Dashboard Overview](../prd.md#dashboard-overview)

### Value Proposition

A cleaner, more focused dashboard improves user experience by:
- Reducing cognitive load with unified status display
- Eliminating redundant information
- Maintaining quick access to frequently-used navigation
- Improving visual hierarchy to highlight what matters

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Header elements | 8+ | 6 | Count interactive elements |
| Filter chips | 8 | 5 | Count visible filter chips |
| Status components | 2 | 1 | AlertBanner + SummaryBar → FleetStatus |
| Lines of code | ~300 | ~200 | Combined component LOC |

---

## Scope

### In Scope
- Merge AlertBanner and SummaryBar into unified FleetStatus component
- Remove type filter chips (All Types, Servers, Workstations)
- Remove redundant server count from header
- Add visual separator between action buttons and navigation icons
- Tighten navigation icon spacing
- Update all related tests

### Out of Scope
- Mobile-specific layout changes
- Changes to server cards or MachineSection components
- Alert detail panel modifications
- Navigation icon additions or removals

### Affected Personas
- **Homelab Admin:** Primary dashboard user, benefits from cleaner interface
- **Casual User:** Occasional viewer, easier to parse status at a glance

---

## Acceptance Criteria (Epic Level)

- [x] FleetStatus component displays unified health status and stats
- [x] Type filter chips removed from DashboardFilters
- [x] Header shows visual separator between actions and navigation
- [x] All unit tests pass (302 tests)
- [x] E2E tests updated for new selectors
- [x] Application builds without errors

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
|------------|------|--------|-------|
| EP0011 Advanced Dashboard UI | Epic | Done | Darren |
| EP0017 Desktop UX Improvements | Epic | Done | Darren |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | - |

---

## Risks & Assumptions

### Assumptions
- Users rarely use type filters (confirmed by user feedback)
- Sections provide adequate type grouping
- Status filters remain frequently used

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users miss type filters | Low | Low | Sections already group by type; search works across all |
| Mobile layout issues | Low | Medium | Tested at all breakpoints |
| Accessibility regression | Low | High | Preserved ARIA attributes, keyboard navigation |

---

## Technical Considerations

### Architecture Impact

Minor refactoring of frontend components:
- New FleetStatus component (~200 LOC)
- Removed AlertBanner.tsx, SummaryBar.tsx
- Simplified DashboardFilters.tsx (removed type filter)
- Dashboard.tsx streamlined (removed type filter state)

### Integration Points

- FleetStatus uses existing AlertCard component
- Stats derived from Server[] array (same as SummaryBar)
- Alert handling unchanged (onAcknowledge, onAlertSelect)

---

## Sizing

**Story Points:** 13
**Estimated Story Count:** 4

**Complexity Factors:**
- Component consolidation (medium)
- Test updates (medium)
- Visual design alignment (low)

---

## Story Breakdown

- [x] [US0189: Create FleetStatus Component](../stories/US0189-create-fleet-status-component.md)
- [x] [US0190: Streamline Dashboard Header](../stories/US0190-streamline-dashboard-header.md)
- [x] [US0191: Remove Type Filter Chips](../stories/US0191-remove-type-filter-chips.md)
- [x] [US0192: Dashboard Integration and Cleanup](../stories/US0192-dashboard-integration-cleanup.md)

---

## Test Plan

**Test Spec:** [TS0021: Dashboard UX Simplification](../test-specs/TS0021-dashboard-ux-simplification.md)

---

## Open Questions

None - all implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-30 | Darren | Initial creation (retrofitted from implementation) |
| 2026-01-30 | Claude | Implementation complete, all stories Done |
