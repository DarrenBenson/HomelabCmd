# TS0017: Network Discovery Test Specification

> **Story:** [US0041: Network Discovery](../stories/US0041-network-discovery.md)
> **Plan:** [PL0048: Network Discovery Implementation](../plans/PL0048-network-discovery.md)
> **Status:** Ready
> **Created:** 2026-01-21

## Overview

Test specification for the network discovery feature, covering backend discovery service, API endpoints, and frontend discovery components.

## Test Categories

| Category | Count | Priority |
|----------|-------|----------|
| Backend API | 10 | High |
| Backend Service | 6 | High |
| Frontend UI | 12 | High |
| Integration | 4 | Medium |
| Edge Cases | 6 | Medium |
| **Total** | **38** | |

## Backend Service Tests

### TC-TS0017-01: Parse valid CIDR subnet

**AC Coverage:** AC2
**Type:** Unit
**Priority:** High

**Steps:**
1. Call parse_subnet("192.168.1.0/24")

**Expected:**
- Returns network object
- Host count is 254

---

### TC-TS0017-02: Parse invalid CIDR returns error

**AC Coverage:** AC2
**Type:** Unit
**Priority:** High

**Steps:**
1. Call parse_subnet("invalid")

**Expected:**
- Raises ValueError
- Error message indicates invalid subnet

---

### TC-TS0017-03: Iterate IPs from subnet excludes network and broadcast

**AC Coverage:** AC2
**Type:** Unit
**Priority:** High

**Steps:**
1. Call get_host_ips("192.168.1.0/24")

**Expected:**
- First IP is 192.168.1.1 (not .0)
- Last IP is 192.168.1.254 (not .255)
- Total count is 254

---

### TC-TS0017-04: discover_host returns device on open port

**AC Coverage:** AC3
**Type:** Unit (mocked)
**Priority:** High

**Setup:**
- Mock asyncio.open_connection to succeed

**Steps:**
1. Call discover_host("192.168.1.1")

**Expected:**
- Returns dict with ip, hostname, response_time_ms
- response_time_ms is > 0

---

### TC-TS0017-05: discover_host returns None on timeout

**AC Coverage:** AC3
**Type:** Unit (mocked)
**Priority:** High

**Setup:**
- Mock asyncio.open_connection to raise TimeoutError

**Steps:**
1. Call discover_host("192.168.1.99")

**Expected:**
- Returns None
- No exception raised

---

### TC-TS0017-06: is_monitored checks registered servers

**AC Coverage:** AC3
**Type:** Unit
**Priority:** High

**Setup:**
- Create Server with ip_address="192.168.1.10"

**Steps:**
1. Call check_is_monitored(session, "192.168.1.10")
2. Call check_is_monitored(session, "192.168.1.99")

**Expected:**
- First call returns True
- Second call returns False

---

## Backend API Tests

### TC-TS0017-07: POST /discovery creates discovery and returns 202

**AC Coverage:** AC1
**Type:** API
**Priority:** High

**Steps:**
1. Call POST /api/v1/discovery with {"subnet": "192.168.1.0/24"}

**Expected:**
- Response status: 202 Accepted
- Response contains discovery_id, status="running"
- Discovery record created in database

---

### TC-TS0017-08: POST /discovery uses default subnet when not provided

**AC Coverage:** AC2
**Type:** API
**Priority:** High

**Setup:**
- Set discovery config with default_subnet="10.0.0.0/24"

**Steps:**
1. Call POST /api/v1/discovery with empty body {}

**Expected:**
- Response status: 202 Accepted
- Discovery uses subnet "10.0.0.0/24"

---

### TC-TS0017-09: POST /discovery returns 400 for large subnet

**AC Coverage:** AC2, Edge
**Type:** API
**Priority:** High

**Steps:**
1. Call POST /api/v1/discovery with {"subnet": "10.0.0.0/8"}

**Expected:**
- Response status: 400 Bad Request
- Error detail mentions subnet too large

