# PL0190: Synchronous Command Execution API - Implementation Plan

> **Status:** Draft
> **Story:** [US0153: Synchronous Command Execution API](../stories/US0153-synchronous-command-execution-api.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Language:** Python

## Overview

Implement a synchronous command execution API endpoint that allows the frontend to execute whitelisted commands on servers via SSH and receive immediate results. Integrates with US0151 (SSH Executor) and US0154 (Command Whitelist).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Command Execution Endpoint | POST `/api/v1/servers/{id}/commands/execute` returns exit_code, stdout, stderr, duration_ms |
| AC2 | Error Status Codes | 200 success, 400 invalid command, 404 not found, 408 timeout, 500 SSH error |
| AC3 | Rate Limiting | 10 commands per minute per user, 429 when exceeded |
| AC4 | OpenAPI Documentation | Full schema documentation available at `/api/docs` |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with async/await
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices
- Follow existing route patterns in `backend/src/homelab_cmd/api/routes/`
- Use Pydantic schemas for request/response validation
- Use dependency injection for auth and database
- Follow async/await patterns for SSH operations

### Existing Patterns

From `actions.py`:
- Route structure with `APIRouter`
- `verify_api_key` dependency for authentication
- `get_async_session` for database sessions
- HTTPException with structured error details
- Response models with `model_validate()`

### Dependencies (All Complete)

| Dependency | Status | What It Provides |
|------------|--------|------------------|
| US0151 | ✅ Done | `SSHPooledExecutor.execute()` with `CommandResult` |
| US0154 | ✅ Done | `is_whitelisted()` for command validation |

---

## Recommended Approach

**Strategy:** TDD
**Rationale:** API endpoint with clear request/response contracts, well-defined error codes, and documented edge cases. Tests will drive the implementation.

### Test Priority
1. Valid command execution returns 200 with correct response schema
2. Whitelisted command validation (400 on rejection)
3. Error handling (404, 408, 500)
4. Rate limiting at 10/min threshold

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create request/response schemas | `api/schemas/commands.py` | - | [ ] |
| 2 | Create commands route file | `api/routes/commands.py` | 1 | [ ] |
| 3 | Register route in main.py | `main.py` | 2 | [ ] |
| 4 | Implement execute endpoint | `api/routes/commands.py` | 1,2 | [ ] |
| 5 | Add rate limiting middleware | `api/routes/commands.py` | 4 | [ ] |
| 6 | Write unit tests | `tests/test_commands_api.py` | 1-5 | [ ] |
| 7 | Verify OpenAPI docs | Manual verification | 6 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1 (schemas) | None |
| B | 2, 3 (route setup) | A |
| C | 4, 5, 6 (implementation + tests) | B |

---

## Implementation Phases

### Phase 1: Schemas
**Goal:** Define request/response models

- [ ] Create `CommandExecuteRequest` with `command`, `action_type` fields
- [ ] Create `CommandExecuteResponse` with `exit_code`, `stdout`, `stderr`, `duration_ms`
- [ ] Add field descriptions for OpenAPI

**Files:** `backend/src/homelab_cmd/api/schemas/commands.py`

### Phase 2: Route Setup
**Goal:** Create route structure and register

- [ ] Create `commands.py` router with `/servers/{server_id}/commands` prefix
- [ ] Add router to `main.py` includes
- [ ] Add `execute` endpoint stub returning 501

**Files:**
- `backend/src/homelab_cmd/api/routes/commands.py`
- `backend/src/homelab_cmd/main.py`

### Phase 3: Core Implementation
**Goal:** Implement command execution logic

- [ ] Get server from database, return 404 if not found
- [ ] Validate command with `is_whitelisted()`, return 400 if rejected
- [ ] Execute via `SSHPooledExecutor.execute()`, handle timeout (408), SSH error (500)
- [ ] Return `CommandExecuteResponse` with results

**Files:** `backend/src/homelab_cmd/api/routes/commands.py`

### Phase 4: Rate Limiting
**Goal:** Implement per-user rate limiting

- [ ] Add in-memory rate limiter (10 requests/minute)
- [ ] Return 429 with `Retry-After` header when limit exceeded
- [ ] Store timestamps per API key

**Files:** `backend/src/homelab_cmd/api/routes/commands.py`

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Test valid command returns correct schema | `tests/test_commands_api.py` | Pending |
| AC2 | Test each error status code | `tests/test_commands_api.py` | Pending |
| AC3 | Test rate limit triggers at 11th request | `tests/test_commands_api.py` | Pending |
| AC4 | Verify OpenAPI schema includes endpoint | Manual + OpenAPI compliance test | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Server not found | Return 404 with "Server not found" | 3 |
| 2 | Server offline (SSH fail) | Return 500 with SSH error details | 3 |
| 3 | Command not whitelisted | Return 400 with "Command not in whitelist" | 3 |
| 4 | Command timeout (30s) | Return 408 with "Command execution timeout" | 3 |
| 5 | SSH auth failure | Return 500 with auth error | 3 |
| 6 | Rate limit exceeded | Return 429 with Retry-After header | 4 |
| 7 | Empty command | Return 400 validation error (Pydantic) | 1 |

**Coverage:** 7/7 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rate limiter state lost on restart | Medium | Use simple in-memory dict - acceptable for MVP |
| SSH connection hangs | High | Timeout already implemented in SSHPooledExecutor |
| Large stdout/stderr | Medium | SSHPooledExecutor limits to 10KB |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows existing patterns
- [ ] No linting errors
- [ ] OpenAPI documentation accurate

---

## Notes

- Endpoint path uses `/servers/{server_id}/commands/execute` (not `/machines/` as in story - aligning with existing API structure)
- Rate limiting is per API key, not per user (aligns with auth model)
- US0155 (Audit Trail) is a separate story - not implemented here
