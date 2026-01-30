# US0154: Command Whitelist Enforcement

> **Status:** Done
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Story Points:** 4

## User Story

**As a** system administrator
**I want** only whitelisted commands to execute
**So that** the system is secure against command injection

## Context

### Background

Allowing arbitrary command execution over SSH would be a critical security vulnerability. A strict whitelist with parameter validation ensures only pre-approved, safe commands can be executed.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Security | Prevent command injection | AC2: parameter validation |
| PRD | Security | OWASP Top 10 compliance | AC3: no shell metacharacters |
| US0153 | Dependency | Command execution API | Integrates with |

---

## Acceptance Criteria

### AC1: Whitelist Configuration
- **Given** the command whitelist configuration
- **When** an action type is requested
- **Then** only commands matching the whitelist pattern are allowed

### AC2: Parameter Validation
- **Given** a whitelisted command with parameters
- **When** parameters are extracted
- **Then** each parameter is validated against its regex pattern

### AC3: Shell Metacharacter Blocking
- **Given** any command input
- **When** shell metacharacters are present (`;`, `|`, `&`, `` ` ``, `$()`, `>`, `<`)
- **Then** the command is rejected with a clear error

### AC4: Violation Logging
- **Given** a whitelist violation attempt
- **When** the command is rejected
- **Then** the violation is logged with command, action_type, and reason

---

## Scope

### In Scope
- Command whitelist configuration structure
- Whitelist validation function
- Parameter extraction and regex validation
- Shell metacharacter blocking
- Violation logging
- Action types: `restart_service`, `apply_updates`, `clear_logs`, `custom`

### Out of Scope
- Custom command approval workflow (admin UI for adding custom commands)
- Dynamic whitelist updates (requires restart - security-critical)

---

## Technical Notes

### Whitelist Configuration

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
```

### Validation Function

```python
SHELL_METACHARACTERS = re.compile(r'[;|&`$()<>]')

def is_whitelisted(command: str, action_type: str) -> bool:
    # Check for shell metacharacters first
    if SHELL_METACHARACTERS.search(command):
        logger.warning(f"Command contains shell metacharacters: {command}")
        return False

    if action_type not in COMMAND_WHITELIST:
        logger.warning(f"Unknown action type: {action_type}")
        return False

    whitelist_entry = COMMAND_WHITELIST[action_type]
    pattern = whitelist_entry["pattern"]

    # Extract parameters from command
    params = extract_params(command, pattern)
    if params is None:
        logger.warning(f"Command doesn't match pattern: {command} vs {pattern}")
        return False

    # Validate each parameter
    for param_name, regex in whitelist_entry["param_validation"].items():
        if param_name not in params:
            logger.warning(f"Missing parameter: {param_name}")
            return False
        if not re.match(regex, params[param_name]):
            logger.warning(f"Parameter validation failed: {param_name}={params[param_name]}")
            return False

    return True

def extract_params(command: str, pattern: str) -> Optional[Dict[str, str]]:
    """Extract parameters from command using pattern placeholders."""
    # Convert pattern to regex
    regex_pattern = pattern
    param_names = re.findall(r'\{(\w+)\}', pattern)
    for name in param_names:
        regex_pattern = regex_pattern.replace(f'{{{name}}}', f'(?P<{name}>.+?)')
    regex_pattern = f'^{regex_pattern}$'

    match = re.match(regex_pattern, command)
    if not match:
        return None

    return match.groupdict()
```

### Security Validations

| Validation | Blocked Pattern | Reason |
|------------|-----------------|--------|
| Shell metacharacters | `;`, `\|`, `&`, `` ` ``, `$()`, `>`, `<` | Prevent command chaining |
| Path traversal | `..`, `/etc/`, `/root/` | Prevent file access |
| Service name constraints | Max 64 chars, alphanumeric + hyphen/underscore | Prevent injection |

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Unknown action type | Reject with "Unknown action type" |
| Command doesn't match pattern | Reject with "Command doesn't match whitelist" |
| Parameter contains special chars | Reject with "Invalid parameter" |
| Shell metacharacter in command | Reject with "Command contains shell metacharacters" |
| Empty service name | Reject with "Invalid parameter" |
| Service name too long (>64 chars) | Reject with "Parameter too long" |
| Valid whitelisted command | Allow execution |

---

## Test Scenarios

- [x] `systemctl restart nginx` with action_type `restart_service` passes
- [x] `systemctl restart nginx; rm -rf /` rejected (semicolon)
- [x] `systemctl restart $(whoami)` rejected (command substitution)
- [x] `systemctl restart nginx|cat /etc/passwd` rejected (pipe)
- [x] Unknown action_type rejected
- [x] Service name with spaces rejected
- [x] Service name > 64 chars rejected
- [x] `apt-get update && apt-get upgrade -y` with `apply_updates` passes
- [x] Modified `apply_updates` command rejected (must match exactly)
- [x] All violations logged with details

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0153](US0153-synchronous-command-execution-api.md) | Integrates | Called from API endpoint | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

---

## Estimation

**Story Points:** 4
**Complexity:** Medium - Security-critical validation logic

---

## Open Questions

None - security requirements clear from epic.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0013 |
| 2026-01-29 | Claude | Implementation complete - 50 tests, 95% coverage |
