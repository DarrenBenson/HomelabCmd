# TS0190: Synchronous Command Execution API

> **Status:** Draft
> **Story:** [US0153: Synchronous Command Execution API](../stories/US0153-synchronous-command-execution-api.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the synchronous command execution API endpoint that executes whitelisted commands via SSH and returns immediate results.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0153](../stories/US0153-synchronous-command-execution-api.md) | Synchronous Command Execution API | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0153 | AC1 | Command Execution Endpoint | TC01, TC02, TC03 | Pending |
| US0153 | AC2 | Error Status Codes | TC04, TC05, TC06, TC07, TC08 | Pending |
| US0153 | AC3 | Rate Limiting | TC09, TC10 | Pending |
| US0153 | AC4 | OpenAPI Documentation | TC11 | Pending |

**Coverage:** 4/4 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Mock SSH executor and whitelist for fast tests |
| Integration | Yes | Verify route registration and auth |
| E2E | No | Tested via integration tests with mocked SSH |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, pytest-asyncio, httpx |
| External Services | None (SSH mocked) |
| Test Data | Server fixtures, mock SSH responses |

---

## Test Cases

### TC01: Valid command returns 200 with correct response

**Type:** Integration | **Priority:** High | **Story:** US0153 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists with tailscale_hostname | Server in database |
| And | Command is whitelisted | `restart_service` with valid service |
| When | POST `/api/v1/servers/{id}/commands/execute` with `{"command": "systemctl restart nginx", "action_type": "restart_service"}` | Request sent |
| Then | Response status 200 | Success |
| And | Response contains exit_code, stdout, stderr, duration_ms | Schema valid |

**Assertions:**
- [ ] Status code is 200
- [ ] Response has `exit_code` (integer)
- [ ] Response has `stdout` (string)
- [ ] Response has `stderr` (string)
- [ ] Response has `duration_ms` (integer, >= 0)

---

### TC02: Command with non-zero exit code returns 200

**Type:** Unit | **Priority:** High | **Story:** US0153 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists | Database record |
| And | SSH executor returns exit_code=1 | Mock configured |
| When | POST execute endpoint | Request sent |
| Then | Response status 200 | Still success (command ran) |
| And | exit_code is 1 | Non-zero preserved |

**Assertions:**
- [ ] Status code is 200 (command executed, even if it failed)
- [ ] `exit_code` is 1
- [ ] `stderr` contains error message from command

---

### TC03: Command stdout and stderr captured correctly

**Type:** Unit | **Priority:** Medium | **Story:** US0153 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH executor returns specific stdout/stderr | Mock configured |
| When | POST execute endpoint | Request sent |
| Then | Response stdout matches mock | Content preserved |
| And | Response stderr matches mock | Content preserved |

**Assertions:**
- [ ] `stdout` matches expected output
- [ ] `stderr` matches expected error output
- [ ] No truncation for small outputs

---

### TC04: Server not found returns 404

**Type:** Integration | **Priority:** High | **Story:** US0153 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No server with ID "nonexistent-server" | Database empty for ID |
| When | POST `/api/v1/servers/nonexistent-server/commands/execute` | Request sent |
| Then | Response status 404 | Not found |
| And | Error detail contains "not found" | Clear message |

**Assertions:**
- [ ] Status code is 404
- [ ] Response body has `detail.code` = "NOT_FOUND"
- [ ] Response body has `detail.message` containing "not found"

---

### TC05: Unwhitelisted command returns 400

**Type:** Integration | **Priority:** Critical | **Story:** US0153 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists | Database record |
| When | POST with `{"command": "rm -rf /", "action_type": "unknown_action"}` | Request sent |
| Then | Response status 400 | Bad request |
| And | Error mentions whitelist | Security message |

**Assertions:**
- [ ] Status code is 400
- [ ] Response body mentions "whitelist" or "not allowed"
- [ ] SSH executor NOT called (security critical)

---

### TC06: Command timeout returns 408

**Type:** Unit | **Priority:** High | **Story:** US0153 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH executor raises `CommandTimeoutError` | Mock configured |
| When | POST execute endpoint | Request sent |
| Then | Response status 408 | Request timeout |
| And | Error mentions timeout | Clear message |

**Assertions:**
- [ ] Status code is 408
- [ ] Response body mentions "timeout"
- [ ] `detail.message` includes timeout duration

---

### TC07: SSH connection failure returns 500

