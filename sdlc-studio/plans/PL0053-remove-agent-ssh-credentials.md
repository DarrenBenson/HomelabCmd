# PL0053: Remove Agent API SSH Credentials and Verification - Implementation Plan

> **Status:** Draft
> **Story:** [US0075: Remove Agent API SSH Credentials and Verification](../stories/US0075-remove-agent-ssh-credentials.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-24
> **Language:** Python

## Overview

Extend the remove-agent API flow to accept optional SSH username and password credentials, fall back to key-based authentication when needed, and add post-uninstall verification checks with bounded timeouts. Surface warnings in the API response without persisting credentials.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Optional SSH credentials | Accept ssh_username/ssh_password for password auth with key-based fallback. |
| AC2 | Credentials not persisted | Use credentials in-memory only, never stored or echoed. |
| AC3 | Verification warnings | Run verification checks and include warnings for failures/inconclusive results. |
| AC4 | Bounded timeouts | All SSH operations respect timeouts and return warnings rather than hanging. |

## Technical Context

### Language & Framework

- **Primary Language:** Python
- **Framework:** FastAPI
- **Test Framework:** pytest

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use specific exceptions and log warnings instead of silent failures.
- Keep credentials in memory only and avoid logging secrets.
- Ensure timeouts are explicit for network operations.
- Add type hints for new parameters and return values.

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | HTTPException error response patterns | TBD |
| Pydantic | /pydantic/pydantic | Optional field validation and examples | TBD |
| Paramiko | /paramiko/paramiko | Password authentication with SSHClient.connect | TBD |

### Existing Patterns

- `AgentDeploymentService.remove_agent` handles uninstall and inactive/delete flows.
- `SSHConnectionService.execute_command` performs key-based SSH commands with timeouts.
- Remove agent tests live in `tests/test_agent_deploy_service.py`.

## Recommended Approach

**Strategy:** TDD
**Rationale:** API story with clear ACs and multiple edge cases around SSH fallbacks.

### Test Priority

1. Password auth success and fallback to key-based uninstall.
2. Verification warnings for running service or leftover files.
3. Credential non-persistence and response redaction.

### Documentation Updates Required

- [ ] No documentation updates required (OpenAPI reflects schema changes).

## Implementation Steps

### Phase 1: API Schema and Request Handling

**Goal:** Accept optional SSH credentials in the remove-agent API.

#### Step 1.1: Extend AgentRemoveRequest schema

- [ ] Add optional `ssh_username` and `ssh_password` fields with descriptions.
- [ ] Provide example payload for password auth.

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/agent_deploy.py` - Add optional fields.

**Considerations:**
- Ensure password is not echoed in responses or logs.

#### Step 1.2: Pass credentials to service layer

- [ ] Update remove-agent route to pass optional credentials.

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agent_deploy.py` - Extend service call.

### Phase 2: SSH Execution and Verification

**Goal:** Support password authentication and verification warnings.

#### Step 2.1: Add password auth support in SSHConnectionService

- [ ] Extend `_execute_command_sync` and `execute_command` to accept an optional password.
- [ ] When password provided, attempt password auth without key scanning.

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Add password auth path.

#### Step 2.2: Update remove_agent logic

- [ ] Accept ssh_username/password parameters.
- [ ] Attempt password auth when both are provided.
- [ ] Fall back to key-based auth when password auth fails or is invalid.
- [ ] Add verification commands (service status, file removal) with timeouts.
- [ ] Aggregate warnings into response message.

**Files to modify:**
- `backend/src/homelab_cmd/services/agent_deploy.py` - Extend remove_agent flow.

### Phase 3: Testing & Validation

**Goal:** Verify ACs and edge cases with pytest.

#### Step 3.1: Remove-agent service tests

- [ ] Add tests for password auth success and fallback warnings.
- [ ] Add tests for verification warnings (service active, files remain).
- [ ] Add tests for password without username and timeout warnings.

**Files to modify:**
- `tests/test_agent_deploy_service.py` - Extend remove_agent tests.

#### Step 3.2: SSH password auth tests

- [ ] Add tests for password auth path in `_execute_command_sync` and `execute_command`.

**Files to modify:**
- `tests/test_ssh_service.py` - Add password auth coverage.

#### Step 3.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit tests for password auth + key fallback | Pending |
| AC2 | Unit test verifying no password in response | Pending |
| AC3 | Unit tests for verification warnings | Pending |
| AC4 | Unit tests for timeout warning behaviour | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | ssh_password without ssh_username | Warn and skip password auth, fall back to key-based auth. | Phase 2 | [ ] |
| 2 | Invalid password authentication | Warn and attempt key-based uninstall; continue to mark inactive. | Phase 2 | [ ] |
| 3 | SSH key succeeds while password fails | Include password auth warning, proceed with key-based success. | Phase 2 | [ ] |
| 4 | Uninstall succeeds but service active | Run systemctl check, warn if active. | Phase 2 | [ ] |
| 5 | Uninstall succeeds but files remain | Check paths, warn with remaining paths. | Phase 2 | [ ] |
| 6 | Hostname or IP missing | Warn and skip uninstall + verification attempts. | Phase 2 | [ ] |
| 7 | SSH timeout during verification | Enforce command timeouts and warn on timeout errors. | Phase 2 | [ ] |
| 8 | Delete completely with uninstall failure | Delete server data but include uninstall warning. | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

### Edge Case Implementation Notes

Password auth will only be attempted when both ssh_username and ssh_password are provided. Verification commands reuse the last successful authentication method and fall back to warnings if SSH access fails.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Password auth path bypasses key checks | Medium | Keep key-based fallback when password auth fails. |
| Verification commands add latency | Low | Use short timeouts per command and aggregate results. |
| Warnings become noisy | Low | Include concise warnings with actionable details. |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| SSHConnectionService | Internal | Extend to support password auth. |
| AgentRemoveRequest schema | Internal | Add optional credentials fields. |

## Open Questions

None.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Ready for code review

## Notes

Verification should not block removal. Even when verification fails, the API should respond quickly with warnings and mark the server inactive or deleted as requested.
