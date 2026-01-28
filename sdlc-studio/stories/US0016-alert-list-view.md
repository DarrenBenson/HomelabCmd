# US0016: Alert List and Detail Views

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** a dedicated page to view and manage all alerts
**So that** I can review alert history and manage alerts in bulk

## Context

### Persona Reference

**Darren** - Does weekly reviews of alert history to identify recurring issues. Needs filters to find specific alerts.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The alert list page shows all alerts (active and historical) with filtering and pagination. Users can view details, acknowledge, and resolve alerts. This page complements the dashboard summary by providing complete alert management.

## Acceptance Criteria

### AC1: Alert list displays all alerts

- **Given** navigating to the alerts page
- **When** the page loads
- **Then** all alerts are displayed in a table/list format

### AC2: Filter by status

- **Given** the alerts page is displayed
- **When** selecting "Open" from status filter
- **Then** only open alerts are shown

### AC3: Filter by severity

- **Given** the alerts page is displayed
- **When** selecting "Critical" from severity filter
- **Then** only critical alerts are shown

### AC4: Alert detail view

- **Given** clicking an alert row
- **When** the detail panel/modal opens
- **Then** full alert information is displayed

### AC5: Acknowledge from list

- **Given** viewing the alert list
- **When** clicking acknowledge on an open alert
- **Then** the alert status updates to acknowledged

### AC6: Resolve from detail

- **Given** viewing alert details
- **When** clicking resolve
- **Then** the alert status updates to resolved

### AC7: Pagination works

- **Given** more than 50 alerts exist
- **When** viewing the list
- **Then** pagination controls allow viewing all alerts

## Scope

### In Scope

- Alert list page
- Table with columns: severity, title, server, status, time
- Status filter (open, acknowledged, resolved, all)
- Severity filter (critical, high, medium, low, all)
- Server filter dropdown
- Pagination
- Alert detail view (modal or inline expansion)
- Acknowledge and resolve actions
- Relative timestamps with hover for absolute

### Out of Scope

- Date range filter (future)
- Export to CSV (future)
- Bulk actions (future)
- Alert configuration/settings

## UI/UX Requirements

### Alert List Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Dashboard   ALERTS                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Filters: [Status: All ▼] [Severity: All ▼] [Server: All ▼]            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Severity │ Title                      │ Server      │ Status    │   │
│  ├──────────┼────────────────────────────┼─────────────┼───────────│   │
│  │ 🔴 CRIT  │ Disk usage at 92%         │ MediaServer │ Open    ▶ │   │
│  │ 🔴 CRIT  │ Server offline            │ Pi-Backup   │ Ack     ▶ │   │
│  │ 🟠 HIGH  │ RAM usage at 87%          │ AIServer1   │ Open    ▶ │   │
│  │ 🟢 -     │ Disk usage at 85%         │ HomeServer  │ Resolved  │   │
│  │ 🟢 -     │ Server came back online   │ WebServer2  │ Resolved  │   │
│  └──────────┴────────────────────────────┴─────────────┴───────────┘   │
│                                                                         │
│  Showing 1-20 of 45 alerts              [← Previous] [1] [2] [3] [→]   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Alert Detail Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Alert Details                                                    [×]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🔴 CRITICAL: Disk usage at 92%                                        │
│                                                                         │
│  Server:      omv-mediaserver (Media Server)                           │
│  Type:        Disk                                                      │
│  Threshold:   90%                                                       │
│  Actual:      92%                                                       │
│                                                                         │
│  Created:     2026-01-18 10:30:00 UTC (5 minutes ago)                  │
│  Status:      Open                                                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [✓ Acknowledge]  [✓ Resolve]                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Styling

- Table rows: Console Grey background, hover highlight
- Severity badge: Coloured pill matching brand colours
- Status column: Text colour indicates state
  - Open: Amber Alert
  - Acknowledged: Terminal Cyan
  - Resolved: Phosphor Green
- Resolved alerts: Reduced opacity
- Actions: Ghost buttons

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for colour specifications.

## Technical Notes

### API Contracts

Uses endpoints from US0014:

- GET /api/v1/alerts (with query params)
- GET /api/v1/alerts/{id}
- POST /api/v1/alerts/{id}/acknowledge
- POST /api/v1/alerts/{id}/resolve

### Data Requirements

- Default sort: created_at descending
- Default filter: all statuses (show history)
- Pagination: 20 items per page

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No alerts match filter | Show "No alerts found" message |
| API error | Show error state with retry button |
| Acknowledge/resolve fails | Show error toast, don't change UI |
| Alert changed by another action | Refresh on return to list |
| Very old alerts (>30 days) | Show as normal (no pruning for alerts) |

## Test Scenarios

- [ ] Alert list displays all alerts
- [ ] Status filter works correctly
- [ ] Severity filter works correctly
- [ ] Server filter works correctly
- [ ] Combined filters work
- [ ] Pagination works correctly
- [ ] Click row opens detail view
- [ ] Acknowledge updates status in list
- [ ] Resolve updates status in detail
- [ ] Back navigation works
- [ ] Resolved alerts have reduced styling

## Definition of Done


**Story-specific additions:**

- [ ] All severity colours match brand guide
- [ ] Status colours match brand guide
- [ ] Filters are URL-persisted (shareable links)

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0014: Alert API | Story | Draft |
| US0015: Dashboard Alerts | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - table with filters, detail view

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
