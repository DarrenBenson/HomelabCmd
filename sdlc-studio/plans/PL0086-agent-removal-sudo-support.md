# PL0086: Fix Agent Removal Sudo Support - Implementation Plan

> **Status:** Done
> **Story:** [US0086: Fix Agent Removal Sudo Support](../stories/US0086-agent-removal-sudo-support.md)
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Created:** 2026-01-27
> **Language:** Python

## Overview

Add sudo password support to the `remove_agent()` method in AgentDeploymentService. This enables agent removal on servers that require sudo passwords, fixing a critical gap where removal fails with warnings and leaves the agent partially installed.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Parameter acceptance | `remove_agent()` accepts optional `sudo_password` parameter (separate from ssh_password) |
| AC2 | Password pipe | Uses `echo '<pw>' \| sudo -S bash -c '...'` when password provided |
| AC3 | Stored credential | Retrieves stored sudo_password automatically if not provided |
| AC4 | Backward compatible | Works with passwordless sudo when no password |
| AC5 | Clear warning | Warning indicates uninstall may have failed; server still marked inactive |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI + SQLAlchemy async
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Catch specific exceptions, not broad `except Exception`
- Use type hints for function signatures
- Use logging module, not print
- Security: escape shell commands properly

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| SQLAlchemy | /websites/sqlalchemy_en_20 | async session patterns | AsyncSession, select() |
| Fernet | - | credential encryption | Already implemented in credential_service.py |

### Existing Patterns

1. **Install agent with sudo_password** - `agent_deploy.py:317-347` shows the pattern for building commands with password pipe
2. **Upgrade agent with sudo_password** - `agent_deploy.py:527-558` (just implemented in US0085) same pattern
3. **Credential retrieval** - `credential_service.py:189-232` has `get_effective_credential()` with fallback chain
4. **AgentDeploymentService** - Already has `credential_service` parameter from US0085

## Recommended Approach

**Strategy:** Test-After
**Rationale:** The implementation involves modifying an existing method with clear patterns already established in `install_agent()` and `upgrade_agent()`. The changes are focused and follow the same pattern as US0085.

### Test Priority

1. Remove with explicit sudo_password parameter succeeds
2. Remove retrieves stored sudo_password automatically
3. Remove works without password (passwordless sudo)
4. Password with special characters escaped correctly
5. Verification helper uses sudo_password

### Documentation Updates Required

- [ ] Update story status to Planned

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add sudo_password parameter to remove_agent | `agent_deploy.py` | - | No | [x] |
| 2 | Implement credential retrieval in remove_agent | `agent_deploy.py` | 1 | No | [x] |
| 3 | Build uninstall command with password pipe | `agent_deploy.py` | 2 | No | [x] |
| 4 | Add sudo_password to _verify_agent_removal | `agent_deploy.py` | 3 | No | [x] |
| 5 | Update _verify_agent_removal callers | `agent_deploy.py` | 4 | No | [x] |
| 6 | Write unit tests for sudo password support | `test_agent_deploy_service.py` | 5 | No | [x] |

### Task Dependency Graph

```
1 (sudo_password param)
    |
2 (credential retrieval)
    |
3 (command building)
    |
4 (_verify_agent_removal param)
    |
5 (update callers)
    |
6 (tests)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2, 3, 4, 5 | None (sequential) |
| 2 | 6 | Tasks 1-5 |

## Implementation Phases

### Phase 1: Method Signature and Logic

**Goal:** Add sudo_password support to remove_agent()

**Tasks in this phase:** 1, 2, 3

#### Step 1.1: Add sudo_password parameter

- [ ] Add `sudo_password: str | None = None` parameter to `remove_agent()`
- [ ] Update docstring with parameter description

#### Step 1.2: Implement credential retrieval

- [ ] If `sudo_password` not provided AND `self.credential_service` exists
- [ ] Call `get_effective_credential("sudo_password", server_id)` to retrieve stored
- [ ] Log debug message indicating credential source (provided vs stored vs none)

#### Step 1.3: Build uninstall command with password support

- [ ] If `sudo_password` is set (provided or retrieved):
  - Escape single quotes in password: `password.replace("'", "'\"'\"'")`
  - Build command using `echo '<pw>' | sudo -S bash -c '...'` pattern
  - All sudo commands in single bash -c to avoid multiple password prompts
- [ ] If no password:
  - Keep existing passwordless sudo command structure

**Command structure with password:**
```python
if sudo_password:
    escaped_pw = sudo_password.replace("'", "'\"'\"'")
    uninstall_cmd = f"""
        echo '{escaped_pw}' | sudo -S bash -c '
            systemctl stop homelab-agent 2>/dev/null || true && \
            systemctl disable homelab-agent 2>/dev/null || true && \
            rm -rf /opt/homelab-agent /etc/homelab-agent && \
            rm -f /etc/systemd/system/homelab-agent.service && \
            systemctl daemon-reload
        '
    """
