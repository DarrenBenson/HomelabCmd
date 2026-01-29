# EP0012: Widget-Based Detail View

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-26
> **Target Release:** Phase 2 (Beta)
> **Story Points:** 53

---

## Overview

Transform machine detail pages from static layouts into customisable widget grids. Users can arrange, resize, and configure widgets to create personalised monitoring views for each machine. Inspired by OMV's dashboard, but specific to each machine's needs.

**Key Concept:** Like a personalised mission control for each machine. Drag, resize, customise.

---

## Goals

### Primary Goals
- Replace static detail page with widget grid
- Implement 8 core widget types (CPU, memory, load, disk, services, containers, network, system info)
- Enable drag-and-drop widget arrangement
- Enable widget resizing
- Persist layouts per machine
- Provide sensible default layout

### Success Criteria
- Detail page shows customisable widget grid
- Users can drag widgets to new positions
- Users can resize widgets
- Layout persists after page refresh
- Each machine can have different layout
- Default layout works well out-of-the-box

---

## User Stories

### US0137: Widget Grid System
**Story Points:** 8
**Priority:** P0
**Dependencies:** None

**As a** system administrator
**I want** machine detail pages to use a widget grid layout
**So that** I can customise how information is displayed

**Acceptance Criteria:**
- [ ] Detail page uses react-grid-layout for widget container
- [ ] Grid is 12 columns wide (standard responsive grid)
- [ ] Grid rows are auto-sized based on content
- [ ] Widgets can occupy multiple columns and rows
- [ ] Grid has gutter spacing between widgets
- [ ] Grid fills available viewport height
- [ ] Responsive: fewer columns on smaller screens

**Technical Notes:**
- react-grid-layout implementation:
  ```tsx
  import GridLayout from 'react-grid-layout';
  import 'react-grid-layout/css/styles.css';
  import 'react-resizable/css/styles.css';

  function MachineDetailPage({ machine }) {
    const [layout, setLayout] = useState<Layout[]>(defaultLayout);

    return (
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={100}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-header"
        isResizable={true}
        isDraggable={true}
      >
        {layout.map(item => (
          <div key={item.i} className="widget">
            <WidgetRenderer widgetId={item.i} machine={machine} />
          </div>
        ))}
      </GridLayout>
    );
  }
  ```

**Grid Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ HOMESERVER - Detail View              [Edit Layout] [Save] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────┐ ┌─────────────────────────┐  │
│  │     CPU Usage (4x3)     │ │   Memory Usage (4x3)    │  │
│  │                         │ │                         │  │
│  │     ████████░░ 75%      │ │     6.2 GB / 16 GB     │  │
│  └─────────────────────────┘ └─────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────┐ ┌─────────────────────────┐  │
│  │   Load Average (4x2)    │ │   Disk Usage (4x2)      │  │
│  │   1.2  1.5  1.8        │ │   67% /  45% /data     │  │
│  └─────────────────────────┘ └─────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Services (8x4)                          │  │
│  │  smbd: 🟢  docker: 🟢  ssh: 🟢  cron: 🟢          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### US0138: CPU Usage Widget
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** a CPU usage widget
**So that** I can monitor processor load

**Acceptance Criteria:**
- [ ] Widget ID: `cpu_chart`
- [ ] Displays current CPU percentage as gauge or bar
- [ ] Shows historical CPU usage as line chart (last 1 hour)
- [ ] Time range selectable: 1h, 6h, 24h
- [ ] Displays CPU model and core count
- [ ] Colour-coded: green (<50%), amber (50-80%), red (>80%)
- [ ] Refreshes every 60 seconds
- [ ] Minimum size: 4x3

**Technical Notes:**
- Widget component:
  ```tsx
  function CpuWidget({ machine, width, height }) {
    const { data: metrics } = useQuery(['metrics', machine.id, 'cpu'], fetchCpuMetrics);

    return (
      <Widget title="CPU Usage" icon={<CpuIcon />}>
        <div className="flex items-center gap-4">
          <GaugeChart value={metrics.current} max={100} />
          <div>
            <p className="text-2xl font-bold">{metrics.current}%</p>
            <p className="text-sm text-gray-400">{machine.cpu_model}</p>
            <p className="text-sm text-gray-400">{machine.cpu_cores} cores</p>
          </div>
        </div>
        <LineChart data={metrics.history} height={height - 120} />
      </Widget>
    );
  }
  ```

