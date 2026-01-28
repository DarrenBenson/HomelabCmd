# US0005: Dashboard Server List

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** a dashboard showing all servers with their current status
**So that** I can assess fleet health at a glance in under 2 minutes

## Context

### Persona Reference

**Darren** - Currently spends 30+ minutes checking multiple dashboards and SSH sessions. Needs a single view showing all 11 servers with key metrics.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This is the primary user interface for the MVP. The dashboard displays a grid of server cards, each showing status (online/offline), hostname, and key metrics (CPU, RAM, Disk). Cards are clickable to navigate to server detail view.

## Acceptance Criteria

### AC1: Dashboard displays all servers

- **Given** 11 servers are registered
- **When** navigating to the dashboard
- **Then** all 11 servers are visible without scrolling (grid layout)

### AC2: Server cards show status LED

- **Given** a server has status "online"
- **When** viewing the server card
- **Then** a pulsing green LED indicator is displayed

### AC3: Server cards show offline status

- **Given** a server has status "offline"
- **When** viewing the server card
- **Then** a red LED indicator is displayed (not pulsing)

### AC4: Server cards show key metrics

- **Given** a server has recent metrics
- **When** viewing the server card
- **Then** CPU%, RAM%, Disk%, and uptime are displayed

### AC5: Dashboard loads quickly

- **Given** all servers have metrics
- **When** navigating to the dashboard
- **Then** the page loads completely in under 2 seconds

### AC6: Brand guide compliance

- **Given** the dashboard is rendered
- **When** inspecting visual elements
- **Then** colours, typography, and components match the brand guide

## Scope

### In Scope

- Dashboard page component
- Server card component with status LED
- Grid layout for 11+ servers
- API integration for server list
- Auto-refresh (polling every 30 seconds)
- Loading state
- Empty state (no servers)
- Navigation to server detail (click handler)

### Out of Scope

- Server detail view (US0006)
- Alert indicators on cards (EP0002)
- Service status on cards (EP0003)
- Summary stats bar (future enhancement)
- WebSocket real-time updates (future - polling is fine)

## UI/UX Requirements

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HOME-LAB-HUB                                                     [?]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ ● HomeServer│  │ ● MediaSrv  │  │ ● BackupSrv │  │ ● CloudSrv1 │    │
│  │             │  │             │  │             │  │             │    │
│  │ CPU   23%   │  │ CPU   45%   │  │ CPU   12%   │  │ CPU   67%   │    │
│  │ RAM   67%   │  │ RAM   78%   │  │ RAM   45%   │  │ RAM   82%   │    │
│  │ Disk  45%   │  │ Disk  65%   │  │ Disk  23%   │  │ Disk  55%   │    │
│  │ Up: 12d     │  │ Up: 5d      │  │ Up: 30d     │  │ Up: 3d      │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ ● WebSrv1   │  │ ● WebSrv2   │  │ ● DocSrv    │  │ ● HomeAuto  │    │
│  │  ...        │  │  ...        │  │  ...        │  │  ...        │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │ ● AISrv1    │  │ ● Pi-Master │  │ ○ Pi-Backup │ ← Offline (red)     │
│  │  ...        │  │  ...        │  │  ...        │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Server Card Component

- Background: Console Grey (#161B22)
- Border: 1px solid border colour, 8px radius
- Status LED: 12px circle, positioned top-left
  - Online: Phosphor Green (#4ADE80) with pulse animation
  - Offline: Red Alert (#F87171) solid
  - Unknown: Soft White (#C9D1D9) solid
- Server name: Space Grotesk, 14px semi-bold
- Metrics: JetBrains Mono, 12px
- Hover: Subtle border highlight (Terminal Cyan)
- Click: Navigate to server detail

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for complete specifications.

- Status LED: Brand Guide §Component Specifications - Status LED
- Card styling: Brand Guide §Component Specifications - Cards

## Technical Notes

### API Contracts

**GET /api/v1/servers**
```json
Response 200:
{
  "servers": [
    {
      "id": "omv-mediaserver",
      "hostname": "omv-mediaserver",
      "display_name": "Media Server",
      "status": "online",
      "latest_metrics": {
        "cpu_percent": 23.5,
        "memory_percent": 67.2,
        "disk_percent": 45.0,
        "uptime_seconds": 1234567
      }
    }
  ],
  "total": 11
}
```

### Data Requirements

- Server list fetched on page load
- Auto-refresh every 30 seconds via polling
- Show cached data while refreshing (no loading flash)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No servers registered | Show friendly empty state with "Add your first server" guidance |
| API request fails | Show cached data with "Unable to refresh" toast |
| Server has no metrics yet | Show card with "Awaiting data" placeholder |
| Metrics are stale (>5 min) | Show amber warning indicator |
| Many servers (>20) | Scrollable grid, maintain performance |

## Test Scenarios

- [ ] Dashboard renders with 11 server cards
- [ ] Server cards display correct status LED colour
- [ ] Online servers show pulsing green LED
- [ ] Offline servers show solid red LED
- [ ] Metrics display correctly formatted (percentages, uptime)
- [ ] Click on card navigates to server detail
- [ ] Dashboard auto-refreshes every 30 seconds
- [ ] Loading state displays during initial fetch
- [ ] Empty state displays when no servers
- [ ] Error state displays when API fails

## Definition of Done


**Story-specific additions:**

- [ ] Dashboard loads in <2 seconds (lighthouse audit)
- [ ] All colours match brand guide hex values
- [ ] Fonts are Space Grotesk (UI) and JetBrains Mono (data)
- [ ] Status LED pulse animation implemented
- [ ] Responsive on tablet (1024px+)

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0002: Server Registration API | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - UI with multiple components and brand compliance

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
