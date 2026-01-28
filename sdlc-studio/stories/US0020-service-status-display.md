# US0020: Service Status Display in Server Detail

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to see service status in the server detail view
**So that** I can quickly identify which services are running or stopped

## Context

### Persona Reference

**Darren** - When troubleshooting, needs to see all services on a server at a glance. Currently requires SSH to check each one.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The server detail view (US0006) is extended to show a services section. Each expected service is displayed with its current status (running/stopped/failed), resource usage if running, and a restart button (for EP0004).

## Acceptance Criteria

### AC1: Services section on server detail

- **Given** navigating to server detail for "omv-mediaserver"
- **When** the page loads
- **Then** a services section is displayed

### AC2: Service status indicators

- **Given** services are configured for the server
- **When** viewing the services section
- **Then** each service shows status (running/stopped/failed) with colour coding

### AC3: Running services show resources

- **Given** a service is running
- **When** viewing its status
- **Then** PID, memory usage, and CPU usage are displayed

### AC4: Stopped services highlighted

- **Given** a service is stopped
- **When** viewing the services section
- **Then** it's displayed with warning/error styling

### AC5: Restart button present

- **Given** a stopped service
- **When** viewing the service row
- **Then** a "Restart" button is visible (disabled until EP0004)

### AC6: Brand guide compliance

- **Given** services are displayed
- **When** inspecting visual elements
- **Then** colours match brand guide (green running, red stopped)

## Scope

### In Scope

- Services panel in server detail view
- Service status indicators with colour coding
- Resource usage display (PID, memory, CPU)
- Critical service badge
- Restart button (placeholder until EP0004)
- Empty state when no services configured

### Out of Scope

- Service configuration UI (future)
- Service logs
- Service history charts
- Actual restart execution (EP0004)

## UI/UX Requirements

### Layout (Addition to Server Detail)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Previous server detail content...]                                     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Services                                          [+ Add Service]  │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ ● Plex Media Server           CRITICAL                     │   │  │
│  │  │   Status: Running    PID: 12345    RAM: 512 MB    CPU: 2% │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ ○ Sonarr                                        [↻ Restart] │   │  │
│  │  │   Status: Stopped                                          │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ ● Radarr                                                    │   │  │
│  │  │   Status: Running    PID: 23456    RAM: 256 MB    CPU: 1% │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Service Card Styling

- Status indicator: Circle, same as server LED
  - Running: Phosphor Green (#4ADE80)
  - Stopped: Red Alert (#F87171)
  - Failed: Red Alert (#F87171)
  - Unknown: Soft White (#C9D1D9)
- Service name: Space Grotesk, 14px semi-bold
- CRITICAL badge: Red background, white text, small pill
- Resource values: JetBrains Mono, 12px
- Restart button: Ghost button, only shown for stopped services
- Stopped services: Subtle red left border

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for colour specifications.

## Technical Notes

### API Contracts

Uses endpoint from US0019:

- GET /api/v1/servers/{server_id}/services

### Data Requirements

- Fetch services with server detail
- Or separate API call on section mount
- Real-time updates via polling (every 30s with other data)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No services configured | Show "No services configured" with "Add Service" button |
| Service status unknown | Show grey indicator with "Unknown" text |
| Service disabled | Show with dimmed styling |
| Many services (>10) | Scrollable list within panel |
| API error | Show cached data with error toast |

## Test Scenarios

- [x] Services section displays in server detail
- [x] Running services show green indicator
- [x] Stopped services show red indicator
- [x] Critical badge displayed for critical services
- [x] Resource usage displayed for running services
- [x] Restart button shown for stopped services
- [x] Empty state when no services
- [x] Colours match brand guide

## Definition of Done


**Story-specific additions:**

- [x] Status colours match brand guide
- [x] Critical badge styling correct
- [x] Resource values use JetBrains Mono

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0006: Server Detail View | Story | Draft |
| US0019: Expected Services API | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - UI extension

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
