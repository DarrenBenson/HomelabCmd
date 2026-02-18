# TS0201: Agent Auto-Update Mechanism Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-31
> **Last Updated:** 2026-02-17

## Overview

Test specification for the Agent Auto-Update Mechanism (US0184). Covers hub version advertisement, agent version detection, auto-update configuration, self-update flow with rollback, and dashboard integration.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0184](../stories/US0184-agent-auto-update.md) | Agent Auto-Update Mechanism | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0184 | AC1 | Hub advertises current agent version | TC001-TC003 | Pending |
| US0184 | AC2 | Agent detects version mismatch | TC004-TC007 | Pending |
| US0184 | AC3 | Auto-update toggle per server | TC008-TC011 | Pending |
| US0184 | AC4 | Agent self-updates when enabled | TC012-TC017 | Pending |
| US0184 | AC5 | Update status visible in dashboard | TC018-TC021 | Pending |
| US0184 | AC6 | Manual update trigger | TC022-TC024 | Pending |
| US0184 | AC7 | Rollback on update failure | TC025-TC029 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Version comparison logic, checksum verification, rollback mechanism |
| Integration | Yes | Agent-hub communication, database persistence |
| API | Yes | Heartbeat response, download endpoint, trigger endpoint |
| E2E | Yes | Full update flow from dashboard trigger to completion |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Docker Compose running, test database, mock agent binary |
| External Services | None (agent download mocked in tests) |
| Test Data | Server fixtures with various agent versions, mock VERSION files |

---

## Test Cases

### TC001: Heartbeat response includes latest version

**Type:** API | **Priority:** High | **Story:** US0184/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Hub configured with AGENT_VERSION=2.1.0 | Config loaded |
| When | Agent sends heartbeat to `/api/v1/agents/heartbeat` | Request processed |
| Then | Response contains `latest_agent_version: "2.1.0"` | Version advertised |

**Assertions:**
- [ ] Response status is 200
- [ ] Response body contains `latest_agent_version` field
- [ ] Version matches configured AGENT_VERSION
- [ ] Version follows semver format

---

### TC002: Heartbeat response without configured version

**Type:** API | **Priority:** Medium | **Story:** US0184/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Hub without AGENT_VERSION configured | Default behaviour |
| When | Agent sends heartbeat | Request processed |
| Then | Response has `latest_agent_version: null` | No version advertised |

**Assertions:**
- [ ] Response status is 200
- [ ] `latest_agent_version` is null or absent

---

### TC003: Heartbeat response includes update command when pending

**Type:** API | **Priority:** High | **Story:** US0184/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with `agent_update_status: "pending"` | Update queued |
| When | Agent sends heartbeat | Request processed |
| Then | Response contains `update_command: "update"` | Command delivered |

**Assertions:**
- [ ] Response contains `update_command: "update"`
- [ ] Server `agent_update_status` cleared after delivery

---

### TC004: Agent detects newer version available

**Type:** Unit | **Priority:** High | **Story:** US0184/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent with version 2.0.0 | Current version set |
| When | Heartbeat response has `latest_agent_version: "2.1.0"` | Newer version received |
| Then | Agent logs "New version available: 2.1.0" | Detection logged |

**Assertions:**
- [ ] `compare_versions("2.0.0", "2.1.0")` returns 1
- [ ] Agent sets `update_available: true` for next heartbeat

---

### TC005: Agent ignores same version

**Type:** Unit | **Priority:** Medium | **Story:** US0184/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent with version 2.0.0 | Current version set |
| When | Heartbeat response has `latest_agent_version: "2.0.0"` | Same version |
| Then | Agent does not flag update available | No action |

**Assertions:**
- [ ] `compare_versions("2.0.0", "2.0.0")` returns 0
- [ ] `update_available` remains false

---

### TC006: Agent ignores older version

**Type:** Unit | **Priority:** Medium | **Story:** US0184/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent with version 2.1.0 | Newer version |
| When | Heartbeat response has `latest_agent_version: "2.0.0"` | Older advertised |
| Then | Agent does not flag update available | No downgrade |

**Assertions:**
- [ ] `compare_versions("2.1.0", "2.0.0")` returns -1
- [ ] No update triggered

---

### TC007: Version comparison handles pre-release versions

**Type:** Unit | **Priority:** Low | **Story:** US0184/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Various version strings | Semver parsing |
| When | Comparing versions | Logic applied |
| Then | Correct ordering determined | Comparison works |

**Assertions:**
- [ ] "2.1.0" > "2.0.0"
- [ ] "2.0.1" > "2.0.0"
- [ ] "2.1.0-beta" < "2.1.0"
- [ ] "2.1.0" == "2.1.0"

---

### TC008: Auto-update toggle default is disabled

**Type:** API | **Priority:** High | **Story:** US0184/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | New server registered | Fresh server |
| When | GET `/api/v1/servers/{id}` | Fetch server |
| Then | `auto_update_agent: false` | Default disabled |

**Assertions:**
- [ ] Server schema includes `auto_update_agent` field
- [ ] Default value is `false`

---

### TC009: Enable auto-update via API

**Type:** API | **Priority:** High | **Story:** US0184/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with auto_update disabled | Initial state |
| When | PATCH `/api/v1/servers/{id}` with `auto_update_agent: true` | Update setting |
| Then | Server has `auto_update_agent: true` | Setting persisted |

**Assertions:**
- [ ] Response status is 200
- [ ] Subsequent GET returns `auto_update_agent: true`
- [ ] Database value updated

---

### TC010: Disable auto-update via API

**Type:** API | **Priority:** Medium | **Story:** US0184/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with auto_update enabled | Enabled state |
| When | PATCH with `auto_update_agent: false` | Disable |
| Then | Server has `auto_update_agent: false` | Setting reverted |

**Assertions:**
- [ ] Setting can be toggled off
- [ ] No side effects on other server fields

---

### TC011: Auto-update toggle in frontend

**Type:** E2E | **Priority:** High | **Story:** US0184/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server detail page loaded | UI ready |
| When | Toggle auto-update switch | Click toggle |
| Then | Setting persists after refresh | API called, UI updated |

**Assertions:**
- [ ] Switch reflects current server state
- [ ] Toggle triggers PATCH request
- [ ] Toast confirms change

---

### TC012: Agent downloads new version when auto-update enabled

**Type:** Integration | **Priority:** High | **Story:** US0184/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with auto_update enabled, newer version available | Conditions met |
| When | Agent receives heartbeat with newer version | Update detected |
| Then | Agent requests GET `/api/v1/agents/download?version=2.1.0` | Download initiated |

**Assertions:**
- [ ] Download request made with correct version
- [ ] Download request includes auth header

---

### TC013: Agent verifies download checksum

**Type:** Unit | **Priority:** High | **Story:** US0184/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Downloaded agent binary | Binary received |
| When | Checksum compared to `X-Checksum-SHA256` header | Verification |
| Then | Checksum matches | Verification passes |

**Assertions:**
- [ ] SHA256 hash calculated correctly
- [ ] Hash compared to server-provided checksum
- [ ] Mismatch raises error

---

### TC014: Agent backs up current version before update

**Type:** Unit | **Priority:** High | **Story:** US0184/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent about to update | Pre-update |
| When | Update process starts | Backup phase |
| Then | Current agent copied to `.bak` location | Backup created |

**Assertions:**
- [ ] Backup file exists at expected path
- [ ] Backup is complete copy of current agent

---

### TC015: Agent replaces binary and restarts

**Type:** Integration | **Priority:** High | **Story:** US0184/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | New version downloaded and verified | Ready to install |
| When | Agent applies update | Replacement |
| Then | New binary in place, service restarted | Update complete |

**Assertions:**
- [ ] New binary replaces old
- [ ] Service restart command issued
- [ ] New version reported in next heartbeat

---

### TC016: Agent skips update when auto-update disabled

**Type:** Integration | **Priority:** High | **Story:** US0184/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with auto_update disabled, newer version available | Auto-update off |
| When | Agent receives heartbeat with newer version | Detection only |
| Then | Agent reports `update_available: true` but does not download | No auto-update |

**Assertions:**
- [ ] No download request made
- [ ] `update_available` reported to hub
- [ ] Agent continues with current version

---

### TC017: Agent waits for active command before updating

**Type:** Unit | **Priority:** Medium | **Story:** US0184/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Update available, command executing | Busy agent |
| When | Update check runs | Deferred |
| Then | Update deferred until command completes | No interruption |

**Assertions:**
- [ ] Active command detection works
- [ ] Update queued for next check
- [ ] Command not interrupted

---

### TC018: Update badge displays on server card

**Type:** E2E | **Priority:** High | **Story:** US0184/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with outdated agent | Version mismatch |
| When | Dashboard loads | UI renders |
| Then | "Update available" badge visible on server card | Badge shown |

**Assertions:**
- [ ] Badge has correct styling (warning variant)
- [ ] Badge text is "Update available"
- [ ] Badge not shown when versions match

---

### TC019: Version comparison visible in server detail

**Type:** E2E | **Priority:** Medium | **Story:** US0184/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with outdated agent | Version mismatch |
| When | Server detail page loaded | UI renders |
| Then | Current version and latest version displayed | Versions shown |

**Assertions:**
- [ ] Current version shown (e.g., "2.0.0")
- [ ] Latest version shown (e.g., "2.1.0")
- [ ] Visual indicator of mismatch

---

### TC020: Update status shows downloading

**Type:** E2E | **Priority:** Medium | **Story:** US0184/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent downloading update | In progress |
| When | Server detail page loaded | Status check |
| Then | Status shows "Downloading..." | Progress visible |

**Assertions:**
- [ ] Status text updates in real-time
- [ ] Progress indicator visible

---

### TC021: Update status shows failure with error

**Type:** E2E | **Priority:** Medium | **Story:** US0184/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent update failed | Error state |
| When | Server detail page loaded | Status check |
| Then | Status shows "Failed" with error message | Error visible |

**Assertions:**
- [ ] Error status displayed
- [ ] Error message from agent shown
- [ ] Retry option available

---

### TC022: Manual update trigger via UI

**Type:** E2E | **Priority:** High | **Story:** US0184/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with outdated agent, auto-update disabled | Manual needed |
| When | Click "Update Agent" button | Trigger action |
| Then | Update queued, agent updates on next heartbeat | Manual trigger works |

**Assertions:**
- [ ] Button enabled when update available
- [ ] POST `/api/v1/servers/{id}/trigger-update` called
- [ ] Toast confirms update queued

---

### TC023: Manual update works regardless of auto-update setting

**Type:** API | **Priority:** High | **Story:** US0184/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with auto_update disabled | Setting off |
| When | POST `/api/v1/servers/{id}/trigger-update` | Manual trigger |
| Then | Agent receives `update_command: "update"` in next heartbeat | Command delivered |

**Assertions:**
- [ ] Manual trigger bypasses auto-update setting
- [ ] Server `agent_update_status` set to "pending"

---

### TC024: Update button disabled when no update available

**Type:** E2E | **Priority:** Medium | **Story:** US0184/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with current agent version | No update needed |
| When | Server detail page loaded | UI check |
| Then | "Update Agent" button disabled or hidden | No false trigger |

**Assertions:**
- [ ] Button disabled or not rendered
- [ ] Tooltip explains why (if disabled)

---

### TC025: Rollback on download failure

**Type:** Unit | **Priority:** High | **Story:** US0184/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Download fails after 3 retries | Network error |
| When | Agent handles failure | Error handling |
| Then | Agent continues with current version, reports failure | Graceful degradation |

**Assertions:**
- [ ] Retry logic executed 3 times
- [ ] No binary replacement attempted
- [ ] Error reported to hub

---

### TC026: Rollback on checksum mismatch

**Type:** Unit | **Priority:** High | **Story:** US0184/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Downloaded binary with wrong checksum | Corrupt download |
| When | Checksum verification fails | Rejection |
| Then | Download rejected, error reported | Corruption detected |

**Assertions:**
- [ ] Downloaded file deleted
- [ ] No replacement attempted
- [ ] "Checksum mismatch" error reported

---

### TC027: Rollback on startup failure

**Type:** Integration | **Priority:** High | **Story:** US0184/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | New agent binary fails to start | Corrupt binary |
| When | Service restart fails | Startup error |
| Then | Previous version restored, service restarted | Rollback executed |

