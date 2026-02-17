# TS0203: Command Timeout Configuration Tests

> **Status:** Draft
> **Story:** [US0186: Command Timeout Configuration](../stories/US0186-command-timeout-configuration.md)
> **Plan:** [PL0203: Command Timeout Configuration](../plans/PL0203-command-timeout-configuration.md)
> **Created:** 2026-01-31

## Overview

Test specification for configurable command execution timeouts. Covers configuration CRUD, timeout lookup hierarchy, action execution with timeouts, and frontend display.

---

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0186](../stories/US0186-command-timeout-configuration.md) | Command Timeout Configuration | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0186 | AC1 | Global default timeout | TC01, TC02 | Pending |
| US0186 | AC2 | Per-command-type timeout | TC03, TC04, TC05 | Pending |
| US0186 | AC3 | Timeout displayed before execution | TC13, TC14 | Pending |
| US0186 | AC4 | Command cancelled on timeout | TC06, TC07, TC08, TC09 | Pending |
| US0186 | AC5 | Timeout visible in history | TC15, TC16 | Pending |
| US0186 | AC6 | API supports timeout parameter | TC10, TC11, TC12 | Pending |

**Coverage:** 6/6 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Configuration schemas, timeout lookup logic |
| Integration | Yes | API endpoints, action execution |
| E2E | Optional | Settings UI configuration flow |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Docker compose up, test database |
| External Services | None (SSH mocked in tests) |
| Test Data | Test server, test actions |

---

## Test Cases

### TC01: Get default timeout configuration

**Type:** Unit | **Priority:** High | **Story:** US0186/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No command timeout config exists | Config table has no `command_timeouts` key |
| When | GET `/api/v1/config/command-timeouts` | Request returns 200 |
| Then | Response contains defaults | `global_default: 300`, `service_restart: 60`, `package_update: 600` |

**Assertions:**
- [ ] Status code is 200
- [ ] Response has `global_default` field with value 300
- [ ] Response has `service_restart` field with value 60
- [ ] Response has `package_update` field with value 600

---

### TC02: Update global default timeout

**Type:** Integration | **Priority:** High | **Story:** US0186/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Default timeout configuration exists | API returns defaults |
| When | PUT `/api/v1/config/command-timeouts` with `{"global_default": 120}` | Request returns 200 |
| Then | Configuration is updated | `global_default: 120`, other fields unchanged |

**Assertions:**
- [ ] Status code is 200
- [ ] Response shows `global_default: 120`
- [ ] `service_restart` and `package_update` unchanged
- [ ] GET endpoint reflects updated value

---

### TC03: Service restart uses type-specific timeout

**Type:** Unit | **Priority:** High | **Story:** US0186/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Default configuration (service_restart: 60) | Config loaded |
| When | Call `get_timeout_for_action_type("restart_service")` | Returns timeout |
| Then | Returns 60 seconds | Service restart uses specific config |

**Assertions:**
- [ ] Return value is 60
- [ ] Does not return global_default (300)

---

### TC04: Package update uses type-specific timeout

**Type:** Unit | **Priority:** High | **Story:** US0186/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Default configuration (package_update: 600) | Config loaded |
| When | Call `get_timeout_for_action_type("apt_update")` | Returns timeout |
| Then | Returns 600 seconds | Package update uses specific config |

**Assertions:**
- [ ] Return value is 600
- [ ] Does not return global_default (300)

---

### TC05: Custom command uses global default

**Type:** Unit | **Priority:** High | **Story:** US0186/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Default configuration (global_default: 300) | Config loaded |
| When | Call `get_timeout_for_action_type("custom")` | Returns timeout |
| Then | Returns 300 seconds | Unknown type falls back to global |

**Assertions:**
- [ ] Return value is 300 (global_default)
- [ ] Works for any unrecognised action type

---

### TC06: Action execution respects configured timeout

**Type:** Integration | **Priority:** Critical | **Story:** US0186/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Service restart action created | Action status is APPROVED |
| When | Action is executed (with mocked slow command) | SSH executor called |
| Then | Timeout passed to executor is 60 | Uses service_restart config |

**Assertions:**
- [ ] SSH executor receives timeout=60
- [ ] Not hardcoded 300 or 30

---

### TC07: Command times out and sets timed_out_at

**Type:** Integration | **Priority:** Critical | **Story:** US0186/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action with 5s timeout (for testing) | Action created with timeout_seconds=5 |
| When | Command execution times out | CommandTimeoutError raised |
| Then | Action status is FAILED with timed_out_at set | Timestamp recorded |

**Assertions:**
- [ ] Action status is FAILED
- [ ] `timed_out_at` is not null
- [ ] `timed_out_at` is within 10s of execution start

---

### TC08: Timeout of 0 uses global default

**Type:** Unit | **Priority:** Medium | **Story:** US0186/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action created with timeout_seconds=0 | 0 is invalid timeout |
| When | Timeout is resolved for execution | Lookup function called |
| Then | Returns global_default (300) | 0 treated as "use default" |

**Assertions:**
- [ ] Return value is 300 (not 0)
- [ ] No infinite timeout allowed

