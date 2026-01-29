# PL0130: Drag-and-Drop Card Reordering - Implementation Plan

> **Status:** Complete
> **Story:** [US0130: Drag-and-Drop Card Reordering](../stories/US0130-drag-drop-card-reordering.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (Frontend)

## Overview

Implement drag-and-drop card reordering for the Dashboard using @dnd-kit. Cards will have a drag handle that appears on hover, support keyboard accessibility (Space to grab, arrows to move, Space to drop), and touch support (300ms long-press). Order persistence is handled by US0131.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Drag handle visibility | Grip icon appears on card hover |
| AC2 | Drag initiation | Click-hold on handle, card follows cursor, placeholder shown |
| AC3 | Drop zone indication | Highlighted gap, cards animate to make space |
| AC4 | Successful drop | Smooth 200ms animation, reflow, callback fired |
| AC5 | Keyboard accessibility | Space/Enter to grab, arrows to move, Space/Enter to drop |
| AC6 | Touch support | 300ms long-press activates drag |
| AC7 | Cancelled drag | Escape or release outside returns card, no change |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 19
- **Test Framework:** Vitest + Testing Library
- **Icons:** lucide-react (GripVertical)
- **Drag-and-Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

### Existing Patterns
- Dashboard.tsx uses `filteredServers.map()` for card grid (lines 606-617)
- ServerCard.tsx is the existing card component
- CSS grid layout with Tailwind responsive classes

### @dnd-kit Documentation Reference

From Context7 documentation:
```tsx
// Basic sensors setup
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

// DndContext with SortableContext
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={items} strategy={verticalListSortingStrategy}>
    {items.map(id => <SortableItem key={id} id={id} />)}
  </SortableContext>
</DndContext>

// SortableItem component with useSortable hook
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({id});
const style = { transform: CSS.Transform.toString(transform), transition };
```

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Install @dnd-kit packages | `package.json` | - | [ ] |
| 2 | Create SortableServerCard wrapper | `SortableServerCard.tsx` | 1 | [ ] |
| 3 | Add DndContext to Dashboard | `Dashboard.tsx` | 2 | [ ] |
| 4 | Add drag handle styling | `SortableServerCard.tsx` | 2 | [ ] |
| 5 | Configure touch sensor (300ms delay) | `Dashboard.tsx` | 3 | [ ] |
| 6 | Add DragOverlay for smooth drag | `Dashboard.tsx` | 3 | [ ] |
| 7 | Add onOrderChange callback prop | `Dashboard.tsx` | 3 | [ ] |
| 8 | Write unit tests | `SortableServerCard.test.tsx` | 2 | [ ] |
| 9 | Write integration tests | `Dashboard.test.tsx` | 3 | [ ] |

---

## Implementation Details

### Task 1: Install @dnd-kit packages

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Task 2: SortableServerCard Component

**File:** `frontend/src/components/SortableServerCard.tsx`

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ServerCard } from './ServerCard';
import type { Server } from '../types/server';

interface SortableServerCardProps {
  server: Server;
  onClick?: () => void;
  onPauseToggle?: () => void;
  onMessage?: (msg: { type: 'success' | 'error' | 'info'; text: string }) => void;
}

export function SortableServerCard({ server, onClick, onPauseToggle, onMessage }: SortableServerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group" {...attributes}>
      {/* Drag handle - visible on hover */}
      <button
        type="button"
        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-10 focus:opacity-100 focus:ring-2 focus:ring-status-info rounded"
        aria-label="Drag to reorder"
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-text-tertiary" />
      </button>

      <ServerCard
        server={server}
        onClick={onClick}
        onPauseToggle={onPauseToggle}
        onMessage={onMessage}
      />
    </div>
  );
}
```

### Task 3: Dashboard DndContext Integration

**File:** `frontend/src/pages/Dashboard.tsx`

Add imports:
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SortableServerCard } from '../components/SortableServerCard';
```

Add sensors and state:
```typescript
// Active drag ID for DragOverlay
const [activeDragId, setActiveDragId] = useState<string | null>(null);

// Sensors with keyboard, pointer, and touch support
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }, // Prevent accidental drags
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 300, // 300ms long-press for touch
      tolerance: 5,
    },
  })
);

// Drag handlers
function handleDragStart(event: DragStartEvent) {
  setActiveDragId(event.active.id as string);
}

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  setActiveDragId(null);

  if (over && active.id !== over.id) {
    setServers((items) => {
      const oldIndex = items.findIndex(s => s.id === active.id);
      const newIndex = items.findIndex(s => s.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    // onOrderChange callback will be added in US0131
  }
}

function handleDragCancel() {
  setActiveDragId(null);
}
```

