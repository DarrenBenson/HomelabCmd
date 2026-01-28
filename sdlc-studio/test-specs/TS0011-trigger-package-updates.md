# TS0011: Trigger Package Updates Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-20
> **Last Updated:** 2026-01-20

## Overview

Test specification for the Trigger Package Updates feature (US0052). This spec covers the extension of the Remediation Engine to support apt update/upgrade actions, including API endpoints, agent executor whitelist, and approval workflow integration.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0052](../../stories/US0052-trigger-package-updates.md) | Trigger Package Updates from Dashboard | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0052 | AC1 | Refresh package list button | TC190, TC191 | Covered |
| US0052 | AC2 | Apply all updates button | TC192, TC193 | Covered |
| US0052 | AC3 | Apply security updates only | TC194, TC195, TC196 | Covered |
| US0052 | AC4 | Action requires approval | TC197, TC198 | Covered |
| US0052 | AC5 | Action executes via remediation engine | TC199, TC200, TC201 | Covered |
| US0052 | AC6 | Success/failure feedback | TC202, TC203, TC204 | Covered |

**Coverage Summary:**
- Total ACs: 6
- Covered: 6
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Command building, whitelist validation |
| Integration | Yes | Action creation flow with database |
| API | Yes | Action endpoints with new types |
| E2E | No | Frontend component tests sufficient |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Backend running, database migrated, test fixtures, PendingPackage records |
| External Services | None (apt mocked in tests) |
| Test Data | Test server records, pending package fixtures |

---

## Test Cases

### TC190: Create apt_update action via API

**Type:** API
**Priority:** High
**Story:** US0052
**AC:** AC1

**Description:** Verify that POST /api/v1/actions with action_type=apt_update creates an action with correct command.

**Preconditions:**
- Test server exists in database
- API key is valid

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "test-server", "action_type": "apt_update"}
2. Verify response status is 201
3. Verify response contains action with command "apt update"

**Expected Result:**
- Action created with status "approved" (non-paused server)
- Command field is "apt update"

**Automation:** pytest

---

### TC191: apt_update action command in whitelist

**Type:** Unit
**Priority:** High
**Story:** US0052
**AC:** AC1

**Description:** Verify that "apt update" command passes executor whitelist validation.

**Preconditions:**
- None

**Steps:**
1. Call is_whitelisted("apt update")
2. Verify returns True

**Expected Result:**
- Command is accepted by whitelist

**Automation:** pytest

---

### TC192: Create apt_upgrade_all action via API

**Type:** API
**Priority:** High
**Story:** US0052
**AC:** AC2

**Description:** Verify that POST /api/v1/actions with action_type=apt_upgrade_all creates an action with correct command.

**Preconditions:**
- Test server exists in database
- API key is valid

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "test-server", "action_type": "apt_upgrade_all"}
2. Verify response status is 201
3. Verify response contains action with command "apt upgrade -y"

**Expected Result:**
- Action created with status "approved" (non-paused server)
- Command field is "apt upgrade -y"

**Automation:** pytest

---

### TC193: apt_upgrade command in whitelist

**Type:** Unit
**Priority:** High
**Story:** US0052
**AC:** AC2

**Description:** Verify that "apt upgrade -y" command passes executor whitelist validation.

**Preconditions:**
- None

**Steps:**
1. Call is_whitelisted("apt upgrade -y")
2. Verify returns True

**Expected Result:**
- Command is accepted by whitelist

**Automation:** pytest

---

### TC194: Create apt_upgrade_security action with packages

**Type:** Integration
**Priority:** High
**Story:** US0052
**AC:** AC3

**Description:** Verify that apt_upgrade_security creates command with security package names.

**Preconditions:**
- Test server exists with security packages in pending_packages table
- Security packages: openssl, libssl3

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "test-server", "action_type": "apt_upgrade_security"}
2. Verify response status is 201
3. Verify command contains "apt install -y openssl libssl3"

**Expected Result:**
- Action created with command listing security packages

**Automation:** pytest

---

### TC195: Create apt_upgrade_security action with no packages

**Type:** Integration
**Priority:** Medium
**Story:** US0052
**AC:** AC3

**Description:** Verify that apt_upgrade_security with no security packages creates echo command.

**Preconditions:**
- Test server exists with no security packages in pending_packages table

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "test-server", "action_type": "apt_upgrade_security"}
2. Verify response status is 201
3. Verify command is "echo 'No security packages to upgrade'"

**Expected Result:**
- Action created with informational echo command

**Automation:** pytest

---

### TC196: apt_install command in whitelist

**Type:** Unit
**Priority:** High
**Story:** US0052
**AC:** AC3

**Description:** Verify that "apt install -y <packages>" command passes executor whitelist validation.

**Preconditions:**
- None

**Steps:**
1. Call is_whitelisted("apt install -y openssl libssl3")
2. Verify returns True

**Expected Result:**
- Command is accepted by whitelist

**Automation:** pytest

---

### TC197: apt action requires approval on paused server

**Type:** Integration
**Priority:** High
**Story:** US0052
**AC:** AC4

**Description:** Verify that apt actions require approval when server is paused.

**Preconditions:**
- Test server exists with is_paused=True

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "paused-server", "action_type": "apt_update"}
2. Verify response status is 201
3. Verify action status is "pending"

**Expected Result:**
- Action created with status "pending" (requires approval)

