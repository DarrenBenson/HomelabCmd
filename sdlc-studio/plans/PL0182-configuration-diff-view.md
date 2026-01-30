# PL0182: Configuration Diff View - Implementation Plan

> **Status:** Complete
> **Story:** [US0118: Configuration Diff View](../stories/US0118-configuration-diff-view.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python + TypeScript

## Overview

Implement a configuration diff view that displays the differences between expected and actual configuration states. This builds on the compliance check results from US0117 to provide a user-friendly visualisation of what's missing, different, or misconfigured on a server.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Diff Endpoint | GET /api/v1/servers/{id}/config/diff returns structured diff data |
| AC2 | File Content Diff | Unified diff format for file content differences |
| AC3 | Package Version Diff | Shows expected vs actual package versions |
| AC4 | Missing Item Diff | Shows missing files/packages with expected state |
| AC5 | Frontend Diff Display | Colour-coded, collapsible diff sections |
| AC6 | Check Again Button | Re-runs compliance check and refreshes diff |
| AC7 | Apply Pack Button | Links to US0119 (out of scope for now, button only) |

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

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Dependency injection, response models |
| React | /facebook/react | Hooks, functional components |

### Existing Patterns

**Backend (from US0117):**
- `MismatchItem` schema with `type`, `item`, `expected`, `actual` fields
- `ConfigCheckResponse` with `mismatches: list[MismatchItem]`
- Service layer pattern with `ComplianceCheckService`
- Error handling: 404 for missing resources, 503 for SSH errors

**Frontend:**
- Collapsible sections with `useState(false)` and rotating chevron
- Colour-coded status using `status-error`, `status-warning`, `status-success`
- API client pattern in `frontend/src/api/servers.ts`
- Detail panel pattern from `AlertDetailPanel.tsx`

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This story is UI-heavy with frontend components that benefit from seeing the visual result before writing tests. The backend endpoint is straightforward (mostly reformatting existing data). Frontend visual testing is easier after implementation.

### Test Priority
1. Backend: Diff endpoint returns correct structure for each mismatch type
2. Backend: Handles missing server and empty mismatches correctly
3. Frontend: Component renders all mismatch types with correct styling

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create ConfigDiffResponse schema | `api/schemas/config_check.py` | - | [ ] |
| 2 | Add diff endpoint to route | `api/routes/config_check.py` | 1 | [ ] |
| 3 | Create diff generation logic | `services/compliance_service.py` | 1, 2 | [ ] |
| 4 | Create TypeScript types | `frontend/src/types/config-check.ts` | - | [ ] |
| 5 | Create API client function | `frontend/src/api/config-check.ts` | 4 | [ ] |
| 6 | Create MismatchSection component | `frontend/src/components/MismatchSection.tsx` | 4 | [ ] |
| 7 | Create DiffLine component | `frontend/src/components/DiffLine.tsx` | 4 | [ ] |
| 8 | Create ConfigDiffView component | `frontend/src/pages/ConfigDiffView.tsx` | 5, 6, 7 | [ ] |
| 9 | Add route to App.tsx | `frontend/src/App.tsx` | 8 | [ ] |
| 10 | Write backend unit tests | `tests/test_config_diff_api.py` | 2, 3 | [ ] |
| 11 | Write frontend unit tests | `frontend/src/__tests__/ConfigDiffView.test.tsx` | 8 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend | 1, 2, 3 | None |
| Frontend Types | 4, 5 | None (can parallel with backend) |
| Frontend Components | 6, 7, 8 | Tasks 4, 5 |
| Integration | 9 | Task 8 |
| Tests | 10, 11 | Implementation complete |

---

## Implementation Phases

### Phase 1: Backend API
**Goal:** Create diff endpoint that transforms compliance check results into diff format

- [ ] Add ConfigDiffResponse schema with summary and enhanced mismatch data
- [ ] Add GET /servers/{id}/config/diff endpoint
- [ ] Add optional file content diff generation for `wrong_content` type
- [ ] Handle edge cases: no mismatches, server not found

**Files:**
- `backend/src/homelab_cmd/api/schemas/config_check.py` - Add ConfigDiffResponse, DiffSummary
- `backend/src/homelab_cmd/api/routes/config_check.py` - Add diff endpoint
- `backend/src/homelab_cmd/services/compliance_service.py` - Add diff formatting method

### Phase 2: Frontend Components
**Goal:** Create reusable components for displaying diff data

- [ ] Create TypeScript types matching backend schema
- [ ] Create API client function for diff endpoint
- [ ] Create MismatchSection collapsible component
- [ ] Create DiffLine component for unified diff display
- [ ] Create ConfigDiffView page component
- [ ] Add styling for diff lines (green/red/context)

**Files:**
- `frontend/src/types/config-check.ts` - TypeScript interfaces
- `frontend/src/api/config-check.ts` - API client
- `frontend/src/components/MismatchSection.tsx` - Collapsible section
- `frontend/src/components/DiffLine.tsx` - Diff line styling
- `frontend/src/pages/ConfigDiffView.tsx` - Main view component

### Phase 3: Integration
**Goal:** Connect diff view to application routing

- [ ] Add route to App.tsx
- [ ] Add navigation from server detail page (link to diff view)

**Files:**
- `frontend/src/App.tsx` - Add route
- `frontend/src/pages/ServerDetail.tsx` - Add link to diff view

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: diff endpoint returns structured data | `tests/test_config_diff_api.py` | Pending |
| AC2 | Unit test: file content diff in unified format | `tests/test_config_diff_api.py` | Pending |
| AC3 | Unit test: package version shows both versions | `tests/test_config_diff_api.py` | Pending |
| AC4 | Unit test: missing item shows expected state | `tests/test_config_diff_api.py` | Pending |
| AC5 | Visual: frontend renders colour-coded sections | Manual verification | Pending |
| AC6 | Manual: Check Again button triggers refresh | Manual verification | Pending |
| AC7 | Visual: Apply Pack button visible with mismatches | Manual verification | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | No mismatches (compliant) | Return empty mismatches array, frontend shows success message | Phase 1 |
| 2 | Binary file content | Detect binary, return "Binary file differs" message | Phase 1 |
| 3 | Very large diff (>1000 lines) | Truncate with line count and "Show more" indicator | Phase 1 |
| 4 | File content not retrievable | Return "Content unavailable" with reason field | Phase 1 |
| 5 | Diff endpoint fails | Frontend shows error message with retry button | Phase 2 |
| 6 | Pack not assigned to server | Return 404 with "Pack not found" message | Phase 1 |

**Coverage:** 6/6 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large file diffs may be slow | Performance | Truncate at 1000 lines, add pagination later |
| Binary files can't be diffed | UX | Detect binary and show "Binary file differs" |
| SSH timeout during content fetch | Reliability | Use cached compliance results, don't re-fetch |

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

- The diff endpoint should use the most recent compliance check result from the database, not trigger a new check
- File content diffs require the content to be stored during the compliance check - may need to extend US0117's storage
- The "Apply Pack" button is a placeholder for US0119 - it should be disabled or link to a "Coming soon" state
- Consider adding a "Check Again" button that triggers a new compliance check and then refreshes the diff
