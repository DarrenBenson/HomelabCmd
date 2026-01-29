# US0133: Responsive Dashboard Layout

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 5
> **Plan:** [PL0133](../plans/PL0133-responsive-dashboard-layout.md)
> **Test Spec:** [TS0133](../test-specs/TS0133-responsive-dashboard-layout.md)
> **Workflow:** [WF0019](../workflows/WF0019-responsive-dashboard-layout.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** the dashboard to work on different screen sizes
**So that** I can monitor my homelab from any device

## Context

### Persona Reference

**Darren** - Technical professional who primarily uses a desktop browser (1920x1080+) but occasionally checks status on tablet or phone.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current dashboard grid is optimised for desktop viewing. With drag-and-drop capabilities being added, the layout must adapt gracefully to smaller screens while maintaining usability. Card order should remain consistent regardless of how many columns are displayed.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Touch-friendly on mobile | Larger touch targets, long-press for drag |
| PRD | Performance | Dashboard load <3s | CSS-only breakpoints, no JS resize handlers |
| TRD | Architecture | Tailwind CSS | Use Tailwind responsive utilities |

---

## Acceptance Criteria

### AC1: Desktop layout (>1280px)

- **Given** the viewport width is 1280px or greater
- **When** the dashboard renders
- **Then** machine cards display in a 4-column grid
- **And** cards maintain consistent sizing
- **And** drag-and-drop works with pointer/mouse

### AC2: Large tablet layout (1024-1279px)

- **Given** the viewport width is between 1024px and 1279px
- **When** the dashboard renders
- **Then** machine cards display in a 3-column grid
- **And** card order is preserved from the 4-column layout

### AC3: Small tablet layout (768-1023px)

- **Given** the viewport width is between 768px and 1023px
- **When** the dashboard renders
- **Then** machine cards display in a 2-column grid
- **And** card order is preserved (row-first reading order)

### AC4: Mobile layout (<768px)

- **Given** the viewport width is less than 768px
- **When** the dashboard renders
- **Then** machine cards display in a single column
- **And** cards stack vertically in saved order
- **And** touch drag (long-press) activates correctly

### AC5: Card order consistency

- **Given** a saved card order [A, B, C, D, E, F, G, H]
- **When** displayed in any column count
- **Then** the visual reading order (left-to-right, top-to-bottom) is A, B, C, D, E, F, G, H
- **And** resizing the viewport reflows cards without reordering

### AC6: Touch-friendly drag on mobile

- **Given** the user is on a touch device (<768px)
- **When** the user long-presses (300ms) on a card
- **Then** the card becomes draggable
- **And** the drag handle is larger (minimum 44x44px touch target)
- **And** the card can be dragged with one finger

### AC7: Sticky section headers

- **Given** the user is scrolling the dashboard
- **When** a section header reaches the top of the viewport
- **Then** the header sticks to the top while scrolling through that section
- **And** the next section header pushes the previous one off-screen
- **And** sticky behaviour works on all viewport sizes

### AC8: Summary bar responsiveness

- **Given** the summary bar at the top of the dashboard (US0134)
- **When** viewed on mobile (<768px)
- **Then** the summary bar wraps or stacks items vertically
- **And** all information remains visible (no truncation)

---

## Scope

### In Scope

- CSS Grid responsive breakpoints (1, 2, 3, 4 columns)
- Touch-friendly drag activation on mobile
- Sticky section headers during scroll
- Consistent card order across breakpoints
- Summary bar responsiveness (collaboration with US0134)

### Out of Scope

- Native mobile app
- PWA/installable app features
- Offline mode
- Different layouts per device (order is always the same)

---

## Technical Notes

### CSS Grid Implementation

```css
/* frontend/src/pages/Dashboard.module.css or Tailwind classes */
.machine-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(1, 1fr);
}

@media (min-width: 640px) {
  .machine-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .machine-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1280px) {
  .machine-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

**Tailwind equivalent:**
```tsx
<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {/* cards */}
</div>
```

### Sticky Headers

```css
.section-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--background);
  padding: 0.5rem 0;
}
```

### Touch Activation

@dnd-kit supports touch sensors out of the box. Configure activation delay:

```tsx
import { TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

const touchSensor = useSensor(TouchSensor, {
  activationConstraint: {
    delay: 300, // 300ms long-press
    tolerance: 5, // 5px movement tolerance during delay
  },
});

const sensors = useSensors(
  useSensor(PointerSensor),
  touchSensor
);
```

### Files to Modify

- `frontend/src/pages/Dashboard.tsx` - Apply responsive grid classes
- `frontend/src/components/MachineSection.tsx` - Sticky header styling
- `frontend/src/components/SortableCard.tsx` - Ensure touch target size

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Viewport resized during drag | Drag cancelled, grid reflows |
| 2 | Orientation change (portrait ↔ landscape) | Grid reflows smoothly |
| 3 | Very narrow viewport (<320px) | Single column with horizontal scroll if needed |
| 4 | Very wide viewport (>2560px) | Cap at 4 columns, cards grow wider |
| 5 | Touch and mouse available (hybrid) | Both input methods work |
| 6 | Scrolling during drag on mobile | Viewport scrolls while dragging near edges |
| 7 | Two-finger pinch zoom | Zoom works, drag not triggered |
| 8 | Section with many cards | Scroll within section, sticky header visible |

---

## Test Scenarios

- [ ] 4 columns display at 1920px width
- [ ] 4 columns display at 1280px width
- [ ] 3 columns display at 1024px width
- [ ] 2 columns display at 768px width
- [ ] 1 column displays at 375px width (iPhone)
- [ ] Card order preserved across all breakpoints
- [ ] Resize window smoothly reflows cards
- [ ] Touch long-press activates drag on mobile
- [ ] Drag handle is 44x44px minimum on touch devices
- [ ] Section headers stick on scroll
- [ ] Sticky headers work on mobile
- [ ] Summary bar wraps on mobile
- [ ] Landscape orientation on tablet works

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0130](US0130-drag-drop-card-reordering.md) | Requires | Drag-and-drop base | Done |
| [US0132](US0132-server-workstation-grouping.md) | Requires | Section headers to make sticky | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Tailwind CSS responsive utilities | Framework | Available |
| @dnd-kit TouchSensor | Library | Included in @dnd-kit/core |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - CSS work, touch interaction tuning

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0133, TS0133 created) |
| 2026-01-28 | Claude | Status: Planned -> In Progress (WF0019 created) |
| 2026-01-28 | Claude | Status: In Progress -> Done (all ACs verified, AC8 deferred to US0134) |
