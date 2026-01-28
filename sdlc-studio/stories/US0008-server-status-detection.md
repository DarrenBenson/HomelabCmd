# US0008: Server Status Detection

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** servers to be automatically marked offline when they stop reporting
**So that** I can immediately see which servers have connectivity issues

## Context

### Persona Reference

**Darren** - Needs to know when servers become unreachable. Currently discovers offline servers only when trying to use services.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Agents send heartbeats every 60 seconds. If 3 consecutive heartbeats are missed (180 seconds), the server should be marked offline. A background scheduler periodically checks for stale servers and updates their status. This is the detection mechanism; alerting on offline status is covered in EP0002.

## Acceptance Criteria

### AC1: Server marked offline after missed heartbeats

- **Given** a server last reported 180+ seconds ago
- **When** the stale check runs
- **Then** server status is updated to "offline"

### AC2: Background job runs periodically

- **Given** the hub is running
- **When** 60 seconds elapse
- **Then** the stale server check executes

### AC3: Server returns to online when heartbeat received

- **Given** a server is marked "offline"
- **When** a heartbeat is received from that server
- **Then** server status is updated to "online"

### AC4: New servers start as unknown

- **Given** a server is auto-registered via heartbeat
- **When** the first heartbeat is processed
- **Then** server status is set to "online" (not unknown)

### AC5: Dashboard reflects status changes

- **Given** a server status changes from online to offline
- **When** the dashboard refreshes
- **Then** the server card shows red LED instead of green

## Scope

### In Scope

- Background scheduler using APScheduler
- Stale server detection job (runs every 60s)
- Status update logic (online → offline after 180s)
- last_seen timestamp tracking
- Status recovery (offline → online on heartbeat)

### Out of Scope

- Alert generation on offline (EP0002)
- Slack notification (EP0002)
- Configurable offline threshold (fixed at 180s for MVP)
- Grace period before first offline marking

## UI/UX Requirements

No new UI components. Existing status LEDs change colour based on status field.

## Technical Notes

### API Contracts

No new endpoints. Status field is part of existing server responses.

### Background Scheduler

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', seconds=60)
async def check_stale_servers():
    stale_threshold = datetime.utcnow() - timedelta(seconds=180)
    stale_servers = await db.execute(
        select(Server)
        .where(Server.status == 'online')
        .where(Server.last_seen < stale_threshold)
    )
    for server in stale_servers:
        server.status = 'offline'
        # EP0002: Create alert here
```

### Data Requirements

- `last_seen` updated on every heartbeat
- Status values: "online", "offline", "unknown"
- Threshold: 180 seconds (3 missed heartbeats)

**TRD Reference:** [§2 Architecture - Agent Architecture](../trd.md#2-architecture-overview)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Hub restarts, servers appear stale | Mark offline; they'll recover on next heartbeat |
| Network glitch causes brief outage | May briefly mark offline, recovers quickly |
| Server in maintenance (expected down) | Still marked offline (no maintenance mode in MVP) |
| Many servers go offline simultaneously | All detected in same job run |
| Scheduler fails to start | Log error; status detection won't work |

## Test Scenarios

- [x] Server marked offline after 180s without heartbeat
- [x] Server marked online when heartbeat received
- [x] Offline server recovers to online on heartbeat
- [x] Multiple servers can be offline simultaneously
- [x] Stale check job runs every 60 seconds
- [x] last_seen timestamp updates on heartbeat
- [x] Status change reflected in API responses
- [x] Scheduler starts with application

## Definition of Done


**Story-specific additions:**

- [x] Background scheduler properly initialised on startup
- [x] Scheduler properly shut down on container stop
- [x] Logging shows stale check runs and status changes

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Done |
| US0003: Heartbeat Endpoint | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low - straightforward scheduler and status logic

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | Implementation complete - APScheduler 4.x integrated, 104 tests passing |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
