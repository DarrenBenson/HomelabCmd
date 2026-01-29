# TS0130: Drag-and-Drop Card Reordering

> **Status:** Complete
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for drag-and-drop card reordering on the Dashboard. Covers SortableServerCard component behaviour, drag handle visibility, keyboard accessibility, touch support, and reorder state management.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0130](../stories/US0130-drag-drop-card-reordering.md) | Drag-and-Drop Card Reordering | P0 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0130 | AC1 | Drag handle visibility | TC01, TC02 | Pending |
| US0130 | AC2 | Drag initiation | TC03, TC04 | Pending |
| US0130 | AC3 | Drop zone indication | TC05 | Pending |
| US0130 | AC4 | Successful drop | TC06, TC07 | Pending |
| US0130 | AC5 | Keyboard accessibility | TC08, TC09, TC10 | Pending |
| US0130 | AC6 | Touch support | TC11 | Pending |
| US0130 | AC7 | Cancelled drag | TC12, TC13 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Component rendering, hook behaviour |
| Integration | Yes | DndContext + SortableContext coordination |
| E2E | Optional | Full drag-and-drop flow (complex to automate) |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, npm install completed |
| External Services | None |
| Test Data | Mock Server objects array |
| Library Mocks | @dnd-kit sensors may need mocking for unit tests |

---

## Test Cases

### TC01: Drag handle hidden by default

**Type:** Unit | **Priority:** High | **Story:** US0130 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A SortableServerCard component | Component created |
| When | Component renders without hover | DOM mounted |
| Then | Drag handle has `opacity-0` class | Handle visually hidden |

**Assertions:**
- [ ] Drag handle button exists in DOM
- [ ] Drag handle has class `opacity-0`
- [ ] GripVertical icon is rendered

---

### TC02: Drag handle visible on hover

**Type:** Unit | **Priority:** High | **Story:** US0130 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A SortableServerCard component | Component created |
| When | User hovers over the card container | mouseEnter event fired |
| Then | Drag handle becomes visible | Handle has `group-hover:opacity-100` effect |

**Assertions:**
- [ ] Drag handle parent has class `group`
- [ ] Drag handle has class `group-hover:opacity-100`
- [ ] Handle has `cursor-grab` class

**Note:** Testing hover states with Testing Library requires fireEvent.mouseEnter or userEvent.hover.

---

### TC03: SortableServerCard has useSortable attributes

**Type:** Unit | **Priority:** High | **Story:** US0130 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A SortableServerCard wrapped in SortableContext | Context provided |
| When | Component renders | useSortable hook called |
| Then | Container has data-dnd attributes | @dnd-kit attributes present |

**Assertions:**
- [ ] Container ref is set (setNodeRef called)
- [ ] Container has style with transform property
- [ ] Drag handle has spread listeners

---

### TC04: Card follows cursor during drag

**Type:** Integration | **Priority:** High | **Story:** US0130 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with multiple server cards | DndContext active |
| When | User starts dragging a card | onDragStart fires |
| Then | DragOverlay shows card preview | Overlay visible with card content |

**Assertions:**
- [ ] activeDragId state is set
- [ ] DragOverlay renders the active card
- [ ] Original card has reduced opacity (0.5)

---

### TC05: Drop zone highlights adjacent cards

**Type:** Integration | **Priority:** Medium | **Story:** US0130 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A card being dragged | Drag in progress |
| When | Card hovers over another card position | Collision detected |
| Then | Other cards animate to make space | Transform applied to adjacent cards |

**Assertions:**
- [ ] Non-dragged cards have transition property
- [ ] @dnd-kit applies transform to make visual gap

**Note:** This is handled by @dnd-kit internally; test verifies the strategy is applied.

---

### TC06: Card drops in new position

**Type:** Integration | **Priority:** High | **Story:** US0130 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A card dragged to new position | Drag in progress |
| When | User releases the card | onDragEnd fires |
| Then | Server array is reordered | arrayMove applied |

**Assertions:**
- [ ] servers state is updated
- [ ] Card order reflects new position
- [ ] activeDragId is cleared

---

### TC07: Animation completes in ~200ms

**Type:** Unit | **Priority:** Medium | **Story:** US0130 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | @dnd-kit transition configuration | useSortable hook |
| When | transition property is applied | Style computed |
| Then | Transition duration is approximately 200ms | Value in acceptable range |

**Assertions:**
- [ ] transition value includes duration
- [ ] Duration is ≤250ms (allowing @dnd-kit default variance)

---

### TC08: Space key enters drag mode

**Type:** Integration | **Priority:** High | **Story:** US0130 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Focus on drag handle | Handle has focus |
| When | User presses Space | Key event fires |
| Then | Card enters drag mode | ARIA live region announces |

**Assertions:**
- [ ] KeyboardSensor is configured
- [ ] sortableKeyboardCoordinates is set
- [ ] Focus remains on handle during drag

---

### TC09: Arrow keys move card position

**Type:** Integration | **Priority:** High | **Story:** US0130 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card in drag mode | Keyboard drag active |
| When | User presses ArrowDown | Key event fires |
| Then | Card moves down in list | Position changes |

**Assertions:**
- [ ] Card moves to next position in sort order
- [ ] Visual feedback shows new position
- [ ] ARIA announces position change

