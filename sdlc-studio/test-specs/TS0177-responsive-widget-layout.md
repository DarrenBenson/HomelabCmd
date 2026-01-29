# TS0177: Responsive Widget Layout

> **Status:** Draft
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for US0177 Responsive Widget Layout. Validates that the widget grid responds correctly to different viewport sizes and that edit mode is disabled on mobile devices.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0177](../stories/US0177-responsive-widget-layout.md) | Responsive Widget Layout | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0177 | AC1 | Desktop layout (12 columns at >1200px) | TC001, TC002 | Pending |
| US0177 | AC2 | Tablet layout (6 columns at 768-1200px) | TC003, TC004 | Pending |
| US0177 | AC3 | Mobile layout (1 column at <768px) | TC005, TC006 | Pending |
| US0177 | AC4 | Minimum widget sizes enforced | TC007 | Pending |
| US0177 | AC5 | Touch-friendly on mobile (no edit mode) | TC008, TC009, TC010 | Pending |

**Coverage:** 5/5 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test useIsMobile hook logic |
| Integration | Yes | Test component behaviour at breakpoints |
| E2E | Optional | Visual verification of responsive layouts |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Frontend dev server running, Vitest configured |
| External Services | None |
| Test Data | Mock server data for widgets |

---

## Test Cases

### TC001: Desktop viewport shows 12 columns

**Type:** Integration | **Priority:** High | **Story:** US0177 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is 1300px | Breakpoint is "lg" |
| When | Widget grid renders | Grid container created |
| Then | Grid uses 12 columns | data-breakpoint="lg" and cols=12 |

**Assertions:**
- [ ] Grid has data-breakpoint="lg" attribute
- [ ] Column count is 12
- [ ] Widgets can span up to 12 columns

---

### TC002: Desktop boundary (exactly 1200px)

**Type:** Integration | **Priority:** Medium | **Story:** US0177 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is exactly 1200px | Breakpoint is "lg" |
| When | Widget grid renders | Grid uses lg breakpoint |
| Then | Grid uses 12 columns | Column count verified |

**Assertions:**
- [ ] At exactly 1200px, grid uses lg breakpoint (12 columns)

---

### TC003: Tablet viewport shows 6 columns (md)

**Type:** Integration | **Priority:** High | **Story:** US0177 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is 1000px | Breakpoint is "md" |
| When | Widget grid renders | Grid container created |
| Then | Grid uses 6 columns | data-breakpoint="md" and cols=6 |

**Assertions:**
- [ ] Grid has data-breakpoint="md" attribute
- [ ] Column count is 6

---

### TC004: Tablet viewport shows 6 columns (sm)

**Type:** Integration | **Priority:** Medium | **Story:** US0177 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is 800px | Breakpoint is "sm" |
| When | Widget grid renders | Grid container created |
| Then | Grid uses 6 columns | data-breakpoint="sm" and cols=6 |

**Assertions:**
- [ ] Grid has data-breakpoint="sm" attribute
- [ ] Column count is 6 (same as md)

---

### TC005: Mobile viewport shows 1 column

**Type:** Integration | **Priority:** High | **Story:** US0177 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is 600px | Breakpoint is "xs" |
| When | Widget grid renders | Grid container created |
| Then | Grid uses 1 column | data-breakpoint="xs" and cols=1 |

**Assertions:**
- [ ] Grid has data-breakpoint="xs" attribute
- [ ] Column count is 1
- [ ] Widgets stack vertically (full width)

---

### TC006: Very narrow viewport (<480px)

**Type:** Integration | **Priority:** Medium | **Story:** US0177 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is 400px | Breakpoint is "xs" |
| When | Widget grid renders | Grid uses xs breakpoint |
| Then | Grid uses 1 column | Single column layout |

**Assertions:**
- [ ] Grid still uses xs breakpoint at very narrow widths
- [ ] Widgets remain full width

---

### TC007: Minimum widget sizes enforced

**Type:** Integration | **Priority:** High | **Story:** US0177 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Widget has minW: 4, minH: 3 | Minimum constraints set |
| When | Viewport resizes to narrow width | Widget attempts to resize |
| Then | Widget maintains minimum dimensions | Cannot shrink below minW/minH |

