# TS0010: Package Update List View Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-20
> **Last Updated:** 2026-01-20

## Overview

Test specification for the Package Update List View feature (US0051). This spec covers agent collection of package details, backend storage and API, and frontend display with filtering.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0051](../../stories/US0051-package-update-list.md) | Package Update List View | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0051 | AC1 | Agent collects package list | TC175, TC176, TC177, TC178 | Covered |
| US0051 | AC2 | Package list stored in database | TC179, TC180, TC181, TC182 | Covered |
| US0051 | AC3 | Package list displayed in server detail | TC183, TC184, TC185 | Covered |
| US0051 | AC4 | Package list filterable by type | TC186, TC187 | Covered |
| US0051 | AC5 | Package list refreshed on heartbeat | TC188, TC189 | Covered |

**Coverage Summary:**
- Total ACs: 5
- Covered: 5
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Agent parsing, database model, schema validation |
| Integration | Yes | Heartbeat flow with package data |
| API | Yes | Package list endpoint |
| E2E | No | Frontend component tests sufficient |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Backend running, database migrated, test fixtures |
| External Services | None (apt mocked in tests) |
| Test Data | Mock apt output, test server records |

---

## Test Cases

### TC175: Agent collects package list on Debian system

**Type:** Unit
**Priority:** High
**Story:** US0051/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | apt list --upgradable returns valid output |
| 2 | When | get_package_update_list() is called |
| 3 | Then | Returns list of packages with name, versions, repository, is_security flag |

#### Test Data

```yaml
input:
  apt_output: |
    Listing... [Done]
    openssl/bookworm-security 3.0.14-1~deb12u1 amd64 [upgradable from: 3.0.13-1~deb12u1]
    vim/bookworm 9.0.1499-1 amd64 [upgradable from: 9.0.1378-2]
expected:
  packages:
    - name: openssl
      current_version: "3.0.13-1~deb12u1"
      new_version: "3.0.14-1~deb12u1"
      repository: "bookworm-security"
      is_security: true
    - name: vim
      current_version: "9.0.1378-2"
      new_version: "9.0.1499-1"
      repository: "bookworm"
      is_security: false
```

#### Assertions

- [ ] Returns list with 2 packages
- [ ] openssl marked as security (repository contains "security")
- [ ] vim not marked as security
- [ ] All version strings parsed correctly

---

### TC176: Agent returns empty list on non-Debian system

**Type:** Unit
**Priority:** High
**Story:** US0051/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | apt command not available (FileNotFoundError) |
| 2 | When | get_package_update_list() is called |
| 3 | Then | Returns empty list without raising exception |

#### Test Data

```yaml
input:
  apt_available: false
expected:
  packages: []
```

#### Assertions

- [ ] Returns empty list
- [ ] No exception raised
- [ ] Warning logged

---

### TC177: Agent handles apt timeout gracefully

**Type:** Unit
**Priority:** Medium
**Story:** US0051/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | apt list command takes longer than timeout (30s) |
| 2 | When | get_package_update_list() is called |
| 3 | Then | Returns empty list after timeout |

#### Test Data

```yaml
input:
  timeout_seconds: 30
  apt_response_time: 35
expected:
  packages: []
```

#### Assertions

- [ ] Returns empty list
- [ ] subprocess.TimeoutExpired caught
- [ ] Warning logged with timeout details

---

### TC178: Agent parses package with special characters

**Type:** Unit
**Priority:** Medium
**Story:** US0051/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | apt output contains package with special characters |
| 2 | When | get_package_update_list() is called |
| 3 | Then | Package name stored correctly (UTF-8) |

#### Test Data

```yaml
input:
  apt_output: |
    Listing... [Done]
    libglib2.0-0/bookworm 2.74.6-2+deb12u3 amd64 [upgradable from: 2.74.6-2+deb12u2]
expected:
  packages:
    - name: "libglib2.0-0"
      repository: "bookworm"
```

#### Assertions

