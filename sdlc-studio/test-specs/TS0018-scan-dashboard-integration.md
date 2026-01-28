# TS0018: Scan Dashboard Integration

> **Status:** Draft
> **Epic:** [EP0006: Ad-hoc Scanning](../../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Last Updated:** 2026-01-21

## Overview

Test specification for US0042: Scan Dashboard Integration. Covers the navigation link in Dashboard header, RecentScans component, and integration with existing scan functionality.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0042](../../stories/US0042-scan-dashboard-integration.md) | Scan Dashboard Integration | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0042 | AC1 | Scans menu item visible in navigation | TC0018-01 | Covered |
| US0042 | AC2 | Manual scan form displayed on page load | TC0018-02 | Covered |
| US0042 | AC3 | Quick and Full scan buttons available | TC0018-03, TC0018-04 | Covered |
| US0042 | AC4 | Recent scans (last 5) displayed | TC0018-05, TC0018-06 | Covered |
| US0042 | AC5 | View All link navigates to history | TC0018-07 | Covered |

**Coverage Summary:**
- Total ACs: 5
- Covered: 5
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test RecentScans component in isolation |
| Integration | No | Component integration covered by E2E |
| API | No | API already tested in TS0014, TS0016 |
| E2E | Yes | Verify navigation flow and user interactions |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Frontend dev server, mocked API |
| External Services | None - all mocked |
| Test Data | Mock scan list responses |

---

## Test Cases

### TC0018-01: Navigation Link Present in Dashboard

**Type:** E2E
**Priority:** High
**Story:** US0042/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the Dashboard is loaded | Dashboard page renders |
| 2 | When viewing the header | Navigation elements visible |
| 3 | Then a "Scans" link is present | Link with href="/scans" exists |

#### Test Data

```yaml
input:
  route: /
expected:
  link_present: true
  link_href: /scans
```

#### Assertions

- [ ] Dashboard header contains a link with data-testid="scans-link"
- [ ] Link navigates to /scans when clicked
- [ ] Link has appropriate visual styling (icon, hover state)

---

### TC0018-02: Manual Scan Form Displayed

**Type:** Unit
**Priority:** High
**Story:** US0042/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ScansPage component renders | Page loads successfully |
| 2 | When the page is displayed | Form elements present |
| 3 | Then hostname input field is visible | Input with data-testid="hostname-input" exists |

#### Test Data

```yaml
input:
  route: /scans
expected:
  input_present: true
  input_placeholder: "Hostname or IP address..."
```

#### Assertions

- [ ] Hostname input field is rendered
- [ ] Input accepts text entry
- [ ] Input placeholder text is descriptive

---

### TC0018-03: Quick Scan Button Available

**Type:** Unit
**Priority:** High
**Story:** US0042/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ScansPage component renders | Page loads |
| 2 | When hostname is entered | Button state updates |
| 3 | Then Quick Scan button is enabled | Button clickable |

#### Test Data

```yaml
input:
  hostname: "192.168.1.100"
expected:
  quick_scan_enabled: true
```

#### Assertions

- [ ] Quick Scan button exists with data-testid="quick-scan-button"
- [ ] Button disabled when hostname empty
- [ ] Button enabled when hostname entered
- [ ] Click triggers scan API call

---

### TC0018-04: Full Scan Button Available

**Type:** Unit
**Priority:** High
**Story:** US0042/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ScansPage component renders | Page loads |
| 2 | When hostname is entered | Button state updates |
| 3 | Then Full Scan button is enabled | Button clickable |

#### Test Data

```yaml
input:
  hostname: "192.168.1.100"
expected:
  full_scan_enabled: true
```

#### Assertions

- [ ] Full Scan button exists with data-testid="full-scan-button"
- [ ] Button disabled when hostname empty
- [ ] Button enabled when hostname entered
- [ ] Click triggers scan API call with scan_type="full"

---

### TC0018-05: Recent Scans Widget Shows Last 5

