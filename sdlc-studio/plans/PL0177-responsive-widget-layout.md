# PL0177: Responsive Widget Layout - Implementation Plan

> **Status:** Complete
> **Story:** [US0177: Responsive Widget Layout](../stories/US0177-responsive-widget-layout.md)
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Created:** 2026-01-29
> **Language:** TypeScript

## Overview

Implement responsive behaviour for the widget grid so that widgets reflow appropriately on smaller screens. The grid system from US0164 already supports responsive breakpoints; this story focuses on disabling edit mode on mobile devices and ensuring touch-friendly scrolling.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Desktop layout | Grid uses 12 columns at viewport > 1200px |
| AC2 | Tablet layout | Grid uses 6 columns at viewport 768-1200px |
| AC3 | Mobile layout | Grid uses 1 column at viewport < 768px |
| AC4 | Minimum widget sizes | Widgets maintain minimum sizes when viewport resized |
| AC5 | Touch-friendly on mobile | Scrolling used instead of drag; no edit mode on mobile |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 18
- **Test Framework:** Vitest

### Relevant Best Practices
- Use `unknown` instead of `any` for untyped values
- Explicit return types for exported functions
- Utility types for type derivation
- Discriminated unions for state management

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| react-grid-layout | /react-grid-layout/react-grid-layout | v2 API with useResponsiveLayout hook, breakpoints config |
| react | /facebook/react | useEffect for resize listeners, useState for mobile detection |

### Existing Patterns

**Responsive breakpoints (already implemented in US0164):**
```typescript
// frontend/src/components/widgets/types.ts
export const DEFAULT_GRID_CONFIG: GridConfig = {
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480 },
  cols: { lg: 12, md: 6, sm: 6, xs: 1 },
  rowHeight: 100,
  margin: [16, 16],
  containerPadding: [0, 0],
};
```

**Edit mode controls (already implemented):**
```typescript
// frontend/src/components/widgets/WidgetGrid.tsx
isDraggable={isDraggable && isEditMode}
isResizable={isResizable && isEditMode}
```

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story with CSS-based responsive behaviour. Integration tests verify actual rendering and breakpoint behaviour more effectively than TDD.

### Test Priority
1. Verify column counts at each breakpoint (12/6/1)
2. Verify edit mode disabled on mobile
3. Verify touch scrolling works on mobile
4. Verify window resize handling

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create useIsMobile hook | `frontend/src/hooks/useIsMobile.ts` | - | [x] |
| 2 | Add tests for useIsMobile | `frontend/src/hooks/useIsMobile.test.ts` | 1 | [x] |
| 3 | Hide edit button on mobile | `frontend/src/pages/ServerDetail.tsx` | 1 | [x] |
| 4 | Auto-exit edit mode on resize to mobile | `frontend/src/pages/ServerDetail.tsx` | 1 | [x] |
| 5 | Disable drag/resize on mobile | `frontend/src/pages/ServerDetail.tsx` | 1 | [x] |
| 6 | Add touch-action CSS for mobile | `frontend/src/index.css` | - | [x] |
| 7 | Add responsive layout tests | `frontend/src/hooks/useIsMobile.test.ts` | 1-6 | [x] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 6 | None (can run in parallel) |
| B | 2, 3, 4, 5 | Task 1 complete |
| C | 7 | Tasks 1-6 complete |

---

## Implementation Phases

### Phase 1: Mobile Detection Hook
**Goal:** Create reusable hook for detecting mobile viewport

- [ ] Create `useIsMobile` hook with 768px threshold
- [ ] Add window resize event listener with cleanup
- [ ] Debounce resize events for performance
- [ ] Export MOBILE_BREAKPOINT constant

**Files:**
- `frontend/src/hooks/useIsMobile.ts` - New file with hook implementation
- `frontend/src/hooks/useIsMobile.test.ts` - Unit tests for hook

### Phase 2: Disable Edit Mode on Mobile
**Goal:** Prevent edit mode access and exit edit mode when viewport shrinks

- [ ] Import useIsMobile hook in ServerDetail.tsx
- [ ] Conditionally hide "Edit Layout" button when isMobile
- [ ] Add useEffect in ServerDetailWidgetView to exit edit mode when isMobile becomes true
- [ ] Update WidgetGrid to pass isMobile for conditional drag/resize

**Files:**
- `frontend/src/pages/ServerDetail.tsx` - Hide edit button on mobile
- `frontend/src/components/widgets/ServerDetailWidgetView.tsx` - Auto-exit edit mode
- `frontend/src/components/widgets/WidgetGrid.tsx` - Accept isMobile prop

### Phase 3: Touch-Friendly CSS
**Goal:** Ensure smooth scrolling on mobile without conflicting with drag

- [ ] Add touch-action CSS rules for mobile viewports
- [ ] Verify no scroll conflicts with grid interactions

**Files:**
- `frontend/src/index.css` - Add mobile touch-action styles

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Config check: cols.lg = 12 at 1200px | `types.ts:144` | Verified |
| AC2 | Config check: cols.md = 6, cols.sm = 6 | `types.ts:144-145` | Verified |
| AC3 | Config check: cols.xs = 1 below 768px | `types.ts:144-145` | Verified |
| AC4 | Layout check: minW/minH on all widgets | `WidgetGrid.tsx:119-140` | Verified |
| AC5 | Hook + UI: useIsMobile, edit button hidden | `useIsMobile.ts`, `ServerDetail.tsx:95-99,458` | Verified |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Orientation change | React-grid-layout reflows automatically via useResponsiveLayout | Phase 1 |
| 2 | Very narrow screen (<480px) | xs breakpoint already configured for 1 column | Phase 1 |
| 3 | Landscape mobile (>= 768px) | Uses sm/md breakpoint (6 cols) based on width | Phase 1 |
| 4 | Window resize to mobile while editing | useEffect monitors isMobile, calls setIsEditMode(false) | Phase 2 |
| 5 | Touch scroll vs drag conflict | Drag disabled on mobile via isMobile check + touch-action CSS | Phase 2, 3 |

**Coverage:** 5/5 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Resize listener performance | Janky UI during rapid resize | Debounce resize handler (100ms) |
| react-grid-layout touch handling | Conflicts with native scroll | Disable drag/resize on mobile entirely |
| SSR window.innerWidth | Error during server render | Check typeof window before accessing |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Manual testing on mobile viewport

---

## Notes

The responsive breakpoints and column configuration are already implemented as part of US0164. This story primarily adds:
1. Mobile detection hook for conditional UI
2. Edit mode restrictions on mobile
3. Touch-friendly CSS adjustments

No changes needed to the breakpoint configuration itself - AC1-AC4 are already satisfied by the existing grid setup. AC5 requires new implementation.
