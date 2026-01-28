# EP0011: Advanced Dashboard UI

> **Status:** Draft
> **Owner:** Darren
> **Created:** 2026-01-26
> **Target Release:** Phase 2 (Beta)
> **Story Points:** 32

---

## Overview

Transform the HomelabCmd dashboard from a static grid into a customisable, drag-and-drop interface. Users can reorder machine cards, group servers and workstations visually, and persist their preferences across devices. The dashboard becomes a personalised command centre.

**Key Concept:** Your dashboard, your layout. Drag to reorder, settings sync everywhere.

---

## Goals

### Primary Goals
- Enable drag-and-drop reordering of machine cards
- Persist card order in backend database
- Group servers and workstations visually
- Provide responsive layout across screen sizes
- Sync preferences across devices/browsers

### Success Criteria
- Cards can be dragged and dropped to new positions
- Card order persists after page refresh
- Same order appears on desktop and mobile
- Server section and workstation section visually distinct
- Reordering takes <2 seconds including save

---

## User Stories

### US0130: Drag-and-Drop Card Reordering
**Story Points:** 8
**Priority:** P0
**Dependencies:** None

**As a** system administrator
**I want** to drag machine cards to reorder them
**So that** I can put the most important machines at the top

**Acceptance Criteria:**
- [ ] Cards show drag handle on hover
- [ ] Cards can be dragged to new positions
- [ ] Visual feedback during drag (card follows cursor, drop zone highlighted)
- [ ] Smooth animation when card drops into new position
- [ ] Order saved automatically after drop (debounced)
- [ ] Works with keyboard (accessibility): arrow keys + Enter to move
- [ ] Touch support for tablet/mobile

**Technical Notes:**
- Use @dnd-kit/core for drag-and-drop (better than react-beautiful-dnd for maintenance)
- Implementation:
  ```tsx
  import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
  import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

  function Dashboard() {
    const [machines, setMachines] = useState<Machine[]>([]);

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragEnd(event) {
      const { active, over } = event;
      if (active.id !== over.id) {
        setMachines((items) => {
          const oldIndex = items.findIndex(i => i.id === active.id);
          const newIndex = items.findIndex(i => i.id === over.id);
          const newOrder = arrayMove(items, oldIndex, newIndex);
          saveCardOrder(newOrder.map(m => m.id));  // Debounced API call
          return newOrder;
        });
      }
    }

    return (
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={machines} strategy={verticalListSortingStrategy}>
          {machines.map(machine => <MachineCard key={machine.id} machine={machine} />)}
        </SortableContext>
      </DndContext>
    );
  }
  ```

**Drag Handle UI:**
```
┌─────────────────────────────────────┐
│ ⋮⋮ 🟢 HOMESERVER                    │  ← Drag handle appears on hover
│    CPU: 15%  RAM: 45%  Disk: 67%   │
│    Online - Last seen: now          │
└─────────────────────────────────────┘
```

---

### US0131: Card Order Persistence
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0130

**As a** system administrator
**I want** my card order to be saved
**So that** it persists after refreshing the page

**Acceptance Criteria:**
- [ ] API endpoint: `PUT /api/v1/preferences/card-order`
- [ ] API endpoint: `GET /api/v1/preferences/card-order`
- [ ] Order saved as array of machine IDs
- [ ] Save triggered automatically after reorder (500ms debounce)
- [ ] Loading indicator during save
- [ ] Order loaded on dashboard mount
- [ ] New machines added to end of order
- [ ] Deleted machines removed from order automatically

**Technical Notes:**
- DashboardPreference model:
  ```python
  class DashboardPreference(Base):
      id = Column(Integer, primary_key=True)
      preference_key = Column(String, unique=True)  # "card_order"
      preference_value = Column(JSON)  # ["homeserver", "mediaserver", ...]
      updated_at = Column(DateTime, default=datetime.utcnow)
  ```

- API implementation:
  ```python
  @router.put("/preferences/card-order")
  async def save_card_order(order: List[str], db: Session = Depends(get_db)):
      pref = db.query(DashboardPreference).filter_by(preference_key="card_order").first()
      if pref:
          pref.preference_value = order
          pref.updated_at = datetime.utcnow()
      else:
          pref = DashboardPreference(preference_key="card_order", preference_value=order)
          db.add(pref)
      db.commit()
      return {"status": "saved"}
  ```

---

### US0132: Server and Workstation Grouping
**Story Points:** 5
**Priority:** P0
**Dependencies:** EP0009 (Workstation Management)

