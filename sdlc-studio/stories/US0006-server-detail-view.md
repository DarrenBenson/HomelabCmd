# US0006: Server Detail View

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to view detailed information about a specific server
**So that** I can investigate issues and understand resource utilisation

## Context

### Persona Reference

**Darren** - When an issue is detected, needs to drill down into specific server metrics. Currently requires SSH to check details; wants this available in the dashboard.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The server detail view is accessed by clicking a server card on the dashboard. It shows comprehensive information about a single server including all metrics, OS information, and historical charts. This replaces the need to SSH into servers for basic status checks.

## Acceptance Criteria

### AC1: Detail view displays server info

- **Given** navigating to server detail for "omv-mediaserver"
- **When** the page loads
- **Then** server name, hostname, IP address, and status are displayed

### AC2: Detail view shows OS information

- **Given** a server has reported OS info via heartbeat
- **When** viewing server detail
- **Then** OS distribution, version, kernel, and architecture are displayed

### AC3: Detail view shows current metrics

- **Given** a server has recent metrics
- **When** viewing server detail
- **Then** all metrics are displayed: CPU%, RAM (used/total), Disk (used/total), Network I/O, Load averages, Uptime

### AC4: Detail view shows metric gauges

- **Given** current metrics are displayed
- **When** viewing CPU, RAM, and Disk metrics
- **Then** each is displayed as a visual gauge with percentage and absolute values

### AC5: Back navigation works

- **Given** user is on server detail view
- **When** clicking back button
- **Then** user returns to dashboard

### AC6: Brand guide compliance

- **Given** the detail view is rendered
- **When** inspecting visual elements
- **Then** colours, typography, gauges, and cards match the brand guide

## Scope

### In Scope

- Server detail page component
- Server info panel (name, hostname, IP, status)
- OS info panel
- Current metrics display with gauges
- Network I/O display
- Load average display
- Uptime display
- Back navigation
- Refresh button

### Out of Scope

- Historical charts (US0007)
- Service status list (EP0003)
- Remediation actions (EP0004)
- Edit server configuration (future)
- Delete server button (future)

## UI/UX Requirements

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back   HOME-LAB-HUB / Media Server                           [↻]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────┐  ┌───────────────────────────┐ │
│  │ Server Information                  │  │ System                     │ │
│  │                                     │  │                            │ │
│  │ ● Status: Online                    │  │ OS: Debian GNU/Linux 12    │ │
│  │ Hostname: omv-mediaserver           │  │ Kernel: 6.1.0-18-amd64     │ │
│  │ IP: 192.168.1.10                    │  │ Arch: x86_64               │ │
│  │ Last seen: 30s ago                  │  │ Uptime: 12d 5h 23m         │ │
│  │                                     │  │                            │ │
│  └─────────────────────────────────────┘  └───────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Resource Utilisation                                               │  │
│  │                                                                    │  │
│  │  ┌─────────┐     ┌─────────┐     ┌─────────┐                      │  │
│  │  │  CPU    │     │  RAM    │     │  Disk   │                      │  │
│  │  │  ╭───╮  │     │  ╭───╮  │     │  ╭───╮  │                      │  │
│  │  │  │23%│  │     │  │67%│  │     │  │45%│  │                      │  │
│  │  │  ╰───╯  │     │  ╰───╯  │     │  ╰───╯  │                      │  │
│  │  │         │     │ 11/16GB │     │ 900/2TB │                      │  │
│  │  └─────────┘     └─────────┘     └─────────┘                      │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │ Load Average               │  │ Network I/O                         │ │
│  │                            │  │                                     │ │
│  │ 1m:  0.45                  │  │ ↓ Received: 1.23 GB                 │ │
│  │ 5m:  0.52                  │  │ ↑ Sent: 987 MB                      │ │
│  │ 15m: 0.48                  │  │                                     │ │
│  └────────────────────────────┘  └────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Gauge Component

- Circular progress gauge (arc style)
- Colour based on threshold:
  - 0-70%: Phosphor Green (#4ADE80)
  - 70-85%: Amber Alert (#FBBF24)
  - 85-100%: Red Alert (#F87171)
- Percentage in centre: JetBrains Mono, 24px bold
- Absolute values below: JetBrains Mono, 12px

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for complete specifications.

- Gauges: Brand Guide §Component Specifications - Gauges
- Cards: Brand Guide §Component Specifications - Cards

## Technical Notes

### API Contracts

**GET /api/v1/servers/{server_id}**
```json
Response 200:
{
  "id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "display_name": "Media Server",
  "ip_address": "192.168.1.10",
  "status": "online",
  "last_seen": "2026-01-18T10:30:00Z",
  "os_info": {
    "distribution": "Debian GNU/Linux",
    "version": "12 (bookworm)",
    "kernel": "6.1.0-18-amd64",
    "architecture": "x86_64"
  },
  "latest_metrics": {
    "cpu_percent": 23.5,
    "memory_percent": 67.2,
    "memory_total_mb": 16384,
    "memory_used_mb": 11010,
    "disk_percent": 45.0,
    "disk_total_gb": 2000.0,
    "disk_used_gb": 900.0,
    "network_rx_bytes": 1234567890,
    "network_tx_bytes": 987654321,
    "load_1m": 0.45,
    "load_5m": 0.52,
    "load_15m": 0.48,
    "uptime_seconds": 1234567
  },
  "tdp_watts": 65
}
```

### Data Requirements

- Fetch server detail on page load
- Auto-refresh current metrics every 30 seconds
- Format bytes as KB/MB/GB as appropriate
- Format uptime as "Xd Yh Zm"

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | 404 page with "Server not found" message |
| Server has no metrics | Display "Awaiting metrics" in gauge areas |
| Server offline | Display last known metrics with "Offline since X" warning |
| API request fails | Show cached data with error toast |
| Very long uptime (>1 year) | Format as "Xy Xd" |

## Test Scenarios

- [ ] Detail view displays correct server information
- [ ] OS info panel shows all fields
- [ ] Gauges display correct percentages and colours
- [ ] Gauge colour changes based on threshold
- [ ] Network bytes formatted correctly (MB/GB)
- [ ] Uptime formatted correctly
- [ ] Load averages display with 2 decimal places
- [ ] Back button returns to dashboard
- [ ] Refresh button updates metrics
- [ ] 404 displayed for non-existent server

## Definition of Done


**Story-specific additions:**

- [ ] Gauge component reusable
- [ ] Gauge thresholds configurable (default 70/85)
- [ ] All values use JetBrains Mono font
- [ ] Status LED matches dashboard card

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0002: Server Registration API | Story | Draft |
| US0005: Dashboard Server List | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - gauge component, data formatting, brand compliance

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
