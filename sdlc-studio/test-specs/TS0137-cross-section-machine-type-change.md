# TS0137: Cross-Section Machine Type Change

> **Status:** Draft
> **Story:** [US0137: Cross-Section Machine Type Change via Drag-and-Drop](../stories/US0137-cross-section-machine-type-change.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for cross-section drag-and-drop machine type changes on the Dashboard. Covers drop zone detection, API integration, undo functionality, visual feedback, and error handling.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0137](../stories/US0137-cross-section-machine-type-change.md) | Cross-Section Machine Type Change | P1 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0137 | AC1 | Cross-section drag enabled | TC01, TC02 | Pending |
| US0137 | AC2 | Machine type updated on drop | TC03, TC04, TC05 | Pending |
| US0137 | AC3 | Confirmation toast | TC06, TC07 | Pending |
| US0137 | AC4 | Undo type change | TC08, TC09, TC10 | Pending |
| US0137 | AC5 | Visual feedback during drag | TC11, TC12, TC13 | Pending |
| US0137 | AC6 | API endpoint | TC14, TC15, TC16 | Pending |
| US0137 | AC7 | Keyboard accessibility | TC17, TC18 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | SectionDropZone, undo state logic |
| Integration | Yes | DndContext + API coordination |
| API | Yes | Backend machine_type update |
| E2E | Optional | Full drag-to-type-change flow |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, npm install, Python 3.11+ |
| External Services | None |
| Test Data | Mock Server objects with different machine_types |
| Library Mocks | @dnd-kit hooks, API client |

---

## Test Cases

### TC01: Drop zone highlights on cross-section drag

**Type:** Unit | **Priority:** High | **Story:** US0137 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SectionDropZone component for 'workstation' section | Component rendered |
| When | A server card is dragged over the zone | useDroppable isOver=true |
| Then | Drop zone shows highlight ring and indicator text | ring-2 ring-status-info applied |

**Assertions:**
- [ ] Drop zone has `ring-2 ring-status-info` class when isOver=true
- [ ] "Drop to change to Workstation" text visible
- [ ] Background has `bg-status-info/5` tint

---

### TC02: Drop zone tooltip shows target type

**Type:** Unit | **Priority:** Medium | **Story:** US0137 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dragging over Servers section drop zone | isOver=true |
| When | Tooltip renders | Text content checked |
| Then | Shows "Drop to change to Server" | Correct type displayed |

**Assertions:**
- [ ] Text matches target section type
- [ ] Workstation zone says "Workstation"
- [ ] Server zone says "Server"

---

### TC03: Dropping server card into workstations changes type

**Type:** Integration | **Priority:** High | **Story:** US0137 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server card in Servers section | machine_type = 'server' |
| When | Card dropped on Workstations drop zone | onDragEnd fires |
| Then | API called with machine_type='workstation' | PUT request sent |
| And | Card moves to Workstations section | UI updates |

**Assertions:**
- [ ] updateMachineType called with (serverId, 'workstation')
- [ ] Server removed from servers list in UI
- [ ] Server appears in workstations list
- [ ] Section counts update (servers -1, workstations +1)

---

### TC04: Dropping workstation card into servers changes type

**Type:** Integration | **Priority:** High | **Story:** US0137 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstation card in Workstations section | machine_type = 'workstation' |
| When | Card dropped on Servers drop zone | onDragEnd fires |
| Then | API called with machine_type='server' | PUT request sent |

**Assertions:**
- [ ] updateMachineType called with (machineId, 'server')
- [ ] Card moves to Servers section
- [ ] Workstation count decreases by 1

---

### TC05: Card appears at correct position after type change

**Type:** Integration | **Priority:** Medium | **Story:** US0137 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card dropped on section header (not specific position) | Header drop zone |
| When | Type change completes | Card added to section |
| Then | Card appears at end of new section | Appended to list |

**Assertions:**
- [ ] Card added to end of target section's card order
- [ ] Existing cards in section unchanged

---

### TC06: Toast appears after successful type change

**Type:** Integration | **Priority:** High | **Story:** US0137 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Type change API succeeds | 200 response |
| When | Response received | Toast triggered |
| Then | Toast shows "Changed [name] to [type]" | Success message |

**Assertions:**
- [ ] toast.success called
- [ ] Message includes machine display_name or hostname
- [ ] Message includes new type (server/workstation)

---

### TC07: Toast includes Undo action button

**Type:** Integration | **Priority:** High | **Story:** US0137 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Type change toast displayed | Toast visible |
| When | Toast renders | Action button present |
| Then | "Undo" button visible for 5 seconds | Button clickable |

**Assertions:**
- [ ] Toast has action with label "Undo"
- [ ] Toast duration is 5000ms
- [ ] Clicking Undo triggers handleUndo

---

### TC08: Undo reverts machine type

