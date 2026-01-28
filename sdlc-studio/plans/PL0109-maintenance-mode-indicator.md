# PL0109: Enhanced Maintenance Mode Indicator - Implementation Plan

> **Status:** Complete
> **Story:** [US0109: Enhanced Maintenance Mode Indicator](../stories/US0109-maintenance-mode-indicator.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** TypeScript

## Overview

Enhance the ServerCard component to provide clearer visual distinction for servers in maintenance mode (paused). Currently, paused servers have only a subtle badge that can be missed at a glance. This implementation adds an amber/orange border glow, wrench icon with tooltip, and updates the StatusLED to show a neutral colour when paused.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Border glow | Amber/orange ring border when `is_paused: true` |
| AC2 | Wrench icon | Lucide Wrench icon next to server name when paused |
| AC3 | Tooltip | Hover tooltip on icon: "Maintenance mode - monitoring paused" |
| AC4 | Status LED | Neutral grey/amber LED colour when paused, tooltip shows "Paused" |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 18
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices
- Use discriminated unions for state (paused/online/offline)
- Avoid `any` - use explicit types
- Handle null/undefined explicitly with `?.` and `??`
- Use `cn()` utility for conditional class composition (already used in codebase)

### Existing Patterns

1. **Conditional styling pattern** (from ServerCard.tsx:77):
   ```tsx
   className={`base-classes ${conditionalClass} ${anotherCondition ? 'class' : ''}`}
   ```

2. **StatusLED prop pattern** (from StatusLED.tsx):
   - Uses `isWorkstation` boolean prop for conditional styling
   - Uses `title` prop for tooltip text

3. **Badge pattern** (from ServerCard.tsx:117-126):
   - Existing maintenance badge at lines 117-126 uses `server.is_paused`
   - Pattern: conditional render with data-testid and title

4. **Icon import pattern**:
   - MachineTypeIcon uses lucide-react icons
   - Pattern: `import { IconName } from 'lucide-react'`

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story focused on visual styling and conditional rendering. Tests are better written after seeing the implementation to verify visual states. The 5 edge cases are straightforward conditionals rather than complex logic.

### Test Priority
1. Paused server shows amber border glow classes
2. Paused server shows Wrench icon
3. StatusLED shows paused state (grey/amber) when is_paused

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add isPaused prop to StatusLED | `frontend/src/components/StatusLED.tsx` | - | [ ] |
| 2 | Add paused state styling to StatusLED | `frontend/src/components/StatusLED.tsx` | 1 | [ ] |
| 3 | Import Wrench icon in ServerCard | `frontend/src/components/ServerCard.tsx` | - | [ ] |
| 4 | Add amber border glow when paused | `frontend/src/components/ServerCard.tsx` | - | [ ] |
| 5 | Add Wrench icon with tooltip when paused | `frontend/src/components/ServerCard.tsx` | 3 | [ ] |
| 6 | Pass isPaused prop to StatusLED | `frontend/src/components/ServerCard.tsx` | 1 | [ ] |
| 7 | Write unit tests for StatusLED paused state | `frontend/src/components/StatusLED.test.tsx` | 1,2 | [ ] |
| 8 | Write unit tests for ServerCard paused styling | `frontend/src/components/ServerCard.test.tsx` | 4,5,6 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 3, 4 | None - can start in parallel |
| B | 2, 5, 6 | Group A complete |
| C | 7, 8 | Group B complete |

---

## Implementation Phases

### Phase 1: StatusLED Enhancement
**Goal:** Add paused state support to StatusLED component

- [ ] Add `isPaused?: boolean` prop to StatusLEDProps interface
- [ ] Add conditional styling for paused state: `bg-amber-500/50` or `bg-text-muted`
- [ ] Update aria-label to include "paused" state
- [ ] Update title to show "Paused" when isPaused is true

**Files:** `frontend/src/components/StatusLED.tsx`

**Code changes:**
```tsx
interface StatusLEDProps {
  status: ServerStatus;
  className?: string;
  isWorkstation?: boolean;
  isPaused?: boolean;  // NEW
  title?: string;
}

// In className:
{
  'bg-amber-500/50': isPaused,  // NEW - takes precedence
  'bg-status-success animate-pulse-green': status === 'online' && !isPaused,
  // ... existing
}
```

### Phase 2: ServerCard Enhancement
**Goal:** Add visual maintenance mode indicators

- [ ] Import Wrench icon from lucide-react
- [ ] Add amber border glow classes when `server.is_paused`
- [ ] Add Wrench icon next to server name when paused
- [ ] Wrap icon in element with title attribute for tooltip
- [ ] Pass `isPaused={server.is_paused}` to StatusLED

**Files:** `frontend/src/components/ServerCard.tsx`

**Code changes:**
```tsx
import { Wrench } from 'lucide-react';

// Border glow (add to card className):
server.is_paused && !server.is_inactive && 'ring-2 ring-amber-500/50 border-amber-500'

// Wrench icon (after StatusLED):
{server.is_paused && !server.is_inactive && (
  <Wrench
    className="w-4 h-4 text-amber-500 flex-shrink-0"
    aria-hidden="true"
    title="Maintenance mode - monitoring paused"
  />
)}

// StatusLED update:
<StatusLED
  status={server.status}
  isWorkstation={isWorkstation}
  isPaused={server.is_paused && !server.is_inactive}
  title={server.is_paused ? 'Paused' : statusTitle}
/>
```

### Phase 3: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Test: paused server has ring-amber-500 class | `ServerCard.test.tsx` | Pending |
| AC2 | Test: paused server renders Wrench icon | `ServerCard.test.tsx` | Pending |
| AC3 | Test: Wrench icon has correct title attribute | `ServerCard.test.tsx` | Pending |
| AC4 | Test: StatusLED has amber/grey class when isPaused | `StatusLED.test.tsx` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Server paused AND offline | Check `is_paused` first - maintenance styling takes precedence over offline | Phase 2 |
| 2 | Server paused AND has alerts | Both indicators render - alert badge uses `ml-auto`, maintenance indicator positioned before | Phase 2 |
| 3 | Pause state changes while viewing | React re-renders on state change - no special handling needed | Phase 2 |
| 4 | Multiple paused servers | Each ServerCard instance renders independently - no special handling needed | Phase 2 |
| 5 | Icon library fails to load | Use text fallback "[M]" with same styling if Wrench undefined | Phase 2 |

**Coverage:** 5/5 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tooltip delay not meeting 200ms spec | Low | Browser native title attribute has ~400ms delay; accept browser default or use custom tooltip component |
| Amber colour insufficient contrast in light mode | Medium | Test both themes; amber-500 has good contrast on white backgrounds |
| Existing tests may fail | Low | Run existing tests first; update snapshots if needed |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Works in both light and dark themes

---

## Notes

- The existing "Maintenance" badge (lines 117-126 in ServerCard.tsx) should remain - it provides text context while the new indicators provide quick visual recognition
- The amber colour (amber-500) matches the existing warning status colour used throughout the app
- Using native `title` attribute for tooltip - if 200ms requirement is strict, may need a custom tooltip component in future iteration
