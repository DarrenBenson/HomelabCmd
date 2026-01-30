# US0153: Synchronous Command Execution API

> **Status:** Done
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Story Points:** 5

## User Story

**As a** frontend developer
**I want** a synchronous command execution API
**So that** I can show immediate results to users

## Context

### Background

The frontend needs a simple API to execute commands on remote machines and receive immediate results. This replaces the previous async model where users had to wait for agents to poll, execute, and report back.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | < 5 second latency | AC1: timeout handling |
| PRD | Security | API key authentication | AC4: auth required |
| US0151 | Dependency | SSH executor service | Prerequisite |

---

## Acceptance Criteria

### AC1: Command Execution Endpoint
- **Given** a valid machine ID and command
- **When** POST `/api/v1/machines/{id}/commands/execute` is called
- **Then** the command executes via SSH and returns exit_code, stdout, stderr, duration_ms

### AC2: Error Status Codes
- **Given** various error conditions
- **When** execution fails
- **Then** appropriate status codes are returned: 200 (success), 400 (invalid command), 408 (timeout), 500 (SSH error)

### AC3: Rate Limiting
- **Given** a user making rapid API calls
- **When** more than 10 commands per minute are attempted
- **Then** requests are rate-limited with 429 status

### AC4: OpenAPI Documentation
- **Given** the new endpoint
- **When** developers access `/api/docs`
- **Then** full OpenAPI documentation is available with request/response schemas

---

## Scope

### In Scope
- `POST /api/v1/machines/{id}/commands/execute` endpoint
- Request schema: `command`, `action_type`
- Response schema: `exit_code`, `stdout`, `stderr`, `duration_ms`
- Status code handling (200, 400, 404, 408, 429, 500)
- Rate limiting (10/min/user)
- OpenAPI documentation

### Out of Scope
- Command whitelist validation (US0154 - called from this endpoint)
- Audit trail creation (US0155 - called from this endpoint)
- Real-time streaming (US0156 - deferred)

---

## Technical Notes

### Endpoint Implementation

```python
@router.post("/machines/{machine_id}/commands/execute")
async def execute_command(
    machine_id: UUID,
    request: CommandExecuteRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_api_key)
) -> CommandExecuteResponse:
    # Get machine
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(404, "Machine not found")

    # Validate command against whitelist (US0154)
    if not is_whitelisted(request.command, request.action_type):
        raise HTTPException(400, "Command not in whitelist")

    # Execute via SSH (US0151)
    ssh_executor = SSHExecutor()
    try:
        result = await ssh_executor.execute(
            machine,
            request.command,
            timeout=30
        )
    except asyncio.TimeoutError:
        raise HTTPException(408, "Command execution timeout")
    except Exception as e:
        logger.error(f"SSH execution failed: {e}")
        raise HTTPException(500, f"SSH execution failed: {str(e)}")

    # Create audit log (US0155)
    create_audit_log(machine_id, request.command, result)

    return CommandExecuteResponse(
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        duration_ms=result.duration_ms
    )
```

### API Schemas

```python
class CommandExecuteRequest(BaseModel):
    command: str = Field(description="Command to execute")
    action_type: str = Field(description="Type: restart_service, apply_updates, custom")

class CommandExecuteResponse(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
```

### API Contracts

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/v1/machines/{id}/commands/execute` | `CommandExecuteRequest` | `CommandExecuteResponse` |

### Data Requirements
- Machine must exist and have `tailscale_hostname`
- SSH key configured (from US0079)

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Machine not found | 404 with message |
| Machine offline | 500 with SSH connection error |
| Command not whitelisted | 400 with "Command not in whitelist" |
| Command times out (30s) | 408 with "Command execution timeout" |
| SSH authentication failure | 500 with auth error details |
| Rate limit exceeded | 429 with retry-after header |
| Empty command | 400 with validation error |

---

## Test Scenarios

- [x] Valid command returns 200 with stdout/stderr
- [x] Invalid machine ID returns 404
- [x] Unwhitelisted command returns 400
- [x] Command timeout returns 408
- [x] SSH connection failure returns 500
- [x] Rate limiting triggers at 11th request
- [x] OpenAPI schema matches implementation
- [x] Exit code 0 for successful commands
- [x] Exit code non-zero for failed commands
- [x] Authentication required (401 without API key)
- [x] SSH authentication failure returns 500
- [x] Empty command returns 422
- [x] Missing action_type returns 422
- [x] Rate limit allows 10 requests per minute

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0151](US0151-ssh-executor-service.md) | Blocks | SSH Executor Service | Draft |
| [US0154](US0154-command-whitelist-enforcement.md) | Integrates | Whitelist validation | Draft |
| [US0155](US0155-command-execution-audit-trail.md) | Integrates | Audit logging | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - API integration with existing services

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0013 |
| 2026-01-29 | Claude | Implementation complete - 14 tests passing, 84% coverage |
