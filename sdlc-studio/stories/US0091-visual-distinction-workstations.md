# US0091: Visual Distinction (Server vs Workstation)

> **Status:** Done
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** visual cues to distinguish servers from workstations
**So that** I can quickly identify machine types on the dashboard

## Context

### Persona Reference

**Darren** - Homelab operator managing a mixed fleet of 11+ machines including servers and workstations. Needs to quickly scan the dashboard and identify machine types at a glance without reading details.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With workstation support added (EP0009), the dashboard now shows both servers and workstations. Currently, they look identical except for status behaviour. This story adds visual distinction through:

1. Machine type icons (Server icon vs Monitor/Laptop icon)
2. Type badges ("Server" vs "Workstation")
3. Colour accents (blue for servers, purple for workstations)
4. Border styling (solid for servers, dashed when workstation is offline)
5. Dashboard grouping (optional)

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | US0090 (Last Seen UI) | Build on top of status display changes |
| UX | Quick identification | Visual cues must be immediately apparent |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Accessibility | Colour not sole indicator | Type must be indicated by icon and text, not just colour |
| Performance | Dashboard <200ms | No additional API calls for visual distinction |

## Acceptance Criteria

### AC1: Machine type icons

- **Given** the server card component
- **When** rendering a server
- **Then** a Server rack icon is displayed
- **And** when rendering a workstation, a Monitor or Laptop icon is displayed

### AC2: Type badges

- **Given** the server card component
- **When** rendering a machine
- **Then** a badge shows the machine type
- **And** server badge shows "Server"
- **And** workstation badge shows "Workstation"

### AC3: Colour accents

