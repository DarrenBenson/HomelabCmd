# US0165: CPU Usage Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a CPU usage widget
**So that** I can monitor processor load on my machines

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Needs at-a-glance CPU monitoring.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
CPU usage is a core metric for server health. This widget displays current and historical CPU utilisation with colour-coded thresholds.

---

## Acceptance Criteria

### AC1: Current CPU display
- **Given** I am viewing a machine's detail page
- **When** the CPU widget is visible
- **Then** it displays the current CPU percentage as a gauge or bar
- **And** it shows the CPU model and core count

### AC2: Historical chart
- **Given** the CPU widget is visible
- **When** I view the widget
- **Then** a line chart shows CPU usage for the selected time range
- **And** the default time range is 1 hour

### AC3: Time range selection
- **Given** the CPU widget is visible
- **When** I select a time range (1h, 6h, 24h)
- **Then** the chart updates to show data for that period

### AC4: Colour-coded thresholds
- **Given** the CPU widget displays current usage
- **When** usage is <50%
- **Then** the indicator is green
- **When** usage is 50-80%
- **Then** the indicator is amber
- **When** usage is >80%
- **Then** the indicator is red

### AC5: Auto-refresh
- **Given** the CPU widget is visible
- **When** 60 seconds elapse
- **Then** the widget refreshes with current data

---

## Scope

### In Scope
- Widget ID: `cpu_chart`
- Gauge/bar visualisation
- Historical line chart
- Time range selector
- Colour-coded thresholds
- Auto-refresh (60s interval)
- Minimum size: 4x3

### Out of Scope
- Per-core breakdown (future enhancement)
- CPU temperature (requires agent enhancement)

---

## Technical Notes

```tsx
function CpuWidget({ machine, width, height }) {
  const { data: metrics } = useQuery(
    ['metrics', machine.id, 'cpu'],
    () => fetchCpuMetrics(machine.id),
    { refetchInterval: 60000 }
  );

  const colour = metrics.current < 50 ? 'green' :
                 metrics.current < 80 ? 'amber' : 'red';

  return (
    <Widget title="CPU Usage" icon={<CpuIcon />}>
      <div className="flex items-center gap-4">
        <GaugeChart value={metrics.current} max={100} colour={colour} />
        <div>
          <p className="text-2xl font-bold">{metrics.current}%</p>
          <p className="text-sm text-gray-400">{machine.cpu_model}</p>
          <p className="text-sm text-gray-400">{machine.cpu_cores} cores</p>
        </div>
      </div>
      <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      <LineChart data={metrics.history} height={height - 120} />
    </Widget>
  );
}
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No CPU metrics available | Show "No data" message |
| 2 | Machine offline | Show last known value with "stale" indicator |
| 3 | API timeout | Retry after 5s, show loading state |
| 4 | Historical data gaps | Chart shows gaps, not interpolated |
| 5 | Widget resized smaller than 4x3 | Enforce minimum size |

---

## Test Scenarios

- [x] Widget displays current CPU percentage
- [x] Gauge shows correct colour for threshold
- [x] Line chart renders historical data
- [x] Time range selector changes chart data
- [x] Widget auto-refreshes every 60 seconds
- [x] Offline machine shows stale indicator

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Implemented |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Metrics API | Backend | Exists |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Chart integration, threshold logic

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0138) |
| 2026-01-28 | Claude | Implementation complete: CpuWidget with gauge, chart, time range selector, auto-refresh |
