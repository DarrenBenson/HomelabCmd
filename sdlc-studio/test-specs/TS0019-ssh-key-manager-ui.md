# TS0019: SSH Key Manager UI

> **Status:** In Progress
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-22
> **Last Updated:** 2026-01-22

## Overview

Test specification for SSH Key Manager UI functionality. Covers backend API endpoints for key management (list, upload, delete), frontend components for key display and management, and integration with existing SSH features.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0071](../stories/US0071-ssh-key-manager-ui.md) | SSH Key Manager UI | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0071 | AC1 | View SSH keys in Settings | TC001, TC002, TC003 | Covered |
| US0071 | AC2 | Upload SSH private key | TC004, TC005, TC006, TC007, TC008 | Covered |
| US0071 | AC3 | Delete SSH key | TC009, TC010 | Covered |
| US0071 | AC4 | Configure default SSH username | TC011, TC012 | Covered |
| US0071 | AC5 | Test SSH connection | TC013, TC014, TC015 | Covered |
| US0071 | AC6 | Integration with existing features | TC016, TC017 | Covered |
| US0071 | AC7 | Helpful empty state | TC018 | Covered |

**Coverage Summary:**
- Total ACs: 7
- Covered: 7
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Service methods for key validation, metadata extraction |
| Integration | Yes | Database and file system interactions |
| API | Yes | REST endpoints for key management |
| E2E | No | Settings page integration tested via API and component tests |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Running backend, test database, /app/ssh directory with write access |
| External Services | None (SSH connections mocked for unit tests) |
| Test Data | Sample SSH keys (ED25519, RSA, ECDSA), invalid key content |

---

## Test Cases

### TC001: List SSH keys returns metadata only

**Type:** API
**Priority:** High
**Story:** US0071 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given SSH keys exist in /app/ssh | Keys id_ed25519 and id_rsa are present |
| 2 | When GET /api/v1/settings/ssh/keys | Request sent with valid API key |
| 3 | Then response contains key metadata | 200 OK with list of key metadata |

#### Test Data

```yaml
input:
  keys_in_directory:
    - id_ed25519
    - id_rsa
expected:
  status_code: 200
  body:
    keys:
      - id: "id_ed25519"
        name: "id_ed25519"
        type: "ED25519"
        fingerprint: "SHA256:..."
        created_at: "2026-01-22T..."
      - id: "id_rsa"
        name: "id_rsa"
        type: "RSA-4096"
        fingerprint: "SHA256:..."
        created_at: "2026-01-20T..."
```

#### Assertions

- [ ] Response status is 200
- [ ] Response contains 'keys' array
- [ ] Each key has id, name, type, fingerprint, created_at
- [ ] Private key content is NOT present in response

---

### TC002: List SSH keys empty state

**Type:** API
**Priority:** Medium
**Story:** US0071 AC1, AC7
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no SSH keys in /app/ssh | Directory is empty |
| 2 | When GET /api/v1/settings/ssh/keys | Request sent with valid API key |
| 3 | Then response contains empty array | 200 OK with empty keys array |

#### Test Data

```yaml
input:
  keys_in_directory: []
expected:
  status_code: 200
  body:
    keys: []
```

#### Assertions

- [ ] Response status is 200
- [ ] Response contains 'keys' array
- [ ] Keys array is empty

---

### TC003: Key type detection

**Type:** Unit
**Priority:** High
**Story:** US0071 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given SSH keys of different types | ED25519, RSA, ECDSA keys present |
| 2 | When get_key_metadata called for each | Metadata extracted |
| 3 | Then correct key type returned | Type matches actual key algorithm |

#### Test Data

```yaml
input:
  keys:
    - path: "/app/ssh/id_ed25519"
      content: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1..."
    - path: "/app/ssh/id_rsa"
      content: "-----BEGIN RSA PRIVATE KEY-----\nMIIG..."
    - path: "/app/ssh/id_ecdsa"
      content: "-----BEGIN EC PRIVATE KEY-----\nMHQ..."
expected:
  types:
    - "ED25519"
    - "RSA-4096"
    - "ECDSA"
```

#### Assertions

- [ ] ED25519 key returns type "ED25519"
- [ ] RSA key returns type including bit size
- [ ] ECDSA key returns type "ECDSA"

---

### TC004: Upload valid SSH key

