# PL0085: Fix Agent Upgrade Sudo Support - Implementation Plan

> **Status:** Done
> **Story:** [US0085: Fix Agent Upgrade Sudo Support](../stories/US0085-agent-upgrade-sudo-support.md)
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Created:** 2026-01-27
> **Language:** Python

## Overview

Add sudo password support to the `upgrade_agent()` method in AgentDeploymentService. This enables agent upgrades on servers that require sudo passwords, fixing a critical gap where upgrades fail silently on password-required systems.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Parameter acceptance | `upgrade_agent()` accepts optional `sudo_password` parameter |
| AC2 | Password pipe | Uses `echo '<pw>' \| sudo -S bash -c '...'` when password provided |
| AC3 | Stored credential | Retrieves stored sudo_password automatically if not provided |
| AC4 | Backward compatible | Works with passwordless sudo when no password |
| AC5 | Clear error | Clear error message when sudo password needed but unavailable |

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
2. **Credential retrieval** - `credential_service.py:189-232` has `get_effective_credential()` with fallback chain
3. **AgentDeploymentService** - Currently takes only `session` in `__init__()`, needs `credential_service` added

## Recommended Approach

**Strategy:** Test-After
**Rationale:** The implementation involves modifying an existing method with clear patterns already established in `install_agent()`. The changes are focused and the existing test patterns in `test_agent_deploy_service.py` provide clear guidance.

### Test Priority

1. Upgrade with explicit sudo_password parameter succeeds
2. Upgrade retrieves stored sudo_password automatically
3. Upgrade works without password (passwordless sudo)
4. Password with special characters escaped correctly
5. Upgrade fails gracefully with wrong password

### Documentation Updates Required

- [ ] Update AGENTS.md if API signature documented there
- [ ] Update story status to Planned

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add credential_service parameter to __init__ | `agent_deploy.py` | - | No | [x] |
| 2 | Add sudo_password parameter to upgrade_agent | `agent_deploy.py` | 1 | No | [x] |
| 3 | Implement credential retrieval in upgrade_agent | `agent_deploy.py` | 2 | No | [x] |
| 4 | Build upgrade command with password pipe | `agent_deploy.py` | 3 | No | [x] |
| 5 | Update get_deployment_service helper | `agent_deploy.py` | 1 | Yes | [x] |
| 6 | Write unit tests for sudo password support | `test_agent_deploy_service.py` | 4 | No | [x] |

### Task Dependency Graph

```
1 (credential_service param)
    ↓
2 (sudo_password param)
    ↓
3 (credential retrieval)
    ↓
4 (command building)
    ↓
6 (tests)

1 ───→ 5 (parallel with 2-4)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1 | None |
| 2 | 2, 3, 4 | Task 1 |
| 3 | 5 | Task 1 |
| 4 | 6 | Tasks 4, 5 |

## Implementation Phases

### Phase 1: Service Dependency Injection

**Goal:** Enable AgentDeploymentService to access stored credentials

**Tasks in this phase:** 1, 5

#### Step 1.1: Add credential_service to __init__

- [x] Add `credential_service: CredentialService | None = None` parameter to `__init__()`
- [x] Store as `self.credential_service`
- [x] Import CredentialService type (for type hints only, to avoid circular imports)

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py` - Add parameter and attribute

**Considerations:**
- Parameter must be optional to maintain backward compatibility
- Type annotation uses `TYPE_CHECKING` pattern to avoid circular imports

#### Step 1.2: Update helper function

