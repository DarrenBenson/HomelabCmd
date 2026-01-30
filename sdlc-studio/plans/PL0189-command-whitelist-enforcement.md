# PL0189: Command Whitelist Enforcement - Implementation Plan

> **Status:** Draft
> **Story:** [US0154: Command Whitelist Enforcement](../stories/US0154-command-whitelist-enforcement.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Language:** Python

## Overview

Implement a command whitelist service that validates commands before execution via SSH. This security-critical component prevents command injection by enforcing strict pattern matching, parameter validation, and shell metacharacter blocking.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Whitelist Configuration | Only commands matching whitelist patterns are allowed |
| AC2 | Parameter Validation | Parameters validated against regex patterns |
| AC3 | Shell Metacharacter Blocking | Commands with `;`, `|`, `&`, `` ` ``, `$()`, `>`, `<` rejected |
| AC4 | Violation Logging | All violations logged with command, action_type, and reason |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI (backend)
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices
- Use `re.compile()` for compiled regex patterns (performance)
- Use specific exception types (not bare `except:`)
- Log at WARNING level for security violations
- Never log full command with sensitive data

### Existing Patterns
- `SSHPooledExecutor` in `backend/src/homelab_cmd/services/ssh_executor.py` - will call whitelist
- `CommandResult` dataclass for execution results
- Logging via `logging.getLogger(__name__)`

---

## Recommended Approach

**Strategy:** TDD
**Rationale:** Security-critical validation logic with clear input/output patterns. Regex-based validation benefits from tests defining expected behaviour before implementation.

### Test Priority
1. Shell metacharacter blocking (security critical)
2. Whitelist pattern matching
3. Parameter regex validation

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Define `COMMAND_WHITELIST` config structure | `command_whitelist.py` | - | [ ] |
| 2 | Implement `SHELL_METACHARACTERS` regex | `command_whitelist.py` | - | [ ] |
| 3 | Implement `extract_params()` function | `command_whitelist.py` | 1 | [ ] |
| 4 | Implement `is_whitelisted()` function | `command_whitelist.py` | 1, 2, 3 | [ ] |
| 5 | Add `WhitelistViolationError` exception | `command_whitelist.py` | - | [ ] |
| 6 | Add violation logging | `command_whitelist.py` | 4 | [ ] |
| 7 | Write unit tests for shell metacharacter blocking | `tests/test_command_whitelist.py` | 2 | [ ] |
| 8 | Write unit tests for whitelist patterns | `tests/test_command_whitelist.py` | 4 | [ ] |
| 9 | Write unit tests for parameter validation | `tests/test_command_whitelist.py` | 3 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2, 5 | None - can run in parallel |
| B | 3, 7 | Group A complete |
| C | 4, 6, 8, 9 | Group B complete |

---

## Implementation Phases

### Phase 1: Data Structures & Constants
**Goal:** Define whitelist configuration and shell metacharacter pattern

- [ ] Create `backend/src/homelab_cmd/services/command_whitelist.py`
- [ ] Define `COMMAND_WHITELIST` dict with action types
- [ ] Define `SHELL_METACHARACTERS` compiled regex
- [ ] Add `WhitelistViolationError` exception class

**Files:** `backend/src/homelab_cmd/services/command_whitelist.py` - New file

### Phase 2: Validation Functions
**Goal:** Implement parameter extraction and whitelist validation

- [ ] Implement `extract_params(command, pattern)` to extract placeholders
- [ ] Implement `is_whitelisted(command, action_type)` main validation
- [ ] Add input validation (empty strings, None values)
- [ ] Add violation logging at WARNING level

**Files:** `backend/src/homelab_cmd/services/command_whitelist.py` - Add functions

### Phase 3: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: valid patterns pass, invalid reject | `tests/test_command_whitelist.py` | Pending |
| AC2 | Unit test: param regex validation | `tests/test_command_whitelist.py` | Pending |
| AC3 | Unit test: metacharacter blocking | `tests/test_command_whitelist.py` | Pending |
| AC4 | Log assertions in tests | `tests/test_command_whitelist.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Unknown action type | Return False, log warning with action_type | 2 |
| 2 | Command doesn't match pattern | Return False, log warning with command and pattern | 2 |
| 3 | Parameter contains special chars | Regex validation fails, return False | 2 |
| 4 | Shell metacharacter in command | Early rejection before pattern matching | 2 |
| 5 | Empty service name | Regex `^[a-zA-Z0-9_-]+$` fails on empty string | 2 |
| 6 | Service name > 64 chars | Add length validation to regex pattern | 2 |
| 7 | Valid whitelisted command | Return True, no logging | 2 |

**Coverage:** 7/7 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regex bypass | Command injection | Use anchored patterns (`^...$`), test edge cases |
| Unicode bypass | Shell metachar escape | Use ASCII-only pattern or explicit Unicode handling |
| Performance impact | Slow command execution | Compile regex at module load, cache patterns |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Security review: regex patterns anchored, metacharacters blocked

---

## Notes

- The whitelist service is called by `SSHPooledExecutor.execute()` before running commands
- Action types: `restart_service`, `apply_updates`, `clear_logs` (initial set)
- US0153 (Command API) will integrate this service when that story is implemented
- Consider making whitelist configurable via environment in future (US0154 scope is code-defined whitelist)
