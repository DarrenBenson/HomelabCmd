# PL0165: CPU Usage Widget Implementation Plan

> **Story:** [US0165: CPU Usage Widget](../stories/US0165-cpu-usage-widget.md)
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Status:** Complete
> **Created:** 2026-01-28

---

## Overview

Implement a CPU usage widget with gauge display, historical chart, time range selector (1h, 6h, 24h), and 60-second auto-refresh.

---

## Implementation Approach

### Phase 1: Create CpuWidget Component

**File:** `frontend/src/components/widgets/CpuWidget.tsx`

The widget will:
- Display current CPU percentage in a gauge with CPU-specific thresholds (<50% green, 50-80% amber, >80% red)
- Show CPU model name and core count
- Display a line chart with CPU history
- Include a compact time range selector
- Auto-refresh every 60 seconds using `refetchInterval`

### Phase 2: Data Fetching Strategy

The existing APIs provide:
- Sparkline API: `/api/v1/servers/{id}/metrics/sparkline` - supports 30m, 1h, 6h periods (single metric)
- Metrics History API: `/api/v1/servers/{id}/metrics` - supports 24h, 7d, 30d, 12m (all metrics)

For the CPU widget's time ranges (1h, 6h, 24h):
- 1h, 6h: Use sparkline API with `metric=cpu_percent`
- 24h: Use metrics history API, extract only `cpu_percent`

### Phase 3: Custom Gauge Thresholds

Create a `CpuGauge` subcomponent or inline the threshold logic:
- < 50%: Green (#4ADE80)
- 50-80%: Amber (#FBBF24)
- > 80%: Red (#F87171)

These differ from the standard Gauge thresholds (70/85).

### Phase 4: Widget Time Range Selector

Create a compact inline time range selector for 1h, 6h, 24h options within the widget.

### Phase 5: Auto-Refresh

Use React Query's `refetchInterval: 60000` to auto-refresh data.

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/widgets/CpuWidget.tsx` | CPU usage widget component |
| `frontend/src/components/widgets/CpuWidget.test.tsx` | Unit tests |

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/widgets/index.ts` | Export CpuWidget |
| `frontend/src/components/widgets/ServerDetailWidgetView.tsx` | Render CpuWidget in grid |
| `frontend/src/components/widgets/WidgetGrid.tsx` | Update default layouts |

---

## Acceptance Criteria Mapping

| AC | Implementation |
|----|----------------|
| AC1: Current CPU display | Gauge with percentage + CPU model/cores |
| AC2: Historical chart | Line chart with 1h default range |
| AC3: Time range selection | Inline selector (1h, 6h, 24h) |
| AC4: Colour-coded thresholds | Custom threshold logic (50/80) |
| AC5: Auto-refresh | refetchInterval: 60000 |

---

## Technical Decisions

### Why Custom Gauge Thresholds?

The story specifies different thresholds (50/80) than the existing Gauge (70/85). Rather than modifying the shared Gauge component, I'll implement threshold-specific styling inline in the CpuWidget.

### API Strategy

Using sparkline for 1h/6h gives better resolution. Using metrics history for 24h maintains consistency with existing dashboard patterns.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial plan creation |
