# TS0015: Scan Results Display Tests

> **Status:** Draft
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Last Updated:** 2026-01-21

## Overview

Test specification for the Scan Results Display feature (US0039). Covers rendering of scan results, progress bars for resource usage, process list sorting, and navigation persistence. Tests are primarily frontend-focused using React Testing Library and Vitest.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0039](../stories/US0039-scan-results-display.md) | Scan Results Display | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0039 | AC1 | Quick scan results displayed (OS, hostname, uptime, disk, memory) | TC301, TC302, TC303 | Covered |
| US0039 | AC2 | Full scan results displayed (packages, processes, network) | TC304, TC305, TC306, TC307 | Covered |
| US0039 | AC3 | Disk usage visualised with progress bars | TC308, TC309, TC310 | Covered |
| US0039 | AC4 | Process list sortable by memory or CPU | TC311, TC312 | Covered |
| US0039 | AC5 | Results persist after navigation | TC313, TC314 | Covered |

**Coverage Summary:**
- Total ACs: 5
- Covered: 5
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Component rendering and logic |
| Integration | Yes | API client integration |
| API | No | Uses existing backend API from US0038 |
| E2E | Yes | Full user flow validation |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, Vitest, React Testing Library |
| External Services | Backend API (mocked for unit tests) |
| Test Data | Mock ScanStatusResponse objects |

---

## Test Cases

### TC301: Quick Scan - System Info Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a completed quick scan with OS, hostname, uptime | Scan data loaded |
| 2 | When the ScanResultsPage component renders | Component mounts successfully |
| 3 | Then OS name, hostname, and uptime are displayed | All system info visible |

#### Test Data

```yaml
input:
  scan:
    scan_id: 1
    status: "completed"
    scan_type: "quick"
    results:
      os:
        name: "Ubuntu"
        version: "22.04"
        kernel: "5.15.0-91-generic"
        pretty_name: "Ubuntu 22.04.3 LTS"
      hostname: "testserver"
      uptime_seconds: 345600  # 4 days
expected:
  rendered_text:
    - "Ubuntu 22.04.3 LTS"
    - "testserver"
    - "4d 0h"
```

#### Assertions

- [ ] OS pretty_name is displayed
- [ ] Hostname is displayed
- [ ] Uptime is formatted correctly
- [ ] System info card is visible

---

### TC302: Quick Scan - Disk Usage Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a completed quick scan with disk data | Scan data loaded |
| 2 | When the ScanResultsPage component renders | Component mounts successfully |
| 3 | Then disk usage for each mount is displayed | All mounts shown with usage |

#### Test Data

```yaml
input:
  scan:
    status: "completed"
    scan_type: "quick"
    results:
      disk:
        - mount: "/"
          total_gb: 500
          used_gb: 120
          percent: 24
        - mount: "/home"
          total_gb: 500
          used_gb: 180
          percent: 36
expected:
  rendered_text:
    - "/"
    - "120 / 500 GB"
    - "24%"
    - "/home"
    - "180 / 500 GB"
    - "36%"
```

#### Assertions

- [ ] All mount points are listed
- [ ] Total and used space are formatted
- [ ] Percentage is displayed

---

### TC303: Quick Scan - Memory Usage Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a completed quick scan with memory data | Scan data loaded |
| 2 | When the ScanResultsPage component renders | Component mounts successfully |
| 3 | Then memory usage is displayed with progress bar | Memory section visible |

#### Test Data

```yaml
input:
  scan:
    status: "completed"
    results:
      memory:
        total_mb: 16384
        used_mb: 8192
        percent: 50
expected:
  rendered_text:
    - "8 / 16 GB"
    - "50%"
```

#### Assertions

- [ ] Memory usage is displayed
- [ ] Values are formatted (MB to GB conversion)
- [ ] Percentage is shown

---

### TC304: Full Scan - Packages Section Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a completed full scan with package data | Scan data loaded |
| 2 | When the ScanResultsPage component renders | Component mounts successfully |
| 3 | Then packages section is displayed with count | Packages section visible |

#### Test Data

```yaml
input:
  scan:
    status: "completed"
    scan_type: "full"
    results:
      packages:
        count: 1234
        recent:
          - "python3"
          - "nodejs"
          - "docker-ce"
expected:
  rendered_text:
    - "Installed Packages (1,234)"
    - "python3"
    - "nodejs"
```

#### Assertions

- [ ] Package count is displayed
- [ ] Recent packages are listed
- [ ] Section is collapsible

---

### TC305: Full Scan - Process List Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a completed full scan with process data | Scan data loaded |
| 2 | When the ScanResultsPage component renders | Component mounts successfully |
| 3 | Then process list is displayed with columns | Process table visible |

