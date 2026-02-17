# US0190: Streamline Dashboard Header

> **Status:** Done
> **Epic:** [EP0018: Dashboard UX Simplification](../epics/EP0018-dashboard-ux-simplification.md)
> **Owner:** Darren
> **Reviewer:** Claude
> **Created:** 2026-01-30

## User Story

**As a** Homelab Admin
**I want** a cleaner dashboard header with less visual clutter
**So that** I can focus on important actions without distracting redundant information

## Context

### Persona Reference
**Homelab Admin** - Technical user managing home infrastructure
[Full persona details](../personas.md#homelab-admin)

### Background
The dashboard header contained redundant information (server count) that was also displayed in the FleetStatus component. Additionally, the navigation icons were spaced apart without clear visual grouping from action buttons.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Reduce header elements | Remove server count |
| PRD | Accessibility | Keyboard navigation | Maintain focus order |
| TRD | Tech Stack | Tailwind CSS | Use utility classes |

---

## Acceptance Criteria

### AC1: Remove Server Count
- **Given** the dashboard header is displayed
- **When** servers are registered
- **Then** no server count text (e.g., "4 servers") appears in the header

### AC2: Visual Separator
- **Given** the dashboard header is displayed
- **When** viewing the action buttons and navigation icons
- **Then** a vertical separator line divides the "Add Server" button from navigation icons

### AC3: Tightened Navigation Spacing
- **Given** the navigation icons are displayed
- **When** viewing the icon group
- **Then** icons have gap-2 spacing (reduced from gap-4)

### AC4: Maintained Elements
- **Given** the dashboard header is displayed
- **When** the page loads
- **Then** the following elements remain: HomelabCmd logo, ConnectivityStatusBar, CostBadge, Add Server button, and all 5 navigation icons (Scans, Discovery, Actions, Config, Settings)

---

## Scope

### In Scope
- Remove server count span from header
- Add vertical divider between Add Server and nav icons
- Group nav icons in container with gap-2
- Verify all existing elements remain functional

### Out of Scope
- Changes to navigation icon functionality
- Mobile header layout changes
- Logo modifications

---

## Technical Notes

**File:** `frontend/src/pages/Dashboard.tsx` (lines ~860-928)

**Changes:**
1. Remove `<span>` with server count text
2. Add `<div className="w-px h-6 bg-border-default">` separator
3. Wrap nav icons in `<div className="flex items-center gap-2">`

### API Contracts
No API changes.

### Data Requirements
No new data requirements.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No servers registered | Header displays without server count (same as with servers) |
| Mobile viewport | Responsive layout maintained |

---

## Test Scenarios

- [x] TC01: Server count text not present in header
- [x] TC02: Visual separator visible between actions and nav
- [x] TC03: Navigation icons have tighter spacing
- [x] TC04: All nav icons present (Scans, Discovery, Actions, Config, Settings)
- [x] TC05: Add Server button functional
- [x] TC06: ConnectivityStatusBar visible
- [x] TC07: CostBadge visible

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0189 | Precedes | FleetStatus displays machine count | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

---

## Estimation

**Story Points:** 2
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
