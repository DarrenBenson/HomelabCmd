# TS0133: Responsive Dashboard Layout

> **Status:** Draft
> **Story:** [US0133: Responsive Dashboard Layout](../stories/US0133-responsive-dashboard-layout.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for responsive dashboard layout, covering breakpoint behaviour, sticky headers, touch-friendly drag interactions, and card order consistency across different viewport sizes.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0133](../stories/US0133-responsive-dashboard-layout.md) | Responsive Dashboard Layout | P1 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0133 | AC1 | Desktop layout (>1280px) | TC01, TC02 | Pending |
| US0133 | AC2 | Large tablet layout (1024-1279px) | TC03 | Pending |
| US0133 | AC3 | Small tablet layout (768-1023px) | TC04 | Pending |
| US0133 | AC4 | Mobile layout (<768px) | TC05, TC06 | Pending |
| US0133 | AC5 | Card order consistency | TC07, TC08 | Pending |
| US0133 | AC6 | Touch-friendly drag | TC09, TC10 | Pending |
| US0133 | AC7 | Sticky section headers | TC11, TC12, TC13 | Pending |
| US0133 | AC8 | Summary bar responsiveness | TC14 | Pending |

**Coverage:** 8/8 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Sticky header styling, touch target sizes |
| Integration | No | Layout is CSS-based |
| E2E | Yes | Responsive breakpoint verification, touch interaction |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Frontend dev server running, browsers installed |
| External Services | None |
| Test Data | Mock servers with different machine types |

---

## Test Cases

### TC01: Desktop 4-column grid at 1920px

**Type:** E2E | **Priority:** P0 | **Story:** US0133 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with 8 server cards | 8 cards rendered |
| When | Viewport set to 1920x1080 | Browser resized |
| Then | Cards display in 4-column grid | 2 rows of 4 cards |

**Assertions:**
- [ ] Grid container has `grid-cols-4` active (via xl: breakpoint)
- [ ] Each row contains exactly 4 cards
- [ ] Cards have consistent width

---

### TC02: Desktop 4-column grid at 1280px boundary

**Type:** E2E | **Priority:** P0 | **Story:** US0133 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with 8 server cards | 8 cards rendered |
| When | Viewport set to 1280x800 | Browser resized |
| Then | Cards display in 4-column grid | 2 rows of 4 cards |

**Assertions:**
- [ ] Grid uses 4 columns at exactly 1280px (xl breakpoint)
- [ ] Cards are evenly spaced

---

### TC03: Large tablet 3-column grid at 1024px

**Type:** E2E | **Priority:** P0 | **Story:** US0133 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with 9 server cards | 9 cards rendered |
| When | Viewport set to 1024x768 | Browser resized |
| Then | Cards display in 3-column grid | 3 rows of 3 cards |

**Assertions:**
- [ ] Grid container has `grid-cols-3` active (via lg: breakpoint)
- [ ] Card order preserved (A, B, C in first row)

---

### TC04: Small tablet 2-column grid at 768px

**Type:** E2E | **Priority:** P0 | **Story:** US0133 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with 6 server cards | 6 cards rendered |
| When | Viewport set to 768x1024 | Browser resized |
| Then | Cards display in 2-column grid | 3 rows of 2 cards |

**Assertions:**
- [ ] Grid container has `grid-cols-2` active (via sm: breakpoint)
- [ ] Row-first reading order maintained

---

### TC05: Mobile single column at 375px

**Type:** E2E | **Priority:** P0 | **Story:** US0133 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with 4 server cards | 4 cards rendered |
| When | Viewport set to 375x667 (iPhone) | Browser resized |
| Then | Cards display in single column | 4 rows of 1 card |

**Assertions:**
- [ ] Grid container has `grid-cols-1` (default)
- [ ] Cards stack vertically in saved order
- [ ] No horizontal overflow

---

### TC06: Mobile touch drag with long-press

**Type:** E2E | **Priority:** P1 | **Story:** US0133 AC4, AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard at 375px viewport with touch emulation | Mobile view |
| When | Long-press (300ms) on first card | Drag initiated |
| Then | Card becomes draggable | Visual feedback shown |

**Assertions:**
- [ ] TouchSensor activates after 300ms delay
- [ ] Card shows drag state (lifted appearance)
- [ ] Can drag card to new position with touch

---

### TC07: Card order consistency across breakpoints

**Type:** E2E | **Priority:** P0 | **Story:** US0133 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with saved order [A, B, C, D, E, F, G, H] | Order loaded |
| When | Viewport resized from 1920px to 768px | Grid reflows |
| Then | Reading order is still A, B, C, D, E, F, G, H | Order preserved |

**Assertions:**
- [ ] First card in DOM is still A
- [ ] Last card in DOM is still H
- [ ] No cards reordered during resize

---

### TC08: Card order unchanged after viewport resize

**Type:** E2E | **Priority:** P1 | **Story:** US0133 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard at 1280px, cards in order [1, 2, 3, 4] | 4-column view |
| When | Resize to 375px then back to 1280px | Viewport cycles |
| Then | Card order remains [1, 2, 3, 4] | No reordering |

