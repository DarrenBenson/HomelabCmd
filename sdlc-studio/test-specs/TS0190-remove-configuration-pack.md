# TS0190: Remove Configuration Pack

> **Status:** Draft
> **Story:** [US0123: Remove Configuration Pack](../stories/US0123-remove-configuration-pack.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for removing configuration packs from servers. Validates the "reverse apply" functionality including file deletion with backup, package preservation, settings cleanup, and the confirmation flow.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0123](../stories/US0123-remove-configuration-pack.md) | Remove Configuration Pack | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0123 | AC1 | Remove Endpoint | TC01 | Pending |
| US0123 | AC2 | File Removal with Backup | TC02, TC03 | Pending |
| US0123 | AC3 | Package Preservation | TC04 | Pending |
| US0123 | AC4 | Settings Cleanup | TC05 | Pending |
| US0123 | AC5 | Confirmation Required | TC06, TC07 | Pending |
| US0123 | AC6 | Warning Display | TC08 | Pending |
| US0123 | AC7 | Audit Logging | TC09 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Backend service logic, SSH command generation |
| Integration | Yes | Full API request/response flow with mocked SSH |
| E2E | No | Manual verification of modal UX sufficient |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, pytest-asyncio, Docker (for integration) |
| External Services | SSH executor mock, Database session |
| Test Data | Server fixture, Configuration pack fixture (developer_max) |

---

## Test Cases

### TC01: Remove Endpoint Accepts Pack Name

**Type:** Unit | **Priority:** Critical | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists with ID "test-server" | Server is in database |
| Given | Pack "developer_max" exists | Pack definition loaded |
| When | DELETE /api/v1/servers/test-server/config/apply?pack=developer_max&confirm=true | Request processed |
| Then | Response 200 OK | Removal initiated |
| Then | Response contains success=true | Operation succeeded |

**Assertions:**
- [ ] Response status code is 200
- [ ] Response body contains `success: true`
- [ ] Response body contains `removed_at` timestamp
- [ ] Response body contains `items` array

---

### TC02: File Deleted with Backup Created

**Type:** Unit | **Priority:** Critical | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with file ~/.config/starship.toml | File exists on server |
| Given | Pack references this file | Pack definition includes file |
| When | Remove pack with confirm=true | Removal executed |
| Then | SSH command `cp ~/.config/starship.toml ~/.config/starship.toml.homelabcmd.bak` executed | Backup created |
| Then | SSH command `rm -f ~/.config/starship.toml` executed | File deleted |
| Then | Item result shows success=true | Operation succeeded |

**Assertions:**
- [ ] SSH executor called with backup command first
- [ ] SSH executor called with delete command second
- [ ] Item result contains `action: "deleted"`
- [ ] Item result contains `backup_path: "~/.config/starship.toml.homelabcmd.bak"`

---

### TC03: File Not Found Handled Gracefully

**Type:** Unit | **Priority:** High | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server without file ~/.config/starship.toml | File does not exist |
| Given | Pack references this file | Pack definition includes file |
| When | Remove pack with confirm=true | Removal executed |
| Then | SSH backup command returns non-zero (file not found) | Error ignored |
| Then | SSH delete command also returns non-zero | Expected |
| Then | Item result shows success=true, note="already removed" | Graceful handling |

**Assertions:**
- [ ] Item result contains `success: true`
- [ ] Item result contains `note: "already removed"` or similar
- [ ] Overall operation continues (not aborted)

---

### TC04: Packages Are Not Uninstalled

**Type:** Unit | **Priority:** Critical | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack includes package "nodejs" | Pack has package definition |
| When | Remove pack with confirm=true | Removal executed |
| Then | No apt-get remove command executed | Package preserved |
| Then | Item result shows action="skipped" | Explicit skip |
| Then | Item result note explains why | User informed |

**Assertions:**
- [ ] SSH executor NOT called with `apt-get remove` or `apt-get purge`
- [ ] Item result contains `action: "skipped"`
- [ ] Item result contains `note` mentioning "may break dependencies"
- [ ] Item result contains `success: true` (skipping is success)

---

### TC05: Environment Variable Removed from Shell Config

**Type:** Unit | **Priority:** High | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack includes setting EDITOR=nano | Pack has env_var setting |
| Given | ~/.bashrc.d/env.sh contains `export EDITOR=nano` | Setting exists |
| When | Remove pack with confirm=true | Removal executed |
| Then | SSH command `sed -i '/^export EDITOR=/d' ~/.bashrc.d/env.sh` executed | Line removed |
| Then | Item result shows success=true | Operation succeeded |

**Assertions:**
- [ ] SSH executor called with sed command
- [ ] sed pattern correctly escapes the key name
- [ ] Item result contains `action: "removed"`
- [ ] Item result contains `success: true`

---

### TC06: Preview Returned When Confirm=False

**Type:** Unit | **Priority:** Critical | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server and pack exist | Valid configuration |
| When | DELETE /api/v1/servers/test-server/config/apply?pack=developer_max (no confirm) | Request processed |
| Then | Response 200 OK with preview=true | Preview mode |
| Then | No SSH commands executed | No changes made |
| Then | Response contains items to be removed | User can review |

