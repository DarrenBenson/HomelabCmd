# PL0029: Heartbeat Command Channel - Implementation Plan

> **Status:** Complete
> **Story:** [US0025: Heartbeat Command Channel](../stories/US0025-heartbeat-command-channel.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Extend the existing heartbeat mechanism for bidirectional command communication. The heartbeat request will include command execution results (if any). The heartbeat response will include pending commands (if any). This enables remediation actions to be delivered to agents and results reported back without additional infrastructure.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Response includes commands | Approved actions included in heartbeat response `pending_commands` |
| AC2 | Executing on delivery | Action status changes to "executing" when delivered |
| AC3 | Only approved delivered | Pending (not approved) actions not included in response |
| AC4 | Results in request | Command results included in `command_results` array |
| AC5 | Results update status | Action status updated to completed/failed based on exit code |
| AC6 | Sequential delivery | Only one command delivered at a time (oldest first) |
| AC7 | No re-delivery | Already-executing commands not re-delivered |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with SQLAlchemy 2.0 async
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

- Use Pydantic schemas for request/response validation
- Keep heartbeat processing idempotent
- Truncate large outputs to prevent memory issues
- Use UTC timestamps consistently
- Follow existing patterns from agents.py

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | `/tiangolo/fastapi` | response model with nested schemas | `response_model` |
| SQLAlchemy | `/sqlalchemy/sqlalchemy` | async query with filters and ordering | `select`, `where`, `order_by` |
| Pydantic | `/pydantic/pydantic` | nested model validation | `Field`, `model_validator` |

### Existing Patterns

From `backend/src/homelab_cmd/api/routes/agents.py`:
- HeartbeatRequest/Response schemas already exist
- `pending_commands` field exists (currently empty list)
- Server lookup and metrics storage patterns
- Alert evaluation after heartbeat processing

From `backend/src/homelab_cmd/api/routes/actions.py`:
- Action creation and status management
- Query patterns for filtering actions by server/status

## Recommended Approach

**Strategy:** TDD
**Rationale:** Test cases TC160-TC161 already defined in TS0009. Clear API contract in story. Bidirectional state management benefits from test-first approach.

### Test Priority

1. Approved action included in heartbeat response (TC160)
2. Command results update action status (TC161)
3. Only approved actions delivered (not pending)
4. Action marked as executing on delivery
5. No re-delivery of executing actions

### Documentation Updates Required

- [ ] Update TS0009 automation status after tests pass
- [ ] Update US0025 status to Done

## Implementation Steps

### Phase 1: Extend Heartbeat Schemas

**Goal:** Add command_results to request and structured pending_commands to response

#### Step 1.1: Create CommandResult schema

- [ ] Create `CommandResult` schema with action_id, exit_code, stdout, stderr, executed_at, completed_at
- [ ] Add `command_results` field to `HeartbeatRequest`
- [ ] Add truncation validation (10KB limit for stdout/stderr)

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add CommandResult, CommandResultPayload

#### Step 1.2: Create PendingCommand schema

- [ ] Create `PendingCommand` schema with action_id, action_type, command, parameters, timeout_seconds
- [ ] Update `HeartbeatResponse.pending_commands` to use typed schema
- [ ] Add `results_acknowledged` field to response

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add PendingCommand, update HeartbeatResponse

---

### Phase 2: Implement Command Delivery

**Goal:** Return approved actions in heartbeat response and mark as executing

#### Step 2.1: Query approved actions

- [ ] Create function to get oldest approved action for server
- [ ] Filter by server_id and status=APPROVED
- [ ] Order by created_at ascending (oldest first)
- [ ] Limit to 1 (sequential delivery)

**Implementation pattern:**
```python
async def get_next_approved_action(session: AsyncSession, server_id: str) -> RemediationAction | None:
    result = await session.execute(
        select(RemediationAction)
        .where(RemediationAction.server_id == server_id)
        .where(RemediationAction.status == ActionStatus.APPROVED.value)
        .order_by(RemediationAction.created_at.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()
```

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add query function

#### Step 2.2: Mark action as executing on delivery

- [ ] Update action status to EXECUTING
- [ ] Set executed_at timestamp
- [ ] Include action in pending_commands response
- [ ] Format command with parameters

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Update receive_heartbeat

---

### Phase 3: Implement Result Processing

**Goal:** Process command results from heartbeat request and update action status

#### Step 3.1: Process command_results

- [ ] Iterate over command_results in heartbeat request
- [ ] Look up action by ID
- [ ] Verify action is in EXECUTING status (idempotent handling)
- [ ] Update exit_code, stdout, stderr (truncated)
- [ ] Set completed_at timestamp
- [ ] Set status to COMPLETED (exit_code=0) or FAILED (exit_code!=0)
- [ ] Track acknowledged action IDs

**Implementation pattern:**
```python
acknowledged = []
for result in heartbeat.command_results or []:
    action = await session.get(RemediationAction, result.action_id)
    if action and action.status == ActionStatus.EXECUTING.value:
        action.exit_code = result.exit_code
        action.stdout = (result.stdout or "")[:10000]  # Truncate
        action.stderr = (result.stderr or "")[:10000]
        action.completed_at = result.completed_at or datetime.now(UTC)
        action.status = ActionStatus.COMPLETED.value if result.exit_code == 0 else ActionStatus.FAILED.value
        acknowledged.append(result.action_id)
```

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add result processing logic

#### Step 3.2: Return acknowledged results

- [ ] Include acknowledged action IDs in response
- [ ] Handle unknown action IDs gracefully (log warning, don't fail)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Update response

---

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Write Integration Tests

- [ ] TC160: Approved action included in heartbeat response
- [ ] TC161: Command results update action status
- [ ] Only approved actions delivered
- [ ] Pending actions not delivered
- [ ] Executing actions not re-delivered
- [ ] Action status changes to executing on delivery
- [ ] Exit code 0 → COMPLETED
- [ ] Exit code != 0 → FAILED
- [ ] Output truncation at 10KB
- [ ] Empty response when no pending commands

**Files to create:**
- `tests/test_heartbeat_commands.py`

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test approved action in response | Pending |
| AC2 | Test status changes to executing | Pending |
| AC3 | Test pending action not in response | Pending |
| AC4 | Test command_results processed | Pending |
| AC5 | Test status COMPLETED/FAILED | Pending |
| AC6 | Test oldest action delivered first | Pending |
| AC7 | Test executing action not re-delivered | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Result for unknown action | Log warning, ignore (don't fail heartbeat) |
| Result for non-executing action | Ignore (idempotent) |
| Duplicate result submission | Idempotent - already completed, ignore |
| Very large stdout/stderr | Truncate to 10KB |
| No approved actions | Return empty pending_commands |
| Agent crashes before executing | Action remains EXECUTING (timeout handling out of scope) |
| Concurrent heartbeats | SQLAlchemy session isolation handles this |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Race condition on status update | Medium | Atomic status check in query |
| Memory issues with large output | High | 10KB truncation limit |
| Agent never reports result | Medium | Out of scope (timeout story needed) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0003: Agent Heartbeat Endpoint | Story | Done - base heartbeat exists |
| US0023: Remediation Action Schema | Story | Review - extended schema |
| US0024: Action Queue API | Story | Review - creates approved actions |

## Open Questions

- [ ] Command timeout configuration - default to 30 seconds

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Integration tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Output truncation tested
- [ ] Ready for code review

## Notes

This story does NOT include:
- Agent-side command execution logic (US0027)
- Retry logic for failed commands
- Timeout handling for stuck EXECUTING actions
- Multiple simultaneous commands

The agent will need to be updated to:
1. Parse pending_commands from heartbeat response
2. Execute commands and capture output
3. Include results in next heartbeat request

Agent updates are covered in US0027.