---

### TC09: Very short timeout logs warning

**Type:** Unit | **Priority:** Low | **Story:** US0186/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action created with timeout_seconds=3 | Less than 5s threshold |
| When | Action is executed | Warning logged |
| Then | Execution proceeds with 3s timeout | Short timeout allowed |

**Assertions:**
- [ ] Warning message logged about short timeout
- [ ] Execution uses 3s timeout (not clamped)

---

### TC10: Action create accepts timeout_seconds

**Type:** Integration | **Priority:** High | **Story:** US0186/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid server exists | Server is active |
| When | POST `/api/v1/actions` with `timeout_seconds: 120` | Action created |
| Then | Action stored with timeout_seconds=120 | Override persisted |

**Assertions:**
- [ ] Status code is 201 or 200
- [ ] Response includes `timeout_seconds: 120`
- [ ] Database record has timeout_seconds=120

---

### TC11: Action execute uses override timeout

**Type:** Integration | **Priority:** High | **Story:** US0186/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action with timeout_seconds=45 | Override set |
| When | Action is executed | SSH executor called |
| Then | Timeout passed is 45 | Override takes precedence |

**Assertions:**
- [ ] SSH executor receives timeout=45
- [ ] Does not use type default or global default

---

### TC12: Commands API accepts timeout parameter

**Type:** Integration | **Priority:** High | **Story:** US0186/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid server with SSH connectivity | Can execute commands |
| When | POST `/api/v1/servers/{id}/commands/execute` with `timeout_seconds: 15` | Command executed |
| Then | Execution uses 15s timeout | Override respected |

**Assertions:**
- [ ] SSH executor receives timeout=15
- [ ] Not hardcoded 30s

---

### TC13: Action detail shows configured timeout

**Type:** Unit (Frontend) | **Priority:** High | **Story:** US0186/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action with timeout_seconds=60 | Mock action data |
| When | ActionDetailPanel renders | Component mounted |
| Then | Shows "Timeout: 60s" | Timeout visible |

**Assertions:**
- [ ] Text "Timeout: 60s" or "60 seconds" appears
- [ ] Displayed in action details section

---

### TC14: Pending action shows timeout before approval

**Type:** Unit (Frontend) | **Priority:** Medium | **Story:** US0186/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pending action with timeout_seconds=120 | Status is PENDING |
| When | PendingActionCard renders | Card displayed |
| Then | Shows timeout that will apply | User informed before approval |

**Assertions:**
- [ ] Timeout value displayed on card
- [ ] Shown before approve/reject buttons

---

### TC15: Timed out action shows failure message

**Type:** Unit (Frontend) | **Priority:** High | **Story:** US0186/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action with status=FAILED and timed_out_at set | Timed out action |
| When | ActionDetailPanel renders | Component mounted |
| Then | Shows "Timed out after Xs" | Clear timeout indication |

**Assertions:**
- [ ] Message contains "timed out" or "Timed out"
- [ ] Shows duration (difference between executed_at and timed_out_at)

---

### TC16: Action history shows timeout status

**Type:** Integration (Frontend) | **Priority:** Medium | **Story:** US0186/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action list includes timed out action | At least one with timed_out_at |
| When | Actions list renders | List displayed |
| Then | Timed out action distinguishable | Different from regular failure |

**Assertions:**
- [ ] Timed out action shows "Timed Out" or timeout indicator
- [ ] Duration visible in list or detail

---

### TC17: Settings UI displays timeout configuration

**Type:** E2E | **Priority:** Medium | **Story:** US0186/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Application running with default config | Navigate to Settings |
| When | Open command timeout settings section | Section visible |
| Then | Shows three timeout fields with defaults | 300, 60, 600 displayed |

**Assertions:**
- [ ] Global default input shows 300
- [ ] Service restart input shows 60
- [ ] Package update input shows 600

---

### TC18: Settings UI updates timeout configuration

**Type:** E2E | **Priority:** Medium | **Story:** US0186/AC1, AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Settings page open to timeout section | Current values displayed |
| When | Change global default to 180, save | PUT request sent |
| Then | Configuration updated, success shown | New value persisted |

**Assertions:**
- [ ] Save button triggers API call
- [ ] Success message displayed
- [ ] Page reload shows new value (180)

---

### TC19: Timeout hierarchy: override > type > global

**Type:** Unit | **Priority:** Critical | **Story:** US0186/AC2, AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Config: global=300, service_restart=60, action has timeout_seconds=30 | All three levels set |
| When | Resolve timeout for service restart action | Lookup function |
| Then | Returns 30 (action override) | Override has highest priority |

**Assertions:**
- [ ] Returns 30, not 60 (type) or 300 (global)
- [ ] Same action without override would return 60

---

### TC20: Partial config update preserves other fields

**Type:** Integration | **Priority:** Medium | **Story:** US0186/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Full config: global=300, restart=60, update=600 | All set |
| When | PUT with only `{"service_restart": 90}` | Partial update |
| Then | Only service_restart changes | 300, 90, 600 |

**Assertions:**
- [ ] global_default still 300
- [ ] service_restart now 90
- [ ] package_update still 600

