# US0152: Remove Async Command Channel from Agent

> **Status:** Done
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Completed:** 2026-01-29
> **Story Points:** 3

## User Story

**As a** developer
**I want** to simplify the agent by removing command execution
**So that** the agent only does metrics collection

## Context

### Background

With synchronous SSH execution replacing the async command channel, the agent no longer needs to poll for commands, execute them, or report results. This simplifies the agent significantly - it becomes a metrics-only component.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Compatibility | Support v1.0 agents during migration | AC3: backwards compatible |
| PRD | Reliability | No data loss during migration | AC2: test on 2+ servers |
| US0151 | Dependency | SSH executor must be working | Prerequisite |

---

## Acceptance Criteria

### AC1: Remove Command Fields from Schemas
- **Given** the heartbeat request/response schemas
- **When** the schema is updated
- **Then** `pending_commands` is removed from response and `command_results` is removed from request

### AC2: Remove Agent Command Execution
- **Given** the agent codebase
- **When** the agent is simplified
- **Then** all command execution code, queue management, and state tracking are removed

### AC3: Backward Compatibility
- **Given** a v1.0 agent still sending `command_results`
- **When** the hub receives the heartbeat
- **Then** the hub logs a deprecation warning and ignores the field gracefully

### AC4: Validation on Multiple Servers
- **Given** the simplified agent
- **When** deployed to at least 2 servers
- **Then** metrics continue flowing correctly with no regressions

---

## Scope

### In Scope
- Remove `pending_commands` from heartbeat response schema
- Remove `command_results` from heartbeat request schema
- Remove command execution code from agent
- Remove command queue/state management from agent
- Add deprecation warning for v1.0 agents
- Update agent deployment documentation

### Out of Scope
- SSH executor implementation (US0151)
- Command execution API (US0153)
- Agent auto-update mechanism

---

## Technical Notes

### Schema Changes

**Before (v1.0):**
```python
class HeartbeatRequest(BaseModel):
    metrics: MetricsPayload
    command_results: List[CommandResult]  # REMOVE

class HeartbeatResponse(BaseModel):
    pending_commands: List[PendingCommand]  # REMOVE
```

**After (v2.0):**
```python
class HeartbeatRequest(BaseModel):
    metrics: MetricsPayload
    # command_results removed

class HeartbeatResponse(BaseModel):
    # pending_commands removed
```

### Agent Simplification

**Before:**
```python
# POST heartbeat with metrics + command results
response = httpx.post("/api/v1/agents/heartbeat", json={
    "metrics": {...},
    "command_results": [...]
})

# Execute pending commands from response
pending = response.json()["pending_commands"]
execute_commands(pending)
```

**After:**
```python
# POST heartbeat with just metrics
httpx.post("/api/v1/agents/heartbeat", json={
    "metrics": {...}
})
# That's it - no command execution
```

### Migration Strategy

1. Deploy hub v2.0 first (accepts both old and new agent format)
2. Deploy simplified agents gradually
3. Hub logs warning if agent sends `command_results` (deprecated)

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| v1.0 agent sends `command_results` | Hub logs deprecation warning, ignores field |
| v1.0 agent expects `pending_commands` | v2.0 hub returns empty array for backwards compat |
| Mixed agent versions in deployment | Both work, deprecation warnings logged |
| Agent upgrade fails mid-deployment | v1.0 agent continues working |

---

## Test Scenarios

- [x] Hub accepts heartbeat without `command_results`
- [x] Hub accepts heartbeat with `command_results` (backward compat)
- [x] Deprecation warning logged for v1.0 agents
- [x] Metrics continue flowing after agent simplification
- [x] Agent startup succeeds without command execution code
- [x] Agent handles missing `pending_commands` in response

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0151](US0151-ssh-executor-service.md) | Blocks | SSH Executor Service working | Done |
| [US0153](US0153-synchronous-command-execution-api.md) | Blocks | Command Execution API | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Test servers (2+) | Infrastructure | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Primarily removing code

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0013 |
| 2026-01-29 | Claude | Implementation complete - agent simplified to v2.0 |
