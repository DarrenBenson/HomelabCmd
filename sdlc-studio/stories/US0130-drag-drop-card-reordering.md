# US0130: Drag-and-Drop Card Reordering

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 8
> **Plan:** [PL0130](../plans/PL0130-drag-drop-card-reordering.md)
> **Test Spec:** [TS0130](../test-specs/TS0130-drag-drop-card-reordering.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** to drag machine cards to reorder them
**So that** I can put the most important machines at the top

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Wants a customisable dashboard where critical servers are prominently positioned.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current dashboard displays machines in a fixed order (typically by registration time or alphabetically). Darren wants to prioritise his most critical servers (DNS, NAS) at the top of the dashboard for quick visibility during his daily 2-5 minute health checks.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Keyboard navigation required | Arrow keys + Enter must work |
| PRD | Performance | Dashboard load <3s | DnD library must be lightweight |
| TRD | Architecture | React + Tailwind CSS | Use @dnd-kit (maintained, accessible) |

---

## Acceptance Criteria

### AC1: Drag handle visibility

- **Given** the dashboard is loaded with machine cards
- **When** the user hovers over a card
- **Then** a drag handle icon (6 dots / grip icon) appears on the left side of the card
- **And** the cursor changes to "grab" when over the handle

### AC2: Drag initiation

- **Given** a card with visible drag handle
- **When** the user clicks and holds the drag handle
- **Then** the card becomes draggable
- **And** the card follows the cursor/touch position
- **And** the original position shows a placeholder (dashed border)

### AC3: Drop zone indication

- **Given** a card is being dragged
- **When** the card hovers over a valid drop position
- **Then** a visual indicator shows where the card will land (highlighted gap)
- **And** other cards animate to make space for the drop

### AC4: Successful drop

- **Given** a card is being dragged
- **When** the user releases the card over a valid drop position
- **Then** the card animates smoothly to its new position (200ms transition)
- **And** other cards reflow to accommodate the change
- **And** the new order is saved automatically (see US0131)

### AC5: Keyboard accessibility

- **Given** focus is on a machine card
- **When** the user presses Space or Enter
- **Then** the card enters "drag mode" (visual indicator changes)
- **When** Arrow Up/Down keys are pressed in drag mode
- **Then** the card moves up/down in the list
- **When** Space or Enter is pressed again
- **Then** the card drops in its new position

### AC6: Touch support

- **Given** the dashboard is accessed on a touch device
- **When** the user long-presses (300ms) on a card
- **Then** the card becomes draggable
- **And** haptic feedback triggers (if device supports)

### AC7: Cancelled drag

- **Given** a card is being dragged
- **When** the user presses Escape or releases outside valid zones
- **Then** the card returns to its original position (animated)
- **And** no order change is saved

---

## Scope

### In Scope

- Drag handle UI on card hover
- Mouse drag-and-drop
- Keyboard navigation (Space to grab, arrows to move, Space to drop)
- Touch long-press activation
- Visual feedback during drag (cursor, placeholder, drop zone)
- Smooth animations (200ms transitions)
- Cancel drag with Escape key

### Out of Scope

- Order persistence (see US0131)
- Cross-section dragging (servers to workstations - see US0132)
- Multi-card selection and batch reorder
- Drag-and-drop on list view (grid only)

---

## Technical Notes

### Implementation Approach

1. **Install @dnd-kit packages:**
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. **Dashboard.tsx wrapper:**
   ```tsx
   import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
   import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';

   function Dashboard() {
     const sensors = useSensors(
       useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
       useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
     );

     return (
       <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
         <SortableContext items={machines.map(m => m.id)} strategy={rectSortingStrategy}>
           {machines.map(machine => <SortableCard key={machine.id} machine={machine} />)}
         </SortableContext>
       </DndContext>
     );
   }
   ```

3. **SortableCard component:**
   ```tsx
   import { useSortable } from '@dnd-kit/sortable';
   import { CSS } from '@dnd-kit/utilities';

   function SortableCard({ machine }) {
     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: machine.id });

     const style = {
       transform: CSS.Transform.toString(transform),
       transition,
       opacity: isDragging ? 0.5 : 1,
     };

     return (
       <div ref={setNodeRef} style={style} {...attributes}>
         <div className="drag-handle" {...listeners}>
           <GripVertical className="h-4 w-4" />
         </div>
         <ServerCard machine={machine} />
       </div>
     );
   }
   ```

### Files to Create/Modify

- `frontend/src/components/SortableCard.tsx` - New wrapper component
- `frontend/src/pages/Dashboard.tsx` - Add DndContext
- `frontend/package.json` - Add @dnd-kit dependencies

### Data Requirements

- Machine ID used as sortable item key
- No backend changes for this story (persistence in US0131)

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Drag started but mouse leaves window | Card returns to original position |
| 2 | Very fast drag and drop | Animation completes without jank |
| 3 | Drag while data is refreshing | Drag completes, then refresh updates |
| 4 | Single card on dashboard | Drag handle hidden (nothing to reorder) |
| 5 | Screen reader active | Announces "Grab [server name], use arrows to move, Space to drop" |
| 6 | Touch drag interrupted by call/notification | Card returns to original position |
| 7 | Drag over non-card area | Card snaps back, no drop occurs |
| 8 | Rapid consecutive reorders | Each reorder completes before next |

---

## Test Scenarios

- [ ] Drag handle appears on card hover
- [ ] Drag handle hidden when card not hovered
- [ ] Card follows cursor during drag
- [ ] Placeholder shown at original position during drag
- [ ] Drop zone highlights on hover
- [ ] Card animates to new position on drop
- [ ] Escape cancels drag and returns card
- [ ] Keyboard: Space activates drag mode
- [ ] Keyboard: Arrow keys move card
- [ ] Keyboard: Space confirms new position
- [ ] Touch: Long-press activates drag
- [ ] Touch: Drag and release reorders
- [ ] Animation completes in ~200ms
- [ ] Order change triggers save callback

---

## Dependencies

### Story Dependencies

None - foundational story for EP0011.

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| @dnd-kit/core | npm package | Not installed |
| @dnd-kit/sortable | npm package | Not installed |
| @dnd-kit/utilities | npm package | Not installed |
| lucide-react GripVertical icon | Library | Available |

---

## Estimation

**Story Points:** 8
**Complexity:** High - New library integration, accessibility requirements, touch support

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0130, TS0130 created) |
| 2026-01-28 | Claude | Status: Planned -> In Progress -> Done (WF0016 complete) |
