# TS0179: Per-Interface Network Metrics API

> **Status:** Draft
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for per-interface network metrics collection, storage, and API delivery. Covers agent-side collection from /proc/net/dev, backend schema validation, API responses, historical metrics storage, and sparkline endpoint.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0179](../stories/US0179-per-interface-network-metrics-api.md) | Per-Interface Network Metrics API | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0179 | AC1 | Agent collects per-interface data | TC001-TC004 | Pending |
| US0179 | AC2 | Interface data structure | TC005-TC007 | Pending |
| US0179 | AC3 | API endpoint returns interface list | TC008-TC011 | Pending |
| US0179 | AC4 | Exclude loopback interface | TC012-TC015 | Pending |
| US0179 | AC5 | Historical per-interface metrics | TC016-TC018 | Pending |
| US0179 | AC6 | Network sparkline API | TC019-TC022 | Pending |

**Coverage:** 6/6 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Agent collection logic, schema validation, filtering |
| Integration | Yes | Heartbeat processing, database storage |
| API | Yes | Server endpoint responses, sparkline endpoint |
| E2E | No | Frontend widget update out of scope for this story |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, test database |
| External Services | None (mocks /proc/net/dev and /sys/class/net) |
| Test Data | Mock interface entries, mock operstate files |

---

## Test Cases

### TC001: Agent collects interface data from /proc/net/dev

**Type:** Unit | **Priority:** Critical | **Story:** US0179-AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev contains eth0 and wlan0 entries | Mocked /proc/net/dev content |
| When | get_network_interfaces() is called | Function executes |
| Then | Returns list with 2 interface entries | List length == 2 |

**Assertions:**
- [ ] Return type is list
- [ ] Each entry has name, rx_bytes, tx_bytes, rx_packets, tx_packets, is_up
- [ ] Entries match expected interface names (eth0, wlan0)

---

### TC002: Agent handles empty /proc/net/dev

**Type:** Unit | **Priority:** Medium | **Story:** US0179-AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev has only header lines | Mocked empty content |
| When | get_network_interfaces() is called | Function executes |
| Then | Returns empty list | List length == 0 |

**Assertions:**
- [ ] Return type is list
- [ ] List is empty
- [ ] No exceptions raised

---

### TC003: Agent handles /proc/net/dev not found

**Type:** Unit | **Priority:** High | **Story:** US0179-AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev doesn't exist | Mocked missing file |
| When | get_network_interfaces() is called | Function executes |
| Then | Returns empty list | List length == 0 |

**Assertions:**
- [ ] No exceptions raised
- [ ] Returns empty list
- [ ] Warning logged

---

### TC004: Agent reads interface state from operstate

**Type:** Unit | **Priority:** High | **Story:** US0179-AC1 (Edge Case 1)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | eth0 has operstate=up, wlan0 has operstate=down | Mocked /sys/class/net files |
| When | get_network_interfaces() is called | Function executes |
| Then | eth0.is_up=True, wlan0.is_up=False | Interface states correct |

**Assertions:**
- [ ] eth0 entry has is_up=True
- [ ] wlan0 entry has is_up=False
- [ ] Missing operstate defaults to True

---

### TC005: NetworkInterfaceMetric schema validates complete entry

**Type:** Unit | **Priority:** Critical | **Story:** US0179-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Complete interface data dict | All required fields present |
| When | NetworkInterfaceMetric schema validates | Pydantic validation |
| Then | Schema accepts valid data | No validation errors |

**Assertions:**
- [ ] name is string
- [ ] rx_bytes is int (>= 0)
- [ ] tx_bytes is int (>= 0)
- [ ] rx_packets is int (>= 0)
- [ ] tx_packets is int (>= 0)
- [ ] is_up is bool

---

### TC006: NetworkInterfaceMetric schema rejects missing fields

**Type:** Unit | **Priority:** High | **Story:** US0179-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Interface data missing name | Incomplete dict |
| When | NetworkInterfaceMetric schema validates | Pydantic validation |
| Then | Raises ValidationError | Error message indicates missing field |

**Assertions:**
- [ ] ValidationError raised
- [ ] Error identifies 'name' as missing
- [ ] Other fields validated if present

---

### TC007: NetworkInterfaceMetric schema rejects invalid types

**Type:** Unit | **Priority:** Medium | **Story:** US0179-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | rx_bytes is string "invalid" | Wrong type |
| When | NetworkInterfaceMetric schema validates | Pydantic validation |
| Then | Raises ValidationError | Error indicates type mismatch |

**Assertions:**
- [ ] ValidationError raised
- [ ] Error identifies type issue for rx_bytes
- [ ] Message is descriptive

---

### TC008: Server API returns network_interfaces array

**Type:** API | **Priority:** Critical | **Story:** US0179-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has network interface data stored | Test server with network_interfaces |
| When | GET /api/v1/servers/{id} | API request |
| Then | Response includes network_interfaces array | JSON contains network_interfaces key |

**Assertions:**
- [ ] Response status is 200
- [ ] Response JSON has 'network_interfaces' key
- [ ] network_interfaces is array (may be empty or populated)
- [ ] Each entry has required fields