**As a** system administrator
**I want** servers and workstations grouped separately on the dashboard
**So that** I can quickly identify machine types

**Acceptance Criteria:**
- [ ] Dashboard has "Servers" section header
- [ ] Dashboard has "Workstations" section header
- [ ] Cards can only be reordered within their section (no cross-section drag)
- [ ] Section headers show count: "Servers (8 online, 1 offline)"
- [ ] Each section independently collapsible
- [ ] Collapse state persisted in preferences
- [ ] Empty section shows message: "No workstations registered"

**Technical Notes:**
- Section component:
  ```tsx
  function MachineSection({ title, type, machines, collapsed, onToggleCollapse }) {
    const sectionMachines = machines.filter(m => m.machine_type === type);
    const online = sectionMachines.filter(m => m.status === 'online').length;
    const offline = sectionMachines.length - online;

    return (
      <section className="mb-8">
        <header
          className="flex items-center gap-2 cursor-pointer"
          onClick={onToggleCollapse}
        >
          <ChevronIcon className={collapsed ? 'rotate-0' : 'rotate-90'} />
          <h2>{title} ({online} online, {offline} offline)</h2>
        </header>
        {!collapsed && (
          <SortableContext items={sectionMachines}>
            {sectionMachines.map(m => <MachineCard key={m.id} machine={m} />)}
          </SortableContext>
        )}
      </section>
    );
  }
  ```

**Dashboard Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  HomelabCmd Dashboard                    [+ Add Machine]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ▼ Servers (8 online, 1 offline)                           │
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │🟢 HOME   │ │🟢 MEDIA  │ │🟢 BACKUP │ │🔴 CLOUD  │      │
│  │SERVER    │ │SERVER    │ │SERVER    │ │SERVER1   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                            │
│  ▼ Workstations (1 online, 2 offline)                      │
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │🟢 Study  │ │⚪ Laptop │ │⚪ Gaming │                   │
│  │PC        │ │Pro       │ │PC        │                   │
│  │Online    │ │Last: 3h  │ │Last: 2d  │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### US0133: Responsive Dashboard Layout
**Story Points:** 5
**Priority:** P1
**Dependencies:** US0130

**As a** system administrator
**I want** the dashboard to work on different screen sizes
**So that** I can monitor my homelab from any device

**Acceptance Criteria:**
- [ ] Desktop (>1024px): 4 cards per row
- [ ] Tablet (768-1024px): 2-3 cards per row
- [ ] Mobile (<768px): 1 card per row, cards stack vertically
- [ ] Card order maintained across breakpoints
- [ ] Touch-friendly drag on mobile (long-press to activate)
- [ ] Section headers remain visible at top when scrolling
- [ ] Summary bar adapts to screen width

**Technical Notes:**
- CSS Grid implementation:
  ```css
  .machine-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(1, 1fr);
  }

  @media (min-width: 640px) {
    .machine-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .machine-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1280px) {
    .machine-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  ```

---

### US0134: Dashboard Summary Bar
**Story Points:** 3
**Priority:** P1
**Dependencies:** EP0009 (Workstation Management)

**As a** system administrator
**I want** to see a summary of all machine status at a glance
**So that** I immediately know the overall health

**Acceptance Criteria:**
- [ ] Summary bar at top of dashboard
- [ ] Shows: total machines, online count, offline servers, offline workstations
- [ ] Colour-coded indicators: green (all healthy), amber (warnings), red (critical)
- [ ] Quick actions: "Check All", "Refresh"
- [ ] Distinguishes server offline (critical) from workstation offline (normal)
- [ ] Clicking count filters to that status

**Technical Notes:**
- Summary bar component:
  ```tsx
  function SummaryBar({ machines }) {
    const servers = machines.filter(m => m.machine_type === 'server');
    const workstations = machines.filter(m => m.machine_type === 'workstation');

    const offlineServers = servers.filter(m => m.status === 'offline').length;
    const onlineWorkstations = workstations.filter(m => m.status === 'online').length;

    return (
      <div className="flex gap-4 p-4 bg-gray-800 rounded">
        <Stat label="Total" value={machines.length} />
        <Stat label="Online" value={servers.filter(m => m.status === 'online').length + onlineWorkstations} color="green" />
        {offlineServers > 0 && (
          <Stat label="Servers Offline" value={offlineServers} color="red" icon="alert" />
        )}
        <Stat label="Workstations" value={`${onlineWorkstations}/${workstations.length}`} color="blue" />
      </div>
    );
  }
  ```

