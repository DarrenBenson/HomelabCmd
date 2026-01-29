# PL0133: Responsive Dashboard Layout - Implementation Plan

> **Status:** Draft
> **Story:** [US0133: Responsive Dashboard Layout](../stories/US0133-responsive-dashboard-layout.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (React)

## Overview

Enhance the dashboard to work seamlessly across different screen sizes (desktop, tablet, mobile) while maintaining card order consistency and providing touch-friendly drag interactions. The responsive grid is already implemented via Tailwind classes; this story focuses on sticky headers, touch target sizing, and summary bar responsiveness.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Desktop layout | 4-column grid at 1280px+ |
| AC2 | Large tablet layout | 3-column grid at 1024-1279px |
| AC3 | Small tablet layout | 2-column grid at 768-1023px |
| AC4 | Mobile layout | Single column at <768px with touch drag |
| AC5 | Card order consistency | Same visual order regardless of column count |
| AC6 | Touch-friendly drag | Long-press (300ms) activates drag, 44x44px touch target |
| AC7 | Sticky section headers | Headers stick during scroll |
| AC8 | Summary bar responsiveness | Summary bar wraps on mobile |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 18 with Tailwind CSS
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices
- Use Tailwind responsive utilities (sm:, md:, lg:, xl:) for breakpoints
- Avoid JS resize handlers for layout - rely on CSS media queries
- Ensure touch targets are minimum 44x44px per WCAG guidelines
- Use `position: sticky` for section headers

### Existing Patterns
- MachineSection already has responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- TouchSensor already configured with 300ms delay and 5px tolerance
- SortableServerCard wraps ServerCard for drag-and-drop

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI/layout changes are best verified visually first, then captured in tests. The implementation is primarily CSS-based with minimal logic changes.

### Test Priority
1. Responsive breakpoint tests (verify grid column count at different widths)
2. Sticky header visibility tests
3. Touch target size verification

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add sticky styling to section header button | `MachineSection.tsx` | - | [ ] |
| 2 | Add z-index and background to sticky header | `MachineSection.tsx` | 1 | [ ] |
| 3 | Verify touch target size (44x44px minimum) on drag handle | `SortableServerCard.tsx` | - | [ ] |
| 4 | Add responsive wrapper classes to Dashboard | `Dashboard.tsx` | - | [ ] |
| 5 | Create responsive summary bar component stub | `SummaryBar.tsx` | - | [ ] |
| 6 | Write unit tests for MachineSection sticky header | `MachineSection.test.tsx` | 1, 2 | [ ] |
| 7 | Write Playwright E2E tests for responsive breakpoints | `responsive.spec.ts` | 4 | [ ] |
| 8 | Test touch drag on mobile viewport | `responsive.spec.ts` | 3, 7 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2 | None |
| B | 3 | None |
| C | 4, 5 | None |
| D | 6, 7, 8 | Groups A, B, C |

---

## Implementation Phases

### Phase 1: Sticky Section Headers (AC7)
**Goal:** Make section headers stick to top during scroll

- [ ] Add `sticky top-0 z-10 bg-bg-primary` to section header button
- [ ] Add padding-y to create visual separation
- [ ] Ensure z-index doesn't conflict with drag overlay

**Files:** `frontend/src/components/MachineSection.tsx` - Add sticky positioning classes

```tsx
// Before
<button className="flex items-center gap-2 w-full text-left py-2 group" ...>

// After
<button className="flex items-center gap-2 w-full text-left py-2 group sticky top-0 z-10 bg-bg-primary" ...>
```

### Phase 2: Touch Target Verification (AC6)
**Goal:** Ensure drag handles meet 44x44px touch target requirement

- [ ] Verify ServerCard has adequate touch target for drag handle area
- [ ] Add padding/sizing if needed to meet 44x44px minimum

**Files:** `frontend/src/components/SortableServerCard.tsx` or `ServerCard.tsx`

### Phase 3: Summary Bar Responsiveness (AC8)
**Goal:** Prepare for summary bar component (US0134 integration)

- [ ] Create responsive wrapper that stacks on mobile
- [ ] Use `flex-wrap` or `flex-col sm:flex-row` pattern

**Note:** Full summary bar is US0134; this task prepares responsive container.

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Viewport test at 1920px | E2E test | Pending |
| AC2 | Viewport test at 1024px | E2E test | Pending |
| AC3 | Viewport test at 768px | E2E test | Pending |
| AC4 | Viewport test at 375px | E2E test | Pending |
| AC5 | Card order assertion | Unit test | Pending |
| AC6 | Touch drag E2E test | E2E test | Pending |
| AC7 | Scroll + sticky assertion | Unit test | Pending |
| AC8 | Visual inspection (US0134) | - | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Viewport resized during drag | @dnd-kit auto-cancels drag on resize | N/A (library handles) |
| 2 | Orientation change | CSS reflow via Tailwind responsive | 1 |
| 3 | Very narrow viewport (<320px) | Single column, allow horizontal scroll if needed | 1 |
| 4 | Very wide viewport (>2560px) | Cap at 4 columns via xl:grid-cols-4 | N/A (already implemented) |
| 5 | Touch and mouse available | Both sensors active via useSensors | N/A (already implemented) |
| 6 | Scrolling during drag on mobile | @dnd-kit handles auto-scroll | N/A (library handles) |
| 7 | Two-finger pinch zoom | Not drag - normal browser zoom | N/A |
| 8 | Section with many cards | Scroll within page, sticky header | 1 |

**Coverage:** 8/8 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sticky header z-index conflicts with drag overlay | Medium | Use z-10 for header, z-50 for DragOverlay (already default) |
| Touch target too small on some devices | Low | Add explicit min-h-11 min-w-11 classes |
| Summary bar not designed yet (US0134) | Low | Create minimal responsive container only |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] E2E tests for responsive breakpoints
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)

---

## Notes

- AC1-AC5 are largely already implemented via existing Tailwind grid classes
- AC6 touch sensor already configured with 300ms delay
- Primary work is AC7 (sticky headers) and E2E test coverage
- AC8 depends on US0134 for full implementation; this story prepares responsive layout
