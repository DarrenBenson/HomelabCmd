# TS0007: Alerting & Notifications Tests

> **Status:** Complete
> **Epic:** [EP0002: Alerting & Notifications](../../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Last Updated:** 2026-01-19

## Overview

Test specification for the alerting and notifications system. Covers alert database schema, threshold evaluation with sustained breach tracking, alert deduplication and auto-resolve, notification cooldowns, Slack integration, and alert API endpoints. Frontend tests cover dashboard alert display and alert list/detail views.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0010](../../stories/US0010-alert-schema.md) | Alert Entity and Database Schema | High |
| [US0011](../../stories/US0011-threshold-evaluation.md) | Threshold Evaluation and Alert Generation | High |
| [US0012](../../stories/US0012-alert-deduplication.md) | Alert Deduplication and Auto-Resolve | High |
| [US0013](../../stories/US0013-slack-integration.md) | Slack Webhook Integration | Medium |
| [US0014](../../stories/US0014-alert-api.md) | Alert API Endpoints | High |
| [US0015](../../stories/US0015-dashboard-alerts.md) | Dashboard Alert Display | Medium |
| [US0016](../../stories/US0016-alert-list-view.md) | Alert List and Detail Views | Medium |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Threshold evaluation, alert state management, cooldown logic |
| Integration | Yes | Database operations, Slack webhook calls |
| API | Yes | Alert CRUD endpoints, filtering, pagination |
| E2E | Yes | Dashboard alert display, alert list UI |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, pytest-asyncio, Node.js 18+, Vitest |
| External Services | Mock Slack webhook for notification tests |
| Test Data | Mock metrics data, sample alerts at various severities |

---

## Test Cases

### TC084: Alert table exists with required columns

