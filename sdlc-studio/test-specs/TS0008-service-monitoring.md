# TS0008: Service Monitoring Tests

> **Status:** Complete
> **Epic:** [EP0003: Service Monitoring](../../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Last Updated:** 2026-01-19

## Overview

Test specification covering systemd service monitoring functionality including database models for expected services and service status, agent service status collection, expected services CRUD API, service status display in frontend, service-down alert generation, and service restart action queuing.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0017](../../stories/US0017-service-schema.md) | Service Schema and Database Tables | Must Have |
| [US0018](../../stories/US0018-agent-service-collection.md) | Agent Service Status Collection | Must Have |
| [US0019](../../stories/US0019-expected-services-api.md) | Expected Services Configuration API | Must Have |
| [US0020](../../stories/US0020-service-status-display.md) | Service Status Display in Server Detail | Should Have |
| [US0021](../../stories/US0021-service-alerts.md) | Service-Down Alert Generation | Must Have |
| [US0022](../../stories/US0022-service-restart-action.md) | Service Restart Action | Should Have |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Database models, schema validation, service collection logic |
| Integration | Yes | Service status stored via heartbeat, alert generation |
| API | Yes | CRUD endpoints for expected services, restart action endpoint |
| E2E | Yes | Service status display, restart button functionality |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | SQLite test database, pytest fixtures, Vitest + RTL |
| External Services | None (systemd mocked in agent tests) |
| Test Data | Servers, expected services, service status payloads |

---

## Test Cases

### TC115: ExpectedService table has all required fields

**Type:** Unit
**Priority:** Must Have
**Story:** US0017
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ExpectedService model definition | Model has all columns |
| 2 | When creating record with all fields | Record saves successfully |
| 3 | Then all fields accessible | id, server_id, service_name, display_name, is_critical, enabled, created_at |

#### Assertions

- [x] id is auto-incremented primary key
- [x] server_id links to Server
- [x] service_name is required string
- [x] display_name is optional
- [x] is_critical defaults to False
- [x] enabled defaults to True
- [x] created_at auto-populated

---

### TC116: ServiceStatus table stores historical records

**Type:** Unit
**Priority:** Must Have
**Story:** US0017
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ServiceStatus model | Model has required columns |
| 2 | When creating status record | Record saves with all fields |
| 3 | Then status values stored correctly | running/stopped/failed/unknown |

#### Assertions

- [x] status column accepts all ServiceStatusValue enum values
- [x] pid, memory_mb, cpu_percent are nullable
- [x] timestamp is required
- [x] server_id foreign key enforced

---

### TC117: ExpectedService links to Server

**Type:** Unit
**Priority:** Must Have
**Story:** US0017
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server and expected service | Both records exist |
| 2 | When accessing relationship | Navigation works |
| 3 | Then bidirectional navigation | service.server and server.expected_services |

#### Assertions

- [x] ExpectedService.server returns Server object
- [x] Server.expected_services returns list of services
- [x] Foreign key prevents orphan services

---

### TC118: Unique constraint on (server_id, service_name)

**Type:** Unit
**Priority:** Must Have
**Story:** US0017
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with service configured | Service exists |
| 2 | When creating duplicate service_name | IntegrityError raised |
| 3 | Then same name on different server allowed | No conflict |

#### Assertions

- [x] Duplicate (server_id, service_name) raises IntegrityError
- [x] Same service_name on different servers succeeds

---

### TC119: Cascade delete removes services when server deleted

**Type:** Unit
**Priority:** Must Have
**Story:** US0017
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with expected services and status history | Records exist |
| 2 | When server deleted | Cascade delete triggered |
| 3 | Then all related records removed | No orphan services or status |

#### Assertions

- [x] Expected services deleted with server
- [x] Service status records deleted with server

---

### TC120: Database indices exist for common queries

**Type:** Unit
**Priority:** Should Have
**Story:** US0017
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given database schema | Indices defined |
| 2 | When querying PRAGMA index_list | Indices found |
| 3 | Then indices cover key columns | server_id, timestamp, service_name |

