# PL0164: Widget Grid System Implementation Plan

> **Story:** [US0164: Widget Grid System](../stories/US0164-widget-grid-system.md)
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Status:** Complete
> **Created:** 2026-01-28

---

## Overview

Implement react-grid-layout as the foundation for customisable machine detail pages. This is the foundation story for EP0012 - all widget stories depend on this grid system.

---

## Implementation Approach

### Phase 1: Install Dependencies

Install react-grid-layout and its peer dependency react-resizable:

```bash
cd frontend && npm install react-grid-layout react-resizable
npm install -D @types/react-grid-layout @types/react-resizable
```

### Phase 2: Create Widget Grid Infrastructure

**New files to create:**

1. `frontend/src/components/widgets/WidgetGrid.tsx` - Main grid container component
2. `frontend/src/components/widgets/WidgetContainer.tsx` - Individual widget wrapper with header
3. `frontend/src/components/widgets/types.ts` - Widget type definitions
4. `frontend/src/components/widgets/index.ts` - Barrel export

### Phase 3: Implement WidgetGrid Component

The WidgetGrid component wraps react-grid-layout with:

- 12-column desktop layout (responsive breakpoints)
- Consistent gutter spacing (16px)
- Viewport height management
- Draggable handle on widget headers
- Responsive column configuration

```tsx
// Key implementation details
const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480 };
const cols = { lg: 12, md: 6, sm: 6, xs: 1 };
const rowHeight = 100;
const margin: [number, number] = [16, 16];
```

### Phase 4: Create WidgetContainer Component

Widget wrapper providing:

- Consistent card styling (bg-bg-secondary, border)
- Draggable header with title and icon
- Optional resize handles (visible in edit mode only - future story)
- Content area for widget-specific rendering

### Phase 5: Create Placeholder Widgets

For initial testing, create simple placeholder widgets that will be replaced by actual implementations in subsequent stories:

- PlaceholderWidget - Generic placeholder showing widget ID

### Phase 6: Integrate into ServerDetail

Modify `ServerDetail.tsx` to:

1. Import WidgetGrid and related components
2. Define initial static layout
3. Render existing content sections as widgets within the grid
4. Maintain backward compatibility - existing sections still render, just within grid

### Phase 7: CSS Integration

Import react-grid-layout CSS styles:

```tsx
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
```

Add custom CSS overrides for dark theme compatibility.

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/widgets/WidgetGrid.tsx` | Main responsive grid container |
| `frontend/src/components/widgets/WidgetContainer.tsx` | Individual widget card wrapper |
| `frontend/src/components/widgets/types.ts` | TypeScript types for widgets and layouts |
| `frontend/src/components/widgets/index.ts` | Barrel exports |
| `frontend/src/components/widgets/PlaceholderWidget.tsx` | Testing placeholder |

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/package.json` | Add react-grid-layout dependencies |
| `frontend/src/pages/ServerDetail.tsx` | Integrate WidgetGrid |
| `frontend/src/index.css` | Add react-grid-layout style overrides |

---

## Acceptance Criteria Mapping

| AC | Implementation |
|----|----------------|
| AC1: Grid layout container | WidgetGrid wraps content in ResponsiveGridLayout |
| AC2: Widget positioning | Layout items specify x, y, w, h coordinates |
| AC3: Viewport filling | CSS min-height: calc(100vh - header), overflow handling |
| AC4: Responsive columns | breakpoints and cols configuration |

---

## Technical Decisions

### Why react-grid-layout?

- Mature, well-tested library
- Built-in responsive support
- Supports drag-and-drop (future stories)
- Layout persistence format is simple JSON

### Grid Configuration

- **12 columns**: Standard responsive grid, familiar pattern
- **100px row height**: Reasonable default for metric widgets
- **16px gutters**: Consistent with existing card spacing

### Initial Layout Strategy

For this story, the layout is static (drag/resize disabled by default). Edit mode (US0175) will enable interactivity later.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| CSS conflicts with Tailwind | Use specific class overrides, test thoroughly |
| Performance with many widgets | Lazy load widget content, virtualise if needed |
| Breaking existing layout | Gradual migration, maintain existing sections |

---

## Testing Strategy

### Unit Tests
- WidgetGrid renders with correct columns
- WidgetContainer displays title and content
- Responsive breakpoints work correctly

### Integration Tests
- ServerDetail page loads with grid
- Widgets display in correct positions
- No console errors or warnings

---

## Dependencies

### Required Before Start
- None (foundation story)

### External Dependencies
- react-grid-layout ^1.5.0
- react-resizable ^3.0.0

---

## Estimation Breakdown

| Task | Effort |
|------|--------|
| Install dependencies | 0.5 pts |
| Create WidgetGrid component | 2 pts |
| Create WidgetContainer component | 1.5 pts |
| Create type definitions | 1 pt |
| Integrate into ServerDetail | 2 pts |
| Testing and refinement | 1 pt |
| **Total** | **8 pts** |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial plan creation |