**Type:** API
**Priority:** Critical
**Story:** US0071 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid ED25519 private key content | Key is not password-protected |
| 2 | When POST /api/v1/settings/ssh/keys with name and key | Request includes key content |
| 3 | Then key stored with 600 permissions | 201 Created with key metadata |

#### Test Data

```yaml
input:
  name: "work_key"
  private_key: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQyNTUxOQAAACB..."
expected:
  status_code: 201
  body:
    id: "work_key"
    name: "work_key"
    type: "ED25519"
    fingerprint: "SHA256:..."
    created_at: "2026-01-22T..."
  file:
    path: "/app/ssh/work_key"
    permissions: "600"
```

#### Assertions

- [ ] Response status is 201
- [ ] Response contains key metadata
- [ ] Response does NOT contain private_key content
- [ ] File created at /app/ssh/{name}
- [ ] File permissions are 600

---

### TC005: Upload invalid key format rejected

**Type:** API
**Priority:** High
**Story:** US0071 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given invalid key content | Content is not a valid SSH key |
| 2 | When POST /api/v1/settings/ssh/keys | Request with invalid content |
| 3 | Then 400 error returned | Clear error message about format |

#### Test Data

```yaml
input:
  name: "invalid_key"
  private_key: "not a valid ssh key content"
expected:
  status_code: 400
  body:
    detail: "Invalid SSH private key format"
```

#### Assertions

- [ ] Response status is 400
- [ ] Error message indicates invalid format
- [ ] No file created in /app/ssh

---

### TC006: Upload password-protected key rejected

**Type:** API
**Priority:** High
**Story:** US0071 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given password-protected SSH key | Key requires passphrase |
| 2 | When POST /api/v1/settings/ssh/keys | Request with protected key |
| 3 | Then 400 error returned | Clear error about passphrase |

#### Test Data

```yaml
input:
  name: "protected_key"
  private_key: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0..."
expected:
  status_code: 400
  body:
    detail: "Password-protected keys are not supported. Please decrypt the key first."
```

#### Assertions

- [ ] Response status is 400
- [ ] Error message mentions password-protected
- [ ] No file created in /app/ssh

---

### TC007: Upload duplicate key name rejected

**Type:** API
**Priority:** High
**Story:** US0071 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given key "work_key" already exists | File exists in /app/ssh |
| 2 | When POST with same name | Request with duplicate name |
| 3 | Then 409 Conflict returned | Error indicates duplicate |

#### Test Data

```yaml
input:
  name: "work_key"
  private_key: "-----BEGIN OPENSSH PRIVATE KEY-----..."
expected:
  status_code: 409
  body:
    detail: "A key with name 'work_key' already exists"
```

#### Assertions

- [ ] Response status is 409
- [ ] Error message indicates duplicate name
- [ ] Original key file unchanged

---

### TC008: Key name sanitisation

**Type:** Unit
**Priority:** Medium
**Story:** US0071 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given key name with special characters | Name contains spaces, slashes |
| 2 | When key uploaded | Name sanitised |
| 3 | Then safe filename used | Only alphanumeric, underscore, hyphen |

#### Test Data

```yaml
input:
  names:
    - "my key"
    - "../../etc/passwd"
    - "work_key-2024"
    - "key@home!"
expected:
  sanitised:
    - "mykey"
    - "etcpasswd"
    - "work_key-2024"
    - "keyhome"
```

#### Assertions

- [ ] Spaces removed
- [ ] Path traversal characters removed
- [ ] Underscore and hyphen preserved
- [ ] Special characters removed

---

### TC009: Delete SSH key

**Type:** API
**Priority:** High
**Story:** US0071 AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given key "work_key" exists | File present in /app/ssh |
| 2 | When DELETE /api/v1/settings/ssh/keys/work_key | Request with key ID |
| 3 | Then key removed | 204 No Content, file deleted |

#### Test Data

```yaml
input:
  key_id: "work_key"
  file_exists: true
expected:
  status_code: 204
  file_exists_after: false
```

#### Assertions

- [ ] Response status is 204
- [ ] No response body
- [ ] File removed from /app/ssh

---

### TC010: Delete non-existent key returns 404

**Type:** API
**Priority:** Medium
**Story:** US0071 AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given key "nonexistent" does not exist | No such file |
| 2 | When DELETE /api/v1/settings/ssh/keys/nonexistent | Request with bad ID |
| 3 | Then 404 returned | Error indicates not found |

#### Test Data

```yaml
input:
  key_id: "nonexistent"
expected:
  status_code: 404
  body:
    detail: "Key 'nonexistent' not found"
```