**Assertions:**
- [ ] Cards maintain original order
- [ ] No save API called during resize

---

### TC09: Touch target minimum size 44x44px

**Type:** Unit | **Priority:** P1 | **Story:** US0133 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SortableServerCard rendered | Card visible |
| When | Measure drag handle area | Dimensions calculated |
| Then | Touch target is at least 44x44px | WCAG compliance |

**Assertions:**
- [ ] Drag handle element height >= 44px
- [ ] Drag handle element width >= 44px
- [ ] Interactive area includes padding

---

### TC10: Touch long-press does not trigger on short tap

**Type:** Unit | **Priority:** P1 | **Story:** US0133 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card rendered with TouchSensor configured | Card ready |
| When | Short tap (100ms) on card | Brief touch |
| Then | Drag is NOT initiated | No drag state |

**Assertions:**
- [ ] Drag state remains false
- [ ] onClick handler fires instead (if applicable)

---

### TC11: Section header sticks on scroll

**Type:** Unit | **Priority:** P0 | **Story:** US0133 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | MachineSection with 10 server cards | Section rendered |
| When | Scroll down 500px | Page scrolled |
| Then | Section header remains visible at top | Sticky behaviour |

**Assertions:**
- [ ] Header button has `sticky` class
- [ ] Header has `top-0` positioning
- [ ] Header has background colour (not transparent)

---

### TC12: Section header has correct z-index

**Type:** Unit | **Priority:** P1 | **Story:** US0133 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | MachineSection rendered | Section visible |
| When | Inspect header styles | Styles computed |
| Then | Header z-index is appropriate | z-10 class present |

**Assertions:**
- [ ] Header has `z-10` class
- [ ] Header appears above scrolling content
- [ ] Header below DragOverlay (z-50)

---

### TC13: Next section header pushes previous off-screen

**Type:** E2E | **Priority:** P1 | **Story:** US0133 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with Servers and Workstations sections | Both visible |
| When | Scroll until Workstations header reaches top | Scroll continues |
| Then | Servers header scrolls away, Workstations sticks | Header replacement |

**Assertions:**
- [ ] Only one section header sticky at a time
- [ ] Natural stacking context behaviour

---

### TC14: Summary bar wraps on mobile

**Type:** E2E | **Priority:** P2 | **Story:** US0133 AC8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with summary bar (US0134) | Summary visible |
| When | Viewport set to 375px | Mobile view |
| Then | Summary bar items stack or wrap | All info visible |

**Assertions:**
- [ ] No horizontal truncation of summary items
- [ ] Readable on mobile viewport
- [ ] (Note: Full test requires US0134 implementation)

---

## Fixtures

```yaml
# Mock servers for responsive layout tests
servers:
  - id: "server-1"
    hostname: "homeserver"
    display_name: "Home Server"
    status: "online"
    machine_type: "server"
  - id: "server-2"
    hostname: "mediaserver"
    display_name: "Media Server"
    status: "online"
    machine_type: "server"
  - id: "server-3"
    hostname: "backupserver"
    display_name: "Backup Server"
    status: "offline"
    machine_type: "server"
  - id: "server-4"
    hostname: "cloudserver"
    display_name: "Cloud Server"
    status: "online"
    machine_type: "server"
  - id: "workstation-1"
    hostname: "studypc"
    display_name: "Study PC"
    status: "online"
    machine_type: "workstation"
  - id: "workstation-2"
    hostname: "laptop"
    display_name: "Laptop"
    status: "offline"
    machine_type: "workstation"

breakpoints:
  desktop: { width: 1920, height: 1080 }
  desktop_min: { width: 1280, height: 800 }
  tablet_large: { width: 1024, height: 768 }
  tablet_small: { width: 768, height: 1024 }
  mobile: { width: 375, height: 667 }
  mobile_narrow: { width: 320, height: 568 }
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Desktop 4-column grid at 1920px | Pending | - |
| TC02 | Desktop 4-column grid at 1280px boundary | Pending | - |
| TC03 | Large tablet 3-column grid at 1024px | Pending | - |
| TC04 | Small tablet 2-column grid at 768px | Pending | - |
| TC05 | Mobile single column at 375px | Pending | - |
| TC06 | Mobile touch drag with long-press | Pending | - |
| TC07 | Card order consistency across breakpoints | Pending | - |
| TC08 | Card order unchanged after viewport resize | Pending | - |
| TC09 | Touch target minimum size 44x44px | Pending | - |
| TC10 | Touch long-press does not trigger on short tap | Pending | - |
| TC11 | Section header sticks on scroll | Pending | - |
| TC12 | Section header has correct z-index | Pending | - |
| TC13 | Next section header pushes previous off-screen | Pending | - |
| TC14 | Summary bar wraps on mobile | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0133: Responsive Dashboard Layout](../plans/PL0133-responsive-dashboard-layout.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec from US0133 story plan |
