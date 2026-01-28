# US0027: Agent Command Execution

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5
> **Updated:** 2026-01-19
> **Plan:** [PL0031](../plans/PL0031-agent-command-execution.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** the agent to execute approved commands on the server
**So that** remediation actions are performed without manual SSH

## Context

### Persona Reference

**Darren** - Main goal is to avoid SSH for routine fixes. Wants secure, controlled command execution.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When the agent receives a command via heartbeat response, it executes the command locally, captures the output, and reports the result back to the hub. Execution is sandboxed to whitelisted commands only.

## Acceptance Criteria

### AC1: Execute received command

- **Given** agent receives command "systemctl restart plex"
- **When** processing the heartbeat response
- **Then** the command is executed on the local system

### AC2: Capture stdout and stderr

- **Given** a command execution
- **When** the command completes
- **Then** stdout, stderr, and exit code are captured

### AC3: Command timeout enforced

- **Given** a command with 30 second timeout
- **When** execution exceeds 30 seconds
- **Then** the process is killed and failure reported

### AC4: Whitelist validation rejects unknown commands

- **Given** agent receives command "rm -rf /"
- **When** comparing against local whitelist regex patterns
- **Then** execution is refused with error "Command not in whitelist"

### AC5: Sudo handling

- **Given** a command requiring sudo
- **When** agent is configured with sudo access
- **Then** command executes with appropriate privileges

### AC6: DNS server protection

- **Given** a restart action for a Pi-hole server
- **When** another Pi-hole restart was executed in the last 30 minutes
- **Then** execution is delayed by 30 minutes to prevent DNS outage

## Scope

### In Scope

- Agent command execution module
- Output capture (stdout, stderr, exit code)
- Timeout handling
- Local whitelist validation (regex-based)
- Sudo configuration
- Execution logging
- DNS server protection (staggered restarts for Pi-hole)

### Out of Scope

- Result reporting (handled by US0025 via heartbeat)
- Custom scripts
- Interactive commands
- Environment variable injection

## Technical Notes

### Agent Implementation

```python
import subprocess
import asyncio

COMMAND_WHITELIST = {
    'restart_service': r'^systemctl restart [a-zA-Z0-9_-]+$',
    'clear_logs': r'^journalctl --vacuum-time=\d+d$',
    'apply_updates': r'^apt update && apt upgrade -y$',
}

async def execute_command(action_id: int, command: str, timeout: int = 30) -> dict:
    # Validate against whitelist
    if not is_whitelisted(command):
        return {
            'action_id': action_id,
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': 'Command not in whitelist',
        }

    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=timeout
        )
        return {
            'action_id': action_id,
            'success': proc.returncode == 0,
            'exit_code': proc.returncode,
            'stdout': stdout.decode()[:10000],  # Limit output size
            'stderr': stderr.decode()[:10000],
        }
    except asyncio.TimeoutError:
        proc.kill()
        return {
            'action_id': action_id,
            'success': False,
            'exit_code': -1,
            'stdout': '',
            'stderr': f'Command timed out after {timeout} seconds',
        }
```

### Agent Configuration

```yaml
# /etc/homelab-agent/config.yaml
command_execution:
  enabled: true
  use_sudo: true
  timeout_seconds: 30
  whitelist:
    - 'systemctl restart *'
    - 'journalctl --vacuum-time=*'
    - 'apt update && apt upgrade -y'
```

### Data Requirements

- Output truncated to prevent memory issues (10KB limit)
- Exit codes captured accurately
- Timeout configurable per command or globally

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Command not found | exit_code=127, stderr contains error |
| Permission denied | exit_code=1, stderr contains permission error |
| Process killed (timeout) | exit_code=-1, stderr contains timeout message |
| Command in whitelist but fails | Capture actual error for debugging |
| Agent lacks sudo | Fail gracefully with clear error message |
| Command not in whitelist | exit_code=-1, stderr="Command not in whitelist" |
| Pi-hole restart too soon | Execution delayed, status="delayed", scheduled time returned |
| Both Pi-holes need restart | Second one delayed by 30 minutes |

## Test Scenarios

- [ ] Valid command executes successfully
- [ ] Output captured correctly
- [ ] Exit code captured correctly
- [ ] Timeout kills long-running command
- [ ] Non-whitelisted command refused with clear error
- [ ] Large output truncated
- [ ] Sudo commands work when configured
- [ ] Sudo commands fail gracefully without config
- [ ] Pi-hole restart delayed if recent restart exists
- [ ] Concurrent Pi-hole restarts staggered by 30 minutes
- [ ] Whitelist regex patterns validated thoroughly

## Definition of Done


**Story-specific additions:**

- [ ] Agent tested on actual systemd service
- [ ] Security review of command execution
- [ ] Whitelist regex tested thoroughly

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0004: Agent Script | Story | Done |
| US0025: Heartbeat Command Channel | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - security-sensitive command execution

## Open Questions

- [ ] How to handle commands that require sudo - Owner: Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | QA enhancement: Added explicit whitelist validation AC, DNS server protection (Pi-hole stagger rule) |
| 2026-01-19 | Claude | Updated dependencies (US0028 merged into US0025) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
