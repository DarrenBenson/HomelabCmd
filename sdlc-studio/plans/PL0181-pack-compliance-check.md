# PL0181: Configuration Compliance Checker - Implementation Plan

> **Status:** Complete
> **Story:** [US0117: Configuration Compliance Checker](../stories/US0117-pack-compliance-check.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Completed:** 2026-01-29
> **Language:** Python + TypeScript

## Overview

Implement configuration compliance checking via SSH. This feature allows administrators to verify whether a server's current configuration matches the expected state defined in a configuration pack. The implementation builds on the existing ConfigPackService (US0116) and SSHPooledExecutor (US0079).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Compliance Check API | POST /api/v1/servers/{id}/config/check returns structured results |
| AC2 | File Checking | Check existence, permissions, content hash |
| AC3 | Package Checking | Check installed status and version |
| AC4 | Setting Checking | Check environment variable values |
| AC5 | Performance | Complete in <10 seconds for 50 items |
| AC6 | Results Stored | ConfigCheck table stores results |
| AC7 | Offline Handling | Return 503 for unreachable servers |
| AC8 | Pack Not Found | Return 404 for invalid pack names |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI + SQLAlchemy
- **Test Framework:** pytest

### Relevant Best Practices
- Use async/await for SSH operations
- Batch SSH commands to minimise round-trips
- Use Pydantic for request/response validation
- Service class pattern for business logic
- Specific exception handling with typed errors

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Router with Depends, response_model |
| SQLAlchemy | /sqlalchemy/sqlalchemy | async session, relationship |
| paramiko | (internal) | exec_command, stdout.read() |

### Existing Patterns

**SSH Execution:** Follow `backend/src/homelab_cmd/services/ssh_executor.py`:
- SSHPooledExecutor.get_connection() for pooled connections
- exec_command() returns (stdin, stdout, stderr)
- Run commands in thread pool with asyncio.to_thread()

**Config Pack Loading:** Follow `backend/src/homelab_cmd/services/config_pack_service.py`:
- ConfigPackService.load_pack(pack_name) returns ConfigPack
- ConfigPackError raised for invalid packs

**API Routes:** Follow `backend/src/homelab_cmd/api/routes/servers.py`:
- Router with tags, response_model, operation_id
- Depends(get_async_session), Depends(verify_api_key)

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This story involves SSH command orchestration and result parsing which benefits from exploratory implementation first. The SSH command batching strategy may need iteration to achieve the <10s performance target.

### Test Priority
1. Compliance check service unit tests (mock SSH)
2. API endpoint integration tests
3. Database storage verification tests

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create Pydantic schemas for check request/response | `api/schemas/config_check.py` | - | [ ] |
| 2 | Create ConfigCheck database model | `db/models/config_check.py` | - | [ ] |
| 3 | Create Alembic migration | `migrations/versions/` | 2 | [ ] |
| 4 | Create ComplianceCheckService class | `services/compliance_service.py` | 1 | [ ] |
| 5 | Implement file compliance checking | `services/compliance_service.py` | 4 | [ ] |
| 6 | Implement package compliance checking | `services/compliance_service.py` | 4 | [ ] |
| 7 | Implement setting compliance checking | `services/compliance_service.py` | 4 | [ ] |
| 8 | Implement SSH command batching | `services/compliance_service.py` | 5, 6, 7 | [ ] |
| 9 | Create API route | `api/routes/config_check.py` | 4 | [ ] |
| 10 | Register router in main.py | `main.py` | 9 | [ ] |
| 11 | Write unit tests | `tests/test_compliance_service.py` | 4 | [ ] |
| 12 | Write API integration tests | `tests/test_config_check_api.py` | 9 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2 | None |
| B | 3 | Task 2 |
| C | 4 | Tasks 1 |
| D | 5, 6, 7 | Task 4 |
| E | 8, 9 | Tasks 5, 6, 7 |
| F | 10 | Task 9 |
| G | 11, 12 | Tasks 4, 9 |

---

## Implementation Phases

### Phase 1: Data Models
**Goal:** Create schemas and database model

- [ ] Create `backend/src/homelab_cmd/api/schemas/config_check.py`:
  - ConfigCheckRequest (pack_name: str)
  - MismatchItem (type, item, expected, actual)
  - ConfigCheckResponse (server_id, pack_name, is_compliant, mismatches, checked_at, check_duration_ms)
- [ ] Create `backend/src/homelab_cmd/db/models/config_check.py`:
  - ConfigCheck model with server relationship
- [ ] Register model in `db/models/__init__.py`
- [ ] Create Alembic migration

**Files:**
- `backend/src/homelab_cmd/api/schemas/config_check.py` - Pydantic models
- `backend/src/homelab_cmd/db/models/config_check.py` - SQLAlchemy model
- `migrations/versions/xxx_add_config_check_table.py` - Migration

### Phase 2: Compliance Service
**Goal:** Implement compliance checking logic

- [ ] Create `ComplianceCheckService` class
- [ ] Inject ConfigPackService and SSHPooledExecutor
- [ ] Implement `check_compliance(server_id, pack_name)` method
- [ ] Implement file checking:
  - Build SSH command to check file existence, permissions, hash
  - Parse results into MismatchItem structures
- [ ] Implement package checking:
  - Query dpkg for package status and version
  - Parse version strings and compare
- [ ] Implement setting checking:
  - Query environment variables via SSH
  - Compare against expected values
- [ ] Implement command batching for performance

**Files:**
- `backend/src/homelab_cmd/services/compliance_service.py` - Service class

### Phase 3: API Endpoint
**Goal:** Expose compliance checking via REST API

- [ ] Create router for `/api/v1/servers/{server_id}/config/check`
- [ ] Implement `POST` endpoint
- [ ] Add authentication via `verify_api_key`
- [ ] Add error handling (404, 503, 422)
- [ ] Store results in ConfigCheck table
- [ ] Register router in `main.py`

**Files:**
- `backend/src/homelab_cmd/api/routes/config_check.py` - API routes
- `backend/src/homelab_cmd/main.py` - Router registration

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | API integration test | `tests/test_config_check_api.py` | Pending |
| AC2 | Unit test file checking | `tests/test_compliance_service.py` | Pending |
| AC3 | Unit test package checking | `tests/test_compliance_service.py` | Pending |
| AC4 | Unit test setting checking | `tests/test_compliance_service.py` | Pending |
| AC5 | Performance test | `tests/test_compliance_service.py` | Pending |
| AC6 | Database storage test | `tests/test_config_check_api.py` | Pending |
| AC7 | SSH error handling test | `tests/test_config_check_api.py` | Pending |
| AC8 | Pack not found test | `tests/test_config_check_api.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Server offline | Catch SSHConnectionError, return 503 | Phase 3 |
| 2 | SSH authentication failure | Catch SSHAuthenticationError, return 503 | Phase 3 |
| 3 | SSH timeout | Catch timeout, return 503 | Phase 3 |
| 4 | Pack not found | Catch ConfigPackError, return 404 | Phase 3 |
| 5 | Server not found | Query returns None, return 404 | Phase 3 |
| 6 | Invalid pack_name | Pydantic validation, return 422 | Phase 1 |
| 7 | SSH command fails mid-check | Continue checking, include partial results | Phase 2 |
| 8 | File path has spaces | Quote paths in SSH commands | Phase 2 |
| 9 | Empty pack | Return is_compliant=true, empty mismatches | Phase 2 |
| 10 | Home directory expansion | Expand ~ to $HOME in SSH commands | Phase 2 |
| 11 | Package manager differs | Support dpkg only, document limitation | Phase 2 |

**Coverage:** 11/11 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSH command parsing errors | Medium | Use structured output format with delimiters |
| Performance target missed | Medium | Batch all commands into single SSH call |
| Version string parsing | Low | Use packaging.version for robust comparison |
| Different package managers | Medium | Document dpkg-only limitation in API docs |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] API documentation updated (OpenAPI)

---

## Notes

**Design Decisions:**
1. Use single batched SSH command to check all items (performance)
2. Store raw mismatches as JSON for flexibility
3. dpkg-only package checking (Ubuntu/Debian focus for homelab)
4. Environment variables only for settings (config file parsing deferred)

**Not in this story:**
- Diff view (US0118)
- Apply pack (US0119)
- Scheduled checks (US0122)
