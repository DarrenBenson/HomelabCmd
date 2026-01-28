# TS0001: Core Monitoring API Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Last Updated:** 2026-01-19

## Overview

Test specification for the Core Monitoring API endpoints including database schema, server registration, agent heartbeat, and server status detection. This spec covers the backend API functionality that forms the foundation of the monitoring platform.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0045](../../stories/US0045-api-infrastructure.md) | API Infrastructure and Authentication | High |
| [US0001](../../stories/US0001-database-schema.md) | Database Schema and Migrations | High |
| [US0002](../../stories/US0002-server-registration-api.md) | Server Registration API | High |
| [US0003](../../stories/US0003-agent-heartbeat-endpoint.md) | Agent Heartbeat Endpoint | High |
| [US0008](../../stories/US0008-server-status-detection.md) | Server Status Detection | Medium |
| [US0009](../../stories/US0009-data-retention-pruning.md) | Data Retention and Pruning | Low |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Validate Pydantic models, business logic functions |
| Integration | Yes | Database operations, model relationships |
| API | Yes | Endpoint behaviour, authentication, response schemas |
| E2E | No | Covered by API tests; no UI in this spec |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, httpx |
| External Services | None (SQLite in-memory) |
| Test Data | Factory fixtures for Server, Metrics models |

---

## Test Cases

### TC001: Database session creation works

**Type:** Integration
**Priority:** High
**Story:** US0001
**Automated:** Yes (tests/test_auth.py exists)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the application is starting | Database engine initialised |
| 2 | When a session is requested | Async session created successfully |
| 3 | Then queries can be executed | Basic SELECT returns without error |

#### Test Data

```yaml
input:
  database_url: "sqlite+aiosqlite:///:memory:"
expected:
  session_created: true
```

#### Assertions

- [ ] Async engine creates without error
- [ ] Session can be acquired
- [ ] Basic query executes successfully

---

### TC002: Server model creation and retrieval

**Type:** Integration
**Priority:** High
**Story:** US0001
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an empty database | No servers exist |
| 2 | When a Server is created with valid data | Server persisted |
| 3 | Then the server can be queried by ID | Correct data returned |

#### Test Data

```yaml
input:
  id: "omv-mediaserver"
  hostname: "omv-mediaserver"
  display_name: "Media Server"
  ip_address: "192.168.1.100"
  status: "unknown"
  tdp_watts: 65
expected:
  server_exists: true
  fields_match: true
```

#### Assertions

- [ ] Server ID matches input
- [ ] Hostname stored correctly
- [ ] Status defaults to "unknown"
- [ ] created_at timestamp auto-populated
- [ ] updated_at timestamp auto-populated

---

### TC003: Metrics model with server relationship

**Type:** Integration
**Priority:** High
**Story:** US0001
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server exists in the database | Server ID available |
| 2 | When metrics are created with that server_id | Metrics persisted |
| 3 | Then metrics can be queried by server relationship | Correct metrics returned |

#### Test Data

```yaml
input:
  server_id: "omv-mediaserver"
  timestamp: "2026-01-18T10:30:00Z"
  cpu_percent: 45.5
  memory_percent: 67.2
  disk_percent: 82.0
expected:
  metrics_stored: true
  relationship_valid: true
```

#### Assertions

- [ ] Metrics record created
- [ ] Foreign key to server valid
- [ ] All numeric fields stored correctly
- [ ] Timestamp stored with timezone

---

### TC004: Foreign key prevents orphan metrics

**Type:** Integration
**Priority:** High
**Story:** US0001
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no server with ID "nonexistent" | Server does not exist |
| 2 | When metrics are created with server_id "nonexistent" | Database error raised |
| 3 | Then the metrics are not persisted | Foreign key constraint violated |

#### Test Data

```yaml
input:
  server_id: "nonexistent"
  cpu_percent: 50.0
expected:
  error: "IntegrityError"
  metrics_created: false
```

#### Assertions

- [ ] IntegrityError or equivalent raised
- [ ] No metrics record in database
- [ ] Error message indicates FK violation

---

### TC005: Index exists on metrics(server_id, timestamp)

**Type:** Integration
**Priority:** Medium
**Story:** US0001
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the database schema is created | Tables exist |
| 2 | When querying SQLite schema info | Index metadata available |
| 3 | Then idx_metrics_server_timestamp index exists | Index found |

#### Test Data

```yaml
input:
  query: "PRAGMA index_list(metrics)"
expected:
  index_name: "idx_metrics_server_timestamp"
```

#### Assertions