#### Test Data

```yaml
input:
  scan:
    status: "completed"
    scan_type: "full"
    results:
      processes:
        - user: "root"
          pid: 12345
          cpu_percent: 5.2
          mem_percent: 15.6
          command: "chrome"
        - user: "user"
          pid: 23456
          cpu_percent: 3.1
          mem_percent: 11.2
          command: "code"
expected:
  columns: ["PID", "Name", "Memory", "CPU"]
  rows: 2
```

#### Assertions

- [ ] Process table has correct columns
- [ ] All processes are displayed
- [ ] CPU and memory percentages are formatted

---

### TC306: Full Scan - Network Interfaces Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a completed full scan with network data | Scan data loaded |
| 2 | When the ScanResultsPage component renders | Component mounts successfully |
| 3 | Then network interfaces are displayed | Network section visible |

#### Test Data

```yaml
input:
  scan:
    status: "completed"
    scan_type: "full"
    results:
      network_interfaces:
        - name: "eth0"
          state: "up"
          addresses:
            - type: "ipv4"
              address: "192.168.1.100/24"
        - name: "lo"
          state: "up"
          addresses:
            - type: "ipv4"
              address: "127.0.0.1/8"
expected:
  rendered_text:
    - "eth0"
    - "192.168.1.100/24"
    - "lo"
```

#### Assertions

- [ ] All interfaces are listed
- [ ] Interface state is shown
- [ ] IP addresses are displayed

---

### TC307: Full Scan - Sections Are Collapsible

**Type:** Unit
**Priority:** Medium
**Story:** US0039/AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a full scan results page | Page rendered |
| 2 | When clicking on a section header | Section toggles visibility |
| 3 | Then content is shown/hidden | Collapse state changes |

#### Test Data

```yaml
input:
  sections:
    - "Running Processes"
    - "Network Interfaces"
    - "Installed Packages"
expected:
  default_collapsed: true
  after_click: expanded
```

#### Assertions

- [ ] Sections start collapsed
- [ ] Click expands section
- [ ] Click again collapses section

---

### TC308: Usage Bar - Green Below 80%

**Type:** Unit
**Priority:** High
**Story:** US0039/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given disk usage at 60% | UsageBar receives value=60 |
| 2 | When UsageBar renders | Component mounts |
| 3 | Then progress bar is green | Green colour applied |

#### Test Data

```yaml
input:
  percent: 60
expected:
  colour: "#4ADE80"  # Success green
```

#### Assertions

- [ ] Progress bar has green colour class
- [ ] Width is 60% of container
- [ ] aria-valuenow is 60

---

### TC309: Usage Bar - Amber Between 80-90%

**Type:** Unit
**Priority:** High
**Story:** US0039/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given disk usage at 85% | UsageBar receives value=85 |
| 2 | When UsageBar renders | Component mounts |
| 3 | Then progress bar is amber | Amber colour applied |

#### Test Data

```yaml
input:
  percent: 85
expected:
  colour: "#FBBF24"  # Warning amber
```

#### Assertions

- [ ] Progress bar has amber colour class
- [ ] Width is 85% of container

---

### TC310: Usage Bar - Red Above 90%

**Type:** Unit
**Priority:** High
**Story:** US0039/AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given disk usage at 95% | UsageBar receives value=95 |
| 2 | When UsageBar renders | Component mounts |
| 3 | Then progress bar is red | Red colour applied |

#### Test Data

```yaml
input:
  percent: 95
expected:
  colour: "#F87171"  # Error red
```

#### Assertions

- [ ] Progress bar has red colour class
- [ ] Width is 95% of container

---

### TC311: Process List - Sort By Memory

**Type:** Unit
**Priority:** High
**Story:** US0039/AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given process list with multiple processes | Processes loaded |
| 2 | When sorting by memory (default) | Sort applied |
| 3 | Then processes ordered by mem_percent descending | Highest memory first |

#### Test Data

```yaml
input:
  processes:
    - pid: 1
      mem_percent: 10.0
      command: "low"
    - pid: 2
      mem_percent: 50.0
      command: "high"
    - pid: 3
      mem_percent: 30.0
      command: "mid"
expected:
  order: ["high", "mid", "low"]
```

#### Assertions

- [ ] Processes sorted by memory descending
- [ ] Memory column header indicates active sort
- [ ] Sort icon shows direction

---

### TC312: Process List - Sort By CPU

**Type:** Unit
**Priority:** High
**Story:** US0039/AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given process list sorted by memory | Memory sort active |
| 2 | When clicking CPU column header | Sort changes |
| 3 | Then processes ordered by cpu_percent descending | Highest CPU first |

