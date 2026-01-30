# PL0188: SSH Executor Service - Implementation Plan

> **Status:** Complete
> **Story:** [US0151: SSH Executor Service](../stories/US0151-ssh-executor-service.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Language:** Python

## Overview

Extend the existing `SSHPooledExecutor` (from EP0008/US0079) to add command execution capabilities. The executor already handles connection pooling, retry logic, and host key verification. This story adds the `execute()` method to run commands and return structured results.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | SSH Command Execution | Execute command via SSH, return exit_code, stdout, stderr, duration_ms |
| AC2 | Connection Pooling | Reuse existing connections within 5-minute TTL (already implemented) |
| AC3 | Error Handling | Retry on transient failures, clear errors for auth/timeout |
| AC4 | Execution Logging | Log every execution with timestamp, command, machine, result |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI (backend)
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices
- Use `asyncio.wait_for()` for command timeouts
- Use `paramiko.SSHClient.exec_command()` for command execution
- Return structured `CommandResult` dataclass
- Log at INFO level for executions, WARNING for retries, ERROR for failures

### Existing Patterns
- `SSHPooledExecutor` in `backend/src/homelab_cmd/services/ssh_executor.py`
- Connection pooling with 5-minute TTL
- Retry logic (3 attempts, 2s delay) for transient failures
- Host key TOFU verification via `HostKeyService`
- Credential retrieval via `CredentialService`

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Extending existing code with well-defined behaviour. Write implementation first, then comprehensive tests.

### Test Priority
1. Valid command execution returns correct exit_code, stdout, stderr
2. Command timeout (30s) kills process and returns error
3. Connection pooling reuses existing connection (integration with existing pool)

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add `CommandResult` dataclass | `ssh_executor.py` | - | [x] |
| 2 | Add `CommandTimeoutError` exception | `ssh_executor.py` | - | [x] |
| 3 | Implement `execute()` method | `ssh_executor.py` | 1, 2 | [x] |
| 4 | Add execution logging | `ssh_executor.py` | 3 | [x] |
| 5 | Add empty command validation | `ssh_executor.py` | 3 | [x] |
| 6 | Write unit tests | `tests/test_ssh_executor_commands.py` | 1-5 | [x] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2 | None - can run in parallel |
| B | 3, 4, 5 | Group A complete |
| C | 6 | Group B complete |

---

## Implementation Phases

### Phase 1: Data Structures
**Goal:** Define CommandResult and CommandTimeoutError

- [ ] Add `CommandResult` dataclass with exit_code, stdout, stderr, duration_ms
- [ ] Add `CommandTimeoutError` exception for 30s timeout

**Files:** `backend/src/homelab_cmd/services/ssh_executor.py` - Add dataclass and exception

### Phase 2: Execute Method
**Goal:** Implement command execution with timeout

- [ ] Implement `execute(machine, command, timeout=30)` method
- [ ] Use `exec_command()` for command execution
- [ ] Use `asyncio.wait_for()` for timeout enforcement
- [ ] Track duration in milliseconds
- [ ] Validate command not empty

**Files:** `backend/src/homelab_cmd/services/ssh_executor.py` - Add execute method

### Phase 3: Logging & Validation
**Goal:** Add execution logging and input validation

- [ ] Log each execution at INFO level
- [ ] Log timeouts at WARNING level
- [ ] Validate machine has tailscale_hostname
- [ ] Validate command is not empty string

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: valid command returns CommandResult | `tests/test_ssh_executor_commands.py` | Pending |
| AC2 | Integration test: reuse pooled connection | `tests/test_ssh_executor_commands.py` | Pending |
| AC3 | Unit test: timeout, auth failure, network error | `tests/test_ssh_executor_commands.py` | Pending |
| AC4 | Log assertion in tests | `tests/test_ssh_executor_commands.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Connection timeout | Existing retry logic (3 attempts) | 2 |
| 2 | Authentication failure | Existing SSHAuthenticationError | 2 |
| 3 | Command timeout (30s) | asyncio.wait_for + CommandTimeoutError | 2 |
| 4 | Connection dropped mid-command | Catch exception, retry on new connection | 2 |
| 5 | Invalid hostname | Existing SSHConnectionError | 2 |
| 6 | Pool connection expired | Existing pool expiry logic | 2 |
| 7 | SSH key not found | Existing SSHKeyNotConfiguredError | 2 |
| 8 | Machine has no tailscale_hostname | ValueError before connection | 3 |
| 9 | Empty command string | ValueError with clear message | 3 |
| 10 | Network unreachable | Existing retry logic | 2 |

**Coverage:** 10/10 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Paramiko blocking calls | Could block event loop | Use asyncio.to_thread() for exec_command |
| Large stdout/stderr | Memory pressure | Limit output size (10KB default) |
| Zombie processes on timeout | Resource leak | Ensure channel.close() on timeout |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Execution logging verified

---

## Notes

The existing `SSHPooledExecutor` already implements:
- Connection pooling (5-minute TTL) - AC2 satisfied
- Retry logic (3 attempts, 2s delay) - Part of AC3
- Host key verification (TOFU)

This implementation adds:
- `execute()` method for running commands - AC1
- `CommandResult` dataclass - AC1
- Command timeout handling - AC3
- Execution logging - AC4
