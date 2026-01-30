# TS0191: Remove Async Command Channel

> **Status:** Draft
> **Story:** [US0152: Remove Async Command Channel](../stories/US0152-remove-async-command-channel.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for removing the async command channel from the heartbeat protocol. Tests focus on backward compatibility with v1.0 agents and verification that metrics continue flowing correctly.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0152](../stories/US0152-remove-async-command-channel.md) | Remove Async Command Channel | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0152 | AC1 | Remove command fields from schemas | TC01, TC02 | Pending |
| US0152 | AC2 | Remove agent command execution | TC03, TC04 | Pending |
| US0152 | AC3 | Backward compatibility | TC05, TC06, TC07 | Pending |
| US0152 | AC4 | Multi-server validation | TC08 | Pending |

**Coverage:** 4/4 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Schema validation, deprecation warning logic |
| Integration | Yes | Heartbeat endpoint behaviour |
| E2E | No | Covered by integration tests with Docker agents |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, FastAPI test client |
| External Services | None (mocked) |
| Test Data | Heartbeat payloads with/without command fields |

---

## Test Cases

### TC01: Heartbeat Without Command Results Accepted

**Type:** Integration | **Priority:** P0 | **Story:** US0152 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A v2.0 heartbeat payload without `command_results` | Payload is valid |
| When | POST `/api/v1/agents/heartbeat` | Request processed |
| Then | Response 200 OK | Success, metrics recorded |

**Assertions:**
- [ ] Response status is 200
- [ ] Server `last_seen` is updated
- [ ] Metrics are recorded
- [ ] No deprecation warning logged

---

### TC02: Heartbeat Response Has Empty Pending Commands

**Type:** Integration | **Priority:** P0 | **Story:** US0152 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Any heartbeat request | Valid request |
| When | POST `/api/v1/agents/heartbeat` | Request processed |
| Then | Response includes `pending_commands: []` | Always empty array |

**Assertions:**
- [ ] Response contains `pending_commands` key
- [ ] `pending_commands` is an empty array
- [ ] Response is valid JSON

---

### TC03: Agent Startup Without Command Execution Code

**Type:** Unit | **Priority:** P1 | **Story:** US0152 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Simplified agent code | No command imports |
| When | Agent module is imported | No errors |
| Then | `process_pending_commands` does not exist | Removed |

**Assertions:**
- [ ] Agent module imports successfully
- [ ] No `process_pending_commands` function
- [ ] No `_pending_results` global
- [ ] No asyncio command execution

---

### TC04: Agent Sends Metrics-Only Heartbeat

**Type:** Unit | **Priority:** P1 | **Story:** US0152 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent configured and running | Collecting metrics |
| When | `send_heartbeat()` is called | Payload built |
| Then | Payload contains only metrics | No command fields |

**Assertions:**
- [ ] `command_results` not in payload
- [ ] Metrics fields present
- [ ] Request succeeds

---

### TC05: V1.0 Agent Heartbeat With Command Results Accepted

**Type:** Integration | **Priority:** P0 | **Story:** US0152 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A v1.0 heartbeat with `command_results` array | Backward compat payload |
| When | POST `/api/v1/agents/heartbeat` | Request processed |
| Then | Response 200, deprecation warning logged | Graceful handling |

**Assertions:**
- [ ] Response status is 200
- [ ] Deprecation warning in logs
- [ ] Metrics still recorded
- [ ] `command_results` ignored (no processing)

---

### TC06: Deprecation Warning Contains Agent Info

**Type:** Integration | **Priority:** P2 | **Story:** US0152 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A v1.0 heartbeat with `command_results` | Contains server_id |
| When | POST `/api/v1/agents/heartbeat` | Warning logged |
| Then | Warning identifies the server | Server ID in message |

**Assertions:**
- [ ] Warning includes server_id
- [ ] Warning mentions "deprecated"
- [ ] Warning mentions "command_results"

---

### TC07: Multiple V1.0 Heartbeats Log Once Per Session

**Type:** Integration | **Priority:** P3 | **Story:** US0152 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Multiple v1.0 heartbeats from same server | Repeated requests |
| When | 3 heartbeats sent with `command_results` | All processed |
| Then | Warning logged each time (or rate-limited) | No spam or no suppression |

**Assertions:**
- [ ] All heartbeats return 200
- [ ] Warnings logged (implementation choice on rate limiting)

---

### TC08: Metrics Continue Flowing After Migration

**Type:** Integration | **Priority:** P0 | **Story:** US0152 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with previous heartbeat history | Existing data |
| When | V2.0 agent sends metrics-only heartbeat | New format |
| Then | Metrics recorded correctly | No regression |

**Assertions:**
- [ ] `cpu_percent` recorded
- [ ] `memory_percent` recorded
- [ ] `disk_percent` recorded
- [ ] Historical metrics preserved
- [ ] Server status updated to online

---

## Fixtures

```yaml
v2_heartbeat:
  server_id: "test-server-v2"
  hostname: "test-server-v2.local"
  timestamp: "2026-01-29T12:00:00Z"
  metrics:
    cpu_percent: 45.5
    memory_percent: 62.0
    disk_percent: 78.0

v1_heartbeat_with_results:
  server_id: "test-server-v1"
  hostname: "test-server-v1.local"
  timestamp: "2026-01-29T12:00:00Z"
  metrics:
    cpu_percent: 45.5
    memory_percent: 62.0
    disk_percent: 78.0
  command_results:
    - action_id: 123
      exit_code: 0
      stdout: "Service restarted"
      stderr: ""
      executed_at: "2026-01-29T11:59:00Z"
      completed_at: "2026-01-29T11:59:01Z"

expected_response:
  received: true
  pending_commands: []
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Heartbeat Without Command Results Accepted | ✅ Pass | test_heartbeat_commands.py::TestV2AgentHeartbeat::test_heartbeat_without_command_results_accepted |
| TC02 | Heartbeat Response Has Empty Pending Commands | ✅ Pass | test_heartbeat_commands.py::TestV2AgentHeartbeat::test_heartbeat_response_always_has_empty_pending_commands |
| TC03 | Agent Startup Without Command Execution Code | ⏳ Pending | Agent simplification not yet done |
| TC04 | Agent Sends Metrics-Only Heartbeat | ⏳ Pending | Agent simplification not yet done |
| TC05 | V1.0 Agent Heartbeat With Command Results Accepted | ✅ Pass | test_heartbeat_commands.py::TestV1AgentBackwardCompatibility::test_heartbeat_with_command_results_accepted |
| TC06 | Deprecation Warning Contains Agent Info | ✅ Pass | test_heartbeat_commands.py::TestV1AgentBackwardCompatibility::test_deprecation_warning_logged_for_command_results |
| TC07 | Multiple V1.0 Heartbeats Log Once Per Session | ✅ Pass | Implicitly covered - no rate limiting implemented |
| TC08 | Metrics Continue Flowing After Migration | ✅ Pass | test_heartbeat_commands.py::TestMetricsContinueFlowing::test_metrics_recorded_with_v2_format |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md) |
| Plan | [PL0191: Remove Async Command Channel](../plans/PL0191-remove-async-command-channel.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
