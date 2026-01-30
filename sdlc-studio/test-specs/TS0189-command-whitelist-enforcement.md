# TS0189: Command Whitelist Enforcement

> **Status:** Draft
> **Story:** [US0154: Command Whitelist Enforcement](../stories/US0154-command-whitelist-enforcement.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the command whitelist service that prevents command injection by validating commands against approved patterns, validating parameters against regex rules, and blocking shell metacharacters.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0154](../stories/US0154-command-whitelist-enforcement.md) | Command Whitelist Enforcement | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0154 | AC1 | Whitelist Configuration | TC01, TC02, TC03 | Pending |
| US0154 | AC2 | Parameter Validation | TC04, TC05, TC06 | Pending |
| US0154 | AC3 | Shell Metacharacter Blocking | TC07, TC08, TC09, TC10 | Pending |
| US0154 | AC4 | Violation Logging | TC11, TC12 | Pending |

**Coverage:** 4/4 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Pure function validation logic, no I/O |
| Integration | No | Service has no external dependencies |
| E2E | No | Tested via US0153 API integration |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, Python 3.11+ |
| External Services | None |
| Test Data | Inline test fixtures (command strings) |

---

## Test Cases

### TC01: Valid restart_service command passes whitelist

**Type:** Unit | **Priority:** High | **Story:** US0154 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Whitelist configured with `restart_service` pattern | Configuration loaded |
| When | `is_whitelisted("systemctl restart nginx", "restart_service")` called | Function executes |
| Then | Returns `True` | Command allowed |

**Assertions:**
- [ ] Return value is `True`
- [ ] No warning logged

---

### TC02: Unknown action_type rejected

**Type:** Unit | **Priority:** High | **Story:** US0154 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Whitelist has no `reboot_server` action | Configuration loaded |
| When | `is_whitelisted("reboot", "reboot_server")` called | Function executes |
| Then | Returns `False` with warning logged | Command rejected |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "Unknown action type"
- [ ] Warning contains action_type "reboot_server"

---

### TC03: Command not matching pattern rejected

**Type:** Unit | **Priority:** High | **Story:** US0154 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | `restart_service` pattern is `systemctl restart {service_name}` | Configuration loaded |
| When | `is_whitelisted("service nginx restart", "restart_service")` called | Function executes |
| Then | Returns `False` with warning logged | Command rejected |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "doesn't match pattern"

---

### TC04: Valid service name parameter passes

**Type:** Unit | **Priority:** High | **Story:** US0154 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Service name regex is `^[a-zA-Z0-9_-]+$` | Validation configured |
| When | `is_whitelisted("systemctl restart docker", "restart_service")` called | Function executes |
| Then | Returns `True` | Parameter valid |

**Assertions:**
- [ ] Return value is `True`
- [ ] Parameter "docker" extracted correctly

---

### TC05: Service name with spaces rejected

**Type:** Unit | **Priority:** High | **Story:** US0154 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Service name regex requires no spaces | Validation configured |
| When | `is_whitelisted("systemctl restart my service", "restart_service")` called | Function executes |
| Then | Returns `False` | Parameter invalid |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "Parameter validation failed"

---

### TC06: Service name exceeding 64 chars rejected

**Type:** Unit | **Priority:** Medium | **Story:** US0154 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Service name max length is 64 characters | Validation configured |
| When | `is_whitelisted("systemctl restart " + "a"*65, "restart_service")` called | Function executes |
| Then | Returns `False` | Parameter too long |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "Parameter" or "too long"

---

### TC07: Semicolon in command rejected

**Type:** Unit | **Priority:** Critical | **Story:** US0154 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Shell metacharacter blocking enabled | Security check active |
| When | `is_whitelisted("systemctl restart nginx; rm -rf /", "restart_service")` called | Function executes |
| Then | Returns `False` immediately | Command injection blocked |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "shell metacharacters"
- [ ] Rejection happens before pattern matching

---

### TC08: Pipe character in command rejected

