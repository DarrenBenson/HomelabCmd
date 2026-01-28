# US0018: Agent Service Status Collection

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** the agent to report status of configured services
**So that** the hub knows which services are running or stopped

## Context

### Persona Reference

**Darren** - Needs to know when Plex, Pi-hole, or Nextcloud stop running, without manually checking each server.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The agent configuration includes a list of services to monitor. Each heartbeat includes the current status of these services. The agent queries `systemctl status` for each configured service and reports the result.

## Acceptance Criteria

### AC1: Agent config includes monitored services

- **Given** the agent config file
- **When** adding a `monitored_services` list
- **Then** the agent reads and uses this list

### AC2: Agent collects service status

- **Given** `plex` is in monitored_services
- **When** the agent collects metrics
- **Then** the status of the plex service is queried via systemctl

### AC3: Heartbeat includes service data

- **Given** services are configured
- **When** a heartbeat is sent
- **Then** the payload includes service status for each configured service

### AC4: Service status includes details

- **Given** a service is running
- **When** status is collected
- **Then** PID, memory usage, and CPU usage are included

### AC5: Hub stores service status

- **Given** a heartbeat with service data is received
- **When** the heartbeat is processed
- **Then** service status is stored in the service_status table

## Scope

### In Scope

- Agent configuration for monitored services
- Service status collection via systemctl
- Service data in heartbeat payload
- Hub processing of service status
- Service status storage

### Out of Scope

- Expected services configuration UI (US0019)
- Service alerts (US0021)
- Docker container monitoring
- Service restart execution (US0022, EP0004)

## Technical Notes

### Agent Configuration

```yaml
# /etc/homelab-agent/config.yaml
hub_url: "http://homelab-cmd.home.lan:8080"
server_id: "omv-mediaserver"
api_key: "your-api-key-here"
heartbeat_interval: 60
monitored_services:
  - plex
  - sonarr
  - radarr
  - jellyfin
```

### Service Collection

```python
import subprocess

def get_service_status(service_name: str) -> dict:
    try:
        result = subprocess.run(
            ['systemctl', 'show', service_name,
             '--property=ActiveState,MainPID,MemoryCurrent'],
            capture_output=True, text=True, timeout=5
        )
        # Parse output...
        return {
            'name': service_name,
            'status': 'running',  # or 'stopped', 'failed'
            'pid': 12345,
            'memory_mb': 512.5,
            'cpu_percent': 2.3
        }
    except Exception:
        return {
            'name': service_name,
            'status': 'unknown',
            'pid': None,
            'memory_mb': None,
            'cpu_percent': None
        }
```

### API Contracts

**Heartbeat payload addition:**
```json
{
  "server_id": "omv-mediaserver",
  "timestamp": "2026-01-18T10:30:00Z",
  "metrics": { ... },
  "services": [
    {
      "name": "plex",
      "status": "running",
      "pid": 12345,
      "memory_mb": 512.5,
      "cpu_percent": 2.3
    },
    {
      "name": "sonarr",
      "status": "stopped",
      "pid": null,
      "memory_mb": null,
      "cpu_percent": null
    }
  ]
}
```

**TRD Reference:** [§4 API Contracts - Agent Communication](../trd.md#4-api-contracts)

### Data Requirements

- Service status values: running, stopped, failed, unknown
- Memory in MB, CPU as percentage
- PID for running services

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Service not found | Status = 'unknown', log warning |
| systemctl timeout | Status = 'unknown', continue with other services |
| No services configured | Empty services array in heartbeat |
| Permission denied | Status = 'unknown', log error |
| Service in 'activating' state | Map to 'running' or intermediate status |

## Test Scenarios

- [ ] Agent reads monitored_services from config
- [ ] Agent queries systemctl for each service
- [ ] Running service returns correct status and PID
- [ ] Stopped service returns 'stopped' status
- [ ] Failed service returns 'failed' status
- [ ] Heartbeat includes services array
- [ ] Hub stores service status from heartbeat
- [ ] Missing service handled gracefully

## Definition of Done


**Story-specific additions:**

- [ ] Agent tested with real systemd services
- [ ] Config format documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0004: Agent Script | Story | Draft |
| US0017: Service Schema | Story | Draft |

## Estimation

**Story Points:** 5

**Complexity:** Medium - agent enhancement with systemctl integration

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