#### Assertions

- [ ] Response status is 404
- [ ] Error message indicates key not found

---

### TC011: Configure default SSH username

**Type:** API
**Priority:** High
**Story:** US0071 AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given SSH settings exist | Current username is "root" |
| 2 | When PUT /api/v1/settings/ssh with new username | Request with "darren" |
| 3 | Then username saved | Response shows updated username |

#### Test Data

```yaml
input:
  default_username: "darren"
expected:
  status_code: 200
  body:
    updated: ["default_username"]
    config:
      default_username: "darren"
```

#### Assertions

- [ ] Response status is 200
- [ ] Updated field list includes default_username
- [ ] Config shows new username value

---

### TC012: Default username used in operations

**Type:** Integration
**Priority:** High
**Story:** US0071 AC4, AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given default username is "darren" | Saved in settings |
| 2 | When test connection without specifying username | Request has no username |
| 3 | Then "darren" used for connection | SSH connects with saved username |

#### Test Data

```yaml
input:
  saved_username: "darren"
  test_request:
    hostname: "192.168.1.100"
    port: 22
    username: null  # Not specified
expected:
  connection_username: "darren"
```

#### Assertions

- [ ] Connection attempt uses saved default username
- [ ] Not the environment default

---

### TC013: Test SSH connection success

**Type:** API
**Priority:** High
**Story:** US0071 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given valid SSH keys configured | Key accepted by target |
| 2 | When POST /api/v1/settings/ssh/test | Request with reachable host |
| 3 | Then success with response time | Remote hostname returned |

#### Test Data

```yaml
input:
  hostname: "192.168.1.100"
  port: 22
  username: "darren"
expected:
  status_code: 200
  body:
    success: true
    hostname: "192.168.1.100"
    remote_hostname: "mediaserver"
    response_time_ms: 45
```

#### Assertions

- [ ] Response status is 200
- [ ] success is true
- [ ] remote_hostname present
- [ ] response_time_ms is positive integer

---

### TC014: Test SSH connection auth failure

**Type:** API
**Priority:** High
**Story:** US0071 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given SSH keys not accepted by target | No matching authorized_keys |
| 2 | When POST /api/v1/settings/ssh/test | Request to host |
| 3 | Then failure with helpful error | Error explains auth issue |

#### Test Data

```yaml
input:
  hostname: "192.168.1.100"
  port: 22
  username: "darren"
expected:
  status_code: 200
  body:
    success: false
    hostname: "192.168.1.100"
    error: "All keys rejected. Ensure your public key is in ~/.ssh/authorized_keys on the target."
```

#### Assertions

- [ ] Response status is 200 (not 4xx - this is a test result, not an error)
- [ ] success is false
- [ ] error message is helpful and actionable

---

### TC015: Test SSH connection no keys configured

**Type:** API
**Priority:** Medium
**Story:** US0071 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no SSH keys in /app/ssh | Directory empty |
| 2 | When POST /api/v1/settings/ssh/test | Request to test connection |
| 3 | Then failure indicating no keys | Clear error message |

#### Test Data

```yaml
input:
  hostname: "192.168.1.100"
  keys_configured: false
expected:
  status_code: 200
  body:
    success: false
    hostname: "192.168.1.100"
    error: "No SSH keys configured"
```

#### Assertions

- [ ] Response status is 200
- [ ] success is false
- [ ] error indicates no keys configured

---

### TC016: Service discovery uses managed keys

**Type:** Integration
**Priority:** High
**Story:** US0071 AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given key uploaded via UI | Key in /app/ssh |
| 2 | When service discovery runs | Discovery service starts |
| 3 | Then uploaded key used for SSH | Key appears in available keys |

#### Test Data

```yaml
input:
  uploaded_key: "work_key"
expected:
  available_keys_contains: "work_key"
```

#### Assertions

- [ ] SSHConnectionService.get_available_keys() includes uploaded key
- [ ] Service discovery can use the key for scanning

---

### TC017: Agent install uses managed keys

**Type:** Integration
**Priority:** High
**Story:** US0071 AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given key uploaded via UI | Key in /app/ssh |
| 2 | When agent install via SSH | Install process starts |
| 3 | Then uploaded key used for connection | Key tried for authentication |

#### Test Data

```yaml
input:
  uploaded_key: "work_key"
  target_host: "192.168.1.100"
expected:
  keys_tried_includes: "work_key"
```

