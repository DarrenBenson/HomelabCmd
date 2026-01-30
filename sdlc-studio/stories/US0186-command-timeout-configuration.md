# US0186: Command Timeout Configuration

> **Status:** Draft
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to configure timeouts for remediation commands
**So that** long-running commands don't hang indefinitely and I can set appropriate limits for different operations

## Context

### Persona Reference

**Darren** - Technical professional running remediation commands. Needs predictable behaviour when commands take too long.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, command timeouts are hardcoded. Different operations have different expected durations - a service restart should complete in seconds, while a package update might take minutes. Configurable timeouts allow appropriate limits for each operation type.

---

## Acceptance Criteria

### AC1: Global default timeout

- **Given** I am configuring remediation settings
- **When** I view timeout configuration
- **Then** I can set a global default timeout in seconds
- **And** the default is 300 seconds (5 minutes)

### AC2: Per-command-type timeout

- **Given** I am configuring remediation settings
- **When** I view timeout configuration
- **Then** I can set timeouts per command type:
  - Service restart: 60s default
  - Package update: 600s default
  - Custom command: uses global default

### AC3: Timeout displayed before execution

- **Given** I am approving a remediation action
- **When** I view the action details
- **Then** I see the timeout that will apply
- **And** I can override the timeout for this specific execution

### AC4: Command cancelled on timeout

- **Given** a command is executing with a 60-second timeout
- **When** 60 seconds pass without completion
- **Then** the command is cancelled/killed
- **And** the action status is set to "timed_out"
- **And** the failure is logged with duration

### AC5: Timeout visible in action history

- **Given** a command timed out
- **When** I view action history
- **Then** I see "Timed out after Xs" in the result
- **And** the status shows as failed/timed_out

### AC6: API supports timeout parameter

- **Given** I am triggering a remediation action via API
- **When** I submit the action
- **Then** I can specify `timeout_seconds` parameter
- **And** if not specified, the configured default is used

---

## Scope

### In Scope

- Global default timeout setting
- Per-command-type timeout settings
- Per-execution timeout override
- Timeout enforcement in execution
- Timeout status in action history
- API timeout parameter

### Out of Scope

- Per-server timeout configuration
- Timeout warnings (e.g., "approaching timeout")
- Timeout extension during execution

---

## Technical Notes

### Implementation Approach

1. **Timeout configuration:**
   ```python
   # In config table
   command_timeout_default: int = 300
   command_timeout_service_restart: int = 60
   command_timeout_package_update: int = 600
   ```

2. **Action schema update:**
   ```python
   class RemediationAction(Base):
       # Existing fields...
       timeout_seconds: int | None = None  # Override
       timed_out_at: datetime | None = None
   ```

3. **Execution with timeout:**
   ```python
   async def execute_command(action: RemediationAction):
       timeout = action.timeout_seconds or get_timeout_for_type(action.command_type)
       try:
           result = await asyncio.wait_for(
               run_ssh_command(action.command),
               timeout=timeout
           )
       except asyncio.TimeoutError:
           action.status = ActionStatus.TIMED_OUT
           action.timed_out_at = datetime.utcnow()
           raise CommandTimeoutError(f"Command timed out after {timeout}s")
   ```

### Files to Modify

- `backend/src/homelab_cmd/db/models/action.py` - Add timeout fields
- `backend/src/homelab_cmd/api/routes/config.py` - Timeout settings
- `backend/src/homelab_cmd/api/routes/actions.py` - Timeout parameter
- `backend/src/homelab_cmd/services/ssh.py` - Enforce timeout
- `frontend/src/pages/SettingsPage.tsx` - Timeout configuration UI
- `frontend/src/components/ActionApprovalModal.tsx` - Timeout override
- Alembic migration for new fields

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Timeout set to 0 | Use default (don't allow infinite) |
| 2 | Very short timeout (< 5s) | Warn but allow |
| 3 | Command completes just before timeout | Success, not timeout |
| 4 | Network disconnect during command | Timeout eventually triggers |
| 5 | SSH connection drops | Immediate failure, not timeout |

---

## Test Scenarios

- [ ] Default timeout applies when not specified
- [ ] Per-command-type timeout applies correctly
- [ ] Override timeout works for single execution
- [ ] Command cancelled when timeout reached
- [ ] Timed out status recorded in action
- [ ] Action history shows timeout information
- [ ] API accepts timeout_seconds parameter

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0027 | Agent command execution | Done |
| US0024 | Action queue API | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - configuration, timeout enforcement

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0004 open question |
