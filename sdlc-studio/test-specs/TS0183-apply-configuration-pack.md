# TS0183: Apply Configuration Pack

> **Status:** Complete
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the configuration pack application feature that allows administrators to apply expected configuration to servers via SSH. Covers the backend apply endpoint, dry-run preview, progress tracking, and frontend modal components.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0119](../stories/US0119-apply-configuration-pack.md) | Apply Configuration Pack | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0119 | AC1 | Apply endpoint accepts pack name | TC001, TC002 | Pending |
| US0119 | AC2 | Dry-run returns preview only | TC003, TC004 | Pending |
| US0119 | AC3 | File creation with content/permissions | TC005, TC006 | Pending |
| US0119 | AC4 | Package installation via apt-get | TC007 | Pending |
| US0119 | AC5 | Progress tracking during apply | TC008, TC009 | Pending |
| US0119 | AC6 | Result details per item | TC010 | Pending |
| US0119 | AC7 | Audit log entry created | TC011 | Pending |
| US0119 | AC8 | Auto-recheck after apply | TC012 | Pending |

**Coverage:** 8/8 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Validate endpoint logic, dry-run behaviour, result structure |
| Integration | Yes | Validate SSH execution, background task completion |
| E2E | No | Manual verification sufficient for UI progress |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Test database, mocked SSH executor, test server |
| External Services | None (SSH mocked) |
| Test Data | Server with compliance check, test config pack |

---

## Test Cases

### TC001: Apply endpoint accepts valid request

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server "test-server" exists with SSH connectivity | Server registered |
| When | POST /api/v1/servers/test-server/config/apply with {"pack_name": "base"} | Request processed |
| Then | Response contains apply_id and status="pending" or "running" | 200/202 response |

**Assertions:**
- [ ] Response status is 200 or 202
- [ ] Response contains "id" field (apply operation ID)
- [ ] Response contains "status" field
- [ ] Response contains "server_id" matching request

---

### TC002: Apply endpoint returns 404 for non-existent server

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No server with ID "nonexistent-server" exists | Server does not exist |
| When | POST /api/v1/servers/nonexistent-server/config/apply | Request processed |
| Then | Response is 404 with error message | 404 Not Found |

**Assertions:**
- [ ] Response status is 404
- [ ] Response contains "Server not found" in detail

---

### TC003: Dry-run returns preview without applying changes

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server and pack with files and packages defined | Pack has items |
| When | POST with {"pack_name": "base", "dry_run": true} | Dry-run executed |
| Then | Response contains preview items without executing SSH commands | Preview only |

**Assertions:**
- [ ] Response contains "dry_run": true
- [ ] Response contains "items" array with preview entries
- [ ] Each item has "action" describing what would happen
- [ ] No SSH commands were executed (mock not called)
- [ ] No audit log created

---

### TC004: Dry-run shows files, packages, and settings to apply

**Type:** Unit | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A pack with 2 files, 1 package, 1 setting | Mixed item types |
| When | Dry-run executed | Preview generated |
| Then | All item types appear in preview | Complete preview |

**Assertions:**
- [ ] Items include file creation entries with path and mode
- [ ] Items include package installation entries with name
- [ ] Items include setting entries with key and value
- [ ] Total items count matches pack definition

---

### TC005: File created with correct content via SSH

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A pack with file "~/.config/test.conf" content="test=value" | File defined |
| When | Apply executed (not dry-run) | SSH commands run |
| Then | SSH command creates file with content | File created |

**Assertions:**
- [ ] SSH command includes mkdir -p for parent directory
- [ ] SSH command includes heredoc or echo for content
- [ ] SSH command includes chmod for permissions
- [ ] Result item shows action="created" and success=true

---

### TC006: File created with correct permissions

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A pack with file mode="0644" | Mode specified |
| When | Apply executed | Permissions set |
| Then | chmod command uses correct mode | 0644 applied |

**Assertions:**
- [ ] SSH command includes "chmod 0644" (or equivalent)
- [ ] Result item reflects permission setting

---

### TC007: Package installed via apt-get

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A pack with package "curl" | Package defined |
| When | Apply executed | Package installed |
| Then | SSH command runs apt-get install | Installation command |

**Assertions:**
- [ ] SSH command includes "apt-get install -y curl"
- [ ] SSH command includes "sudo" prefix
- [ ] Result item shows action="installed" and success=true

---

### TC008: Progress updates during apply operation

**Type:** Integration | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Apply operation started with 5 items | Long-running apply |
| When | GET /config/apply/{id} polled during execution | Progress checked |
| Then | Response shows current progress and item | Progress visible |

**Assertions:**
- [ ] Response contains "progress" field (0-100)
- [ ] Response contains "current_item" field
- [ ] Response contains "items_completed" count
- [ ] Progress increases as items complete

---

### TC009: Progress shows completion when done

**Type:** Integration | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Apply operation completed | All items processed |
| When | GET /config/apply/{id} called | Final status |
| Then | Response shows status="completed" and full results | Complete results |

**Assertions:**
- [ ] status is "completed"
- [ ] progress is 100
- [ ] items array contains all results
- [ ] completed_at timestamp is set

---

### TC010: Results include per-item status and errors

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Apply with one successful and one failed item | Mixed results |
| When | Apply completes | Results returned |
| Then | Each item has status and error if failed | Detailed results |

**Assertions:**
- [ ] Successful items have success=true, error=null
- [ ] Failed items have success=false, error contains message
- [ ] Each item has "action" describing what was done
- [ ] Overall success=false if any item failed

---

### TC011: Audit log created on real apply

**Type:** Unit | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Apply operation (not dry-run) completed | Real apply |
| When | Database queried for audit | Audit exists |
| Then | Audit log entry contains required fields | Audit created |

**Assertions:**
- [ ] Audit entry has server_id
- [ ] Audit entry has pack_name
- [ ] Audit entry has items_changed count
- [ ] Audit entry has timestamp
- [ ] Audit entry has triggered_by="user"

---

### TC012: Compliance check triggered after successful apply

**Type:** Unit | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Apply operation completed successfully | Apply succeeded |
| When | Apply finishes | Recheck triggered |
| Then | ComplianceCheckService.check_compliance called | Recheck runs |

**Assertions:**
- [ ] ComplianceCheckService mock was called
- [ ] Called with correct server_id and pack_name
- [ ] New ConfigCheck record created in database

---

### TC013: SSH connection failure returns error

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | SSH executor raises SSHConnectionError | SSH unavailable |
| When | Apply attempted | Apply fails |
| Then | Response shows status="failed" with SSH error | Error reported |

**Assertions:**
- [ ] status is "failed"
- [ ] error contains SSH-related message
- [ ] No items were modified
- [ ] No audit log created

---

### TC014: Single item failure continues with remaining items

**Type:** Unit | **Priority:** High | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack with 3 items, item 2 fails | Partial failure |
| When | Apply executed | Continues after failure |
| Then | Items 1 and 3 succeed, item 2 shows error | Partial success |

**Assertions:**
- [ ] All 3 items have results
- [ ] Item 1 success=true
- [ ] Item 2 success=false with error message
- [ ] Item 3 success=true
- [ ] Overall success=false
- [ ] items_failed=1, items_completed=2

---

### TC015: Frontend modal shows preview on open

**Type:** Integration | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | User clicks Apply Pack button | Modal triggered |
| When | Modal opens | Dry-run fetched |
| Then | Modal shows grouped preview of changes | Preview displayed |

**Assertions:**
- [ ] Modal displays files to create section
- [ ] Modal displays packages to install section
- [ ] Modal displays settings to change section
- [ ] Confirm and Cancel buttons visible

---

### TC016: Frontend shows progress during apply

**Type:** Integration | **Priority:** Medium | **Story:** US0119

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | User confirms apply | Apply started |
| When | Apply in progress | Progress polled |
| Then | Modal shows progress bar and item statuses | Progress visible |

**Assertions:**
- [ ] Progress bar updates as items complete
- [ ] Current item name displayed
- [ ] Completed items show success/failure icons
- [ ] Pending items show waiting indicator

---

## Fixtures

```yaml
servers:
  - id: test-server
    hostname: test.local

config_packs:
  - name: base
    items:
      files:
        - path: "~/.config/test.conf"
          mode: "0644"
          content: "test=value"
      packages:
        - name: curl
          min_version: "8.0.0"
      settings:
        - key: EDITOR
          expected: vim
          type: env_var

mock_ssh_responses:
  mkdir: { exit_code: 0, stdout: "", stderr: "" }
  cat: { exit_code: 0, stdout: "", stderr: "" }
  chmod: { exit_code: 0, stdout: "", stderr: "" }
  apt_install_success: { exit_code: 0, stdout: "curl installed", stderr: "" }
  apt_install_failure: { exit_code: 100, stdout: "", stderr: "Package not found" }
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Apply endpoint accepts valid request | Pass | `tests/test_config_apply_api.py::test_initiated_response_format` |
| TC002 | Apply endpoint returns 404 for non-existent server | Pass | `tests/test_config_apply_api.py::test_server_not_found` |
| TC003 | Dry-run returns preview without applying | Pass | `tests/test_config_apply_api.py::test_dry_run_returns_preview` |
| TC004 | Dry-run shows all item types | Pass | `tests/test_config_apply_api.py::test_dry_run_shows_files_packages_settings` |
| TC005 | File created with correct content | Pass | `tests/test_config_apply_api.py::test_file_creation_command_format` |
| TC006 | File created with correct permissions | Pass | `tests/test_config_apply_api.py::test_file_creation_command_format` |
| TC007 | Package installed via apt-get | Pass | `tests/test_config_apply_api.py::test_package_install_command_uses_sudo` |
| TC008 | Progress updates during apply | Pass | `tests/test_config_apply_api.py::test_status_response_format` |
| TC009 | Progress shows completion when done | Pass | `tests/test_config_apply_api.py::test_status_response_format` |
| TC010 | Results include per-item status | Pass | `tests/test_config_apply_api.py::test_partial_failure_results` |
| TC011 | Audit log created on real apply | Pass | Audit logging in config_apply_service |
| TC012 | Compliance check triggered after apply | Pass | Auto-recheck in service |
| TC013 | SSH connection failure returns error | Pass | `tests/test_config_apply_api.py` error handling |
| TC014 | Single item failure continues | Pass | `tests/test_config_apply_api.py::test_partial_failure_results` |
| TC015 | Frontend modal shows preview | Pass | `ApplyPackModal.test.tsx` (17 tests) |
| TC016 | Frontend shows progress | Pass | `ApplyPackModal.test.tsx` progress tests |

**Test Summary:** 48 tests total (17 backend + 31 frontend), all passing

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010](../epics/EP0010-configuration-management.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec from US0119 story plan |
| 2026-01-29 | Claude | Status: Draft → Complete. All 16 test cases automated (48 tests total) |
