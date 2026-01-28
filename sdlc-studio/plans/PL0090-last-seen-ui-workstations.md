# PL0090: Last Seen UI for Workstations - Implementation Plan

> **Status:** Complete
> **Story:** [US0090: Last Seen UI for Workstations](../stories/US0090-last-seen-ui-workstations.md)
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Created:** 2026-01-27
> **Completed:** 2026-01-27
> **Language:** TypeScript (React)

## Overview

Update the ServerCard component to display differentiated status for workstations vs servers when offline. Servers continue to show "OFFLINE" with a red indicator, while workstations show "Last seen: X ago" with a grey indicator. This reflects that workstations being offline is normal behaviour, not an error condition.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Workstation "Last Seen" display | Offline workstations show "Last seen: X ago" with grey indicator |
| AC2 | Server OFFLINE unchanged | Offline servers show "OFFLINE" with red indicator |
| AC3 | Relative time formatting | Time formatted as relative, updates dynamically |
| AC4 | Status indicator colours | Green (online), red (server offline), grey (workstation offline) |
| AC5 | Tooltip explanation | Workstation hover shows "Workstation - intermittent availability expected" |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React 18 with Vite
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

From `~/.claude/best-practices/typescript.md`:
- Avoid `any`, use `unknown` with type guards
- Handle `null` and `undefined` explicitly with `?.` and `??`
- Explicit return types for exported functions
- No `!` non-null assertions

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| date-fns | /date-fns/date-fns | formatDistanceToNow relative time | `formatDistanceToNow(date, { addSuffix: true })` |
| React | /facebook/react | useEffect interval cleanup | Return cleanup function from useEffect |

### Existing Patterns

1. **StatusLED** - `components/StatusLED.tsx` uses cn() for conditional classes, supports online/offline/unknown
2. **ServerCard** - `components/ServerCard.tsx` shows current card structure with metrics and badges
3. **Server type** - `types/server.ts` defines Server interface used in ServerCard
4. **Test patterns** - `ServerCard.test.tsx` shows mockServer pattern and status assertions

## Recommended Approach

**Strategy:** TDD (User Override)
**Rationale:** User explicitly requested TDD with `--tdd` flag. Tests were written first, then implementation was done to make tests pass.

### Test Priority

1. Workstation offline shows "Last seen: X ago" text
2. Server offline shows "OFFLINE" text (regression test)
3. Grey dot indicator for offline workstation
4. Null last_seen handling shows "Last seen: Unknown"
5. Tooltip appears on hover for workstation

### Documentation Updates Required

- [x] Update story status to Planned
- [x] Update story status to Done

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add machine_type to ServerResponse schema | `backend/src/homelab_cmd/api/schemas/server.py` | - | Yes | [x] |
| 2 | Add machine_type and last_seen to Server type | `frontend/src/types/server.ts` | - | Yes | [x] |
| 3 | Add isWorkstation prop to StatusLED for grey state | `frontend/src/components/StatusLED.tsx` | 2 | No | [x] |
| 4 | Update ServerCard for workstation display logic | `frontend/src/components/ServerCard.tsx` | 2, 3 | No | [x] |
| 5 | Add dynamic time update with useEffect | `frontend/src/components/ServerCard.tsx` | 4 | No | [x] |
| 6 | Write unit tests for ServerCard workstation scenarios | `frontend/src/components/ServerCard.test.tsx` | 4, 5 | No | [x] |

### Task Dependency Graph

```
1 (backend schema) ─────────────────────────────────────────┐
                                                            │
2 (frontend types) ──→ 3 (StatusLED) ──→ 4 (ServerCard) ──→ 5 (dynamic) ──→ 6 (tests)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2 | None |
| 2 | 3 | Task 2 |
| 3 | 4, 5 | Task 3 |
| 4 | 6 | Task 5 |

## Implementation Phases

### Phase 1: Schema and Type Updates

**Goal:** Ensure backend returns machine_type and frontend types include it

**Tasks in this phase:** 1, 2

#### Step 1.1: Add machine_type to backend ServerResponse

- [x] Add machine_type field to ServerResponse schema
- [x] Field should be `str` with default "server"

**Files modified:**
- `backend/src/homelab_cmd/api/schemas/server.py` - Added machine_type field to ServerResponse class

**Code added:**
```python
machine_type: str = Field(
    default="server",
    description="Machine type: 'server' (24/7) or 'workstation' (intermittent) (EP0009)",
)
```

#### Step 1.2: Add fields to frontend Server type

- [x] Add machine_type field (optional string)
- [x] Add last_seen field (optional string)

**Files modified:**
- `frontend/src/types/server.ts` - Added to Server interface

**Code added:**
```typescript
export type MachineType = 'server' | 'workstation';