#### Test Data

```yaml
input:
  processes:
    - pid: 1
      cpu_percent: 50.0
      command: "high_cpu"
    - pid: 2
      cpu_percent: 10.0
      command: "low_cpu"
expected:
  order: ["high_cpu", "low_cpu"]
```

#### Assertions

- [ ] Click on CPU header changes sort
- [ ] Processes reordered by CPU
- [ ] CPU column header shows sort indicator

---

### TC313: Navigation - Results Persist Via URL

**Type:** Integration
**Priority:** High
**Story:** US0039/AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given scan results displayed at /scans/123 | Page loaded |
| 2 | When navigating away and returning to /scans/123 | Re-navigation occurs |
| 3 | Then scan results are fetched and displayed | Same data shown |

#### Test Data

```yaml
input:
  scan_id: 123
  route: "/scans/123"
expected:
  api_call: "GET /api/v1/scans/123"
```

#### Assertions

- [ ] Scan ID extracted from URL params
- [ ] API called with correct scan ID
- [ ] Results displayed after navigation

---

### TC314: Navigation - Invalid Scan ID Shows Error

**Type:** Integration
**Priority:** Medium
**Story:** US0039/AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given navigation to /scans/999 (non-existent) | Route accessed |
| 2 | When API returns 404 | Error response received |
| 3 | Then error message displayed | "Scan not found" shown |

#### Test Data

```yaml
input:
  scan_id: 999
  api_response:
    status: 404
    body: { "detail": "Scan 999 not found" }
expected:
  error_message: "Scan not found"
```

#### Assertions

- [ ] 404 response handled gracefully
- [ ] Error message displayed
- [ ] No results section shown

---

### TC315: Failed Scan - Error Message Displayed

**Type:** Unit
**Priority:** High
**Story:** US0039/Edge
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a scan with status "failed" | Failed scan loaded |
| 2 | When ScanResultsPage renders | Component mounts |
| 3 | Then error message is displayed | Error banner visible |

#### Test Data

```yaml
input:
  scan:
    status: "failed"
    error: "SSH connection refused"
    results: null
expected:
  error_displayed: "SSH connection refused"
  results_hidden: true
```

#### Assertions

- [ ] Error banner is visible
- [ ] Error message from API shown
- [ ] No results section rendered

---

### TC316: Partial Results - Warning Displayed

**Type:** Unit
**Priority:** Medium
**Story:** US0039/Edge
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given scan results with errors array | Partial results loaded |
| 2 | When ScanResultsPage renders | Component mounts |
| 3 | Then warning message displayed | Warning banner visible |

#### Test Data

```yaml
input:
  scan:
    status: "completed"
    results:
      os:
        name: "Ubuntu"
      errors: ["Failed to collect package list"]
expected:
  warning_displayed: "Some data unavailable"
```

#### Assertions

- [ ] Warning banner is visible
- [ ] Available data still displayed
- [ ] Error details accessible

---

### TC317: Long Process List - Limited to 50

**Type:** Unit
**Priority:** Medium
**Story:** US0039/Edge
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 100 processes in scan results | Large process list |
| 2 | When ScanProcessList renders | Component mounts |
| 3 | Then only top 50 displayed | List limited |

#### Test Data

```yaml
input:
  processes: 100 items
expected:
  displayed: 50
  label: "Showing top 50"
```

#### Assertions

- [ ] Only 50 rows in table
- [ ] "Showing top 50" message visible
- [ ] Processes are sorted before limiting

---

### TC318: No Packages - Message Displayed

**Type:** Unit
**Priority:** Low
**Story:** US0039/Edge
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given packages is null in results | No package data |
| 2 | When ScanPackageList renders | Component mounts |
| 3 | Then "not available" message shown | Fallback message visible |

#### Test Data

```yaml
input:
  scan:
    scan_type: "full"
    results:
      packages: null
expected:
  message: "Package list not available"
```

#### Assertions

- [ ] No package list rendered
- [ ] "Not available" message shown

---

### TC319: Loading State - Spinner Displayed

**Type:** Unit
**Priority:** Medium
**Story:** US0039
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given API call in progress | Loading state |
| 2 | When ScanResultsPage renders | Component mounts |
| 3 | Then loading spinner displayed | Spinner visible |

#### Test Data

```yaml
input:
  loading: true
expected:
  spinner_visible: true
  content_hidden: true
```

#### Assertions

- [ ] Loading spinner is visible
- [ ] Content is not rendered
- [ ] aria-busy="true" set

---

### TC320: Pending Scan - Progress Displayed

