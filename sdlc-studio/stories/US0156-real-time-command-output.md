# US0156: Real-Time Command Output (Deferred)

> **Status:** Deferred
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Story Points:** 5
> **Target Release:** v2.1

## User Story

**As a** system administrator
**I want** to see command output in real-time
**So that** I can monitor long-running commands

## Context

### Background

For long-running commands like package updates, users benefit from seeing output as it streams rather than waiting for completion. This requires WebSocket support for bidirectional communication.

### Deferral Rationale

This story is deferred to v2.1 because:
1. Most commands complete in < 5 seconds, so real-time is not critical for MVP
2. WebSocket infrastructure adds significant complexity
3. Synchronous API (US0153) covers core use cases

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | UX | Real-time feedback | AC1: streaming output |
| PRD | Performance | Responsive UI | AC2: progress indicator |
| US0153 | Dependency | Command execution API | Prerequisite |

---

## Acceptance Criteria

### AC1: WebSocket Streaming
- **Given** a long-running command execution
- **When** output is produced
- **Then** stdout/stderr streams to the frontend via WebSocket

### AC2: Progress Indicator
- **Given** a command with known progress patterns (apt updates)
- **When** progress markers are detected in output
- **Then** a visual progress indicator updates in the UI

### AC3: Graceful Fallback
- **Given** a browser without WebSocket support
- **When** a command is executed
- **Then** the system falls back to polling with a degraded UX

### AC4: Multi-User Support
- **Given** multiple users watching the same command
- **When** output is produced
- **Then** all connected users receive the stream

---

## Scope

### In Scope
- WebSocket endpoint for command output streaming
- Frontend live stdout/stderr display
- Progress indicator for apt updates
- Fallback to polling if WebSocket unavailable
- Connection timeout after command completes
- Multi-user viewing of same execution

### Out of Scope
- Command input (stdin) streaming
- Interactive commands (requires PTY)
- Historical output replay

---

## Technical Notes

### WebSocket Endpoint

```python
@router.websocket("/machines/{machine_id}/commands/stream")
async def stream_command_output(
    websocket: WebSocket,
    machine_id: UUID,
    db: Session = Depends(get_db)
):
    await websocket.accept()

    # Receive command request
    data = await websocket.receive_json()
    command = data["command"]
    action_type = data["action_type"]

    # Validate and setup
    machine = get_machine(db, machine_id)
    if not is_whitelisted(command, action_type):
        await websocket.send_json({"error": "Command not whitelisted"})
        await websocket.close()
        return

    # Execute with streaming
    async for chunk in ssh_executor.execute_streaming(machine, command):
        await websocket.send_json({
            "type": chunk.type,  # "stdout" | "stderr" | "exit"
            "data": chunk.data
        })

    await websocket.close()
```

### Frontend Integration

```typescript
const ws = new WebSocket(`wss://.../machines/${machineId}/commands/stream`);

ws.onopen = () => {
  ws.send(JSON.stringify({ command, action_type }));
};

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'stdout') appendToOutput(data);
  if (type === 'stderr') appendToError(data);
  if (type === 'exit') setExitCode(data);
};
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| WebSocket disconnects mid-command | Command continues, audit log captures output |
| Browser doesn't support WebSocket | Fallback to polling endpoint |
| Very fast command | WebSocket opens, streams, closes quickly |
| Very long output | No truncation in stream (truncate in audit only) |
| Connection timeout | Auto-close after 30s of inactivity |

---

## Test Scenarios

- [ ] WebSocket streams stdout in real-time
- [ ] WebSocket streams stderr in real-time
- [ ] Exit code sent on command completion
- [ ] Multiple clients receive same stream
- [ ] Fallback polling works without WebSocket
- [ ] Connection closes after command completes
- [ ] Progress indicator updates for apt commands

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0153](US0153-synchronous-command-execution-api.md) | Blocks | Synchronous Command Execution API | Draft |
| [US0151](US0151-ssh-executor-service.md) | Blocks | SSH Executor (needs streaming variant) | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| WebSocket support in FastAPI | Framework | Available |
| Frontend WebSocket client | Library | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** High - WebSocket infrastructure and streaming SSH

---

## Open Questions

- [ ] How to handle commands that require PTY (interactive)?
- [ ] Should we support command cancellation via WebSocket?

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0013 (status: Deferred) |