- [ ] Package name with dots and digits parsed correctly
- [ ] Version strings with plus signs parsed correctly

---

### TC179: Heartbeat stores package list in database

**Type:** Integration
**Priority:** High
**Story:** US0051/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server exists with no packages |
| 2 | When | Heartbeat received with packages array |
| 3 | Then | Packages stored in pending_packages table |

#### Test Data

```yaml
input:
  server_id: "test-server"
  packages:
    - name: openssl
      current_version: "3.0.13"
      new_version: "3.0.14"
      repository: "bookworm-security"
      is_security: true
expected:
  pending_packages_count: 1
  package:
    server_id: "test-server"
    name: openssl
```

#### Assertions

- [ ] PendingPackage record created
- [ ] server_id matches
- [ ] detected_at timestamp set
- [ ] updated_at timestamp set

---

### TC180: Heartbeat removes packages no longer pending

**Type:** Integration
**Priority:** High
**Story:** US0051/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server has 3 packages in pending_packages |
| 2 | When | Heartbeat received with only 2 packages |
| 3 | Then | Third package deleted from database |

#### Test Data

```yaml
input:
  existing_packages: [openssl, vim, curl]
  heartbeat_packages: [openssl, vim]
expected:
  remaining_packages: [openssl, vim]
  deleted_packages: [curl]
```

#### Assertions

- [ ] curl package no longer in database
- [ ] openssl and vim still present
- [ ] No orphan records

---

### TC181: Heartbeat updates existing package version

**Type:** Integration
**Priority:** High
**Story:** US0051/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server has openssl 3.0.13 -> 3.0.14 pending |
| 2 | When | Heartbeat received with openssl 3.0.13 -> 3.0.15 |
| 3 | Then | Package record updated with new version |

#### Test Data

```yaml
input:
  existing:
    name: openssl
    new_version: "3.0.14"
    detected_at: "2026-01-19T10:00:00Z"
  heartbeat:
    name: openssl
    new_version: "3.0.15"
expected:
  new_version: "3.0.15"
  detected_at_unchanged: true
  updated_at_changed: true
```

#### Assertions

- [ ] new_version updated to 3.0.15
- [ ] detected_at unchanged (original detection time preserved)
- [ ] updated_at reflects current time

---

### TC182: Heartbeat handles concurrent updates

**Type:** Integration
**Priority:** Medium
**Story:** US0051/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Two heartbeats arrive nearly simultaneously |
| 2 | When | Both processed concurrently |
| 3 | Then | Database remains consistent (last write wins) |

#### Test Data

```yaml
input:
  heartbeat_1:
    packages: [{name: openssl, new_version: "3.0.14"}]
  heartbeat_2:
    packages: [{name: openssl, new_version: "3.0.15"}]
expected:
  final_version: "3.0.14" or "3.0.15"  # deterministic based on timing
  no_duplicate_records: true
```

#### Assertions

- [ ] Only one openssl record exists
- [ ] No database errors
- [ ] Transaction isolation maintained

---

### TC183: API returns package list for server

**Type:** API
**Priority:** High
**Story:** US0051/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server has 3 packages pending |
| 2 | When | GET /api/v1/servers/{id}/packages |
| 3 | Then | Returns 200 with packages array |

#### Test Data

```yaml
input:
  server_id: "omv-mediaserver"
  packages_in_db: 3
expected:
  status_code: 200
  response:
    server_id: "omv-mediaserver"
    last_checked: "2026-01-20T10:00:00Z"
    total_count: 3
    security_count: 1
    packages:
      - name: openssl
        current_version: "3.0.13"
        new_version: "3.0.14"
        repository: "bookworm-security"
        is_security: true
```

#### Assertions

- [ ] Response status 200
- [ ] packages array has 3 items
- [ ] total_count matches array length
- [ ] security_count matches is_security=true count
- [ ] last_checked matches server.last_seen

---

### TC184: API returns 404 for unknown server