- [x] Update `get_deployment_service()` to accept optional `credential_service` parameter
- [x] Pass through to `AgentDeploymentService.__init__()`

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py` - Update helper function

### Phase 2: Method Signature and Logic

**Goal:** Add sudo_password support to upgrade_agent()

**Tasks in this phase:** 2, 3, 4

#### Step 2.1: Add sudo_password parameter

- [x] Add `sudo_password: str | None = None` parameter to `upgrade_agent()`
- [x] Update docstring with parameter description

#### Step 2.2: Implement credential retrieval

- [x] If `sudo_password` not provided AND `self.credential_service` exists
- [x] Call `get_effective_credential("sudo_password", server_id)` to retrieve stored
- [x] Log debug message indicating credential source (provided vs stored vs none)

#### Step 2.3: Build upgrade command with password support

- [x] If `sudo_password` is set (provided or retrieved):
  - Escape single quotes in password: `password.replace("'", "'\"'\"'")`
  - Build command using `echo '<pw>' | sudo -S bash -c '...'` pattern
  - All sudo commands in single bash -c to avoid multiple password prompts
- [x] If no password:
  - Keep existing passwordless sudo command structure

**Command structure with password:**
```python
upgrade_cmd = f"""
    echo "{tarball_b64}" | base64 -d > /tmp/homelab-agent.tar.gz && \
    echo '{escaped_pw}' | sudo -S bash -c '
        systemctl stop homelab-agent 2>/dev/null || true && \
        tar -xzf /tmp/homelab-agent.tar.gz -C / --exclude="*/config.yaml" && \
        systemctl daemon-reload && \
        systemctl start homelab-agent
    ' && \
    rm -f /tmp/homelab-agent.tar.gz
"""
```

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py` - Lines 439-540

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 6

#### Step 3.1: Unit Tests

- [x] Test upgrade with explicit sudo_password parameter
- [x] Test upgrade retrieves stored credential automatically
- [x] Test upgrade works with passwordless sudo
- [x] Test password escaping (single quotes, special chars)
- [x] Test credential service dependency injection

**Test file:** `tests/test_agent_deploy_service.py`

#### Step 3.2: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: parameter accepted | `agent_deploy.py:upgrade_agent` | Done |
| AC2 | Unit test: command contains password pipe | `test_agent_deploy_service.py` | Done |
| AC3 | Unit test: stored credential retrieved | `test_agent_deploy_service.py` | Done |
| AC4 | Unit test: passwordless still works | `test_agent_deploy_service.py` | Done |
| AC5 | Unit test: error message clarity | `test_agent_deploy_service.py` | Done |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | sudo_password provided | Use password pipe with escaped password | Phase 2 | [x] |
| 2 | No sudo_password, stored credential exists | Retrieve via get_effective_credential() | Phase 2 | [x] |
| 3 | No sudo_password, no stored credential | Use passwordless sudo (existing behaviour) | Phase 2 | [x] |
| 4 | Sudo fails (wrong password) | Return DeploymentResult with error from SSH | Phase 2 | [x] |
| 5 | Sudo fails (passwordless on password-required) | Return error; error comes from SSH command | Phase 2 | [x] |
| 6 | Password contains special chars | Escape for shell safety | Phase 2 | [x] |
| 7 | Password contains single quotes | Use shell quoting: `'\"'\"'` replacement | Phase 2 | [x] |

### Coverage Summary

- Story edge cases: 7
- Handled in plan: 7
- Unhandled: 0

### Edge Case Implementation Notes

The `install_agent()` method already handles sudo_password correctly. The same escaping pattern will be reused:
```python
escaped_pw = sudo_password.replace("'", "'\"'\"'")
```

For AC5 (clear error message), the SSH execution result already contains error output from the remote command. If sudo fails, the stderr will indicate this.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Circular import with CredentialService | Build fails | Use TYPE_CHECKING for import |
| Breaking existing callers | API compatibility | Parameter is optional with default None |
| Password visible in logs | Security | Never log password; SSH service already handles this |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0084 | Story | Credential service per-host support (Done) |
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

The implementation follows the exact same pattern as `install_agent()` which already has working sudo_password support. The main work is:
1. Injecting the credential service dependency
2. Adding the parameter to upgrade_agent
3. Copying the command-building logic from install_agent

Estimated implementation: straightforward, low risk.