**Type:** Unit | **Priority:** High | **Story:** US0153 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH executor raises `SSHConnectionError` | Mock configured |
| When | POST execute endpoint | Request sent |
| Then | Response status 500 | Server error |
| And | Error mentions SSH | Clear message |

**Assertions:**
- [ ] Status code is 500
- [ ] Response body mentions "SSH" or "connection"

---

### TC08: SSH authentication failure returns 500

**Type:** Unit | **Priority:** High | **Story:** US0153 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH executor raises `SSHAuthenticationError` | Mock configured |
| When | POST execute endpoint | Request sent |
| Then | Response status 500 | Server error |
| And | Error mentions authentication | Clear message |

**Assertions:**
- [ ] Status code is 500
- [ ] Response body mentions "authentication" or "auth"

---

### TC09: Rate limit allows 10 requests per minute

**Type:** Integration | **Priority:** High | **Story:** US0153 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists and command whitelisted | Setup complete |
| When | POST execute endpoint 10 times within 1 minute | Rapid requests |
| Then | All 10 requests return 200 | Within limit |

**Assertions:**
- [ ] All 10 requests return 200
- [ ] No rate limit error for first 10

---

### TC10: Rate limit returns 429 at 11th request

**Type:** Integration | **Priority:** High | **Story:** US0153 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 10 requests already made in current minute | Rate limit near threshold |
| When | POST execute endpoint (11th request) | Exceeds limit |
| Then | Response status 429 | Too many requests |
| And | Retry-After header present | Client guidance |

**Assertions:**
- [ ] Status code is 429
- [ ] Response headers include `Retry-After`
- [ ] Response body mentions rate limit

---

### TC11: OpenAPI schema includes endpoint

**Type:** Integration | **Priority:** Medium | **Story:** US0153 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Application running | Server started |
| When | GET `/api/v1/openapi.json` | Fetch schema |
| Then | Schema includes `/servers/{server_id}/commands/execute` | Endpoint documented |
| And | Request/response schemas defined | Full documentation |

**Assertions:**
- [ ] Path `/api/v1/servers/{server_id}/commands/execute` exists
- [ ] POST method documented
- [ ] Request body schema includes `command`, `action_type`
- [ ] Response schema includes `exit_code`, `stdout`, `stderr`, `duration_ms`

---

## Fixtures

```yaml
# Test fixtures for command execution API tests
servers:
  valid_server:
    id: "test-server-1"
    hostname: "test-server.local"
    tailscale_hostname: "test-server.tailnet-abc.ts.net"
    status: "online"

  no_tailscale_server:
    id: "test-server-2"
    hostname: "test-server-2.local"
    tailscale_hostname: null
    status: "online"

commands:
  valid_restart:
    command: "systemctl restart nginx"
    action_type: "restart_service"

  valid_updates:
    command: "apt-get update && apt-get upgrade -y"
    action_type: "apply_updates"

  invalid_command:
    command: "rm -rf /"
    action_type: "unknown_action"

ssh_responses:
  success:
    exit_code: 0
    stdout: "Service restarted successfully\n"
    stderr: ""
    duration_ms: 150

  failure:
    exit_code: 1
    stdout: ""
    stderr: "Failed to restart nginx.service: Unit not found\n"
    duration_ms: 50

  timeout:
    raises: "CommandTimeoutError"
    timeout: 30

  connection_error:
    raises: "SSHConnectionError"
    hostname: "test-server.tailnet-abc.ts.net"
    attempts: 3

  auth_error:
    raises: "SSHAuthenticationError"
    hostname: "test-server.tailnet-abc.ts.net"
    username: "homelabcmd"
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Valid command returns 200 | Pending | - |
| TC02 | Non-zero exit code returns 200 | Pending | - |
| TC03 | Stdout/stderr captured correctly | Pending | - |
| TC04 | Server not found returns 404 | Pending | - |
| TC05 | Unwhitelisted command returns 400 | Pending | - |
| TC06 | Command timeout returns 408 | Pending | - |
| TC07 | SSH connection failure returns 500 | Pending | - |
| TC08 | SSH auth failure returns 500 | Pending | - |
| TC09 | Rate limit allows 10 requests | Pending | - |
| TC10 | Rate limit returns 429 at 11th | Pending | - |
| TC11 | OpenAPI schema includes endpoint | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0013](../epics/EP0013-synchronous-command-execution.md) |
| Plan | [PL0190](../plans/PL0190-synchronous-command-execution-api.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
