# US0137: Cross-Section Machine Type Change via Drag-and-Drop

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 5
> **Plan:** [PL0137](../plans/PL0137-cross-section-machine-type-change.md)
> **Test Spec:** [TS0137](../test-specs/TS0137-cross-section-machine-type-change.md)
> **Workflow:** [WF0137](../workflows/WF0137-cross-section-machine-type-change.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** to change a machine's type by dragging its card into another section
**So that** I can quickly reclassify machines without navigating to settings

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab with mixed server and workstation devices. Values efficiency and quick interactions.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, the dashboard groups machines into "Servers" and "Workstations" sections (US0132). Cards can only be reordered within their section. Users sometimes misclassify machines during import or need to reclassify them later (e.g., repurposing a workstation as a server). This story enables cross-section drag-and-drop to change the machine type with a single gesture.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| EP0011 | UX | Reorder <2s including save | Type change must complete within 2s |
| PRD | Data | Single source of truth | Backend must be updated, not just frontend |
| US0132 | Architecture | Sections filter by machine_type | Dropping into section changes machine_type |

---

## Acceptance Criteria

### AC1: Cross-section drag enabled

- **Given** a machine card in the "Servers" section
- **When** I drag it over the "Workstations" section header or drop zone
- **Then** the drop zone highlights to indicate a valid drop target
- **And** a tooltip shows "Change to Workstation"

### AC2: Machine type updated on drop

- **Given** I am dragging a server card over the "Workstations" section
- **When** I drop the card
- **Then** the machine's `machine_type` is updated to "workstation" via API
- **And** the card moves to the Workstations section
- **And** the card appears at the drop position (or end if dropped on header)
- **And** the section counts update immediately

### AC3: Confirmation for type change

- **Given** I drop a card into a different section
- **When** the drop occurs
- **Then** a brief confirmation toast appears: "Changed [machine name] to [new type]"
- **And** the toast includes an "Undo" action (valid for 5 seconds)

### AC4: Undo type change

- **Given** the confirmation toast is visible with "Undo" action
- **When** I click "Undo" within 5 seconds
- **Then** the machine type reverts to its previous value
- **And** the card moves back to its original section and position
- **And** a confirmation toast shows "Reverted [machine name] to [original type]"

### AC5: Visual feedback during cross-section drag

- **Given** I am dragging a card
- **When** I move over a different section
- **Then** the target section shows a distinct highlight (different from reorder highlight)
- **And** the dragged card shows a "type change" indicator (icon or badge)
- **And** the original section dims slightly

### AC6: API endpoint for machine type update

- **Given** a valid server ID and new machine type
- **When** `PATCH /api/v1/servers/{id}` is called with `{"machine_type": "workstation"}`
- **Then** the server's machine_type is updated in the database
- **And** response includes the updated server object
- **And** response status is 200 OK

### AC7: Keyboard accessibility

- **Given** a card is focused and in drag mode (Enter pressed after arrow key selection)
- **When** I press Tab to move focus to a different section
- **And** press Enter to confirm drop
- **Then** the type change occurs as with mouse drag-and-drop

---

## Scope

### In Scope

- Cross-section drag-and-drop UI interaction
- Visual feedback for type change vs reorder
- API endpoint to update machine_type
- Undo functionality with 5-second window
- Keyboard accessibility for type change
- Toast notifications for feedback
- Section count updates

### Out of Scope

- Batch type changes (multiple machines at once)
- Type change from server detail page (existing functionality)
- New machine types beyond server/workstation
- Confirmation modal before type change (toast with undo is sufficient)
- Drag between collapsed sections (sections must be expanded)

---

## Technical Notes

### Frontend Implementation

Extend the existing @dnd-kit setup to support cross-section drops:

```tsx
// Detect cross-section drop in handleDragEnd
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  if (!over) return;

  const activeSection = getSectionForMachine(active.id);
  const overSection = over.data.current?.section || getSectionForMachine(over.id);

  if (activeSection !== overSection) {
    // Cross-section drop - change machine type
    const newType = overSection === 'servers' ? 'server' : 'workstation';
    handleMachineTypeChange(active.id, newType, over.id);
  } else {
    // Same-section drop - reorder only
    handleReorder(active.id, over.id);
  }
}
```

### Drop Zone Component

Add droppable zone to section headers:

```tsx
function SectionHeader({ type, title, count, isDropTarget }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${type}`,
    data: { section: type, isHeader: true }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'section-header',
        isOver && 'ring-2 ring-status-info bg-status-info/10'
      )}
    >
      {title} ({count})
      {isOver && <span className="text-xs">Drop to change type</span>}
    </div>
  );
}
```

### API Contract

**PATCH /api/v1/servers/{id}**

Request:
```json
{
  "machine_type": "workstation"
}
```

Response (200):
```json
{
  "id": "server-guid-123",
  "hostname": "my-machine",
  "machine_type": "workstation",
  "status": "online",
  ...
}
```

### Undo Implementation

Store previous state for undo window:

```tsx
const [undoState, setUndoState] = useState<{
  machineId: string;
  previousType: MachineType;
  previousPosition: number;
  previousSection: string;
} | null>(null);

// Clear undo after 5 seconds
useEffect(() => {
  if (undoState) {
    const timer = setTimeout(() => setUndoState(null), 5000);
    return () => clearTimeout(timer);
  }
}, [undoState]);
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | API fails during type change | Revert card to original position, show error toast |
| 2 | Drop on collapsed section | Prevent drop, show "Expand section to drop here" tooltip |
| 3 | Network timeout during save | Revert after 5s timeout, show retry option |
| 4 | Undo clicked after 5 seconds | Undo button disabled/hidden, no action |
| 5 | Second type change before undo expires | New undo state replaces old, only latest change undoable |
| 6 | Drag card over own section header | Treat as reorder to end of section, not type change |
| 7 | Drop while API call in progress | Queue the operation, show loading state |
| 8 | Machine has active alerts | Allow type change, alerts remain associated |

---

## Test Scenarios

- [ ] Drag server card to workstations section changes type to workstation
- [ ] Drag workstation card to servers section changes type to server
- [ ] Drop zone highlights when dragging over different section
- [ ] Confirmation toast appears after type change
- [ ] Undo reverts type and position within 5 seconds
- [ ] Undo button disappears after 5 seconds
- [ ] Section counts update after type change
- [ ] API called with correct machine_type value
- [ ] Card reorders correctly within same section (existing behaviour preserved)
- [ ] Keyboard navigation can trigger type change
- [ ] Error toast shown when API fails
- [ ] Card reverts on API failure

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0130](US0130-drag-drop-card-reordering.md) | Extends | Drag-and-drop infrastructure | Done |
| [US0132](US0132-server-workstation-grouping.md) | Extends | Section grouping by machine_type | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| @dnd-kit/core | Library | Installed |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Extends existing DnD, adds API endpoint, undo logic

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0137, TS0137 created) |
| 2026-01-28 | Claude | Status: In Progress -> Done. Backend: machine_type in ServerUpdate (4 tests). Frontend: SectionDropZone, DndContext lift, cross-section detection, undo, toasts (8 tests). |
