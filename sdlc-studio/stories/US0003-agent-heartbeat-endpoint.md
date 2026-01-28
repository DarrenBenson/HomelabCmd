# US0003: Agent Heartbeat Endpoint

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** agents to send metrics via a heartbeat endpoint
**So that** the hub receives real-time data about server health and can detect when servers go offline

## Context

### Persona Reference

**Darren** - Needs real-time visibility into all 11 servers. Expects metrics to update automatically without manual intervention.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The heartbeat endpoint is the primary communication channel between agents and the hub. Agents POST metrics every 60 seconds. The endpoint stores metrics, updates server status, and returns any pending commands (for EP0004 remediation).

## Acceptance Criteria

### AC1: Heartbeat stores metrics

- **Given** an agent sends a heartbeat with metrics data
- **When** POST `/api/v1/agents/heartbeat` is called
- **Then** metrics are stored in the database with current timestamp

### AC2: Heartbeat updates server status to online

- **Given** a server was previously offline or unknown
- **When** a valid heartbeat is received
- **Then** server status is updated to "online" and last_seen timestamp updated

### AC3: Heartbeat auto-registers unknown servers

- **Given** heartbeat is received from server_id not in database
- **When** the heartbeat is processed
- **Then** a new server record is created with data from the heartbeat

### AC4: Heartbeat updates OS info

- **Given** agent includes OS info in heartbeat
- **When** heartbeat is processed
- **Then** server record is updated with os_distribution, os_version, kernel, architecture

### AC5: Response includes pending commands

- **Given** there are pending approved actions for this server (EP0004)
- **When** heartbeat is processed
- **Then** response includes array of pending commands (empty array for MVP)

## Scope

### In Scope

- POST /api/v1/agents/heartbeat endpoint
- Metrics storage
- Server status update (online)
- Server auto-registration
- OS info update
- Placeholder for pending commands response
- API key authentication

### Out of Scope

- Offline detection logic (US0008)
- Command result reporting (EP0004)
- Service status in heartbeat (EP0003)
- Package update info (deferred)

## UI/UX Requirements

N/A - API-only story.

## Technical Notes

### API Contracts

**POST /api/v1/agents/heartbeat**
```json
Request:
{
  "server_id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "timestamp": "2026-01-18T10:30:00Z",
  "os_info": {
    "distribution": "Debian GNU/Linux",
    "version": "12 (bookworm)",
    "kernel": "6.1.0-18-amd64",
    "architecture": "x86_64"
  },
  "metrics": {
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
  }
}

Response 200:
{
  "status": "ok",
  "server_registered": false,
  "pending_commands": []
}
```

**Auto-registration Response:**
```json
Response 200:
{
  "status": "ok",
  "server_registered": true,
  "pending_commands": []
}
```

**TRD Reference:** [§4 API Contracts - Agent Communication](../trd.md#4-api-contracts)

### Data Requirements

- All metrics fields are optional (agent sends what it can collect)
- Timestamp from agent is stored; hub also records received_at
- Metrics stored even if some fields are null

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Missing server_id | 422 Unprocessable Entity |
| Invalid metrics values (negative, >100%) | Accept but log warning; psutil may return odd values |
| Network delay (old timestamp) | Accept; store both agent timestamp and received_at |
| Duplicate heartbeat (same timestamp) | Idempotent; update existing record if within 1 minute |
| Very large metrics payload | Validate max size; reject if excessive |

## Test Scenarios

- [ ] Heartbeat from registered server updates metrics
- [ ] Heartbeat from unknown server auto-registers
- [ ] Server status changes to online after heartbeat
- [ ] last_seen timestamp updated on heartbeat
- [ ] OS info updated from heartbeat
- [ ] Partial metrics (some fields missing) accepted
- [ ] Invalid API key returns 401
- [ ] Malformed JSON returns 422
- [ ] Response includes empty pending_commands array

## Definition of Done


**Story-specific additions:**

- [ ] Endpoint handles high frequency (11 servers × 1/min = 11 req/min)
- [ ] Logging shows heartbeat received events

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - core data ingestion with validation

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | Status changed to Planned, implementation plan PL0004 created |
| 2026-01-18 | Claude | Status changed to Done, all acceptance criteria met |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
