# US0090: Last Seen UI for Workstations

> **Status:** Done
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 3
> **Completed:** 2026-01-27

## User Story

**As a** system administrator
**I want** workstations to show "Last seen" instead of "OFFLINE"
**So that** the UI reflects normal intermittent usage

## Context

### Persona Reference

**Darren** - Homelab operator who manages both 24/7 servers and intermittent workstations. Needs to quickly distinguish between concerning offline status (servers) and expected offline status (workstations).

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When a server goes offline, it's a problem that requires attention. But when a workstation goes offline, it's normal - the user simply shut down their PC. Currently, both show as "OFFLINE" in the UI, which creates unnecessary visual noise and alarm for workstations.

This story implements differentiated UI treatment:
- Servers show "OFFLINE" (red) when offline - indicating a problem
- Workstations show "Last seen: 3 hours ago" (grey) - indicating normal intermittent usage

The ServerDetail page already displays `last_seen` timestamp. This story extends that pattern to ServerCard on the dashboard.

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | EP0009 foundation (US0082) | Requires `machine_type` field |
| UX | Clear visual distinction | Different treatment for offline servers vs workstations |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard <200ms | Relative time calculation must be efficient |
| Accessibility | Colour not sole indicator | Status must be conveyed through text, not just colour |

## Acceptance Criteria

### AC1: Workstation "Last Seen" display

- **Given** a workstation that is offline
- **When** viewing the server card on the dashboard
- **Then** it shows "Last seen: X ago" where X is the relative time since `last_seen`
- **And** the status indicator is grey (not red)

### AC2: Server OFFLINE display unchanged

- **Given** a server that is offline
- **When** viewing the server card on the dashboard
- **Then** it shows "OFFLINE" status
- **And** the status indicator is red

### AC3: Relative time formatting

- **Given** a workstation with `last_seen` timestamp
- **When** rendering the "Last seen" text
- **Then** time is formatted as relative: "2 minutes ago", "3 hours ago", "2 days ago"
- **And** updates dynamically without page reload

### AC4: Status indicator colours

- **Given** the server card component
- **When** rendering status indicators
- **Then** online servers/workstations show green dot
- **And** offline servers show red dot
- **And** offline workstations show grey dot

### AC5: Tooltip explanation

- **Given** an offline workstation card
- **When** hovering over the status indicator
- **Then** tooltip shows "Workstation - intermittent availability expected"

## Scope

### In Scope

- Update ServerCard component to handle workstation offline differently
- Relative time formatting using `date-fns`
- Grey status indicator for offline workstations
- Tooltip explaining workstation status
- Dynamic time updates (every minute)

### Out of Scope

- Dashboard filtering by machine type (US0091)
- Visual distinction badges and icons (US0091)
- Cost tracking changes (US0092)
- Changes to ServerDetail page (already shows last_seen)

## UI/UX Requirements

### ServerCard Comparison

**Server (Offline):**
```
┌─────────────────────┐
│ 🔴 HOMESERVER       │
│ OFFLINE             │
│ Last seen: 5m ago   │
│ ⚠️ Alert active      │
└─────────────────────┘
```

**Workstation (Offline):**
```
┌─────────────────────┐
│ ⚪ StudyPC           │
│ Last seen: 3h ago   │
│ (No alert)          │
└─────────────────────┘
```

### Time Formatting Examples

| last_seen | Display |
|-----------|---------|
| 30 seconds ago | "less than a minute ago" |
| 5 minutes ago | "5 minutes ago" |
| 3 hours ago | "about 3 hours ago" |
| 2 days ago | "2 days ago" |
| 2 weeks ago | "about 2 weeks ago" |

## Technical Notes

### Implementation Approach

```typescript
// ServerCard.tsx
import { formatDistanceToNow } from 'date-fns';

const getStatusDisplay = (server: Server) => {
  if (server.status === 'online') {
    return { text: 'Online', colour: 'green' };
  }

  if (server.machine_type === 'workstation') {
    const lastSeenText = server.last_seen
      ? `Last seen: ${formatDistanceToNow(new Date(server.last_seen), { addSuffix: true })}`
      : 'Last seen: Unknown';
    return { text: lastSeenText, colour: 'grey' };
  }

  return { text: 'OFFLINE', colour: 'red' };
};
```

### date-fns Dependency

`date-fns` is already installed in the frontend. Use `formatDistanceToNow` for relative time.

### Dynamic Updates

Use `useEffect` with `setInterval` to update relative time every 60 seconds:

```typescript
const [, setTick] = useState(0);

useEffect(() => {
  const interval = setInterval(() => setTick(t => t + 1), 60000);
  return () => clearInterval(interval);
}, []);
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| `last_seen` is null | Show "Last seen: Unknown" |
| `last_seen` in future (clock skew) | Show "less than a minute ago" |
| Very old `last_seen` (>30 days) | Show "about 1 month ago" (date-fns handles) |
| Server changes to workstation type | UI updates on next render |
| Workstation comes online | Switches to green "Online" status |
| Machine type not set (legacy data) | Treat as server (default behaviour) |

## Test Scenarios

- [x] Workstation offline shows "Last seen: X ago"
- [x] Server offline shows "OFFLINE"
- [x] Online machines show "Online" regardless of type
- [x] Relative time updates every minute
- [x] Tooltip appears on hover for workstation
- [x] Grey dot for offline workstation
- [x] Red dot for offline server
- [x] Green dot for online (both types)
- [x] Handles null last_seen gracefully
- [x] Handles very old last_seen values

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0090-01 | Workstation offline shows last seen | AC1 | Unit | Ready |
| TC-US0090-02 | Server offline shows OFFLINE | AC2 | Unit | Ready |
| TC-US0090-03 | Relative time formatting | AC3 | Unit | Ready |
| TC-US0090-04 | Status indicator colours | AC4 | Unit | Ready |
| TC-US0090-05 | Workstation tooltip | AC5 | Unit | Ready |
| TC-US0090-06 | Dynamic time updates | AC3 | Unit | Ready |
| TC-US0090-07 | Null last_seen handling | AC1 | Unit | Ready |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| US0082 | Schema | `machine_type` field on Server | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| date-fns | npm package | Already installed |

## Estimation

**Story Points:** 4

**Complexity:** Medium - UI logic changes, time formatting, dynamic updates

## Open Questions

None - all requirements clear from epic.

## Quality Checklist

### All Stories

- [x] No ambiguous language
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context
- [x] Edge cases documented (7)
- [x] Test scenarios listed (10)

### Ready Status Gate

- [x] All critical Open Questions resolved
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Story generated from EP0009 epic (was US0085, renumbered to US0090) |
| 2026-01-27 | Claude | Implementation plan PL0090 created, status changed to Planned |
| 2026-01-27 | Claude | TDD implementation complete, 14 tests passing, status changed to Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