**Automation:** pytest

---

### TC198: apt action auto-approved on normal server

**Type:** Integration
**Priority:** High
**Story:** US0052
**AC:** AC4

**Description:** Verify that apt actions are auto-approved when server is not paused.

**Preconditions:**
- Test server exists with is_paused=False

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "normal-server", "action_type": "apt_update"}
2. Verify response status is 201
3. Verify action status is "approved"
4. Verify approved_by is "auto"

**Expected Result:**
- Action created with status "approved" and approved_by "auto"

**Automation:** pytest

---

### TC199: Duplicate apt action rejected

**Type:** API
**Priority:** High
**Story:** US0052
**AC:** AC5

**Description:** Verify that duplicate apt actions are rejected while one is pending/approved/executing.

**Preconditions:**
- Test server exists
- Existing apt_update action with status "approved"

**Steps:**
1. Send POST /api/v1/actions with {"server_id": "test-server", "action_type": "apt_update"}
2. Verify response status is 409
3. Verify error message mentions existing action

**Expected Result:**
- Request rejected with conflict error

**Automation:** pytest

---

### TC200: Agent executor validates apt commands

**Type:** Unit
**Priority:** High
**Story:** US0052
**AC:** AC5

**Description:** Verify that agent executor only accepts whitelisted apt commands.

**Preconditions:**
- None

**Steps:**
1. Call is_whitelisted("apt update")
2. Call is_whitelisted("apt upgrade -y")
3. Call is_whitelisted("apt install -y openssl")
4. Call is_whitelisted("apt remove openssl") # malicious

**Expected Result:**
- First three return True
- Last one returns False (not in whitelist)

**Automation:** pytest

---

### TC201: apt command execution with timeout

**Type:** Unit
**Priority:** Medium
**Story:** US0052
**AC:** AC5

**Description:** Verify that apt commands can be executed with extended timeout.

**Preconditions:**
- Mock subprocess for apt command

**Steps:**
1. Call execute_command with "apt upgrade -y" and timeout=600
2. Verify command is executed with correct timeout

**Expected Result:**
- Command executed with 600 second timeout

**Automation:** pytest (mocked)

---

### TC202: Successful apt action recorded

**Type:** Integration
**Priority:** High
**Story:** US0052
**AC:** AC6

**Description:** Verify that successful apt action results are recorded in database.

**Preconditions:**
- Action exists with status "approved"
- Mock successful apt execution

**Steps:**
1. Submit action result with exit_code=0, stdout="Packages upgraded"
2. Query action from database
3. Verify status is "completed"
4. Verify exit_code and stdout are saved

**Expected Result:**
- Action updated with completion details

**Automation:** pytest

---

### TC203: Failed apt action recorded

**Type:** Integration
**Priority:** High
**Story:** US0052
**AC:** AC6

**Description:** Verify that failed apt action results are recorded with error output.

**Preconditions:**
- Action exists with status "approved"

**Steps:**
1. Submit action result with exit_code=100, stderr="E: Could not get lock"
2. Query action from database
3. Verify status is "failed"
4. Verify exit_code and stderr are saved

**Expected Result:**
- Action updated with failure details

**Automation:** pytest

---

### TC204: Action history shows apt action results

**Type:** API
**Priority:** Medium
**Story:** US0052
**AC:** AC6

**Description:** Verify that GET /api/v1/actions returns apt actions with full results.

**Preconditions:**
- Completed apt_update action exists with stdout

**Steps:**
1. Send GET /api/v1/actions?server_id=test-server
2. Verify response contains apt_update action
3. Verify action has stdout field populated

**Expected Result:**
- Action list includes apt actions with execution results

**Automation:** pytest

---

## Edge Case Tests

### TC205: Server offline when apt action queued

**Type:** Integration
**Priority:** Medium
**Story:** US0052

**Description:** Verify apt action remains pending when server is offline.

**Preconditions:**
- Test server exists but has not sent heartbeat recently (offline)
- Action created with status "approved"

**Steps:**
1. Verify action remains in "approved" status
2. No timeout error occurs

**Expected Result:**
- Action waits for agent to poll

**Automation:** pytest

---

### TC206: apt command with invalid package name rejected

**Type:** Unit
**Priority:** High
**Story:** US0052

**Description:** Verify that command injection via package name is blocked.

**Preconditions:**
- None

**Steps:**
1. Call is_whitelisted("apt install -y openssl; rm -rf /")
2. Verify returns False

**Expected Result:**
- Malicious command rejected by whitelist

**Automation:** pytest

---

## Test Data Requirements

### Fixtures Needed

| Fixture | Description |
|---------|-------------|
| test_server | Server with is_paused=False |
| paused_server | Server with is_paused=True |
| server_with_security_packages | Server with 2+ security packages in pending_packages |
| server_without_security_packages | Server with only non-security packages |
| existing_apt_action | apt_update action with status "approved" |

### Mock Data

| Mock | Description |
|------|-------------|
| apt update output | Simulated apt update stdout |
| apt upgrade output | Simulated apt upgrade stdout with package count |
| apt error output | Simulated apt error (lock file, permission denied) |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Test Cases | 17 |
| High Priority | 13 |
| Medium Priority | 4 |
| Unit Tests | 6 |
| Integration Tests | 7 |
| API Tests | 4 |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial test specification creation |