---

### TC009: Server API returns empty network_interfaces for new server

**Type:** API | **Priority:** High | **Story:** US0179-AC3 (Edge Case 8)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has no network interface data yet | Newly registered server |
| When | GET /api/v1/servers/{id} | API request |
| Then | Response includes network_interfaces as null or empty array | Graceful handling |

**Assertions:**
- [ ] Response status is 200
- [ ] network_interfaces is null or []
- [ ] No error raised

---

### TC010: Server API returns multiple interfaces

**Type:** API | **Priority:** High | **Story:** US0179-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has 3 interfaces stored (eth0, tailscale0, docker0) | Multiple interfaces |
| When | GET /api/v1/servers/{id} | API request |
| Then | Response includes all 3 interfaces | All entries present |

**Assertions:**
- [ ] Response status is 200
- [ ] network_interfaces array length is 3
- [ ] Each interface has unique name
- [ ] Data matches stored values

---

### TC011: Heartbeat with network_interfaces stores data

**Type:** Integration | **Priority:** Critical | **Story:** US0179-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid heartbeat payload with network_interfaces | Complete request body |
| When | POST /api/v1/agents/heartbeat | API request |
| Then | Server's network_interfaces field is updated | Database updated |

**Assertions:**
- [ ] Response status is 200
- [ ] Server record updated in database
- [ ] Server.network_interfaces contains submitted data
- [ ] NetworkInterfaceMetrics historical records created

---

### TC012: Agent excludes loopback interface

**Type:** Unit | **Priority:** Critical | **Story:** US0179-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev contains lo and eth0 entries | lo and eth0 present |
| When | get_network_interfaces() is called | Function executes |
| Then | Only eth0 in results, lo filtered out | No loopback |

**Assertions:**
- [ ] No entry with name == 'lo'
- [ ] eth0 entry present
- [ ] List length == 1

---

### TC013: Agent includes tailscale interface

**Type:** Unit | **Priority:** High | **Story:** US0179-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev contains tailscale0 | Tailscale interface present |
| When | get_network_interfaces() is called | Function executes |
| Then | tailscale0 in results | Virtual interface included |

**Assertions:**
- [ ] Entry with name == 'tailscale0' present
- [ ] All metrics collected for tailscale0

---

### TC014: Agent includes docker0 interface

**Type:** Unit | **Priority:** High | **Story:** US0179-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev contains docker0 | Docker bridge present |
| When | get_network_interfaces() is called | Function executes |
| Then | docker0 in results | Bridge interface included |

**Assertions:**
- [ ] Entry with name == 'docker0' present
- [ ] All metrics collected for docker0

---

### TC015: Agent includes veth interfaces

**Type:** Unit | **Priority:** Medium | **Story:** US0179-AC4 (Edge Case 2)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/net/dev contains veth1234abc | Container veth present |
| When | get_network_interfaces() is called | Function executes |
| Then | veth1234abc in results | veth interface included |

**Assertions:**
- [ ] Entry with name starting with 'veth' present
- [ ] Useful for Docker networking visibility

---

### TC016: Historical network interface metrics stored

**Type:** Integration | **Priority:** High | **Story:** US0179-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Heartbeat submitted with network_interfaces | Valid payload |
| When | Heartbeat processed | Backend saves data |
| Then | NetworkInterfaceMetrics records created | Database records exist |

**Assertions:**
- [ ] NetworkInterfaceMetrics table has new records
- [ ] Records match submitted interface data
- [ ] Each interface has separate record
- [ ] Timestamps are correct

---

### TC017: Historical metrics queryable by interface

**Type:** API | **Priority:** Medium | **Story:** US0179-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has interface metrics over 24 hours | Multiple data points |
| When | Query sparkline endpoint with interface param | API request with interface=eth0 |
| Then | Returns eth0-specific trend data | Time series response |

**Assertions:**
- [ ] Response includes interface-specific metrics
- [ ] Data covers requested time range
- [ ] Multiple data points for interface
- [ ] interface_name identifies each series

---

### TC018: Historical metrics distinguishes multiple interfaces

**Type:** Integration | **Priority:** Medium | **Story:** US0179-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has eth0 and wlan0 interfaces | Two interfaces |
| When | Query historical metrics | API or DB query |
| Then | Separate trend data for each interface | Distinguished by interface_name |

**Assertions:**
- [ ] eth0 interface has separate data series
- [ ] wlan0 interface has separate data series
- [ ] No data mixing between interfaces
- [ ] interface_name used as discriminator

---

### TC019: Network sparkline endpoint returns data

**Type:** API | **Priority:** Critical | **Story:** US0179-AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has network metrics stored | Historical data exists |
| When | GET /api/v1/metrics/sparkline/{server_id}/network | API request |
| Then | Returns sparkline data | Time series response |

**Assertions:**
- [ ] Response status is 200
- [ ] Response has data array
- [ ] Each point has timestamp, rx_bytes, tx_bytes
- [ ] Points ordered by timestamp

---

