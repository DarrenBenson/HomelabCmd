# EP0013: Synchronous Command Execution

> **Status:** Draft
> **Owner:** Darren
> **Created:** 2026-01-26
> **Target Release:** Phase 1 (Alpha)
> **Story Points:** 23

---

## Overview

Replace the async command execution model (agent polls for commands, executes, reports back later) with synchronous SSH-based execution. When a user clicks "Restart Service" in the UI, the hub immediately SSHs to the target machine via the `homelabcmd` user, executes the command, and returns the result in real-time.

**Problem Solved:** Current async command channel is unreliable and complex. Direct SSH execution is simpler, immediate, and leverages existing infrastructure.

---

## Goals

### Primary Goals
- Execute commands synchronously via SSH
- Provide immediate feedback to user (success/failure)
- Simplify agent (remove command execution code)
- Use `homelabcmd` user with passwordless sudo
- Maintain command whitelist for security
- Provide audit trail for all commands

### Success Criteria
- Can restart services from UI with immediate result
- Command execution latency < 5 seconds
- No more "pending" actions (commands execute immediately)
- Agent code simplified (metrics only)
- 100% command execution success rate (when SSH available)

---

## User Stories

### US0151: SSH Executor Service
**Story Points:** 8
**Priority:** P0
**Dependencies:** US0079 (SSH Connection via Tailscale)

**As a** system administrator
**I want** commands to execute via SSH immediately
**So that** I get instant feedback on success/failure

**Acceptance Criteria:**
- [ ] SSH executor service implemented using `asyncssh`
- [ ] Connects to `{ssh_username}@{tailscale_hostname}` (default: `homelabcmd`)
- [ ] Connection pooling: reuse connections for 5 minutes
- [ ] Command execution timeout: 30 seconds (configurable)
- [ ] Returns: exit code, stdout, stderr, duration
- [ ] Error handling: connection timeout, authentication failure, command timeout
- [ ] Logging: every command execution logged with timestamp
- [ ] Retry logic: 3 attempts with exponential backoff on connection failure

**Technical Notes:**
- Use `asyncssh` for async SSH connections:
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

          # Create new connection
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

**Test Scenarios:**
- Valid command → success with stdout
- Invalid command → exit code 1 with stderr
- Connection timeout → retry then fail with clear error
- Command timeout → kill process, return timeout error

---

### US0152: Remove Async Command Channel from Agent
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0151

**As a** developer
**I want** to simplify the agent by removing command execution
**So that** the agent only does metrics collection

**Acceptance Criteria:**
- [ ] Remove `pending_commands` from heartbeat response schema
- [ ] Remove `command_results` from heartbeat request schema
- [ ] Remove command execution code from agent
- [ ] Remove command queue/state management from agent
- [ ] Agent PR tested on at least 2 servers before deployment
- [ ] Backward compatibility: hub gracefully handles v1.0 agents during migration
- [ ] Agent deployment documentation updated

**Technical Notes:**
- Agent v1.0 (old):
  ```python
  # POST heartbeat with metrics + command results
  response = httpx.post("/api/v1/agents/heartbeat", json={
      "metrics": {...},
      "command_results": [...]  # Remove this
  })

  # Execute pending commands from response
  pending = response.json()["pending_commands"]  # Remove this
  execute_commands(pending)
  ```

- Agent v2.0 (new):
  ```python
  # POST heartbeat with just metrics
  httpx.post("/api/v1/agents/heartbeat", json={
      "metrics": {...}
  })
  # That's it - no command execution
  ```

**Migration Strategy:**
- Deploy hub v2.0 first (accepts both old and new agent format)
- Deploy simplified agents gradually
- Hub logs warning if agent sends `command_results` (deprecated)

---

### US0153: Synchronous Command Execution API
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0151

**As a** frontend developer
**I want** a synchronous command execution API
**So that** I can show immediate results to users

**Acceptance Criteria:**
- [ ] POST `/api/v1/machines/{id}/commands/execute` endpoint
- [ ] Request body: `{ "command": "systemctl restart nginx", "action_type": "restart_service" }`
- [ ] Response: `{ "exit_code": 0, "stdout": "...", "stderr": "...", "duration_ms": 1234 }`
- [ ] Status codes: 200 (success), 400 (invalid command), 408 (timeout), 500 (SSH error)
- [ ] Command whitelist validation (only allowed commands)
- [ ] Audit log entry created for every execution
- [ ] Rate limiting: max 10 commands per minute per user
- [ ] OpenAPI documentation