- [ ] Index appears in PRAGMA output
- [ ] Index covers server_id and timestamp columns

---

### TC006: List all servers returns empty array

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given database is empty | No servers |
| 2 | When GET /api/v1/servers is called | 200 OK |
| 3 | Then response contains empty servers array | [] |

#### Test Data

```yaml
input:
  method: GET
  endpoint: "/api/v1/servers"
  headers:
    X-API-Key: "test-api-key"
expected:
  status_code: 200
  body:
    servers: []
```

#### Assertions

- [ ] Status code is 200
- [ ] Response has "servers" key
- [ ] Servers array is empty

---

### TC007: Register new server successfully

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid server registration data | Payload prepared |
| 2 | When POST /api/v1/servers is called | 201 Created |
| 3 | Then server created with status "unknown" | Server in response |

#### Test Data

```yaml
input:
  method: POST
  endpoint: "/api/v1/servers"
  body:
    id: "omv-mediaserver"
    hostname: "omv-mediaserver"
    display_name: "Media Server"
    ip_address: "192.168.1.100"
    tdp_watts: 65
expected:
  status_code: 201
  body:
    id: "omv-mediaserver"
    status: "unknown"
```

#### Assertions

- [ ] Status code is 201
- [ ] Response contains server ID
- [ ] Status defaults to "unknown"
- [ ] All provided fields returned

---

### TC008: Duplicate server_id returns 409

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server "omv-mediaserver" already exists | Server registered |
| 2 | When POST /api/v1/servers with same ID | 409 Conflict |
| 3 | Then error message indicates duplicate | Error returned |

#### Test Data

```yaml
input:
  method: POST
  endpoint: "/api/v1/servers"
  body:
    id: "omv-mediaserver"
    hostname: "duplicate"
expected:
  status_code: 409
  body:
    detail:
      code: "CONFLICT"
```

#### Assertions

- [ ] Status code is 409
- [ ] Error code is "CONFLICT"
- [ ] Original server unchanged

---

### TC009: Get server details returns full data

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server "omv-mediaserver" exists with metrics | Server and metrics in DB |
| 2 | When GET /api/v1/servers/omv-mediaserver | 200 OK |
| 3 | Then response includes server details and latest metrics | Full data |

#### Test Data

```yaml
input:
  method: GET
  endpoint: "/api/v1/servers/omv-mediaserver"
expected:
  status_code: 200
  body:
    id: "omv-mediaserver"
    latest_metrics:
      cpu_percent: 45.5
```

#### Assertions

- [ ] Status code is 200
- [ ] All server fields present
- [ ] latest_metrics included (if available)
- [ ] OS info included (if available)

---

### TC010: Get nonexistent server returns 404

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no server with ID "nonexistent" | Server missing |
| 2 | When GET /api/v1/servers/nonexistent | 404 Not Found |
| 3 | Then error response with NOT_FOUND code | Error |

#### Test Data

```yaml
input:
  method: GET
  endpoint: "/api/v1/servers/nonexistent"
expected:
  status_code: 404
  body:
    detail:
      code: "NOT_FOUND"
```

#### Assertions

- [ ] Status code is 404
- [ ] Error code is "NOT_FOUND"

---

### TC011: Update server configuration

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server "omv-mediaserver" exists | Server in DB |
| 2 | When PUT /api/v1/servers/omv-mediaserver with new display_name | 200 OK |
| 3 | Then server updated with new values | Updated response |

#### Test Data

```yaml
input:
  method: PUT
  endpoint: "/api/v1/servers/omv-mediaserver"
  body:
    display_name: "Updated Media Server"
    tdp_watts: 75
expected:
  status_code: 200
  body:
    display_name: "Updated Media Server"
    tdp_watts: 75
```

#### Assertions

- [ ] Status code is 200
- [ ] display_name updated
- [ ] tdp_watts updated
- [ ] updated_at timestamp changed

---

### TC012: Delete server removes server and metrics

**Type:** API
**Priority:** High
**Story:** US0002
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server "omv-testserver" exists with metrics | Server and metrics in DB |
| 2 | When DELETE /api/v1/servers/omv-testserver | 204 No Content |
| 3 | Then server and associated metrics removed | Cascade delete |

#### Test Data

```yaml
input:
  method: DELETE
  endpoint: "/api/v1/servers/omv-testserver"
expected:
  status_code: 204
  server_exists_after: false
  metrics_exist_after: false
```

#### Assertions

- [ ] Status code is 204
- [ ] Server no longer in database
- [ ] Associated metrics deleted

---

### TC013: Heartbeat stores metrics