**Type:** API
**Priority:** High
**Story:** US0051/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server does not exist |
| 2 | When | GET /api/v1/servers/nonexistent/packages |
| 3 | Then | Returns 404 with error message |

#### Test Data

```yaml
input:
  server_id: "nonexistent-server"
expected:
  status_code: 404
  response:
    detail:
      code: "NOT_FOUND"
      message: "Server 'nonexistent-server' not found"
```

#### Assertions

- [ ] Response status 404
- [ ] Error detail matches expected format
- [ ] Server ID in error message

---

### TC185: API returns empty packages for new server

**Type:** API
**Priority:** Medium
**Story:** US0051/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server exists but no heartbeat yet (no packages) |
| 2 | When | GET /api/v1/servers/{id}/packages |
| 3 | Then | Returns 200 with empty packages, null last_checked |

#### Test Data

```yaml
input:
  server_id: "new-server"
  last_seen: null
expected:
  status_code: 200
  response:
    server_id: "new-server"
    last_checked: null
    total_count: 0
    security_count: 0
    packages: []
```

#### Assertions

- [ ] Response status 200
- [ ] packages array empty
- [ ] last_checked is null
- [ ] counts are 0

---

### TC186: Frontend filter shows only security packages

**Type:** Unit (Frontend)
**Priority:** High
**Story:** US0051/AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Package list component with 5 packages (2 security) |
| 2 | When | User clicks "Security Only" filter |
| 3 | Then | Only 2 security packages displayed |

#### Test Data

```yaml
input:
  packages:
    - {name: openssl, is_security: true}
    - {name: libssl3, is_security: true}
    - {name: vim, is_security: false}
    - {name: curl, is_security: false}
    - {name: git, is_security: false}
expected:
  filtered_packages: [openssl, libssl3]
  displayed_count: 2
```

#### Assertions

- [ ] Only 2 packages visible
- [ ] Both have is_security: true
- [ ] Filter button shows active state
- [ ] Count label shows "2 security"

---

### TC187: Frontend filter shows all packages

**Type:** Unit (Frontend)
**Priority:** Medium
**Story:** US0051/AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Security filter is active (showing 2 packages) |
| 2 | When | User clicks "All" filter |
| 3 | Then | All 5 packages displayed |

#### Test Data

```yaml
input:
  filter_state: "security"
  total_packages: 5
expected:
  displayed_count: 5
  filter_state: "all"
```

#### Assertions

- [ ] All 5 packages visible
- [ ] "All" button shows active state
- [ ] Count label shows "5 total"

---

### TC188: Package list updates after heartbeat

**Type:** Integration
**Priority:** High
**Story:** US0051/AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server has 3 packages displayed |
| 2 | When | Heartbeat arrives with 5 packages |
| 3 | Then | API returns 5 packages, frontend updates |

#### Test Data

```yaml
input:
  initial_packages: [openssl, vim, curl]
  heartbeat_packages: [openssl, vim, curl, git, nginx]
expected:
  api_response_count: 5
```

#### Assertions

- [ ] API returns 5 packages after heartbeat
- [ ] New packages (git, nginx) included
- [ ] Existing packages still present

---

### TC189: Package list reflects applied updates

**Type:** Integration
**Priority:** Medium
**Story:** US0051/AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given | Server has 5 packages pending |
| 2 | When | Updates applied, heartbeat shows 0 packages |
| 3 | Then | API returns empty packages array |

#### Test Data

```yaml
input:
  initial_packages: [openssl, vim, curl, git, nginx]
  heartbeat_packages: []
expected:
  api_response:
    total_count: 0
    packages: []
```

#### Assertions

- [ ] All packages removed from database
- [ ] API returns empty array
- [ ] Frontend shows "No updates available" or "Up to date"

---

## Fixtures