**Technical Notes:**
- Endpoint implementation:
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

      # Validate command against whitelist
      if not is_whitelisted(request.command, request.action_type):
          raise HTTPException(400, "Command not in whitelist")

      # Execute via SSH
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

      # Create audit log
      create_audit_log(machine_id, request.command, result)

      return CommandExecuteResponse(
          exit_code=result.exit_code,
          stdout=result.stdout,
          stderr=result.stderr,
          duration_ms=result.duration_ms
      )
  ```

**API Schemas:**
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

---

### US0154: Command Whitelist Enforcement
**Story Points:** 4
**Priority:** P0
**Dependencies:** US0153

**As a** system administrator
**I want** only whitelisted commands to execute
**So that** the system is secure against command injection

**Acceptance Criteria:**
- [ ] Command whitelist defined in configuration
- [ ] Whitelist includes patterns with parameter validation
- [ ] Action types: `restart_service`, `apply_updates`, `clear_logs`, `custom` (admin-defined)
- [ ] Service names validated (alphanumeric, hyphen, underscore only)
- [ ] No shell metacharacters in parameters (;, |, &, `, $, etc.)
- [ ] Custom commands require explicit admin approval (stored in DB)
- [ ] Whitelist modification requires restart (security-critical config)
- [ ] Logs all whitelist violations

**Technical Notes:**
- Whitelist configuration:
  ```python
  COMMAND_WHITELIST = {
      "restart_service": {
          "pattern": "systemctl restart {service_name}",
          "param_validation": {
              "service_name": r"^[a-zA-Z0-9_-]+$"
          }
      },
      "apply_updates": {
          "pattern": "apt-get update && apt-get upgrade -y",
          "param_validation": {}
      },
      "clear_logs": {
          "pattern": "journalctl --vacuum-time=7d",
          "param_validation": {}
      }
  }

  def is_whitelisted(command: str, action_type: str) -> bool:
      if action_type not in COMMAND_WHITELIST:
          return False

      whitelist_entry = COMMAND_WHITELIST[action_type]
      pattern = whitelist_entry["pattern"]

      # Extract parameters from command
      params = extract_params(command, pattern)

      # Validate each parameter
      for param_name, regex in whitelist_entry["param_validation"].items():
          if not re.match(regex, params[param_name]):
              logger.warning(f"Parameter validation failed: {param_name}={params[param_name]}")
              return False

      return True
  ```

**Security Validations:**
- No shell metacharacters: `;`, `|`, `&`, `` ` ``, `$()`, `>`, `<`
- No path traversal: `..`, `/etc/`, `/root/`
- Service name constraints: max 64 chars, alphanumeric + hyphen/underscore only

---

### US0155: Command Execution Audit Trail
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0153

**As a** security auditor
**I want** complete audit trail of all command executions
**So that** I can review what was executed and when

**Acceptance Criteria:**
- [ ] Every command execution creates audit log entry
- [ ] Audit log stores: machine_id, command, action_type, exit_code, stdout (truncated), stderr (truncated), duration, executed_at, executed_by
- [ ] Audit log immutable (append-only, no updates/deletes)
- [ ] GET `/api/v1/audit/commands` endpoint with filtering
- [ ] Filter by: machine_id, action_type, date range, exit_code (success/failure)
- [ ] Pagination support (100 entries per page)
- [ ] Export audit log to CSV
- [ ] Retention policy: 90 days (configurable)

**Technical Notes:**
- Database table:
  ```sql
  CREATE TABLE command_audit_log (
      id UUID PRIMARY KEY,
      machine_id UUID NOT NULL REFERENCES machine(id),
      command TEXT NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      exit_code INTEGER,
      stdout TEXT,  -- Truncated to 10KB
      stderr TEXT,  -- Truncated to 10KB
      duration_ms INTEGER,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      executed_by VARCHAR(255) DEFAULT 'dashboard'
  );

  CREATE INDEX idx_command_audit_machine ON command_audit_log(machine_id, executed_at DESC);
  CREATE INDEX idx_command_audit_type ON command_audit_log(action_type, executed_at DESC);
  ```

**Audit Log UI:**
```
┌────────────────────────────────────────────────────────┐
│ Command Audit Log                  [Export CSV]        │
├────────────────────────────────────────────────────────┤
│ Filters:                                               │
│ Machine: [All ▼]  Type: [All ▼]  Status: [All ▼]      │
│                                                        │
│ Time           Machine      Command           Result  │
│ ──────────────────────────────────────────────────────│
│ 2026-01-25     HOMESERVER   systemctl restart   ✓ 0   │
│ 20:15:32                    nginx                      │
│                                                        │
│ 2026-01-25     MEDIASERVER  apt-get upgrade -y   ✓ 0   │
│ 19:45:10                                               │
│                                                        │
│ 2026-01-25     BACKUPSERVER systemctl restart   ✗ 1   │
│ 18:30:22                    mysql                      │
│                                                        │
│                       Page 1 of 45        [Next →]    │
└────────────────────────────────────────────────────────┘
```

---

### US0156: Real-Time Command Output (Optional)
**Story Points:** 5
**Priority:** P2 (Deferred to v2.1)
**Dependencies:** US0153

**As a** system administrator
**I want** to see command output in real-time
**So that** I can monitor long-running commands

**Acceptance Criteria:**
- [ ] WebSocket endpoint for streaming command output
- [ ] Frontend shows live stdout/stderr as command runs
- [ ] Progress indicator for long commands (apt updates)
- [ ] Graceful handling if WebSocket unsupported (fallback to polling)
- [ ] Connection timeout after command completes
- [ ] Multiple users can watch same command execution

**Technical Notes:**
- This is complex and deferred to v2.1
- For v2.0, commands run synchronously and return final output
- Most commands complete in < 5 seconds, so real-time not critical

---

## Technical Architecture

### Command Execution Flow

```
User clicks "Restart nginx" in UI
    ↓
