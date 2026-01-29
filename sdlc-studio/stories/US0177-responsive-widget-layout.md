# US0177: Responsive Widget Layout

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** widgets to reflow on smaller screens
**So that** the detail page works on mobile and tablet

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Checks status from phone occasionally.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Desktop layout
- **Given** viewport width > 1200px
- **When** I view the detail page
- **Then** the grid uses 12 columns

### AC2: Tablet layout
- **Given** viewport width 768-1200px
- **When** I view the detail page
- **Then** the grid uses 6 columns

### AC3: Mobile layout
- **Given** viewport width < 768px
- **When** I view the detail page
- **Then** the grid uses 1 column (stacked widgets)

### AC4: Minimum widget sizes
- **Given** the viewport is resized
- **When** widgets would be smaller than minimum
- **Then** widgets maintain their minimum size

### AC5: Touch-friendly on mobile
- **Given** I am on a mobile device
- **When** I view the detail page
- **Then** scrolling is used instead of drag (no edit mode on mobile)

---

## Scope

### In Scope
- Breakpoint configuration (1200px, 768px)
- Column count per breakpoint
- Minimum widget sizes enforced
- Touch scrolling on mobile
- Disable edit mode on mobile

### Out of Scope
- Per-breakpoint custom layouts (uses automatic reflow)

---

## Technical Notes

```tsx
const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480 };
const cols = { lg: 12, md: 6, sm: 6, xs: 1 };

<ResponsiveGridLayout
  breakpoints={breakpoints}
  cols={cols}
  // Edit mode disabled on mobile
  isDraggable={!isMobile && isEditMode}
  isResizable={!isMobile && isEditMode}
/>
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Orientation change | Layout reflows smoothly |
| 2 | Very narrow screen (<480px) | Single column, full width widgets |
| 3 | Landscape mobile | Use tablet breakpoint (6 columns if width >= 768px) |
| 4 | Window resize crosses mobile threshold while editing | Auto-exit edit mode, disable drag/resize |
| 5 | Touch scroll vs drag conflict on mobile | Touch scrolls page, no drag interaction |

---

## Test Scenarios

- [ ] 12 columns on desktop
- [ ] 6 columns on tablet
- [ ] 1 column on mobile
- [ ] Widgets maintain minimum sizes
- [ ] No drag/resize on mobile
- [ ] Orientation change works

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Draft |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Responsive configuration, mobile detection

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0150) |
