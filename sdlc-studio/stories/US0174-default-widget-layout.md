# US0174: Default Widget Layout

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** new machines to have a sensible default layout
**So that** the detail page is immediately useful without configuration

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Wants good defaults out of the box.
[Full persona details](../personas.md#darren-homelab-operator)

---

## Acceptance Criteria

### AC1: Default layout exists
- **Given** a machine has no custom layout
- **When** I view the detail page
- **Then** a default layout is applied

### AC2: Server default
- **Given** a server has no custom layout
- **When** I view the detail page
- **Then** the layout includes: CPU, memory, disk, services, network, system info

### AC3: Workstation default
- **Given** a workstation has no custom layout
- **When** I view the detail page
- **Then** the layout includes: CPU, memory, disk, system info (no services widget)

### AC4: Docker detection
- **Given** Docker is detected on the machine
- **When** the default layout is applied
- **Then** the containers widget is included

### AC5: Responsive defaults
- **Given** default layout is applied
- **When** viewed on different screen sizes
- **Then** the layout works well on desktop, tablet, and mobile

---

## Scope

### In Scope
- Default layouts defined in code
- Server vs workstation defaults
- Docker widget conditional inclusion
- Responsive breakpoint defaults
- Optimised for common screen sizes

### Out of Scope
- User-configurable default templates

---

## Technical Notes

```typescript
const serverDefaultLayout = [
  { i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 },
  { i: 'memory_gauge', x: 6, y: 0, w: 6, h: 3 },
  { i: 'load_average', x: 0, y: 3, w: 4, h: 2 },
  { i: 'disk_usage', x: 4, y: 3, w: 4, h: 3 },
  { i: 'network', x: 8, y: 3, w: 4, h: 3 },
  { i: 'services', x: 0, y: 6, w: 6, h: 4 },
  { i: 'system_info', x: 6, y: 6, w: 6, h: 2 },
];

const workstationDefaultLayout = [
  { i: 'cpu_chart', x: 0, y: 0, w: 6, h: 3 },
  { i: 'memory_gauge', x: 6, y: 0, w: 6, h: 3 },
  { i: 'disk_usage', x: 0, y: 3, w: 6, h: 3 },
  { i: 'system_info', x: 6, y: 3, w: 6, h: 2 },
];

function getDefaultLayout(machine: Machine): Layout[] {
  const base = machine.machine_type === 'workstation'
    ? workstationDefaultLayout
    : serverDefaultLayout;

  if (machine.has_docker) {
    return [...base, { i: 'containers', x: 0, y: 10, w: 8, h: 4 }];
  }
  return base;
}
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Unknown machine type | Use server default |
| 2 | Docker status unknown | Don't include containers widget |
| 3 | Very small screen | Single column layout |

---

## Test Scenarios

- [x] Server gets server default layout
- [x] Workstation gets workstation default layout
- [ ] Docker machines include containers widget (requires EP0014 Docker Monitoring)
- [x] Default layout responsive on all breakpoints

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0164](US0164-widget-grid-system.md) | Requires | Grid system | Implemented |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Configuration, conditional logic

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0147) |
| 2026-01-28 | Claude | Implementation complete: Server vs workstation layouts, conditional widget rendering, responsive breakpoints. Docker detection deferred to EP0014. |