---

### US0139: Memory Usage Widget
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** a memory usage widget
**So that** I can monitor RAM utilisation

**Acceptance Criteria:**
- [ ] Widget ID: `memory_gauge`
- [ ] Displays used/total memory in GB
- [ ] Circular gauge or bar visualisation
- [ ] Historical memory chart (last 1 hour)
- [ ] Shows memory breakdown if available (used, cached, buffers)
- [ ] Colour-coded thresholds
- [ ] Minimum size: 4x3

---

### US0140: Load Average Widget
**Story Points:** 2
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** a load average widget
**So that** I can see system load trends

**Acceptance Criteria:**
- [ ] Widget ID: `load_average`
- [ ] Displays 1min, 5min, 15min load averages
- [ ] Relative to CPU cores (show as percentage of capacity)
- [ ] Historical trend line
- [ ] Colour indicates if load exceeds core count
- [ ] Minimum size: 4x2

---

### US0141: Disk Usage Widget
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** a disk usage widget
**So that** I can monitor storage capacity

**Acceptance Criteria:**
- [ ] Widget ID: `disk_usage`
- [ ] Displays all mounted filesystems
- [ ] Shows used/total and percentage for each
- [ ] Progress bars with colour coding
- [ ] Sortable by usage or mount point
- [ ] Expandable to show more details
- [ ] Minimum size: 4x3

---

### US0142: Services Widget
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** a services widget
**So that** I can see systemd service status

**Acceptance Criteria:**
- [ ] Widget ID: `services`
- [ ] Lists all expected services for machine
- [ ] Shows status: running (green), stopped (red), unknown (grey)
- [ ] Quick action: restart service button
- [ ] Filter: show all / show expected only
- [ ] Sortable by name or status
- [ ] Minimum size: 4x4

---

### US0144: Network Widget
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0137

**As a** system administrator
**I want** a network widget
**So that** I can see network traffic

**Acceptance Criteria:**
- [ ] Widget ID: `network`
- [ ] Displays RX/TX bytes (human-readable: KB/s, MB/s)
- [ ] Historical traffic chart
- [ ] Shows network interfaces (eth0, wlan0, tailscale0)
- [ ] Per-interface breakdown available
- [ ] Minimum size: 4x3

---

### US0145: System Info Widget
**Story Points:** 2
**Priority:** P1
**Dependencies:** US0137

**As a** system administrator
**I want** a system info widget
**So that** I can see machine details at a glance

**Acceptance Criteria:**
- [ ] Widget ID: `system_info`
- [ ] Displays: hostname, OS, kernel version, architecture
- [ ] Shows: uptime, last boot time
- [ ] Shows: IP address, Tailscale hostname
- [ ] Shows: machine type (server/workstation)
- [ ] Static widget (no charts)
- [ ] Minimum size: 3x2

---

### US0146: Widget Layout Persistence
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** my widget layout saved per machine
**So that** each machine can have a different arrangement

**Acceptance Criteria:**
- [ ] API endpoint: `GET /api/v1/machines/{id}/layout`
- [ ] API endpoint: `PUT /api/v1/machines/{id}/layout`
- [ ] Layout stored as react-grid-layout format (JSON)
- [ ] Layout saved automatically on change (debounced)
- [ ] Layout loaded on page mount
- [ ] Each machine has independent layout
- [ ] Reset to default button available

**Technical Notes:**
- WidgetLayout model:
  ```python
  class WidgetLayout(Base):
      id = Column(Integer, primary_key=True)
      machine_id = Column(String, ForeignKey('machine.id'), unique=True)
      layout_data = Column(JSON)  # react-grid-layout format
      updated_at = Column(DateTime, default=datetime.utcnow)
  ```

