# TS0186: Configuration Drift Detection

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Story:** [US0122: Configuration Drift Detection](../stories/US0122-configuration-drift-detection.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the configuration drift detection scheduled job. Tests cover scheduler registration, drift detection logic, alert creation/resolution, Slack notifications, and per-machine disable functionality.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0122](../stories/US0122-configuration-drift-detection.md) | Configuration Drift Detection | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0122 | AC1 | Scheduled compliance check at 6am | TC01, TC02 | Pending |
| US0122 | AC2 | Drift detection (compliant→non-compliant) | TC03, TC04 | Pending |
| US0122 | AC3 | Alert details (machine, pack, count, link) | TC05 | Pending |
| US0122 | AC4 | Alert severity is warning | TC05 | Pending |
| US0122 | AC5 | Slack notification on drift | TC06 | Pending |
| US0122 | AC6 | Auto-resolve when compliant | TC07, TC08 | Pending |
| US0122 | AC7 | Disable per machine | TC09 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test drift detection logic with mocked services |
| Integration | Yes | Test scheduler registration and job execution |
| E2E | No | Scheduler functionality tested via unit/integration |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, pytest-asyncio, pytest-mock |
| External Services | None (all mocked) |
| Test Data | Mock servers, compliance results, alerts |

---

## Test Cases

### TC01: Scheduler Job Registration

**Type:** Integration | **Priority:** High | **Story:** US0122/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Application starts with lifespan context | Scheduler initialised |
| When | Scheduler jobs are registered | check_config_drift job exists |
| Then | Job has CronTrigger(hour=6, minute=0) | Correct schedule |

**Assertions:**
- [ ] Job ID is "check_config_drift"
- [ ] Trigger is CronTrigger with hour=6, minute=0

---

### TC02: Scheduler Queries Eligible Servers

**Type:** Unit | **Priority:** High | **Story:** US0122/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 3 servers: 1 with packs, 1 without, 1 disabled | Test data setup |
| When | check_config_drift() runs | Only eligible server queried |
| Then | Compliance checked for eligible server only | Filter works |

**Assertions:**
- [ ] Server without assigned_packs is skipped
- [ ] Server with drift_detection_enabled=False is skipped
- [ ] Server with packs and enabled is checked

---

### TC03: Drift Detected - Compliant to Non-Compliant

**Type:** Unit | **Priority:** High | **Story:** US0122/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server was compliant in previous check | Previous ConfigCheck.is_compliant=True |
| When | Current check returns is_compliant=False | Drift detected |
| Then | config_drift alert is created | Alert in database |

**Assertions:**
- [ ] Alert alert_type is "config_drift"
- [ ] Alert server_id matches checked server
- [ ] Alert status is "open"

---

### TC04: No Alert on First Check

**Type:** Unit | **Priority:** Medium | **Story:** US0122/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has no previous compliance check | No ConfigCheck records |
| When | First check returns is_compliant=False | No drift (no previous state) |
| Then | No config_drift alert created | No drift alert |

**Assertions:**
- [ ] No alert created for first-time non-compliance
- [ ] ConfigCheck record created for future comparison

---

### TC05: Alert Details and Severity

**Type:** Unit | **Priority:** High | **Story:** US0122/AC3, AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Drift detected with 3 mismatches | Compliance check returns mismatches |
| When | Alert created | Alert has correct metadata |
| Then | Alert contains all required details | Metadata verified |

**Assertions:**
- [ ] Alert severity is "warning"
- [ ] Alert title includes machine display_name
- [ ] Alert message includes mismatch count (3)
- [ ] Alert metadata includes pack_name
- [ ] Alert metadata includes diff_url (/servers/{id}/config)

---

### TC06: Slack Notification Sent

**Type:** Unit | **Priority:** High | **Story:** US0122/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Drift detected and notifier configured | Slack webhook URL set |
| When | Alert created | Notification sent |
| Then | send_alert called with correct AlertEvent | Notification verified |

**Assertions:**
- [ ] AlertEvent metric_type is "config_drift"
- [ ] AlertEvent server_name matches server
- [ ] AlertEvent severity is "warning"
- [ ] AlertEvent current_value is mismatch count
- [ ] AlertEvent is_resolved is False

---

### TC07: Auto-Resolve When Compliant

**Type:** Unit | **Priority:** High | **Story:** US0122/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has open config_drift alert | Previous check non-compliant |
| When | Current check returns is_compliant=True | Server now compliant |
| Then | Alert auto-resolved | Alert status is "resolved" |

**Assertions:**
- [ ] Alert status changed to "resolved"
- [ ] Alert auto_resolved is True
- [ ] Alert resolved_at is set

---

### TC08: Resolution Notification Sent

**Type:** Unit | **Priority:** Medium | **Story:** US0122/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Drift alert auto-resolved | Previous test scenario |
| When | Alert resolved | Resolution notification sent |
| Then | send_alert called with is_resolved=True | Notification verified |

**Assertions:**
- [ ] AlertEvent is_resolved is True
- [ ] AlertEvent metric_type is "config_drift"

---

### TC09: Disabled Machine Skipped

**Type:** Unit | **Priority:** High | **Story:** US0122/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has drift_detection_enabled=False | Disabled in database |
| When | check_config_drift() runs | Server skipped |
| Then | No compliance check performed | compliance_service not called |

**Assertions:**
- [ ] compliance_service.check_compliance not called for disabled server
- [ ] No alert created for disabled server

---

### TC10: SSH Timeout Handling

**Type:** Unit | **Priority:** Medium | **Story:** Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server is eligible for drift check | Normal setup |
| When | SSH connection times out | SSHUnavailableError raised |
| Then | Error logged, server skipped, job continues | Graceful handling |

**Assertions:**
- [ ] Error logged with server ID
- [ ] No alert created for timeout
- [ ] Other servers still checked

---

### TC11: Multiple Packs Checked Separately

**Type:** Unit | **Priority:** Medium | **Story:** Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has assigned_packs=["base", "developer-max"] | Two packs assigned |
| When | check_config_drift() runs | Both packs checked |
| Then | Separate alerts for each pack if drift detected | Independent tracking |

**Assertions:**
- [ ] compliance_service.check_compliance called twice
- [ ] Separate alerts created per pack (if applicable)

---

### TC12: Existing Alert Updated Not Duplicated

**Type:** Unit | **Priority:** Medium | **Story:** Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Open config_drift alert exists for server | Previous drift alert |
| When | Drift detected again | Same server, same pack |
| Then | Existing alert updated, no duplicate | Single alert |

**Assertions:**
- [ ] Only one open alert for server/pack combination
- [ ] Alert message updated with new mismatch count

---

## Fixtures

```yaml
# Test fixtures for drift detection tests

servers:
  eligible_server:
    id: "eligible-server"
    hostname: "eligible.local"
    display_name: "Eligible Server"
    status: "online"
    drift_detection_enabled: true
    # assigned_packs: ["base"]  # From US0121

  disabled_server:
    id: "disabled-server"
    hostname: "disabled.local"
    display_name: "Disabled Server"
    status: "online"
    drift_detection_enabled: false

  no_packs_server:
    id: "no-packs"
    hostname: "nopacks.local"
    status: "online"
    drift_detection_enabled: true
    # assigned_packs: null

compliance_results:
  compliant:
    server_id: "eligible-server"
    pack_name: "base"
    is_compliant: true
    mismatches: []
    check_duration_ms: 1500

  non_compliant:
    server_id: "eligible-server"
    pack_name: "base"
    is_compliant: false
    mismatches:
      - type: "missing_package"
        item: "htop"
        expected: { installed: true }
        actual: { installed: false }
      - type: "wrong_permissions"
        item: "/etc/ssh/sshd_config"
        expected: { mode: "0600" }
        actual: { mode: "0644" }
      - type: "wrong_setting"
        item: "PasswordAuthentication"
        expected: { value: "no" }
        actual: { value: "yes" }
    check_duration_ms: 2100

previous_checks:
  was_compliant:
    server_id: "eligible-server"
    pack_name: "base"
    is_compliant: true
    checked_at: "2026-01-28T06:00:00Z"

  was_non_compliant:
    server_id: "eligible-server"
    pack_name: "base"
    is_compliant: false
    checked_at: "2026-01-28T06:00:00Z"

alerts:
  open_drift_alert:
    server_id: "eligible-server"
    alert_type: "config_drift"
    severity: "warning"
    status: "open"
    title: "Configuration drift on Eligible Server"
    message: "2 items no longer compliant with base"
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Scheduler Job Registration | Pending | - |
| TC02 | Scheduler Queries Eligible Servers | Pending | - |
| TC03 | Drift Detected - Compliant to Non-Compliant | Pending | - |
| TC04 | No Alert on First Check | Pending | - |
| TC05 | Alert Details and Severity | Pending | - |
| TC06 | Slack Notification Sent | Pending | - |
| TC07 | Auto-Resolve When Compliant | Pending | - |
| TC08 | Resolution Notification Sent | Pending | - |
| TC09 | Disabled Machine Skipped | Pending | - |
| TC10 | SSH Timeout Handling | Pending | - |
| TC11 | Multiple Packs Checked Separately | Pending | - |
| TC12 | Existing Alert Updated Not Duplicated | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010: Configuration Management](../epics/EP0010-configuration-management.md) |
| Plan | [PL0186: Configuration Drift Detection](../plans/PL0186-configuration-drift-detection.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec from story plan workflow |
