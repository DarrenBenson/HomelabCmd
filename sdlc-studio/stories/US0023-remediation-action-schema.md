# US0023: Extended Remediation Action Schema

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2
> **Updated:** 2026-01-19

## User Story

**As a** Darren (Homelab Operator)
**I want** remediation actions stored with full audit trail
**So that** I have a complete record of what actions were taken, when, and with what result

## Context

### Persona Reference

**Darren** - Needs audit trail for all remediation actions. Wants to know who approved what and whether it succeeded.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This story extends the basic RemediationAction table created in US0022 to include the full action lifecycle. Includes `APPROVED` status for immediate execution on normal servers, plus audit fields for approval and execution tracking.

## Acceptance Criteria

### AC1: Action status lifecycle

- **Given** a new remediation action is created
- **When** the action is processed
- **Then** it can transition through: pending → approved → executing → completed/failed

### AC2: Immediate approval for normal servers

- **Given** a server is not in maintenance mode (`is_paused=false`)
- **When** a new action is created
- **Then** it starts with status "approved" and `approved_by="auto"`

### AC3: Pending for maintenance servers

- **Given** a server is in maintenance mode (`is_paused=true`)
- **When** a new action is created
- **Then** it starts with status "pending"

### AC4: Rejection is terminal

- **Given** a pending action
- **When** it is rejected
- **Then** the status is "rejected" and no further transitions occur

### AC5: Audit fields captured

- **Given** an action is approved
- **When** viewing the action
- **Then** approved_at and approved_by fields are populated

### AC6: Execution result stored

- **Given** an action completes execution
- **When** viewing the action
- **Then** executed_at, completed_at, and result (stdout/stderr) are captured

### AC7: Link to triggering alert

- **Given** an action was triggered from an alert
- **When** viewing the action
- **Then** the triggering alert_id is recorded

## Scope

### In Scope

- Extended RemediationAction schema
- Status enum: pending, approved, rejected, executing, completed, failed
- Audit fields: approved_at, approved_by, executed_at, completed_at
- Rejection fields: rejected_at, rejected_by, rejection_reason
- Execution result fields: exit_code, stdout, stderr
- Optional alert_id foreign key
- Database migrations

### Out of Scope

- Action creation logic (US0024)
- Approval workflow (US0026)
- Agent execution (US0025)

## Technical Notes

### API Contracts

No new endpoints - this story defines the data model.

**TRD Reference:** [§4 API Contracts - Actions](../trd.md#4-api-contracts)

### Data Requirements

**ActionStatus Enum:**
```python
class ActionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
```

**RemediationAction Table (extended):**
```sql
CREATE TABLE remediation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(id),
    action_type TEXT NOT NULL,  -- 'restart_service', 'clear_logs', 'custom'
    status TEXT NOT NULL DEFAULT 'pending',

    -- Action details
    service_name TEXT,  -- For restart_service
    command TEXT NOT NULL,
    parameters TEXT,  -- JSON for additional params

    -- Trigger source
    alert_id INTEGER REFERENCES alerts(id),

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'dashboard',
    approved_at TIMESTAMP,
    approved_by TEXT,  -- 'auto' for normal servers, username for manual
    rejected_at TIMESTAMP,
    rejected_by TEXT,
    rejection_reason TEXT,

    -- Execution tracking
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,

    -- Indices for common queries
    INDEX idx_actions_server_status (server_id, status),
    INDEX idx_actions_status (status)
);
```

**Status State Machine:**
```
                    ┌─► rejected (terminal)
                    │
pending ─► approved ─► executing ─► completed
                              │
                              └─► failed
```

Note: For normal servers (`is_paused=false`), actions skip "pending" and start at "approved".

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Action approved but server offline | Status remains 'approved' until executed |
| Execution times out | Status = 'failed', stderr contains timeout message |
| Invalid status transition | 422 Unprocessable Entity |
| Action without alert link | alert_id is NULL (valid) |

## Test Scenarios

- [ ] Action can be created with pending status (maintenance mode)
- [ ] Action can be created with approved status (normal mode)
- [ ] Status transitions follow state machine
- [ ] Invalid transitions are rejected
- [ ] Audit fields populated on approval
- [ ] Execution results stored correctly
- [ ] Alert link is optional

## Definition of Done


**Story-specific additions:**

- [ ] Migration tested with existing data (US0022 data)
- [ ] Indices created for performance

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0022: Service Restart Action | Story | Draft |
| US0010: Alert Schema | Story | Draft |

## Estimation

**Story Points:** 2

**Complexity:** Low - schema extension

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Updated for maintenance mode model; added APPROVED to initial states |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