---

### TC21: Invalid timeout values rejected

**Type:** Integration | **Priority:** Medium | **Story:** US0186/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid configuration exists | API accessible |
| When | PUT with `{"global_default": -10}` | Negative value |
| Then | Request rejected with 422 | Validation error |

**Assertions:**
- [ ] Status code is 422
- [ ] Error message indicates invalid value
- [ ] Config unchanged

---

### TC22: Action response includes timeout fields

**Type:** Integration | **Priority:** High | **Story:** US0186/AC5, AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action created with timeout_seconds=120 | Action exists |
| When | GET `/api/v1/actions/{id}` | Fetch action details |
| Then | Response includes timeout_seconds and timed_out_at | Fields present |

**Assertions:**
- [ ] Response has `timeout_seconds: 120`
- [ ] Response has `timed_out_at` field (null if not timed out)

---

### TC23: Migration adds timeout columns

**Type:** Unit | **Priority:** High | **Story:** US0186

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Database at previous version | No timeout columns |
| When | Run Alembic upgrade | Migration executes |
| Then | remediation_actions has timeout columns | Both columns exist |

**Assertions:**
- [ ] `timeout_seconds` column exists (nullable integer)
- [ ] `timed_out_at` column exists (nullable datetime)
- [ ] Migration is reversible (downgrade works)

---

### TC24: SSH connection drop is not timeout

**Type:** Unit | **Priority:** Medium | **Story:** US0186/EC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH executor raises SSHConnectionError | Connection failure |
| When | Action execution handles error | Error caught |
| Then | Action status is FAILED, timed_out_at is null | Not a timeout |

**Assertions:**
- [ ] Status is FAILED
- [ ] `timed_out_at` remains null
- [ ] Error message indicates connection failure, not timeout

---

### TC25: Timeout audit logging

**Type:** Integration | **Priority:** Low | **Story:** US0186/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Action that will time out | Short timeout configured |
| When | Action execution times out | Timeout occurs |
| Then | Audit log includes timeout information | Duration logged |

**Assertions:**
- [ ] Log entry created for timed out action
- [ ] Log includes timeout duration
- [ ] Log includes partial output if available

---

### TC26: Commands API timeout in audit log

**Type:** Integration | **Priority:** Low | **Story:** US0186/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Synchronous command execution | Via commands API |
| When | Command with custom timeout is executed | Audit logged |
| Then | Audit log includes timeout value used | For traceability |

**Assertions:**
- [ ] Audit log includes timeout_seconds field
- [ ] Shows actual timeout used (override or default)

---

## Fixtures

```yaml
test_server:
  id: "test-server-01"
  hostname: "test.local"
  status: "online"

test_action_pending:
  id: 1
  server_id: "test-server-01"
  action_type: "restart_service"
  service_name: "nginx"
  status: "pending"
  timeout_seconds: 60

test_action_timed_out:
  id: 2
  server_id: "test-server-01"
  action_type: "apt_update"
  status: "failed"
  timeout_seconds: 600
  executed_at: "2026-01-31T10:00:00Z"
  timed_out_at: "2026-01-31T10:10:00Z"

default_timeout_config:
  global_default: 300
  service_restart: 60
  package_update: 600
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Get default timeout configuration | Pending | - |
| TC02 | Update global default timeout | Pending | - |
| TC03 | Service restart uses type-specific timeout | Pending | - |
| TC04 | Package update uses type-specific timeout | Pending | - |
| TC05 | Custom command uses global default | Pending | - |
| TC06 | Action execution respects configured timeout | Pending | - |
| TC07 | Command times out and sets timed_out_at | Pending | - |
| TC08 | Timeout of 0 uses global default | Pending | - |
| TC09 | Very short timeout logs warning | Pending | - |
| TC10 | Action create accepts timeout_seconds | Pending | - |
| TC11 | Action execute uses override timeout | Pending | - |
| TC12 | Commands API accepts timeout parameter | Pending | - |
| TC13 | Action detail shows configured timeout | Pending | - |
| TC14 | Pending action shows timeout before approval | Pending | - |
| TC15 | Timed out action shows failure message | Pending | - |
| TC16 | Action history shows timeout status | Pending | - |
| TC17 | Settings UI displays timeout configuration | Pending | - |
| TC18 | Settings UI updates timeout configuration | Pending | - |
| TC19 | Timeout hierarchy: override > type > global | Pending | - |
| TC20 | Partial config update preserves other fields | Pending | - |
| TC21 | Invalid timeout values rejected | Pending | - |
| TC22 | Action response includes timeout fields | Pending | - |
| TC23 | Migration adds timeout columns | Pending | - |
| TC24 | SSH connection drop is not timeout | Pending | - |
| TC25 | Timeout audit logging | Pending | - |
| TC26 | Commands API timeout in audit log | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0004: Remediation Engine](../epics/EP0004-remediation.md) |
| Story | [US0186: Command Timeout Configuration](../stories/US0186-command-timeout-configuration.md) |
| Plan | [PL0203: Command Timeout Configuration](../plans/PL0203-command-timeout-configuration.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial spec with 26 test cases |