**Type:** Unit
**Priority:** High
**Story:** US0042/AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API returns 10 recent scans | Mock data configured |
| 2 | When ScansPage renders | Component fetches data |
| 3 | Then only 5 most recent scans displayed | List shows 5 items |

#### Test Data

```yaml
input:
  api_response:
    scans:
      - scan_id: 1
        hostname: "server1"
        scan_type: "quick"
        status: "completed"
        started_at: "2026-01-21T10:00:00Z"
      - scan_id: 2
        hostname: "server2"
        scan_type: "full"
        status: "completed"
        started_at: "2026-01-21T09:00:00Z"
      # ... 3 more
    total: 10
expected:
  displayed_count: 5
```

#### Assertions

- [ ] RecentScans component renders
- [ ] API called with limit=5
- [ ] Exactly 5 scans displayed (or fewer if less exist)
- [ ] Each scan shows hostname, type, relative time, status

---

### TC0018-06: Recent Scans Empty State

**Type:** Unit
**Priority:** Medium
**Story:** US0042/AC4 (edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API returns empty scan list | Mock data configured |
| 2 | When ScansPage renders | Component fetches data |
| 3 | Then "No scans yet" message displayed | Empty state shown |

#### Test Data

```yaml
input:
  api_response:
    scans: []
    total: 0
expected:
  empty_message: "No scans yet"
```

#### Assertions

- [ ] RecentScans component renders empty state
- [ ] Message indicates no scans available
- [ ] No error shown

---

### TC0018-07: View All Link Navigates to History

**Type:** E2E
**Priority:** High
**Story:** US0042/AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ScansPage is displayed | Page loads |
| 2 | When clicking "View All" or history link | Navigation triggered |
| 3 | Then user navigates to /scans/history | History page shown |

#### Test Data

```yaml
input:
  route: /scans
  action: click_view_all
expected:
  navigated_to: /scans/history
```

#### Assertions

- [ ] Link/button with "View All" text exists
- [ ] Clicking navigates to /scans/history
- [ ] No page refresh (client-side routing)

---

## Fixtures

```yaml
# Shared test data for this spec
mock_scan_list:
  scans:
    - scan_id: 1
      hostname: "192.168.1.100"
      scan_type: "quick"
      status: "completed"
      started_at: "2026-01-21T10:00:00Z"
      completed_at: "2026-01-21T10:01:00Z"
      error: null
    - scan_id: 2
      hostname: "dazzbook"
      scan_type: "full"
      status: "completed"
      started_at: "2026-01-21T09:00:00Z"
      completed_at: "2026-01-21T09:05:00Z"
      error: null
    - scan_id: 3
      hostname: "192.168.1.105"
      scan_type: "quick"
      status: "failed"
      started_at: "2026-01-21T08:00:00Z"
      completed_at: "2026-01-21T08:00:30Z"
      error: "Connection refused"
    - scan_id: 4
      hostname: "nas-server"
      scan_type: "full"
      status: "completed"
      started_at: "2026-01-21T07:00:00Z"
      completed_at: "2026-01-21T07:10:00Z"
      error: null
    - scan_id: 5
      hostname: "pve-node1"
      scan_type: "quick"
      status: "completed"
      started_at: "2026-01-21T06:00:00Z"
      completed_at: "2026-01-21T06:01:00Z"
      error: null
  total: 5
  limit: 5
  offset: 0
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC0018-01 | Navigation Link Present in Dashboard | Pending | - |
| TC0018-02 | Manual Scan Form Displayed | Pending | - |
| TC0018-03 | Quick Scan Button Available | Pending | - |
| TC0018-04 | Full Scan Button Available | Pending | - |
| TC0018-05 | Recent Scans Widget Shows Last 5 | Pending | - |
| TC0018-06 | Recent Scans Empty State | Pending | - |
| TC0018-07 | View All Link Navigates to History | Pending | - |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| Epic | [EP0006](../../epics/EP0006-adhoc-scanning.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0049](../../plans/PL0049-scan-dashboard-integration.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial spec generation |
