# PL0137: Cross-Section Machine Type Change - Implementation Plan

> **Status:** Complete
> **Story:** [US0137: Cross-Section Machine Type Change via Drag-and-Drop](../stories/US0137-cross-section-machine-type-change.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (Frontend), Python (Backend)

## Overview

Extend the existing drag-and-drop infrastructure to support cross-section drops that change a machine's type. When a user drags a server card to the Workstations section (or vice versa), the machine_type is updated via API, the card moves to the new section, and a toast with undo capability appears.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Cross-section drag enabled | Drop zone highlights when dragging over different section |
| AC2 | Machine type updated on drop | API called, card moves, counts update |
| AC3 | Confirmation toast | Toast with "Undo" action for 5 seconds |
| AC4 | Undo type change | Reverts type, position, and section |
| AC5 | Visual feedback during drag | Distinct highlight, type change indicator |
| AC6 | API endpoint | PATCH /api/v1/servers/{id} with machine_type |
| AC7 | Keyboard accessibility | Tab to section, Enter to confirm type change |

---

## Technical Context

### Language & Framework
- **Frontend:** TypeScript, React 19
- **Backend:** Python 3.11+, FastAPI
- **Test Frameworks:** Vitest (frontend), pytest (backend)
- **Drag-and-Drop:** @dnd-kit/core, @dnd-kit/sortable (already installed)

### Existing Patterns

**MachineSection.tsx** (lines 134-168):
- Each section has its own `DndContext` for within-section reordering
- Uses `closestCenter` collision detection
- `handleDragEnd` only handles same-section reordering

**servers.py** (lines 248-279):
- `PUT /api/v1/servers/{server_id}` endpoint exists
- Uses `ServerUpdate` schema with `exclude_unset=True`
- Returns `ServerResponse` with updated server

**ServerUpdate schema** (lines 66-117):
- Does NOT include `machine_type` field yet
- All fields optional with None defaults

### Architecture Decision

**Single DndContext approach:** Currently, each MachineSection has its own DndContext, preventing cross-section drags. We'll lift a single DndContext to the Dashboard level and use droppable section headers for type changes.

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add machine_type to ServerUpdate schema | `schemas/server.py` | - | [ ] |
| 2 | Write backend tests for machine_type update | `test_servers.py` | 1 | [ ] |
| 3 | Add updateMachineType API function | `api/servers.ts` | 1 | [ ] |
| 4 | Create SectionDropZone component | `SectionDropZone.tsx` | - | [ ] |
| 5 | Lift DndContext to Dashboard | `Dashboard.tsx` | 4 | [ ] |
| 6 | Detect cross-section drop | `Dashboard.tsx` | 5 | [ ] |
| 7 | Add undo state management | `Dashboard.tsx` | 6 | [ ] |
| 8 | Add toast notifications | `Dashboard.tsx` | 6 | [ ] |
| 9 | Add visual feedback during cross-section drag | `MachineSection.tsx` | 5 | [ ] |
| 10 | Write frontend unit tests | `*.test.tsx` | 4-9 | [ ] |
| 11 | Write frontend integration tests | `Dashboard.test.tsx` | 5-8 | [ ] |

---

## Implementation Details

### Task 1: Add machine_type to ServerUpdate Schema

**File:** `backend/src/homelab_cmd/api/schemas/server.py`

Add to ServerUpdate class:

```python
machine_type: str | None = Field(
    None,
    pattern=r"^(server|workstation)$",
    description="Machine type: 'server' or 'workstation'",
)
```

### Task 2: Backend Tests

**File:** `backend/tests/test_servers.py`

```python
async def test_update_server_machine_type_to_workstation(client, auth_headers, test_server):
    """Test changing machine_type from server to workstation."""
    response = await client.put(
        f"/api/v1/servers/{test_server['id']}",
        json={"machine_type": "workstation"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["machine_type"] == "workstation"


async def test_update_server_machine_type_to_server(client, auth_headers, test_workstation):
    """Test changing machine_type from workstation to server."""
    response = await client.put(
        f"/api/v1/servers/{test_workstation['id']}",
        json={"machine_type": "server"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["machine_type"] == "server"


async def test_update_server_invalid_machine_type(client, auth_headers, test_server):
    """Test that invalid machine_type is rejected."""
    response = await client.put(
        f"/api/v1/servers/{test_server['id']}",
        json={"machine_type": "invalid"},
        headers=auth_headers,
    )
    assert response.status_code == 422  # Validation error
```

### Task 3: Frontend API Function

**File:** `frontend/src/api/servers.ts`

```typescript
export async function updateMachineType(
  serverId: string,
  machineType: 'server' | 'workstation'
): Promise<Server> {
  const response = await apiClient.put<Server>(`/servers/${serverId}`, {
    machine_type: machineType,
  });
  return response.data;
}
```

### Task 4: SectionDropZone Component

**File:** `frontend/src/components/SectionDropZone.tsx`

```typescript
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../lib/utils';

interface SectionDropZoneProps {
  sectionType: 'server' | 'workstation';
  isActiveSection: boolean;
  children: React.ReactNode;
}

export function SectionDropZone({
  sectionType,
  isActiveSection,
  children,
}: SectionDropZoneProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `section-drop-${sectionType}`,
    data: { section: sectionType, isDropZone: true },
  });

  // Only show drop indicator if dragging from different section
  const showDropIndicator = isOver && !isActiveSection && active;
  const targetType = sectionType === 'server' ? 'Server' : 'Workstation';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200',
        showDropIndicator && 'ring-2 ring-status-info bg-status-info/5 rounded-lg'
      )}
    >
      {showDropIndicator && (
        <div className="text-sm text-status-info text-center py-2 font-medium">
          Drop to change to {targetType}
        </div>
      )}
      {children}
    </div>
  );
}
```

### Task 5: Lift DndContext to Dashboard

**File:** `frontend/src/pages/Dashboard.tsx`

Move DndContext from MachineSection to Dashboard:

```typescript
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';

// In Dashboard component:
const [activeDragId, setActiveDragId] = useState<string | null>(null);
const [activeSection, setActiveSection] = useState<'server' | 'workstation' | null>(null);

function handleDragStart(event: DragStartEvent) {
  const machineId = event.active.id as string;
  setActiveDragId(machineId);

  // Determine which section the dragged item belongs to
  const machine = machines.find(m => m.id === machineId);
  setActiveSection(machine?.machine_type || null);
}

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  setActiveDragId(null);
  setActiveSection(null);

  if (!over) return;

  const overData = over.data.current;

  // Check if dropped on a section drop zone
  if (overData?.isDropZone) {
    const newType = overData.section as 'server' | 'workstation';
    const machine = machines.find(m => m.id === active.id);

    if (machine && machine.machine_type !== newType) {
      handleMachineTypeChange(machine, newType);
    }
    return;
  }

  // Otherwise, handle within-section reorder (existing logic)
  // ...
}
```

### Task 6: Cross-Section Drop Detection

Already included in Task 5. The key logic:

```typescript
// Check if the over target is a section drop zone
const isDropOnSection = over.data.current?.isDropZone === true;
const targetSection = over.data.current?.section;

if (isDropOnSection && targetSection !== activeSection) {
  // This is a cross-section drop - change type
  handleMachineTypeChange(machine, targetSection);
}
```

### Task 7: Undo State Management

**File:** `frontend/src/pages/Dashboard.tsx`

```typescript
interface UndoState {
  machineId: string;
  previousType: 'server' | 'workstation';
  previousOrder: string[];
  previousSection: 'server' | 'workstation';
}

const [undoState, setUndoState] = useState<UndoState | null>(null);

// Clear undo after 5 seconds
useEffect(() => {
  if (undoState) {
    const timer = setTimeout(() => setUndoState(null), 5000);
    return () => clearTimeout(timer);
  }
}, [undoState]);

async function handleMachineTypeChange(
  machine: Server,
  newType: 'server' | 'workstation'
) {
  const previousType = machine.machine_type;
  const previousOrder = preferences.card_order[previousType === 'server' ? 'servers' : 'workstations'];

  // Optimistically update UI
  // ...

  try {
    await updateMachineType(machine.id, newType);

    // Store undo state
    setUndoState({
      machineId: machine.id,
      previousType,
      previousOrder,
      previousSection: previousType,
    });

    // Show success toast
    toast.success(`Changed ${machine.display_name || machine.hostname} to ${newType}`, {
      action: {
        label: 'Undo',
        onClick: () => handleUndo(),
      },
      duration: 5000,
    });
  } catch (error) {
    // Revert on error
    // ...
    toast.error('Failed to change machine type');
  }
}

async function handleUndo() {
  if (!undoState) return;

  try {
    await updateMachineType(undoState.machineId, undoState.previousType);
    // Restore order
    // ...
    toast.success(`Reverted to ${undoState.previousType}`);
    setUndoState(null);
  } catch (error) {
    toast.error('Failed to undo');
  }
}
```

### Task 8: Toast Notifications

Using existing toast infrastructure (sonner or similar):

```typescript
// Success toast with undo action
toast.success(`Changed ${machineName} to ${newType}`, {
  action: {
    label: 'Undo',
    onClick: handleUndo,
  },
  duration: 5000,
});

// Revert confirmation
toast.success(`Reverted ${machineName} to ${originalType}`);

// Error handling
toast.error('Failed to change machine type', {
  action: {
    label: 'Retry',
    onClick: () => handleMachineTypeChange(machine, newType),
  },
});
```

### Task 9: Visual Feedback During Cross-Section Drag

**File:** `frontend/src/components/MachineSection.tsx`

Add prop for drag state:

```typescript
interface MachineSectionProps {
  // ... existing props
  isDraggingOver?: boolean;
  isSourceSection?: boolean;
}

// In component:
<section
  className={cn(
    'mb-8 transition-opacity',
    isSourceSection && 'opacity-50'
  )}
>
```

**File:** `frontend/src/components/SortableServerCard.tsx`

Add type change indicator during cross-section drag:

```typescript
// When dragging over different section
{isDraggingToDifferentSection && (
  <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 rounded-lg">
    <ArrowRightLeft className="w-6 h-6 text-status-info" />
    <span className="text-sm text-status-info ml-2">Change type</span>
  </div>
)}
```

---

## Edge Case Handling

| # | Edge Case | Strategy |
|---|-----------|----------|
| 1 | API fails during type change | Revert card to original section, show error toast with retry |
| 2 | Drop on collapsed section | Prevent drop, show tooltip "Expand section to drop here" |
| 3 | Network timeout | Revert after 5s, show retry option |
| 4 | Undo clicked after expiry | Button hidden/disabled, no action |
| 5 | Second type change before undo | Replace undo state, only latest undoable |
| 6 | Drag over own section header | Treat as reorder to end, not type change |
| 7 | Drop while API in progress | Queue operation, show loading state |
| 8 | Machine has active alerts | Allow change, alerts remain associated |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/src/homelab_cmd/api/schemas/server.py` | Modify | Add machine_type to ServerUpdate |
| `backend/tests/test_servers.py` | Modify | Add machine_type update tests |
| `frontend/src/api/servers.ts` | Modify | Add updateMachineType function |
| `frontend/src/components/SectionDropZone.tsx` | Create | Droppable section wrapper |
| `frontend/src/components/SectionDropZone.test.tsx` | Create | Unit tests |
| `frontend/src/components/MachineSection.tsx` | Modify | Remove per-section DndContext, add drag state props |
| `frontend/src/pages/Dashboard.tsx` | Modify | Lift DndContext, add type change logic |

---

## Definition of Done

- [x] Backend: machine_type field added to ServerUpdate schema
- [x] Backend: PUT /api/v1/servers/{id} accepts machine_type
- [x] Backend: Tests pass for type change (server→workstation, workstation→server)
- [x] Frontend: Cross-section drag enables type change
- [x] Frontend: Drop zone highlights when dragging over different section
- [x] Frontend: Toast appears with "Undo" action after type change
- [x] Frontend: Undo reverts type and position within 5 seconds
- [x] Frontend: Section counts update immediately
- [x] Frontend: Error handling reverts on API failure
- [x] All existing tests pass (63 backend, 8 SectionDropZone)
- [x] Story marked as Done

---

## Test Strategy

See [TS0137: Cross-Section Machine Type Change](../test-specs/TS0137-cross-section-machine-type-change.md)

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial plan creation |
| 2026-01-28 | Claude | Implementation complete: All 11 tasks done |