POST /api/v1/machines/{id}/commands/execute
    {
      "command": "systemctl restart nginx",
      "action_type": "restart_service"
    }
    ↓
Hub validates command against whitelist
    ↓
Hub gets SSH connection from pool (or creates new)
    ↓
Hub executes: ssh homelabcmd@homeserver.tail-abc123.ts.net 'systemctl restart nginx'
    ↓
Hub waits for completion (max 30s)
    ↓
Hub receives: exit_code=0, stdout="", stderr=""
    ↓
Hub creates audit log entry
    ↓
Hub returns response to frontend:
    {
      "exit_code": 0,
      "stdout": "",
      "stderr": "",
      "duration_ms": 1234
    }
    ↓
Frontend shows success: "✓ Service restarted successfully (1.2s)"
```

### Comparison: v1.0 vs v2.0

**v1.0 (Async - Problematic):**
```
1. User clicks "Restart nginx"
2. Hub creates RemediationAction (status=pending)
3. Agent polls for commands in next heartbeat (up to 60s delay)
4. Agent executes command
5. Agent reports result in next heartbeat (up to 60s delay)
6. Hub updates RemediationAction (status=completed)
7. User sees result (2-4 minutes total)

Problems:
- High latency (2-4 min)
- State management complex
- Timing issues (what if agent crashes?)
- No real-time feedback
```

**v2.0 (Sync - Better):**
```
1. User clicks "Restart nginx"
2. Hub SSHs to machine immediately
3. Command executes (1-5s)
4. Hub returns result
5. User sees result (1-5 seconds total)

Benefits:
- Low latency (1-5s)
- No state management
- Simple error handling
- Real-time feedback
```

---

## Dependencies

**Backend:**
- `asyncssh>=2.14.0` (new) - SSH client library
- SSH private key for `homelabcmd` user

**Infrastructure:**
- `homelabcmd` user on all machines with passwordless sudo
- SSH key deployed to all machines' `/home/homelabcmd/.ssh/authorized_keys`
- Tailscale running (for stable hostnames)

---

## Testing Strategy

### Unit Tests
- Command whitelist validation
- Parameter extraction and validation
- SSH connection pooling logic
- Audit log creation

### Integration Tests
- Execute command on test machine via SSH
- Command timeout handling
- Connection failure and retry logic
- Whitelist enforcement (reject invalid commands)
- Audit log persistence

### E2E Tests
- User clicks "Restart Service" → service restarts
- User clicks "Apply Updates" → updates applied
- Invalid command rejected with error
- Audit log shows executed commands

---

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Command injection | Whitelist + parameter validation |
| Privilege escalation | `homelabcmd` user has limited sudo (only whitelisted commands) |
| SSH key theft | Encrypted storage, file permissions (600) |
| Unauthorized access | API key authentication, audit logging |

### SSH Key Security

- Store private key in `/run/secrets/id_homelabcmd` (Docker secret or mounted volume)
- File permissions: `chmod 600`
- Never commit key to git
- Rotate key quarterly

---

## Migration Strategy

### Phase 1: Deploy Hub v2.0
- Deploy hub with new SSH executor
- Keep old agent heartbeat endpoint compatible
- Test SSH execution on 1-2 servers

### Phase 2: Validate
- Verify SSH connections work
- Test command execution from UI
- Check audit logs

### Phase 3: Update Agents
- Deploy simplified agents (metrics only)
- Remove old agent code from all servers
- Confirm metrics still flowing

### Phase 4: Cleanup
- Remove deprecated heartbeat response fields
- Remove old RemediationAction approval workflow UI
- Update documentation

---

## Future Enhancements (Deferred)

- Real-time command output streaming (WebSocket)
- Command scheduling (execute at specific time)
- Bulk command execution (same command to multiple machines)
- Command templates (user-defined with parameters)
- Dry-run mode (show what would execute without running)

---

## Story Breakdown

| Story | Description | Points | Phase |
|-------|-------------|--------|-------|
| US0151 | SSH Executor Service | 8 | 1 |
| US0152 | Remove Async Command Channel from Agent | 3 | 1 |
| US0153 | Synchronous Command Execution API | 5 | 1 |
| US0154 | Command Whitelist Enforcement | 4 | 1 |
| US0155 | Command Execution Audit Trail | 3 | 1 |
| US0156 | Real-Time Command Output (Optional) | 5 | 2 (Deferred) |
| **Total** | | **28** (23 for Phase 1) | |

---

**Created:** 2026-01-25
**Last Updated:** 2026-01-28
**Epic Owner:** Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-25 | Darren | Initial epic creation |
| 2026-01-28 | Claude | Renumbered stories US0089-US0094 to US0151-US0156 to resolve conflicts with EP0009/EP0016 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-29 | Claude | Status corrected from Done to Draft - implementation not started. SSH executor exists (EP0008) but sync command execution, whitelist, and audit trail not implemented. |
