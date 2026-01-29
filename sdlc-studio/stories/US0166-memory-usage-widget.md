# US0166: Memory Usage Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a memory usage widget
**So that** I can monitor RAM utilisation on my machines

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Needs memory monitoring for capacity planning.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
Memory usage is critical for detecting resource exhaustion. This widget shows current and historical RAM usage with breakdown when available.

---

## Acceptance Criteria

### AC1: Memory gauge display
- **Given** I am viewing a machine's detail page
- **When** the Memory widget is visible
- **Then** it displays used/total memory in GB (e.g., "6.2 GB / 16 GB")
- **And** a circular gauge or bar shows the percentage used

### AC2: Historical chart
- **Given** the Memory widget is visible
- **When** I view the widget
- **Then** a line chart shows memory usage for the last hour

### AC3: Memory breakdown
- **Given** the Memory widget is visible
- **And** breakdown data is available
- **When** I view the widget
- **Then** it shows used, cached, and buffers separately

### AC4: Colour-coded thresholds
- **Given** the Memory widget displays current usage
- **When** usage exceeds threshold
- **Then** the indicator colour changes (green → amber → red)

---

## Scope

### In Scope
- Widget ID: `memory_gauge`
- Gauge visualisation (used/total)
- Historical line chart
- Memory breakdown (used, cached, buffers)
- Colour-coded thresholds
- Minimum size: 4x3

### Out of Scope
- Swap usage (future enhancement)
- Per-process memory breakdown

---

## Technical Notes

Widget component structure mirrors CPU widget with memory-specific data fetching.

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No memory metrics | Show "No data" message |
| 2 | Breakdown not available | Show only total used/free |
| 3 | Machine offline | Show last known value |
| 4 | Very high usage (>95%) | Prominent red indicator |
| 5 | Zero memory reported | Show error, likely agent issue |

---

## Test Scenarios

- [x] Widget displays used/total memory
- [x] Gauge shows correct percentage
- [ ] Breakdown shows when available (not yet implemented - needs agent enhancement)
- [x] Historical chart renders correctly
- [x] Colour thresholds work correctly

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Implemented |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Similar to CPU widget

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0139) |
| 2026-01-28 | Claude | Implementation complete: MemoryWidget with gauge, used/total display, chart, time range selector |
