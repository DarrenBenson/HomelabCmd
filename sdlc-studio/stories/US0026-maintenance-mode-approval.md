# US0026: Maintenance Mode Approval

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2
> **Updated:** 2026-01-19

## User Story

**As a** Darren (Homelab Operator)
**I want** to approve or reject pending actions on paused servers
**So that** I control what commands execute during maintenance windows

## Context

### Persona Reference

**Darren** - When a server is in maintenance mode, wants explicit control over what runs. Needs simple approve/reject workflow.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When a server is paused (maintenance mode), all actions are created with "pending" status. This story implements the API endpoints to approve or reject those pending actions. Once approved, actions follow the normal execution flow.

## Acceptance Criteria

### AC1: Approve action

- **Given** a pending action with id=42
- **When** POST `/api/v1/actions/42/approve` is called
- **Then** status changes to "approved" with audit fields populated

### AC2: Reject action

- **Given** a pending action with id=42
- **When** POST `/api/v1/actions/42/reject` is called with reason
- **Then** status changes to "rejected" with reason recorded

### AC3: Cannot approve non-pending

- **Given** an action with status "executing"
- **When** attempting to approve
- **Then** 409 Conflict is returned

### AC4: Audit trail on approval

- **Given** an action is approved
- **When** viewing the action
- **Then** approved_at and approved_by are populated

### AC5: Rejection reason required

- **Given** rejecting an action
- **When** no reason is provided
- **Then** 422 Unprocessable Entity is returned

## Scope

### In Scope

- POST /api/v1/actions/{id}/approve
- POST /api/v1/actions/{id}/reject
- Audit field population
- Status validation

### Out of Scope

- Approval UI (US0030)
- Bulk approval
- Approval notifications

## Technical Notes

### API Contracts

**POST /api/v1/actions/{action_id}/approve**
```json
Request: {}  // Empty body

Response 200:
{
  "id": 42,
  "status": "approved",
  "approved_at": "2026-01-18T10:31:00Z",
  "approved_by": "dashboard"
}
```

**POST /api/v1/actions/{action_id}/reject**
```json
Request:
{
  "reason": "Not needed - service recovered automatically"
}

Response 200:
{
  "id": 42,
  "status": "rejected",
  "rejected_at": "2026-01-18T10:31:00Z",
  "rejected_by": "dashboard",
  "rejection_reason": "Not needed - service recovered automatically"
}
```

**TRD Reference:** [§4 API Contracts - Actions](../trd.md#4-api-contracts)

### Data Requirements

- approved_by defaults to "dashboard" (single-user system)
- Rejection reason stored in rejection_reason field

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Action not found | 404 Not Found |
| Already approved | 409 Conflict |
| Already rejected | 409 Conflict |
| Already executing | 409 Conflict |
| Already completed | 409 Conflict |

## Test Scenarios

- [ ] Approve changes status to approved
- [ ] Reject changes status to rejected
- [ ] Audit fields populated on approval
- [ ] Rejection reason stored
- [ ] Cannot approve non-pending action
- [ ] Cannot reject non-pending action
- [ ] Missing rejection reason returns 422
- [ ] 404 for non-existent action

## Definition of Done


**Story-specific additions:**

- [ ] Idempotency considered (re-approval of approved action)

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0023: Remediation Action Schema | Story | Draft |
| US0024: Action Queue API | Story | Draft |

## Estimation

**Story Points:** 2

**Complexity:** Low - simple state transitions

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Simplified for maintenance mode model; renamed from "Action Approval Workflow"; reduced from 3 to 2 points |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
