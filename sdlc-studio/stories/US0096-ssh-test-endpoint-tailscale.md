# US0096: SSH Test Endpoint for Tailscale Devices

> **Status:** Done
> **Epic:** [EP0016: Unified Discovery Experience](../epics/EP0016-unified-discovery.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** System Administrator
**I want** the hub to test SSH connectivity to Tailscale devices
**So that** I know which devices are truly reachable before attempting agent install

## Context

### Persona Reference
**System Administrator** - Needs to verify SSH access before deployment operations.
[Full persona details](../personas.md#system-administrator)

### Background
Tailscale shows devices as "online" based on its network status, but this doesn't guarantee SSH connectivity. A device may be online on the Tailscale network but have SSH disabled, firewall rules blocking port 22, or no matching SSH keys configured.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| PRD | Performance | SSH testing <10s per device | 10 second timeout |
| TRD | Architecture | Use SSHPooledExecutor | Leverage existing SSH infrastructure |
| Epic | Security | Keys stored encrypted | Use credential service |

---

## Acceptance Criteria

### AC1: SSH test endpoint exists
- **Given** `POST /api/v1/tailscale/devices/{device_id}/test-ssh`
- **When** called with a valid Tailscale device ID
- **Then** SSH connection is tested to the device's Tailscale hostname
- **And** the response includes success status

### AC2: Successful SSH test response
- **Given** SSH test succeeds
- **When** the response is returned
- **Then** it includes:
  - `success: true`
  - `latency_ms: <connection time in milliseconds>`
  - `key_used: <name of SSH key that succeeded>`
  - `error: null`

### AC3: Failed SSH test response
- **Given** SSH test fails
- **When** the response is returned
- **Then** it includes:
  - `success: false`
  - `latency_ms: null`
  - `key_used: null`
  - `error: <specific error message>` (e.g., "Permission denied", "Connection refused", "Connection timeout")

### AC4: Specific key testing
- **Given** a `key_id` is provided in the request body
- **When** testing SSH
- **Then** only that specific key is tested
- **And** other configured keys are not tried

### AC5: All keys testing (default)
- **Given** no `key_id` is provided
- **When** testing SSH
- **Then** all configured SSH keys are tried in sequence
- **And** the first successful key is reported

### AC6: Offline device handling
- **Given** the device is offline on Tailscale
- **When** SSH test is attempted
- **Then** the connection times out within 10 seconds
- **And** returns `success: false`, `error: "Connection timeout"`

### AC7: Device not found handling
- **Given** an invalid device ID
- **When** the endpoint is called
- **Then** HTTP 404 is returned
- **And** error includes `code: "DEVICE_NOT_FOUND"`

---

## Scope

### In Scope
- New API endpoint `POST /api/v1/tailscale/devices/{device_id}/test-ssh`
- Request schema `TailscaleSSHTestRequest` (optional key_id)
- Response schema `TailscaleSSHTestResponse`
- Integration with SSHPooledExecutor
- 10 second connection timeout
- Device lookup via Tailscale service

### Out of Scope
- Parallel testing of multiple devices (US0097)
- SSH status caching (US0097)
- Frontend integration

---

## Technical Notes

### Implementation File
`backend/src/homelab_cmd/api/routes/tailscale.py`

### API Contract

**Request:**
```http
POST /api/v1/tailscale/devices/{device_id}/test-ssh
Content-Type: application/json
X-API-Key: <api_key>

{
  "key_id": "optional-key-id"
}
```

**Response (Success):**
```json
{
  "success": true,
  "latency_ms": 145,
  "key_used": "homelab-key",
  "error": null
}
```

**Response (Failure):**
```json
{
  "success": false,
  "latency_ms": null,
  "key_used": null,
  "error": "Permission denied (publickey)"
}
```

### Schema Definitions
```python
class TailscaleSSHTestRequest(BaseModel):
    key_id: str | None = Field(None, description="Specific SSH key ID to test")

class TailscaleSSHTestResponse(BaseModel):
    success: bool
    latency_ms: int | None = None
    key_used: str | None = None
    error: str | None = None
```

### Data Requirements
- Device lookup from Tailscale API (cached)
- SSH key retrieval from credential service
- SSH connection test via SSHPooledExecutor

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No SSH keys configured | Return `success: false`, `error: "No SSH keys configured"` |
| Tailscale not configured | HTTP 401, `code: "TAILSCALE_NOT_CONFIGURED"` |
| Invalid Tailscale token | HTTP 401, `code: "TAILSCALE_AUTH_ERROR"` |
| Device ID not found | HTTP 404, `code: "DEVICE_NOT_FOUND"` |
| SSH connection timeout (10s) | `success: false`, `error: "Connection timeout"` |
| SSH authentication failure | `success: false`, `error: "Permission denied (publickey)"` |
| SSH connection refused | `success: false`, `error: "Connection refused"` |
| Specified key_id not found | `success: false`, `error: "SSH key not found"` |

---

## Test Scenarios

- [ ] Endpoint requires authentication
- [ ] Valid device returns success/failure based on SSH
- [ ] latency_ms populated on success
- [ ] key_used populated on success
- [ ] error populated on failure
- [ ] 404 returned for invalid device_id
- [ ] Specific key_id parameter is respected
- [ ] All keys tried when no key_id specified

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0076](US0076-tailscale-api-client.md) | Service | TailscaleService.get_devices_cached | Done |
| [US0079](US0079-ssh-connection-tailscale.md) | Service | SSHPooledExecutor | Done |
| [US0081](US0081-credential-encryption-storage.md) | Service | Credential service | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| asyncssh | Library | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Standard API endpoint

---

## Open Questions

None - implementation complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Story extracted from implementation (brownfield) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
