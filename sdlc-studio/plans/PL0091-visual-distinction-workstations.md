# PL0091: Visual Distinction (Server vs Workstation) - Implementation Plan

> **Status:** Complete
> **Story:** [US0091: Visual Distinction (Server vs Workstation)](../stories/US0091-visual-distinction-workstations.md)
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Created:** 2026-01-27
> **Language:** TypeScript (React)

## Overview

Add visual distinction between servers and workstations on the dashboard through icons, badges, colour accents, and border styling. This allows administrators to quickly identify machine types at a glance without reading details.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Machine type icons | Server icon for servers, Monitor icon for workstations |
| AC2 | Type badges | "Server" or "Workstation" badge on each card |
| AC3 | Colour accents | Blue left border for servers, purple for workstations |
| AC4 | Offline workstation border | Dashed border for offline workstations |
| AC5 | Hover tooltip | Full machine type description on hover |
| AC6 | Dashboard grouping | Optional grouped view with counts (enhancement) |

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

### Existing Patterns

1. **StatusLED** - `components/StatusLED.tsx` uses cn() for conditional classes, already supports isWorkstation prop (US0090)
2. **ServerCard** - `components/ServerCard.tsx` has machine type logic from US0090 (isWorkstation, isOfflineWorkstation)
3. **Server type** - `types/server.ts` includes MachineType and machine_type field
4. **Badge patterns** - Existing badges in ServerCard (Inactive, Maintenance) use similar styling approach

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story with primarily styling and component changes. No complex business logic requiring test-first development. Visual verification important alongside unit tests.

### Test Priority

1. Server card shows Server icon
2. Workstation card shows Monitor icon
3. Server badge displays with blue styling
4. Workstation badge displays with purple styling
5. Blue left border for servers
6. Purple left border for workstations
7. Dashed border for offline workstations
8. Solid border for online workstations and all servers
9. Tooltip shows correct machine type description
10. Default styling when machine_type is null/undefined

### Documentation Updates Required

- [ ] Update story status to Planned
- [ ] Update story status to Done (after implementation)

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Create MachineTypeBadge component | `frontend/src/components/MachineTypeBadge.tsx` | - | Yes | [x] |
| 2 | Create MachineTypeIcon component | `frontend/src/components/MachineTypeIcon.tsx` | - | Yes | [x] |
| 3 | Add getMachineTypeStyles helper | `frontend/src/components/ServerCard.tsx` | - | Yes | [x] |
| 4 | Update ServerCard with border styling | `frontend/src/components/ServerCard.tsx` | 3 | No | [x] |
| 5 | Integrate MachineTypeBadge into ServerCard | `frontend/src/components/ServerCard.tsx` | 1, 4 | No | [x] |
| 6 | Integrate MachineTypeIcon into ServerCard | `frontend/src/components/ServerCard.tsx` | 2, 5 | No | [x] |
| 7 | Add dashboard grouping view (optional) | `frontend/src/pages/Dashboard.tsx` | 6 | No | [Deferred] |
| 8 | Write unit tests | `frontend/src/components/ServerCard.test.tsx` | 6 | No | [x] |
| 9 | Write MachineTypeBadge tests | `frontend/src/components/MachineTypeBadge.test.tsx` | 1 | Yes | [x] |

### Task Dependency Graph

```
1 (MachineTypeBadge) ───────────────┐
                                    │
2 (MachineTypeIcon) ────────────────┤
                                    ├──→ 5 (integrate badge) ──→ 6 (integrate icon) ──→ 7 (grouping) ──→ 8 (tests)
3 (getMachineTypeStyles) ──→ 4 (border styling)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2, 3 | None |
| 2 | 4 | Task 3 |
| 3 | 5 | Tasks 1, 4 |
| 4 | 6 | Tasks 2, 5 |
| 5 | 7 | Task 6 |
| 6 | 8, 9 | Task 6 (for 8), Task 1 (for 9) |

## Implementation Phases

### Phase 1: Component Creation

**Goal:** Create reusable MachineTypeBadge and MachineTypeIcon components

**Tasks in this phase:** 1, 2

#### Step 1.1: Create MachineTypeBadge component

- [ ] Create new file `frontend/src/components/MachineTypeBadge.tsx`
- [ ] Accept `type` prop of type `'server' | 'workstation'`
- [ ] Accept optional `title` prop for tooltip
- [ ] Apply blue styling for servers, purple for workstations
- [ ] Use Tailwind classes: `bg-{color}-100 text-{color}-800 border-{color}-200`

**Code pattern:**
```typescript
import { cn } from '../lib/utils';

interface MachineTypeBadgeProps {
  type: 'server' | 'workstation';
  title?: string;
}

export function MachineTypeBadge({ type, title }: MachineTypeBadgeProps) {
  const isWorkstation = type === 'workstation';
  const styles = isWorkstation
    ? 'bg-purple-100 text-purple-800 border-purple-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

  return (
    <span
      className={cn('text-xs px-2 py-0.5 rounded-full border', styles)}
      title={title}
      data-testid="machine-type-badge"
    >
      {isWorkstation ? 'Workstation' : 'Server'}
    </span>
  );
}
```

#### Step 1.2: Create MachineTypeIcon component

- [ ] Create new file `frontend/src/components/MachineTypeIcon.tsx`
- [ ] Import Server and Monitor icons from lucide-react
- [ ] Accept `type` prop of type `'server' | 'workstation'`
- [ ] Accept optional `className` prop for size customisation
- [ ] Accept optional `title` prop for tooltip

**Code pattern:**
```typescript
import { Server, Monitor } from 'lucide-react';
import { cn } from '../lib/utils';

interface MachineTypeIconProps {
  type: 'server' | 'workstation';
  className?: string;
  title?: string;
}