- Layout format:
  ```json
  {
    "lg": [
      {"i": "cpu_chart", "x": 0, "y": 0, "w": 4, "h": 3},
      {"i": "memory_gauge", "x": 4, "y": 0, "w": 4, "h": 3},
      {"i": "services", "x": 0, "y": 3, "w": 8, "h": 4}
    ],
    "md": [...],
    "sm": [...]
  }
  ```

---

### US0147: Default Widget Layout
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0137

**As a** system administrator
**I want** new machines to have a sensible default layout
**So that** the detail page is immediately useful

**Acceptance Criteria:**
- [ ] Default layout defined in code
- [ ] Applied when no custom layout exists
- [ ] Different defaults for servers vs workstations
- [ ] Server default: CPU, memory, disk, services, network, system info
- [ ] Workstation default: CPU, memory, disk, system info (no services widget)
- [ ] Docker widget included if Docker detected
- [ ] Layout optimised for common screen sizes

**Technical Notes:**
- Default layouts:
  ```typescript
  const serverDefaultLayout = [
    { i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 },
    { i: 'memory_gauge', x: 6, y: 0, w: 6, h: 3 },
    { i: 'load_average', x: 0, y: 3, w: 4, h: 2 },
    { i: 'disk_usage', x: 4, y: 3, w: 4, h: 3 },
    { i: 'network', x: 8, y: 3, w: 4, h: 3 },
    { i: 'services', x: 0, y: 6, w: 6, h: 4 },
    { i: 'system_info', x: 6, y: 6, w: 6, h: 2 },
  ];

  const workstationDefaultLayout = [
    { i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 },
    { i: 'memory_gauge', x: 6, y: 0, w: 6, h: 3 },
    { i: 'disk_usage', x: 0, y: 3, w: 6, h: 3 },
    { i: 'system_info', x: 6, y: 3, w: 6, h: 2 },
  ];
  ```

---

### US0148: Edit Layout Mode
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0146

**As a** system administrator
**I want** an explicit "Edit Layout" mode
**So that** I don't accidentally move widgets

**Acceptance Criteria:**
- [ ] "Edit Layout" button toggles edit mode
- [ ] In edit mode: widgets draggable and resizable
- [ ] In view mode: widgets locked in place
- [ ] Edit mode shows resize handles on widgets
- [ ] Edit mode shows grid lines as guide
- [ ] "Save" and "Cancel" buttons in edit mode
- [ ] Cancel reverts to last saved layout
- [ ] Visual indication when in edit mode (border, overlay)

---

### US0149: Widget Visibility Toggle
**Story Points:** 3
**Priority:** P2
**Dependencies:** US0148

**As a** system administrator
**I want** to show/hide widgets
**So that** I only see relevant information

**Acceptance Criteria:**
- [ ] "Add Widget" button shows available widgets
- [ ] Can add widgets not currently in layout
- [ ] Can remove widgets from layout (hide, not delete)
- [ ] Hidden widgets available in "Add Widget" menu
- [ ] Removing widget saves layout automatically
- [ ] Widgets not applicable to machine are greyed out (e.g., containers without Docker)

---

### US0150: Responsive Widget Layout
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0137

**As a** system administrator
**I want** widgets to reflow on smaller screens
**So that** the detail page works on mobile

**Acceptance Criteria:**
- [ ] Desktop (>1200px): 12 columns
- [ ] Tablet (768-1200px): 6 columns
- [ ] Mobile (<768px): 1 column (stacked)
- [ ] Widgets maintain minimum sizes
- [ ] Layout breakpoints configurable
- [ ] Touch-friendly on mobile (scroll instead of drag)

---

## Technical Architecture

### Widget Registry

```typescript
const widgetRegistry = {
  cpu_chart: {
    component: CpuWidget,
    title: 'CPU Usage',
    icon: CpuIcon,
    minW: 4, minH: 3,
    defaultW: 6, defaultH: 3,
    applicableTo: ['server', 'workstation'],
  },
  memory_gauge: {
    component: MemoryWidget,
    title: 'Memory Usage',
    icon: MemoryIcon,
    minW: 4, minH: 3,
    defaultW: 6, defaultH: 3,
    applicableTo: ['server', 'workstation'],
  },
  containers: {
    component: ContainersWidget,
    title: 'Docker Containers',
    icon: ContainerIcon,
    minW: 6, minH: 4,
    defaultW: 8, defaultH: 4,
    applicableTo: ['server', 'workstation'],
    requiresFeature: 'docker',  // Only show if Docker detected
  },
  // ... etc
};
```

