# PL0190: Remove Configuration Pack - Implementation Plan

> **Status:** In Progress
> **Story:** [US0123: Remove Configuration Pack](../stories/US0123-remove-configuration-pack.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python + TypeScript

## Overview

Implement a configuration pack removal feature that provides "reverse apply" functionality. Users can remove pack-specific files and settings from machines while preserving installed packages. This is the inverse of US0119 (Apply Configuration Pack), using the same infrastructure but with deletion operations instead of creation.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Remove Endpoint | DELETE /api/v1/servers/{id}/config/apply?pack={pack_name} |
| AC2 | File Removal | Delete files with backup to {path}.homelabcmd.bak |
| AC3 | Package Preservation | Packages are NOT uninstalled, result notes skipped |
| AC4 | Settings Cleanup | Remove env var export lines from shell config |
| AC5 | Confirmation Required | Without confirm=true, return preview only |
| AC6 | Warning Display | Modal shows warning about file deletion |
| AC7 | Audit Logging | Log items removed with user and timestamp |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Framework:** FastAPI + SQLAlchemy (backend), React + Tailwind (frontend)
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices
- Use Pydantic for request/response validation
- Explicit return types on exported TypeScript functions
- Handle null/undefined explicitly with `?.` and `??`
- Use sed for removing specific lines from config files
- Continue on partial failure, report all results
- Create backups before destructive operations

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | BackgroundTasks, dependency injection |
| React | /facebook/react | useState, useEffect, modal patterns |

### Existing Patterns

**Backend (from config_apply.py, config_apply_service.py):**
- Background task pattern with progress tracking
- SSHPooledExecutor for command execution
- ApplyPreviewResponse for dry-run previews
- ApplyStatusResponse for progress updates
- ConfigApply model for operation state

**Frontend (from ApplyPackModal.tsx):**
- Modal with preview/progress/complete states
- Polling for progress updates
- Confirmation flow before destructive action

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This story mirrors the apply pattern from US0119. The AC are clear and the implementation reuses existing infrastructure. Test-After allows verifying the deletion logic works correctly before writing comprehensive tests.

### Test Priority
1. Preview mode returns items without executing deletion
2. File deleted with backup created at .homelabcmd.bak
3. Packages explicitly skipped with appropriate message
4. Env var removed from shell config file
5. Audit log created on completion
6. SSH failure aborts cleanly with no partial changes

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add RemoveRequest/RemovePreviewResponse schemas | `api/schemas/config_apply.py` | - | [ ] |
| 2 | Add ConfigRemoveService with preview/remove methods | `services/config_apply_service.py` | 1 | [ ] |
| 3 | Add DELETE endpoint to config_apply router | `api/routes/config_apply.py` | 1, 2 | [ ] |
| 4 | Add remove TypeScript types | `frontend/src/types/config-apply.ts` | - | [ ] |
| 5 | Add API client functions (getRemovePreview, removePackage) | `frontend/src/api/config-apply.ts` | 4 | [ ] |
| 6 | Create RemovePackModal component | `frontend/src/components/RemovePackModal.tsx` | 4, 5 | [ ] |
| 7 | Add Remove button to ConfigDiffView | `frontend/src/pages/ConfigDiffView.tsx` | 6 | [ ] |
| 8 | Write backend unit tests | `tests/test_config_remove_api.py` | 3 | [ ] |
| 9 | Write frontend unit tests | `frontend/src/__tests__/RemovePackModal.test.tsx` | 6 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend Schemas | 1 | None |
| Backend Logic | 2, 3 | Task 1 |
| Frontend Types | 4, 5 | None (parallel with backend) |
| Frontend Components | 6, 7 | Tasks 4, 5 |
| Tests | 8, 9 | Implementation complete |

---

## Implementation Phases

### Phase 1: Backend Schemas
**Goal:** Extend existing schemas for remove operations

- [ ] Add RemoveRequest schema (pack_name, confirm boolean)
- [ ] Add RemovePreviewItem schema (type, path/name, action, note)
- [ ] Add RemovePreviewResponse schema (preview items grouped by type)
- [ ] Add RemoveItemResult schema (matching ApplyItemResult pattern)
- [ ] Add RemoveResponse schema (success, items, removed_at)

**Files:**
- `backend/src/homelab_cmd/api/schemas/config_apply.py` - Extend existing

### Phase 2: Backend Service and API
**Goal:** Implement remove logic with file backup and settings cleanup

- [ ] Add `get_remove_preview()` method to ConfigApplyService
- [ ] Add `remove_pack()` method with confirm/preview flow
- [ ] Implement file deletion with backup via SSH:
  ```bash
  cp {path} {path}.homelabcmd.bak 2>/dev/null || true
  rm -f {path}
  ```
- [ ] Implement package skip with message
- [ ] Implement env var removal from .bashrc.d/env.sh:
  ```bash
  sed -i '/^export {KEY}=/d' ~/.bashrc.d/env.sh
  ```
- [ ] Add audit logging for removal operations
- [ ] Add DELETE /servers/{id}/config/apply endpoint

**Files:**
- `backend/src/homelab_cmd/services/config_apply_service.py` - Add remove methods
- `backend/src/homelab_cmd/api/routes/config_apply.py` - Add DELETE endpoint

### Phase 3: Frontend Components
**Goal:** Create removal modal with confirmation warning

- [ ] Add TypeScript types for remove operations
- [ ] Add getRemovePreview and confirmRemove API functions
- [ ] Create RemovePackModal component with states:
  - Preview: show items to delete/skip with warning banner
  - Progress: poll for status during removal
  - Complete: show summary with backup paths
- [ ] Add warning banner: "Files will be deleted. Packages will remain installed."
- [ ] Add Remove Pack button to ConfigDiffView header
- [ ] Enable button only when pack is applied

**Files:**
- `frontend/src/types/config-apply.ts` - Add remove types
- `frontend/src/api/config-apply.ts` - Add remove API functions
- `frontend/src/components/RemovePackModal.tsx` - New component
- `frontend/src/pages/ConfigDiffView.tsx` - Add Remove button

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: DELETE endpoint with pack query param | `tests/test_config_remove_api.py` | Pending |
| AC2 | Unit test: file deleted, backup created | `tests/test_config_remove_api.py` | Pending |
| AC3 | Unit test: package skipped with message | `tests/test_config_remove_api.py` | Pending |
| AC4 | Unit test: sed removes export line | `tests/test_config_remove_api.py` | Pending |
| AC5 | Unit test: confirm=false returns preview | `tests/test_config_remove_api.py` | Pending |
| AC6 | Frontend test: warning banner displayed | `RemovePackModal.test.tsx` | Pending |
| AC7 | Unit test: audit log entry created | `tests/test_config_remove_api.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | File doesn't exist | Skip with "already removed" note, success=true | Phase 2 |
| 2 | Backup fails | Proceed anyway with warning, log the failure | Phase 2 |
| 3 | File deletion fails | Report error in item.error, continue with others | Phase 2 |
| 4 | Setting not in config | Skip with "not found" note, success=true | Phase 2 |
| 5 | Pack not assigned | Allow removal anyway (idempotent cleanup) | Phase 2 |
| 6 | SSH connection fails | Abort immediately, no changes made | Phase 2 |
| 7 | Permission denied on file | Report error, continue with remaining items | Phase 2 |
| 8 | .bashrc.d/env.sh doesn't exist | Skip settings removal gracefully | Phase 2 |

**Coverage:** 8/8 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidental data loss | User loses important files | Mandatory backup to .homelabcmd.bak before deletion |
| SSH command injection | Security vulnerability | Escape/validate all pack paths, use parameterised commands |
| Incomplete removal | Orphaned configuration | Continue on failure pattern, report all results clearly |
| Package dependency breaks | System instability | Explicitly skip package removal, document in UI |

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

- This story is the inverse of US0119 (Apply Configuration Pack)
- Reuses the same service infrastructure (ConfigApplyService, SSHPooledExecutor)
- Files are backed up before deletion to allow manual recovery
- Packages are explicitly NOT removed to prevent breaking system dependencies
- The removal is idempotent - removing from a machine without the pack is a no-op
- No undo functionality is provided; users must manually restore from backups
