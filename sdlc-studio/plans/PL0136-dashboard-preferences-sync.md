# PL0136: Dashboard Preferences Sync - Implementation Plan

> **Status:** Draft
> **Story:** [US0136: Dashboard Preferences Sync](../stories/US0136-dashboard-preferences-sync.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (frontend), Python (backend)

## Overview

Consolidate existing dashboard preferences (card order, collapsed sections) into a unified `/api/v1/preferences/dashboard` endpoint. This reduces API calls from 2 to 1 on page load, adds loading states, improves error handling, and prepares for future preference additions (view_mode).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Unified preference storage | All preferences stored in single backend record |
| AC2 | Single-call load | All preferences fetched in one API call |
| AC3 | Immediate save | Changes saved within 500ms (debounced) with "Saved" indicator |
| AC4 | Preference structure | JSON structure with card_order, collapsed_sections, view_mode |
| AC5 | Conflict resolution | Last-write-wins by timestamp |
| AC6 | Loading state | Skeleton/loading state while fetching |
| AC7 | Fallback to defaults | Graceful degradation on error |

---

## Technical Context

### Language & Framework
- **Backend:** Python 3.11, FastAPI, SQLAlchemy
- **Frontend:** TypeScript, React 18
- **Test Framework:** pytest (backend), Vitest + RTL (frontend)

### Relevant Best Practices
- Avoid `any` types - use explicit types for API responses
- Explicit return types for exported functions
- Use discriminated unions for loading/error/success states
- Readonly arrays for function arguments

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Pydantic schemas, async endpoints |
| React | /facebook/react | useState, useEffect, useCallback |

### Existing Patterns
- `preferences.py` - Existing preference endpoints with upsert pattern
- `useDebouncedSave` hook - Already used for section order debouncing
- `Dashboard.tsx` - Currently loads 2 preferences separately

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Consolidating existing functionality into a single endpoint. Backend is simple CRUD, frontend is hook refactor. Easier to iterate on structure first, then add tests.

### Test Priority
1. API endpoint returns correct structure (unit)
2. Debounced save calls API once (unit)
3. Loading state shows during fetch (integration)

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create DashboardPreferences schema | `preferences.py` (schemas) | - | [ ] |
| 2 | Add unified GET endpoint | `preferences.py` (routes) | 1 | [ ] |
| 3 | Add unified PUT endpoint | `preferences.py` (routes) | 1 | [ ] |
| 4 | Update frontend types | `types/preferences.ts` | - | [ ] |
| 5 | Update API client functions | `api/preferences.ts` | 4 | [ ] |
| 6 | Create useDashboardPreferences hook | `hooks/useDashboardPreferences.ts` | 5 | [ ] |
| 7 | Refactor Dashboard.tsx to use hook | `pages/Dashboard.tsx` | 6 | [ ] |
| 8 | Add loading skeleton | `pages/Dashboard.tsx` | 7 | [ ] |
| 9 | Add "Saved" indicator | `pages/Dashboard.tsx` | 7 | [ ] |
| 10 | Write backend tests | `test_api_preferences.py` | 2, 3 | [ ] |
| 11 | Write frontend tests | `useDashboardPreferences.test.ts` | 6 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 4 | None - schemas/types |
| B | 2, 3, 5 | Group A - API layer |
| C | 6 | Group B - hook |
| D | 7, 8, 9 | Group C - Dashboard integration |
| E | 10, 11 | Group D - tests |

---

## Implementation Phases

### Phase 1: Backend Unified Endpoint
**Goal:** Create consolidated /preferences/dashboard endpoint

- [ ] Add `DashboardPreferences` and `CardOrder` Pydantic schemas
- [ ] Add GET `/api/v1/preferences/dashboard` endpoint
- [ ] Add PUT `/api/v1/preferences/dashboard` endpoint
- [ ] Migrate from separate config keys to single "dashboard" key

**Files:**
- `backend/src/homelab_cmd/api/schemas/preferences.py` - Add new schemas
- `backend/src/homelab_cmd/api/routes/preferences.py` - Add unified endpoints

### Phase 2: Frontend API Client & Types
**Goal:** Update frontend to use new endpoint structure

- [ ] Add `DashboardPreferences`, `CardOrder` types
- [ ] Add `getDashboardPreferences()` function
- [ ] Add `saveDashboardPreferences()` function
- [ ] Keep legacy functions for backwards compatibility (deprecate)

**Files:**
- `frontend/src/types/preferences.ts` - Add unified types
- `frontend/src/api/preferences.ts` - Add unified API functions

### Phase 3: useDashboardPreferences Hook
**Goal:** Encapsulate preference loading, saving, debouncing

- [ ] Create hook with loading/error/success states
- [ ] Add debounced save (500ms)
- [ ] Add isSaving state for "Saved" indicator
- [ ] Export preference values and update functions

**Files:**
- `frontend/src/hooks/useDashboardPreferences.ts` - New hook

### Phase 4: Dashboard Integration
**Goal:** Refactor Dashboard to use unified hook

- [ ] Replace separate preference API calls with hook
- [ ] Add loading skeleton during preference fetch
- [ ] Add "Saved" indicator on successful save
- [ ] Update error handling with toast and defaults

**Files:**
- `frontend/src/pages/Dashboard.tsx` - Refactor to use hook

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: single DB record | `test_api_preferences.py` | Pending |
| AC2 | Unit test: GET returns all fields | `test_api_preferences.py` | Pending |
| AC3 | Unit test: debounced save timing | `useDashboardPreferences.test.ts` | Pending |
| AC4 | Unit test: response schema | `test_api_preferences.py` | Pending |
| AC5 | Unit test: last-write-wins | `test_api_preferences.py` | Pending |
| AC6 | Unit test: loading state | `Dashboard.test.tsx` | Pending |
| AC7 | Unit test: fallback defaults | `useDashboardPreferences.test.ts` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | First time user (no preferences) | Return defaults, first save creates record | 1 |
| 2 | Network error on load | Toast warning, use defaults | 4 |
| 3 | Network error on save | Toast error with retry button | 4 |
| 4 | Rapid changes (10+ in 2 seconds) | Debounce to only save final state | 3 |
| 5 | Page closed during debounce | Acceptable loss - preference may not save | 3 |
| 6 | Invalid preference data from server | Log error, use defaults | 3 |
| 7 | Server returns 500 on save | Retry up to 3 times with backoff | 3 |
| 8 | Very large preference object | API validates max size (reject if >10KB) | 1 |

**Coverage:** 8/8 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing preferences | High | Migration logic in backend to convert old format |
| Multiple API calls during transition | Medium | Keep legacy endpoints, deprecate later |
| Loading flicker on fast networks | Low | Minimum 200ms loading state or skeleton |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Legacy endpoints marked as deprecated (not removed)

---

## Notes

- This consolidates US0131 (card order) and US0132 (collapsed sections) preferences
- The `view_mode` field is included for future use (currently always "grid")
- `updated_at` timestamp enables future sync features and conflict detection
- Legacy `/preferences/section-order` and `/preferences/collapsed-sections` endpoints should remain for backwards compatibility but be marked deprecated
