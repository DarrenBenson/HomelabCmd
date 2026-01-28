# TS0014: Scan Initiation Tests

> **Status:** In Progress
> **Epic:** [EP0006: Ad-hoc Scanning](../../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Last Updated:** 2026-01-21

## Overview

Test specification for the Scan Initiation feature (US0038). This spec covers the SSH-based scanning of transient devices, including quick and full scan types, progress tracking, and result storage.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0038](../../stories/US0038-scan-initiation.md) | Scan Initiation | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0038 | AC1 | Initiate quick scan | TC207, TC208 | Covered |
| US0038 | AC2 | Initiate full scan | TC209, TC210 | Covered |
| US0038 | AC3 | Quick scan data | TC211, TC212, TC213 | Covered |
| US0038 | AC4 | Full scan data | TC214, TC215, TC216 | Covered |
| US0038 | AC5 | Scan progress tracking | TC217, TC218, TC219 | Covered |

**Coverage Summary:**
- Total ACs: 5
- Covered: 5
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Command parsing, result aggregation |
| Integration | Yes | SSH service with scan service |
| API | Yes | Scan endpoints with authentication |
| E2E | No | Backend API tests sufficient |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Backend running, database migrated, SSH keys configured |
| External Services | Mock SSH target (paramiko mocked in tests) |
| Test Data | Test scan records, mock command outputs |

---

## Test Cases

### TC207: Initiate quick scan via API

**Type:** API
**Priority:** High
**Story:** US0038
**AC:** AC1

**Description:** Verify that POST /api/v1/scans with scan_type="quick" creates a pending scan.

**Preconditions:**
- API key is valid
- SSH keys configured

**Steps:**
1. Send POST /api/v1/scans with {"hostname": "192.168.1.100", "scan_type": "quick"}
2. Verify response status is 202 Accepted
3. Verify response contains scan_id, status="pending", scan_type="quick"

**Expected Result:**
- Scan record created in database
- Response includes scan_id for status polling

**Automation:** pytest

---

### TC208: Quick scan uses default port and username

**Type:** API
**Priority:** Medium
**Story:** US0038
**AC:** AC1

**Description:** Verify that quick scan uses default port (22) and username when not specified.

**Preconditions:**
- API key is valid
- Default SSH settings configured

**Steps:**
1. Send POST /api/v1/scans with {"hostname": "192.168.1.100", "scan_type": "quick"} (no port/username)
2. Query scan record from database
3. Verify port is 22 and username is default

**Expected Result:**
- Scan created with default connection parameters

**Automation:** pytest

---

### TC209: Initiate full scan via API

**Type:** API
**Priority:** High
**Story:** US0038
**AC:** AC2

**Description:** Verify that POST /api/v1/scans with scan_type="full" creates a pending scan.

**Preconditions:**
- API key is valid
- SSH keys configured

**Steps:**
1. Send POST /api/v1/scans with {"hostname": "192.168.1.100", "scan_type": "full"}
2. Verify response status is 202 Accepted
3. Verify response contains scan_id, status="pending", scan_type="full"

**Expected Result:**
- Scan record created with scan_type="full"

**Automation:** pytest

---

### TC210: Full scan with custom port and username

**Type:** API
**Priority:** Medium
**Story:** US0038
**AC:** AC2

**Description:** Verify that full scan accepts custom port and username.

**Preconditions:**
- API key is valid

**Steps:**
1. Send POST /api/v1/scans with {"hostname": "192.168.1.100", "port": 2222, "username": "admin", "scan_type": "full"}
2. Query scan record from database
3. Verify port is 2222 and username is "admin"

**Expected Result:**
- Scan created with specified connection parameters

**Automation:** pytest

---

### TC211: Parse OS release data

**Type:** Unit
**Priority:** High
**Story:** US0038
**AC:** AC3

**Description:** Verify that ScanService.parse_os_release correctly parses /etc/os-release output.

**Preconditions:**
- None

**Steps:**
1. Call parse_os_release with sample Ubuntu os-release content
2. Verify result contains name="Ubuntu", version="22.04", pretty_name

**Expected Result:**
- OS info dictionary with name, version, id, pretty_name fields

**Automation:** pytest

---

### TC212: Parse disk usage data

**Type:** Unit
**Priority:** High
**Story:** US0038
**AC:** AC3

**Description:** Verify that ScanService.parse_disk_usage correctly parses df -P output.

**Preconditions:**
- None

**Steps:**
1. Call parse_disk_usage with sample df output
2. Verify result contains list of disk entries with mount, total_gb, used_gb, percent

**Expected Result:**
- List of disk dictionaries with correct values

**Automation:** pytest

---

### TC213: Parse memory data

**Type:** Unit
**Priority:** High
**Story:** US0038
**AC:** AC3