- **Given** the server card component
- **When** rendering a server
- **Then** the left border accent is blue (#3b82f6)
- **And** when rendering a workstation, the left border accent is purple (#a855f7)

### AC4: Offline workstation border style

- **Given** an offline workstation
- **When** rendering the server card
- **Then** the border style is dashed (not solid)
- **And** online workstations and all servers have solid borders

### AC5: Hover tooltip

- **Given** a machine card
- **When** hovering over the type icon or badge
- **Then** a tooltip shows the full machine type description
- **And** servers show "Server - 24/7 uptime expected"
- **And** workstations show "Workstation - intermittent availability expected"

### AC6: Dashboard grouping (optional enhancement)

- **Given** the dashboard servers list
- **When** rendering machines
- **Then** an optional view groups servers and workstations separately
- **And** shows count summary: "Servers (8 online, 1 offline)" and "Workstations (1 online, 2 offline)"

## Scope

### In Scope

- Lucide React icons for machine types
- Type badge component
- Colour accent styling (Tailwind classes)
- Border style variations
- Tooltip on hover
- Optional dashboard grouping view

### Out of Scope

- Filtering by machine type (could be future enhancement)
- User preference to hide type badges (deferred)
- Mobile-specific layouts

## UI/UX Requirements

### Icon Selection

| Machine Type | Lucide Icon | Alternative |
|--------------|-------------|-------------|
| Server | `Server` | `HardDrive` |
| Workstation | `Monitor` | `Laptop` (for laptops) |

### Badge Styling

```
Server badge:    [🖥️ Server]     bg-blue-100 text-blue-800 border-blue-200
Workstation:     [💻 Workstation] bg-purple-100 text-purple-800 border-purple-200
```

### Card Layout

**Server Card:**
```
┌────────────────────────────────┐
│ 🖥️ [Server]  🟢 HOMESERVER     │ <- Blue left border
│ ────────────────────────────── │
│ Online • CPU: 45% • Mem: 62%   │
└────────────────────────────────┘
```

**Workstation Card (Online):**
```
┌────────────────────────────────┐
│ 💻 [Workstation] 🟢 StudyPC    │ <- Purple left border (solid)
│ ────────────────────────────── │
│ Online • CPU: 12% • Mem: 35%   │
└────────────────────────────────┘
```

**Workstation Card (Offline):**
```
┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
╎ 💻 [Workstation] ⚪ LaptopPro  ╎ <- Purple left border (dashed)
╎ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ╎
╎ Last seen: 3 hours ago         ╎
└╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

### Dashboard Grouped View

```
┌────────────────────────────────────────────────┐
│  HomelabCmd                    [+ Add Machine] │
├────────────────────────────────────────────────┤
│                                                │
│  🖥️  Servers (8 online, 1 offline)             │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │🟢 Server │ │🟢 Server │ │🔴 Server │       │
│  │HOMESERVER│ │MEDIASERVER│ │BACKUPSVR │       │
│  └──────────┘ └──────────┘ └──────────┘       │
│                                                │
│  💻 Workstations (1 online, 2 offline)         │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │🟢 Wrkst  │ │⚪ Wrkst  │ │⚪ Wrkst  │       │
│  │StudyPC   │ │LaptopPro │ │GamingPC  │       │
│  │Online    │ │Last: 3h  │ │Last: 2d  │       │
│  └──────────┘ └──────────┘ └──────────┘       │
└────────────────────────────────────────────────┘
```

## Technical Notes

### Tailwind Classes

```typescript
const getMachineTypeStyles = (server: Server) => {
  const isWorkstation = server.machine_type === 'workstation';
  const isOffline = server.status !== 'online';

  return {
    borderColour: isWorkstation ? 'border-l-purple-500' : 'border-l-blue-500',
    borderStyle: isWorkstation && isOffline ? 'border-dashed' : 'border-solid',
    badgeBg: isWorkstation ? 'bg-purple-100' : 'bg-blue-100',
    badgeText: isWorkstation ? 'text-purple-800' : 'text-blue-800',
  };
};
```

### Icon Component

```typescript
import { Server, Monitor } from 'lucide-react';

const MachineTypeIcon = ({ type }: { type: string }) => {
  const Icon = type === 'workstation' ? Monitor : Server;
  return <Icon className="h-4 w-4" />;
};
```

### Badge Component

```typescript
interface TypeBadgeProps {
  type: 'server' | 'workstation';
}

const TypeBadge = ({ type }: TypeBadgeProps) => {
  const styles = type === 'workstation'
    ? 'bg-purple-100 text-purple-800 border-purple-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles}`}>
      {type === 'workstation' ? 'Workstation' : 'Server'}
    </span>
  );
};
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| `machine_type` is null | Default to "server" styling |
| Unknown machine type value | Default to "server" styling |
| Very long machine name | Truncate with ellipsis, badge remains visible |
| Many workstations (>10) | Grouped view handles scrolling |
| No workstations registered | "Workstations" section shows "(none registered)" |
| Mixed online/offline states | Each card styled independently |

## Test Scenarios

- [x] Server card shows Server icon
- [x] Workstation card shows Monitor icon
- [x] Server badge displays correctly
- [x] Workstation badge displays correctly
- [x] Server has blue left border
- [x] Workstation has purple left border
- [x] Offline workstation has dashed border
- [x] Online workstation has solid border
- [x] Tooltip shows correct description
- [x] Dashboard grouping displays counts correctly
- [x] Unknown machine_type defaults to server styling

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0091-01 | Server icon rendering | AC1 | Unit | Ready |
| TC-US0091-02 | Workstation icon rendering | AC1 | Unit | Ready |
| TC-US0091-03 | Server badge | AC2 | Unit | Ready |
| TC-US0091-04 | Workstation badge | AC2 | Unit | Ready |
| TC-US0091-05 | Blue border for server | AC3 | Unit | Ready |
| TC-US0091-06 | Purple border for workstation | AC3 | Unit | Ready |
| TC-US0091-07 | Dashed border offline workstation | AC4 | Unit | Ready |
| TC-US0091-08 | Tooltip content | AC5 | Unit | Ready |
| TC-US0091-09 | Dashboard grouping | AC6 | Integration | Ready |
| TC-US0091-10 | Default styling for null type | Edge case | Unit | Ready |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| US0082 | Schema | `machine_type` field on Server | Done |
| US0090 | UI | Last seen display logic | Ready |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react | npm package | Already installed |
| Tailwind CSS | npm package | Already installed |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - Primarily styling and component changes, no backend work

## Open Questions

None - all requirements clear from epic.

## Quality Checklist

### All Stories

- [x] No ambiguous language
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context
- [x] Edge cases documented (6)
- [x] Test scenarios listed (11)

### Ready Status Gate

- [x] All critical Open Questions resolved
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Story generated from EP0009 epic (was US0086, renumbered to US0091) |
| 2026-01-27 | Claude | Implementation plan PL0091 created, status changed to Planned |
| 2026-01-27 | Claude | TDD implementation complete, 31 tests passing, status changed to Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
