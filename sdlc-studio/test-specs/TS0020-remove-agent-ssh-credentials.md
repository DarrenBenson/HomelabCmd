# TS0020: Remove Agent API SSH Credentials and Verification

> **Status:** Draft
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-24
> **Last Updated:** 2026-01-24

## Overview

Test specification for the remove-agent API enhancements that support optional SSH password authentication, verification warnings, and bounded SSH timeouts. Covers response warnings and non-persistence of credentials.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0075](../../stories/US0075-remove-agent-ssh-credentials.md) | Remove Agent API SSH Credentials and Verification | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0075 | AC1 | Optional SSH credentials accepted for removal | TC2001, TC2002, TC2003 | Draft |
| US0075 | AC2 | Credentials are not persisted or echoed | TC2008, TC2009 | Draft |
| US0075 | AC3 | Verification steps confirm uninstall outcome | TC2004, TC2005 | Draft |
| US0075 | AC4 | Bounded timeouts for SSH operations | TC2006, TC2007 | Draft |

**Coverage Summary:**
- Total ACs: 4
- Covered: 4
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Validate service logic and SSH execution paths. |
| Integration | No | Behaviour covered by service-level tests with mocked SSH. |
| API | Yes | Validate request schema and response warning strings. |
| E2E | No | No UI changes for this story. |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, httpx |
| External Services | None (SSH mocked) |
| Test Data | Server records with hostname/IP variations |

---

## Test Cases

### TC2001: Remove agent with password authentication succeeds

**Type:** API
**Priority:** High
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server with hostname and IP exists | Server is active and SSH reachable |
| 2 | When I POST remove-agent with ssh_username and ssh_password | Password auth is attempted and uninstall command succeeds |
| 3 | Then the response indicates success without password echo | Message includes removal confirmation only |

#### Test Data

```yaml
input:
  server_id: "server-123"
  delete_completely: false
  ssh_username: "darren"
  ssh_password: "example-password"
expected:
  success: true
  message_contains: "Agent removed"
  message_not_contains: "example-password"
```

#### Assertions

- [ ] SSH command executed with password auth
- [ ] Response includes success and server_id
- [ ] Response message does not contain password

---

### TC2002: Remove agent falls back to key-based auth when password missing

**Type:** API
**Priority:** Medium
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server with hostname exists | Server is active |
| 2 | When I POST remove-agent without ssh_username/password | Key-based SSH uninstall is attempted |
| 3 | Then removal succeeds using key auth | Response indicates removal and no password warning |

#### Test Data

```yaml
input:
  server_id: "server-456"
  delete_completely: false
expected:
  success: true
  message_contains: "Agent removed"
```

#### Assertions

- [ ] SSH command executed via key-based auth
- [ ] Response has no password-related warning

---

### TC2003: Password auth fails and falls back to key auth with warning

**Type:** Unit
**Priority:** High
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given password auth fails | SSH returns authentication error |
| 2 | When key-based auth succeeds | Uninstall completes |
| 3 | Then response includes warning about password auth | Message includes warning string |

#### Test Data

```yaml
input:
  password_auth_error: "Authentication failed"
  key_auth_success: true
expected:
  warning_contains: "password"
```

#### Assertions

- [ ] Warning included for password auth failure
- [ ] Overall result marked success

---

### TC2004: Verification warns when service still active

**Type:** Unit
**Priority:** Medium
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given uninstall succeeds | Remove command exits cleanly |
| 2 | When service status check shows active | systemctl reports active |
| 3 | Then response includes verification warning | Warning mentions running service |

#### Test Data

```yaml
input:
  uninstall_success: true
  service_status: "active"
expected:
  warning_contains: "service"
```

#### Assertions

- [ ] Warning mentions service still running

---

### TC2005: Verification warns when files remain

**Type:** Unit
**Priority:** Medium
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given uninstall succeeds | Remove command exits cleanly |
| 2 | When file check finds remaining paths | Directories still exist |
| 3 | Then response includes verification warning with paths | Warning lists remaining paths |

#### Test Data

```yaml
input:
  remaining_paths:
    - /opt/homelab-agent
expected:
  warning_contains: "/opt/homelab-agent"
```

#### Assertions

- [ ] Warning includes remaining path

---

### TC2006: Verification timeout returns warning

**Type:** Unit
**Priority:** Medium
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given uninstall succeeds | Remove command exits cleanly |
| 2 | When verification command times out | SSH returns timeout error |
| 3 | Then response includes timeout warning | Warning mentions timeout |

#### Test Data

```yaml
input:
  verification_timeout: true
expected:
  warning_contains: "timed out"
```

#### Assertions

- [ ] Warning includes timeout detail

---

### TC2007: SSH timeout during uninstall returns warning and proceeds

**Type:** Unit
**Priority:** High
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given uninstall command times out | SSH returns timeout error |
| 2 | When removal proceeds | Server is marked inactive |
| 3 | Then response includes uninstall timeout warning | Warning mentions uninstall timeout |

#### Test Data

```yaml
input:
  uninstall_timeout: true
expected:
  warning_contains: "uninstall"
```

#### Assertions

- [ ] Warning includes uninstall timeout
- [ ] Server marked inactive or deleted as requested

---

### TC2008: Credentials are not persisted

**Type:** Unit
**Priority:** High
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given remove-agent with ssh credentials | Credentials included in request |
| 2 | When the request completes | Removal returns response |
| 3 | Then no credential fields are stored | Database shows no credential persistence |

#### Test Data

```yaml
input:
  ssh_username: "darren"
  ssh_password: "example-password"
expected:
  persisted_fields: []
```

#### Assertions

- [ ] No credential fields written to server record

---

### TC2009: Response omits password values

**Type:** API
**Priority:** High
**Story:** US0075
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given remove-agent request with password | Request contains ssh_password |
| 2 | When API responds | Response includes success message |
| 3 | Then password is not present in response | Response omits password value |

#### Test Data

```yaml
input:
  ssh_password: "example-password"
expected:
  response_not_contains: "example-password"
```

#### Assertions

- [ ] Response message does not contain password

---

## Fixtures

```yaml
# Shared test data for this spec
servers:
  - id: "server-123"
    hostname: "server-123.local"
    ip_address: "192.168.1.50"
  - id: "server-456"
    hostname: "server-456.local"
    ip_address: "192.168.1.51"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC2001 | Remove agent with password authentication succeeds | Pending | - |
| TC2002 | Remove agent falls back to key-based auth when password missing | Pending | - |
| TC2003 | Password auth fails and falls back to key auth with warning | Pending | - |
| TC2004 | Verification warns when service still active | Pending | - |
| TC2005 | Verification warns when files remain | Pending | - |
| TC2006 | Verification timeout returns warning | Pending | - |
| TC2007 | SSH timeout during uninstall returns warning and proceeds | Pending | - |
| TC2008 | Credentials are not persisted | Pending | - |
| TC2009 | Response omits password values | Pending | - |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

## Lessons Learned

<!-- Optional section. -->

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-24 | Claude | Initial spec generation |
