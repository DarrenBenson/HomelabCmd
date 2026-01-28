# US0015: Dashboard Alert Display

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to see active alerts on the main dashboard
**So that** I'm immediately aware of issues when checking the fleet

## Context

### Persona Reference

**Darren** - Does a daily 2-5 minute check of fleet health. Needs alerts front and centre, not hidden in a separate page.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The dashboard should prominently display active alerts at the top. Critical alerts get most attention with prominent styling. Users can acknowledge or view details directly from the dashboard. The alert banner counts as part of the "at a glance" experience.

## Acceptance Criteria

### AC1: Alert banner shows active alert count

- **Given** 3 open alerts exist
- **When** viewing the dashboard
- **Then** an alert banner shows "3 Active Alerts"

### AC2: Critical alerts displayed prominently

- **Given** a critical alert exists
- **When** viewing the dashboard
- **Then** it's displayed with red styling and at the top of the list

### AC3: Alert cards show key info

- **Given** an alert is displayed
- **When** viewing the alert card
- **Then** server name, alert type, severity, and time are visible

### AC4: Can acknowledge from dashboard

- **Given** an open alert is displayed
- **When** clicking the acknowledge button
- **Then** the alert status updates without page reload

### AC5: No alerts shows clean state

- **Given** no active alerts exist
- **When** viewing the dashboard
- **Then** a "No active alerts" message with green checkmark is displayed

### AC6: Brand guide compliance

- **Given** alerts are displayed
- **When** inspecting visual elements
- **Then** colours match brand guide (red for critical, amber for high)

## Scope

### In Scope

- Alert banner/summary section on dashboard
- Alert card component
- Acknowledge button on alert cards
- Real-time update after acknowledge
- Empty state when no alerts
- Sorting (critical first)
- Link to full alert list

### Out of Scope

- Alert detail modal (link to list view)
- Resolve action (only in detail view)
- Alert configuration
- Alert filtering on dashboard (show all active)

## UI/UX Requirements

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HOME-LAB-HUB                                                     [?]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️  3 Active Alerts                              [View All →]   │   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │ 🔴 CRITICAL  Disk usage at 92%              [✓ Ack]    │     │   │
│  │  │    omv-mediaserver • 5 minutes ago                     │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │ 🟠 HIGH  RAM usage at 87%                   [✓ Ack]    │     │   │
│  │  │    omv-aiserver1 • 12 minutes ago                      │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │ 🔴 CRITICAL  Server offline                 [✓ Ack]    │     │   │
│  │  │    pihole-backup • 23 minutes ago                      │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Server grid from US0005...]                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### No Alerts State

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ✅ All Systems Operational                      [View History →] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Alert Card Component

- Background: Console Grey (#161B22)
- Border-left: 4px solid, colour based on severity
  - Critical: Red Alert (#F87171)
  - High: Amber Alert (#FBBF24)
  - Medium: Terminal Cyan (#22D3EE)
  - Low: Soft White (#C9D1D9)
- Severity badge: Matching colour, uppercase text
- Server name: Space Grotesk, 14px
- Time: Relative (e.g., "5 minutes ago"), Soft White
- Acknowledge button: Ghost button, checkmark icon

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for complete specifications.

## Technical Notes

### API Contracts

Uses existing endpoints from US0014:

- GET /api/v1/alerts?status=open (for active alerts)
- POST /api/v1/alerts/{id}/acknowledge

### Data Requirements

- Fetch active alerts on dashboard load
- Refresh with server list (every 30s)
- Maximum 5 alerts shown on dashboard (link to view all)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Many active alerts (>5) | Show 5 + "View all X alerts" link |
| Alert acknowledged while viewing | Update UI optimistically |
| Acknowledge fails | Show error toast, revert UI |
| API error fetching alerts | Show cached data with warning |
| Alert auto-resolves while viewing | Remove from list on next refresh |

## Test Scenarios

- [ ] Alert banner shows correct count
- [ ] Alerts sorted by severity (critical first)
- [ ] Alert cards display all required info
- [ ] Acknowledge button updates alert status
- [ ] UI updates after acknowledge
- [ ] Empty state displays when no alerts
- [ ] View All link navigates to alert list
- [ ] Severity colours match brand guide
- [ ] Maximum 5 alerts shown

## Definition of Done


**Story-specific additions:**

- [ ] Alert severity colours match brand guide
- [ ] Acknowledge provides instant feedback
- [ ] Empty state is visually pleasing

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0005: Dashboard Server List | Story | Draft |
| US0014: Alert API | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - UI component with state management

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
