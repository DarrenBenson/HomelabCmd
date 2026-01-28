# PL0087: Per-Server Credential API Endpoints - Implementation Plan

> **Status:** Done
> **Story:** [US0087: Per-Server Credential API Endpoints](../stories/US0087-per-server-credential-api.md)
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Created:** 2026-01-27
> **Language:** Python

## Overview

Add API endpoints to manage per-server credentials via the dashboard. This includes listing credential status, storing per-server credentials, deleting credentials, and updating server credential settings (ssh_username, sudo_mode). Security is critical - credential values must never be returned in API responses.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | List credentials | `GET /api/v1/servers/{server_id}/credentials` returns credential status (never values) |
| AC2 | Store credential | `POST /api/v1/servers/{server_id}/credentials` stores encrypted credential |
| AC3 | Delete credential | `DELETE /api/v1/servers/{server_id}/credentials/{type}` deletes per-server credential |
| AC4 | Update settings | `PATCH /api/v1/servers/{server_id}` handles ssh_username, sudo_mode |
| AC5 | Type validation | Invalid credential type returns 400 with valid types |
| AC6 | OpenAPI docs | All endpoints fully documented |

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
- Security: never log or return credential values

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | API routes, Depends | APIRouter, Depends, HTTPException |
| Pydantic | /pydantic/pydantic | request/response schemas | BaseModel, Field |

### Existing Patterns

1. **CredentialService** - `credential_service.py` already has all needed methods:
   - `store_credential(credential_type, plaintext_value, server_id)`
   - `delete_credential(credential_type, server_id)`
   - `credential_exists(credential_type, server_id)`
   - `get_credential_scope(credential_type, server_id)`
   - `ALLOWED_CREDENTIAL_TYPES` for validation

2. **Server routes** - `api/routes/servers.py` has existing PATCH endpoint

3. **Server model** - Already has `ssh_username` and `sudo_mode` fields

4. **SSH settings routes** - `api/routes/ssh_settings.py` shows credential dependency pattern

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This involves creating new API endpoints with straightforward patterns already established in the codebase. The credential service methods are already tested. Focus on integration tests for the API layer.

### Test Priority

1. List credentials endpoint returns correct scope
2. Store credential endpoint succeeds
3. Delete credential endpoint succeeds
4. Update server ssh_username/sudo_mode via PATCH
5. Invalid credential type returns 400

### Documentation Updates Required

- [ ] Update story status to Planned
- [ ] OpenAPI docs auto-generated from Pydantic schemas

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add credential request/response schemas | `schemas/server.py` | - | Yes | [x] |
| 2 | Add get_credential_service dependency | `deps.py` | - | Yes | [x] |
| 3 | Add ssh_username/sudo_mode to ServerUpdate schema | `schemas/server.py` | - | Yes | [x] |
| 4 | Add ssh_username/sudo_mode to ServerResponse schema | `schemas/server.py` | 3 | No | [x] |
| 5 | Implement list credentials endpoint | `routes/servers.py` | 1, 2 | No | [x] |
| 6 | Implement store credential endpoint | `routes/servers.py` | 1, 2 | No | [x] |
| 7 | Implement delete credential endpoint | `routes/servers.py` | 2 | No | [x] |
| 8 | Update PATCH endpoint for ssh_username/sudo_mode | `routes/servers.py` | 3 | No | [x] |
| 9 | Write integration tests | `test_server_credentials.py` | 5, 6, 7, 8 | No | [x] |

### Task Dependency Graph

```
1 (schemas) ──┬─→ 5 (list endpoint)
              │
2 (deps) ─────┼─→ 6 (store endpoint)
              │
              └─→ 7 (delete endpoint)

3 (ServerUpdate) → 4 (ServerResponse) → 8 (PATCH update)

All → 9 (tests)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2, 3 | None |
| 2 | 4, 5, 6, 7, 8 | Tasks 1, 2, 3 |
| 3 | 9 | Tasks 5, 6, 7, 8 |

## Implementation Phases

### Phase 1: Schema and Dependency Setup

**Goal:** Create Pydantic schemas and credential service dependency

**Tasks in this phase:** 1, 2, 3, 4

#### Step 1.1: Add credential schemas

- [ ] Create `ServerCredentialStatus` schema (credential_type, configured, scope)
- [ ] Create `ServerCredentialsResponse` schema (server_id, ssh_username, sudo_mode, credentials)
- [ ] Create `StoreServerCredentialRequest` schema (credential_type, value)
- [ ] Create `StoreServerCredentialResponse` schema (credential_type, server_id, message)

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py` - Add new schemas

#### Step 1.2: Add credential service dependency