**Assertions:**
- [ ] Response contains `preview: true`
- [ ] Response contains `files` array with items to delete
- [ ] Response contains `packages` array with items to skip
- [ ] Response contains `settings` array with items to remove
- [ ] SSH executor NOT called

---

### TC07: Confirm=True Required for Execution

**Type:** Integration | **Priority:** High | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server and pack exist | Valid configuration |
| When | DELETE with confirm=false | Preview returned |
| When | DELETE with confirm=true | Removal executed |
| Then | Only second request executes SSH commands | Confirmation enforced |

**Assertions:**
- [ ] First request returns preview without SSH calls
- [ ] Second request executes SSH commands
- [ ] Both requests return 200 OK

---

### TC08: Warning Banner in Modal

**Type:** Frontend Unit | **Priority:** High | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | RemovePackModal opened | Modal visible |
| When | Preview state displayed | Warning shown |
| Then | Warning contains "Files will be deleted" | Text present |
| Then | Warning contains "Packages will remain installed" | Text present |
| Then | Warning has amber/yellow styling | Visual emphasis |

**Assertions:**
- [ ] Warning banner element exists in DOM
- [ ] Warning text includes file deletion notice
- [ ] Warning text includes package preservation notice
- [ ] Warning element has `bg-warning` or amber background class

---

### TC09: Audit Log Created on Removal

**Type:** Unit | **Priority:** High | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Successful pack removal | All items processed |
| When | Removal completes | Audit log checked |
| Then | Audit entry contains server_id | Server identified |
| Then | Audit entry contains pack_name | Pack identified |
| Then | Audit entry contains items_removed count | Change tracked |
| Then | Audit entry contains triggered_by="user" | Actor recorded |
| Then | Audit entry contains timestamp | Time recorded |

**Assertions:**
- [ ] Audit log entry created in database
- [ ] Entry contains correct server_id
- [ ] Entry contains correct pack_name
- [ ] Entry action is "config_remove"
- [ ] Entry contains count of removed items

---

### TC10: SSH Failure Aborts Cleanly

**Type:** Unit | **Priority:** High | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH connection will fail | SSHConnectionError raised |
| When | Remove pack with confirm=true | Removal attempted |
| Then | Error returned immediately | No partial changes |
| Then | No files deleted | Safe failure |
| Then | Error message indicates SSH failure | User informed |

**Assertions:**
- [ ] Response status code is 503 or appropriate error
- [ ] Error message contains "SSH" or "connection"
- [ ] No backup commands executed
- [ ] No delete commands executed

---

### TC11: Partial Failure Continues

**Type:** Unit | **Priority:** Medium | **Story:** US0123

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack with 3 files, first file deletion fails | Permission denied |
| When | Remove pack with confirm=true | Removal executed |
| Then | Second and third files still processed | Continues |
| Then | First item shows success=false with error | Failure recorded |
| Then | Second and third show success=true | Successes recorded |

**Assertions:**
- [ ] All items have results in response
- [ ] Failed item contains `success: false`
- [ ] Failed item contains `error` message
- [ ] Successful items contain `success: true`
- [ ] Overall response indicates partial success

---

## Fixtures

```yaml
# Test server fixture
test_server:
  id: "test-server-001"
  hostname: "test-server"
  tailscale_hostname: "test-server.tail12345.ts.net"
  ssh_username: "testuser"
  status: "online"

# Pack fixture (developer_max)
developer_max_pack:
  name: "developer_max"
  description: "Full development environment"
  items:
    files:
      - path: "~/.config/starship.toml"
        mode: "0644"
        template: "starship.toml"
      - path: "~/.bashrc.d/aliases.sh"
        mode: "0644"
        template: "aliases.sh"
    packages:
      - name: "nodejs"
        min_version: "18.0.0"
      - name: "docker-ce"
    settings:
      - key: "EDITOR"
        type: "env_var"
        expected: "nano"

# SSH mock responses
ssh_responses:
  backup_success:
    exit_code: 0
    stdout: ""
    stderr: ""
  backup_file_not_found:
    exit_code: 1
    stdout: ""
    stderr: "cp: cannot stat '~/.config/starship.toml': No such file or directory"
  delete_success:
    exit_code: 0
    stdout: ""
    stderr: ""
  sed_success:
    exit_code: 0
    stdout: ""
    stderr: ""
  permission_denied:
    exit_code: 1
    stdout: ""
    stderr: "rm: cannot remove '/protected/file': Permission denied"
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Remove Endpoint Accepts Pack Name | Pending | - |
| TC02 | File Deleted with Backup Created | Pending | - |
| TC03 | File Not Found Handled Gracefully | Pending | - |
| TC04 | Packages Are Not Uninstalled | Pending | - |
| TC05 | Environment Variable Removed from Shell Config | Pending | - |
| TC06 | Preview Returned When Confirm=False | Pending | - |
| TC07 | Confirm=True Required for Execution | Pending | - |
| TC08 | Warning Banner in Modal | Pending | - |
| TC09 | Audit Log Created on Removal | Pending | - |
| TC10 | SSH Failure Aborts Cleanly | Pending | - |
| TC11 | Partial Failure Continues | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010: Configuration Management](../epics/EP0010-configuration-management.md) |
| Plan | [PL0190: Remove Configuration Pack](../plans/PL0190-remove-configuration-pack.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
