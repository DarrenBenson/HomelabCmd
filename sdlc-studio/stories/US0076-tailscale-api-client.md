# US0076: Tailscale API Client Integration

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-26
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** HomelabCmd to integrate with Tailscale API
**So that** I can discover all devices on my tailnet automatically without manual configuration

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers connected via Tailscale mesh network. Wants to leverage existing Tailscale infrastructure for device discovery instead of manual IP configuration or network scanning.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Tailscale provides a REST API that allows querying the control plane for all devices in a tailnet. By integrating with this API, HomelabCmd can automatically discover all machines without requiring manual registration or network scanning. This is the foundation for the v2.0 Tailscale-native connectivity model.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | API token stored encrypted | Depends on US0081 for credential storage |
| Performance | Cache results for 5 minutes | Avoid excessive API calls |
| Risk | Tailscale API rate limiting | Must implement backoff |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | API response < 500ms (p95) | Connection timeout must be bounded |
| Security | API key authentication | Token stored securely |
| UX | Minimal maintenance | Auto-discovery reduces manual work |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Tailscale API client implementation

- **Given** a valid Tailscale API token is configured
- **When** the client calls the Tailscale API
- **Then** it uses `httpx` async client with base URL `https://api.tailscale.com/api/v2/`
- **And** authentication header is `Authorization: Bearer {token}`
- **And** connection timeout is 10 seconds
- **And** read timeout is 30 seconds

### AC2: API token configuration via settings

- **Given** I navigate to Settings > Connectivity
- **When** I enter a Tailscale API token and click "Save"
- **Then** the token is stored encrypted in the database (via US0081)
- **And** the token input field shows masked value `sk-tail-***...`
- **And** a success message confirms "Tailscale token saved"

### AC3: Test connection validates token

- **Given** a Tailscale API token is configured
- **When** I click "Test Connection" button
- **Then** the system calls `GET /api/v2/tailnet/-/devices` to validate
- **And** on success: shows "✓ Connected to tailnet: {tailnet_name}"
- **And** on success: shows "✓ {count} devices discovered"
- **And** on 401 error: shows "✗ Invalid API token"
- **And** on network error: shows "✗ Could not connect to Tailscale API"

### AC4: Error handling for API failures

- **Given** the Tailscale API client is making requests
- **When** various error conditions occur
- **Then** appropriate errors are returned:
  - 401 Unauthorized → `TailscaleAuthError: Invalid API token`
  - 403 Forbidden → `TailscaleAuthError: Token lacks required permissions`
  - 429 Too Many Requests → `TailscaleRateLimitError: Rate limit exceeded, retry after {seconds}s`
  - Connection timeout → `TailscaleConnectionError: Connection timed out after 10s`
  - Network unreachable → `TailscaleConnectionError: Could not reach Tailscale API`

### AC5: Rate limiting respected

- **Given** the Tailscale API returns 429 with `Retry-After` header
- **When** the client receives this response
- **Then** it raises `TailscaleRateLimitError` with retry delay
- **And** subsequent calls respect the backoff period
- **And** the UI shows "Rate limited. Please wait {seconds}s before retrying."

## Scope

### In Scope

- Async HTTP client for Tailscale API using `httpx`
- Token storage and retrieval via credential service (US0081)
- Settings UI for token configuration
- Test connection endpoint and UI button
- Error handling for all Tailscale API responses
- Rate limit handling with backoff

### Out of Scope

