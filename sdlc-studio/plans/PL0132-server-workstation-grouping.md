# PL0132: Server and Workstation Grouping - Implementation Plan

> **Status:** Draft
> **Story:** [US0132: Server and Workstation Grouping](../stories/US0132-server-workstation-grouping.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (Frontend), Python (Backend)

## Overview

Implement visual grouping of servers and workstations on the dashboard with separate sections, collapsible headers, status counts, and per-section drag-and-drop ordering. Extends the existing preferences API to store section-specific card orders and collapse states.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Section headers displayed | "Servers" and "Workstations" headers above respective card groups |
| AC2 | Section counts in headers | Headers show "(N online, M offline)" counts that update in real-time |
| AC3 | Reorder within section only | Drag-and-drop restricted to same section, cross-section drag blocked |
| AC4 | Collapsible sections | Click header to collapse/expand, chevron rotates |
| AC5 | Collapse state persisted | Collapse state saved and restored on page refresh |
| AC6 | Empty section message | "No workstations registered" with link to discovery page |
| AC7 | Section order fixed | Servers always first, Workstations always second |

---

## Technical Context

### Language & Framework
- **Frontend:** React 19, TypeScript
- **Backend:** Python 3.11+ with FastAPI, SQLAlchemy (async)
- **Test Framework:** Vitest (frontend), pytest (backend)

### Existing Patterns

**Dashboard.tsx (lines 76-911):**
- Single `DndContext` wrapping all cards
- `SortableContext` with `filteredServers`
- `useDebouncedSave` hook for order persistence
- Filter state managed via URL params

**Preferences API (preferences.py):**
- `CONFIG_KEY_CARD_ORDER = "dashboard_card_order"`
- Stores flat order: `{"order": ["id1", "id2", ...]}`
- Uses Config model for key-value storage

**Server type (server.ts:47-48):**
```typescript
machine_type?: MachineType;  // 'server' | 'workstation'
```

### Key Changes Required

1. **Restructure card order storage** to per-section:
   ```json
   {
     "servers": ["server-id-1", "server-id-2"],
     "workstations": ["workstation-id-1"]
   }
   ```

2. **Add collapse state storage**:
   ```json
   {
     "collapsed": ["workstations"]
   }
   ```

3. **Separate DndContext per section** to prevent cross-section dragging naturally

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Extend preferences schemas for section orders | `api/schemas/preferences.py` | - | [ ] |
| 2 | Add collapsed sections endpoint | `api/routes/preferences.py` | 1 | [ ] |
| 3 | Write backend unit tests | `tests/test_api_preferences.py` | 2 | [ ] |
| 4 | Create MachineSection component | `components/MachineSection.tsx` | - | [ ] |
| 5 | Create MachineSection types | `types/preferences.ts` | 4 | [ ] |
| 6 | Extend preferences API client | `api/preferences.ts` | 5 | [ ] |
| 7 | Refactor Dashboard to use sections | `pages/Dashboard.tsx` | 4, 6 | [ ] |
| 8 | Add collapse state persistence | `pages/Dashboard.tsx` | 6, 7 | [ ] |
| 9 | Write MachineSection tests | `components/MachineSection.test.tsx` | 4 | [ ] |
| 10 | Write Dashboard integration tests | `pages/Dashboard.test.tsx` | 7 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 4 | None (backend schemas, frontend component) |
| B | 2, 5 | A (backend endpoint, frontend types) |
| C | 3, 6, 9 | B (tests and API client) |
| D | 7, 8, 10 | C (integration) |

---

## Implementation Details

### Task 1: Extend Preferences Schemas

**File:** `backend/src/homelab_cmd/api/schemas/preferences.py`

```python
class SectionCardOrderRequest(BaseModel):
    """Request schema for saving section-specific card orders."""

    servers: list[str] = Field(
        default_factory=list,
        description="Ordered list of server IDs",
    )
    workstations: list[str] = Field(
        default_factory=list,
        description="Ordered list of workstation IDs",
    )


class SectionCardOrderResponse(BaseModel):
    """Response schema for section card orders."""

    servers: list[str] = Field(default_factory=list)
    workstations: list[str] = Field(default_factory=list)


class CollapsedSectionsRequest(BaseModel):
    """Request schema for saving collapsed section state."""

    collapsed: list[str] = Field(
        default_factory=list,
        description="List of collapsed section names",
        examples=[["workstations"]],
    )


class CollapsedSectionsResponse(BaseModel):
    """Response schema for collapsed sections."""

    collapsed: list[str] = Field(default_factory=list)
```

### Task 2: Add Collapsed Sections Endpoint

**File:** `backend/src/homelab_cmd/api/routes/preferences.py`

Add new config key and endpoints:

```python
CONFIG_KEY_SECTION_ORDER = "dashboard_section_order"
CONFIG_KEY_COLLAPSED_SECTIONS = "dashboard_collapsed_sections"


@router.put("/section-order")
async def save_section_order(
    request: SectionCardOrderRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderSaveResponse:
    """Save section-specific card orders."""
    # Upsert pattern...


@router.get("/section-order")
async def get_section_order(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> SectionCardOrderResponse:
    """Get section-specific card orders."""
    # Return empty lists if not found...


@router.put("/collapsed-sections")
async def save_collapsed_sections(
    request: CollapsedSectionsRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CardOrderSaveResponse:
    """Save collapsed section state."""


@router.get("/collapsed-sections")
async def get_collapsed_sections(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CollapsedSectionsResponse:
    """Get collapsed section state."""
```

### Task 4: Create MachineSection Component

**File:** `frontend/src/components/MachineSection.tsx`

```typescript
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ChevronRight, Server, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SortableServerCard } from './SortableServerCard';
import { ServerCard } from './ServerCard';
import type { Server as ServerType } from '../types/server';
import { cn } from '../lib/utils';

export interface MachineSectionProps {
  title: string;
  type: 'server' | 'workstation';
  machines: ServerType[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onReorder: (newOrder: string[]) => void;
  onCardClick: (server: ServerType) => void;
  onPauseToggle: () => void;
  onMessage: (msg: { type: 'success' | 'info' | 'error'; text: string }) => void;
}

export function MachineSection({
  title,
  type,
  machines,
  collapsed,
  onToggleCollapse,
  onReorder,
  onCardClick,
  onPauseToggle,
  onMessage,
}: MachineSectionProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sectionMachines = machines.filter((m) => m.machine_type === type);
  const online = sectionMachines.filter((m) => m.status === 'online').length;
  const offline = sectionMachines.length - online;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sectionMachines.findIndex((s) => s.id === active.id);
      const newIndex = sectionMachines.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(sectionMachines, oldIndex, newIndex);
      onReorder(newOrder.map((s) => s.id));
    }
  }

  function handleDragCancel() {
    setActiveDragId(null);
  }

  const Icon = type === 'server' ? Server : Monitor;

  return (
    <section className="mb-8" data-testid={`section-${type}s`}>
      <button
        className="flex items-center gap-2 w-full text-left py-2 group"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-controls={`section-content-${type}s`}
        data-testid={`section-header-${type}s`}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-text-tertiary transition-transform duration-200',
            !collapsed && 'rotate-90'
          )}
        />
        <Icon className="h-5 w-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary group-hover:text-status-info transition-colors">
          {title}{' '}
          <span className="text-text-tertiary font-normal">
            ({online} online, {offline} offline)
          </span>
        </h2>
      </button>

      {!collapsed && (
        <div id={`section-content-${type}s`} className="mt-4">
          {sectionMachines.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={sectionMachines.map((s) => s.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pl-4">
                  {sectionMachines.map((server) => (
                    <SortableServerCard
                      key={server.id}
                      server={server}
                      onClick={() => onCardClick(server)}
                      onPauseToggle={onPauseToggle}
                      onMessage={onMessage}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeDragId ? (
                  <div className="opacity-90 shadow-2xl rotate-2">
                    <ServerCard
                      server={sectionMachines.find((s) => s.id === activeDragId)!}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div
              className="text-text-tertiary py-8 text-center"
              data-testid={`empty-section-${type}s`}
            >
              No {type}s registered.{' '}
              <Link
                to="/discovery"
                className="text-status-info hover:text-status-info/80 transition-colors"
              >
                Discover devices
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

### Task 5: Extend Preferences Types

**File:** `frontend/src/types/preferences.ts`

```typescript
// Existing types...

export interface SectionCardOrder {
  servers: string[];
  workstations: string[];
}

export interface SectionCardOrderResponse {
  servers: string[];
  workstations: string[];
}

export interface CollapsedSectionsResponse {
  collapsed: string[];
}
```

### Task 6: Extend Preferences API Client

**File:** `frontend/src/api/preferences.ts`

```typescript
// Existing imports and functions...

export async function saveSectionOrder(
  order: SectionCardOrder
): Promise<CardOrderSaveResponse> {
  return api.put<CardOrderSaveResponse>('/api/v1/preferences/section-order', order);
}

export async function getSectionOrder(): Promise<SectionCardOrderResponse> {
  return api.get<SectionCardOrderResponse>('/api/v1/preferences/section-order');
}

export async function saveCollapsedSections(
  collapsed: string[]
): Promise<CardOrderSaveResponse> {
  return api.put<CardOrderSaveResponse>('/api/v1/preferences/collapsed-sections', {
    collapsed,
  });
}

export async function getCollapsedSections(): Promise<CollapsedSectionsResponse> {
  return api.get<CollapsedSectionsResponse>('/api/v1/preferences/collapsed-sections');
}
```

### Task 7: Refactor Dashboard

**Key changes to `Dashboard.tsx`:**

1. Replace single `servers` state with `serverOrder` and `workstationOrder`
2. Add `collapsedSections` state
3. Replace single `DndContext` with two `MachineSection` components
4. Update order reconciliation to handle per-section orders
5. Update save handlers to use new API endpoints

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | All machines are servers | Workstations section shows empty message | Task 4 |
| 2 | All machines are workstations | Servers section shows empty message | Task 4 |
| 3 | Machine type changed | Card moves on next data refresh | Task 7 |
| 4 | Section collapsed, new machine added | Count updates, card visible when expanded | Task 7 |
| 5 | Drag to collapsed section | Not possible (section not visible) | N/A |
| 6 | Both sections collapsed | Just headers visible | Task 4 |
| 7 | Click header while dragging | Drag cancelled first | Task 4 |
| 8 | 0 online, 0 offline | Header shows "(0 online, 0 offline)" | Task 4 |

**Coverage:** 8/8 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing card order | Users lose saved order | Migration: convert flat order to section order on first load |
| Performance with many machines | Slow render | Virtualization if >50 machines per section |
| Cross-section drop attempts | Confusing UX | Clear visual feedback via separate DndContext |

---

## Definition of Done

- [ ] Section headers display with correct counts
- [ ] Servers section appears before Workstations
- [ ] Drag-and-drop works within each section
- [ ] Cross-section drag is prevented
- [ ] Sections collapse/expand on header click
- [ ] Collapse state persists after refresh
- [ ] Empty section shows message with discovery link
- [ ] Backend tests pass (section order + collapse endpoints)
- [ ] Frontend tests pass (MachineSection + Dashboard)
- [ ] No linting errors
- [ ] All existing dashboard tests still pass

---

## Test Strategy

See [TS0132: Server and Workstation Grouping](../test-specs/TS0132-server-workstation-grouping.md)

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial plan creation |