---

### TC10: Space key confirms drop

**Type:** Integration | **Priority:** High | **Story:** US0130 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card being moved via keyboard | Arrow keys used |
| When | User presses Space again | Key event fires |
| Then | Card drops in new position | Order updated |

**Assertions:**
- [ ] onDragEnd called
- [ ] New order persisted to state
- [ ] Focus returns to handle

---

### TC11: Touch long-press activates drag

**Type:** Integration | **Priority:** High | **Story:** US0130 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard on touch device | TouchSensor active |
| When | User long-presses (300ms) on card | Touch hold |
| Then | Card becomes draggable | Drag mode active |

**Assertions:**
- [ ] TouchSensor configured with delay: 300
- [ ] Drag initiates after 300ms hold
- [ ] Short taps do not initiate drag

**Note:** Testing touch requires mocking TouchSensor or using Playwright mobile emulation.

---

### TC12: Escape cancels drag

**Type:** Integration | **Priority:** High | **Story:** US0130 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card being dragged | Drag in progress |
| When | User presses Escape | Key event fires |
| Then | Card returns to original position | No order change |

**Assertions:**
- [ ] onDragCancel called
- [ ] servers state unchanged
- [ ] activeDragId cleared
- [ ] Card at original index

---

### TC13: Release outside valid zone cancels drag

**Type:** Integration | **Priority:** Medium | **Story:** US0130 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card dragged outside card grid | Cursor outside |
| When | User releases | Drop event fires |
| Then | Card returns to original position | No order change |

**Assertions:**
- [ ] closestCenter returns null/undefined for over
- [ ] Order unchanged when over !== active

---

### TC14: Single card shows drag handle (Edge Case)

**Type:** Unit | **Priority:** Low | **Story:** US0130

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with only 1 server | Single card |
| When | User hovers over card | Hover event |
| Then | Drag handle still appears | Consistent UX |

**Assertions:**
- [ ] Drag handle rendered even for single card
- [ ] Handle becomes visible on hover

**Note:** While reordering 1 card is meaningless, consistent UI is preferred.

---

### TC15: Existing card click navigation works

**Type:** Integration | **Priority:** High | **Story:** US0130

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SortableServerCard with onClick | Handler provided |
| When | User clicks on card (not drag handle) | Click event |
| Then | Navigation to server detail occurs | onClick called |

**Assertions:**
- [ ] onClick prop is called
- [ ] navigate('/servers/{id}') executed
- [ ] Drag not initiated on click

---

## Fixtures

```yaml
mockServers:
  - id: "server-1"
    hostname: "alpha"
    display_name: "Alpha Server"
    status: "online"
    is_paused: false
    is_inactive: false
    machine_type: "server"
    latest_metrics:
      cpu_percent: 25
      memory_percent: 50
      disk_percent: 30
      uptime_seconds: 86400

  - id: "server-2"
    hostname: "beta"
    display_name: "Beta Server"
    status: "online"
    is_paused: false
    is_inactive: false
    machine_type: "server"
    latest_metrics:
      cpu_percent: 40
      memory_percent: 60
      disk_percent: 45
      uptime_seconds: 172800

  - id: "server-3"
    hostname: "gamma"
    display_name: "Gamma Server"
    status: "offline"
    is_paused: false
    is_inactive: false
    machine_type: "server"
    latest_metrics: null

singleServer:
  - id: "solo-server"
    hostname: "solo"
    display_name: "Solo Server"
    status: "online"
    is_paused: false
    is_inactive: false
    machine_type: "server"
    latest_metrics:
      cpu_percent: 10
      memory_percent: 20
      disk_percent: 15
      uptime_seconds: 3600
```

---

## Mock Setup

### @dnd-kit Mocking

For unit tests, @dnd-kit hooks need context:

```typescript
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

const renderWithDnd = (ui: React.ReactElement, items: string[]) => {
  return render(
    <DndContext>
      <SortableContext items={items}>
        {ui}
      </SortableContext>
    </DndContext>
  );
};
```

### Touch Event Mocking

```typescript
const mockTouchStart = (element: HTMLElement, delay: number) => {
  fireEvent.touchStart(element, { touches: [{ clientX: 0, clientY: 0 }] });
  jest.advanceTimersByTime(delay);
};
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Drag handle hidden by default | Pending | - |
| TC02 | Drag handle visible on hover | Pending | - |
| TC03 | SortableServerCard has useSortable attributes | Pending | - |
| TC04 | Card follows cursor during drag | Pending | - |
| TC05 | Drop zone highlights adjacent cards | Pending | - |
| TC06 | Card drops in new position | Pending | - |
| TC07 | Animation completes in ~200ms | Pending | - |
| TC08 | Space key enters drag mode | Pending | - |
| TC09 | Arrow keys move card position | Pending | - |
| TC10 | Space key confirms drop | Pending | - |
| TC11 | Touch long-press activates drag | Pending | - |
| TC12 | Escape cancels drag | Pending | - |
| TC13 | Release outside valid zone cancels drag | Pending | - |
| TC14 | Single card shows drag handle | Pending | - |
| TC15 | Existing card click navigation works | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0130](../plans/PL0130-drag-drop-card-reordering.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec |
