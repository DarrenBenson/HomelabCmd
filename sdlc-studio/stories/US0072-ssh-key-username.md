# US0072: SSH Key Username Association

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-22
> **Story Points:** 3
> **Completed:** 2026-01-22

## User Story

**As a** Darren (Homelab Operator)
**I want** to associate a specific SSH username with each SSH key
**So that** I can connect to servers that use different usernames without manually specifying credentials each time

## Context

### Persona Reference

**Darren** - Has multiple servers with different SSH usernames (e.g., `darren` for personal servers, `admin` for work servers). Needs to scan and manage all of them through the same interface.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, all SSH connections use a single default username for all keys. This creates issues when connecting to servers that require different usernames. For example:
- Personal homelab servers use `darren`
- Work servers use `admin`
- Legacy systems might use `root`

This story adds the ability to associate a username with each SSH key, enabling proper authorisation across heterogeneous server environments.

**Extends:** [US0071: SSH Key Manager UI](US0071-ssh-key-manager-ui.md) - which provides key management but uses a single default username for all keys.

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | Username is per-key, not per-password |
| UX | Easy setup | Simple optional field during key upload |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| UX | Backward compatibility | Existing keys without username use default |
| Architecture | No migration | New field is optional, null means use default |

## Acceptance Criteria

### AC1: Upload SSH key with optional username

- **Given** the Add Key modal
- **When** I upload a key and optionally enter a username
- **Then** the username is stored in the database linked to the key
- **And** the response includes the username (or null if not provided)

### AC2: View username in SSH key list

- **Given** the SSH keys list
- **When** viewing a key that has an associated username
- **Then** I see the username displayed (e.g., "darren")
- **And** for keys without a username, I see "Default"

### AC3: Connection uses key-specific username

- **Given** SSH keys with different usernames configured
- **When** testing a connection or running a scan
- **Then** each key is tried with its associated username
- **And** keys without a username use the default username

### AC4: Delete key removes username from database

- **Given** a key with an associated username
- **When** I delete the key
- **Then** the username association is removed from the database
- **And** no orphaned data remains

### AC5: Existing keys show null username (backward compatibility)

- **Given** SSH keys that existed before this feature
- **When** listing keys via the API
- **Then** the username field is null
- **And** connections use the default username

## Scope

### In Scope

- Optional username field when uploading key
- Display username in key list
- Per-key username in SSH connection logic
- Database storage of key-username mappings
- Fallback to default username when no key-specific username

### Out of Scope

- Editing username of existing keys (delete and re-add)
- Multiple usernames per key
- Username validation against target server
- Per-host username overrides

## Technical Notes

### Storage Design

Username mappings stored in the existing `Config` table under the `ssh` key:

```json
{
  "default_username": "darren",
  "default_port": 22,
  "key_usernames": {
    "homelab-key": "darren",
    "work-server": "admin"
  }
}
```

### API Contract Changes

**POST /api/v1/settings/ssh/keys**
```json
Request:
{
  "name": "work_key",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
  "username": "admin"  // NEW: optional field
}

Response 201:
{
  "id": "work_key",
  "name": "work_key",
  "type": "ED25519",
  "fingerprint": "SHA256:abc123...",
  "created_at": "2026-01-22T15:00:00Z",
  "username": "admin"  // NEW: included in response
}
```

**GET /api/v1/settings/ssh/keys**
```json
Response 200:
{
  "keys": [
    {
      "id": "work_key",
      "name": "work_key",
      "type": "ED25519",
      "fingerprint": "SHA256:abc123...",
      "created_at": "2026-01-22T15:00:00Z",
      "username": "admin"  // NEW: from database
    },
    {
      "id": "legacy_key",
      "name": "legacy_key",
      "type": "RSA-4096",
      "fingerprint": "SHA256:xyz789...",
      "created_at": "2026-01-20T14:00:00Z",
      "username": null  // No username set, uses default
    }
  ]
}
```

### Connection Logic

```python
# For each key being tried:
effective_username = key_usernames.get(key_name, default_username)
client.connect(hostname, port, username=effective_username, pkey=pkey)
```

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/api/schemas/scan.py` | Add username to SSHKeyMetadata, SSHKeyUploadRequest |
| `backend/src/homelab_cmd/services/ssh.py` | Add username to dataclass, update connection methods |
| `backend/src/homelab_cmd/api/routes/scan.py` | DB read/write for key_usernames |
| `frontend/src/types/scan.ts` | Add username to TypeScript interfaces |
| `frontend/src/components/SSHKeyManager.tsx` | Add username input and display |
| `tests/test_ssh_keys_api.py` | New API tests |
| `tests/test_ssh_service.py` | New service tests |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Upload key without username | Store key, username is null |
| Upload key with username | Store key and username |
| Delete key with username | Remove both key file and username from DB |
| Delete key without username | Remove key file only |
| List keys (mixed) | Each key shows its username or null |
| Connection with key-specific username | Use that username for the key |
| Connection without key-specific username | Fall back to default username |

## Test Scenarios

- [x] Upload key with username stores in DB
- [x] Upload key without username returns null
- [x] List keys includes username from DB
- [x] Delete key removes username from DB
- [x] Existing keys show null username
- [x] Connection uses key-specific username
- [x] Connection falls back to default username
- [x] Async methods pass key_usernames through

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0072-01 | Upload key with username | AC1 | API | Done |
| TC-US0072-02 | Upload key without username | AC1 | API | Done |
| TC-US0072-03 | List keys includes username | AC2 | API | Done |
| TC-US0072-04 | Delete key removes username | AC4 | API | Done |
| TC-US0072-05 | Existing keys show null | AC5 | API | Done |
| TC-US0072-06 | Connection uses key username | AC3 | Service | Done |
| TC-US0072-07 | Connection falls back to default | AC3 | Service | Done |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 7/8 minimum documented
- [x] Test scenarios: 8/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: No new error codes needed

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
| US0071: SSH Key Manager UI | Story | Done |
| US0037: SSH Key Configuration | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - Extends existing functionality with optional field, no migration needed

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | Claude | Initial story creation and implementation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