- Device listing endpoint (US0077)
- Device import functionality (US0078)
- Automatic token refresh (Tailscale tokens don't expire)
- Multi-tailnet support

## UI/UX Requirements

**Settings > Connectivity Section:**

```
┌────────────────────────────────────────────────┐
│ Tailscale Configuration                         │
├────────────────────────────────────────────────┤
│                                                │
│ API Token: *                                   │
│ ┌──────────────────────────────────┐           │
│ │ sk-tail-*********************... │ [Test]   │
│ └──────────────────────────────────┘           │
│                                                │
│ ✓ Connected to tailnet: darren-homelab        │
│ ✓ 11 devices discovered                        │
│                                                │
│ [Save Token]  [Remove Token]                   │
│                                                │
└────────────────────────────────────────────────┘
```

**States:**
- **No token:** Empty input, "Test" button disabled
- **Token entered:** Input shows masked value, "Test" and "Save" enabled
- **Testing:** "Test" shows spinner, buttons disabled
- **Success:** Green checkmarks with tailnet name and device count
- **Error:** Red X with specific error message

## Technical Notes

### API Contracts

**POST /api/v1/settings/tailscale/token**

Request:
```json
{
  "token": "tskey-api-abc123-NOTREAL"
}
```

Response 200:
```json
{
  "success": true,
  "message": "Tailscale token saved"
}
```

Response 400 (empty token):
```json
{
  "detail": {
    "code": "INVALID_TOKEN",
    "message": "Token cannot be empty"
  }
}
```

**POST /api/v1/settings/tailscale/test**

Request: (no body - uses stored token)

Response 200:
```json
{
  "success": true,
  "tailnet": "darren-homelab.github",
  "device_count": 11,
  "message": "Connected to tailnet: darren-homelab.github"
}
```

Response 401:
```json
{
  "success": false,
  "error": "Invalid API token",
  "code": "TAILSCALE_AUTH_ERROR"
}
```

Response 503:
```json
{
  "success": false,
  "error": "Could not connect to Tailscale API",
  "code": "TAILSCALE_CONNECTION_ERROR"
}
```

**DELETE /api/v1/settings/tailscale/token**

Response 200:
```json
{
  "success": true,
  "message": "Tailscale token removed"
}
```

### Data Requirements

No new database tables. Uses `credentials` table from US0081:

```sql
INSERT INTO credentials (id, credential_type, encrypted_value)
VALUES (uuid(), 'tailscale_token', '{encrypted_token}');
```

### Tailscale API Reference

**GET /api/v2/tailnet/-/devices**

Response:
```json
{
  "devices": [
    {
      "id": "12345",
      "name": "homeserver",
      "hostname": "homeserver.tail-abc123.ts.net",
      "addresses": ["100.64.0.1", "fd7a:115c:a1e0::1"],
      "os": "linux",
      "clientVersion": "1.56.1",
      "lastSeen": "2026-01-25T20:00:00Z",
      "online": true,
      "authorized": true
    }
  ]
}
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Token is empty string | Reject with 400: `Token cannot be empty` |
| Token has invalid format | Accept (Tailscale API will return 401) |
| Tailscale API returns 401 | Show "Invalid API token" - token may be revoked |
| Tailscale API returns 403 | Show "Token lacks required permissions" - needs `devices:read` |
| Tailscale API returns 429 | Show "Rate limited" with retry delay from header |
| Tailscale API connection timeout | Show "Connection timed out" - network or firewall issue |
| Tailscale API unreachable | Show "Could not connect" - DNS or network failure |
| Token removed while test in progress | Test fails gracefully, shows "No token configured" |
| Concurrent token updates | Last write wins, no race condition on read |

## Test Scenarios

- [ ] Save valid Tailscale token stores encrypted value
- [ ] Save empty token rejected with 400
- [ ] Test connection with valid token succeeds
- [ ] Test connection with invalid token returns 401 error
- [ ] Test connection with no token configured returns appropriate error
- [ ] Test connection timeout after 10 seconds
- [ ] Rate limit response handled with retry delay
- [ ] Token masked in UI (shows sk-tail-***...)
- [ ] Remove token deletes from credential store
- [ ] Connection error handled gracefully
- [ ] Tailnet name extracted from API response
- [ ] Device count returned in test response

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0076-01 | Save valid token | AC2 | Integration | Pending |
| TC-US0076-02 | Reject empty token | AC2 | Unit | Pending |
| TC-US0076-03 | Test connection success | AC3 | Integration | Pending |
| TC-US0076-04 | Test connection 401 error | AC4 | Unit | Pending |
| TC-US0076-05 | Test connection 403 error | AC4 | Unit | Pending |
| TC-US0076-06 | Test connection timeout | AC4 | Unit | Pending |
| TC-US0076-07 | Rate limit handling | AC5 | Unit | Pending |
| TC-US0076-08 | HTTP client configuration | AC1 | Unit | Pending |
| TC-US0076-09 | Token masked in response | AC2 | Unit | Pending |
| TC-US0076-10 | Remove token | AC2 | Integration | Pending |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0081](US0081-credential-encryption-storage.md) | Service | Credential encryption service | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| credentials | [US0081](US0081-credential-encryption-storage.md) | credential_type, encrypted_value |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| None | - | First Tailscale endpoint |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Tailscale API | External service | Available |
| httpx | Python library | Already installed |
| Tailscale account with API token | User requirement | User must provide |

> **Note:** This story depends on US0081 which is Done.

## Estimation

**Story Points:** 5

**Complexity:** Medium - External API integration with error handling

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
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
