# PL0187: Pack Assignment per Machine - Implementation Plan

> **Status:** Draft
> **Story:** [US0121: Pack Assignment per Machine](../stories/US0121-pack-assignment-per-machine.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python, TypeScript

## Overview

Add `assigned_packs` field to the Server model allowing administrators to assign configuration packs to individual machines. Includes API endpoints for getting/updating pack assignments, a UI component for pack selection, and default pack assignment logic based on machine type.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Database Field | Add `assigned_packs` JSON column to Server model |
| AC2 | Update Packs Endpoint | PUT /api/v1/servers/{id}/config/packs |
| AC3 | Get Packs Endpoint | GET /api/v1/servers/{id}/config/packs |
| AC4 | Machine Detail Display | Show assigned packs on server detail page |
| AC5 | Pack Assignment UI | Checkbox UI for pack selection |
| AC6 | Default Assignment | Auto-assign packs based on machine_type |
| AC7 | Compliance Check Integration | Compliance check uses assigned packs |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.12+ (backend), TypeScript (frontend)
- **Framework:** FastAPI, React
- **Test Framework:** pytest, Vitest

### Relevant Best Practices
- Use SQLAlchemy `Mapped` type hints with JSON column
- Follow existing server routes pattern for new endpoints
- Use Pydantic for request/response validation
- React component follows ServerCredentials pattern

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Dependency injection, response models |
| SQLAlchemy | /sqlalchemy/sqlalchemy | JSON column type |
| React | /facebook/react | useState, useEffect, useCallback |

### Existing Patterns
- `filesystems` JSON field in Server model - same pattern for `assigned_packs`
- `ServerCredentials` component - reference for pack assignment UI
- `config_pack_service.list_packs()` - for available packs validation

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Simple CRUD operations following well-established patterns. Standard database field addition, API endpoints, and UI component.

### Test Priority
1. Backend API tests for GET/PUT endpoints
2. Default pack assignment in server registration
3. Frontend component tests for pack selection UI

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add `assigned_packs` field to Server model | `db/models/server.py` | - | [ ] |
| 2 | Create Alembic migration | `migrations/versions/` | 1 | [ ] |
| 3 | Add `drift_detection_enabled` field to Server model | `db/models/server.py` | 1 | [ ] |
| 4 | Add pack assignment schemas | `api/schemas/server.py` | - | [ ] |
| 5 | Add GET /servers/{id}/config/packs endpoint | `api/routes/servers.py` | 1, 4 | [ ] |
| 6 | Add PUT /servers/{id}/config/packs endpoint | `api/routes/servers.py` | 1, 4 | [ ] |
| 7 | Add default pack assignment to server registration | `api/routes/servers.py` | 1 | [ ] |
| 8 | Add TypeScript types for pack assignment | `types/server.ts` | - | [ ] |
| 9 | Add API client functions | `api/servers.ts` | 8 | [ ] |
| 10 | Create PackAssignment component | `components/PackAssignment.tsx` | 9 | [ ] |
| 11 | Integrate component into ServerDetail page | `pages/ServerDetail.tsx` | 10 | [ ] |
| 12 | Write backend tests | `tests/test_pack_assignment.py` | 5, 6, 7 | [ ] |
| 13 | Write frontend tests | `__tests__/PackAssignment.test.tsx` | 10 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 4, 8 | None (can start in parallel) |
| B | 2, 3, 5, 6, 7, 9 | Task 1, 4, 8 complete |
| C | 10, 11 | Task 9 complete |
| D | 12, 13 | All above complete |

---

## Implementation Phases

### Phase 1: Database Schema
**Goal:** Add assigned_packs and drift_detection_enabled fields to Server model

- [ ] Add `assigned_packs: Mapped[list[str] | None]` JSON column (default=["base"])
- [ ] Add `drift_detection_enabled: Mapped[bool]` column (default=True)
- [ ] Create Alembic migration for both fields

**Files:** `backend/src/homelab_cmd/db/models/server.py`, `migrations/versions/`

### Phase 2: Backend API
**Goal:** Implement GET and PUT endpoints for pack assignment

- [ ] Add `PackAssignmentRequest` schema (packs: list[str])
- [ ] Add `PackAssignmentResponse` schema (server_id, assigned_packs)
- [ ] Implement GET /api/v1/servers/{server_id}/config/packs
- [ ] Implement PUT /api/v1/servers/{server_id}/config/packs
- [ ] Validate pack names against available packs from ConfigPackService
- [ ] Ensure "base" pack cannot be removed

**Files:** `backend/src/homelab_cmd/api/schemas/server.py`, `backend/src/homelab_cmd/api/routes/servers.py`

### Phase 3: Default Assignment
**Goal:** Auto-assign packs when server is registered

- [ ] Create `get_default_packs(machine_type: str)` helper function
- [ ] Modify server registration to set default assigned_packs
- [ ] Server: defaults to ["base"]
- [ ] Workstation: defaults to ["base", "developer-lite"]

**Files:** `backend/src/homelab_cmd/api/routes/servers.py`

### Phase 4: Frontend Components
**Goal:** Create UI for pack assignment

- [ ] Add TypeScript types for pack assignment
- [ ] Add `getAssignedPacks()` API function
- [ ] Add `updateAssignedPacks()` API function
- [ ] Create `PackAssignment` component with checkboxes
- [ ] Integrate into ServerDetail advanced section

**Files:** `frontend/src/types/server.ts`, `frontend/src/api/servers.ts`, `frontend/src/components/PackAssignment.tsx`, `frontend/src/pages/ServerDetail.tsx`

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Migration creates column | `migrations/versions/` | Pending |
| AC2 | API test for PUT endpoint | `tests/test_pack_assignment.py` | Pending |
| AC3 | API test for GET endpoint | `tests/test_pack_assignment.py` | Pending |
| AC4 | Frontend displays packs | `pages/ServerDetail.tsx` | Pending |
| AC5 | Component test for checkboxes | `__tests__/PackAssignment.test.tsx` | Pending |
| AC6 | API test for registration defaults | `tests/test_pack_assignment.py` | Pending |
| AC7 | Compliance service uses field | `services/compliance_service.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Empty packs array | Default to ["base"] in API | Phase 2 |
| 2 | Unknown pack name | Reject with 400 error via ConfigPackService validation | Phase 2 |
| 3 | Remove base pack | Prevent removal, return 400 error | Phase 2 |
| 4 | Machine type changes | Don't auto-update packs (preserve user choice) | Phase 3 |
| 5 | Null assigned_packs | Treat as ["base"] in API response | Phase 2 |

**Coverage:** 5/5 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ConfigPackService not available | Pack validation fails | Check service availability, fallback to known packs |
| Migration on production | Data loss | Migration only adds column with default, no data loss |
| Frontend state sync | Stale data | Refresh after save, use onUpdate callback |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration created and tested
- [ ] Frontend component tested

---

## Notes

This story is a prerequisite for US0122 (Configuration Drift Detection) which requires the `assigned_packs` field to determine which packs to check. The `drift_detection_enabled` field is also added here for efficiency (both are configuration-related).