### TC020: Network sparkline with interface filter

**Type:** API | **Priority:** High | **Story:** US0179-AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has eth0 and wlan0 metrics | Multiple interfaces |
| When | GET /api/v1/metrics/sparkline/{server_id}/network?interface=eth0 | API with interface param |
| Then | Returns eth0-only data | Filtered response |

**Assertions:**
- [ ] Response status is 200
- [ ] Data only for eth0 interface
- [ ] No wlan0 data in response

---

### TC021: Network sparkline with period filter

**Type:** API | **Priority:** High | **Story:** US0179-AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has 48 hours of network metrics | Extended history |
| When | GET /api/v1/metrics/sparkline/{server_id}/network?period=1h | API with period param |
| Then | Returns last 1 hour of data | Time-filtered response |

**Assertions:**
- [ ] Response status is 200
- [ ] Data covers last 1 hour only
- [ ] Older data not included

---

### TC022: Network sparkline for unknown interface returns empty

**Type:** API | **Priority:** Medium | **Story:** US0179-AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has eth0 metrics | Only eth0 exists |
| When | GET /api/v1/metrics/sparkline/{server_id}/network?interface=wlan0 | Non-existent interface |
| Then | Returns empty data array | Graceful handling |

**Assertions:**
- [ ] Response status is 200
- [ ] Data array is empty
- [ ] No error raised

---

## Fixtures

```yaml
mock_proc_net_dev_standard:
  content: |
    Inter-|   Receive                                                |  Transmit
     face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
        lo: 12345678    10000    0    0    0     0          0         0 12345678    10000    0    0    0     0       0          0
      eth0: 1073741824  1000000    0    0    0     0          0         0 536870912   500000    0    0    0     0       0          0
     wlan0: 10737418    10000    0    0    0     0          0         0  5368709     5000    0    0    0     0       0          0

mock_proc_net_dev_with_virtual:
  content: |
    Inter-|   Receive                                                |  Transmit
     face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
        lo: 12345678    10000    0    0    0     0          0         0 12345678    10000    0    0    0     0       0          0
      eth0: 1073741824  1000000    0    0    0     0          0         0 536870912   500000    0    0    0     0       0          0
    tailscale0: 10737418    10000    0    0    0     0          0         0  5368709     5000    0    0    0     0       0          0
    docker0:       0        0    0    0    0     0          0         0        0         0    0    0    0     0       0          0
    veth1234abc: 1024     100    0    0    0     0          0         0     2048       200    0    0    0     0       0          0

mock_operstate_up:
  content: "up"

mock_operstate_down:
  content: "down"

test_server:
  id: "test-server-001"
  server_guid: "550e8400-e29b-41d4-a716-446655440001"
  hostname: "testhost.local"
  status: "online"

test_network_interface_valid:
  name: "eth0"
  rx_bytes: 1073741824
  tx_bytes: 536870912
  rx_packets: 1000000
  tx_packets: 500000
  is_up: true

test_heartbeat_with_network_interfaces:
  server_id: "test-server-001"
  server_guid: "550e8400-e29b-41d4-a716-446655440001"
  hostname: "testhost.local"
  status: "online"
  metrics:
    cpu_percent: 25.5
    memory_percent: 45.2
    disk_percent: 60.0
    network_rx_bytes: 1084479242
    network_tx_bytes: 542239621
  network_interfaces:
    - name: "eth0"
      rx_bytes: 1073741824
      tx_bytes: 536870912
      rx_packets: 1000000
      tx_packets: 500000
      is_up: true
    - name: "tailscale0"
      rx_bytes: 10737418
      tx_bytes: 5368709
      rx_packets: 10000
      tx_packets: 5000
      is_up: true
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Agent collects interface data | Pending | - |
| TC002 | Agent handles empty /proc/net/dev | Pending | - |
| TC003 | Agent handles missing /proc/net/dev | Pending | - |
| TC004 | Agent reads interface state | Pending | - |
| TC005 | Schema validates complete entry | Pending | - |
| TC006 | Schema rejects missing fields | Pending | - |
| TC007 | Schema rejects invalid types | Pending | - |
| TC008 | Server API returns interfaces array | Pending | - |
| TC009 | Server API returns empty interfaces | Pending | - |
| TC010 | Server API returns multiple interfaces | Pending | - |
| TC011 | Heartbeat stores data | Pending | - |
| TC012 | Agent excludes loopback | Pending | - |
| TC013 | Agent includes tailscale | Pending | - |
| TC014 | Agent includes docker0 | Pending | - |
| TC015 | Agent includes veth | Pending | - |
| TC016 | Historical metrics stored | Pending | - |
| TC017 | Historical metrics queryable by interface | Pending | - |
| TC018 | Historical metrics distinguishes interfaces | Pending | - |
| TC019 | Network sparkline endpoint | Pending | - |
| TC020 | Sparkline with interface filter | Pending | - |
| TC021 | Sparkline with period filter | Pending | - |
| TC022 | Sparkline for unknown interface | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0179: Per-Interface Network Metrics API](../plans/PL0179-per-interface-network-metrics-api.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