**Type:** Unit
**Priority:** Medium
**Story:** US0039
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given scan with status "running" | Running scan |
| 2 | When ScanResultsPage renders | Component mounts |
| 3 | Then progress bar and current_step shown | Progress visible |

#### Test Data

```yaml
input:
  scan:
    status: "running"
    progress: 45
    current_step: "Collecting disk info"
expected:
  progress_bar: 45%
  step_text: "Collecting disk info"
```

#### Assertions

- [ ] Progress bar shows correct percentage
- [ ] Current step description visible
- [ ] Polling continues for updates

---

## Fixtures

```yaml
# Shared test data for this spec
completed_quick_scan:
  scan_id: 1
  status: "completed"
  hostname: "192.168.1.100"
  scan_type: "quick"
  progress: 100
  started_at: "2026-01-21T10:00:00Z"
  completed_at: "2026-01-21T10:00:15Z"
  results:
    os:
      name: "Ubuntu"
      version: "22.04"
      kernel: "5.15.0-91-generic"
      pretty_name: "Ubuntu 22.04.3 LTS"
      id: "ubuntu"
    hostname: "testserver"
    uptime_seconds: 345600
    disk:
      - mount: "/"
        total_gb: 500
        used_gb: 120
        percent: 24
      - mount: "/home"
        total_gb: 500
        used_gb: 180
        percent: 36
    memory:
      total_mb: 16384
      used_mb: 8192
      percent: 50

completed_full_scan:
  scan_id: 2
  status: "completed"
  hostname: "192.168.1.100"
  scan_type: "full"
  progress: 100
  started_at: "2026-01-21T10:00:00Z"
  completed_at: "2026-01-21T10:00:45Z"
  results:
    os:
      name: "Ubuntu"
      version: "22.04"
      kernel: "5.15.0-91-generic"
      pretty_name: "Ubuntu 22.04.3 LTS"
      id: "ubuntu"
    hostname: "testserver"
    uptime_seconds: 345600
    disk:
      - mount: "/"
        total_gb: 500
        used_gb: 120
        percent: 24
    memory:
      total_mb: 16384
      used_mb: 8192
      percent: 50
    packages:
      count: 1234
      recent:
        - "python3"
        - "nodejs"
        - "docker-ce"
    processes:
      - user: "root"
        pid: 12345
        cpu_percent: 5.2
        mem_percent: 15.6
        command: "chrome"
      - user: "user"
        pid: 23456
        cpu_percent: 3.1
        mem_percent: 11.2
        command: "code"
    network_interfaces:
      - name: "eth0"
        state: "up"
        addresses:
          - type: "ipv4"
            address: "192.168.1.100/24"
      - name: "lo"
        state: "up"
        addresses:
          - type: "ipv4"
            address: "127.0.0.1/8"

failed_scan:
  scan_id: 3
  status: "failed"
  hostname: "192.168.1.200"
  scan_type: "quick"
  progress: 10
  error: "SSH connection refused"
  results: null

running_scan:
  scan_id: 4
  status: "running"
  hostname: "192.168.1.100"
  scan_type: "full"
  progress: 45
  current_step: "Collecting disk info"
  results: null
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC301 | Quick Scan - System Info Displayed | Pending | - |
| TC302 | Quick Scan - Disk Usage Displayed | Pending | - |
| TC303 | Quick Scan - Memory Usage Displayed | Pending | - |
| TC304 | Full Scan - Packages Section Displayed | Pending | - |
| TC305 | Full Scan - Process List Displayed | Pending | - |
| TC306 | Full Scan - Network Interfaces Displayed | Pending | - |
| TC307 | Full Scan - Sections Are Collapsible | Pending | - |
| TC308 | Usage Bar - Green Below 80% | Pending | - |
| TC309 | Usage Bar - Amber Between 80-90% | Pending | - |
| TC310 | Usage Bar - Red Above 90% | Pending | - |
| TC311 | Process List - Sort By Memory | Pending | - |
| TC312 | Process List - Sort By CPU | Pending | - |
| TC313 | Navigation - Results Persist Via URL | Pending | - |
| TC314 | Navigation - Invalid Scan ID Shows Error | Pending | - |
| TC315 | Failed Scan - Error Message Displayed | Pending | - |
| TC316 | Partial Results - Warning Displayed | Pending | - |
| TC317 | Long Process List - Limited to 50 | Pending | - |
| TC318 | No Packages - Message Displayed | Pending | - |
| TC319 | Loading State - Spinner Displayed | Pending | - |
| TC320 | Pending Scan - Progress Displayed | Pending | - |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0006](../epics/EP0006-adhoc-scanning.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0046](../plans/PL0046-scan-results-display.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial spec generation |
