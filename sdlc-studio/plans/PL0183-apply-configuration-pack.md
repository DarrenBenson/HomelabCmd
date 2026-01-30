# PL0183: Apply Configuration Pack - Implementation Plan

> **Status:** Complete
> **Story:** [US0119: Apply Configuration Pack](../stories/US0119-apply-configuration-pack.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python + TypeScript

## Overview

Implement a configuration pack application feature that allows administrators to apply expected configuration to servers with one click. This builds on the diff view (US0118) to provide remediation capabilities via SSH, including file creation, package installation, and environment variable configuration.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Apply Endpoint | POST /api/v1/servers/{id}/config/apply with pack name |
| AC2 | Dry-Run Option | Preview changes without applying when dry_run=true |
| AC3 | File Creation | Create files with content, permissions, and parent dirs |
| AC4 | Package Installation | Install packages via apt-get with sudo |
| AC5 | Progress Tracking | Show current item, success/failure, percentage |
| AC6 | Result Details | Per-item results with action and error message |
| AC7 | Audit Logging | Log user, pack, items changed, timestamp |
| AC8 | Auto-Recheck | Trigger compliance check after successful apply |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Framework:** FastAPI + SQLAlchemy (backend), React + Tailwind (frontend)
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices
- Use Pydantic for request/response validation
- Explicit return types on exported TypeScript functions
- Avoid `any` in TypeScript - use specific types
- Use `readonly` arrays in function parameters
- Handle null/undefined explicitly with `?.` and `??`
- Use heredoc for file content with special characters
- Continue on partial failure, report all results

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | BackgroundTasks, dependency injection |
| React | /facebook/react | useState, useEffect, polling patterns |

### Existing Patterns

**Backend (from scan.py, compliance_service.py):**
- Background task pattern: POST returns ID, background task updates status
- SSHPooledExecutor for command execution with retry logic
- ConfigPackService for loading pack definitions
- Progress tracking via status/progress fields in model
- JSON column for storing structured results

**Frontend (from AgentUpgradeModal.tsx):**
- Modal pattern: isOpen, onClose, onSuccess props
- Internal state: loading, error, success
- Polling pattern for progress updates
- Loading spinner with `animate-spin`

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This story is complex with SSH orchestration and UI progress tracking. The AC are clear but involve heavy integration testing that benefits from seeing the implementation first. UI progress components are easier to test after visual verification.

### Test Priority
1. Dry-run endpoint returns preview without executing commands
2. Apply creates files with correct content and permissions
3. Partial failure handling continues and reports all results
4. Progress tracking updates during apply operation
5. Audit log created on successful apply

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create ApplyRequest/Response schemas | `api/schemas/config_apply.py` | - | [ ] |
| 2 | Create ConfigApply database model | `db/models/config_apply.py` | - | [ ] |
| 3 | Register model in db/models/__init__.py | `db/models/__init__.py` | 2 | [ ] |
| 4 | Create Alembic migration | `migrations/versions/` | 2, 3 | [ ] |
| 5 | Create ConfigApplyService | `services/config_apply_service.py` | 1 | [ ] |
| 6 | Add apply routes | `api/routes/config_apply.py` | 1, 5 | [ ] |
| 7 | Register router in main.py | `main.py` | 6 | [ ] |
| 8 | Create TypeScript types | `frontend/src/types/config-apply.ts` | - | [ ] |
| 9 | Create API client functions | `frontend/src/api/config-apply.ts` | 8 | [ ] |
| 10 | Create ApplyPackModal component | `frontend/src/components/ApplyPackModal.tsx` | 8, 9 | [ ] |
| 11 | Update ConfigDiffView with Apply button | `frontend/src/pages/ConfigDiffView.tsx` | 10 | [ ] |
| 12 | Write backend unit tests | `tests/test_config_apply_api.py` | 6 | [ ] |
| 13 | Write frontend unit tests | `frontend/src/__tests__/ApplyPackModal.test.tsx` | 10 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend Schemas | 1, 2 | None |
| Backend Logic | 3, 4, 5, 6, 7 | Tasks 1, 2 |
| Frontend Types | 8, 9 | None (parallel with backend) |
| Frontend Components | 10, 11 | Tasks 8, 9 |
| Tests | 12, 13 | Implementation complete |

---

## Implementation Phases

### Phase 1: Backend Schemas and Models
**Goal:** Create data structures for apply operations

- [ ] Create ApplyRequest, DryRunItem, ApplyItemResult, ApplyResponse schemas
- [ ] Create ConfigApply SQLAlchemy model with status tracking
- [ ] Register model and create migration
- [ ] Add relationship to Server model

**Files:**
- `backend/src/homelab_cmd/api/schemas/config_apply.py` - New schemas
- `backend/src/homelab_cmd/db/models/config_apply.py` - New model
- `backend/src/homelab_cmd/db/models/__init__.py` - Register model
- `migrations/versions/h6i7j8k9l0m1_add_config_apply.py` - Migration

### Phase 2: Backend Service and API
**Goal:** Implement apply logic with SSH execution

- [ ] Create ConfigApplyService with apply_pack method
- [ ] Implement dry-run preview logic
- [ ] Implement file creation via SSH (mkdir -p, cat heredoc, chmod)
- [ ] Implement package installation via SSH (sudo apt-get install -y)
- [ ] Implement env var setting via SSH (append to .bashrc.d/env.sh)
- [ ] Add progress tracking and result collection
- [ ] Add audit logging
- [ ] Add auto-recheck trigger via ComplianceCheckService
- [ ] Create POST /config/apply endpoint with BackgroundTasks
- [ ] Create GET /config/apply/{id} endpoint for progress

**Files:**
- `backend/src/homelab_cmd/services/config_apply_service.py` - New service
- `backend/src/homelab_cmd/api/routes/config_apply.py` - New routes
- `backend/src/homelab_cmd/main.py` - Register router

### Phase 3: Frontend Components
**Goal:** Create apply modal with preview and progress

- [ ] Create TypeScript types matching backend schemas
- [ ] Create API client functions (applyPack, getApplyStatus)
- [ ] Create ApplyPackModal component with three states:
  - Preview: show dry-run results grouped by type
  - Progress: poll for updates, show progress bar and item list
  - Complete: show summary with success/failure counts
- [ ] Update ConfigDiffView to enable Apply button and open modal
- [ ] Add polling logic with cleanup on unmount

**Files:**
- `frontend/src/types/config-apply.ts` - TypeScript interfaces
- `frontend/src/api/config-apply.ts` - API client
- `frontend/src/components/ApplyPackModal.tsx` - Modal component
- `frontend/src/pages/ConfigDiffView.tsx` - Enable Apply button

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: apply endpoint accepts pack name | `tests/test_config_apply_api.py` | Pending |
| AC2 | Unit test: dry_run returns preview only | `tests/test_config_apply_api.py` | Pending |
| AC3 | Unit test: file created with content/permissions | `tests/test_config_apply_api.py` | Pending |
| AC4 | Unit test: apt-get command executed | `tests/test_config_apply_api.py` | Pending |
| AC5 | Integration: progress updates during apply | Manual verification | Pending |
| AC6 | Unit test: results include per-item status | `tests/test_config_apply_api.py` | Pending |
| AC7 | Unit test: audit log entry created | `tests/test_config_apply_api.py` | Pending |
| AC8 | Unit test: compliance check triggered after apply | `tests/test_config_apply_api.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | SSH connection fails | Return error immediately, status=failed, no changes | Phase 2 |
| 2 | Single item fails | Continue with remaining items, mark item failed, overall success=false | Phase 2 |
| 3 | Sudo password required | Use CredentialService for stored credentials | Phase 2 |
| 4 | File content has special chars | Use heredoc with unique delimiter (HOMELABCMD_EOF) | Phase 2 |
| 5 | Package not in apt repos | Report failure with apt error message in item.error | Phase 2 |
| 6 | Disk full | Report failure, item.error contains disk space message | Phase 2 |
| 7 | Network interruption during apply | Partial results stored, status=failed with error | Phase 2 |

**Coverage:** 7/7 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSH command injection | Security vulnerability | Escape/validate all user input, use parameterised commands |
| Long-running apply timeout | User experience | Progress tracking with polling, background task pattern |
| Partial apply leaves inconsistent state | Data integrity | Continue on failure and report, document rollback as out of scope |
| Concurrent applies to same server | Race condition | Check for running apply before starting new one |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)

---

## Notes

- The "Apply Pack" button in ConfigDiffView is currently disabled as a placeholder (from US0118). This story enables it.
- Rollback on partial failure is explicitly out of scope per the story.
- Only apt package manager is supported (no yum/dnf/Windows).
- The background task pattern from scan.py is reused for long-running operations.
- Auto-recheck (AC8) calls ComplianceCheckService.check_compliance after successful apply.
