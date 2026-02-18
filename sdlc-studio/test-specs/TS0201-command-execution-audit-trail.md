# TS0201: Command Execution Audit Trail

> **Status:** Complete
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-30
> **Last Updated:** 2026-02-17

## Overview

Test specification for the command execution audit trail feature. Covers audit log creation, API querying with filters, immutability enforcement, and retention policy.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0155](../stories/US0155-command-execution-audit-trail.md) | Command Execution Audit Trail | P1 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0155 | AC1 | Audit Log Creation | TC01, TC02, TC03, TC04 | Pending |
| US0155 | AC2 | Audit Log API | TC05, TC06, TC07, TC08, TC09, TC10, TC11 | Pending |
| US0155 | AC3 | Immutability | TC12, TC13 | Pending |
| US0155 | AC4 | Retention Policy | TC14, TC15 | Pending |

**Coverage:** 4/4 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Service layer logic, truncation, validation |
| Integration | Yes | Database operations, API endpoints |
| E2E | No | Backend-only feature, no UI |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Database migrated, test fixtures loaded |
| External Services | None (SQLite for tests) |
| Test Data | Server fixtures, mock command results |

---

## Test Cases

### TC01: Audit entry created for successful command

**Type:** Integration | **Priority:** P0 | **Story:** US0155/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server exists and SSH is configured | Server in database |
| When | POST `/api/v1/servers/{id}/commands/execute` with valid command | Command executes |
| Then | Query command_audit_log table | Entry exists with server_id, command, exit_code=0, stdout, duration_ms |

**Assertions:**
- [ ] Audit entry created with matching server_id
- [ ] Audit entry command matches executed command
- [ ] exit_code is 0 for successful command
- [ ] stdout contains command output
- [ ] duration_ms is positive integer
- [ ] executed_at is within last 5 seconds
- [ ] executed_by is "dashboard"

---

### TC02: Audit entry created for failed command

**Type:** Integration | **Priority:** P0 | **Story:** US0155/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server exists | Server in database |
| When | Execute command that returns non-zero exit code | Command completes with error |
| Then | Query command_audit_log table | Entry exists with exit_code != 0, stderr populated |

**Assertions:**
- [ ] Audit entry created even for failed commands
- [ ] exit_code matches actual command exit code
- [ ] stderr contains error output

---

### TC03: stdout truncated at 10KB

**Type:** Unit | **Priority:** P1 | **Story:** US0155/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Command output is 15KB | Large output string |
| When | create_audit_log() is called | Truncation applied |
| Then | Stored stdout is 10KB with truncation marker | `... [truncated]` at end |

**Assertions:**
- [ ] stdout length <= 10240 bytes
- [ ] stdout ends with "... [truncated]"
- [ ] Original content preserved up to limit

---

### TC04: stderr truncated at 10KB

**Type:** Unit | **Priority:** P1 | **Story:** US0155/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Command stderr is 15KB | Large error string |
| When | create_audit_log() is called | Truncation applied |
| Then | Stored stderr is 10KB with truncation marker | `... [truncated]` at end |

**Assertions:**
- [ ] stderr length <= 10240 bytes
- [ ] stderr ends with "... [truncated]"

---

### TC05: GET /api/v1/audit/commands returns paginated results

**Type:** Integration | **Priority:** P0 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 150 audit entries exist | Entries in database |
| When | GET `/api/v1/audit/commands` | Default pagination |
| Then | Response contains 100 entries, total=150, page=1 | Paginated response |

**Assertions:**
- [ ] entries array has 100 items
- [ ] total is 150
- [ ] page is 1
- [ ] page_size is 100
- [ ] entries ordered by executed_at DESC

---

### TC06: Filter by server_id

**Type:** Integration | **Priority:** P0 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Audit entries for multiple servers | Mixed entries |
| When | GET `/api/v1/audit/commands?server_id=server1` | Filtered results |
| Then | Only entries for server1 returned | Correct filtering |

**Assertions:**
- [ ] All entries have server_id="server1"
- [ ] No entries from other servers

---

### TC07: Filter by action_type

**Type:** Integration | **Priority:** P0 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Audit entries with various action_types | Mixed entries |
| When | GET `/api/v1/audit/commands?action_type=restart_service` | Filtered results |
| Then | Only restart_service entries returned | Correct filtering |

**Assertions:**
- [ ] All entries have action_type="restart_service"

---

### TC08: Filter by date range

**Type:** Integration | **Priority:** P0 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Audit entries spanning 30 days | Varied dates |
| When | GET `/api/v1/audit/commands?from_date=2026-01-20&to_date=2026-01-25` | Date filtered |
| Then | Only entries within range returned | Correct filtering |

**Assertions:**
- [ ] All entries have executed_at >= from_date
- [ ] All entries have executed_at <= to_date

---

### TC09: Filter by success/failure

**Type:** Integration | **Priority:** P1 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Audit entries with mixed exit codes | Success and failures |
| When | GET `/api/v1/audit/commands?success_only=true` | Success filtered |
| Then | Only exit_code=0 entries returned | Correct filtering |