Update grid rendering:
```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragCancel={handleDragCancel}
>
  <SortableContext
    items={filteredServers.map(s => s.id)}
    strategy={rectSortingStrategy}
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredServers.map((server) => (
        <SortableServerCard
          key={server.id}
          server={server}
          onClick={() => navigate(`/servers/${server.id}`)}
          onPauseToggle={refreshData}
          onMessage={handleQuickActionMessage}
        />
      ))}
    </div>
  </SortableContext>

  {/* DragOverlay for smooth visual feedback */}
  <DragOverlay>
    {activeDragId ? (
      <div className="opacity-90 shadow-2xl">
        <ServerCard
          server={filteredServers.find(s => s.id === activeDragId)!}
        />
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
```

### Task 4: Drag Handle Styling

The drag handle uses Tailwind classes:
- `opacity-0 group-hover:opacity-100` - Appears on card hover (AC1)
- `cursor-grab active:cursor-grabbing` - Cursor feedback (AC1)
- `focus:opacity-100 focus:ring-2` - Keyboard focus visibility (AC5)

### Task 5: Touch Sensor Configuration

The TouchSensor is configured with:
- `delay: 300` - 300ms long-press activation (AC6)
- `tolerance: 5` - Allows small finger movement during press

### Task 6: DragOverlay

The DragOverlay provides:
- Smooth visual feedback during drag (AC3)
- Card preview follows cursor (AC2)
- Shadow effect (`shadow-2xl`) for depth

---

## Reordering Algorithm

Using @dnd-kit's `arrayMove` utility:

```typescript
// arrayMove(array, fromIndex, toIndex)
const newOrder = arrayMove(servers, oldIndex, newIndex);
```

The `arrayMove` function:
1. Removes item at `oldIndex`
2. Inserts it at `newIndex`
3. Returns new array (immutable)

---

## Keyboard Navigation Flow

Per AC5, keyboard navigation:

1. **Tab** to card (focuses the drag handle)
2. **Space** or **Enter** to enter drag mode
3. **Arrow Up/Down** (or Left/Right in grid) to move position
4. **Space** or **Enter** to confirm drop
5. **Escape** to cancel

@dnd-kit handles this via `sortableKeyboardCoordinates` which maps arrow keys to movement in the sorted context.

---

## Edge Case Handling

| # | Edge Case | Strategy |
|---|-----------|----------|
| 1 | Drag leaves window | `onDragCancel` reverts to original position |
| 2 | Fast drag operations | DragOverlay ensures smooth 60fps rendering |
| 3 | Refresh during drag | State update waits for drag completion |
| 4 | Single card | Drag handle still shown (consistent UX) |
| 5 | Screen reader | @dnd-kit provides ARIA live region announcements |
| 6 | Touch interrupted | TouchSensor cancels, card returns |
| 7 | Drag over non-card | closestCenter finds nearest valid target |
| 8 | Rapid reorders | React state batching handles correctly |

---

## CSS Animation Details

@dnd-kit provides transform animations via:
```typescript
const style = {
  transform: CSS.Transform.toString(transform),
  transition, // @dnd-kit provides appropriate transition duration
};
```

The default transition is ~200ms, satisfying AC4.

For placeholder styling during drag (`isDragging: true`):
```typescript
opacity: isDragging ? 0.5 : 1,
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/package.json` | Modify | Add @dnd-kit dependencies |
| `frontend/src/components/SortableServerCard.tsx` | Create | Wrapper with drag handle |
| `frontend/src/components/SortableServerCard.test.tsx` | Create | Unit tests |
| `frontend/src/pages/Dashboard.tsx` | Modify | Add DndContext and sensors |

---

## Definition of Done

- [ ] @dnd-kit packages installed
- [ ] SortableServerCard component created
- [ ] Drag handle appears on hover
- [ ] Cards can be dragged and reordered
- [ ] Visual feedback during drag (opacity, shadow)
- [ ] Keyboard navigation works (Space, arrows, Enter)
- [ ] Touch support works (300ms long-press)
- [ ] Escape cancels drag
- [ ] Unit tests passing
- [ ] All existing tests still pass

---

## Test Strategy

See [TS0130: Drag-and-Drop Card Reordering](../test-specs/TS0130-drag-drop-card-reordering.md)

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial plan creation |