export function MachineTypeIcon({ type, className, title }: MachineTypeIconProps) {
  const Icon = type === 'workstation' ? Monitor : Server;
  return <Icon className={cn('h-4 w-4', className)} title={title} />;
}
```

### Phase 2: ServerCard Styling Updates

**Goal:** Add border styling and integrate new components

**Tasks in this phase:** 3, 4, 5, 6

#### Step 2.1: Add getMachineTypeStyles helper

- [ ] Add helper function to ServerCard.tsx
- [ ] Return border colour class (blue or purple)
- [ ] Return border style class (solid or dashed)
- [ ] Handle null/undefined machine_type (default to server)

**Code pattern:**
```typescript
function getMachineTypeStyles(server: Server): {
  borderColour: string;
  borderStyle: string;
} {
  const isWorkstation = server.machine_type === 'workstation';
  const isOffline = server.status !== 'online';

  return {
    borderColour: isWorkstation ? 'border-l-purple-500' : 'border-l-blue-500',
    borderStyle: isWorkstation && isOffline ? 'border-dashed' : 'border-solid',
  };
}
```

#### Step 2.2: Update ServerCard with border styling

- [ ] Add left border to card container (border-l-4)
- [ ] Apply dynamic border colour from helper
- [ ] Apply dynamic border style from helper
- [ ] Ensure border doesn't affect existing layout

#### Step 2.3: Integrate MachineTypeBadge

- [ ] Import MachineTypeBadge component
- [ ] Add badge to card header after hostname
- [ ] Pass machine_type (defaulting to 'server' if undefined)
- [ ] Pass tooltip title based on machine type

#### Step 2.4: Integrate MachineTypeIcon

- [ ] Import MachineTypeIcon component
- [ ] Add icon to card header before hostname
- [ ] Pass machine_type (defaulting to 'server' if undefined)
- [ ] Apply consistent sizing with other header elements

### Phase 3: Dashboard Grouping (Optional Enhancement)

**Goal:** Add optional grouped view to dashboard

**Tasks in this phase:** 7

#### Step 3.1: Dashboard grouped view

- [ ] Add state for grouping toggle (if implementing)
- [ ] Create groupServers function to separate by machine_type
- [ ] Add section headers with counts
- [ ] Handle empty sections gracefully ("none registered")

**Note:** AC6 is marked as optional enhancement. Implement if time permits, otherwise defer to future story.

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 8, 9

#### Step 4.1: MachineTypeBadge tests

- [ ] Test server badge styling and text
- [ ] Test workstation badge styling and text
- [ ] Test tooltip attribute

#### Step 4.2: ServerCard tests

- [ ] Test Server icon renders for servers
- [ ] Test Monitor icon renders for workstations
- [ ] Test Server badge displays for servers
- [ ] Test Workstation badge displays for workstations
- [ ] Test blue left border for servers
- [ ] Test purple left border for workstations
- [ ] Test dashed border for offline workstations
- [ ] Test solid border for online workstations
- [ ] Test solid border for offline servers
- [ ] Test tooltip shows correct description
- [ ] Test default styling when machine_type is null

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: icon rendering | `ServerCard.test.tsx`, `MachineTypeIcon.test.tsx` | Pass |
| AC2 | Unit test: badge rendering | `ServerCard.test.tsx`, `MachineTypeBadge.test.tsx` | Pass |
| AC3 | Unit test: border colours | `ServerCard.test.tsx` | Pass |
| AC4 | Unit test: dashed border | `ServerCard.test.tsx` | Pass |
| AC5 | Unit test: tooltip content | `ServerCard.test.tsx`, `MachineTypeBadge.test.tsx`, `MachineTypeIcon.test.tsx` | Pass |
| AC6 | Integration test: grouping | `Dashboard.test.tsx` | Deferred (optional) |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | `machine_type` is null | Default to 'server' styling using `?? 'server'` | Phase 2 | [ ] |
| 2 | Unknown machine type value | Default to 'server' styling (not 'workstation' check) | Phase 2 | [ ] |
| 3 | Very long machine name | Existing truncation with ellipsis, badge positioned after | Phase 2 | [ ] |
| 4 | Many workstations (>10) | Grid/flex handles overflow, grouping shows in sections | Phase 3 | [ ] |
| 5 | No workstations registered | Grouped view shows "(none registered)" message | Phase 3 | [ ] |
| 6 | Mixed online/offline states | Each card styled independently based on its own state | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 6
- Handled in plan: 6
- Unhandled: 0

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Border styling conflicts with existing card styles | Low | Use Tailwind's border-l-4 which adds to existing borders |
| Badge takes too much horizontal space | Low | Use compact text-xs sizing, test on narrow viewports |
| Icons not imported correctly | Low | Verify lucide-react exports Server and Monitor icons |
| Grouped view complexity | Medium | Mark AC6 as optional, implement if time permits |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0090 (Last Seen UI) | Story | Done |
| US0082 (Machine Type Field) | Story | Done |
| lucide-react | npm package | Installed |
| Tailwind CSS | npm package | Installed |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented (AC1-AC5 required, AC6 optional)
- [x] Unit tests written and passing (31 new tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors in new code
- [x] Ready for code review

## Test Results

- **Frontend tests:** 1000 passed (including 31 new tests for US0091)
- **New test files:** MachineTypeBadge.test.tsx (8 tests), MachineTypeIcon.test.tsx (7 tests)
- **Updated test file:** ServerCard.test.tsx (+16 tests)

## Notes

The implementation builds on US0090's workstation detection logic already in ServerCard. The new components (MachineTypeBadge, MachineTypeIcon) are kept separate for reusability and testability.

AC6 (Dashboard grouping) is marked as optional in the story. If time is limited, it can be deferred to a separate story without affecting the core visual distinction functionality.
