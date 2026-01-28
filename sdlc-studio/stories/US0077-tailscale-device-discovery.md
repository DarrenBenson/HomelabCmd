# US0077: Tailscale Device Discovery

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-26
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to see all devices on my Tailscale network
**So that** I can identify which machines to monitor without manual network scanning

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers on Tailscale. Wants a visual inventory of all Tailscale devices to easily identify and import machines for monitoring.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With the Tailscale API client configured (US0076), HomelabCmd can now query the control plane for all devices in the tailnet. This story provides the discovery UI and API endpoint that lists all devices with their metadata, allowing users to see their entire Tailscale fleet at a glance before importing machines for monitoring.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Performance | Cache results for 5 minutes | Avoid excessive API calls |
| UX | Loading state during API call | Show spinner while fetching |
| Security | Credentials encrypted | Token retrieved via US0081 |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard load < 2s | Discovery page must load quickly |
| UX | Minimal maintenance | Auto-discovery reduces manual work |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Device list endpoint returns Tailscale devices

- **Given** a valid Tailscale API token is configured
- **When** I call `GET /api/v1/tailscale/devices`
- **Then** I receive a list of all devices in the tailnet
- **And** each device includes: `id`, `name`, `hostname`, `tailscale_ip`, `os`, `last_seen`, `online`
- **And** devices are sorted alphabetically by name

### AC2: Device filtering supported

- **Given** the device list endpoint
- **When** I call with query parameters
- **Then** filtering is supported:
  - `?online=true` - only online devices
  - `?online=false` - only offline devices
  - `?os=linux` - only devices with matching OS
- **And** filters can be combined: `?online=true&os=linux`

### AC3: Results cached for 5 minutes

- **Given** a successful device list request
- **When** I make another request within 5 minutes
- **Then** the cached result is returned without calling Tailscale API
- **And** response includes `cache_hit: true` and `cached_at` timestamp
- **And** the Refresh button bypasses cache with `?refresh=true`

### AC4: Discovery UI page displays devices

- **Given** I navigate to Discovery > Tailscale Devices
- **When** the page loads
- **Then** I see a list of all Tailscale devices
- **And** each device card shows: hostname, Tailscale IP, OS, status (online/offline), last seen
- **And** online devices show green indicator, offline show grey
- **And** each device has an "Import" button

### AC5: Loading and empty states

- **Given** the Discovery page
- **When** devices are loading
- **Then** I see "Discovering devices..." with a spinner
- **When** no Tailscale token is configured
- **Then** I see "Configure Tailscale API token in Settings to discover devices"
- **When** token is valid but no devices found
- **Then** I see "No devices found in your tailnet"

## Scope

### In Scope

- `GET /api/v1/tailscale/devices` endpoint
- Device list caching (5 minute TTL)
- Filtering by online status and OS
- Discovery UI page with device cards
- Refresh button to bypass cache
- Loading, empty, and error states

### Out of Scope

- Device import (US0078)
- Real-time device status updates (polling only)
- Device grouping or categorisation
- Search within device list

## UI/UX Requirements

**Discovery > Tailscale Devices Page:**

```
┌────────────────────────────────────────────────────────┐
│ Tailscale Device Discovery              [Refresh]       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Filter: [All ▼] [Any OS ▼]     Found 11 devices       │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ● homeserver.tail-abc123.ts.net                    │ │
│ │   100.64.0.1 | linux | Online                      │ │
│ │   Last seen: 2 minutes ago              [Import]   │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ● mediaserver.tail-abc123.ts.net                   │ │
│ │   100.64.0.2 | linux | Online                      │ │
│ │   Last seen: 1 minute ago               [Import]   │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ○ studypc.tail-abc123.ts.net                       │ │
│ │   100.64.0.10 | linux | Offline                    │ │
│ │   Last seen: 3 hours ago                [Import]   │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**States:**
- **Loading:** "Discovering devices..." with spinner
- **No token:** Message with link to Settings
- **Empty:** "No devices found in your tailnet"
- **Error:** Red alert with error message and retry button
- **Cached:** Subtle indicator "Cached 2m ago" near Refresh button

## Technical Notes

### API Contracts

**GET /api/v1/tailscale/devices**

Query Parameters:
- `online` (bool, optional): Filter by online status
- `os` (string, optional): Filter by OS (linux, windows, macos, ios, android)
- `refresh` (bool, optional): Bypass cache if true

Response 200:
```json
{
  "devices": [
    {
      "id": "device-abc123",
      "name": "homeserver",
      "hostname": "homeserver.tail-abc123.ts.net",
      "tailscale_ip": "100.64.0.1",
      "os": "linux",
      "os_version": "Ubuntu 24.04",
      "last_seen": "2026-01-26T10:30:00Z",
      "online": true,
      "authorized": true,
      "already_imported": false
    }
  ],
  "count": 11,
  "cache_hit": true,
  "cached_at": "2026-01-26T10:28:00Z"
}
```

Response 401 (no token):
```json
{
  "detail": {
    "code": "TAILSCALE_NOT_CONFIGURED",
    "message": "Tailscale API token not configured"
  }
}
```

Response 503 (API error):
```json
{
  "detail": {
    "code": "TAILSCALE_API_ERROR",
    "message": "Could not fetch devices from Tailscale API"
  }
}
```

### Data Requirements

No new database tables. Uses in-memory cache:

```python
from datetime import datetime, timedelta
from typing import Optional