#### Assertions

- [x] idx_expected_services_server exists
- [x] idx_service_status_server_time exists
- [x] idx_service_status_service exists

---

### TC121: Agent collects service status via systemctl

**Type:** Unit
**Priority:** Must Have
**Story:** US0018
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service name configured | Service to monitor |
| 2 | When get_service_status called | systemctl show executed |
| 3 | Then status dictionary returned | name, status, pid, memory_mb, cpu_percent |

#### Assertions

- [x] Status maps ActiveState to running/stopped/failed/unknown
- [x] PID extracted from MainPID property
- [x] Memory extracted from MemoryCurrent

---

### TC122: Agent handles container environment

**Type:** Unit
**Priority:** Must Have
**Story:** US0018
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given agent running in container | is_running_in_container returns True |
| 2 | When get_service_status called | Returns unknown with reason |
| 3 | Then status_reason explains unavailability | "systemd not available (container)" |

#### Assertions

- [x] Container detection via /.dockerenv, /run/.containerenv, cgroup
- [x] Status is "unknown" in container
- [x] status_reason field populated

---

### TC123: Agent handles systemctl timeout

**Type:** Unit
**Priority:** Must Have
**Story:** US0018
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given systemctl hangs | TimeoutExpired raised |
| 2 | When get_service_status called | Timeout handled gracefully |
| 3 | Then status_reason indicates timeout | "timeout" |

#### Assertions

- [x] Timeout after 5 seconds
- [x] Returns unknown status with reason

---

### TC124: Agent collects multiple services status

**Type:** Unit
**Priority:** Must Have
**Story:** US0018
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given list of services | ["plex", "nginx", "docker"] |
| 2 | When get_all_services_status called | Each service queried |
| 3 | Then list of status dicts returned | One dict per service |

#### Assertions

- [x] Returns list with one entry per service
- [x] Empty list for empty input

---

### TC125: List services returns empty for new server

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given new server with no services | Server registered |
| 2 | When GET /servers/{id}/services | List endpoint called |
| 3 | Then empty array returned | services=[], total=0 |

#### Assertions

- [x] Response 200
- [x] services array empty
- [x] total is 0

---

### TC126: List services returns all configured services

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with multiple services | Services configured |
| 2 | When GET /servers/{id}/services | List all |
| 3 | Then all services returned | With current_status if available |

#### Assertions

- [x] All configured services in response
- [x] current_status populated from latest heartbeat

---

### TC127: Create expected service with minimal fields

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server exists | Server registered |
| 2 | When POST with service_name only | Minimal create request |
| 3 | Then service created with defaults | is_critical=False, enabled=True |

#### Assertions

- [x] Response 201
- [x] display_name is null
- [x] is_critical defaults to False
- [x] enabled defaults to True

---

### TC128: Create expected service with all fields

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server exists | Server registered |
| 2 | When POST with all optional fields | Full create request |
| 3 | Then service created with provided values | All fields set |

#### Assertions

- [x] service_name, display_name, is_critical stored
- [x] is_critical can be True

---

### TC129: Create duplicate service returns 409

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service already exists | "nginx" configured |
| 2 | When POST same service_name | Duplicate request |
| 3 | Then 409 Conflict returned | CONFLICT code |

#### Assertions

- [x] Response 409
- [x] Error code CONFLICT

---

### TC130: Service name validation rejects invalid names

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given various service names | Valid and invalid patterns |
| 2 | When POST with each name | Validation applied |
| 3 | Then valid names accepted, invalid rejected | 422 for invalid |

#### Assertions

- [x] Lowercase alphanumeric accepted
- [x] Dots, hyphens, underscores, @ accepted
- [x] Uppercase rejected with 422
- [x] Spaces rejected with 422

---

### TC131: Update expected service fields

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service exists | Service configured |
| 2 | When PUT with partial update | Only some fields |
| 3 | Then only provided fields updated | Others unchanged |

#### Assertions

- [x] display_name updated independently
- [x] is_critical updated independently
- [x] enabled updated independently