**Assertions:**
- [ ] Widget width never less than minW * column width
- [ ] Widget height never less than minH * row height
- [ ] Horizontal scroll appears if needed (not widget shrink)

---

### TC008: Edit button hidden on mobile

**Type:** Integration | **Priority:** High | **Story:** US0177 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport width is 600px (mobile) | isMobile = true |
| When | ServerDetail page renders in widget view | Edit button check |
| Then | Edit Layout button is not visible | Button hidden or not rendered |

**Assertions:**
- [ ] "Edit Layout" button not in DOM or has display:none
- [ ] No way to enter edit mode on mobile

---

### TC009: Auto-exit edit mode on resize to mobile

**Type:** Integration | **Priority:** High | **Story:** US0177 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | User is in edit mode at desktop width | isEditMode = true |
| When | Viewport resizes to mobile (<768px) | Resize event fires |
| Then | Edit mode is automatically exited | isEditMode = false |

**Assertions:**
- [ ] isEditMode becomes false when viewport crosses 768px threshold
- [ ] Grid lines disappear
- [ ] Drag/resize handles disappear

---

### TC010: Touch scrolling works on mobile

**Type:** Integration | **Priority:** Medium | **Story:** US0177 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Viewport is mobile width | isMobile = true |
| When | User touches and drags on widget | Touch event |
| Then | Page scrolls instead of widget dragging | Native scroll behaviour |

**Assertions:**
- [ ] isDraggable is false on mobile
- [ ] isResizable is false on mobile
- [ ] touch-action CSS allows pan-y scrolling

---

### TC011: useIsMobile hook returns true below 768px

**Type:** Unit | **Priority:** High | **Story:** US0177 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Window width is 600px | Mock window.innerWidth |
| When | useIsMobile hook is called | Hook executes |
| Then | Returns true | isMobile = true |

**Assertions:**
- [ ] Returns true when window.innerWidth < 768
- [ ] Returns false when window.innerWidth >= 768

---

### TC012: useIsMobile hook updates on resize

**Type:** Unit | **Priority:** Medium | **Story:** US0177 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Window width starts at 1000px | isMobile initially false |
| When | Window resizes to 600px | Resize event fires |
| Then | Hook returns true | isMobile updates to true |

**Assertions:**
- [ ] Hook adds resize event listener
- [ ] State updates when window resizes
- [ ] Listener is cleaned up on unmount

---

## Fixtures

```yaml
mockMachine:
  id: "test-server-001"
  hostname: "test-server"
  status: "online"
  machine_type: "server"
  latest_metrics:
    cpu_percent: 45
    memory_percent: 60

mockLayout:
  - { i: "cpu_chart", x: 0, y: 0, w: 4, h: 3, minW: 4, minH: 3 }
  - { i: "memory_gauge", x: 4, y: 0, w: 4, h: 3, minW: 4, minH: 3 }
  - { i: "disk_usage", x: 8, y: 0, w: 4, h: 3, minW: 4, minH: 3 }

viewportSizes:
  desktop: 1300
  desktopBoundary: 1200
  tabletMd: 1000
  tabletSm: 800
  mobile: 600
  narrowMobile: 400
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Desktop viewport shows 12 columns | Pending | - |
| TC002 | Desktop boundary (exactly 1200px) | Pending | - |
| TC003 | Tablet viewport shows 6 columns (md) | Pending | - |
| TC004 | Tablet viewport shows 6 columns (sm) | Pending | - |
| TC005 | Mobile viewport shows 1 column | Pending | - |
| TC006 | Very narrow viewport (<480px) | Pending | - |
| TC007 | Minimum widget sizes enforced | Pending | - |
| TC008 | Edit button hidden on mobile | Pending | - |
| TC009 | Auto-exit edit mode on resize to mobile | Pending | - |
| TC010 | Touch scrolling works on mobile | Pending | - |
| TC011 | useIsMobile hook returns true below 768px | Pending | - |
| TC012 | useIsMobile hook updates on resize | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0012](../epics/EP0012-widget-based-detail-view.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0177](../plans/PL0177-responsive-widget-layout.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
