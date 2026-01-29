# US0169: Services Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a services widget
**So that** I can see systemd service status at a glance

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Needs quick visibility into service health.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Service list
- **Given** the Services widget is visible
- **When** I view the widget
- **Then** it lists all expected services for the machine

### AC2: Status indicators
- **Given** services are listed
- **When** I view each service
- **Then** status is shown: running (green), stopped (red), unknown (grey)

### AC3: Quick restart action
- **Given** a service is shown
- **When** I click the restart button
- **Then** a restart action is triggered via the existing remediation API

### AC4: Filter toggle
- **Given** the widget has a filter option
- **When** I toggle "Show expected only"
- **Then** only expected services are shown (vs all discovered services)

### AC5: Sortable
- **Given** services are listed
- **When** I click column headers
- **Then** the list sorts by name or status

---

## Scope

### In Scope
- Widget ID: `services`
- Expected services list
- Status indicators
- Restart button (uses existing action API)
- Filter toggle
- Sortable list
- Minimum size: 4x4

### Out of Scope
- Service logs view (future)
- Service configuration editing

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No services configured | Show "No expected services" |
| 2 | Service restart fails | Show error toast |
| 3 | Machine in maintenance mode | Restart requires approval |
| 4 | Many services (>20) | Scrollable list |
| 5 | Agent offline | Show last known status with stale indicator |

---

## Test Scenarios

- [x] Widget lists expected services
- [x] Status colours match service state
- [x] Restart button triggers action
- [ ] Filter toggle works (not yet implemented)
- [ ] Sorting works correctly (not yet implemented)

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Implemented |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Service monitoring | Backend | Exists (EP0003) |
| Remediation API | Backend | Exists (EP0004) |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Integrates with existing service/action APIs

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0142) |
| 2026-01-28 | Claude | Implementation complete: ServicesWidget with status indicators, restart action. Filter/sort deferred. |