**Assertions:**
- [ ] All entries have exit_code=0 when success_only=true
- [ ] All entries have exit_code!=0 when success_only=false

---

### TC10: Pagination works correctly

**Type:** Integration | **Priority:** P1 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 250 audit entries exist | Many entries |
| When | GET `/api/v1/audit/commands?page=2&page_size=50` | Page 2 |
| Then | Entries 51-100 returned | Correct offset |

**Assertions:**
- [ ] entries array has 50 items
- [ ] total is 250
- [ ] page is 2
- [ ] Entries are items 51-100 (by executed_at DESC order)

---

### TC11: Empty page returns empty array

**Type:** Integration | **Priority:** P2 | **Story:** US0155/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 50 audit entries exist | Limited entries |
| When | GET `/api/v1/audit/commands?page=10` | Beyond data |
| Then | Empty entries array, total=50 | Graceful handling |

**Assertions:**
- [ ] entries array is empty []
- [ ] total is 50
- [ ] No error returned

---

### TC12: No update endpoint exists

**Type:** Unit | **Priority:** P0 | **Story:** US0155/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Audit router definition | Router code |
| When | Check for PUT/PATCH methods | No modification routes |
| Then | No update endpoints defined | Immutability enforced |

**Assertions:**
- [ ] No PUT /api/v1/audit/commands/{id} route
- [ ] No PATCH /api/v1/audit/commands/{id} route

---

### TC13: No delete endpoint exists

**Type:** Unit | **Priority:** P0 | **Story:** US0155/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Audit router definition | Router code |
| When | Check for DELETE methods | No delete routes |
| Then | No delete endpoints defined | Immutability enforced |

**Assertions:**
- [ ] No DELETE /api/v1/audit/commands/{id} route
- [ ] No DELETE /api/v1/audit/commands route (bulk delete)

---

### TC14: Retention cleanup removes old entries

**Type:** Unit | **Priority:** P1 | **Story:** US0155/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Entries 30, 60, 100 days old | Mixed ages |
| When | cleanup_old_audit_entries(retention_days=90) called | Cleanup runs |
| Then | 100-day entry deleted, others remain | Correct retention |

**Assertions:**
- [ ] Entry 100 days old is deleted
- [ ] Entry 60 days old remains
- [ ] Entry 30 days old remains

---

### TC15: Retention cleanup respects configuration

**Type:** Unit | **Priority:** P2 | **Story:** US0155/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | retention_days configured as 30 | Custom retention |
| When | cleanup_old_audit_entries() called | Uses config |
| Then | Entries > 30 days deleted | Configurable retention |

**Assertions:**
- [ ] Only entries older than configured days deleted
- [ ] Configuration read from settings

---

## Fixtures

```yaml
servers:
  - id: "test-server-1"
    hostname: "server1.example.com"
    status: "online"
  - id: "test-server-2"
    hostname: "server2.example.com"
    status: "online"

audit_entries:
  - id: "audit-1"
    server_id: "test-server-1"
    command: "systemctl restart nginx"
    action_type: "restart_service"
    exit_code: 0
    stdout: "Service restarted successfully"
    stderr: ""
    duration_ms: 1234
    executed_at: "2026-01-25T10:00:00Z"
    executed_by: "dashboard"
  - id: "audit-2"
    server_id: "test-server-1"
    command: "systemctl restart invalid"
    action_type: "restart_service"
    exit_code: 1
    stdout: ""
    stderr: "Unit invalid.service not found"
    duration_ms: 523
    executed_at: "2026-01-24T10:00:00Z"
    executed_by: "dashboard"
  - id: "audit-3"
    server_id: "test-server-2"
    command: "apt-get update"
    action_type: "apply_updates"
    exit_code: 0
    stdout: "Hit:1 http://archive.ubuntu.com..."
    stderr: ""
    duration_ms: 5432
    executed_at: "2026-01-23T10:00:00Z"
    executed_by: "dashboard"

large_output:
  stdout_15kb: |
    # 15KB of repeated output text for truncation testing
    # Generated programmatically in test setup
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Audit entry created for successful command | Pending | - |
| TC02 | Audit entry created for failed command | Pending | - |
| TC03 | stdout truncated at 10KB | Pending | - |
| TC04 | stderr truncated at 10KB | Pending | - |
| TC05 | GET /api/v1/audit/commands returns paginated results | Pending | - |
| TC06 | Filter by server_id | Pending | - |
| TC07 | Filter by action_type | Pending | - |
| TC08 | Filter by date range | Pending | - |
| TC09 | Filter by success/failure | Pending | - |
| TC10 | Pagination works correctly | Pending | - |
| TC11 | Empty page returns empty array | Pending | - |
| TC12 | No update endpoint exists | Pending | - |
| TC13 | No delete endpoint exists | Pending | - |
| TC14 | Retention cleanup removes old entries | Pending | - |
| TC15 | Retention cleanup respects configuration | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0013](../epics/EP0013-synchronous-command-execution.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-30 | Claude | Initial spec from story plan workflow |