- [ ] Create `get_credential_service()` dependency function
- [ ] Handle missing encryption key gracefully

**Files to modify:**
- `backend/src/homelab_cmd/api/deps.py` - Add dependency

#### Step 1.3: Update ServerUpdate and ServerResponse schemas

- [ ] Add `ssh_username: str | None` to ServerUpdate
- [ ] Add `sudo_mode: str | None` to ServerUpdate with validation
- [ ] Add `ssh_username` and `sudo_mode` to ServerResponse

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py` - Update schemas

### Phase 2: API Endpoints

**Goal:** Implement the three credential endpoints and PATCH update

**Tasks in this phase:** 5, 6, 7, 8

#### Step 2.1: List credentials endpoint

- [ ] Implement `GET /{server_id}/credentials`
- [ ] Check server exists (404 if not)
- [ ] Loop through ALLOWED_CREDENTIAL_TYPES
- [ ] Use `credential_service.get_credential_scope()` for each type
- [ ] Return ServerCredentialsResponse

#### Step 2.2: Store credential endpoint

- [ ] Implement `POST /{server_id}/credentials`
- [ ] Check server exists (404 if not)
- [ ] Validate credential_type (400 if invalid)
- [ ] Call `credential_service.store_credential()`
- [ ] Return success response (never echo value)

#### Step 2.3: Delete credential endpoint

- [ ] Implement `DELETE /{server_id}/credentials/{credential_type}`
- [ ] Check server exists (404 if not)
- [ ] Validate credential_type (400 if invalid)
- [ ] Call `credential_service.delete_credential()`
- [ ] Return 404 if credential didn't exist

#### Step 2.4: Update PATCH for credential settings

- [ ] Update `update_server()` to handle ssh_username
- [ ] Update `update_server()` to handle sudo_mode
- [ ] Validate sudo_mode values ('passwordless' or 'password')

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/servers.py` - Add/update endpoints

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 9

#### Step 3.1: Integration Tests

- [ ] Test list credentials with none configured
- [ ] Test list credentials shows per-server and global scope
- [ ] Test store per-server credential succeeds
- [ ] Test store invalid credential type returns 400
- [ ] Test delete per-server credential succeeds
- [ ] Test delete non-existent credential returns 404
- [ ] Test update ssh_username via PATCH
- [ ] Test update sudo_mode via PATCH
- [ ] Test invalid sudo_mode rejected
- [ ] Test response never includes credential value

**Test file:** `tests/test_api_servers.py`

#### Step 3.2: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Integration test: list endpoint | `test_server_credentials.py` | Done |
| AC2 | Integration test: store endpoint | `test_server_credentials.py` | Done |
| AC3 | Integration test: delete endpoint | `test_server_credentials.py` | Done |
| AC4 | Integration test: PATCH ssh_username/sudo_mode | `test_server_credentials.py` | Done |
| AC5 | Integration test: invalid type returns 400 | `test_server_credentials.py` | Done |
| AC6 | Manual: check /api/docs | Auto-generated from schemas | Done |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Server not found | Return 404 HTTPException | Phase 2 | [ ] |
| 2 | Invalid credential type | Return 400 with valid types list | Phase 2 | [ ] |
| 3 | Empty credential value | Pydantic validation (min_length=1) | Phase 1 | [ ] |
| 4 | Delete non-existent credential | Return 404 | Phase 2 | [ ] |
| 5 | Invalid sudo_mode value | Pydantic validation (enum-like) | Phase 1 | [ ] |
| 6 | Encryption key missing | 500 error from credential service | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 6
- Handled in plan: 6
- Unhandled: 0

### Edge Case Implementation Notes

The CredentialService already validates credential types and raises ValueError for invalid types. The API layer should catch this and return 400.

For sudo_mode validation, use Pydantic Field with pattern or custom validator.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Credential value in response | Security breach | Never include value in response schemas; review code carefully |
| Credential value in logs | Security breach | CredentialService already avoids logging values |
| Missing encryption key | 500 errors | Graceful error message suggesting key setup |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0084 | Story | CredentialService with per-server support (Done) |
| CredentialService | Module | All needed methods already implemented |
| Server model | DB | ssh_username, sudo_mode fields already exist |

## Open Questions

None - all questions resolved during story preparation.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Integration tests written and passing
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] OpenAPI documentation complete
- [x] Ready for code review

## Notes

The CredentialService already has all the needed methods:
- `store_credential()` - with server_id support
- `delete_credential()` - with server_id support
- `credential_exists()` - for checking existence
- `get_credential_scope()` - for determining per-server vs global

This is primarily an API layer task - wiring up existing service methods to HTTP endpoints with proper Pydantic schemas.