**Type:** Unit | **Priority:** Critical | **Story:** US0154 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Shell metacharacter blocking enabled | Security check active |
| When | `is_whitelisted("systemctl restart nginx|cat /etc/passwd", "restart_service")` called | Function executes |
| Then | Returns `False` | Command injection blocked |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "shell metacharacters"

---

### TC09: Command substitution rejected

**Type:** Unit | **Priority:** Critical | **Story:** US0154 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Shell metacharacter blocking enabled | Security check active |
| When | `is_whitelisted("systemctl restart $(whoami)", "restart_service")` called | Function executes |
| Then | Returns `False` | Command injection blocked |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "shell metacharacters"

---

### TC10: Backtick command substitution rejected

**Type:** Unit | **Priority:** Critical | **Story:** US0154 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Shell metacharacter blocking enabled | Security check active |
| When | `is_whitelisted("systemctl restart \`whoami\`", "restart_service")` called | Function executes |
| Then | Returns `False` | Command injection blocked |

**Assertions:**
- [ ] Return value is `False`
- [ ] Warning logged containing "shell metacharacters"

---

### TC11: Violation logged with command details

**Type:** Unit | **Priority:** High | **Story:** US0154 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Logging configured at WARNING level | Logger active |
| When | Invalid command submitted | Violation occurs |
| Then | Log entry contains command, action_type, and reason | Audit trail complete |

**Assertions:**
- [ ] Log message contains the command (or sanitised version)
- [ ] Log message contains the action_type
- [ ] Log message contains rejection reason

---

### TC12: Valid apply_updates command passes

**Type:** Unit | **Priority:** High | **Story:** US0154 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | `apply_updates` has exact match pattern | No parameters |
| When | `is_whitelisted("apt-get update && apt-get upgrade -y", "apply_updates")` called | Function executes |
| Then | Returns `True` | Command allowed |

**Assertions:**
- [ ] Return value is `True`
- [ ] Pattern with no placeholders matches exactly

---

## Fixtures

```yaml
# Test fixtures for command whitelist tests
valid_commands:
  - command: "systemctl restart nginx"
    action_type: "restart_service"
    expected: true

  - command: "systemctl restart docker"
    action_type: "restart_service"
    expected: true

  - command: "apt-get update && apt-get upgrade -y"
    action_type: "apply_updates"
    expected: true

  - command: "journalctl --vacuum-time=7d"
    action_type: "clear_logs"
    expected: true

invalid_commands:
  - command: "systemctl restart nginx; rm -rf /"
    action_type: "restart_service"
    expected: false
    reason: "semicolon_metachar"

  - command: "systemctl restart $(whoami)"
    action_type: "restart_service"
    expected: false
    reason: "command_substitution"

  - command: "reboot"
    action_type: "reboot_server"
    expected: false
    reason: "unknown_action"

  - command: "service nginx restart"
    action_type: "restart_service"
    expected: false
    reason: "pattern_mismatch"

shell_metacharacters:
  - char: ";"
    description: "command separator"
  - char: "|"
    description: "pipe"
  - char: "&"
    description: "background/and"
  - char: "`"
    description: "backtick substitution"
  - char: "$("
    description: "command substitution"
  - char: ">"
    description: "redirect output"
  - char: "<"
    description: "redirect input"
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Valid restart_service passes | Pending | - |
| TC02 | Unknown action_type rejected | Pending | - |
| TC03 | Command not matching pattern rejected | Pending | - |
| TC04 | Valid service name parameter passes | Pending | - |
| TC05 | Service name with spaces rejected | Pending | - |
| TC06 | Service name exceeding 64 chars rejected | Pending | - |
| TC07 | Semicolon in command rejected | Pending | - |
| TC08 | Pipe character rejected | Pending | - |
| TC09 | Command substitution rejected | Pending | - |
| TC10 | Backtick substitution rejected | Pending | - |
| TC11 | Violation logged with details | Pending | - |
| TC12 | Valid apply_updates passes | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0013](../epics/EP0013-synchronous-command-execution.md) |
| Plan | [PL0189](../plans/PL0189-command-whitelist-enforcement.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