**Type:** API
**Priority:** High
**Story:** US0003
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server "omv-mediaserver" exists | Server in DB |
| 2 | When POST /api/v1/agents/heartbeat with metrics | 200 OK |
| 3 | Then metrics stored with current timestamp | Metrics persisted |

#### Test Data

```yaml
input:
  method: POST
  endpoint: "/api/v1/agents/heartbeat"
  body:
    server_id: "omv-mediaserver"
    timestamp: "2026-01-18T10:30:00Z"
    metrics:
      cpu_percent: 45.5
      memory_percent: 67.2
      disk_percent: 82.0
      load_1m: 1.5
      load_5m: 1.2
      load_15m: 0.9
      uptime_seconds: 86400
expected:
  status_code: 200
  metrics_stored: true
```

#### Assertions

- [ ] Status code is 200
- [ ] New metrics row in database
- [ ] All metric values stored correctly

---

### TC014: Heartbeat updates server status to online

**Type:** API
**Priority:** High
**Story:** US0003
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server status is "offline" | Server.status = "offline" |
| 2 | When heartbeat received | POST processed |
| 3 | Then server status changes to "online" | Status updated |

#### Test Data

```yaml
input:
  initial_status: "offline"
  heartbeat:
    server_id: "omv-mediaserver"
expected:
  final_status: "online"
  last_seen_updated: true
```

#### Assertions

- [ ] Server status changed to "online"
- [ ] last_seen timestamp updated

---

### TC015: Heartbeat auto-registers unknown server

**Type:** API
**Priority:** High
**Story:** US0003
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no server with ID "new-server" | Server not in DB |
| 2 | When heartbeat received from "new-server" | POST processed |
| 3 | Then new server record created | Server auto-registered |

#### Test Data

```yaml
input:
  heartbeat:
    server_id: "new-server"
    hostname: "new-server.home.lan"
    os_info:
      distribution: "Debian"
      version: "12"
expected:
  server_created: true
  status: "online"
```

#### Assertions

- [ ] New server record exists
- [ ] Server status is "online"
- [ ] OS info populated from heartbeat
- [ ] Hostname set from heartbeat

---

### TC016: Heartbeat updates OS info

**Type:** API
**Priority:** Medium
**Story:** US0003
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server exists with null OS info | os_distribution = null |
| 2 | When heartbeat includes OS info | POST processed |
| 3 | Then server OS fields updated | OS info stored |

#### Test Data

```yaml
input:
  heartbeat:
    server_id: "omv-mediaserver"
    os_info:
      distribution: "Debian GNU/Linux"
      version: "12 (bookworm)"
      kernel: "6.1.0-18-amd64"
      architecture: "x86_64"
expected:
  os_distribution: "Debian GNU/Linux"
  os_version: "12 (bookworm)"
  kernel_version: "6.1.0-18-amd64"
  architecture: "x86_64"
```

#### Assertions

- [ ] os_distribution updated
- [ ] os_version updated
- [ ] kernel_version updated
- [ ] architecture updated

---

### TC017: Heartbeat response includes pending commands

**Type:** API
**Priority:** Medium
**Story:** US0003
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no pending commands for server | Empty queue |
| 2 | When heartbeat processed | Response generated |
| 3 | Then response includes empty pending_commands array | [] |

#### Test Data

```yaml
input:
  heartbeat:
    server_id: "omv-mediaserver"
expected:
  response:
    received: true
    server_time: "<ISO8601>"
    pending_commands: []
```

#### Assertions

- [ ] Response has "received" = true
- [ ] Response has "server_time" timestamp
- [ ] Response has "pending_commands" array (empty for MVP)

---

### TC018: Server marked offline after 180s

**Type:** Integration
**Priority:** High
**Story:** US0008
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server last_seen was 180+ seconds ago | Stale server |
| 2 | When offline detection job runs | Job executes |
| 3 | Then server status changed to "offline" | Status updated |

#### Test Data

```yaml
input:
  server_id: "omv-mediaserver"
  last_seen: "2026-01-18T10:25:00Z"  # >180s ago
  current_time: "2026-01-18T10:30:00Z"
  threshold_seconds: 180
expected:
  status: "offline"
```

#### Assertions

- [ ] Server status is "offline"
- [ ] Status change logged

---

### TC019: Recently active server stays online

**Type:** Integration
**Priority:** Medium
**Story:** US0008
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server last_seen was 60 seconds ago | Recent heartbeat |
| 2 | When offline detection job runs | Job executes |
| 3 | Then server status remains "online" | No change |

#### Test Data

