# PL0031: Agent Command Execution - Implementation Plan

> **Status:** Complete
> **Story:** [US0027: Agent Command Execution](../stories/US0027-agent-command-execution.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Implement command execution capability in the agent. When the agent receives a pending command via heartbeat response, it validates the command against a local whitelist, executes it with timeout protection, captures output, and reports results in the next heartbeat. This completes the remediation loop from hub to agent.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Execute received command | Agent executes command from heartbeat response |
| AC2 | Capture stdout/stderr | stdout, stderr, and exit code captured |
| AC3 | Command timeout | Process killed after timeout with failure reported |
| AC4 | Whitelist validation | Non-whitelisted commands rejected with error |
| AC5 | Sudo handling | Commands execute with sudo when configured |
| AC6 | DNS server protection | Pi-hole restarts staggered by 30 minutes |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** Standalone agent script (asyncio for subprocess)
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

- Use asyncio subprocess for non-blocking execution
- Validate commands against regex whitelist before execution
- Truncate output to prevent memory issues (10KB limit)
- Log all command executions for audit trail
- Store execution results for reporting in next heartbeat

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| asyncio | Python stdlib | subprocess timeout | `asyncio.wait_for()`, `create_subprocess_shell()` |

### Existing Patterns

From `agent/heartbeat.py`:
- HTTP communication with hub via httpx
- Heartbeat payload construction
- Retry logic for transient failures

From `backend/src/homelab_cmd/api/schemas/heartbeat.py`:
- `PendingCommand` schema: action_id, action_type, command, parameters, timeout_seconds
- `CommandResultPayload` schema: action_id, exit_code, stdout, stderr, executed_at, completed_at

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Agent code runs outside of pytest fixtures. Command execution requires async subprocess which is straightforward to implement. Focus on correctness, then add unit tests for whitelist validation and mocked execution tests.

### Test Priority

1. TC162: Agent executes whitelisted commands
2. TC163: Agent rejects non-whitelisted commands
3. TC164: Agent reports results in heartbeat

### Documentation Updates Required

- [ ] Update TS0009 automation status after tests pass
- [ ] Update US0027 status to Review/Done

## Implementation Steps

### Phase 1: Create Executor Module

**Goal:** Add new module for command execution with whitelist validation

#### Step 1.1: Create agent/executor.py with whitelist constants

- [ ] Define `COMMAND_WHITELIST` dict with action_type -> regex pattern
- [ ] Implement `is_whitelisted(command: str) -> bool` function
- [ ] Support patterns: restart_service, clear_logs, apply_updates

**Files to create:**
- `agent/executor.py`

**Implementation:**
```python
"""Command execution module for the HomelabCmd agent (US0027).

This module handles secure command execution with whitelist validation,
timeout enforcement, and output capture.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

# Maximum output size (10KB as per US0025)
MAX_OUTPUT_SIZE = 10000

# Default command timeout in seconds
DEFAULT_TIMEOUT = 30

# Command whitelist patterns (US0027 - AC4)
# Each pattern is a regex that commands must match
COMMAND_WHITELIST: dict[str, str] = {
    "restart_service": r"^systemctl restart [a-zA-Z0-9_-]+$",
    "clear_logs": r"^journalctl --vacuum-time=\d+[dhms]$",
    "apply_updates": r"^apt update && apt upgrade -y$",
}


def is_whitelisted(command: str) -> bool:
    """Check if a command matches any whitelist pattern.

    Args:
        command: The shell command to validate

    Returns:
        True if command matches a whitelist pattern, False otherwise
    """
    for pattern in COMMAND_WHITELIST.values():
        if re.match(pattern, command):
            return True
    return False
```

---

#### Step 1.2: Implement execute_command async function

- [ ] Implement `execute_command(action_id, command, timeout) -> CommandResult`
- [ ] Validate command against whitelist first
- [ ] Use `asyncio.create_subprocess_shell()` for execution
- [ ] Use `asyncio.wait_for()` for timeout enforcement
- [ ] Capture stdout, stderr, exit_code
- [ ] Truncate output to MAX_OUTPUT_SIZE
- [ ] Handle TimeoutError by killing process

**Files to modify:**
- `agent/executor.py` - Add execute_command function

**Implementation:**
```python
@dataclass
class CommandResult:
    """Result of command execution."""

    action_id: int
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    executed_at: datetime
    completed_at: datetime


async def execute_command(
    action_id: int,
    command: str,
    timeout: int = DEFAULT_TIMEOUT,
    use_sudo: bool = False,
) -> CommandResult:
    """Execute a command with whitelist validation and timeout.

    Args:
        action_id: ID of the action being executed
        command: Shell command to execute
        timeout: Maximum execution time in seconds
        use_sudo: Whether to prefix command with sudo

    Returns:
        CommandResult with execution details
    """
    executed_at = datetime.now(UTC)

    # Validate against whitelist (AC4)
    if not is_whitelisted(command):
        logger.warning("Command not in whitelist: %s", command)
        return CommandResult(
            action_id=action_id,
            success=False,
            exit_code=-1,
            stdout="",
            stderr="Command not in whitelist",
            executed_at=executed_at,
            completed_at=datetime.now(UTC),
        )

    # Optionally prefix with sudo (AC5)
    exec_command = f"sudo {command}" if use_sudo else command

    logger.info("Executing command (action %d): %s", action_id, exec_command)

    try:
        proc = await asyncio.create_subprocess_shell(
            exec_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Wait with timeout (AC3)
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=timeout,
        )

        completed_at = datetime.now(UTC)
        exit_code = proc.returncode or 0

        # Truncate output to prevent memory issues (AC2)
        stdout_str = stdout.decode(errors="replace")[:MAX_OUTPUT_SIZE]
        stderr_str = stderr.decode(errors="replace")[:MAX_OUTPUT_SIZE]

        logger.info(
            "Command completed (action %d): exit_code=%d",
            action_id,
            exit_code,
        )

        return CommandResult(
            action_id=action_id,
            success=exit_code == 0,
            exit_code=exit_code,
            stdout=stdout_str,
            stderr=stderr_str,
            executed_at=executed_at,
            completed_at=completed_at,
        )

    except asyncio.TimeoutError:
        logger.warning(
            "Command timed out after %d seconds (action %d)",
            timeout,
            action_id,
        )
        # Kill the process
        try:
            proc.kill()
            await proc.wait()
        except Exception:
            pass

        return CommandResult(
            action_id=action_id,
            success=False,
            exit_code=-1,
            stdout="",
            stderr=f"Command timed out after {timeout} seconds",
            executed_at=executed_at,
            completed_at=datetime.now(UTC),
        )

    except Exception as e:
        logger.exception("Command execution failed (action %d): %s", action_id, e)
        return CommandResult(
            action_id=action_id,
            success=False,
            exit_code=-1,
            stdout="",
            stderr=str(e),
            executed_at=executed_at,
            completed_at=datetime.now(UTC),
        )
```

---

### Phase 2: Add Configuration Support

**Goal:** Extend agent config to support command execution settings

#### Step 2.1: Add execution config to AgentConfig

- [ ] Add `command_execution_enabled: bool = False`
- [ ] Add `use_sudo: bool = False`
- [ ] Add `command_timeout: int = 30`
- [ ] Parse from YAML config file

**Files to modify:**
- `agent/config.py` - Add command execution fields

**Implementation:**
```python
@dataclass
class AgentConfig:
    """Agent configuration loaded from YAML file."""

    hub_url: str
    server_id: str
    api_key: str
    heartbeat_interval: int = DEFAULT_HEARTBEAT_INTERVAL
    monitored_services: list[str] | None = None
    # Command execution settings (US0027)
    command_execution_enabled: bool = False
    use_sudo: bool = False
    command_timeout: int = 30
```

---

### Phase 3: Integrate with Heartbeat Loop

**Goal:** Process pending commands from heartbeat response and report results

#### Step 3.1: Add pending results storage

- [ ] Add module-level storage for pending results
- [ ] Results stored until acknowledged by hub

**Files to modify:**
- `agent/heartbeat.py` - Add result storage

#### Step 3.2: Update send_heartbeat to include command_results

- [ ] Accept `command_results` parameter
- [ ] Include in heartbeat payload when present
- [ ] Clear results after acknowledgment

**Files to modify:**
- `agent/heartbeat.py` - Update payload

#### Step 3.3: Add process_pending_commands function

- [ ] Parse `pending_commands` from heartbeat response
- [ ] Execute each command via executor module
- [ ] Store results for next heartbeat

**Files to modify:**
- `agent/heartbeat.py` - Add command processing

#### Step 3.4: Update main loop to handle commands

- [ ] Check heartbeat response for pending_commands
- [ ] Process commands asynchronously
- [ ] Include results in next heartbeat

**Files to modify:**
- `agent/__main__.py` - Update main loop

---

### Phase 4: DNS Server Protection (Pi-hole)

**Goal:** Implement staggered restarts for DNS servers

#### Step 4.1: Add Pi-hole restart tracking

- [ ] Track last Pi-hole restart timestamp per server
- [ ] Implement 30-minute delay for subsequent restarts (AC6)
- [ ] Store in local file or memory

**Files to modify:**
- `agent/executor.py` - Add Pi-hole protection

**Implementation pattern:**
```python
# Last Pi-hole restart timestamps (server_id -> datetime)
_pihole_last_restart: dict[str, datetime] = {}
PIHOLE_RESTART_DELAY = 30 * 60  # 30 minutes in seconds

def check_pihole_delay(command: str, server_id: str) -> tuple[bool, int]:
    """Check if Pi-hole restart should be delayed.

    Returns:
        Tuple of (should_delay, delay_seconds)
    """
    if "pihole" not in command.lower():
        return (False, 0)

    last_restart = _pihole_last_restart.get(server_id)
    if last_restart is None:
        return (False, 0)

    elapsed = (datetime.now(UTC) - last_restart).total_seconds()
    if elapsed < PIHOLE_RESTART_DELAY:
        remaining = int(PIHOLE_RESTART_DELAY - elapsed)
        return (True, remaining)

    return (False, 0)
```

---

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Write unit tests for whitelist validation

- [ ] Test valid commands match patterns
- [ ] Test invalid commands rejected
- [ ] Test edge cases (partial matches, injection attempts)

**Files to create:**
- `tests/test_agent_executor.py`

#### Step 5.2: Write integration tests for command execution

- [ ] TC162: Execute whitelisted command (mocked subprocess)
- [ ] TC163: Reject non-whitelisted command
- [ ] TC164: Results included in heartbeat

**Files to modify:**
- `tests/test_agent_executor.py` - Add integration tests

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test command execution via mocked subprocess | Pending |
| AC2 | Test stdout/stderr/exit_code captured | Pending |
| AC3 | Test timeout kills process | Pending |
| AC4 | Test non-whitelisted commands rejected | Pending |
| AC5 | Test sudo prefix when configured | Pending |
| AC6 | Test Pi-hole delay enforcement | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Command not found | exit_code=127, stderr contains error |
| Permission denied | exit_code=1, stderr contains permission error |
| Process killed (timeout) | exit_code=-1, stderr contains timeout message |
| Command in whitelist but fails | Capture actual error for debugging |
| Agent lacks sudo | Fail gracefully with clear error message |
| Command not in whitelist | exit_code=-1, stderr="Command not in whitelist" |
| Large output | Truncate to 10KB |
| Hub unreachable | Store results, retry on next heartbeat |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Command injection | High | Regex whitelist validation before execution |
| Runaway process | Medium | Timeout enforcement with process kill |
| Memory exhaustion | Low | Output truncation to 10KB |
| Sudo misconfiguration | Medium | Clear error messages, graceful degradation |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0004: Agent Script | Story | Complete - provides agent framework |
| US0025: Heartbeat Command Channel | Story | Complete - provides command delivery |

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| How to handle sudo - NOPASSWD in sudoers? | Darren | Open - document recommendation |

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests for whitelist validation
- [ ] Integration tests for command execution (mocked)
- [ ] Edge cases handled
- [ ] Code follows existing patterns
- [ ] No linting errors
- [ ] Ready for code review

## Notes

This is a 5-point story due to security-sensitive nature of command execution. The whitelist validation is critical for preventing arbitrary command injection. The implementation uses asyncio for non-blocking execution with proper timeout handling.

Key security considerations:
1. Regex patterns must be carefully crafted to prevent injection
2. No shell metacharacter expansion in whitelist patterns
3. Output truncation prevents memory attacks
4. Timeout enforcement prevents resource exhaustion

The Pi-hole stagger rule (AC6) is specific to DNS server protection - if both Pi-holes restart simultaneously, the network loses DNS resolution.