class TailscaleCache:
    _devices: list[dict] | None = None
    _cached_at: datetime | None = None
    TTL = timedelta(minutes=5)

    def get(self) -> tuple[list[dict] | None, bool]:
        """Return (devices, cache_hit). None if cache expired/empty."""
        if self._devices and self._cached_at:
            if datetime.utcnow() - self._cached_at < self.TTL:
                return self._devices, True
        return None, False

    def set(self, devices: list[dict]) -> None:
        self._devices = devices
        self._cached_at = datetime.utcnow()

    def invalidate(self) -> None:
        self._devices = None
        self._cached_at = None
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No Tailscale token configured | Return 401 with message to configure token in Settings |
| Tailscale API returns 401 | Return 401: "Tailscale token invalid or expired" |
| Tailscale API returns 429 | Return 503: "Tailscale API rate limited, try again in {seconds}s" |
| Tailscale API timeout | Return 503: "Tailscale API timed out" |
| Tailscale API returns empty list | Return 200 with empty devices array |
| Filter returns no results | Return 200 with empty devices array |
| Invalid OS filter value | Ignore filter, return all devices |
| Cache expired during request | Fetch fresh data, update cache |
| Device already imported as machine | Include `already_imported: true` flag |

## Test Scenarios

- [ ] Device list endpoint returns all Tailscale devices
- [ ] Devices sorted alphabetically by name
- [ ] Filter by online status (true/false)
- [ ] Filter by OS type
- [ ] Combined filters work correctly
- [ ] Results cached for 5 minutes
- [ ] Cache hit returns cached_at timestamp
- [ ] Refresh parameter bypasses cache
- [ ] 401 returned when no token configured
- [ ] 503 returned on Tailscale API error
- [ ] Empty device list handled gracefully
- [ ] Already imported devices flagged

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0077-01 | Device list returns devices | AC1 | Integration | Pending |
| TC-US0077-02 | Devices sorted by name | AC1 | Unit | Pending |
| TC-US0077-03 | Filter by online status | AC2 | Unit | Pending |
| TC-US0077-04 | Filter by OS type | AC2 | Unit | Pending |
| TC-US0077-05 | Cache hit within 5 minutes | AC3 | Unit | Pending |
| TC-US0077-06 | Cache bypass with refresh | AC3 | Unit | Pending |
| TC-US0077-07 | No token returns 401 | AC5 | Unit | Pending |
| TC-US0077-08 | API error returns 503 | AC1 | Unit | Pending |
| TC-US0077-09 | Empty list handled | AC5 | Unit | Pending |
| TC-US0077-10 | Already imported flag | AC1 | Integration | Pending |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0076](US0076-tailscale-api-client.md) | Service | Tailscale API client | Done |
| [US0081](US0081-credential-encryption-storage.md) | Service | Token retrieval | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| credentials | [US0081](US0081-credential-encryption-storage.md) | tailscale_token |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| Tailscale API client | [US0076](US0076-tailscale-api-client.md) | Fetch device list |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Tailscale API | External service | Available |

> **Note:** All story dependencies are Done (US0076, US0081).

## Estimation

**Story Points:** 5

**Complexity:** Medium - API endpoint with caching and UI

## Open Questions

None.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 9/8 minimum documented
- [x] Test scenarios: 12/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language (avoid: "handles errors", "returns data", "works correctly")
- [x] Open Questions: 0/0 resolved (critical must be resolved)
- [x] Given/When/Then uses concrete values, not placeholders
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met (API stories)
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented (not just happy path)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Claude | Initial story creation from EP0008 |
| 2026-01-26 | Claude | Implementation plan created (PL0078), status → Planned |
| 2026-01-26 | Claude | Implementation complete, 52 tests passing, status → Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
