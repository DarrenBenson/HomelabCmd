# US0031: Action History View

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Updated:** 2026-01-19

## User Story

**As a** Darren (Homelab Operator)
**I want** to view a history of all remediation actions
**So that** I have a complete audit trail and can review past actions

## Context

### Persona Reference

**Darren** - Needs audit trail for troubleshooting. Wants to see what was done, when, and whether it worked.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

A dedicated page showing all remediation actions with filtering by server, status, and date range. Includes the full audit trail: who created, who approved, execution results.

## Acceptance Criteria

### AC1: History page accessible

- **Given** logged into the dashboard
- **When** navigating to Actions → History
- **Then** the action history page is displayed

### AC2: Actions listed with details

- **Given** actions exist in the system
- **When** viewing the history page
- **Then** actions are listed with server, type, status, and timestamps

### AC3: Filter by server

- **Given** viewing action history
- **When** filtering by server "omv-mediaserver"
- **Then** only actions for that server are shown

### AC4: Filter by status

- **Given** viewing action history
- **When** filtering by status "failed"
- **Then** only failed actions are shown

### AC5: View action details

- **Given** an action in the history list
- **When** clicking on it
- **Then** full details including output are displayed

### AC6: Pagination

- **Given** more than 50 actions
- **When** viewing the history
- **Then** pagination controls are available

## Scope

### In Scope

- /actions/history route
- Action list with columns: Server, Type, Status, Created, Completed
- Filter controls: server dropdown, status dropdown
- Action detail modal/panel
- Pagination

### Out of Scope

- Real-time updates (manual refresh)
- Advanced search
- Bulk actions
- Export to CSV
- Date range filtering

## UI/UX Requirements

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HomelabCmd  >  Actions  >  History                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Filters: [Server ▼] [Status ▼]                                         │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Server          │ Type           │ Status    │ Created    │ Done  │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ omv-mediaserver │ restart_service│ ✓ Completed│ 10:30     │ 10:31 │  │
│  │ pihole-primary  │ clear_logs     │ ✓ Completed│ 09:15     │ 09:16 │  │
│  │ omv-mediaserver │ restart_service│ ✗ Failed   │ Yesterday │ -     │  │
│  │ mini-pc-1       │ restart_service│ ○ Rejected │ 2 days ago│ -     │  │
│  │ ...             │                │            │           │       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Showing 1-50 of 127                           [< Prev] [1] [2] [3] [>] │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Action Detail Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Action #42: Restart plex on omv-mediaserver                       [x] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Status: ✓ Completed                                                    │
│                                                                         │
│  Timeline:                                                              │
│  ├─ Created: 2026-01-18 10:30:00 by dashboard                          │
│  ├─ Approved: 2026-01-18 10:30:00 by auto                              │
│  ├─ Executed: 2026-01-18 10:31:30                                      │
│  └─ Completed: 2026-01-18 10:31:32                                     │
│                                                                         │
│  Command: systemctl restart plex                                        │
│  Exit Code: 0                                                           │
│                                                                         │
│  Output:                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ (empty)                                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                        [Close]          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Status Indicators

- Completed: Green checkmark (Phosphor Green)
- Failed: Red X (Red Alert)
- Rejected: Grey circle with slash
- Executing: Blue spinner (Nebula Blue)
- Approved: Yellow clock (Warning Amber)
- Pending: Grey clock

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for colour specifications.

## Technical Notes

### API Contracts

Uses GET /api/v1/actions from US0024 with query parameters.

```
GET /api/v1/actions?status=completed&server_id=omv-mediaserver&limit=50&offset=0
```

### Data Requirements

- Efficient pagination (offset/limit)
- Sort by created_at descending (most recent first)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No actions match filter | Show "No actions found" message |
| Action detail load fails | Show error in modal |
| Very long output | Scrollable, truncated if >10KB |

## Test Scenarios

- [ ] History page loads
- [ ] Actions displayed in table
- [ ] Filter by server works
- [ ] Filter by status works
- [ ] Pagination works
- [ ] Action detail modal opens
- [ ] Full audit trail shown in detail
- [ ] Output displayed in detail

## Definition of Done


**Story-specific additions:**

- [ ] Performance tested with 500+ actions

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0024: Action Queue API | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - list view with filtering and detail modal

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Simplified - removed date range filter, export; reduced from 5 to 3 points |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