**Type:** Unit
**Priority:** High
**Story:** US0010 (AC1)
**Automated:** Yes (`tests/test_alert_model.py::TestAlertTableExists`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the database is initialised | Schema created |
| 2 | When querying for alerts table | Table found |
| 3 | Then all required columns exist | Columns verified |

#### Assertions

- [x] alerts table exists
- [x] Has id, server_id, alert_type, severity, status columns
- [x] Has title, message, threshold_value, actual_value columns
- [x] Has created_at, acknowledged_at, resolved_at, auto_resolved columns

---

### TC085: Alert severity levels supported

**Type:** Unit
**Priority:** High
**Story:** US0010 (AC2)
**Automated:** Yes (`tests/test_alert_model.py::TestAlertSeverityLevels`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an alert is created | Alert object ready |
| 2 | When setting severity to each level | Severity assigned |
| 3 | Then critical, high, medium, low all accepted | No validation errors |

#### Assertions

- [x] critical severity accepted
- [x] high severity accepted
- [x] medium severity accepted
- [x] low severity accepted

---

### TC086: Alert status lifecycle

**Type:** Unit
**Priority:** High
**Story:** US0010 (AC3)
**Automated:** Yes (`tests/test_alert_model.py::TestAlertStatusLifecycle`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an alert is created | Status is 'open' by default |
| 2 | When status updated to 'acknowledged' | Transition allowed |
| 3 | Then status can transition to 'resolved' | Full lifecycle supported |

#### Assertions

- [x] open status is default
- [x] acknowledged status accepted
- [x] resolved status accepted
- [x] Transitions work correctly

---

### TC087: Alert links to server

**Type:** Unit
**Priority:** High
**Story:** US0010 (AC4)
**Automated:** Yes (`tests/test_alert_model.py::TestAlertServerRelationship`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an alert for server "omv-mediaserver" | Alert created |
| 2 | When querying the alert | Relationship accessible |
| 3 | Then server relationship is accessible | Server data returned |

#### Assertions

- [x] Alert links to server correctly
- [x] Server has alerts relationship (reverse)
- [x] Foreign key constraint enforced

---

### TC088: Cascade delete removes alerts

**Type:** Unit
**Priority:** Medium
**Story:** US0010 (edge case)
**Automated:** Yes (`tests/test_alert_model.py::TestAlertCascadeDelete`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given alerts exist for a server | Server has alerts |
| 2 | When server is deleted | Cascade triggered |
| 3 | Then associated alerts are deleted | No orphan alerts |

#### Assertions

- [x] Deleting server removes associated alerts
- [x] No integrity errors

---

### TC089: Disk high threshold creates alert immediately

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC1)
**Automated:** Yes (`tests/test_alerting.py::TestDiskAlertImmediate`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server reports disk usage of 82% | Heartbeat received |
| 2 | When the heartbeat is processed | Threshold evaluated |
| 3 | Then a high severity "disk" alert is created immediately | Alert created |

#### Assertions

- [x] High severity alert created
- [x] Alert type is "disk"
- [x] No sustained threshold required (immediate)

---

### TC090: Disk critical threshold creates alert immediately

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC2)
**Automated:** Yes (`tests/test_alerting.py::TestDiskAlertImmediate`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server reports disk usage of 96% | Heartbeat received |
| 2 | When the heartbeat is processed | Threshold evaluated |
| 3 | Then a critical severity "disk" alert is created | Alert created |

#### Assertions

- [x] Critical severity alert created
- [x] Alert type is "disk"
- [x] Immediate, no sustained count needed

---

### TC091: CPU single breach does not create alert

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC6)
**Automated:** Yes (`tests/test_alerting.py::TestSustainedThresholds`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server reports CPU at 99% | Single heartbeat |
| 2 | When CPU drops below threshold on next heartbeat | Brief spike |
| 3 | Then no alert is created | Consecutive count resets |

#### Assertions

- [x] No alert created for single breach
- [x] Consecutive count resets on drop

---

### TC092: CPU sustained breach creates alert

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC4, AC5)
**Automated:** Yes (`tests/test_alerting.py::TestSustainedThresholds`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given CPU above threshold for 3 heartbeats | Sustained breach |
| 2 | When third heartbeat is processed | Threshold met |
| 3 | Then alert is created | Sustained alert works |

#### Assertions

- [x] Alert created after 3 consecutive breaches
- [x] Correct severity based on threshold tier

---

### TC093: Memory sustained breach creates alert

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC3)
**Automated:** Yes (`tests/test_alerting.py::TestSustainedThresholds`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given memory above 85% for 3 heartbeats | Sustained breach |
| 2 | When third heartbeat is processed | Threshold met |
| 3 | Then high severity memory alert created | Alert generated |

#### Assertions

- [x] Alert created after sustained breach
- [x] Memory-specific threshold used

---

### TC094: Severity escalation from high to critical

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC8)
**Automated:** Yes (`tests/test_alerting.py::TestSeverityEscalation`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given existing high severity disk alert at 82% | Alert exists |
| 2 | When disk usage increases to 96% | Critical threshold crossed |
| 3 | Then alert is escalated to critical severity | Escalation works |

#### Assertions

- [x] Alert escalates from high to critical
- [x] Same alert updated, not new alert created

---

### TC095: No duplicate alerts for ongoing condition

**Type:** Unit
**Priority:** High
**Story:** US0012 (AC1)
**Automated:** Yes (`tests/test_alerting.py::TestDeduplication`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an open disk alert exists | Alert active |
| 2 | When another disk threshold breach detected | Same condition |
| 3 | Then no new alert is created | Deduplication works |

#### Assertions

- [x] Only one active alert per server per metric type
- [x] No duplicate alerts created

---

### TC096: Auto-resolve when condition clears

**Type:** Unit
**Priority:** High
**Story:** US0012 (AC2, AC3)
**Automated:** Yes (`tests/test_alerting.py::TestAutoResolve`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given open disk alert triggered at 85% | Alert active |
| 2 | When disk usage drops to 75% | Below threshold |
| 3 | Then alert is auto-resolved | auto_resolved=true |

#### Assertions

- [x] Alert status changes to resolved
- [x] auto_resolved flag is true
- [x] resolved_at timestamp set

---

### TC097: New alert after previous resolution

**Type:** Unit
**Priority:** High
**Story:** US0012 (AC4)
**Automated:** Yes (`tests/test_alerting.py::TestDeduplication`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a disk alert was resolved | Previous alert closed |
| 2 | When disk usage exceeds threshold again | New breach |
| 3 | Then a new alert is created | Fresh alert |

#### Assertions

- [x] New alert created after resolution
- [x] Previous alert remains resolved

---

### TC098: Offline alert auto-resolves on heartbeat

**Type:** Unit
**Priority:** High
**Story:** US0012 (AC5)
**Automated:** Yes (`tests/test_alerting.py::TestOfflineAlerts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an offline alert exists for server | Server was offline |
| 2 | When heartbeat is received | Server back online |
| 3 | Then offline alert is auto-resolved | Alert cleared |

#### Assertions

- [x] Offline alert auto-resolves on heartbeat
- [x] auto_resolved flag is true

---

### TC099: No re-notification within cooldown

**Type:** Unit
**Priority:** High
**Story:** US0012 (AC8)
**Automated:** Yes (`tests/test_alerting.py::TestCooldowns`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given critical alert notified 10 minutes ago | Within cooldown |
| 2 | When next heartbeat processed | Condition persists |
| 3 | Then no re-notification sent | Cooldown respected |

#### Assertions

- [x] No re-notification within 30 min cooldown for critical
- [x] No re-notification within 4 hour cooldown for high

---

### TC100: Offline server creates critical alert

**Type:** Unit
**Priority:** High
**Story:** US0011 (AC7)
**Automated:** Yes (`tests/test_alerting.py::TestOfflineAlerts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a server is marked offline | No heartbeat for 180s |
| 2 | When status changes to offline | Offline detected |
| 3 | Then critical severity "offline" alert created | Alert generated |

#### Assertions

- [x] Offline alert created immediately
- [x] Critical severity assigned
- [x] Alert type is "offline"

---

### TC101: List alerts returns all alerts

**Type:** API
**Priority:** High
**Story:** US0014 (AC1)
**Automated:** Yes (`tests/test_alerts_api.py::TestListAlerts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given multiple alerts exist | Database populated |
| 2 | When GET /api/v1/alerts is called | Request made |
| 3 | Then response contains array of alerts | List returned |

#### Assertions

- [x] Returns 200 status
- [x] Response has alerts array
- [x] Response has total count
- [x] Response has pagination info

---

### TC102: Filter alerts by status

**Type:** API
**Priority:** High
**Story:** US0014 (AC2)
**Automated:** Yes (`tests/test_alerts_api.py::TestFilterAlertsByStatus`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given open and resolved alerts exist | Mixed statuses |
| 2 | When GET /api/v1/alerts?status=open | Filtered request |
| 3 | Then only open alerts returned | Filter works |

#### Assertions

- [x] Filter by status=open works
- [x] Filter by status=acknowledged works
- [x] Filter by status=resolved works

---

### TC103: Filter alerts by severity

**Type:** API
**Priority:** High
**Story:** US0014 (AC3)
**Automated:** Yes (`tests/test_alerts_api.py::TestFilterAlertsBySeverity`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given alerts of various severities | Mixed severities |
| 2 | When GET /api/v1/alerts?severity=critical | Filtered request |
| 3 | Then only critical alerts returned | Filter works |

#### Assertions

- [x] Filter by severity=critical works
- [x] Filter by severity=high works

---

### TC104: Acknowledge alert changes status

**Type:** API
**Priority:** High
**Story:** US0014 (AC4)
**Automated:** Yes (`tests/test_alerts_api.py::TestAcknowledgeAlert`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an open alert exists | Alert ID known |
| 2 | When POST /api/v1/alerts/{id}/acknowledge | Action called |
| 3 | Then alert status changes to "acknowledged" | Status updated |

#### Assertions

- [x] Returns 200 status
- [x] Alert status is "acknowledged"
- [x] acknowledged_at timestamp set

---

### TC105: Resolve alert manually

**Type:** API
**Priority:** High
**Story:** US0014 (AC5)
**Automated:** Yes (`tests/test_alerts_api.py::TestResolveAlert`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an acknowledged alert exists | Alert acknowledged |
| 2 | When POST /api/v1/alerts/{id}/resolve | Action called |
| 3 | Then alert status changes to "resolved" | Status updated |

#### Assertions

- [x] Returns 200 status
- [x] Alert status is "resolved"
- [x] resolved_at timestamp set
- [x] auto_resolved is false

---

### TC106: Get alert details

**Type:** API
**Priority:** High
**Story:** US0014 (AC6)
**Automated:** Yes (`tests/test_alerts_api.py::TestGetAlertDetails`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given alert with ID exists | Alert in database |
| 2 | When GET /api/v1/alerts/{id} | Request made |
| 3 | Then full alert details returned | All fields present |

#### Assertions

- [x] Returns 200 status
- [x] Includes all alert fields
- [x] Includes server_name for display

---

### TC107: Alert API requires authentication

**Type:** API
**Priority:** High
**Story:** US0014 (security)
**Automated:** Yes (`tests/test_alerts_api.py::TestAlertAuthentication`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no API key provided | Unauthenticated request |
| 2 | When any alert endpoint called | Request without auth |
| 3 | Then 401 Unauthorized returned | Auth required |

#### Assertions

- [x] List alerts requires auth
- [x] Get alert requires auth
- [x] Acknowledge requires auth
- [x] Resolve requires auth

---

### TC108: Alert pagination works correctly

**Type:** API
**Priority:** Medium
**Story:** US0014 (pagination)
**Automated:** Yes (`tests/test_alerts_api.py::TestPagination`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given more than 50 alerts exist | Many alerts |
| 2 | When GET /api/v1/alerts?limit=10&offset=5 | Paginated request |
| 3 | Then correct subset returned | Pagination works |

#### Assertions

- [x] Default limit is 50
- [x] Default offset is 0
- [x] Custom limit works
- [x] Custom offset works
- [x] Max limit is 100

---

### TC109: Alert record includes threshold values

**Type:** Unit
**Priority:** Medium
**Story:** US0011 (context)
**Automated:** Yes (`tests/test_alerting.py::TestAlertRecordCreation`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given alert is created | Threshold breach |
| 2 | When viewing alert details | Alert queried |
| 3 | Then threshold_value and actual_value present | Context available |

#### Assertions

- [x] threshold_value stored correctly
- [x] actual_value stored correctly

---

### TC110: Dashboard displays recent alerts

**Type:** E2E
**Priority:** High
**Story:** US0015
**Automated:** Yes (`frontend/src/components/AlertBanner.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given open alerts exist | Active alerts |
| 2 | When viewing dashboard | Page loads |
| 3 | Then recent alerts displayed prominently | Banner visible |

#### Assertions

- [x] Alert banner shows on dashboard
- [x] Critical alerts highlighted
- [x] Alert count visible

---

### TC111: Alert card displays correctly

**Type:** Unit (frontend)
**Priority:** High
**Story:** US0015, US0016
**Automated:** Yes (`frontend/src/components/AlertCard.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given alert data | Alert object |
| 2 | When AlertCard rendered | Component mounts |
| 3 | Then severity, title, server displayed | Correct rendering |

#### Assertions

- [x] Severity badge shows correct colour
- [x] Alert title displayed
- [x] Server name displayed
- [x] Timestamp formatted correctly

---

### TC112: Alert detail panel shows full info

**Type:** Unit (frontend)
**Priority:** High
**Story:** US0016
**Automated:** Yes (`frontend/src/components/AlertDetailPanel.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given an alert is selected | Alert clicked |
| 2 | When detail panel opens | Panel rendered |
| 3 | Then full alert details displayed | All fields shown |

#### Assertions

- [x] All alert fields displayed
- [x] Acknowledge button visible for open alerts
- [x] Resolve button visible for acknowledged alerts

---

### TC113: Alerts page lists alerts with filters

**Type:** Unit (frontend)
**Priority:** High
**Story:** US0016
**Automated:** Yes (`frontend/src/pages/AlertsPage.test.tsx`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given multiple alerts exist | API returns alerts |
| 2 | When alerts page loads | Component mounts |
| 3 | Then alerts listed with filter controls | UI functional |

#### Assertions

- [x] Alert list rendered
- [x] Status filter works
- [x] Severity filter works
- [x] Pagination works

---

### TC114: Frontend alert API client works

**Type:** Unit (frontend)
**Priority:** High
**Story:** US0015, US0016
**Automated:** Yes (`frontend/src/api/alerts.test.ts`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API client configured | Client ready |
| 2 | When calling alert methods | HTTP requests made |
| 3 | Then correct endpoints called with params | API integration works |

#### Assertions

- [x] listAlerts calls correct endpoint
- [x] getAlert calls correct endpoint
- [x] acknowledgeAlert calls correct endpoint
- [x] resolveAlert calls correct endpoint

---

## Fixtures

```yaml
# Shared test data for this spec
alerts:
  critical_disk_alert:
    server_id: "omv-mediaserver"
    alert_type: "disk"
    severity: "critical"
    status: "open"
    title: "Critical: Disk usage at 96%"
    threshold_value: 95
    actual_value: 96

  high_memory_alert:
    server_id: "pihole"
    alert_type: "memory"
    severity: "high"
    status: "open"
    title: "High: Memory usage at 87%"
    threshold_value: 85
    actual_value: 87

  resolved_alert:
    server_id: "omv-mediaserver"
    alert_type: "cpu"
    severity: "high"
    status: "resolved"
    title: "High: CPU usage sustained above 90%"
    auto_resolved: true

thresholds:
  defaults:
    cpu:
      high_percent: 85
      critical_percent: 95
      sustained_heartbeats: 3
    memory:
      high_percent: 85
      critical_percent: 95
      sustained_heartbeats: 3
    disk:
      high_percent: 80
      critical_percent: 95
      sustained_heartbeats: 0
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC084 | Alert table exists | Automated | `tests/test_alert_model.py::TestAlertTableExists` |
| TC085 | Alert severity levels | Automated | `tests/test_alert_model.py::TestAlertSeverityLevels` |
| TC086 | Alert status lifecycle | Automated | `tests/test_alert_model.py::TestAlertStatusLifecycle` |
| TC087 | Alert links to server | Automated | `tests/test_alert_model.py::TestAlertServerRelationship` |
| TC088 | Cascade delete | Automated | `tests/test_alert_model.py::TestAlertCascadeDelete` |
| TC089 | Disk high creates alert immediately | Automated | `tests/test_alerting.py::TestDiskAlertImmediate` |
| TC090 | Disk critical creates alert immediately | Automated | `tests/test_alerting.py::TestDiskAlertImmediate` |
| TC091 | CPU single breach no alert | Automated | `tests/test_alerting.py::TestSustainedThresholds` |
| TC092 | CPU sustained creates alert | Automated | `tests/test_alerting.py::TestSustainedThresholds` |
| TC093 | Memory sustained creates alert | Automated | `tests/test_alerting.py::TestSustainedThresholds` |
| TC094 | Severity escalation | Automated | `tests/test_alerting.py::TestSeverityEscalation` |
| TC095 | No duplicate alerts | Automated | `tests/test_alerting.py::TestDeduplication` |
| TC096 | Auto-resolve below threshold | Automated | `tests/test_alerting.py::TestAutoResolve` |
| TC097 | New alert after resolution | Automated | `tests/test_alerting.py::TestDeduplication` |
| TC098 | Offline alert resolves on heartbeat | Automated | `tests/test_alerting.py::TestOfflineAlerts` |
| TC099 | No re-notification within cooldown | Automated | `tests/test_alerting.py::TestCooldowns` |
| TC100 | Offline server creates alert | Automated | `tests/test_alerting.py::TestOfflineAlerts` |
| TC101 | List alerts API | Automated | `tests/test_alerts_api.py::TestListAlerts` |
| TC102 | Filter by status | Automated | `tests/test_alerts_api.py::TestFilterAlertsByStatus` |
| TC103 | Filter by severity | Automated | `tests/test_alerts_api.py::TestFilterAlertsBySeverity` |
| TC104 | Acknowledge alert | Automated | `tests/test_alerts_api.py::TestAcknowledgeAlert` |
| TC105 | Resolve alert | Automated | `tests/test_alerts_api.py::TestResolveAlert` |
| TC106 | Get alert details | Automated | `tests/test_alerts_api.py::TestGetAlertDetails` |
| TC107 | Alert API authentication | Automated | `tests/test_alerts_api.py::TestAlertAuthentication` |
| TC108 | Pagination | Automated | `tests/test_alerts_api.py::TestPagination` |
| TC109 | Alert record threshold values | Automated | `tests/test_alerting.py::TestAlertRecordCreation` |
| TC110 | Dashboard alert display | Automated | `frontend/src/components/AlertBanner.test.tsx` |
| TC111 | Alert card display | Automated | `frontend/src/components/AlertCard.test.tsx` |
| TC112 | Alert detail panel | Automated | `frontend/src/components/AlertDetailPanel.test.tsx` |
| TC113 | Alerts page with filters | Automated | `frontend/src/pages/AlertsPage.test.tsx` |
| TC114 | Frontend API client | Automated | `frontend/src/api/alerts.test.ts` |

**Summary:**
- **Total Test Cases:** 31
- **Automated:** 31/31 (100%)
- **Backend Tests:** 89 pytest tests across 3 files
- **Frontend Tests:** 66 Vitest tests across 5 files

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0002](../../epics/EP0002-alerting.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## AC Mapping

| Story | AC | Test Cases |
|-------|-------|------------|
| US0010 | AC1-AC5 | TC084, TC085, TC086, TC087, TC088 |
| US0011 | AC1-AC8 | TC089, TC090, TC091, TC092, TC093, TC094, TC100, TC109 |
| US0012 | AC1-AC10 | TC095, TC096, TC097, TC098, TC099 |
| US0014 | AC1-AC6 | TC101, TC102, TC103, TC104, TC105, TC106, TC107, TC108 |
| US0015 | Dashboard | TC110, TC111 |
| US0016 | List/Detail | TC111, TC112, TC113, TC114 |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial spec generation from existing tests |
| 2026-01-19 | Claude | All 31 test cases verified automated (89 backend + 66 frontend tests) |
