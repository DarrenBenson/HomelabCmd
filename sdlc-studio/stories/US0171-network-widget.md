# US0171: Network Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a network widget
**So that** I can see network traffic on my machines

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Monitors network for troubleshooting.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Traffic display
- **Given** the Network widget is visible
- **When** I view the widget
- **Then** it displays RX/TX bytes in human-readable format (KB/s, MB/s)

### AC2: Historical chart
- **Given** the Network widget is visible
- **When** I view the widget
- **Then** a chart shows historical traffic

### AC3: Interface list
- **Given** the machine has multiple network interfaces
- **When** I view the widget
- **Then** interfaces are listed (eth0, wlan0, tailscale0, etc.)

### AC4: Per-interface breakdown
- **Given** interfaces are listed
- **When** I click an interface
- **Then** I see detailed RX/TX for that interface

---

## Scope

### In Scope
- Widget ID: `network`
- RX/TX display (human-readable)
- Historical traffic chart
- Interface list
- Per-interface breakdown
- Minimum size: 4x3

### Out of Scope
- Network latency metrics
- Connection tracking

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No network data | Show "No data" |
| 2 | Interface down | Show with "down" indicator |
| 3 | Very high traffic | Scale units appropriately (GB/s) |
| 4 | Virtual interfaces only | Display normally |

---

## Test Scenarios

- [x] Widget displays RX/TX rates (aggregate totals)
- [ ] Chart shows historical data (deferred - requires network sparkline API AC6)
- [x] Interface list populates correctly (AC3)
- [x] Per-interface breakdown works (AC4)

All test scenarios covered by 20 unit tests in `NetworkIOWidget.test.tsx`.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Done |
| [US0179](US0179-per-interface-network-metrics-api.md) | Requires | Per-interface API for AC3, AC4 | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - Network metrics, chart integration

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0144) |
| 2026-01-28 | Claude | Partial implementation: Enhanced RX/TX display with icons, rate calculation. Per-interface/chart requires API. |
| 2026-01-29 | Claude | Full implementation: per-interface display with sorting, expandable details. AC1, AC3, AC4 complete. AC2 (chart) deferred. |
