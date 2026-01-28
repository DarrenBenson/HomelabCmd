# US0073: Network Discovery Key Selection

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-22
> **Story Points:** 3
> **Completed:** 2026-01-22

## User Story

**As a** Darren (Homelab Operator)
**I want** to select which SSH key to use for network discovery scans
**So that** I can control which credentials are tried and use the correct key for different network segments

## Context

### Persona Reference

**Darren** - Has multiple SSH keys for different purposes (homelab, work servers). Wants to avoid trying work keys on homelab devices and vice versa. Needs faster, more targeted discovery scans.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, network discovery tries ALL configured SSH keys automatically for each discovered IP. While this works, it has limitations:

1. **Security concern**: Work keys are tried on homelab devices (and vice versa)
2. **Performance**: Trying multiple keys adds latency to discovery
3. **Clarity**: No way to know which key succeeded without checking logs

With per-key username associations (US0072), each key can have its own username. Adding key selection allows users to target specific keys for specific scans.

**Extends:** [US0041: Network Discovery](US0041-network-discovery.md) and [US0072: SSH Key Username Association](US0072-ssh-key-username.md)

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | Key selection maintains security model |
| UX | Easy setup | Dropdown with sensible default |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| UX | Backward compatibility | "Attempt all keys" as default option |
| Performance | LAN-only scanning | Key selection reduces auth attempts |

## Acceptance Criteria

### AC1: Key selector dropdown in discovery UI

- **Given** the Network Discovery page with SSH keys configured
- **When** I view the discovery controls
- **Then** I see a dropdown labelled "SSH Key"
- **And** the dropdown contains "Attempt all keys" as the first option
- **And** the dropdown lists each configured key by name with its username (e.g., "homelab-key (darren)")
- **And** "Attempt all keys" is selected by default

### AC2: Discovery uses selected key only

- **Given** I have selected a specific key "homelab-key" from the dropdown
- **When** I click "Discover Now"
- **Then** the discovery only tries "homelab-key" for SSH authentication
- **And** the key's associated username is used (from US0072)
- **And** other keys are NOT tried

### AC3: "Attempt all keys" tries all keys

- **Given** I have selected "Attempt all keys" from the dropdown
- **When** I click "Discover Now"
- **Then** discovery tries all configured keys in order
- **And** each key uses its associated username (current behaviour)

### AC4: API accepts optional key_id parameter

- **Given** the discovery API endpoint `POST /discovery`
- **When** I include `{"key_id": "homelab-key"}` in the request
- **Then** discovery only uses the specified key
- **And** returns 400 if the key_id doesn't exist

### AC5: Discovery results show which key succeeded

- **Given** a discovery scan completes with SSH authentication successful
- **When** I view the discovery results
- **Then** I see which key was used for successful authentication
- **And** the format shows "Authenticated with: homelab-key"

## Scope

### In Scope

- Key selector dropdown in NetworkDiscovery component
- API parameter for key selection
- Filter discovery to single key when specified
- Display which key succeeded in results
- Backward compatible default ("Attempt all keys")

### Out of Scope

- Multi-select (choosing subset of keys)
- Per-IP key assignment
- Key rotation during discovery
- Saving key preference for subnet

## UI/UX Requirements

### Key Selector Dropdown

```
┌─────────────────────────────────────┐
│ SSH Key                             │
│ ┌─────────────────────────────────┐ │
│ │ Attempt all keys            ▼  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Options:                            │
│ - Attempt all keys                  │
│ - homelab-key (darren)              │
│ - work-server (admin)               │
│ - legacy-key (Default)              │
└─────────────────────────────────────┘
```

### Discovery Results Enhancement

```
┌─────────────────────────────────────────────────────────┐
│ 192.168.1.100                                           │
│ Hostname: mediaserver                                   │
│ SSH: ✓ Authenticated with: homelab-key                  │
│ [Install Agent] [Scan]                                  │
└─────────────────────────────────────────────────────────┘
```

## Technical Notes

