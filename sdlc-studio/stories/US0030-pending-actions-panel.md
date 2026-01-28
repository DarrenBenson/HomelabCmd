# US0030: Pending Actions Panel

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Updated:** 2026-01-19
> **Plan:** [PL0033](../plans/PL0033-pending-actions-panel.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** pending actions displayed on the dashboard
**So that** I can quickly approve or reject actions on paused servers

## Context

### Persona Reference

**Darren** - Needs to see pending actions during daily 5-minute check. Wants approve/reject to be one click.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When servers are in maintenance mode, actions require approval. The dashboard shows a pending actions panel when actions are awaiting approval. Each pending action has approve/reject buttons. This panel only appears when there are pending actions.

## Acceptance Criteria

### AC1: Pending actions panel visible

- **Given** pending actions exist
- **When** viewing the dashboard
- **Then** a "Pending Actions" panel is displayed

### AC2: Panel hidden when empty

- **Given** no pending actions exist
- **When** viewing the dashboard
- **Then** the "Pending Actions" panel is not shown

### AC3: Action details displayed

- **Given** pending actions in the panel
- **When** viewing each action
- **Then** server name, action type, service name, and created time are shown

### AC4: Approve button works

- **Given** a pending action in the panel
- **When** clicking "Approve"
- **Then** the action is approved and removed from pending list

### AC5: Reject button works

- **Given** a pending action in the panel
- **When** clicking "Reject"
- **Then** a reason prompt appears, then the action is rejected

### AC6: Server maintenance indicator

- **Given** an action in the panel
- **When** viewing the action
- **Then** a maintenance mode badge indicates why approval is required

## Scope

### In Scope

- Pending actions panel component
- Action card with details
- Approve button with instant feedback
- Reject button with reason modal
- Real-time updates (polling)
- Maintenance mode indicator

### Out of Scope

- Action history in this panel (US0031)
- Bulk approve/reject
- Filtering within panel
- Badge count in header

## UI/UX Requirements

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HomelabCmd                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ⏳ Pending Actions (2)                                               │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ omv-mediaserver  🔧 Maintenance Mode                            │ │ │
│  │  │ Restart Service: plex                                           │ │ │
│  │  │ Created: 2 minutes ago                                          │ │ │
│  │  │                              [✓ Approve]  [✗ Reject]           │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ pihole-primary  🔧 Maintenance Mode                             │ │ │
│  │  │ Clear Logs                                                      │ │ │
│  │  │ Created: 5 minutes ago                                          │ │ │
│  │  │                              [✓ Approve]  [✗ Reject]           │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [Rest of dashboard...]                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Action Card Styling

- Server name: Space Grotesk, 14px semi-bold
- Maintenance badge: Orange background
- Action description: 12px regular
- Created time: 11px, muted colour
- Approve button: Green (Phosphor Green #4ADE80)
- Reject button: Red (Red Alert #F87171)
- Card background: Panel Background (#161B22)

### Reject Modal

```
┌─────────────────────────────────────────────────┐
│  Reject Action                              [x] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Rejecting: Restart plex on omv-mediaserver     │
│                                                 │
│  Reason (required):                             │
│  ┌─────────────────────────────────────────┐   │
│  │ Service recovered automatically         │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                    [Cancel]  [Reject Action]    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for colour specifications.

## Technical Notes

### API Contracts

Uses endpoints from US0024 (list) and US0026 (approve/reject).

- GET /api/v1/actions?status=pending
- POST /api/v1/actions/{id}/approve
- POST /api/v1/actions/{id}/reject

### Data Requirements

- Poll every 30 seconds with other dashboard data
- Optimistic UI update on approve/reject

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Approve fails (network) | Show error toast, restore action to list |
| Action approved elsewhere | Remove from list on next poll |
| Many pending actions (>5) | Scrollable list |
| Action type unknown | Display raw action_type value |

## Test Scenarios

- [ ] Panel displays when pending actions exist
- [ ] Panel hidden when no pending actions
- [ ] Action details shown correctly
- [ ] Maintenance mode badge shown
- [ ] Approve removes action from list
- [ ] Reject shows modal
- [ ] Reject requires reason
- [ ] Real-time updates via polling

## Definition of Done


**Story-specific additions:**

- [ ] Optimistic UI tested
- [ ] Loading states implemented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0024: Action Queue API | Story | Review |
| US0026: Maintenance Mode Approval | Story | Review |
| US0005: Dashboard Server List | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - interactive UI component

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Simplified for maintenance mode model; renamed from "Pending Actions Dashboard Display"; reduced from 5 to 3 points |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