---

### TC132: Delete expected service

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service exists | Service configured |
| 2 | When DELETE /servers/{id}/services/{name} | Delete request |
| 3 | Then service removed | 204 No Content |

#### Assertions

- [x] Response 204
- [x] Service no longer in list
- [x] Service status history preserved

---

### TC133: Services API requires authentication

**Type:** API
**Priority:** Must Have
**Story:** US0019
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no auth header | Unauthenticated request |
| 2 | When calling any services endpoint | All CRUD operations |
| 3 | Then 401 returned | Unauthorized |

#### Assertions

- [x] List returns 401 without auth
- [x] Create returns 401 without auth
- [x] Update returns 401 without auth
- [x] Delete returns 401 without auth

---

### TC134: ServiceStatusLED shows correct colour for each status

**Type:** E2E
**Priority:** Must Have
**Story:** US0020
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service with various statuses | running/stopped/failed/unknown |
| 2 | When LED component rendered | Status indicator shown |
| 3 | Then correct colour displayed | green/red/red/muted |

#### Assertions

- [x] Running shows green with pulse animation
- [x] Stopped shows red with glow
- [x] Failed shows red with glow
- [x] Unknown shows muted grey

---

### TC135: ServiceCard displays service information

**Type:** E2E
**Priority:** Must Have
**Story:** US0020
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given expected service with status | Service data provided |
| 2 | When ServiceCard rendered | Card component shown |
| 3 | Then all fields displayed | Name, status, resources |

#### Assertions

- [x] display_name shown when available
- [x] Falls back to service_name
- [x] Shows "Core Service" badge when is_critical
- [x] Shows PID, memory, CPU for running services

---

### TC136: ServicesPanel loads and displays services list

**Type:** E2E
**Priority:** Must Have
**Story:** US0020
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server detail page | Panel mounted |
| 2 | When services API called | Data loaded |
| 3 | Then services list rendered | ServiceCards for each service |

#### Assertions

- [x] Shows loading spinner initially
- [x] Shows service cards after loading
- [x] Shows empty message when no services
- [x] Shows error on API failure

---

### TC137: Critical service stopped creates HIGH severity alert

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given critical service (plex) configured | is_critical=True |
| 2 | When heartbeat reports stopped status | Service down |
| 3 | Then HIGH severity alert created | Alert persisted |

#### Assertions

- [x] Alert severity is "high"
- [x] Alert type is "service"
- [x] Alert title includes service name

---

### TC138: Non-critical service stopped creates MEDIUM severity alert

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given non-critical service (sonarr) | is_critical=False |
| 2 | When heartbeat reports stopped status | Service down |
| 3 | Then MEDIUM severity alert created | Alert persisted |

#### Assertions

- [x] Alert severity is "medium"
- [x] Alert type is "service"

---

### TC139: Unconfigured services do not trigger alerts

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service not in expected_services | Unknown service |
| 2 | When heartbeat reports stopped status | Status received |
| 3 | Then no alert created | Ignored |

#### Assertions

- [x] No alert for unconfigured services

---

### TC140: Disabled services do not trigger alerts

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service with enabled=False | Monitoring disabled |
| 2 | When heartbeat reports stopped status | Status received |
| 3 | Then no alert created | Disabled services skipped |

#### Assertions

- [x] No alert when enabled=False

---

### TC141: Service alert auto-resolves when service starts

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given open service alert | Alert exists |
| 2 | When heartbeat reports running status | Service recovered |
| 3 | Then alert resolved | auto_resolved=True |

#### Assertions

- [x] Alert status changes to resolved
- [x] auto_resolved flag is True
- [x] resolved_at timestamp set

---

### TC142: No duplicate alerts for same service

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service already has open alert | Alert exists |
| 2 | When subsequent heartbeat still stopped | Same condition |
| 3 | Then no new alert created | Deduplication |

#### Assertions

- [x] Only one open alert per service
- [x] New alert after resolution allowed

---

### TC143: Service alert title includes service name