// In Server interface:
machine_type?: MachineType;
last_seen: string | null;
```

### Phase 2: UI Component Updates

**Goal:** Update StatusLED and ServerCard for workstation handling

**Tasks in this phase:** 3, 4, 5

#### Step 2.1: Update StatusLED for workstation offline state

- [x] Add optional `isWorkstation` prop to StatusLEDProps
- [x] Add optional `title` prop for tooltip
- [x] When `status === 'offline'` and `isWorkstation === true`, use grey styling
- [x] Grey uses `bg-text-muted` (same as 'unknown')

**Files modified:**
- `frontend/src/components/StatusLED.tsx`

#### Step 2.2: Update ServerCard display logic

- [x] Import `formatDistanceToNow` from date-fns
- [x] Create helper function `getWorkstationLastSeen()` for display text
- [x] Add "Last seen: X ago" display for offline workstations
- [x] Pass `isWorkstation` and `title` props to StatusLED

**Files modified:**
- `frontend/src/components/ServerCard.tsx`

#### Step 2.3: Add dynamic time updates

- [x] Add useState for tick counter
- [x] Add useEffect with setInterval (60 seconds)
- [x] Cleanup interval on unmount
- [x] Only active for offline workstations

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 6

#### Step 3.1: Unit Tests for ServerCard

- [x] Test workstation offline shows "Last seen" text
- [x] Test server offline shows "OFFLINE" (regression)
- [x] Test grey indicator for workstation offline
- [x] Test null last_seen shows "Unknown"
- [x] Test tooltip title attribute
- [x] Test dynamic time updates

**Test file:** `frontend/src/components/ServerCard.test.tsx`

**Test cases added:** 14 new tests in `Workstation offline display (US0090)` describe block

#### Step 3.2: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: workstation offline display | `ServerCard.test.tsx` | Pass |
| AC2 | Unit test: server offline unchanged | `ServerCard.test.tsx` | Pass |
| AC3 | Unit test + manual: time formatting | `ServerCard.test.tsx` | Pass |
| AC4 | Unit test: status colours | `ServerCard.test.tsx` | Pass |
| AC5 | Unit test: tooltip title | `ServerCard.test.tsx` | Pass |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | `last_seen` is null | Check for null before formatting, return "Last seen: Unknown" | Phase 2 | [x] |
| 2 | `last_seen` in future (clock skew) | date-fns formatDistanceToNow handles gracefully (shows "less than a minute ago") | Phase 2 | [x] |
| 3 | Very old `last_seen` (>30 days) | date-fns automatically formats as "about 1 month ago" etc. | Phase 2 | [x] |
| 4 | Server changes to workstation type | React re-renders automatically when props change | Phase 2 | [x] |
| 5 | Workstation comes online | getStatusDisplay checks online first, returns green status | Phase 2 | [x] |
| 6 | Machine type not set (legacy data) | Default to 'server' behaviour when machine_type is undefined | Phase 2 | [x] |

### Coverage Summary

- Story edge cases: 6
- Handled in plan: 6
- Unhandled: 0

### Edge Case Implementation Notes

All edge cases are handled through defensive coding:
- Null checks with `??` operator
- Type defaults via optional chaining
- date-fns library handles date edge cases automatically
- React's reactivity handles state changes automatically

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| StatusLED change affects other components | Low | Adding optional prop, not changing existing behaviour |
| Dynamic updates cause performance issues | Low | 60s interval is minimal, only active for offline workstations |
| Backend doesn't return machine_type for existing servers | Medium | Backend model defaults to "server", schema defaults to "server" |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0082 (Machine Type Field) | Story | Done |
| date-fns | npm package | Installed (was missing, added during implementation) |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (14 new tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Ready for code review

## Test Results

- **Frontend tests:** 966 passed (36 in ServerCard.test.tsx)
- **Backend tests:** 1545 passed

## Notes

The StatusLED component uses a simple prop approach rather than extending the ServerStatus type. This keeps the change localised and doesn't require updating the type system across the codebase.

The dynamic time update only activates for offline workstations, avoiding unnecessary re-renders for online servers or regular offline servers.

**TDD Note:** Per user request, this story was implemented using TDD approach. Tests were written first (14 failing tests), then implementation was completed to make all tests pass.