**Description:** Verify that ScanService.parse_memory correctly parses free -b output.

**Preconditions:**
- None

**Steps:**
1. Call parse_memory with sample free output
2. Verify result contains total_mb, used_mb, percent

**Expected Result:**
- Memory dictionary with correct calculated values

**Automation:** pytest

---

### TC214: Full scan includes packages

**Type:** Unit
**Priority:** High
**Story:** US0038
**AC:** AC4

**Description:** Verify that ScanService.parse_package_count and parse_package_list correctly parse dpkg output.

**Preconditions:**
- None

**Steps:**
1. Call parse_package_count with sample dpkg -l | wc -l output
2. Call parse_package_list with sample dpkg -l output
3. Verify count is correct (minus header lines)
4. Verify list contains package names (max 50)

**Expected Result:**
- Package count integer and list of package names

**Automation:** pytest

---

### TC215: Full scan includes processes

**Type:** Unit
**Priority:** High
**Story:** US0038
**AC:** AC4

**Description:** Verify that ScanService.parse_processes correctly parses ps aux output.

**Preconditions:**
- None

**Steps:**
1. Call parse_processes with sample ps aux output
2. Verify result contains list of process entries with user, pid, cpu_percent, mem_percent, command

**Expected Result:**
- List of process dictionaries (max 20)

**Automation:** pytest

---

### TC216: Full scan includes network interfaces

**Type:** Unit
**Priority:** High
**Story:** US0038
**AC:** AC4

**Description:** Verify that ScanService.parse_network_interfaces correctly parses ip addr show output.

**Preconditions:**
- None

**Steps:**
1. Call parse_network_interfaces with sample ip addr output
2. Verify result contains list of interfaces with name, state, addresses

**Expected Result:**
- List of interface dictionaries with IPv4 and IPv6 addresses

**Automation:** pytest

---

### TC217: Get scan status during execution

**Type:** API
**Priority:** High
**Story:** US0038
**AC:** AC5

**Description:** Verify that GET /api/v1/scans/{scan_id} returns progress during scan execution.

**Preconditions:**
- Scan record exists with status="running", progress=50, current_step="Collecting disk usage"

**Steps:**
1. Send GET /api/v1/scans/{scan_id}
2. Verify response status is 200
3. Verify response contains progress=50, current_step, status="running"

**Expected Result:**
- Scan status with progress percentage and step description

**Automation:** pytest

---

### TC218: Scan progress updates during execution

**Type:** Integration
**Priority:** High
**Story:** US0038
**AC:** AC5

**Description:** Verify that scan execution updates progress in database.

**Preconditions:**
- Scan record exists with status="pending"
- Mock SSH commands to succeed

**Steps:**
1. Execute scan via ScanService.execute_scan
2. Query scan record during execution
3. Verify progress increases (0 -> 20 -> 40 -> 60 -> 80 -> 100)
4. Verify current_step changes at each stage

**Expected Result:**
- Progress and current_step updated in database as scan executes

**Automation:** pytest (with mocked SSH)

---

### TC219: Get completed scan results

**Type:** API
**Priority:** High
**Story:** US0038
**AC:** AC5

**Description:** Verify that GET /api/v1/scans/{scan_id} returns full results when completed.

**Preconditions:**
- Scan record exists with status="completed" and results JSON

**Steps:**
1. Send GET /api/v1/scans/{scan_id}
2. Verify response status is 200
3. Verify response contains status="completed", completed_at, results object

**Expected Result:**
- Full scan results with os, hostname, uptime, disk, memory

**Automation:** pytest

---

## Edge Case Tests

### TC220: Connection refused error

**Type:** Integration
**Priority:** High
**Story:** US0038

**Description:** Verify that connection refused error is handled gracefully.

**Preconditions:**
- Scan record exists
- Mock SSH to raise connection refused error

**Steps:**
1. Execute scan via ScanService.execute_scan
2. Verify scan status is "failed"
3. Verify error message contains "Connection refused"

**Expected Result:**
- Scan marked failed with appropriate error

**Automation:** pytest

---

### TC221: SSH authentication failure

**Type:** Integration
**Priority:** High
**Story:** US0038

**Description:** Verify that SSH authentication failure is handled gracefully.

**Preconditions:**
- Scan record exists
- Mock SSH to raise AuthenticationException

**Steps:**
1. Execute scan via ScanService.execute_scan
2. Verify scan status is "failed"
3. Verify error message contains "Authentication"

**Expected Result:**
- Scan marked failed with authentication error

**Automation:** pytest

---

### TC222: Connection timeout

**Type:** Integration
**Priority:** High
**Story:** US0038

**Description:** Verify that connection timeout is handled gracefully.

**Preconditions:**
- Scan record exists
- Mock SSH to raise TimeoutError

