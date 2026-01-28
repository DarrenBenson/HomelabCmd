# TS0006: Server Detail View and Historical Charts Tests

> **Status:** Complete
> **Epic:** [EP0001: Core Monitoring](../../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Last Updated:** 2026-01-19

## Overview

Test specification for the Server Detail View page and Historical Metrics Charts. Covers server information display, metric gauges, OS information panels, historical time-series charts with time range selection, and package update display.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0006](../../stories/US0006-server-detail-view.md) | Server Detail View | High |
| [US0007](../../stories/US0007-historical-metrics-charts.md) | Historical Metrics and Charts | High |
| [US0044](../../stories/US0044-package-update-display.md) | Package Update Display (frontend) | Medium |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Component rendering, formatting functions, gauge calculations |
| Integration | Yes | API data fetching, chart rendering |
| API | Yes | Metrics history endpoint |
| E2E | Yes | Full page flow, chart interactions, navigation |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, npm, Vitest, React Testing Library, Playwright |
| External Services | Mock API server |
| Test Data | Server fixtures, metrics time-series data |

---

## Test Cases

### TC063: Detail view displays server info (AC1)

**Type:** Unit
**Priority:** High
**Story:** US0006 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given navigating to /servers/omv-mediaserver | Route matched |
| 2 | When the page loads with API data | Data fetched |
| 3 | Then server name, hostname, IP, and status displayed | Info visible |

#### Test Data

```yaml
input:
  server_id: "omv-mediaserver"
  api_response:
    display_name: "Media Server"
    hostname: "omv-mediaserver"
    ip_address: "192.168.1.10"
    status: "online"
expected:
  displayed_name: "Media Server"
  displayed_hostname: "omv-mediaserver"
  displayed_ip: "192.168.1.10"
  status_indicator: "online"
```

#### Assertions

- [ ] Display name shown in header
- [ ] Hostname displayed in info panel
- [ ] IP address displayed
- [ ] Status LED matches status

---

### TC064: Detail view shows OS information (AC2)

**Type:** Unit
**Priority:** High
**Story:** US0006 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server has OS info from heartbeat | os_info populated |
| 2 | When viewing server detail | Page rendered |
| 3 | Then OS, kernel, and architecture displayed | System info visible |

#### Test Data

```yaml
input:
  os_info:
    distribution: "Debian GNU/Linux"
    version: "12 (bookworm)"
    kernel: "6.1.0-18-amd64"
    architecture: "x86_64"
expected:
  os_text: "Debian GNU/Linux 12"
  kernel_text: "6.1.0-18-amd64"
  arch_text: "x86_64"
```

#### Assertions

- [ ] OS distribution and version combined
- [ ] Kernel version displayed
- [ ] Architecture displayed

---

### TC065: Detail view shows current metrics (AC3)

**Type:** Unit
**Priority:** High
**Story:** US0006 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server has recent metrics | latest_metrics populated |
| 2 | When viewing server detail | Metrics section rendered |
| 3 | Then all metrics displayed | CPU, RAM, Disk, Network, Load, Uptime |

#### Test Data

```yaml
input:
  latest_metrics:
    cpu_percent: 23.5
    memory_percent: 67.2
    memory_total_mb: 16384
    memory_used_mb: 11010
    disk_percent: 45.0
    disk_total_gb: 2000.0
    disk_used_gb: 900.0
    load_1m: 0.45
    load_5m: 0.52
    load_15m: 0.48
    uptime_seconds: 1234567
expected:
  cpu_displayed: "23.5%"
  memory_displayed: "67.2%"
  memory_absolute: "11/16 GB"
```

#### Assertions

- [ ] CPU percentage displayed
- [ ] Memory with percentage and absolute
- [ ] Disk with percentage and absolute
- [ ] Load averages with 2 decimal places
- [ ] Uptime in human format

---

### TC066: Gauge displays correct percentage

**Type:** Unit
**Priority:** High
**Story:** US0006 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given metric value is 67.2% | Percentage data |
| 2 | When gauge renders | SVG arc drawn |
| 3 | Then gauge shows 67% (rounded) | Visual correct |

#### Test Data