**Type:** Integration | **Priority:** High | **Story:** US0137 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Type change completed, undo available | undoState set |
| When | User clicks Undo within 5 seconds | handleUndo called |
| Then | API called to revert type | PUT with original type |
| And | Card moves back to original section | UI reverts |

**Assertions:**
- [ ] updateMachineType called with original type
- [ ] Card removed from new section
- [ ] Card added back to original section
- [ ] Section counts revert

---

### TC09: Undo restores original position

**Type:** Integration | **Priority:** Medium | **Story:** US0137 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card was at position 2 in Servers before change | Previous order stored |
| When | Undo completes | Position restored |
| Then | Card returns to position 2 in Servers | Order preserved |

**Assertions:**
- [ ] Card inserted at previousOrder index
- [ ] Other cards not affected

---

### TC10: Undo confirmation toast shown

**Type:** Integration | **Priority:** Medium | **Story:** US0137 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Undo API succeeds | 200 response |
| When | Revert completes | Toast triggered |
| Then | Toast shows "Reverted [name] to [type]" | Success message |

**Assertions:**
- [ ] toast.success called with revert message
- [ ] Original type shown in message
- [ ] undoState cleared

---

### TC11: Source section dims during cross-section drag

**Type:** Unit | **Priority:** Medium | **Story:** US0137 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dragging server card over Workstations | Cross-section drag |
| When | Drag is in progress | Visual state updates |
| Then | Servers section has reduced opacity | opacity-50 class |

**Assertions:**
- [ ] isSourceSection prop passed to MachineSection
- [ ] Section has `opacity-50` when isSourceSection=true

---

### TC12: Target section shows distinct highlight

**Type:** Unit | **Priority:** Medium | **Story:** US0137 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dragging over target section | isOver=true |
| When | Different from source section | Cross-section detected |
| Then | Target section has info-coloured ring | Visual distinction |

**Assertions:**
- [ ] ring-status-info (not default reorder highlight)
- [ ] bg-status-info/5 background tint

---

### TC13: Dragged card shows type change indicator

**Type:** Unit | **Priority:** Low | **Story:** US0137 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card being dragged over different section | DragOverlay active |
| When | Detecting cross-section | Indicator shown |
| Then | Card shows type change icon | Visual indicator |

**Assertions:**
- [ ] ArrowRightLeft or similar icon visible
- [ ] "Change type" text shown

---

### TC14: Backend accepts machine_type in ServerUpdate

**Type:** API | **Priority:** High | **Story:** US0137 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Existing server with machine_type='server' | Server in DB |
| When | PUT /api/v1/servers/{id} with {"machine_type": "workstation"} | Request sent |
| Then | Response 200 with updated server | machine_type='workstation' |

**Assertions:**
- [ ] Response status 200
- [ ] response.machine_type === 'workstation'
- [ ] Database record updated

---

### TC15: Backend validates machine_type values

**Type:** API | **Priority:** High | **Story:** US0137 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists | Valid server_id |
| When | PUT with {"machine_type": "invalid"} | Invalid value |
| Then | Response 422 Validation Error | Rejected |

**Assertions:**
- [ ] Response status 422
- [ ] Error mentions invalid machine_type
- [ ] Only 'server' or 'workstation' accepted

---

### TC16: Backend allows partial update with only machine_type

**Type:** API | **Priority:** Medium | **Story:** US0137 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with hostname='alpha', display_name='Alpha' | Existing data |
| When | PUT with only {"machine_type": "workstation"} | Partial update |
| Then | Only machine_type changes, other fields preserved | No data loss |

**Assertions:**
- [ ] hostname unchanged
- [ ] display_name unchanged
- [ ] tdp_watts unchanged
- [ ] machine_type updated

---

### TC17: Keyboard Tab moves focus to different section

**Type:** Integration | **Priority:** Medium | **Story:** US0137 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card in drag mode via keyboard | Space pressed on handle |
| When | User presses Tab | Focus shifts |
| Then | Focus moves to section drop zone | Section focusable |

**Assertions:**
- [ ] SectionDropZone is focusable (tabindex)
- [ ] Focus indicator visible on section

---

### TC18: Keyboard Enter confirms type change

**Type:** Integration | **Priority:** Medium | **Story:** US0137 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card in drag mode, focus on different section | Tab used |
| When | User presses Enter | Confirm action |
| Then | Type change occurs | Same as mouse drop |

**Assertions:**
- [ ] handleDragEnd called with section drop zone as over
- [ ] Type change API called
- [ ] Toast appears

---

### TC19: Drag over collapsed section prevented (Edge Case)

**Type:** Unit | **Priority:** Medium | **Story:** US0137

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstations section is collapsed | collapsed=true |
| When | Dragging server card over collapsed section | Drag over |
| Then | Drop zone not active | No highlight, no drop |