**Type:** Integration
**Priority:** Must Have
**Story:** US0021
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service "plex" stopped | Alert generated |
| 2 | When alert record created | Persisted |
| 3 | Then title contains "plex" | Service identifiable |

#### Assertions

- [x] Service name in alert title
- [x] Alert type is "service"

---

### TC144: Restart action creates pending remediation

**Type:** API
**Priority:** Must Have
**Story:** US0022
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server exists | Server registered |
| 2 | When POST /servers/{id}/services/{name}/restart | Restart requested |
| 3 | Then pending action created | Status=pending |

#### Assertions

- [x] Response 201
- [x] Status is "pending"
- [x] action_type is "restart_service"

---

### TC145: Restart response includes action details

**Type:** API
**Priority:** Must Have
**Story:** US0022
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given restart request | POST to restart endpoint |
| 2 | When action created | Response returned |
| 3 | Then all fields present | action_id, command, status, etc. |

#### Assertions

- [x] action_id returned
- [x] command is "systemctl restart {service_name}"
- [x] server_id and service_name in response
- [x] created_at timestamp present

---

### TC146: Duplicate pending restart returns 409

**Type:** API
**Priority:** Must Have
**Story:** US0022
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given pending restart action exists | First restart queued |
| 2 | When second restart requested | Same service |
| 3 | Then 409 Conflict returned | With existing_action_id |

#### Assertions

- [x] Response 409
- [x] existing_action_id in response
- [x] Different services can have pending actions

---

### TC147: Restart works for any service (configured or not)

**Type:** API
**Priority:** Should Have
**Story:** US0022
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with no expected services | No configuration |
| 2 | When restart requested for any service | Unconfigured service |
| 3 | Then action created | User intent honoured |

#### Assertions

- [x] Restart works without expected_services entry
- [x] Works for running services too

---

### TC148: ServiceCard shows restart button for stopped services

**Type:** E2E
**Priority:** Should Have
**Story:** US0022
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given service with status=stopped | Service down |
| 2 | When ServiceCard rendered | Card displayed |
| 3 | Then restart button visible | Can trigger restart |

#### Assertions

- [x] Button shown for stopped services
- [x] Button hidden for running services
- [x] Button disabled during restart in progress
- [x] onRestart callback triggered on click

---

## Fixtures