**Summary Bar Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ 🖥️ 13 Machines  │  🟢 10 Online  │  🔴 1 Server Offline  │  💻 2/4 Workstations  │  [Refresh]
└────────────────────────────────────────────────────────────────────┘
```

---

### US0135: Card Visual Enhancements
**Story Points:** 3
**Priority:** P1
**Dependencies:** EP0009 (Workstation Management)

**As a** system administrator
**I want** server and workstation cards to look distinct
**So that** I can identify machine types at a glance

**Acceptance Criteria:**
- [ ] Server cards: blue accent border, 🖥️ Server icon
- [ ] Workstation cards: purple accent border, 💻 Workstation icon
- [ ] Offline workstations: grey dot (not red), dashed border
- [ ] Offline servers: red dot, solid border, alert indicator
- [ ] Hover state shows "Server" or "Workstation" tooltip
- [ ] Machine type badge in card header
- [ ] Consistent with design system (phosphor palette)

**Technical Notes:**
- Card styling:
  ```tsx
  const cardStyles = {
    server: {
      border: 'border-l-4 border-blue-500',
      icon: <ServerIcon />,
      offlineIndicator: 'bg-red-500',
    },
    workstation: {
      border: 'border-l-4 border-purple-500',
      icon: <MonitorIcon />,
      offlineIndicator: 'bg-gray-400',
      offlineBorder: 'border-dashed',
    },
  };
  ```

---

### US0136: Dashboard Preferences Sync
**Story Points:** 3
**Priority:** P2
**Dependencies:** US0131, US0132

**As a** system administrator
**I want** my dashboard preferences to sync across devices
**So that** I see the same layout on my phone and laptop

**Acceptance Criteria:**
- [ ] All preferences stored in backend database
- [ ] Preferences loaded on page load
- [ ] Changes saved immediately (debounced)
- [ ] Preferences include: card order, collapsed sections, view mode
- [ ] Conflict resolution: last-write-wins (simple for single user)
- [ ] Loading state while preferences sync
- [ ] Fallback to defaults if preferences fail to load

**Technical Notes:**
- Preference structure:
  ```json
  {
    "card_order": ["homeserver", "mediaserver", "studypc", ...],
    "collapsed_sections": ["workstations"],
    "view_mode": "grid"  // or "list" in future
  }
  ```

---

## Technical Architecture

### Data Model

**DashboardPreference Table:**
```sql
CREATE TABLE dashboard_preference (
  id INTEGER PRIMARY KEY,
  preference_key TEXT UNIQUE NOT NULL,
  preference_value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

```
GET    /api/v1/preferences/card-order      # Get card order
PUT    /api/v1/preferences/card-order      # Save card order
GET    /api/v1/preferences/dashboard       # Get all dashboard preferences
PUT    /api/v1/preferences/dashboard       # Save all dashboard preferences
```

---

## Dependencies

**Frontend:**
- `@dnd-kit/core` (new) - Drag-and-drop framework
- `@dnd-kit/sortable` (new) - Sortable lists
- `@dnd-kit/utilities` (new) - Utilities

**Backend:**
- No new libraries

---

## Testing Strategy

### Unit Tests
- Preference save/load logic
- Card order array manipulation
- Section grouping logic

### Integration Tests
- Preference API endpoints
- Card order persistence cycle

### E2E Tests
- Drag card to new position → verify order saved
- Refresh page → verify order maintained
- Collapse section → verify state persisted
- Responsive layout at different breakpoints

---

## Story Breakdown

| Story | Description | Points | Priority |
|-------|-------------|--------|----------|
| US0130 | Drag-and-Drop Card Reordering | 8 | P0 |
| US0131 | Card Order Persistence | 5 | P0 |
| US0132 | Server and Workstation Grouping | 5 | P0 |
| US0133 | Responsive Dashboard Layout | 5 | P1 |
| US0134 | Dashboard Summary Bar | 3 | P1 |
| US0135 | Card Visual Enhancements | 3 | P1 |
| US0136 | Dashboard Preferences Sync | 3 | P2 |
| **Total** | | **32** | |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Darren | Initial epic creation |
| 2026-01-28 | Claude | Renumbered stories US0102-US0108 to US0130-US0136 to resolve conflict with EP0016 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |

---

**Created:** 2026-01-26
**Last Updated:** 2026-01-26
**Epic Owner:** Darren