```yaml
input:
  percentage: 67.2
expected:
  displayed_percentage: "67%"
  arc_percentage: 67.2
```

#### Assertions

- [ ] Percentage text displays rounded value
- [ ] Arc fill matches percentage
- [ ] Centre text uses JetBrains Mono

---

### TC067: Gauge colour changes at thresholds

**Type:** Unit
**Priority:** High
**Story:** US0006 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given percentages 50%, 75%, 90% | Different ranges |
| 2 | When gauges render | Colours assigned |
| 3 | Then colours match threshold ranges | Green/Amber/Red |

#### Test Data

```yaml
test_cases:
  - percent: 50
    expected_colour: "#4ADE80"  # Phosphor Green
  - percent: 75
    expected_colour: "#FBBF24"  # Amber Alert
  - percent: 90
    expected_colour: "#F87171"  # Red Alert
```

#### Assertions

- [ ] 0-70%: Phosphor Green
- [ ] 70-85%: Amber Alert
- [ ] 85-100%: Red Alert

---

### TC068: Uptime formatted correctly

**Type:** Unit
**Priority:** Medium
**Story:** US0006 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given uptime_seconds values | Various durations |
| 2 | When formatting function called | Human readable |
| 3 | Then format matches expected | "Xd Yh Zm" |

#### Test Data

```yaml
test_cases:
  - seconds: 3600
    expected: "1h 0m"
  - seconds: 86400
    expected: "1d 0h"
  - seconds: 1234567
    expected: "14d 6h 56m"
  - seconds: 31536000
    expected: "1y 0d"
```

#### Assertions

- [ ] Hours only when < 1 day
- [ ] Days and hours when >= 1 day
- [ ] Years displayed when >= 365 days

---

### TC069: Network bytes formatted correctly

**Type:** Unit
**Priority:** Medium
**Story:** US0006 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given network_rx_bytes values | Various sizes |
| 2 | When formatting function called | Human readable |
| 3 | Then appropriate unit used | KB/MB/GB |

#### Test Data

```yaml
test_cases:
  - bytes: 1024
    expected: "1.00 KB"
  - bytes: 1073741824
    expected: "1.00 GB"
  - bytes: 536870912
    expected: "512.00 MB"
```

#### Assertions

- [ ] KB for < 1 MB
- [ ] MB for < 1 GB
- [ ] GB for >= 1 GB
- [ ] 2 decimal places

---

### TC070: Back button returns to dashboard (AC5)

**Type:** E2E
**Priority:** Medium
**Story:** US0006 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given user is on server detail view | Page loaded |
| 2 | When clicking back button | Navigation triggered |
| 3 | Then user returns to dashboard | Route changes |

#### Test Data

```yaml
input:
  start_route: "/servers/omv-mediaserver"
  click_target: "[data-testid='back-button']"
expected:
  final_route: "/"
```

#### Assertions

- [ ] Back button visible
- [ ] Click navigates to /
- [ ] Dashboard loads

---

### TC071: Refresh button updates metrics

**Type:** Integration
**Priority:** Medium
**Story:** US0006
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given detail view loaded | Initial data |
| 2 | When clicking refresh button | API called again |
| 3 | Then metrics update with new data | Display refreshed |

#### Test Data

```yaml
input:
  initial_cpu: 45.5
  updated_cpu: 52.3
expected:
  api_calls: 2
  displayed_cpu: "52%"
```

#### Assertions

- [ ] Refresh button triggers API call
- [ ] Loading state shown briefly
- [ ] New values displayed

---

### TC072: 404 displayed for nonexistent server

