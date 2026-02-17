# US0189: Create FleetStatus Component

> **Status:** Done
> **Epic:** [EP0018: Dashboard UX Simplification](../epics/EP0018-dashboard-ux-simplification.md)
> **Owner:** Darren
> **Reviewer:** Claude
> **Created:** 2026-01-30

## User Story

**As a** Homelab Admin
**I want** a unified status display showing fleet health and alerts
**So that** I can see the overall status at a glance without redundant information

## Context

### Persona Reference
**Homelab Admin** - Technical user managing home infrastructure
[Full persona details](../personas.md#homelab-admin)

### Background
The dashboard previously had two separate components (AlertBanner and SummaryBar) displaying overlapping information. "All systems operational" appeared in both when healthy. This story creates a unified FleetStatus component that combines their functionality.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Reduce redundancy | Single unified component |
| PRD | Performance | <2s load time | Efficient rendering |
| PRD | Accessibility | WCAG 2.1 AA | ARIA labels on icons |

---

## Acceptance Criteria

### AC1: Healthy State Display
- **Given** no active alerts exist
- **When** the dashboard loads
- **Then** FleetStatus shows checkmark icon with "All Systems Operational" text

### AC2: Alert State Display
- **Given** one or more active alerts exist
- **When** the dashboard loads
- **Then** FleetStatus shows warning icon with "{N} Active Alert(s)" and alert list

### AC3: Stats Display
- **Given** servers are registered
- **When** the dashboard loads
- **Then** FleetStatus shows machine count, online count, and offline count (when > 0)

### AC4: Refresh Button
- **Given** FleetStatus is displayed
- **When** the user clicks the refresh button
- **Then** data refreshes and button shows spinner during refresh

### AC5: Alert Actions
- **Given** alerts are displayed in FleetStatus
- **When** the user clicks acknowledge on an alert
- **Then** the onAcknowledge callback is invoked with the alert ID

### AC6: Navigation Links
- **Given** FleetStatus is displayed
- **When** no alerts exist
- **Then** "View History" link navigates to /alerts
- **When** alerts exist
- **Then** "View All" link navigates to /alerts?status=open

---

## Scope

### In Scope
- FleetStatus component creation
- Healthy/alert state rendering
- Stats calculation (total, online, offline)
- Refresh button with loading state
- Alert card rendering (reuses AlertCard)
- View History/View All links

### Out of Scope
- Changes to AlertCard component
- Alert detail panel integration (handled by parent)

---

## Technical Notes

**File:** `frontend/src/components/FleetStatus.tsx`

**Props Interface:**
```typescript
interface FleetStatusProps {
  machines: readonly Server[];
  alerts: Alert[];
  onAcknowledge: (alertId: number) => void;
  onAlertSelect?: (alert: Alert) => void;
  acknowledgingIds: Set<number>;
  maxAlertDisplay?: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}
```

### API Contracts
No new API endpoints - uses existing data passed from Dashboard.

### Data Requirements
- Server[] for stats calculation
- Alert[] for alert display
- Existing AlertCard component for individual alerts

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Zero machines | Shows "0 Machines" in stats |
| Single machine | Shows "1 Machine" (singular) |
| Single alert | Shows "1 Active Alert" (singular) |
| More alerts than maxAlertDisplay | Shows "View All {N} Alerts" link |
| Offline count is 0 | Hides offline stat entirely |

---

## Test Scenarios

- [x] TC01: Renders with data-testid="fleet-status"
- [x] TC02: Shows "All Systems Operational" when no alerts
- [x] TC03: Shows checkmark icon in healthy state
- [x] TC04: Shows "View History" link when no alerts
- [x] TC05: Does not render alert list when no alerts
- [x] TC06: Shows alert count when alerts exist
- [x] TC07: Shows singular form for single alert
- [x] TC08: Shows warning icon when alerts exist
- [x] TC09: Shows "View All" link when alerts exist
- [x] TC10: Renders alert list when alerts exist
- [x] TC11: Limits displayed alerts to maxAlertDisplay
- [x] TC12: Shows total machine count
- [x] TC13: Shows online count
- [x] TC14: Shows offline count when > 0
- [x] TC15: Hides offline count when 0
- [x] TC16: Refresh button calls onRefresh
- [x] TC17: Shows spinner when refreshing
- [x] TC18: Refresh button disabled when refreshing
- [x] TC19: Passes acknowledgingIds to AlertCards
- [x] TC20: Calls onAcknowledge when alert acknowledge clicked
- [x] TC21: Calls onAlertSelect when alert card clicked
- [x] TC22: Icons have aria-hidden attribute

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| None | - | - | - |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| AlertCard component | Existing | Available |
| Server type | Existing | Available |
| Alert type | Existing | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-30 | Darren | Initial creation (retrofitted) |
| 2026-01-30 | Claude | Implementation complete |