**Assertions:**
- [ ] SectionDropZone not rendered when collapsed
- [ ] Or: useDroppable disabled when collapsed
- [ ] Tooltip: "Expand section to drop here"

---

### TC20: API failure reverts UI state (Edge Case)

**Type:** Integration | **Priority:** High | **Story:** US0137

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | API mocked to fail with 500 | Network error |
| When | Type change attempted | Error occurs |
| Then | Card returns to original section | UI reverted |
| And | Error toast shown | User notified |

**Assertions:**
- [ ] Optimistic update reverted
- [ ] Card back in original section
- [ ] toast.error called with message
- [ ] Optional: Retry action in toast

---

### TC21: Undo expires after 5 seconds (Edge Case)

**Type:** Unit | **Priority:** Medium | **Story:** US0137

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Type change completed, undo available | undoState set |
| When | 5 seconds pass | Timer expires |
| Then | undoState cleared | Undo unavailable |

**Assertions:**
- [ ] undoState becomes null after 5000ms
- [ ] Undo button hidden/disabled in toast
- [ ] Clicking expired undo does nothing

---

### TC22: Second type change replaces undo state (Edge Case)

**Type:** Integration | **Priority:** Low | **Story:** US0137

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | First type change, undo available | undoState for machine A |
| When | Second type change for machine B | New change |
| Then | Undo state replaced with machine B | Only latest undoable |

**Assertions:**
- [ ] undoState.machineId === machine B's id
- [ ] First change cannot be undone
- [ ] Only one undo possible at a time

---

### TC23: Same-section reorder still works (Regression)

**Type:** Integration | **Priority:** High | **Story:** US0137

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Two server cards in Servers section | Same section |
| When | Drag card 1 to position of card 2 | Within-section drag |
| Then | Cards reorder, no type change | Existing behaviour preserved |

**Assertions:**
- [ ] updateMachineType NOT called
- [ ] Card order updated via preferences
- [ ] Both cards remain servers

---

## Fixtures

```yaml
mockServers:
  - id: "server-1"
    hostname: "alpha"
    display_name: "Alpha Server"
    status: "online"
    machine_type: "server"
    latest_metrics:
      cpu_percent: 25
      memory_percent: 50

  - id: "server-2"
    hostname: "beta"
    display_name: "Beta Server"
    status: "online"
    machine_type: "server"

mockWorkstations:
  - id: "workstation-1"
    hostname: "study-pc"
    display_name: "Study PC"
    status: "online"
    machine_type: "workstation"

  - id: "workstation-2"
    hostname: "laptop"
    display_name: "Laptop Pro"
    status: "offline"
    machine_type: "workstation"

allMachines:
  - ...mockServers
  - ...mockWorkstations
```

---

## Mock Setup

### @dnd-kit Mocking for Tests

```typescript
import { DndContext } from '@dnd-kit/core';

const mockDragEndEvent = (activeId: string, overId: string, overData?: object) => ({
  active: { id: activeId },
  over: { id: overId, data: { current: overData } },
});

// Example: Cross-section drop
const event = mockDragEndEvent(
  'server-1',
  'section-drop-workstation',
  { section: 'workstation', isDropZone: true }
);
```

### API Mocking

```typescript
vi.mock('../api/servers', () => ({
  updateMachineType: vi.fn().mockResolvedValue({
    id: 'server-1',
    machine_type: 'workstation',
    // ... other fields
  }),
}));
```

### Timer Mocking for Undo

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Advance timer to expire undo
vi.advanceTimersByTime(5000);
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Drop zone highlights on cross-section drag | Pending | - |
| TC02 | Drop zone tooltip shows target type | Pending | - |
| TC03 | Dropping server into workstations changes type | Pending | - |
| TC04 | Dropping workstation into servers changes type | Pending | - |
| TC05 | Card appears at correct position | Pending | - |
| TC06 | Toast appears after type change | Pending | - |
| TC07 | Toast includes Undo action | Pending | - |
| TC08 | Undo reverts machine type | Pending | - |
| TC09 | Undo restores original position | Pending | - |
| TC10 | Undo confirmation toast shown | Pending | - |
| TC11 | Source section dims during drag | Pending | - |
| TC12 | Target section shows distinct highlight | Pending | - |
| TC13 | Dragged card shows type change indicator | Pending | - |
| TC14 | Backend accepts machine_type | Pending | - |
| TC15 | Backend validates machine_type | Pending | - |
| TC16 | Backend partial update works | Pending | - |
| TC17 | Keyboard Tab to section | Pending | - |
| TC18 | Keyboard Enter confirms | Pending | - |
| TC19 | Collapsed section prevented | Pending | - |
| TC20 | API failure reverts UI | Pending | - |
| TC21 | Undo expires after 5s | Pending | - |
| TC22 | Second change replaces undo | Pending | - |
| TC23 | Same-section reorder works | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0137](../plans/PL0137-cross-section-machine-type-change.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec |
