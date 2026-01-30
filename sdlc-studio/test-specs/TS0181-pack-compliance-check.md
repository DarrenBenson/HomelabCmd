# TS0181: Configuration Compliance Checker

> **Status:** Complete
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the configuration compliance checking feature. Validates that servers can be checked against configuration packs via SSH, with proper mismatch detection and result storage.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0117](../stories/US0117-pack-compliance-check.md) | Configuration Compliance Checker | P0 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0117 | AC1 | Compliance Check API | TC01, TC02, TC03, TC04 | Pending |
| US0117 | AC2 | File Checking | TC05, TC06, TC07 | Pending |
| US0117 | AC3 | Package Checking | TC08, TC09 | Pending |
| US0117 | AC4 | Setting Checking | TC10 | Pending |
| US0117 | AC5 | Performance | TC11 | Pending |
| US0117 | AC6 | Results Stored | TC12 | Pending |
| US0117 | AC7 | Offline Handling | TC13, TC14 | Pending |
| US0117 | AC8 | Pack Not Found | TC15 | Pending |

**Coverage:** 8/8 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test compliance service logic with mocked SSH |
| Integration | Yes | Test API endpoint with database |
| E2E | No | Requires live SSH server, covered by manual testing |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, pytest-asyncio |
| External Services | None (SSH mocked in tests) |
| Test Data | Mock packs, mock SSH responses |

---

## Test Cases

### TC01: Endpoint returns compliance result

**Type:** Integration | **Priority:** P0 | **Story:** US0117/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A registered server with SSH connectivity and a valid pack | Server exists in DB, pack exists |
| When | POST /api/v1/servers/{id}/config/check with {"pack_name": "base"} | Request sent with auth header |
| Then | Response is 200 with ConfigCheckResponse | JSON with is_compliant, mismatches, checked_at |

**Assertions:**
- [ ] Response status code is 200
- [ ] Response contains `is_compliant` boolean
- [ ] Response contains `mismatches` array
- [ ] Response contains `checked_at` ISO timestamp
- [ ] Response contains `check_duration_ms` integer

---

### TC02: Endpoint requires authentication

**Type:** Integration | **Priority:** P0 | **Story:** US0117/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A registered server | Server exists |
| When | POST /api/v1/servers/{id}/config/check without X-API-Key header | No auth header |
| Then | Response is 401 Unauthorized | Error response |

**Assertions:**
- [ ] Response status code is 401
- [ ] Response contains error detail

---

### TC03: Endpoint returns 404 for unknown server

**Type:** Integration | **Priority:** P0 | **Story:** US0117/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No server with ID "nonexistent" | Server does not exist |
| When | POST /api/v1/servers/nonexistent/config/check | Request sent |
| Then | Response is 404 Not Found | Error with server ID |

**Assertions:**
- [ ] Response status code is 404
- [ ] Response detail mentions server not found

---

### TC04: Endpoint returns 422 for missing pack_name

**Type:** Integration | **Priority:** P1 | **Story:** US0117/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A registered server | Server exists |
| When | POST /api/v1/servers/{id}/config/check with empty body | No pack_name |
| Then | Response is 422 Unprocessable Entity | Validation error |

**Assertions:**
- [ ] Response status code is 422
- [ ] Response indicates pack_name is required

---

### TC05: File existence check detects missing file

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack defines file ~/.config/test.conf | File in pack items |
| When | SSH command returns file does not exist | Mock SSH returns "MISSING" |
| Then | Mismatch with type "missing_file" is returned | Mismatch in results |

**Assertions:**
- [ ] Mismatch type is "missing_file"
- [ ] Mismatch item is "~/.config/test.conf"
- [ ] expected.exists is True
- [ ] actual.exists is False

---

### TC06: File permission check detects wrong mode

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack defines file with mode "0644" | Expected mode in pack |
| When | SSH command returns file has mode "0755" | Mock SSH returns actual mode |
| Then | Mismatch with type "wrong_permissions" is returned | Mode mismatch detected |

