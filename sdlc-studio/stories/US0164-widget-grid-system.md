# US0164: Widget Grid System

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 8

## User Story

**As a** Darren (Homelab Operator)
**I want** machine detail pages to use a widget grid layout
**So that** I can customise how information is displayed

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab with mixed server and workstation devices. Values efficiency and customisation.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
Currently, machine detail pages have a fixed layout. This story introduces react-grid-layout to enable customisable widget positioning, forming the foundation for all other widget stories in EP0012.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| EP0012 | UX | Layout persists per machine | Grid state must be saveable |
| PRD | Performance | Page loads < 2s | Grid initialisation must be fast |

---

## Acceptance Criteria

### AC1: Grid layout container
- **Given** I navigate to a machine detail page
- **When** the page loads
- **Then** the content is rendered within a react-grid-layout container
- **And** the grid is 12 columns wide

### AC2: Widget positioning
- **Given** widgets are rendered in the grid
- **When** I view the layout
- **Then** widgets can occupy multiple columns and rows
- **And** there is consistent gutter spacing between widgets

### AC3: Viewport filling
- **Given** the grid container is rendered
- **When** I view the page
- **Then** the grid fills available viewport height
- **And** scrolling is enabled for overflow content

### AC4: Responsive columns
- **Given** I am viewing the grid on different screen sizes
- **When** the viewport width changes
- **Then** the number of columns adjusts (12 on desktop, 6 on tablet, 1 on mobile)

---

## Scope

### In Scope
- react-grid-layout integration
- 12-column responsive grid
- Widget container styling
- Gutter spacing configuration
- Viewport height management

### Out of Scope
- Individual widget implementations (separate stories)
- Layout persistence (US0173)
- Edit mode toggle (US0175)

---

## Technical Notes

```tsx
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480 };
const cols = { lg: 12, md: 6, sm: 6, xs: 1 };

function MachineDetailPage({ machine }) {
  const [layout, setLayout] = useState<Layout[]>(defaultLayout);

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={breakpoints}
      cols={cols}
      rowHeight={100}
      draggableHandle=".widget-header"
      isResizable={true}
      isDraggable={true}
    >
      {layout.map(item => (
        <div key={item.i} className="widget">
          <WidgetRenderer widgetId={item.i} machine={machine} />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
```

### Dependencies
- `react-grid-layout` (new package)
- `react-resizable` (peer dependency)

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No layout data available | Use default layout |
| 2 | Invalid layout JSON | Fall back to default, log error |
| 3 | Widget ID in layout not found | Skip widget, don't crash |
| 4 | Screen resize during drag | Cancel drag, reflow layout |
| 5 | Very small viewport | Single column, stacked widgets |

---

## Test Scenarios

- [ ] Grid renders with 12 columns on desktop
- [ ] Grid renders with 6 columns on tablet
- [ ] Grid renders with 1 column on mobile
- [ ] Widgets display with correct gutter spacing
- [ ] Grid fills viewport height
- [ ] Invalid layout falls back to default

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| None | - | Foundation story | - |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| react-grid-layout | Library | Not installed |

---

## Estimation

**Story Points:** 8
**Complexity:** High - New library integration, foundation for epic

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0137) |
| 2026-01-28 | Claude | Implementation complete: react-grid-layout v2 integration, widget components, view toggle in ServerDetail |
