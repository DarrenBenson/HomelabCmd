# US0047: 12-Month Trend Report View

> **Status:** Done
> **Epic:** [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Completed:** 2026-01-21

## User Story

**As a** Darren (Homelab Operator)
**I want** to view 12-month trend charts for my servers
**So that** I can plan hardware upgrades and spot long-term patterns

## Context

### Persona Reference

**Darren** - Wants to answer questions like "Is my NAS running out of disk space?" and "Should I add more RAM to my Plex server?"

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With tiered data retention (US0046), daily aggregates are available for 12 months. This story adds a "12m" option to the time range selector and updates the chart to display daily averages with appropriate formatting.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | Requires US0046 | Daily aggregates must exist |
| Scope | 12-month trends | New time range selector option |
| Design | Consistent chart UX | Extends existing MetricsChart component |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard < 2 seconds | Chart loads in < 3 seconds (AC6) |
| Design | Brand guide compliance | Chart styling per brand-guide.md |
| UX | Progressive data display | Shows partial data with message (AC3) |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: 12-month option appears in time range selector

- **Given** I am on a server detail page
- **When** I view the Historical Metrics section
- **Then** I see a "12m" button alongside 24h/7d/30d

### AC2: 12-month chart displays daily data

- **Given** daily aggregate data exists for a server
- **When** I select the 12m time range
- **Then** the chart displays daily averages over 12 months

### AC3: Chart handles partial data gracefully

- **Given** less than 12 months of data exists
- **When** I select the 12m time range
- **Then** the chart shows available data with appropriate message
- **And** "Building history... X months collected" appears

### AC4: X-axis shows monthly labels

- **Given** I am viewing the 12m chart
- **When** the chart renders
- **Then** X-axis shows month labels (Jan, Feb, Mar, etc.)

### AC5: Tooltip shows daily values

- **Given** I am viewing the 12m chart
- **When** I hover over a data point
- **Then** tooltip shows date and avg/min/max values

### AC6: Chart loads within acceptable time

- **Given** 12 months of daily data exists (~365 points)
- **When** I select the 12m time range
- **Then** the chart loads in under 3 seconds

## Scope

### In Scope

- Add "12m" to TimeRangeSelector component
- Update MetricsChart to handle daily aggregates
- Update API call to request 12-month data
- X-axis formatting for monthly view
- Tooltip updates to show avg/min/max
- Data coverage message for partial data

### Out of Scope

- Min/max range visualisation (shaded area) - future enhancement
- Comparison with previous year
- Server-to-server comparison

## UI/UX Requirements

### Time Range Selector

```
[ 24h ] [ 7d ] [ 30d ] [ 12m ]
```

### Chart Appearance

- X-axis: Monthly labels (Jan, Feb, Mar...)
- Y-axis: 0-100% (same as existing)
- Lines: Daily averages for CPU, RAM, Disk
- Data coverage message when < 12 months available

### Tooltip Content

```
15 Mar 2026

CPU: 45% (avg) | 12% - 89% (range)
Memory: 72% (avg) | 68% - 78% (range)
Disk: 34% (avg) | 34% - 35% (range)
```

## Technical Notes

### Frontend Changes

```typescript
// types/server.ts
export type TimeRange = '24h' | '7d' | '30d' | '12m';

// Add to MetricsChart
const RANGE_HOURS: Record<TimeRange, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
  '12m': 365 * 24,  // Add this
};
```

### API Response

For 12m range, API returns daily aggregates:

```json
{
  "server_id": "mediaserver",
  "range": "12m",
  "resolution": "1d",
  "data_points": [
    {
      "timestamp": "2025-01-18T00:00:00Z",
      "cpu_avg": 45.2,
      "cpu_min": 12.1,
      "cpu_max": 89.4,
      "memory_avg": 72.1,
      "memory_min": 68.3,
      "memory_max": 78.9,
      "disk_avg": 34.2,
      "disk_min": 34.0,
      "disk_max": 35.1
    }
  ]
}
```

### X-axis Formatting

```typescript
function formatTimestamp(timestamp: string, resolution: string): string {
  const date = new Date(timestamp);

  if (resolution === '1d') {
    // For 12m view, show month only or "15 Mar" format
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  }
  // ... existing logic
}
```

**TRD Reference:** [SS6 User Interface Specifications](../trd.md#6-user-interface-specifications)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No daily data yet | Show "No data available" message |
| < 30 days of data | Show data with "Building history..." message |
| Server offline for extended period | Gaps visible in chart |
| API timeout | Show error message with retry button |

## Test Cases

| ID | AC | Test Description | Expected Result |
|----|----|--------------------|-----------------|
| TC1 | AC1 | Navigate to server detail page | 12m button visible in time range selector |
| TC2 | AC2 | Select 12m with daily data present | Chart renders with daily averages |
| TC3 | AC3 | Select 12m with only 3 months data | Shows data with "Building history... 3 months collected" |
| TC4 | AC4 | View 12m chart | X-axis displays month labels (Jan, Feb, etc.) |
| TC5 | AC5 | Hover over data point in 12m view | Tooltip shows date, avg, min, max values |
| TC6 | AC6 | Load 12m chart with 365 data points | Chart renders in under 3 seconds |
| TC7 | Edge | Select 12m with no data | Displays "No data available" message |
| TC8 | Edge | Select 12m during API timeout | Error toast with retry button appears |

## Quality Checklist

### Code Quality

- [ ] TimeRangeSelector updated with 12m option
- [ ] MetricsChart handles daily aggregate format
- [ ] X-axis formatting tested for month labels
- [ ] Tooltip component displays avg/min/max

### Testing

- [ ] Unit tests for new time range handling
- [ ] Visual regression test for chart rendering
- [ ] Performance test with 365 data points
- [ ] Accessibility test for screen readers

### Documentation

- [ ] Component documentation updated
- [ ] API response format documented

## Ready Status Gate

| Gate | Criteria | Status |
|------|----------|--------|
| AC Coverage | All ACs have test cases | Pending |
| Constraints | Inherited constraints addressed | Pending |
| Dependencies | US0046 complete | Pending |
| Technical | Frontend changes defined | Done |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0046: Tiered Data Retention | Story | Draft |
| US0007: Historical Metrics Charts | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low - Extends existing chart components

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