### API Contract Changes

**POST /api/v1/discovery**
```json
Request (new optional field):
{
  "subnet": "192.168.1.0/24",
  "key_id": "homelab-key"  // NEW: optional, null means all keys
}

Response 200 (unchanged):
{
  "discovery_id": "abc123",
  "status": "running"
}

Response 400 (new error):
{
  "detail": "SSH key 'nonexistent' not found"
}
```

**GET /api/v1/discovery/{id}**
```json
Response 200 (enhanced):
{
  "discovery_id": "abc123",
  "status": "complete",
  "results": [
    {
      "ip": "192.168.1.100",
      "hostname": "mediaserver",
      "ssh_auth": true,
      "ssh_key_used": "homelab-key",  // NEW: which key succeeded
      "is_monitored": false
    }
  ]
}
```

### Backend Changes

1. **Schema** (`backend/src/homelab_cmd/api/schemas/discovery.py`):
   - Add `key_id: str | None` to `DiscoveryRequest`
   - Add `ssh_key_used: str | None` to `DiscoveryResult`

2. **Service** (`backend/src/homelab_cmd/services/discovery.py`):
   - Modify `test_ssh_auth()` to accept optional `key_id`
   - When `key_id` provided, only load and try that key
   - Track which key succeeded in result

3. **Routes** (`backend/src/homelab_cmd/api/routes/discovery.py`):
   - Validate `key_id` exists before starting discovery
   - Pass `key_id` to service

### Frontend Changes

1. **Types** (`frontend/src/types/discovery.ts`):
   - Add `key_id?: string` to `DiscoveryRequest`
   - Add `ssh_key_used?: string` to `DiscoveryResult`

2. **Component** (`frontend/src/components/NetworkDiscovery.tsx`):
   - Add key selector dropdown
   - Load available keys from `/settings/ssh/keys`
   - Format options with key name and username
   - Pass selected key to discovery API
   - Display `ssh_key_used` in results

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No SSH keys configured | Dropdown disabled, shows "No keys configured" |
| Selected key deleted mid-discovery | Discovery continues, returns error for that key |
| Invalid key_id in API request | 400 Bad Request: "SSH key 'x' not found" |
| Key_id is empty string | Treat as null (attempt all keys) |
| Single key configured | Still show dropdown with "Attempt all keys" option |
| All keys fail auth | Show "Authentication failed" (no change from current) |
| Selected key has no username | Use default username (fallback from US0072) |
| Discovery with key succeeds | Show key name in results |

## Test Scenarios

- [x] Dropdown shows "Attempt all keys" as default
- [x] Dropdown lists all configured keys with usernames
- [x] Selecting specific key only tries that key
- [x] "Attempt all keys" tries all keys (backward compat)
- [x] API rejects invalid key_id with 400
- [x] API accepts null/missing key_id (all keys)
- [x] Results show which key was used
- [x] Dropdown disabled when no keys configured
- [x] Key with no username uses default username
- [x] Discovery faster with single key selected

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0073-01 | Dropdown shows all keys option first | AC1 | UI | Done |
| TC-US0073-02 | Dropdown lists keys with usernames | AC1 | UI | Done |
| TC-US0073-03 | Discovery uses only selected key | AC2 | Integration | Done |
| TC-US0073-04 | All keys option tries all keys | AC3 | Integration | Done |
| TC-US0073-05 | API validates key_id exists | AC4 | API | Done |
| TC-US0073-06 | API accepts null key_id | AC4 | API | Done |
| TC-US0073-07 | Results show key used | AC5 | API | Done |
| TC-US0073-08 | Invalid key_id returns 400 | AC4 | API | Done |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 10/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
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
| US0041: Network Discovery | Story | Done |
| US0071: SSH Key Manager UI | Story | Done |
| US0072: SSH Key Username Association | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - Frontend dropdown, API parameter, service filter logic

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | Claude | Initial story creation |
| 2026-01-22 | Claude | Implementation complete |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
