# US0151: SSH Executor Service

> **Status:** Done
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Story Points:** 8

## User Story

**As a** system administrator
**I want** commands to execute via SSH immediately
**So that** I get instant feedback on success/failure

## Context

### Background

The current async command channel (agent polls, executes, reports back) introduces 2-4 minute delays and complex state management. Direct SSH execution provides immediate feedback and simplifies the architecture.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | Command latency < 5 seconds | AC1: duration tracked |
| PRD | Security | Authentication required | AC3: SSH key auth |
| EP0008 | Dependency | US0079 SSH Connection via Tailscale | Prerequisite |

---

## Acceptance Criteria

### AC1: SSH Command Execution
- **Given** a server with Tailscale hostname and SSH configured
- **When** a command is executed via the SSH executor
- **Then** the command runs on the target machine and returns exit code, stdout, stderr, and duration

### AC2: Connection Pooling
- **Given** multiple commands to the same server within 5 minutes
- **When** subsequent commands are executed
- **Then** the existing SSH connection is reused from the pool

### AC3: Error Handling
- **Given** a connection or execution failure
- **When** the executor encounters a timeout, auth failure, or network error
- **Then** appropriate retries (3 attempts with exponential backoff) are attempted and clear errors returned

### AC4: Execution Logging
- **Given** any command execution
- **When** the command completes (success or failure)
- **Then** the execution is logged with timestamp, command, machine, and result

---

## Scope

### In Scope
- `SSHExecutor` class with `asyncssh` library
- Connection pooling with 5-minute expiry
- Command execution with configurable timeout (default 30s)
- Retry logic with exponential backoff
- Execution logging

### Out of Scope
- Command whitelist validation (US0154)
- Audit trail persistence (US0155)
- Real-time output streaming (US0156 - deferred)

---

## Technical Notes

### Implementation
```python
class SSHExecutor:
    def __init__(self):
        self.connections: Dict[UUID, Tuple[asyncssh.SSHClientConnection, float]] = {}
        self.ssh_username = "homelabcmd"
        self.ssh_key_path = "/run/secrets/id_homelabcmd"

    async def execute(
        self,
        machine: Machine,
        command: str,
        timeout: int = 30
    ) -> CommandResult:
        conn = await self._get_connection(machine)

        start = time.time()
        result = await asyncio.wait_for(
            conn.run(command, check=False),
            timeout=timeout
        )
        duration = time.time() - start

        return CommandResult(
            exit_code=result.exit_status,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=int(duration * 1000)
        )

    async def _get_connection(self, machine: Machine):
        # Check connection pool
        if machine.id in self.connections:
            conn, expire_time = self.connections[machine.id]
            if time.time() < expire_time and not conn.is_closed():
                return conn

        # Create new connection with retry
        conn = await asyncssh.connect(
            host=machine.tailscale_hostname,
            username=self.ssh_username,
            client_keys=[self.ssh_key_path],
            known_hosts=None,
            connect_timeout=10
        )

        # Store in pool (5 min expiry)
        self.connections[machine.id] = (conn, time.time() + 300)
        return conn
```

### API Contracts
- `CommandResult` schema: `exit_code`, `stdout`, `stderr`, `duration_ms`
- Integrates with existing `CredentialService` for SSH key retrieval

### Data Requirements
- Machine must have `tailscale_hostname` set
- SSH key must be configured (from US0079)

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Connection timeout | Retry 3 times with exponential backoff, then raise `ConnectionError` |
| Authentication failure | Raise `AuthenticationError` with clear message |
| Command timeout (30s) | Kill process, return timeout error with partial output |
| Connection dropped mid-command | Retry command on new connection |
| Invalid hostname | Raise `ConnectionError` with hostname in message |
| Pool connection expired | Create new connection transparently |
| SSH key not found | Raise `ConfigurationError` with path in message |
| Machine has no tailscale_hostname | Raise `ValueError` before attempting connection |
| Empty command string | Raise `ValueError` with "Command cannot be empty" |
| Network unreachable | Retry 3 times, then raise `ConnectionError` with network details |

---

## Test Scenarios

- [ ] Valid command returns success with stdout
- [ ] Invalid command returns exit code 1 with stderr
- [ ] Connection timeout triggers retry logic (3 attempts)
- [ ] Command timeout (30s) returns timeout error
- [ ] Authentication failure returns clear error message
- [ ] Connection pooling reuses existing connection within 5 minutes
- [ ] Pool expiry (>5 min) creates new connection
- [ ] Multiple concurrent commands to same server work
- [ ] SSH key not found raises ConfigurationError
- [ ] Machine without tailscale_hostname raises ValueError
- [ ] Empty command raises ValueError
- [ ] Exponential backoff timing verified (1s, 2s, 4s)

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0079](US0079-ssh-connection-via-tailscale.md) | Blocks | SSH Connection via Tailscale | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| `asyncssh>=2.14.0` | Library | To add |
| Tailscale running on hub | Infrastructure | Done |
| `homelabcmd` user on targets | Infrastructure | Required |

---

## Estimation

**Story Points:** 8
**Complexity:** High - New async SSH infrastructure with pooling and retry logic

---

## Open Questions

None - technical approach clear from epic.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0013 |