**Steps:**
1. Execute scan via ScanService.execute_scan
2. Verify scan status is "failed"
3. Verify error message contains "timed out"

**Expected Result:**
- Scan marked failed with timeout error

**Automation:** pytest

---

### TC223: Command fails during scan

**Type:** Integration
**Priority:** Medium
**Story:** US0038

**Description:** Verify that individual command failure doesn't fail entire scan.

**Preconditions:**
- Scan record exists
- Mock first SSH command (os-release) to succeed
- Mock second SSH command (df) to fail

**Steps:**
1. Execute scan via ScanService.execute_scan
2. Verify scan status is "completed"
3. Verify results contain os info
4. Verify results disk is empty or contains error note

**Expected Result:**
- Scan completes with partial results

**Automation:** pytest

---

### TC224: Scan not found returns 404

**Type:** API
**Priority:** Medium
**Story:** US0038

**Description:** Verify that GET /api/v1/scans/{scan_id} returns 404 for non-existent scan.

**Preconditions:**
- No scan with ID 99999 exists

**Steps:**
1. Send GET /api/v1/scans/99999
2. Verify response status is 404
3. Verify error message

**Expected Result:**
- 404 Not Found response

**Automation:** pytest

---

### TC225: List scans with pagination

**Type:** API
**Priority:** Medium
**Story:** US0038

**Description:** Verify that GET /api/v1/scans returns paginated list of scans.

**Preconditions:**
- 25 scan records exist in database

**Steps:**
1. Send GET /api/v1/scans?limit=10&offset=0
2. Verify response contains 10 scans
3. Send GET /api/v1/scans?limit=10&offset=10
4. Verify response contains next 10 scans
5. Verify total count is 25

**Expected Result:**
- Paginated scan list with correct total

**Automation:** pytest

---

### TC226: List scans filtered by hostname

**Type:** API
**Priority:** Medium
**Story:** US0038

**Description:** Verify that GET /api/v1/scans can filter by hostname.

**Preconditions:**
- Scan records exist for multiple hostnames

**Steps:**
1. Send GET /api/v1/scans?hostname=192.168.1.100
2. Verify all returned scans have hostname="192.168.1.100"

**Expected Result:**
- Only scans for specified hostname returned

**Automation:** pytest

---

### TC227: Authentication required for scan endpoints

**Type:** API
**Priority:** High
**Story:** US0038

**Description:** Verify that all scan endpoints require API key authentication.

**Preconditions:**
- No API key header

**Steps:**
1. Send POST /api/v1/scans without API key
2. Verify response status is 401
3. Send GET /api/v1/scans without API key
4. Verify response status is 401

**Expected Result:**
- 401 Unauthorized for requests without API key

**Automation:** pytest

---

### TC228: Invalid scan type rejected

**Type:** API
**Priority:** Medium
**Story:** US0038

**Description:** Verify that invalid scan_type is rejected.

**Preconditions:**
- API key is valid

**Steps:**
1. Send POST /api/v1/scans with {"hostname": "192.168.1.100", "scan_type": "invalid"}
2. Verify response status is 422
3. Verify error indicates invalid scan_type

**Expected Result:**
- 422 Unprocessable Entity with validation error

**Automation:** pytest

---

### TC229: Empty hostname rejected

**Type:** API
**Priority:** Medium
**Story:** US0038

**Description:** Verify that empty hostname is rejected.

**Preconditions:**
- API key is valid

**Steps:**
1. Send POST /api/v1/scans with {"hostname": "", "scan_type": "quick"}
2. Verify response status is 422
3. Verify error indicates hostname required

**Expected Result:**
- 422 Unprocessable Entity with validation error

**Automation:** pytest

---

## Test Data Requirements

### Fixtures Needed

| Fixture | Description |
|---------|-------------|
| pending_scan | Scan record with status="pending" |
| running_scan | Scan record with status="running", progress=50 |
| completed_scan | Scan record with status="completed" and results JSON |
| failed_scan | Scan record with status="failed" and error message |
| multiple_scans | 25 scan records for pagination tests |

### Mock Data

| Mock | Description |
|------|-------------|
| os_release_output | Sample /etc/os-release content for Ubuntu 22.04 |
| df_output | Sample df -P output with multiple mounts |
| free_output | Sample free -b output |
| dpkg_output | Sample dpkg -l output with 100 packages |
| ps_output | Sample ps aux output with 25 processes |
| ip_addr_output | Sample ip addr show output with 3 interfaces |
| ssh_connection_error | Mock OSError for connection refused |
| ssh_auth_error | Mock AuthenticationException |
| ssh_timeout_error | Mock TimeoutError |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Test Cases | 23 |
| High Priority | 15 |
| Medium Priority | 8 |
| Unit Tests | 6 |
| Integration Tests | 5 |
| API Tests | 12 |
| Automated | 20/23 |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial test specification creation |
