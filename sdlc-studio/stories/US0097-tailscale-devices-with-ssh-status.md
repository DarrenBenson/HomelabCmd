# US0097: Tailscale Device List with SSH Status

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** System Administrator
**I want** Tailscale device discovery to show SSH availability
**So that** I can see which devices are ready for agent installation

## Context

### Persona Reference
**System Administrator** - Needs visibility into device SSH status before attempting operations.
[Full persona details](../personas.md#system-administrator)

### Background
Tailscale shows device online status, but SSH availability is more important for agent deployment. This endpoint tests SSH in parallel for all online devices and returns the results with cached support.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| PRD | Performance | SSH testing <10s per device | Parallel testing required |
| TRD | Architecture | 5-minute cache TTL | Avoid repeated tests |
| Epic | UX | Show true availability | SSH status must be accurate |

---

## Acceptance Criteria

### AC1: New endpoint with SSH status
- **Given** `GET /api/v1/tailscale/devices/with-ssh`
- **When** called with default parameters
- **Then** SSH is tested for all online devices
- **And** each device includes `ssh_status`, `ssh_error`, `ssh_key_used` fields

### AC2: SSH status values
- **Given** a device in the response
- **When** the device is returned
- **Then** `ssh_status` is one of:
  - `"available"` - SSH connection succeeded
  - `"unavailable"` - SSH connection failed or device offline
  - `"untested"` - SSH not tested (test_ssh=false)

### AC3: Offline device handling
- **Given** a device is offline on Tailscale
- **When** included in the response
- **Then** `ssh_status` is `"unavailable"`
- **And** `ssh_error` is `"Offline - last seen {relative_time}"` (e.g., "Offline - last seen 2h ago")

### AC4: Online device SSH failure
- **Given** a device is online but SSH fails
- **When** included in the response
- **Then** `ssh_status` is `"unavailable"`
- **And** `ssh_error` contains the failure reason (e.g., "Permission denied (publickey)")

### AC5: Parallel SSH testing
- **Given** multiple devices are online
- **When** SSH testing is performed
- **Then** tests run in parallel using asyncio.gather
- **And** each test has a 10 second timeout
- **And** total time is approximately max(individual times), not sum

### AC6: SSH status caching
- **Given** SSH status for a device
- **When** the same device is requested within 5 minutes
- **Then** the cached SSH status is returned
- **And** no new SSH connection is attempted

### AC7: Refresh parameter bypasses cache
- **Given** `refresh=true` parameter
- **When** the endpoint is called
- **Then** both device cache and SSH cache are bypassed
- **And** fresh SSH tests are performed

### AC8: test_ssh parameter control
- **Given** `test_ssh=false` parameter
- **When** the endpoint is called
- **Then** no SSH tests are performed
- **And** all devices have `ssh_status: "untested"`

---

## Scope

### In Scope
- New endpoint `GET /api/v1/tailscale/devices/with-ssh`
- Extended device schema with SSH fields
- Parallel SSH testing with asyncio
- 5-minute in-memory SSH status cache
- Relative time formatting for offline devices
- Filter parameters (online, os)

### Out of Scope
- Frontend integration (US0101)
- Individual device SSH testing (US0096 provides this)

---

## Technical Notes

### Implementation File
`backend/src/homelab_cmd/api/routes/tailscale.py`

### API Contract

**Request:**
```http
GET /api/v1/tailscale/devices/with-ssh?test_ssh=true&refresh=false&online=true&os=linux
X-API-Key: <api_key>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| test_ssh | bool | true | Whether to test SSH connectivity |
| refresh | bool | false | Bypass both caches |
| online | bool | null | Filter by online status |
| os | string | null | Filter by OS type |

**Response:**
```json
{
  "devices": [
    {
      "id": "device-123",
      "name": "server1",
      "hostname": "server1.tailnet.ts.net",
      "tailscale_ip": "100.64.1.1",
      "os": "linux",
      "os_version": "1.62.1",
      "last_seen": "2026-01-28T10:00:00Z",
      "online": true,
      "authorized": true,
      "already_imported": false,
      "ssh_status": "available",
      "ssh_error": null,
      "ssh_key_used": "homelab-key"
    }
  ],
  "count": 1,
  "cache_hit": false,
  "cached_at": null
}
```

### Schema Definitions
```python
class TailscaleDeviceWithSSHSchema(TailscaleDeviceSchema):
    ssh_status: Literal["available", "unavailable", "untested"] = "untested"
    ssh_error: str | None = None
    ssh_key_used: str | None = None

class TailscaleDeviceListWithSSHResponse(BaseModel):
    devices: list[TailscaleDeviceWithSSHSchema]
    count: int
    cache_hit: bool
    cached_at: datetime | None
```

### Caching Implementation
```python
# In-memory cache with 5-minute TTL
_ssh_status_cache: dict[str, tuple[str, str | None, str | None, datetime]] = {}
SSH_CACHE_TTL = timedelta(minutes=5)
```

### Relative Time Formatting
```python
def _format_relative_time(dt: datetime) -> str:
    diff = datetime.now(UTC) - dt
    diff_mins = int(diff.total_seconds() / 60)
    diff_hours = diff_mins // 60
    diff_days = diff_hours // 24

    if diff_mins < 1: return "just now"
    if diff_mins < 60: return f"{diff_mins}m ago"
    if diff_hours < 24: return f"{diff_hours}h ago"
    return f"{diff_days}d ago"
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No SSH keys configured | All online devices marked unavailable: "No SSH keys configured" |
| SSH exception during parallel test | Device gets ssh_status: "unavailable", error captured |
| Device cache miss, SSH cache hit | Return cached SSH status for that device |
| All devices offline | All marked unavailable with "Offline - last seen X ago" |
| Empty device list | Return empty array, count: 0 |
| Tailscale not configured | HTTP 401 |
| Invalid API token | HTTP 401 |

---

## Test Scenarios

- [ ] Endpoint requires authentication
- [ ] Online devices get SSH tested
- [ ] Offline devices marked unavailable with last seen
- [ ] ssh_status reflects actual SSH result
- [ ] ssh_error populated on failure
- [ ] ssh_key_used populated on success
- [ ] Parallel testing completes in reasonable time
- [ ] Cache returns same results within 5 minutes
- [ ] refresh=true bypasses cache
- [ ] test_ssh=false skips SSH testing

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0096](US0096-ssh-test-endpoint-tailscale.md) | Function | _test_ssh_for_device helper | Done |
| [US0076](US0076-tailscale-api-client.md) | Service | TailscaleService | Done |
| [US0077](US0077-tailscale-device-discovery.md) | Schema | TailscaleDeviceSchema | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| asyncio | Standard library | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Parallel async, caching logic

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