**Assertions:**
- [ ] Mismatch type is "wrong_permissions"
- [ ] expected.mode is "0644"
- [ ] actual.mode is "0755"

---

### TC07: File content check detects hash mismatch

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack defines file with content_hash "sha256:abc123" | Hash in pack |
| When | SSH sha256sum returns different hash | Mock SSH returns "sha256:xyz789" |
| Then | Mismatch with type "wrong_content" is returned | Content mismatch detected |

**Assertions:**
- [ ] Mismatch type is "wrong_content"
- [ ] expected.hash is "sha256:abc123"
- [ ] actual.hash is "sha256:xyz789"

---

### TC08: Package check detects missing package

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack defines package "curl" | Package in pack items |
| When | SSH dpkg-query returns package not installed | Mock SSH returns empty |
| Then | Mismatch with type "missing_package" is returned | Package mismatch detected |

**Assertions:**
- [ ] Mismatch type is "missing_package"
- [ ] Mismatch item is "curl"
- [ ] expected.installed is True
- [ ] actual.installed is False

---

### TC09: Package version check detects old version

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack defines curl with min_version "8.0.0" | Version constraint in pack |
| When | SSH dpkg-query returns curl version "7.88.0" | Mock SSH returns old version |
| Then | Mismatch with type "wrong_version" is returned | Version mismatch detected |

**Assertions:**
- [ ] Mismatch type is "wrong_version"
- [ ] Mismatch item is "curl"
- [ ] expected.min_version is "8.0.0"
- [ ] actual.version is "7.88.0"

---

### TC10: Setting check detects wrong environment variable

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack defines setting EDITOR=vim | Setting in pack items |
| When | SSH echo $EDITOR returns "nano" | Mock SSH returns wrong value |
| Then | Mismatch with type "wrong_setting" is returned | Setting mismatch detected |

**Assertions:**
- [ ] Mismatch type is "wrong_setting"
- [ ] Mismatch item is "EDITOR"
- [ ] expected.value is "vim"
- [ ] actual.value is "nano"

---

### TC11: Compliance check completes under 10 seconds

**Type:** Unit | **Priority:** P1 | **Story:** US0117/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A pack with 50 items (files, packages, settings) | Large pack |
| When | Compliance check runs | Timer records duration |
| Then | check_duration_ms is under 10000 | Performance target met |

**Assertions:**
- [ ] check_duration_ms < 10000
- [ ] All 50 items were checked

---

### TC12: Results stored in ConfigCheck table

**Type:** Integration | **Priority:** P0 | **Story:** US0117/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A successful compliance check | Check completes |
| When | Query ConfigCheck table for server | Database query |
| Then | Record exists with correct data | Row in table |

**Assertions:**
- [ ] ConfigCheck record exists
- [ ] server_id matches
- [ ] pack_name matches
- [ ] is_compliant matches response
- [ ] mismatches JSON matches response
- [ ] checked_at is recent timestamp

---

### TC13: SSH connection error returns 503

**Type:** Integration | **Priority:** P0 | **Story:** US0117/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with SSH connectivity issues | Mock SSH raises error |
| When | POST /api/v1/servers/{id}/config/check | Request sent |
| Then | Response is 503 Service Unavailable | SSH error communicated |

**Assertions:**
- [ ] Response status code is 503
- [ ] Response detail mentions SSH connection

---

### TC14: SSH authentication error returns 503

**Type:** Integration | **Priority:** P1 | **Story:** US0117/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with SSH auth failure | Mock SSH raises auth error |
| When | POST /api/v1/servers/{id}/config/check | Request sent |
| Then | Response is 503 with auth error detail | Auth error communicated |

**Assertions:**
- [ ] Response status code is 503
- [ ] Response detail mentions authentication

---

### TC15: Invalid pack name returns 404

**Type:** Integration | **Priority:** P0 | **Story:** US0117/AC8

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A registered server | Server exists |
| When | POST with {"pack_name": "nonexistent-pack"} | Invalid pack requested |
| Then | Response is 404 Not Found | Pack error communicated |

