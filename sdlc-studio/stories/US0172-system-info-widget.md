# US0172: System Info Widget

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** a system info widget
**So that** I can see machine details at a glance

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Needs quick access to system details.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Basic system info
- **Given** the System Info widget is visible
- **When** I view the widget
- **Then** it displays: hostname, OS, kernel version, architecture

### AC2: Uptime info
- **Given** the widget is visible
- **When** I view the widget
- **Then** it shows uptime and last boot time

### AC3: Network identity
- **Given** the widget is visible
- **When** I view the widget
- **Then** it shows IP address and Tailscale hostname (if applicable)

### AC4: Machine type
- **Given** the widget is visible
- **When** I view the widget
- **Then** it shows machine type (server/workstation)

---

## Scope

### In Scope
- Widget ID: `system_info`
- Hostname, OS, kernel, architecture
- Uptime and last boot time
- IP address, Tailscale hostname
- Machine type badge
- Static widget (no charts)
- Minimum size: 3x2

### Out of Scope
- Editable fields
- Hardware details (CPU/RAM specs in other widgets)

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No Tailscale | Don't show Tailscale hostname field |
| 2 | Agent offline | Show last known values with stale indicator |
| 3 | Unknown OS | Show "Unknown" |

---

## Test Scenarios

- [x] Widget displays hostname and OS
- [x] Uptime shows correctly
- [x] Tailscale hostname shows when applicable
- [x] Machine type badge displays

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Implemented |

---

## Estimation

**Story Points:** 2
**Complexity:** Low - Static data display

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0145) |
| 2026-01-28 | Claude | Implementation complete: Added hostname, machine type badge, IP address, Tailscale hostname |