---

### TC-TS0017-10: POST /discovery returns existing discovery if running

**AC Coverage:** Edge
**Type:** API
**Priority:** High

**Setup:**
- Create discovery with status="running"

**Steps:**
1. Call POST /api/v1/discovery

**Expected:**
- Response status: 202 Accepted
- Returns existing discovery_id
- No new discovery created

---

### TC-TS0017-11: GET /discovery/{id} returns progress during scan

**AC Coverage:** AC5
**Type:** API
**Priority:** High

**Setup:**
- Create discovery with status="running", progress_scanned=50, progress_total=254

**Steps:**
1. Call GET /api/v1/discovery/{id}

**Expected:**
- Response contains status="running"
- Response contains progress.scanned=50, progress.total=254, progress.percent=19

---

### TC-TS0017-12: GET /discovery/{id} returns devices when completed

**AC Coverage:** AC3
**Type:** API
**Priority:** High

**Setup:**
- Create completed discovery with devices array

**Steps:**
1. Call GET /api/v1/discovery/{id}

**Expected:**
- Response contains status="completed"
- devices array has expected entries
- Each device has ip, hostname, response_time_ms, is_monitored

---

### TC-TS0017-13: GET /discovery/{id} returns 404 for non-existent

**AC Coverage:** AC3
**Type:** API
**Priority:** High

**Steps:**
1. Call GET /api/v1/discovery/99999

**Expected:**
- Response status: 404 Not Found
- Error detail: "Discovery 99999 not found"

---

### TC-TS0017-14: GET /settings/discovery returns config

**AC Coverage:** AC2
**Type:** API
**Priority:** High

**Setup:**
- Set discovery config in database

**Steps:**
1. Call GET /api/v1/settings/discovery

**Expected:**
- Response contains default_subnet
- Response contains timeout_ms

---

### TC-TS0017-15: All discovery endpoints require authentication

**AC Coverage:** Security
**Type:** API
**Priority:** High

**Steps:**
1. Call POST /api/v1/discovery without API key
2. Call GET /api/v1/discovery/1 without API key
3. Call GET /api/v1/settings/discovery without API key

**Expected:**
- All return 401 Unauthorized

---

### TC-TS0017-16: POST /discovery validates invalid subnet format

**AC Coverage:** AC2
**Type:** API
**Priority:** Medium

**Steps:**
1. Call POST /api/v1/discovery with {"subnet": "not-a-cidr"}

**Expected:**
- Response status: 422 Unprocessable Entity
- Error detail mentions invalid subnet

---

## Frontend UI Tests

### TC-TS0017-17: ScansPage renders manual scan and discovery sections

**AC Coverage:** AC1
**Type:** Component
**Priority:** High

**Steps:**
1. Render ScansPage

**Expected:**
- Manual Scan section visible with hostname input
- Network Discovery section visible
- Discover Now button visible

---

### TC-TS0017-18: Clicking Discover Now initiates discovery

**AC Coverage:** AC1
**Type:** Component
**Priority:** High

**Setup:**
- Mock startDiscovery API

**Steps:**
1. Render ScansPage
2. Click "Discover Now" button

**Expected:**
- startDiscovery API called
- Progress section appears
- Button disabled during scan

---

### TC-TS0017-19: Discovery progress bar updates

**AC Coverage:** AC5
**Type:** Component
**Priority:** High

**Setup:**
- Mock getDiscovery to return progress_scanned=127, progress_total=254

**Steps:**
1. Render NetworkDiscovery with active discovery
2. Wait for polling

**Expected:**
- Progress bar shows 50%
- Text shows "127 / 254 IPs scanned"

---

### TC-TS0017-20: Completed discovery shows device table

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock getDiscovery with completed status and 5 devices

**Steps:**
1. Render NetworkDiscovery with completed discovery

**Expected:**
- Table visible with headers: IP, Hostname, Response Time, Action
- 5 rows displayed
- Each row shows correct data

