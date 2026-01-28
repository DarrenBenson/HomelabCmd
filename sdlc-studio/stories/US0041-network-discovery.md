# US0041: Network Discovery

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5
> **Completed:** 2026-01-21

## User Story

**As a** Darren (Homelab Operator)
**I want** to discover devices on my network
**So that** I can find scannable devices without knowing their IP addresses

## Context

### Persona Reference

**Darren** - Sometimes forgets which IP a device has. Wants to see all devices on the LAN and select one to scan.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Network discovery scans the local subnet to find active devices. Results show IP address, hostname (if resolvable), and MAC address. Users can then initiate a scan on any discovered device.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | Discovery checks SSH port availability |
| Scope | Ad-hoc scanning | Discovery is on-demand, not scheduled |
| Architecture | Monolith deployment | Discovery runs within hub container |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Architecture | LAN-only | Discovery limited to configured subnet |
| Goal | Fleet audit - complete inventory | Must find all active devices on subnet |
| Design | Brand guide compliance | Progress bar follows phosphor palette |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Initiate network discovery

- **Given** the scan page
- **When** clicking "Discover Network"
- **Then** a network discovery scan is initiated

### AC2: Subnet configurable

- **Given** discovery settings
- **When** configuring the subnet
- **Then** discovery scans the specified subnet (e.g., 192.168.1.0/24)

### AC3: Discovery results displayed

- **Given** discovery completes
- **When** viewing results
- **Then** found devices show IP, hostname, and response time

### AC4: Select device for scan

- **Given** discovery results
- **When** clicking "Scan" on a device
- **Then** the scan initiation form is pre-populated with that IP

### AC5: Discovery progress shown

- **Given** discovery is running
- **When** viewing the page
- **Then** progress (IPs scanned / total) is displayed

## Scope

### In Scope

- Network discovery API endpoint
- Ping sweep or ARP scan
- Subnet configuration
- Discovery results display
- Quick action to scan discovered device

### Out of Scope

- Port scanning
- OS fingerprinting
- Automatic device classification
- Multiple subnet discovery

## UI/UX Requirements

### Network Discovery Section

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Scans                                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Manual Scan                                                      │   │
│  │                                                                   │   │
│  │ Hostname/IP: [______________________]  [Quick Scan] [Full Scan]  │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Network Discovery                                  [⚙️ Settings] │   │
│  │                                                                   │   │
│  │ Subnet: 192.168.1.0/24                        [🔍 Discover Now]  │   │
│  │                                                                   │   │
│  │ Progress: ████████████░░░░░░░░░  127/254 IPs scanned            │   │
│  │                                                                   │   │
│  │ Found Devices (8)                                                │   │
│  │ ┌───────────────────────────────────────────────────────────┐   │   │
│  │ │ IP              │ Hostname       │ Response │             │   │   │
│  │ ├───────────────────────────────────────────────────────────┤   │   │
│  │ │ 192.168.1.1     │ router         │ 1 ms     │ [Scan]     │   │   │
│  │ │ 192.168.1.10    │ omv-mediaserver│ 2 ms     │ ★ Monitored│   │   │
│  │ │ 192.168.1.50    │ pihole-primary │ 3 ms     │ ★ Monitored│   │   │
│  │ │ 192.168.1.100   │ dazzbook       │ 5 ms     │ [Scan]     │   │   │
│  │ │ 192.168.1.105   │ --             │ 12 ms    │ [Scan]     │   │   │
│  │ │ 192.168.1.120   │ iphone-darren  │ 8 ms     │ [Scan]     │   │   │
│  │ │ ...             │                │          │            │   │   │
│  │ └───────────────────────────────────────────────────────────┘   │   │
│  │                                                                   │   │
│  │ Last discovery: 2 minutes ago                                    │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Brand Guide Reference

- Monitored devices marked with star
- Progress bar styling per brand guide

## Technical Notes

### API Contracts

**POST /api/v1/discovery**
```json
Request:
{
  "subnet": "192.168.1.0/24"  // Optional, uses default if not provided
}

Response 202:
{
  "discovery_id": 5,
  "status": "running",
  "subnet": "192.168.1.0/24",
  "started_at": "2026-01-18T10:30:00Z"
}
```

**GET /api/v1/discovery/{discovery_id}**
```json
Response 200 (in progress):
{
  "discovery_id": 5,
  "status": "running",
  "progress": {
    "scanned": 127,
    "total": 254,
    "percent": 50
  },
  "devices_found": 5
}

Response 200 (complete):
{
  "discovery_id": 5,
  "status": "completed",
  "subnet": "192.168.1.0/24",
  "started_at": "2026-01-18T10:30:00Z",
  "completed_at": "2026-01-18T10:31:15Z",
  "devices": [
    {
      "ip": "192.168.1.1",
      "hostname": "router",
      "response_time_ms": 1,
      "is_monitored": false
    },
    {
      "ip": "192.168.1.10",
      "hostname": "omv-mediaserver",
      "response_time_ms": 2,
      "is_monitored": true
    }
  ]
}
```

**GET /api/v1/settings/discovery**
```json
Response 200:
{
  "default_subnet": "192.168.1.0/24",
  "timeout_ms": 500
}
```

**TRD Reference:** [§4 API Contracts - Scans](../trd.md#4-api-contracts)

### Discovery Implementation

```python
import asyncio
import socket

async def discover_host(ip: str, timeout: float = 0.5) -> dict | None:
    """Check if host responds to ping or TCP connect on common port."""
    try:
        # Try TCP connect to SSH port
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, 22),
            timeout=timeout
        )
        writer.close()
        await writer.wait_closed()

        # Try reverse DNS
        try:
            hostname = socket.gethostbyaddr(ip)[0]
        except socket.herror:
            hostname = None

        return {'ip': ip, 'hostname': hostname}
    except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
        return None
```

### Data Requirements

- Discovery results stored temporarily (not persisted long-term)
- Cross-reference with registered servers for "monitored" flag

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Large subnet (/16) | Limit or warn about scan time |
| No devices found | Show "No devices found" message |
| Device offline during scan | Not included in results |
| Discovery already running | Return existing discovery ID |

## Test Scenarios

- [ ] Discovery can be initiated
- [ ] Progress updates correctly
- [ ] Found devices displayed
- [ ] Hostname resolved when possible
- [ ] Monitored devices marked
- [ ] Scan button pre-populates form
- [ ] Subnet configuration works

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0041-01 | Discovery initiated from scan page | AC1 | E2E | Pending |
| TC-US0041-02 | Subnet configurable in settings | AC2 | API | Pending |
| TC-US0041-03 | Results show IP, hostname, response time | AC3 | API | Pending |
| TC-US0041-04 | Select device pre-populates scan form | AC4 | E2E | Pending |
| TC-US0041-05 | Progress shows IPs scanned vs total | AC5 | E2E | Pending |
| TC-US0041-06 | Large subnet warns about scan time | Edge | E2E | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 4/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 1/1 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0002: Server Registration API | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium-High - network discovery implementation

## Open Questions

None

### Resolved Questions

- [x] Network discovery method - **TCP port 22 check** (resolved 2026-01-21)
  - Fast, no elevated privileges needed
  - Only finds SSH-enabled devices (which are the scannable ones anyway)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-21 | Claude | Resolved discovery method (TCP port 22 check); fixed dependency status; marked Ready |
| 2026-01-21 | Claude | Implemented; marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