```yaml
# Shared test data for this spec
servers:
  - id: test-server
    hostname: test-server.local
    display_name: Test Server

expected_services:
  - server_id: test-server
    service_name: plex
    display_name: Plex Media Server
    is_critical: true
    enabled: true
  - server_id: test-server
    service_name: sonarr
    display_name: Sonarr
    is_critical: false
    enabled: true
  - server_id: test-server
    service_name: radarr
    display_name: Radarr
    is_critical: false
    enabled: false

service_statuses:
  running:
    status: running
    pid: 12345
    memory_mb: 256.5
    cpu_percent: 2.3
  stopped:
    status: stopped
    pid: null
    memory_mb: null
    cpu_percent: null
  failed:
    status: failed
    pid: null
    memory_mb: null
    cpu_percent: null
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC115 | ExpectedService table has all required fields | Automated | `tests/test_service_models.py::TestExpectedServiceModel` |
| TC116 | ServiceStatus table stores historical records | Automated | `tests/test_service_models.py::TestServiceStatusModel` |
| TC117 | ExpectedService links to Server | Automated | `tests/test_service_models.py::TestServiceServerRelationship` |
| TC118 | Unique constraint on (server_id, service_name) | Automated | `tests/test_service_models.py::TestUniqueConstraint` |
| TC119 | Cascade delete removes services | Automated | `tests/test_service_models.py::TestCascadeDelete` |
| TC120 | Database indices exist for common queries | Automated | `tests/test_service_models.py::TestServiceIndices` |
| TC121 | Agent collects service status via systemctl | Automated | `tests/test_agent.py::TestServiceStatusCollection` |
| TC122 | Agent handles container environment | Automated | `tests/test_agent.py::TestContainerDetection` |
| TC123 | Agent handles systemctl timeout | Automated | `tests/test_agent.py::TestServiceStatusCollection` |
| TC124 | Agent collects multiple services status | Automated | `tests/test_agent.py::TestServiceStatusCollection` |
| TC125 | List services returns empty for new server | Automated | `tests/test_services_api.py::TestListServerServices` |
| TC126 | List services returns all configured services | Automated | `tests/test_services_api.py::TestListServerServices` |
| TC127 | Create expected service with minimal fields | Automated | `tests/test_services_api.py::TestCreateExpectedService` |
| TC128 | Create expected service with all fields | Automated | `tests/test_services_api.py::TestCreateExpectedService` |
| TC129 | Create duplicate service returns 409 | Automated | `tests/test_services_api.py::TestCreateExpectedService` |
| TC130 | Service name validation rejects invalid names | Automated | `tests/test_services_api.py::TestServiceNameValidation` |
| TC131 | Update expected service fields | Automated | `tests/test_services_api.py::TestUpdateExpectedService` |
| TC132 | Delete expected service | Automated | `tests/test_services_api.py::TestDeleteExpectedService` |
| TC133 | Services API requires authentication | Automated | `tests/test_services_api.py::*::test_*_requires_auth` |
| TC134 | ServiceStatusLED shows correct colour | Automated | `frontend/src/components/ServiceStatusLED.test.tsx` |
| TC135 | ServiceCard displays service information | Automated | `frontend/src/components/ServiceCard.test.tsx` |
| TC136 | ServicesPanel loads and displays list | Automated | `frontend/src/components/ServicesPanel.test.tsx` |
| TC137 | Critical service stopped creates HIGH alert | Automated | `tests/test_service_alerting.py::TestCriticalServiceAlert` |
| TC138 | Non-critical service stopped creates MEDIUM alert | Automated | `tests/test_service_alerting.py::TestNonCriticalServiceAlert` |
| TC139 | Unconfigured services do not trigger alerts | Automated | `tests/test_service_alerting.py::TestUnconfiguredServiceIgnored` |
| TC140 | Disabled services do not trigger alerts | Automated | `tests/test_service_alerting.py::TestDisabledServiceIgnored` |
| TC141 | Service alert auto-resolves when service starts | Automated | `tests/test_service_alerting.py::TestServiceAlertAutoResolve` |
| TC142 | No duplicate alerts for same service | Automated | `tests/test_service_alerting.py::TestServiceAlertDeduplication` |
| TC143 | Service alert title includes service name | Automated | `tests/test_service_alerting.py::TestAlertIncludesServiceName` |
| TC144 | Restart action creates pending remediation | Automated | `tests/test_service_restart.py::TestRestartServiceEndpoint` |
| TC145 | Restart response includes action details | Automated | `tests/test_service_restart.py::TestRestartServiceEndpoint` |
| TC146 | Duplicate pending restart returns 409 | Automated | `tests/test_service_restart.py::TestRestartDuplicateDetection` |
| TC147 | Restart works for any service | Automated | `tests/test_service_restart.py::TestRestartAllowsAnyService` |
| TC148 | ServiceCard shows restart button | Automated | `frontend/src/components/ServiceCard.test.tsx::restart button` |

## Test Counts

| Test File | Pytest Tests | Coverage |
|-----------|--------------|----------|
| `tests/test_service_models.py` | 21 | US0017 |
| `tests/test_services_api.py` | 27 | US0019 |
| `tests/test_service_alerting.py` | 14 | US0021 |
| `tests/test_service_restart.py` | 11 | US0022 |
| **Backend Total** | **73** | |
| `ServiceStatusLED.test.tsx` | 6 | US0020 |
| `ServiceCard.test.tsx` | 18 | US0020, US0022 |
| `ServicesPanel.test.tsx` | 8 | US0020 |
| **Frontend Total** | **32** | |

**Grand Total:** 105 tests

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| Epic | [EP0003](../../epics/EP0003-service-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial spec generation from existing tests |