---

### TC-TS0017-21: Device table shows response time

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock device with response_time_ms=5

**Steps:**
1. Render DiscoveryResults with device

**Expected:**
- Response time shows "5 ms"

---

### TC-TS0017-22: Device table shows hostname or "--" if null

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock devices: one with hostname, one without

**Steps:**
1. Render DiscoveryResults

**Expected:**
- First device shows hostname
- Second device shows "--"

---

### TC-TS0017-23: Monitored device shows star badge

**AC Coverage:** AC3
**Type:** Component
**Priority:** High

**Setup:**
- Mock device with is_monitored=true

**Steps:**
1. Render DiscoveryResults

**Expected:**
- Row shows "Monitored" badge with star
- No "Scan" button for monitored device

---

### TC-TS0017-24: Non-monitored device shows Scan button

**AC Coverage:** AC4
**Type:** Component
**Priority:** High

**Setup:**
- Mock device with is_monitored=false

**Steps:**
1. Render DiscoveryResults

**Expected:**
- Row shows "Scan" button
- Button is clickable

---

### TC-TS0017-25: Clicking Scan button pre-populates form

**AC Coverage:** AC4
**Type:** Component
**Priority:** High

**Setup:**
- Mock device with ip="192.168.1.100"

**Steps:**
1. Render ScansPage with discovery results
2. Click "Scan" button on device row

**Expected:**
- Manual scan hostname field populated with "192.168.1.100"
- Page scrolls to manual scan section (or focuses input)

---

### TC-TS0017-26: Empty discovery shows "No devices found"

**AC Coverage:** Edge
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock getDiscovery with completed status and empty devices array

**Steps:**
1. Render NetworkDiscovery

**Expected:**
- "No devices found" message displayed
- Table not visible

---

### TC-TS0017-27: Discovery error shows error message

**AC Coverage:** Edge
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock getDiscovery with status="failed" and error message

**Steps:**
1. Render NetworkDiscovery

**Expected:**
- Error message displayed
- Retry button visible

---

### TC-TS0017-28: Settings link navigates to discovery settings

**AC Coverage:** AC2
**Type:** Component
**Priority:** Medium

**Steps:**
1. Render NetworkDiscovery
2. Click settings icon

**Expected:**
- Navigation to /settings/discovery or modal opens

---

## Edge Case Tests

### TC-TS0017-29: Subnet with /32 (single host) works

**AC Coverage:** AC2, Edge
**Type:** API
**Priority:** Medium

**Steps:**
1. Call POST /api/v1/discovery with {"subnet": "192.168.1.1/32"}

**Expected:**
- Response status: 202 Accepted
- progress_total is 1
- Discovery completes quickly

---

### TC-TS0017-30: Device without reverse DNS shows null hostname

**AC Coverage:** AC3, Edge
**Type:** Unit
**Priority:** Medium

**Setup:**
- Mock socket.gethostbyaddr to raise herror

**Steps:**
1. Call discover_host for IP without DNS

**Expected:**
- Returns device with hostname=null
- No exception raised

---

### TC-TS0017-31: Connection refused not included in results

**AC Coverage:** Edge
**Type:** Unit
**Priority:** Medium

**Setup:**
- Mock asyncio.open_connection to raise ConnectionRefusedError

**Steps:**
1. Call discover_host("192.168.1.99")

**Expected:**
- Returns None
- Device not added to results

---

### TC-TS0017-32: Concurrent discovery limit respected

**AC Coverage:** Edge
**Type:** Unit
**Priority:** Medium

**Steps:**
1. Start discovery on /24 subnet
2. Monitor concurrent connections

**Expected:**
- Never more than 50 concurrent connections
- All IPs eventually scanned

---

### TC-TS0017-33: Multiple discovery requests return same ID

**AC Coverage:** Edge
**Type:** API
**Priority:** Medium

**Setup:**
- Discovery currently running