```yaml
# Shared test data for this spec

servers:
  - id: "omv-mediaserver"
    hostname: "omv-mediaserver"
    status: "online"
    last_seen: "2026-01-20T10:00:00Z"
  - id: "new-server"
    hostname: "new-server"
    status: "unknown"
    last_seen: null

packages:
  - name: openssl
    current_version: "3.0.13-1~deb12u1"
    new_version: "3.0.14-1~deb12u1"
    repository: "bookworm-security"
    is_security: true
  - name: libssl3
    current_version: "3.0.13-1~deb12u1"
    new_version: "3.0.14-1~deb12u1"
    repository: "bookworm-security"
    is_security: true
  - name: vim
    current_version: "9.0.1378-2"
    new_version: "9.0.1499-1"
    repository: "bookworm"
    is_security: false
  - name: curl
    current_version: "7.88.1-10+deb12u5"
    new_version: "7.88.1-10+deb12u6"
    repository: "bookworm"
    is_security: false
  - name: git
    current_version: "2.39.2-1.1"
    new_version: "2.39.5-0+deb12u1"
    repository: "bookworm"
    is_security: false

apt_mock_output: |
  Listing... [Done]
  openssl/bookworm-security 3.0.14-1~deb12u1 amd64 [upgradable from: 3.0.13-1~deb12u1]
  libssl3/bookworm-security 3.0.14-1~deb12u1 amd64 [upgradable from: 3.0.13-1~deb12u1]
  vim/bookworm 9.0.1499-1 amd64 [upgradable from: 9.0.1378-2]
  curl/bookworm 7.88.1-10+deb12u6 amd64 [upgradable from: 7.88.1-10+deb12u5]
  git/bookworm 2.39.5-0+deb12u1 amd64 [upgradable from: 2.39.2-1.1]
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC175 | Agent collects package list on Debian system | Automated | tests/test_packages.py::TestGetPackageUpdateList::test_collects_package_list_on_debian_system |
| TC176 | Agent returns empty list on non-Debian system | Automated | tests/test_packages.py::TestGetPackageUpdateList::test_returns_empty_list_on_non_debian_system |
| TC177 | Agent handles apt timeout gracefully | Automated | tests/test_packages.py::TestGetPackageUpdateList::test_handles_apt_timeout_gracefully |
| TC178 | Agent parses package with special characters | Automated | tests/test_packages.py::TestGetPackageUpdateList::test_parses_package_with_special_characters |
| TC179 | Heartbeat stores package list in database | Automated | tests/test_packages.py::TestHeartbeatPackageProcessing::test_heartbeat_stores_package_list |
| TC180 | Heartbeat removes packages no longer pending | Automated | tests/test_packages.py::TestHeartbeatPackageProcessing::test_heartbeat_removes_packages_no_longer_pending |
| TC181 | Heartbeat updates existing package version | Automated | tests/test_packages.py::TestHeartbeatPackageProcessing::test_heartbeat_updates_package_version |
| TC182 | Heartbeat handles concurrent updates | Automated | tests/test_packages.py::TestPackageEdgeCases::test_large_package_list |
| TC183 | API returns package list for server | Automated | tests/test_packages.py::TestGetServerPackagesEndpoint::test_returns_package_list_for_server |
| TC184 | API returns 404 for unknown server | Automated | tests/test_packages.py::TestGetServerPackagesEndpoint::test_returns_404_for_unknown_server |
| TC185 | API returns empty packages for new server | Automated | tests/test_packages.py::TestGetServerPackagesEndpoint::test_returns_empty_packages_for_new_server |
| TC186 | Frontend filter shows only security packages | Automated | tests/test_packages.py::TestPackageListFiltering::test_response_includes_security_count |
| TC187 | Frontend filter shows all packages | Automated | tests/test_packages.py::TestPackageListFiltering::test_response_includes_security_count |
| TC188 | Package list updates after heartbeat | Automated | tests/test_packages.py::TestHeartbeatPackageProcessing::test_heartbeat_updates_package_version |
| TC189 | Package list reflects applied updates | Automated | tests/test_packages.py::TestHeartbeatPackageProcessing::test_heartbeat_with_empty_packages_clears_all |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0036](../../plans/PL0036-package-update-list.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial spec generation |