**Assertions:**
- [ ] Response status code is 404
- [ ] Response detail mentions pack not found

---

### TC16: Compliant server returns is_compliant true

**Type:** Unit | **Priority:** P0 | **Story:** US0117/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server that matches all pack requirements | All checks pass |
| When | Compliance check runs | Mock SSH returns compliant state |
| Then | is_compliant is true, mismatches is empty | Full compliance |

**Assertions:**
- [ ] is_compliant is True
- [ ] mismatches is empty array
- [ ] check_duration_ms is recorded

---

### TC17: Empty pack returns compliant

**Type:** Unit | **Priority:** P2 | **Story:** US0117/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A pack with no items defined | Empty items |
| When | Compliance check runs | No checks to perform |
| Then | is_compliant is true | Vacuously compliant |

**Assertions:**
- [ ] is_compliant is True
- [ ] mismatches is empty array

---

## Fixtures

```yaml
# Mock pack for testing
test_pack:
  name: Test Pack
  description: Pack for testing compliance checks
  items:
    files:
      - path: ~/.config/test.conf
        mode: "0644"
        content_hash: sha256:abc123def456
      - path: ~/.bashrc.d/aliases.sh
        mode: "0644"
    packages:
      - name: curl
        min_version: "8.0.0"
      - name: git
    settings:
      - key: EDITOR
        expected: vim
        type: env_var

# Mock SSH responses
ssh_compliant_response: |
  ---FILE:~/.config/test.conf---
  EXISTS
  644
  abc123def456
  ---FILE:~/.bashrc.d/aliases.sh---
  EXISTS
  644
  ---PACKAGES---
  curl    8.5.0-1   install ok installed
  git     2.40.1-1  install ok installed
  ---SETTINGS---
  EDITOR=vim

ssh_noncompliant_response: |
  ---FILE:~/.config/test.conf---
  MISSING
  ---FILE:~/.bashrc.d/aliases.sh---
  EXISTS
  755
  ---PACKAGES---
  curl    7.88.0-1  install ok installed
  git     2.40.1-1  install ok installed
  ---SETTINGS---
  EDITOR=nano
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Endpoint returns compliance result | Pass | `tests/test_config_check_api.py` |
| TC02 | Endpoint requires authentication | Pass | `test_check_requires_auth` |
| TC03 | Endpoint returns 404 for unknown server | Pass | `test_server_not_found` |
| TC04 | Endpoint returns 422 for missing pack_name | Pass | `test_validation_missing_pack_name` |
| TC05 | File existence check detects missing file | Pass | `tests/test_compliance_service.py::test_file_missing` |
| TC06 | File permission check detects wrong mode | Pass | `test_file_wrong_permissions` |
| TC07 | File content check detects hash mismatch | Pass | `test_file_wrong_content` |
| TC08 | Package check detects missing package | Pass | `test_package_missing` |
| TC09 | Package version check detects old version | Pass | `test_package_wrong_version` |
| TC10 | Setting check detects wrong env var | Pass | `test_setting_wrong_value` |
| TC11 | Compliance check under 10 seconds | Pass | Performance validated in service tests |
| TC12 | Results stored in ConfigCheck table | Pass | `test_stores_result_in_database` |
| TC13 | SSH connection error returns 503 | Pass | `test_ssh_unavailable` |
| TC14 | SSH authentication error returns 503 | Pass | `test_check_compliance_ssh_auth_error` |
| TC15 | Invalid pack name returns 404 | Pass | `test_pack_not_found` |
| TC16 | Compliant server returns is_compliant true | Pass | `test_all_compliant` |
| TC17 | Empty pack returns compliant | Pass | `test_check_compliance_empty_pack` |

**Test Summary:** 30 tests, 30 passed (17 TC mapped + 13 additional edge cases)

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010: Configuration Management](../epics/EP0010-configuration-management.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0181: Configuration Compliance Checker](../plans/PL0181-pack-compliance-check.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
| 2026-01-29 | Claude | Status: Draft → Complete. All 17 test cases automated (30 pytest tests) |
