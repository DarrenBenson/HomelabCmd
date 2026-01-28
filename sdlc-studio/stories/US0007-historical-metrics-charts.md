# US0007: Historical Metrics and Charts

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to view historical metrics charts for each server
**So that** I can identify trends, diagnose issues, and plan capacity

## Context

### Persona Reference

**Darren** - Needs historical data for weekly reviews, capacity planning, and troubleshooting past incidents. Currently has no trend visibility.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The server detail view should include time-series charts showing CPU, RAM, and Disk usage over time. Users can select different time ranges (24h, 7d, 30d) to view trends. Charts help identify patterns like gradual disk fill, memory leaks, or recurring CPU spikes.

## Acceptance Criteria

### AC1: Charts display on server detail

- **Given** navigating to server detail view
- **When** the page loads
- **Then** time-series charts for CPU, RAM, and Disk are displayed

### AC2: Time range selection works

- **Given** charts are displayed
- **When** selecting "7d" time range
- **Then** charts update to show the last 7 days of data

### AC3: Charts render correctly for 30 days

- **Given** 30 days of historical data exists
- **When** selecting "30d" time range
- **Then** chart renders smoothly with appropriate data aggregation

### AC4: Hover shows data point details

- **Given** a chart is displayed
- **When** hovering over a data point
- **Then** tooltip shows timestamp and exact value

### AC5: API returns time-series data

- **Given** metrics exist for a server
- **When** requesting `/api/v1/metrics/{server_id}?range=7d`
- **Then** response contains time-series data points

## Scope

### In Scope

- Metrics history API endpoint
- Time-series charts (CPU, RAM, Disk)
- Time range selector (24h, 7d, 30d)
- Tooltip on hover
- Data aggregation for longer ranges
- Chart styling per brand guide

### Out of Scope

- Network I/O charts (deferred)
- Load average charts (deferred)
- Custom date range picker (future)
- Export data to CSV (future)
- Alert annotations on charts (EP0002)

## UI/UX Requirements

### Layout (Addition to Server Detail)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Previous detail view content...]                                       │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Historical Metrics                              [24h] [7d] [30d]   │  │
│  │                                                                    │  │
│  │  CPU Usage                                                         │  │
│  │  100% ┬───────────────────────────────────────────────────────┐   │  │
│  │       │                                           ╭─╮              │  │
│  │   50% ├─────────────────────────────────────╭────╯  ╰──────────┤   │  │
│  │       │  ╭──╮     ╭──╮                 ╭────╯                   │   │  │
│  │    0% ┴──╯  ╰─────╯  ╰─────────────────╯                       ┘   │  │
│  │       Mon   Tue   Wed   Thu   Fri   Sat   Sun                      │  │
│  │                                                                    │  │
│  │  RAM Usage                                                         │  │
│  │  100% ┬────────────────────────────────────────────────────────┐   │  │
│  │       │  ═══════════════════════════════════════════════════    │  │
│  │   50% ├                                                        ┤   │  │
│  │       │                                                          │  │
│  │    0% ┴────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  │  Disk Usage                                                        │  │
│  │  100% ┬────────────────────────────────────────────────────────┐   │  │
│  │       │                                                          │  │
│  │   50% ├  ─────────────────────────────────────────────────────  ┤   │  │
│  │       │                                                          │  │
│  │    0% ┴────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Chart Styling

- Chart library: Recharts
- Line colour: Terminal Cyan (#22D3EE)
- Fill: Gradient from Terminal Cyan to transparent
- Grid lines: Console Grey (#161B22)
- Axis labels: Soft White (#C9D1D9), JetBrains Mono 10px
- Tooltip: Deep Space background, white text
- Time range buttons: Ghost buttons, active state highlighted

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for colour specifications.

## Technical Notes

### API Contracts

**GET /api/v1/metrics/{server_id}**

Query parameters:
- `range`: "24h", "7d", "30d" (required)
- `metrics`: comma-separated list, default "cpu,memory,disk"

```json
Response 200:
{
  "server_id": "omv-mediaserver",
  "range": "7d",
  "resolution": "1h",
  "data_points": [
    {
      "timestamp": "2026-01-11T00:00:00Z",
      "cpu_percent": 23.5,
      "memory_percent": 67.2,
      "disk_percent": 45.0
    },
    {
      "timestamp": "2026-01-11T01:00:00Z",
      "cpu_percent": 25.1,
      "memory_percent": 68.0,
      "disk_percent": 45.0
    }
  ],
  "total_points": 168
}
```

### Data Aggregation

| Range | Resolution | Max Points |
|-------|------------|------------|
| 24h | 1 minute | 1440 |
| 7d | 1 hour (avg) | 168 |
| 30d | 4 hour (avg) | 180 |

**TRD Reference:** [§4 API Contracts - Metrics & History](../trd.md#4-api-contracts)

### Data Requirements

- Aggregate metrics using AVG for longer ranges
- Return null for gaps in data (chart handles gracefully)
- Consider downsampling on backend to avoid large payloads

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No historical data | Show "No data available for this period" message |
| Partial data (gaps) | Chart draws line segments, gaps visible |
| Very high data density | Backend aggregates; chart remains performant |
| Server recently added | Show available data, empty regions for missing |
| API request fails | Show error message, retry button |

## Test Scenarios

- [ ] Charts render with 24h of data
- [ ] Charts render with 7d of data (aggregated)
- [ ] Charts render with 30d of data (aggregated)
- [ ] Time range buttons switch data correctly
- [ ] Tooltip displays on hover with correct values
- [ ] Empty state displayed when no data
- [ ] Charts handle gaps in data gracefully
- [ ] Charts perform well with max data points
- [ ] API returns correct aggregation for each range

## Definition of Done


**Story-specific additions:**

- [ ] Charts render in <500ms
- [ ] Data aggregation tested for 30-day range
- [ ] Chart colours match brand guide
- [ ] Recharts properly typed with TypeScript

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Draft |
| US0006: Server Detail View | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - charting library integration, data aggregation

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