```yaml
input:
  server_id: "omv-mediaserver"
  last_seen: "2026-01-18T10:29:00Z"  # 60s ago
  current_time: "2026-01-18T10:30:00Z"
expected:
  status: "online"
```

#### Assertions

- [ ] Server status unchanged
- [ ] Still "online"

---

### TC020: Data pruning removes old metrics

**Type:** Integration
**Priority:** Low
**Story:** US0009
**Automated:** Yes

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given metrics older than 30 days exist | Old data in DB |
| 2 | When pruning job runs | Job executes |
| 3 | Then old metrics deleted, recent preserved | Cleanup complete |

#### Test Data

```yaml
input:
  metrics_dates:
    - "2025-12-01T10:00:00Z"  # >30 days old, delete
    - "2026-01-17T10:00:00Z"  # recent, keep
  retention_days: 30
expected:
  deleted_count: 1
  preserved_count: 1
```

#### Assertions

- [ ] Old metrics deleted
- [ ] Recent metrics preserved
- [ ] Correct count deleted

---

## Fixtures

```yaml
# Shared test data for this spec
servers:
  media_server:
    id: "omv-mediaserver"
    hostname: "omv-mediaserver"
    display_name: "Media Server"
    ip_address: "192.168.1.100"
    status: "online"
    tdp_watts: 65
    os_distribution: "Debian GNU/Linux"
    os_version: "12 (bookworm)"
    kernel_version: "6.1.0-18-amd64"
    architecture: "x86_64"

  backup_server:
    id: "omv-backupserver"
    hostname: "omv-backupserver"
    display_name: "Backup Server"
    ip_address: "192.168.1.101"
    status: "offline"
    tdp_watts: 40

metrics:
  sample_metrics:
    cpu_percent: 45.5
    memory_percent: 67.2
    memory_total_mb: 8192
    memory_used_mb: 5505
    disk_percent: 82.0
    disk_total_gb: 2000.0
    disk_used_gb: 1640.0
    network_rx_bytes: 1073741824
    network_tx_bytes: 536870912
    load_1m: 1.5
    load_5m: 1.2
    load_15m: 0.9
    uptime_seconds: 86400

api_key: "test-api-key-12345"
```

## Automation Status

| TC | Title | Status | Implementation | Tests |
|----|-------|--------|----------------|-------|
| TC001 | Database session creation works | Implemented | tests/test_database.py | 3 |
| TC002 | Server model creation and retrieval | Implemented | tests/test_database.py | 7 |
| TC003 | Metrics model with server relationship | Implemented | tests/test_database.py | 4 |
| TC004 | Foreign key prevents orphan metrics | Implemented | tests/test_database.py | 2 |
| TC005 | Index exists on metrics | Implemented | tests/test_database.py | 2 |
| TC006 | List all servers returns empty array | Implemented | tests/test_servers.py | 4 |
| TC007 | Register new server successfully | Implemented | tests/test_servers.py | 4 |
| TC008 | Duplicate server_id returns 409 | Implemented | tests/test_servers.py | 2 |
| TC009 | Get server details returns full data | Implemented | tests/test_servers.py | 2 |
| TC010 | Get nonexistent server returns 404 | Implemented | tests/test_servers.py | 2 |
| TC011 | Update server configuration | Implemented | tests/test_servers.py | 3 |
| TC012 | Delete server removes server and metrics | Implemented | tests/test_servers.py | 3 |
| TC013 | Heartbeat stores metrics | Implemented | tests/test_heartbeat.py | 3 |
| TC014 | Heartbeat updates server status | Implemented | tests/test_heartbeat.py | 2 |
| TC015 | Heartbeat auto-registers unknown server | Implemented | tests/test_heartbeat.py | 5 |
| TC016 | Heartbeat updates OS info | Implemented | tests/test_heartbeat.py | 4 |
| TC017 | Heartbeat response includes pending commands | Implemented | tests/test_heartbeat.py | 3 |
| TC018 | Server marked offline after 180s | Implemented | tests/test_status_detection.py | 3 |
| TC019 | Recently active server stays online | Implemented | tests/test_status_detection.py | 3 |
| TC020 | Data pruning removes old metrics | Implemented | tests/test_status_detection.py | 6 |

**Summary:**
- **Total tests:** 93 passing
- **Implemented:** TC001-TC020 (US0001-US0009) - All test cases fully automated
- **Coverage:** 100% of specified test cases

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial spec generation from EP0001 stories |
| 2026-01-19 | Claude | Updated automation status - all TC001-TC020 fully implemented (93 tests passing) |
