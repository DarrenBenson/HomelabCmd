# US0179: Per-Interface Network Metrics API

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 5
> **Plan:** [PL0179: Per-Interface Network Metrics API](../plans/PL0179-per-interface-network-metrics-api.md)
> **Test Spec:** [TS0179: Per-Interface Network Metrics API](../test-specs/TS0179-per-interface-network-metrics-api.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** the API to provide per-interface network metrics
**So that** the network widget can show individual interface traffic

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Monitors network for troubleshooting.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
US0171 (Network Widget) is partially implemented showing aggregate RX/TX. This story provides the backend API needed for per-interface breakdown and historical charts.

---

## Acceptance Criteria

### AC1: Agent collects per-interface data
- **Given** the agent runs on a machine
- **When** it collects metrics
- **Then** it reports data for each network interface

### AC2: Interface data structure
- **Given** interface data is collected
- **When** included in heartbeat/metrics
- **Then** each entry includes: name, rx_bytes, tx_bytes, rx_packets, tx_packets, is_up

### AC3: API endpoint returns interface list
- **Given** a machine has network interface data
- **When** I request `GET /api/v1/servers/{id}` or metrics endpoint
- **Then** the response includes `network_interfaces` array

### AC4: Exclude loopback and virtual interfaces
- **Given** the agent collects interface data
- **When** processing interfaces
- **Then** it excludes lo (loopback) by default but includes tailscale, docker, bridge

### AC5: Historical per-interface metrics
- **Given** interface data is collected over time
- **When** I request sparkline/metrics history for network
- **Then** I can get per-interface trends

### AC6: Network sparkline API
- **Given** network metrics are stored
- **When** I request `GET /api/v1/metrics/sparkline/{server_id}/network`
- **Then** I receive time-series data for network traffic

---

## Scope

### In Scope
- Agent enhancement: collect per-interface data
- Heartbeat schema update
- API response includes network_interfaces array
- Filter out loopback
- Network sparkline endpoint
- Store historical data per interface

### Out of Scope
- Packet loss metrics
- Network latency/ping
- Connection tracking (established connections)
- Bandwidth utilisation percentage

---

## Technical Notes

### Agent Collection
```python
def get_network_interfaces():
    interfaces = []

    # Read from /proc/net/dev
    with open('/proc/net/dev', 'r') as f:
        lines = f.readlines()[2:]  # Skip headers

        for line in lines:
            parts = line.split()
            name = parts[0].rstrip(':')

            # Skip loopback
            if name == 'lo':
                continue

            rx_bytes = int(parts[1])
            rx_packets = int(parts[2])
            tx_bytes = int(parts[9])
            tx_packets = int(parts[10])

            # Check if interface is up
            try:
                with open(f'/sys/class/net/{name}/operstate', 'r') as state_file:
                    is_up = state_file.read().strip() == 'up'
            except (FileNotFoundError, PermissionError):
                is_up = True  # Assume up if can't read

            interfaces.append({
                'name': name,
                'rx_bytes': rx_bytes,
                'tx_bytes': tx_bytes,
                'rx_packets': rx_packets,
                'tx_packets': tx_packets,
                'is_up': is_up
            })

    return interfaces
```

### Heartbeat Schema Addition
```python
class HeartbeatRequest(BaseModel):
    # ... existing fields
    network_interfaces: Optional[List[NetworkInterfaceMetric]] = None

class NetworkInterfaceMetric(BaseModel):
    name: str
    rx_bytes: int
    tx_bytes: int
    rx_packets: int
    tx_packets: int
    is_up: bool
```

### API Response
```json
{
  "id": "mediaserver",
  "hostname": "mediaserver.local",
  "network_interfaces": [
    {
      "name": "eth0",
      "rx_bytes": 1073741824,
      "tx_bytes": 536870912,
      "rx_packets": 1000000,
      "tx_packets": 500000,
      "is_up": true
    },
    {
      "name": "tailscale0",
      "rx_bytes": 10737418,
      "tx_bytes": 5368709,
      "rx_packets": 10000,
      "tx_packets": 5000,
      "is_up": true
    },
    {
      "name": "docker0",
      "rx_bytes": 0,
      "tx_bytes": 0,
      "rx_packets": 0,
      "tx_packets": 0,
      "is_up": false
    }
  ]
}
```

### Sparkline Endpoint
```
GET /api/v1/metrics/sparkline/{server_id}/network?period=1h&interface=eth0

Response:
{
  "server_id": "mediaserver",
  "metric": "network",
  "interface": "eth0",
  "period": "1h",
  "data": [
    {"timestamp": "2026-01-29T10:00:00Z", "rx_bytes": 100000000, "tx_bytes": 50000000},
    {"timestamp": "2026-01-29T10:05:00Z", "rx_bytes": 105000000, "tx_bytes": 52500000},
    ...
  ]
}
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Interface down | Include with is_up: false |
| 2 | Virtual interface (veth) | Include, useful for Docker networking |
| 3 | No physical interfaces | Return empty array |
| 4 | Counter overflow (32-bit) | Handle wrap-around in rate calculation |

---

## Test Scenarios

- [ ] Agent collects data from /proc/net/dev
- [ ] Loopback interface filtered out
- [ ] Heartbeat includes network_interfaces array
- [ ] API returns interfaces in server response
- [ ] Sparkline endpoint returns historical data
- [ ] Interface state (up/down) correctly detected

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0171](US0171-network-widget.md) | Enables | Network widget interface list & charts | Partial |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Agent enhancement, schema update, sparkline API

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation to enable US0171 completion |
| 2026-01-29 | Claude | Status: Draft → Planned, added plan (PL0179) and test-spec (TS0179) |
| 2026-01-29 | Claude | Status: In Progress → Done. ACs 1-5 implemented. AC6 (sparkline) deferred. |