**Type:** E2E
**Priority:** High
**Story:** US0006 (edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server "nonexistent" does not exist | 404 from API |
| 2 | When navigating to /servers/nonexistent | Page loads |
| 3 | Then 404 error page displayed | "Server not found" |

#### Test Data

```yaml
input:
  route: "/servers/nonexistent"
  api_response:
    status: 404
expected:
  error_message: "Server not found"
```

#### Assertions

- [ ] 404 error state displayed
- [ ] "Server not found" message visible
- [ ] Link back to dashboard provided

---

### TC073: Historical charts display on detail page (AC1)

**Type:** Unit
**Priority:** High
**Story:** US0007 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given navigating to server detail | Page loads |
| 2 | When historical metrics section renders | Charts visible |
| 3 | Then CPU, RAM, Disk charts displayed | 3 charts present |

#### Test Data

```yaml
expected:
  chart_count: 3
  chart_types:
    - "CPU Usage"
    - "RAM Usage"
    - "Disk Usage"
```

#### Assertions

- [ ] CPU chart rendered
- [ ] RAM chart rendered
- [ ] Disk chart rendered
- [ ] Recharts components used

---

### TC074: Time range selection changes data (AC2)

**Type:** Integration
**Priority:** High
**Story:** US0007 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given charts displaying 24h data | Default range |
| 2 | When selecting "7d" time range | Button clicked |
| 3 | Then charts update with 7 days of data | API called with range=7d |

#### Test Data

```yaml
input:
  initial_range: "24h"
  new_range: "7d"
expected:
  api_call: "/api/v1/metrics/omv-mediaserver?range=7d"
  data_points: 168  # 7 days * 24 hours
```

#### Assertions

- [ ] Time range buttons visible (24h, 7d, 30d)
- [ ] Click updates active button
- [ ] API called with new range
- [ ] Charts re-render with new data

---

### TC075: Charts render 30 days of data (AC3)

**Type:** Integration
**Priority:** High
**Story:** US0007 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 30 days of metrics exist | Historical data |
| 2 | When selecting "30d" range | Range selected |
| 3 | Then charts render with aggregated data | Performance OK |

#### Test Data

```yaml
input:
  range: "30d"
expected:
  resolution: "4h"  # 4-hour aggregation
  max_points: 180
  render_time_ms: "<500"
```

#### Assertions

- [ ] Data aggregated to 4-hour intervals
- [ ] Chart renders without lag
- [ ] All data points visible

---

### TC076: Chart tooltip shows data point details (AC4)

**Type:** E2E
**Priority:** Medium
**Story:** US0007 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given chart displayed with data | Chart visible |
| 2 | When hovering over a data point | Mouse interaction |
| 3 | Then tooltip shows timestamp and value | Details visible |

#### Test Data

```yaml
expected:
  tooltip_contents:
    - timestamp
    - metric_value
  tooltip_format: "Jan 18, 10:30 - 45.5%"
```

#### Assertions

- [ ] Tooltip appears on hover
- [ ] Timestamp displayed
- [ ] Exact metric value shown
- [ ] Tooltip styled per brand guide

---

### TC077: Metrics API returns time-series data (AC5)

**Type:** API
**Priority:** High
**Story:** US0007 (AC5)
**Automated:** Yes (`tests/test_metrics_history.py`)

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given metrics exist for server | Historical data |
| 2 | When GET /api/v1/metrics/{server_id}?range=7d | API called |
| 3 | Then response contains data_points array | Time-series format |

#### Test Data

```yaml
input:
  method: GET
  endpoint: "/api/v1/metrics/omv-mediaserver?range=7d"
expected:
  status_code: 200
  body:
    server_id: "omv-mediaserver"
    range: "7d"
    resolution: "1h"
    data_points:
      - timestamp: "2026-01-11T00:00:00Z"
        cpu_percent: 23.5
        memory_percent: 67.2
        disk_percent: 45.0
    total_points: 168
```

#### Assertions

- [ ] Response includes server_id
- [ ] range field matches request
- [ ] resolution indicates aggregation
- [ ] data_points is array
- [ ] Each point has timestamp and metrics

---

### TC078: Charts handle no data gracefully

**Type:** Unit
**Priority:** Medium
**Story:** US0007 (edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no historical data exists | Empty response |
| 2 | When charts attempt to render | No data available |
| 3 | Then "No data available" message shown | Empty state |

#### Test Data

```yaml
input:
  api_response:
    data_points: []
    total_points: 0
expected:
  message: "No data available for this period"
```

#### Assertions

- [ ] Empty state message displayed
- [ ] No chart rendering errors
- [ ] Message suggests time range change

---

### TC079: Charts handle data gaps

**Type:** Unit
**Priority:** Medium
**Story:** US0007 (edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given data has gaps (null values) | Sparse data |
| 2 | When chart renders | Line chart drawn |
| 3 | Then gaps visible in chart line | No false interpolation |

#### Test Data

```yaml
input:
  data_points:
    - timestamp: "T1"
      cpu_percent: 45.0
    - timestamp: "T2"
      cpu_percent: null  # Gap
    - timestamp: "T3"
      cpu_percent: 52.0
expected:
  line_segments: 2  # Disconnected
```

#### Assertions

- [ ] Line breaks at null values
- [ ] No false data interpolation
- [ ] Visual indication of gap

---

### TC080: Package update count on server card

**Type:** Unit
**Priority:** Medium
**Story:** US0044 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server has updates_available: 12 | Update data |
| 2 | When server card renders | Card visible |
| 3 | Then update indicator shows count | "12 updates" |

#### Test Data

```yaml
input:
  updates_available: 12
  security_updates: 3
expected:
  indicator_text: "12 updates (3 security)"
```

#### Assertions

- [ ] Update count displayed
- [ ] Security count in parentheses
- [ ] Package icon present

---

### TC081: Security updates highlighted

**Type:** Unit
**Priority:** Medium
**Story:** US0044 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given security_updates > 0 | Security patches |
| 2 | When update indicator renders | Styling applied |
| 3 | Then security count in warning colour | Amber/orange text |

#### Test Data

```yaml
input:
  security_updates: 3
expected:
  security_colour: "#FBBF24"  # Amber
```

#### Assertions

- [ ] Security count uses warning colour
- [ ] Distinct from total count colour
- [ ] Warning icon may be present

---

### TC082: Zero updates shows clean state

**Type:** Unit
**Priority:** Low
**Story:** US0044 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given updates_available: 0 | Up to date |
| 2 | When server card renders | Card visible |
| 3 | Then no update indicator OR "Up to date" | Clean state |

#### Test Data

```yaml
input:
  updates_available: 0
  security_updates: 0
expected:
  indicator_visible: false
  or_text: "Up to date"
```

#### Assertions

- [ ] No update badge shown
- [ ] OR "Up to date" in success colour
- [ ] Clean visual state

---

### TC083: Update details in server detail view

**Type:** Unit
**Priority:** Medium
**Story:** US0044 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server detail page loaded | Full view |
| 2 | When updates section renders | Section visible |
| 3 | Then total, security, and last check displayed | Details shown |

#### Test Data

```yaml
input:
  updates_available: 12
  security_updates: 3
  last_seen: "2026-01-18T10:30:00Z"
expected:
  total_text: "Available Updates: 12"
  security_text: "Security Updates: 3"
  last_checked: "Last Checked: 2026-01-18 10:30 UTC"
```

#### Assertions

- [ ] Total count displayed
- [ ] Security count with warning indicator
- [ ] Last heartbeat as "last checked" time

---

## Fixtures

```yaml
# Shared test data for this spec
servers:
  media_server:
    id: "omv-mediaserver"
    hostname: "omv-mediaserver"
    display_name: "Media Server"
    ip_address: "192.168.1.10"
    status: "online"
    os_info:
      distribution: "Debian GNU/Linux"
      version: "12 (bookworm)"
      kernel: "6.1.0-18-amd64"
      architecture: "x86_64"
    latest_metrics:
      cpu_percent: 23.5
      memory_percent: 67.2
      memory_total_mb: 16384
      memory_used_mb: 11010
      disk_percent: 45.0
      disk_total_gb: 2000.0
      disk_used_gb: 900.0
      network_rx_bytes: 1234567890
      network_tx_bytes: 987654321
      load_1m: 0.45
      load_5m: 0.52
      load_15m: 0.48
      uptime_seconds: 1234567
    updates_available: 12
    security_updates: 3
    tdp_watts: 65

historical_data:
  seven_day_sample:
    server_id: "omv-mediaserver"
    range: "7d"
    resolution: "1h"
    data_points:
      - timestamp: "2026-01-11T00:00:00Z"
        cpu_percent: 23.5
        memory_percent: 67.2
        disk_percent: 45.0
      - timestamp: "2026-01-11T01:00:00Z"
        cpu_percent: 25.1
        memory_percent: 68.0
        disk_percent: 45.0
    total_points: 168

api_key: "test-api-key-12345"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC063 | Detail view displays server info | Automated | `frontend/src/pages/ServerDetail.test.tsx` |
| TC064 | Detail view shows OS information | Automated | `frontend/src/pages/ServerDetail.test.tsx` |
| TC065 | Detail view shows current metrics | Automated | `frontend/src/pages/ServerDetail.test.tsx` |
| TC066 | Gauge displays correct percentage | Automated | `frontend/src/components/Gauge.test.tsx` |
| TC067 | Gauge colour changes at thresholds | Automated | `frontend/src/components/Gauge.test.tsx` |
| TC068 | Uptime formatted correctly | Automated | `frontend/src/lib/formatters.test.ts` |
| TC069 | Network bytes formatted correctly | Automated | `frontend/src/lib/formatters.test.ts` |
| TC070 | Back button returns to dashboard | Automated | `frontend/src/pages/ServerDetail.test.tsx` |
| TC071 | Refresh button updates metrics | Automated | `frontend/src/pages/ServerDetail.test.tsx` |
| TC072 | 404 displayed for nonexistent server | Automated | `frontend/src/pages/ServerDetail.test.tsx` |
| TC073 | Historical charts display | Automated | `frontend/src/components/MetricsChart.test.tsx` |
| TC074 | Time range selection changes data | Automated | `frontend/src/components/TimeRangeSelector.test.tsx`, `MetricsChart.test.tsx` |
| TC075 | Charts render 30 days of data | Automated | `frontend/src/components/MetricsChart.test.tsx` |
| TC076 | Chart tooltip shows details | Automated | `frontend/src/components/MetricsChart.test.tsx` |
| TC077 | Metrics API returns time-series | Automated | `tests/test_metrics_history.py` |
| TC078 | Charts handle no data gracefully | Automated | `frontend/src/components/MetricsChart.test.tsx` |
| TC079 | Charts handle data gaps | Automated | `frontend/src/components/MetricsChart.test.tsx` |
| TC080 | Package update count on card | Automated | `frontend/src/components/ServerCard.test.tsx` |
| TC081 | Security updates highlighted | Automated | `frontend/src/components/ServerCard.test.tsx` |
| TC082 | Zero updates shows clean state | Automated | `frontend/src/components/ServerCard.test.tsx` |
| TC083 | Update details in detail view | Automated | `frontend/src/pages/ServerDetail.test.tsx` |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| TRD | [sdlc-studio/trd.md](../../trd.md) |
| Epic | [EP0001](../../epics/EP0001-core-monitoring.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## AC Mapping

### US0006: Server Detail View

| AC | Requirement | Test Cases |
|----|-------------|------------|
| AC1 | Server info displayed | TC063 |
| AC2 | OS info displayed | TC064 |
| AC3 | All metrics displayed | TC065 |
| AC4 | Metric gauges | TC066, TC067 |
| AC5 | Back navigation | TC070 |
| AC6 | Brand compliance | TC067 (colours) |

### US0007: Historical Metrics

| AC | Requirement | Test Cases |
|----|-------------|------------|
| AC1 | Charts on detail page | TC073 |
| AC2 | Time range selection | TC074 |
| AC3 | 30-day render | TC075 |
| AC4 | Hover tooltip | TC076 |
| AC5 | API returns time-series | TC077 |

### US0044: Package Updates

| AC | Requirement | Test Cases |
|----|-------------|------------|
| AC2 | Count on server card | TC080 |
| AC3 | Security highlighted | TC081 |
| AC4 | Detail view section | TC083 |
| AC5 | Zero shows clean | TC082 |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial spec generation for server detail, charts, and package updates |
| 2026-01-19 | Claude | 10/21 test cases automated (TC063-TC072) |
| 2026-01-19 | Claude | 20/21 test cases automated (TC073-TC083, TC077 pending API test) |
| 2026-01-19 | Claude | TC077 implemented - 21/21 test cases complete, status changed to Complete |
