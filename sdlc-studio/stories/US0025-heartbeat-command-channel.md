# US0025: Heartbeat Command Channel

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5
> **Updated:** 2026-01-19

## User Story

**As a** Darren (Homelab Operator)
**I want** commands delivered to agents and results reported back via the heartbeat
**So that** bidirectional communication happens without additional infrastructure

## Context

### Persona Reference

**Darren** - Wants simple agent architecture. Heartbeat polling is already established, so use it for both command delivery and result reporting.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This story extends the existing heartbeat mechanism for bidirectional command communication. The heartbeat request includes command execution results (if any). The heartbeat response includes pending commands (if any). This eliminates the need for separate push mechanisms or dedicated result reporting endpoints.

## Acceptance Criteria

### AC1: Heartbeat response includes pending commands

- **Given** server "omv-mediaserver" has an approved action
- **When** the agent sends a heartbeat
- **Then** the response includes the pending command in `pending_commands`

### AC2: Action marked as executing on delivery

- **Given** a command is included in heartbeat response
- **When** the response is sent
- **Then** the action status changes to "executing" and `executed_at` is set

### AC3: Only approved actions delivered

- **Given** a pending (not approved) action exists
- **When** the agent sends a heartbeat
- **Then** the pending action is not included in response

### AC4: Command results in heartbeat request

- **Given** agent has completed executing a command
- **When** sending the next heartbeat
- **Then** the result is included in `command_results` array

### AC5: Results update action status

- **Given** heartbeat contains command results
- **When** processing the heartbeat
- **Then** action status is updated to "completed" or "failed" based on exit code

### AC6: Multiple commands handled sequentially

- **Given** multiple approved actions for a server
- **When** the agent sends a heartbeat
- **Then** only one command is delivered (oldest first)

### AC7: Command not re-delivered

- **Given** a command was already delivered (status=executing)
- **When** the next heartbeat arrives
- **Then** the same command is not delivered again

## Scope

### In Scope

- Extended heartbeat request format (add `command_results`)
- Extended heartbeat response format (add `pending_commands`)
- Action status update to "executing" on delivery
- Action status update to "completed/failed" on result
- Single command at a time delivery
- Result processing (exit_code, stdout, stderr)
- Timestamp recording (executed_at, completed_at)

### Out of Scope

- Agent execution logic (US0027)
- Multiple simultaneous commands
- Streaming output
- Retry logic for failed commands

## Technical Notes

### API Contracts

**POST /api/v1/agents/heartbeat (extended)**

```json
Request:
{
  "server_id": "omv-mediaserver",
  "timestamp": "2026-01-18T10:32:00Z",
  "metrics": { ... },
  "services": [ ... ],
  "command_results": [
    {
      "action_id": 42,
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "executed_at": "2026-01-18T10:31:30Z",
      "completed_at": "2026-01-18T10:31:32Z"
    }
  ]
}

Response 200:
{
  "received": true,
  "server_time": "2026-01-18T10:32:00Z",
  "server_registered": true,
  "pending_commands": [
    {
      "action_id": 43,
      "action_type": "restart_service",
      "command": "systemctl restart plex",
      "parameters": {
        "service_name": "plex"
      },
      "timeout_seconds": 30
    }
  ],
  "results_acknowledged": [42]
}
```

**Response with no commands pending:**
```json
Response 200:
{
  "received": true,
  "server_time": "2026-01-18T10:30:00Z",
  "server_registered": true,
  "pending_commands": [],
  "results_acknowledged": []
}
```

**TRD Reference:** [§4 API Contracts - Agent Communication](../trd.md#4-api-contracts)

### Heartbeat Processing Logic

```python
async def process_heartbeat(heartbeat: HeartbeatRequest) -> HeartbeatResponse:
    # 1. Process any command results first
    acknowledged = []
    for result in heartbeat.command_results:
        action = await get_action(result.action_id)
        if action and action.status == ActionStatus.EXECUTING:
            action.exit_code = result.exit_code
            action.stdout = result.stdout[:10000]  # Truncate
            action.stderr = result.stderr[:10000]
            action.completed_at = result.completed_at
            action.status = ActionStatus.COMPLETED if result.exit_code == 0 else ActionStatus.FAILED
            await save_action(action)
            acknowledged.append(result.action_id)

    # 2. Store metrics and services (existing logic)
    await store_metrics(heartbeat)

    # 3. Get next pending command for this server
    pending_commands = []
    next_action = await get_oldest_approved_action(heartbeat.server_id)
    if next_action:
        next_action.status = ActionStatus.EXECUTING
        next_action.executed_at = datetime.now(UTC)
        await save_action(next_action)
        pending_commands.append(format_command(next_action))

    return HeartbeatResponse(
        received=True,
        server_time=datetime.now(UTC),
        server_registered=True,
        pending_commands=pending_commands,
        results_acknowledged=acknowledged,
    )
```

### Data Requirements

- Action status updated atomically on delivery
- Prevent race conditions with concurrent heartbeats
- Output fields truncated to prevent memory issues (10KB limit)
- Timestamps in UTC

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Agent crashes before executing | Action remains "executing"; needs timeout handling |
| Agent offline when approved | Command waits until agent reconnects |
| Result for unknown action | Ignored (logged as warning) |
| Result for non-executing action | Ignored (idempotent) |
| Duplicate result submission | Idempotent - ignore duplicate |
| Very large output | Truncate to 10KB |
| Heartbeat timeout | No command delivery, retry next heartbeat |

## Test Scenarios

- [ ] Approved action included in heartbeat response
- [ ] Pending action not included in response
- [ ] Executing action not re-delivered
- [ ] Action status changes to executing on delivery
- [ ] executed_at timestamp recorded on delivery
- [ ] Command result updates status to completed (exit_code=0)
- [ ] Command result updates status to failed (exit_code!=0)
- [ ] completed_at timestamp recorded on result
- [ ] Output stored in database (stdout, stderr)
- [ ] Large output truncated
- [ ] Duplicate results handled gracefully
- [ ] Only oldest approved action delivered
- [ ] Empty response when no pending commands
- [ ] Results acknowledged in response

## Definition of Done


**Story-specific additions:**

- [ ] Concurrent heartbeat handling tested
- [ ] Agent updated to send results and handle commands
- [ ] Output size limits documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0003: Agent Heartbeat Endpoint | Story | Done |
| US0023: Remediation Action Schema | Story | Draft |
| US0024: Action Queue API | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - extending existing heartbeat with bidirectional state management

## Open Questions

- [ ] Command timeout configuration - Owner: Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | QA fix: Corrected heartbeat URL to `/api/v1/agents/heartbeat` |
| 2026-01-19 | Claude | Merged US0028 (Execution Result Reporting) into this story; renamed from "Heartbeat Command Delivery" |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
