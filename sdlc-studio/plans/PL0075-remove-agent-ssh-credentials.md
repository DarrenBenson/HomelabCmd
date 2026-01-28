# PL0075: Remove Agent SSH Credentials and Verification

> **Status:** Done
> **Story:** [US0075: Remove Agent SSH Credentials](../stories/US0075-remove-agent-ssh-credentials.md)
> **Created:** 2026-01-26
> **TDD Recommendation:** Test-After (implementation already partially exists)

## Summary

Add optional SSH username/password credentials to the remove-agent API and implement verification steps to confirm agent removal. The API schema and service method signatures already support the credentials - verification logic is already implemented. This story requires adding tests and ensuring response messages meet AC requirements.

## Analysis

### Current State

The implementation is **already complete**:

1. **Schema** (`backend/src/homelab_cmd/api/schemas/agent_deploy.py:120-148`):
   - `AgentRemoveRequest` already has `ssh_username` and `ssh_password` optional fields
   - `AgentRemoveResponse` returns `success`, `server_id`, `message`, `error`

2. **Route** (`backend/src/homelab_cmd/api/routes/agent_deploy.py:148-175`):
   - Already passes `ssh_username` and `ssh_password` to service

3. **Service** (`backend/src/homelab_cmd/services/agent_deploy.py:542-683`):
   - `remove_agent()` accepts `ssh_username` and `ssh_password`
   - Handles password-without-username case (warning + fallback)
   - Attempts password auth first, falls back to key-based
   - Calls `_verify_agent_removal()` on success

4. **Verification** (`backend/src/homelab_cmd/services/agent_deploy.py:685-729`):
   - `_verify_agent_removal()` checks service status and remaining files
   - Returns warnings list for still-running service or remaining files

### What's Missing

Reviewing the acceptance criteria against the implementation:

| AC | Requirement | Current State |
|----|-------------|---------------|
| AC1 | SSH password auth with fallback | ✅ Implemented |
| AC2 | Credentials not persisted/echoed | ✅ In-memory only |
| AC3 | Verification warnings | ✅ Implemented |
| AC4 | Bounded timeouts | ✅ `command_timeout=30` and `10` |

### Tests Needed

The existing tests cover basic remove scenarios but need expansion for US0075:

| Test | Status |
|------|--------|
| Password auth success | Missing |
| Password without username warning | Missing |
| Verification service running warning | Missing |
| Verification files remain warning | Missing |
| Verification timeout warning | Missing |
| Credentials not in response | Missing |

## Implementation Tasks

### Task 1: Add US0075 Tests

**File:** `tests/test_agent_deploy_service.py`

Add test methods to `TestAgentDeploymentServiceRemove`:

```python
@pytest.mark.asyncio
async def test_remove_agent_with_password_auth(self, db_session) -> None:
    """US0075 AC1: Should use password auth when credentials provided."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_password_without_username_warns(self, db_session) -> None:
    """US0075 AC1: Should warn when password provided without username."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_password_auth_fails_falls_back(self, db_session) -> None:
    """US0075 AC1: Should fall back to keys when password auth fails."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_verification_service_running_warning(self, db_session) -> None:
    """US0075 AC3: Should warn when service still running after uninstall."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_verification_files_remain_warning(self, db_session) -> None:
    """US0075 AC3: Should warn when agent files remain after uninstall."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_verification_timeout_warning(self, db_session) -> None:
    """US0075 AC4: Should warn when verification times out."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_response_excludes_credentials(self, db_session) -> None:
    """US0075 AC2: Response should not include password."""
    ...
```

### Task 2: Add API-Level Tests

**File:** `tests/test_agent_deploy_api.py` (or similar)

Add tests for the REST API endpoint:

```python
@pytest.mark.asyncio
async def test_remove_agent_api_with_credentials(client, db_session) -> None:
    """US0075: API accepts optional SSH credentials."""
    ...

@pytest.mark.asyncio
async def test_remove_agent_api_response_no_password(client, db_session) -> None:
    """US0075 AC2: API response does not echo password."""
    ...
```

### Task 3: Verify Implementation Matches AC

Review current implementation against story AC:

1. **AC1**: Verify `execute_command` is called with password when provided
2. **AC2**: Verify response schema excludes password fields
3. **AC3**: Verify warning messages match AC wording
4. **AC4**: Verify timeouts are bounded (30s uninstall, 10s verification)

## Files to Modify

| File | Change |
|------|--------|
| `tests/test_agent_deploy_service.py` | Add 7 new test methods |
| `tests/test_agent_deploy_api.py` | Add 2 API tests (create if needed) |

## Files to Review (No Changes Expected)

| File | Purpose |
|------|---------|
| `backend/src/homelab_cmd/api/schemas/agent_deploy.py` | Schema already correct |
| `backend/src/homelab_cmd/api/routes/agent_deploy.py` | Route already correct |
| `backend/src/homelab_cmd/services/agent_deploy.py` | Service already implemented |

## Acceptance Criteria Mapping

| AC | Implementation | Test |
|----|----------------|------|
| AC1 | `agent_deploy.py:589-622` | `test_remove_agent_with_password_auth`, `test_remove_agent_password_without_username_warns`, `test_remove_agent_password_auth_fails_falls_back` |
| AC2 | Schema has no password in response | `test_remove_agent_response_excludes_credentials` |
| AC3 | `_verify_agent_removal()` | `test_remove_agent_verification_service_running_warning`, `test_remove_agent_verification_files_remain_warning` |
| AC4 | `command_timeout=30/10` | `test_remove_agent_verification_timeout_warning` |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Implementation already exists | Verify thoroughly with tests |
| Edge cases not covered | Add comprehensive test scenarios |

## Estimation

- **Effort:** Low (tests only - implementation exists)
- **Complexity:** Low
- **Risk:** Low

## Next Steps

1. Run existing tests to confirm baseline passes
2. Add new tests for US0075 scenarios
3. Verify all AC with code review
4. Mark story as Done

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Claude | Initial plan - discovered implementation already exists |
