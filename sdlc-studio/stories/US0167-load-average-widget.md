# US0167: Load Average Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** a load average widget
**So that** I can see system load trends relative to CPU capacity

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Uses load average for capacity analysis.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Load average display
- **Given** the Load Average widget is visible
- **When** I view the widget
- **Then** it displays 1min, 5min, and 15min load averages

### AC2: Relative to cores
- **Given** the load average is displayed
- **When** I view the values
- **Then** each value shows as percentage of CPU core count (e.g., "1.5 / 4 cores = 38%")

### AC3: Historical trend
- **Given** the widget is visible
- **When** I view the widget
- **Then** a trend line shows load over time

### AC4: Overload indication
- **Given** the load average exceeds core count
- **When** I view the widget
- **Then** the values are highlighted in red/amber

---

## Scope

### In Scope
- Widget ID: `load_average`
- 1min, 5min, 15min display
- Relative to core count
- Historical trend line
- Overload colour indication
- Minimum size: 4x2

### Out of Scope
- Per-process load breakdown

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Load data not available | Show "No data" |
| 2 | Core count unknown | Show raw values without percentage |
| 3 | Load > 2x cores | Show critical red indicator |
| 4 | Windows machine | Widget hidden (no load average) |

---

## Test Scenarios

- [x] Widget displays three load values
- [x] Percentage calculated correctly from core count
- [x] Overload highlighted appropriately
- [x] Trend line renders

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Implemented |

---

## Estimation

**Story Points:** 2
**Complexity:** Low - Simple data display

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0140) |
| 2026-01-28 | Claude | Implementation complete: Enhanced with core % display, colour thresholds, trend line |
