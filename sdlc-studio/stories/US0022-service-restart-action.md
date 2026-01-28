# US0022: Service Restart Action

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Plan:** [PL0026: Service Restart Action](../plans/PL0026-service-restart-action.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** to queue a service restart from the dashboard
**So that** I can fix stopped services without SSH-ing into the server

## Context

### Persona Reference

**Darren** - Manual SSH for every service restart is tedious. Wants one-click restart from dashboard.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This story creates the API endpoint to queue a service restart action. The actual execution and approval workflow is handled in EP0004 (Remediation Engine). For MVP, the restart action is queued and requires manual approval before execution.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | EP0004 handles execution | This story only queues; no actual restart |
| Scope | Service monitoring scope | Limited to systemd services |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Quick response | Queue action immediately; async execution |
| Security | No arbitrary commands | Only predefined restart command |
| UX | Clear feedback | Toast confirmation on action queue |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Restart action can be queued

- **Given** a stopped service "plex" on "omv-mediaserver"
- **When** POST `/api/v1/servers/omv-mediaserver/services/plex/restart` is called
- **Then** a restart action is queued in the actions table

### AC2: Action includes service name

- **Given** a restart action is queued
- **When** viewing the action
- **Then** it includes the service name and command to execute

### AC3: Action status depends on server maintenance mode

- **Given** a restart action is created on a server NOT in maintenance mode
- **When** checking its status
- **Then** status is "approved" (auto-approved for immediate execution)

- **Given** a restart action is created on a server IN maintenance mode
- **When** checking its status
- **Then** status is "pending" (awaiting manual approval)

### AC4: Restart button triggers action

- **Given** viewing a stopped service in dashboard
- **When** clicking the Restart button
- **Then** the restart action is queued and user sees confirmation

### AC5: No duplicate in-progress actions

- **Given** a pending or approved restart action exists for "plex"
- **When** trying to queue another restart
- **Then** request is rejected with "A restart action for this service is already queued"

## Scope

### In Scope

- POST /api/v1/servers/{server_id}/services/{service_name}/restart
- RemediationAction entity (basic - extended in EP0004)
- Action status: pending
- Restart button functionality in UI
- Confirmation feedback

### Out of Scope

- Action approval workflow (EP0004)
- Action execution (EP0004)
- Auto-approve settings (EP0004)
- Action history view (EP0004)

## Technical Notes

### API Contracts

**POST /api/v1/servers/{server_id}/services/{service_name}/restart**
```json
Request: {}  // Empty body

Response 201 (server NOT in maintenance mode - auto-approved):
{
  "action_id": 42,
  "action_type": "restart_service",
  "server_id": "omv-mediaserver",
  "service_name": "plex",
  "command": "systemctl restart plex",
  "status": "approved",
  "approved_at": "2026-01-18T10:30:00Z",
  "approved_by": "auto",
  "created_at": "2026-01-18T10:30:00Z"
}

Response 201 (server IN maintenance mode - pending approval):
{
  "action_id": 42,
  "action_type": "restart_service",
  "server_id": "omv-mediaserver",
  "service_name": "plex",
  "command": "systemctl restart plex",
  "status": "pending",
  "created_at": "2026-01-18T10:30:00Z"
}
```

**Duplicate action response:**
```json
Response 409:
{
  "detail": {
    "detail": "A restart action for this service is already queued",
    "existing_action_id": 42
  }
}
```

**TRD Reference:** [§4 API Contracts - Remediation Actions](../trd.md#4-api-contracts)

### Data Requirements

**RemediationAction Table (basic structure):**
```sql
CREATE TABLE remediation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(id),
    action_type TEXT NOT NULL,  -- 'restart_service', 'clear_logs', etc.
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', ...
    service_name TEXT,  -- For restart_service actions
    command TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'dashboard'
);
```

### UI Changes

Restart button on stopped services (US0020):
- Enabled when service is stopped
- On click: POST to restart endpoint
- On success: Show toast "Restart action queued for approval"
- On 409: Show toast "Restart already pending"

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Service is running | Allow anyway (user might want restart) |
| Server is offline | Queue action (will execute when online) |
| Service not in expected list | Allow anyway (might be manual restart) |
| Duplicate pending action | 409 Conflict |
| Invalid service name | 422 Unprocessable Entity |

## Test Scenarios

- [x] POST creates restart action (auto-approved when not in maintenance mode)
- [x] Action includes correct command
- [x] Action status is approved when server not paused
- [x] Action status is pending when server is paused
- [x] Duplicate action returns 409
- [x] Restart button calls API
- [x] Success toast shown after queue
- [x] 409 handling in UI

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0022-01 | POST creates restart action (auto-approved) | AC1 | API | Pass |
| TC-US0022-02 | Action includes correct command | AC2 | API | Pass |
| TC-US0022-03 | Action auto-approves when server not paused | AC3 | API | Pass |
| TC-US0022-04 | Action pending when server paused | AC3 | API | Pass |
| TC-US0022-05 | Duplicate action returns 409 | AC5 | API | Pass |
| TC-US0022-06 | Restart button calls API | AC4 | E2E | Pass |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 5/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language (avoid: "handles errors", "returns data", "works correctly")
- [x] Open Questions: 0/0 resolved (critical must be resolved)
- [x] Given/When/Then uses concrete values, not placeholders
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met (API stories)
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented (not just happy path)

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0017: Service Schema | Story | Done |
| US0020: Service Status Display | Story | Done |
| US0023: Remediation Action Schema | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - creates foundation for EP0004

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | QA fix: Added US0023 (Remediation Action Schema) as dependency |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-20 | Claude | Updated AC3/AC5 to reflect auto-approve behaviour from US0026 integration; marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
