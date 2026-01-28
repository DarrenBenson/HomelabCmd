# PL0022: Agent Service Status Collection - Implementation Plan

> **Status:** Complete
> **Story:** [US0018: Agent Service Status Collection](../stories/US0018-agent-service-collection.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Extend the agent to collect systemd service status and include it in heartbeat payloads. The hub stores service status in the service_status table created by US0017. This enables monitoring of configured services like Plex, Sonarr, and Pi-hole.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Config includes monitored_services | Agent reads monitored_services list from config |
| AC2 | Agent collects service status | Queries systemctl for each configured service |
| AC3 | Heartbeat includes service data | Payload includes services array with status |
| AC4 | Status includes details | PID, memory_mb, cpu_percent for running services |
| AC5 | Hub stores service status | Service status stored in service_status table |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12
- **Framework:** FastAPI (hub), standalone script (agent)
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling (not bare except)
- Use subprocess with timeout
- Logging instead of print

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| Pydantic | /pydantic/pydantic | nested model validation | list[Model], optional fields |

### Existing Patterns

From codebase exploration:

1. **Agent collectors pattern:** `agent/collectors.py` - functions return dict, handle exceptions gracefully
2. **Subprocess pattern:** `get_package_updates()` uses subprocess.run with timeout and capture_output
3. **Heartbeat payload:** `agent/heartbeat.py` builds dict payload with optional fields
4. **Hub schemas:** `schemas/heartbeat.py` uses Pydantic BaseModel with Field()
5. **Hub route:** `routes/agents.py` processes heartbeat and stores to DB

Reference files:
- `agent/collectors.py` - Existing collectors for metrics, os_info, package_updates
- `agent/heartbeat.py` - Heartbeat sending with retry logic
- `agent/__main__.py` - Main loop collecting and sending
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - HeartbeatRequest/Response schemas
- `backend/src/homelab_cmd/api/routes/agents.py` - Heartbeat endpoint handler
- `backend/src/homelab_cmd/db/models/service.py` - ServiceStatus model

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Service collection involves subprocess calls to systemctl which are environment-dependent. Implement functionality first with manual testing, then write unit tests with mocked subprocess.

### Test Priority

1. Service status parsing from systemctl output
2. Heartbeat payload includes services correctly
3. Hub stores service status records

### Documentation Updates Required

- [ ] None required (config format already documented in story)

## Implementation Steps

### Phase 1: Agent Service Collector

**Goal:** Add functions to collect systemd service status

#### Step 1.1: Add get_service_status function

- [ ] Add `get_service_status(service_name: str) -> dict` to collectors.py
- [ ] Use subprocess.run with `systemctl show --property=ActiveState,MainPID,MemoryCurrent`
- [ ] Parse output and map ActiveState to status values
- [ ] Get CPU percent using psutil.Process(pid) if PID available
- [ ] Handle errors gracefully, return status='unknown' on failure

**Files to modify:**
- `agent/collectors.py` - Add service collection functions

**Implementation details:**

```python
def get_service_status(service_name: str) -> dict[str, Any]:
    """Get status of a systemd service.

    Returns dict with:
        name: service name
        status: running/stopped/failed/unknown
        pid: process ID if running
        memory_mb: memory usage in MB
        cpu_percent: CPU usage percentage
    """
```

ActiveState mapping:
- active → running
- inactive → stopped
- failed → failed
- activating → running
- deactivating → stopped
- reloading → running
- anything else → unknown

#### Step 1.2: Add get_all_services_status function

- [ ] Add `get_all_services_status(services: list[str]) -> list[dict]`
- [ ] Iterate over services and call get_service_status
- [ ] Return list of service status dicts

**Files to modify:**
- `agent/collectors.py` - Add wrapper function

### Phase 2: Agent Heartbeat Integration

**Goal:** Include service status in heartbeat payload

#### Step 2.1: Update send_heartbeat function

- [ ] Add `services: list[dict] | None` parameter to send_heartbeat
- [ ] Include services in payload when provided

**Files to modify:**
- `agent/heartbeat.py` - Add services parameter and include in payload

#### Step 2.2: Update main loop

- [ ] Check if config.monitored_services is configured
- [ ] Call get_all_services_status if services configured
- [ ] Pass services to send_heartbeat

**Files to modify:**
- `agent/__main__.py` - Add service collection to main loop

### Phase 3: Hub Schema Update

**Goal:** Accept service data in heartbeat requests

#### Step 3.1: Add ServiceStatusPayload schema

- [ ] Create ServiceStatusPayload Pydantic model
- [ ] Fields: name, status, pid, memory_mb, cpu_percent

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add ServiceStatusPayload

**Schema structure:**

```python
class ServiceStatusPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    status: str = Field(..., pattern="^(running|stopped|failed|unknown)$")
    pid: int | None = Field(None, ge=0)
    memory_mb: float | None = Field(None, ge=0)
    cpu_percent: float | None = Field(None, ge=0, le=100)
```

#### Step 3.2: Update HeartbeatRequest

- [ ] Add `services: list[ServiceStatusPayload] | None = None` field

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add services field

### Phase 4: Hub Route Update

**Goal:** Store service status in database

#### Step 4.1: Process and store service status

- [ ] Import ServiceStatus model
- [ ] After storing metrics, check if heartbeat.services provided
- [ ] Create ServiceStatus record for each service
- [ ] Use heartbeat.timestamp for status timestamp

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Add service status storage

**Implementation pattern:**

```python
# Store service status if provided (US0018)
if heartbeat.services:
    for svc in heartbeat.services:
        service_status = ServiceStatus(
            server_id=heartbeat.server_id,
            service_name=svc.name,
            status=svc.status,
            pid=svc.pid,
            memory_mb=svc.memory_mb,
            cpu_percent=svc.cpu_percent,
            timestamp=heartbeat.timestamp,
        )
        session.add(service_status)
```

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Agent Collector Tests

- [ ] Test get_service_status with mocked subprocess
- [ ] Test running service returns correct status and PID
- [ ] Test stopped service returns 'stopped' status
- [ ] Test failed service returns 'failed' status
- [ ] Test unknown/missing service handled gracefully
- [ ] Test get_all_services_status returns list

**Files to modify:**
- `tests/test_agent.py` - Add service collection tests

#### Step 5.2: Heartbeat Payload Tests

- [ ] Test send_heartbeat includes services in payload when provided
- [ ] Test send_heartbeat works without services (backward compatible)

**Files to modify:**
- `tests/test_agent.py` - Add heartbeat tests

#### Step 5.3: Hub Integration Tests

- [ ] Test heartbeat with services stores ServiceStatus records
- [ ] Test heartbeat without services still works
- [ ] Test invalid service status rejected by validation

**Files to modify:**
- `tests/test_heartbeat.py` - Add service storage tests

#### Step 5.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Config already has monitored_services field | Pending |
| AC2 | Test get_service_status calls systemctl | Pending |
| AC3 | Test heartbeat payload includes services | Pending |
| AC4 | Test service dict includes pid, memory_mb, cpu_percent | Pending |
| AC5 | Query service_status table after heartbeat | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Service not installed | systemctl returns unknown state, map to 'unknown' |
| systemctl timeout | 5 second timeout, return status='unknown', log warning |
| No services configured | Don't include services key or send empty array |
| Permission denied | Return status='unknown', log error |
| Service in activating state | Map to 'running' |
| MemoryCurrent unavailable | Return memory_mb=None |
| PID is 0 (no main process) | Return pid=None |
| CPU collection fails | Return cpu_percent=None |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slow collection for many services | Medium | 5s timeout per service, consider ThreadPoolExecutor |
| systemctl not available (containers) | Low | Check for systemctl, skip collection gracefully |
| Memory accounting disabled | Low | Handle None MemoryCurrent gracefully |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0017 | Story | Done - ServiceStatus table exists |
| US0004 | Story | Done - Agent script exists |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Ready for code review

## Notes

- AC1 (config field) is already implemented in config.py
- CPU collection via psutil.Process may require a brief interval for accuracy
- Consider making CPU collection optional if it slows heartbeat significantly