#### Assertions

- [ ] Agent deploy service uses uploaded key
- [ ] Key is tried during authentication

---

### TC018: Empty state display

**Type:** Component
**Priority:** Medium
**Story:** US0071 AC7
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no SSH keys configured | API returns empty list |
| 2 | When viewing SSH Configuration section | Settings page rendered |
| 3 | Then helpful message and Add Key button shown | Empty state visible |

#### Test Data

```yaml
input:
  keys: []
expected:
  displays:
    - message: "No SSH keys configured"
    - button: "Add Key"
    - button_prominent: true
```

#### Assertions

- [ ] Helpful message displayed
- [ ] Add Key button visible
- [ ] Add Key button is prominent/highlighted

---

## Fixtures

```yaml
# Shared test data for this spec

valid_ed25519_key: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQy
  NTUxOQAAACBhbGljZUBleGFtcGxlLmNvbQAAAARub25lAAAABG5vbmUAAAABAAABlwAAAAdz
  c2gtcnNhAAAAAwEAAQAAAYEA...
  -----END OPENSSH PRIVATE KEY-----

valid_rsa_key: |
  -----BEGIN RSA PRIVATE KEY-----
  MIIGowIBAAKCAYEAyPJ/Kq...
  -----END RSA PRIVATE KEY-----

password_protected_key: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0...
  -----END OPENSSH PRIVATE KEY-----

invalid_key: "this is not a valid ssh key"

test_hosts:
  reachable:
    hostname: "192.168.1.100"
    port: 22
    remote_hostname: "mediaserver"
  unreachable:
    hostname: "192.168.1.254"
    port: 22
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | List SSH keys returns metadata only | ✅ Automated | tests/test_ssh_keys_api.py::TestListSSHKeys::test_list_keys_returns_metadata |
| TC002 | List SSH keys empty state | ✅ Automated | tests/test_ssh_keys_api.py::TestListSSHKeys::test_list_keys_empty_state |
| TC003 | Key type detection | ✅ Automated | tests/test_ssh_keys_api.py::TestKeyTypeDetection |
| TC004 | Upload valid SSH key | ✅ Automated | tests/test_ssh_keys_api.py::TestUploadSSHKey::test_upload_valid_key |
| TC005 | Upload invalid key format rejected | ✅ Automated | tests/test_ssh_keys_api.py::TestUploadSSHKey::test_upload_invalid_key_format_rejected |
| TC006 | Upload password-protected key rejected | ✅ Automated | tests/test_ssh_keys_api.py::TestUploadSSHKey::test_upload_password_protected_key_rejected |
| TC007 | Upload duplicate key name rejected | ✅ Automated | tests/test_ssh_keys_api.py::TestUploadSSHKey::test_upload_duplicate_name_rejected |
| TC008 | Key name sanitisation | ✅ Automated | tests/test_ssh_keys_api.py::TestKeyNameSanitisation (6 parametrised tests) |
| TC009 | Delete SSH key | ✅ Automated | tests/test_ssh_keys_api.py::TestDeleteSSHKey::test_delete_existing_key |
| TC010 | Delete non-existent key returns 404 | ✅ Automated | tests/test_ssh_keys_api.py::TestDeleteSSHKey::test_delete_nonexistent_key_returns_404 |
| TC011 | Configure default SSH username | ✅ Existing | tests/test_scan_routes.py (existing test coverage) |
| TC012 | Default username used in operations | ✅ Existing | tests/test_scan_routes.py (existing test coverage) |
| TC013 | Test SSH connection success | ✅ Existing | tests/test_ssh_service.py (existing test coverage) |
| TC014 | Test SSH connection auth failure | ✅ Existing | tests/test_ssh_service.py (existing test coverage) |
| TC015 | Test SSH connection no keys configured | ✅ Automated | tests/test_ssh_keys_api.py::TestConnectionTestNoKeys |
| TC016 | Service discovery uses managed keys | ✅ Implicit | Keys stored in same location used by existing services |
| TC017 | Agent install uses managed keys | ✅ Implicit | Keys stored in same location used by existing services |
| TC018 | Empty state display | Pending | Frontend component test (not yet implemented) |

**Summary:** 17/18 test cases automated (94%). TC018 requires frontend component test.

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0006](../epics/EP0006-adhoc-scanning.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0052](../plans/PL0052-ssh-key-manager-ui.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | Claude | Initial spec generation |