**Steps:**
1. Call POST /api/v1/discovery
2. Call POST /api/v1/discovery again

**Expected:**
- Both return same discovery_id
- Only one discovery in database

---

### TC-TS0017-34: Polling stops after completion

**AC Coverage:** AC5
**Type:** Component
**Priority:** Medium

**Setup:**
- Mock discovery that completes

**Steps:**
1. Render NetworkDiscovery with running discovery
2. Wait for completion
3. Check polling status

**Expected:**
- Polling stops after status="completed"
- No further API calls

---

## Integration Tests

### TC-TS0017-35: Full discovery flow

**AC Coverage:** AC1, AC3, AC5
**Type:** Integration
**Priority:** High

**Steps:**
1. Navigate to /scans
2. Click "Discover Now"
3. Wait for progress updates
4. Wait for completion
5. Verify devices listed

**Expected:**
- Progress updates visible during scan
- Completion shows device table
- Devices have correct data

---

### TC-TS0017-36: Discovery to scan flow

**AC Coverage:** AC4
**Type:** Integration
**Priority:** High

**Steps:**
1. Complete a discovery
2. Click "Scan" on discovered device
3. Verify scan form populated
4. Submit scan
5. Verify scan initiated

**Expected:**
- IP pre-populated in form
- Scan created for that IP

---

### TC-TS0017-37: Settings update affects discovery

**AC Coverage:** AC2
**Type:** Integration
**Priority:** Medium

**Steps:**
1. Update discovery settings with new subnet
2. Start new discovery
3. Verify correct subnet used

**Expected:**
- Discovery uses new subnet
- Not old default

---

### TC-TS0017-38: Refresh during discovery maintains state

**AC Coverage:** AC5
**Type:** Integration
**Priority:** Medium

**Steps:**
1. Start discovery
2. Refresh page during scan
3. Verify state recovered

**Expected:**
- Progress continues updating
- No duplicate discovery started

---

## Test Data Requirements

### Mock Devices

```typescript
const mockDevices = [
  {
    ip: "192.168.1.1",
    hostname: "router",
    response_time_ms: 1,
    is_monitored: false,
  },
  {
    ip: "192.168.1.10",
    hostname: "omv-mediaserver",
    response_time_ms: 2,
    is_monitored: true,
  },
  {
    ip: "192.168.1.50",
    hostname: "pihole-primary",
    response_time_ms: 3,
    is_monitored: true,
  },
  {
    ip: "192.168.1.100",
    hostname: null,
    response_time_ms: 5,
    is_monitored: false,
  },
];
```

### Mock Discovery Response (Running)

```typescript
const mockRunningDiscovery = {
  discovery_id: 1,
  status: "running",
  subnet: "192.168.1.0/24",
  started_at: "2026-01-21T10:00:00Z",
  progress: {
    scanned: 127,
    total: 254,
    percent: 50,
  },
  devices_found: 4,
};
```

### Mock Discovery Response (Completed)

```typescript
const mockCompletedDiscovery = {
  discovery_id: 1,
  status: "completed",
  subnet: "192.168.1.0/24",
  started_at: "2026-01-21T10:00:00Z",
  completed_at: "2026-01-21T10:01:30Z",
  devices: mockDevices,
};
```

## Coverage Matrix

| AC | Test Cases | Coverage |
|----|------------|----------|
| AC1: Initiate network discovery | TC-07, TC-17, TC-18, TC-35 | Full |
| AC2: Subnet configurable | TC-01, TC-02, TC-03, TC-08, TC-09, TC-14, TC-16, TC-28, TC-29, TC-37 | Full |
| AC3: Discovery results displayed | TC-04, TC-06, TC-12, TC-13, TC-20, TC-21, TC-22, TC-23, TC-30, TC-35 | Full |
| AC4: Select device for scan | TC-24, TC-25, TC-36 | Full |
| AC5: Discovery progress shown | TC-11, TC-19, TC-34, TC-35, TC-38 | Full |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial test specification |