### Data Model

**WidgetLayout Table:**
```sql
CREATE TABLE widget_layout (
  id INTEGER PRIMARY KEY,
  machine_id TEXT REFERENCES machine(id) UNIQUE,
  layout_data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Dependencies

**Frontend:**
- `react-grid-layout` (new) - Grid layout system
- `react-resizable` (peer dependency of react-grid-layout)

**Backend:**
- No new libraries

---

## Testing Strategy

### Unit Tests
- Widget components render correctly
- Layout manipulation functions
- Widget registry lookup

### Integration Tests
- Layout save/load cycle
- Default layout generation
- Widget data fetching

### E2E Tests
- Navigate to detail page → see widgets
- Drag widget to new position → verify saved
- Resize widget → verify saved
- Edit mode toggle → verify drag enabled/disabled
- Responsive layout at breakpoints

---

## Story Breakdown

| Story | Description | Points | Priority | Status |
|-------|-------------|--------|----------|--------|
| [US0164](../stories/US0164-widget-grid-system.md) | Widget Grid System | 8 | P0 | Done |
| [US0165](../stories/US0165-cpu-usage-widget.md) | CPU Usage Widget | 3 | P0 | Done |
| [US0166](../stories/US0166-memory-usage-widget.md) | Memory Usage Widget | 3 | P0 | Done |
| [US0167](../stories/US0167-load-average-widget.md) | Load Average Widget | 2 | P0 | Done |
| [US0168](../stories/US0168-disk-usage-widget.md) | Disk Usage Widget | 3 | P0 | Done |
| [US0169](../stories/US0169-services-widget.md) | Services Widget | 3 | P0 | Done |
| [US0171](../stories/US0171-network-widget.md) | Network Widget | 3 | P1 | Done |
| [US0172](../stories/US0172-system-info-widget.md) | System Info Widget | 2 | P1 | Done |
| [US0173](../stories/US0173-widget-layout-persistence.md) | Widget Layout Persistence | 5 | P0 | Done |
| [US0174](../stories/US0174-default-widget-layout.md) | Default Widget Layout | 3 | P0 | Done |
| [US0175](../stories/US0175-edit-layout-mode.md) | Edit Layout Mode | 3 | P1 | Done |
| [US0176](../stories/US0176-widget-visibility-toggle.md) | Widget Visibility Toggle | 3 | P2 | Done |
| [US0177](../stories/US0177-responsive-widget-layout.md) | Responsive Widget Layout | 3 | P1 | Done |
| [US0178](../stories/US0178-per-filesystem-metrics-api.md) | Per-Filesystem Metrics API | 5 | P1 | Done |
| [US0179](../stories/US0179-per-interface-network-metrics-api.md) | Per-Interface Network Metrics API | 5 | P1 | Done |
| **Total** | | **53** | | **15/15 Done** |

---

**Created:** 2026-01-26
**Last Updated:** 2026-01-29
**Epic Owner:** Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Darren | Initial epic creation |
| 2026-01-28 | Claude | Renumbered stories US0109-US0122 to US0137-US0150 to resolve conflicts with EP0017/EP0010 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-28 | Claude | Renumbered stories US0137-US0150 to US0164-US0177 to resolve conflict with EP0011. Story files generated. |
| 2026-01-29 | Claude | Removed US0170 (Containers Widget) - duplicate of US0159 in EP0014. |
| 2026-01-29 | Claude | Added US0178 (Per-Filesystem Metrics API) and US0179 (Per-Interface Network Metrics API) to complete US0168/US0171. 15 stories, 53 points. |
| 2026-01-29 | Claude | Epic complete: All 15 stories Done. Widget grid with drag/resize, 8 widget types, layout persistence, responsive design, per-filesystem and per-interface metrics. |