```

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py` - Lines 584-725

### Phase 2: Verification Helper Update

**Goal:** Update _verify_agent_removal to use sudo_password

**Tasks in this phase:** 4, 5

#### Step 2.1: Add sudo_password to _verify_agent_removal

- [ ] Add `sudo_password: str | None = None` parameter to `_verify_agent_removal()`
- [ ] Build verification commands with sudo password pipe when provided

#### Step 2.2: Update callers

- [ ] Update the call to `_verify_agent_removal()` in `remove_agent()` to pass `sudo_password`

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py` - Lines 727-770

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 6

#### Step 3.1: Unit Tests

- [ ] Test remove with explicit sudo_password parameter
- [ ] Test remove retrieves stored credential automatically
- [ ] Test remove works with passwordless sudo
- [ ] Test password escaping (single quotes, special chars)
- [ ] Test verification helper receives sudo_password
- [ ] Test server marked inactive even if uninstall fails

**Test file:** `tests/test_agent_deploy_service.py`

#### Step 3.2: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: parameter accepted | `agent_deploy.py:remove_agent` | Done |
| AC2 | Unit test: command contains password pipe | `test_agent_deploy_service.py` | Done |
| AC3 | Unit test: stored credential retrieved | `test_agent_deploy_service.py` | Done |
| AC4 | Unit test: passwordless still works | `test_agent_deploy_service.py` | Done |
| AC5 | Unit test: warning and inactive status | `test_agent_deploy_service.py` | Done |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | sudo_password provided | Use password pipe with escaped password | Phase 1 | [x] |
| 2 | No sudo_password, stored credential exists | Retrieve via get_effective_credential() | Phase 1 | [x] |
| 3 | No sudo_password, no stored credential | Use passwordless sudo (existing behaviour) | Phase 1 | [x] |
| 4 | Sudo fails (wrong password) | Warning added, server still marked inactive | Phase 1 | [x] |
| 5 | No SSH access at all | Warning added, server still marked inactive | Phase 1 | [x] |
| 6 | delete_completely=True | Server deleted from DB regardless of uninstall result | Phase 1 | [x] |
| 7 | Password contains special chars | Properly escaped for shell | Phase 1 | [x] |

### Coverage Summary

- Story edge cases: 7
- Handled in plan: 7
- Unhandled: 0

### Edge Case Implementation Notes

The `install_agent()` and `upgrade_agent()` methods already handle sudo_password correctly. The same escaping pattern will be reused:
```python
escaped_pw = sudo_password.replace("'", "'\"'\"'")
```

For AC5 (warning and inactive status), the existing logic already handles this - failure to uninstall adds a warning but still marks the server inactive. This behaviour is maintained.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing callers | API compatibility | Parameter is optional with default None |
| Password visible in logs | Security | Never log password; SSH service already handles this |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0085 | Story | Already implemented - added credential_service to AgentDeploymentService |
| CredentialService | Module | Already implemented with get_effective_credential() |

## Open Questions

None - all questions resolved during story preparation.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (if needed)
- [x] Ready for code review

## Notes

The implementation follows the exact same pattern as `install_agent()` and `upgrade_agent()` which already have working sudo_password support. The main work is:
1. Adding the parameter to remove_agent
2. Credential retrieval (same as upgrade_agent)
3. Command building with password pipe (same pattern)
4. Updating _verify_agent_removal helper

Estimated implementation: straightforward, low risk.