**Assertions:**
- [ ] Backup restored to agent path
- [ ] Service restarted with old version
- [ ] Failure reported to hub

---

### TC028: Rollback preserves agent functionality

**Type:** Integration | **Priority:** Medium | **Story:** US0184/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Rollback executed after failed update | Recovery |
| When | Agent restarts with old version | Back online |
| Then | Agent sends heartbeats normally | Functionality preserved |

**Assertions:**
- [ ] Heartbeats resume within 60 seconds
- [ ] Correct (old) version reported
- [ ] No data loss

---

### TC029: Update failure visible in dashboard

**Type:** E2E | **Priority:** Medium | **Story:** US0184/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Agent update failed and rolled back | Failure state |
| When | Dashboard/server detail loaded | UI check |
| Then | Failure status and error message visible | User informed |

**Assertions:**
- [ ] Status shows "Failed"
- [ ] Error message displayed
- [ ] "Retry" or "Update" button available

---

## Fixtures

```yaml
servers:
  - id: "server-outdated"
    server_id: "test-server-1"
    agent_version: "2.0.0"
    auto_update_agent: false
    status: "online"

  - id: "server-auto-update"
    server_id: "test-server-2"
    agent_version: "2.0.0"
    auto_update_agent: true
    status: "online"

  - id: "server-current"
    server_id: "test-server-3"
    agent_version: "2.1.0"
    auto_update_agent: false
    status: "online"

  - id: "server-update-pending"
    server_id: "test-server-4"
    agent_version: "2.0.0"
    auto_update_agent: false
    agent_update_status: "pending"
    status: "online"

  - id: "server-update-failed"
    server_id: "test-server-5"
    agent_version: "2.0.0"
    auto_update_agent: true
    agent_update_status: "failed"
    agent_update_error: "Checksum mismatch"
    status: "online"

config:
  AGENT_VERSION: "2.1.0"

mock_binaries:
  - version: "2.1.0"
    path: "/tmp/test-agent-2.1.0.tar.gz"
    checksum: "sha256:abc123..."

  - version: "2.1.0-corrupt"
    path: "/tmp/test-agent-corrupt.tar.gz"
    checksum: "sha256:wrong..."
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Heartbeat response includes latest version | Pending | - |
| TC002 | Heartbeat response without configured version | Pending | - |
| TC003 | Heartbeat response includes update command | Pending | - |
| TC004 | Agent detects newer version available | Pending | - |
| TC005 | Agent ignores same version | Pending | - |
| TC006 | Agent ignores older version | Pending | - |
| TC007 | Version comparison handles pre-release | Pending | - |
| TC008 | Auto-update toggle default is disabled | Pending | - |
| TC009 | Enable auto-update via API | Pending | - |
| TC010 | Disable auto-update via API | Pending | - |
| TC011 | Auto-update toggle in frontend | Pending | - |
| TC012 | Agent downloads new version | Pending | - |
| TC013 | Agent verifies download checksum | Pending | - |
| TC014 | Agent backs up current version | Pending | - |
| TC015 | Agent replaces binary and restarts | Pending | - |
| TC016 | Agent skips update when disabled | Pending | - |
| TC017 | Agent waits for active command | Pending | - |
| TC018 | Update badge displays on server card | Pending | - |
| TC019 | Version comparison visible in detail | Pending | - |
| TC020 | Update status shows downloading | Pending | - |
| TC021 | Update status shows failure | Pending | - |
| TC022 | Manual update trigger via UI | Pending | - |
| TC023 | Manual update bypasses auto-update | Pending | - |
| TC024 | Update button disabled when current | Pending | - |
| TC025 | Rollback on download failure | Pending | - |
| TC026 | Rollback on checksum mismatch | Pending | - |
| TC027 | Rollback on startup failure | Pending | - |
| TC028 | Rollback preserves functionality | Pending | - |
| TC029 | Update failure visible in dashboard | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md) |
| Story | [US0184: Agent Auto-Update Mechanism](../stories/US0184-agent-auto-update.md) |
| Plan | [PL0201: Agent Auto-Update](../plans/PL0201-agent-auto-update.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial spec - 29 test cases covering 7 ACs |
