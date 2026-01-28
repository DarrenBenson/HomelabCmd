# US0071: SSH Key Manager UI

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-22
> **Story Points:** 5
> **Completed:** 2026-01-22

## User Story

**As a** Darren (Homelab Operator)
**I want** to manage SSH keys and credentials through the web UI
**So that** I can configure SSH access without manually copying files to the server

## Context

### Persona Reference

**Darren** - Has SSH keys set up across homelab. Wants easy setup without SSH-ing into the hub container to copy key files.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, SSH keys must be manually copied to the `./ssh-keys/` directory and the Docker container rebuilt. This creates a poor user experience and confusing error messages when keys aren't configured. This story adds a web UI to upload, view, and manage SSH keys securely.

**Extends:** [US0037: SSH Key Configuration](US0037-ssh-key-configuration.md) - which provides the backend SSH service but explicitly excluded key management UI.

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | UI for key management, not passwords |
| Security | Secure key storage | Keys stored with 600 permissions |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | Private key protection | Never return key content to frontend |
| UX | Easy setup | Clear UI, helpful error messages |
| Architecture | LAN-only | Keys for local network devices |

## Acceptance Criteria

### AC1: View SSH keys in Settings

- **Given** the Settings page
- **When** viewing the SSH Configuration section
- **Then** I see a list of configured SSH keys showing:
  - Key name (filename)
  - Key type (RSA, ED25519, ECDSA)
  - Key fingerprint (SHA256 hash, truncated)
  - Created date
- **And** I do NOT see the private key content

### AC2: Upload SSH private key

- **Given** the SSH Configuration section
- **When** I click "Add Key" and paste/upload a private key
- **Then** the key is validated as a valid SSH private key format
- **And** the key is stored in `/app/ssh/` with 600 permissions
- **And** the key appears in the keys list
- **And** the private key content is NOT returned in the response

### AC3: Delete SSH key

- **Given** a list of SSH keys
- **When** I click delete on a key and confirm
- **Then** the key file is removed from `/app/ssh/`
- **And** the key disappears from the list

### AC4: Configure default SSH username

- **Given** the SSH Configuration section
- **When** I set a default username
- **Then** the username is saved to settings
- **And** it is used by service discovery and agent installation

### AC5: Test SSH connection

- **Given** SSH keys are configured
- **When** I enter a hostname and click "Test Connection"
- **Then** I see success with response time, or
- **Then** I see a clear error message explaining the failure

### AC6: Integration with existing features

- **Given** SSH keys are configured via the UI
- **When** I use service discovery during agent installation
- **Then** the managed keys are used for authentication
- **And** when I install an agent via SSH
- **Then** the managed keys are used for authentication

### AC7: Helpful empty state

- **Given** no SSH keys are configured
- **When** viewing the SSH Configuration section
- **Then** I see a helpful message explaining how to add keys
- **And** the "Add Key" button is prominent

## Scope

### In Scope

- SSH key list view (metadata only)
- Key upload via paste or file
- Key deletion
- Default username configuration
- Connection test UI
- Key validation on upload
- Secure storage with proper permissions
- Integration with service discovery and agent install

### Out of Scope

- SSH key generation (use ssh-keygen locally)
- Password-protected keys (passphrase not supported)
- Per-host key assignment (uses all keys for all hosts)
- Key rotation/expiry

## Technical Notes

### API Contracts

**GET /api/v1/settings/ssh/keys**
```json
Response 200:
{
  "keys": [
    {
      "id": "id_ed25519",
      "name": "id_ed25519",
      "type": "ED25519",
      "fingerprint": "SHA256:abc123def456...",
      "created_at": "2026-01-22T10:30:00Z"
    },
    {
      "id": "id_rsa",
      "name": "id_rsa",
      "type": "RSA-4096",
      "fingerprint": "SHA256:xyz789...",
      "created_at": "2026-01-20T14:00:00Z"
    }
  ]
}
```

**POST /api/v1/settings/ssh/keys**
```json
Request:
{
  "name": "work_key",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
}

Response 201 (success):
{
  "id": "work_key",
  "name": "work_key",
  "type": "ED25519",
  "fingerprint": "SHA256:abc123...",
  "created_at": "2026-01-22T15:00:00Z"
}

Response 400 (invalid key):
{
  "detail": "Invalid SSH private key format"
}

Response 400 (passphrase protected):
{
  "detail": "Password-protected keys are not supported. Please decrypt the key first."
}

Response 409 (duplicate name):
{
  "detail": "A key with name 'work_key' already exists"
}
```

**DELETE /api/v1/settings/ssh/keys/{key_id}**
```json
Response 204: (no content)

Response 404:
{
  "detail": "Key 'work_key' not found"
}
```

**POST /api/v1/settings/ssh/test**
```json
Request:
{
  "hostname": "192.168.1.100",
  "port": 22,
  "username": "darren"
}

Response 200 (success):
{
  "success": true,
  "hostname": "192.168.1.100",
  "remote_hostname": "mediaserver",
  "response_time_ms": 45
}

Response 200 (failure):
{
  "success": false,
  "hostname": "192.168.1.100",
  "error": "All keys rejected. Ensure your public key is in ~/.ssh/authorized_keys on the target."
}
```

### Security Considerations

1. **Private key content never returned** - Only metadata (fingerprint, type, name) sent to frontend
2. **File permissions** - Keys stored with 600 permissions immediately on write
3. **Key validation** - Validate key format before storing (prevents arbitrary file writes)
4. **API authentication** - All endpoints require API key authentication
5. **No directory traversal** - Key names sanitised to prevent path injection

### Frontend Components

```
Settings Page
└── SSHConfigurationCard
    ├── DefaultUsernameInput
    ├── SSHKeyList
    │   └── SSHKeyRow (name, type, fingerprint, delete)
    ├── AddKeyButton → AddKeyModal
    │   ├── KeyNameInput
    │   ├── KeyContentTextarea / FileUpload
    │   └── SubmitButton
    └── ConnectionTestForm
        ├── HostnameInput
        ├── PortInput
        ├── UsernameInput (defaults to saved)
        └── TestButton + ResultDisplay
```

### Data Storage

- Keys stored as files in `/app/ssh/` (existing pattern)
- Key metadata derived from file at runtime (no database storage needed)
- Default username stored in existing Config table

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Invalid key format | Reject with "Invalid SSH private key format" |
| Password-protected key | Reject with "Password-protected keys not supported" |
| Duplicate key name | Reject with 409 Conflict |
| Key name with special chars | Sanitise to alphanumeric + underscore + hyphen |
| Empty key content | Reject with validation error |
| Delete last key | Allow (warn in UI that no keys configured) |
| Connection test timeout | Return error after 10s timeout |
| Connection test no keys | Return error "No SSH keys configured" |
| Key file permissions fail | Log warning, attempt to fix, fail gracefully |

## Test Scenarios

- [ ] List keys shows correct metadata
- [ ] Upload valid ED25519 key succeeds
- [ ] Upload valid RSA key succeeds
- [ ] Upload invalid content rejected
- [ ] Upload password-protected key rejected
- [ ] Delete key removes file
- [ ] Delete key with special name works
- [ ] Default username persists across sessions
- [ ] Connection test succeeds with valid key
- [ ] Connection test shows helpful error on auth failure
- [ ] Service discovery uses managed keys
- [ ] Agent install uses managed keys
- [ ] Empty state shows helpful message

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0071-01 | List keys returns metadata only | AC1 | API | Pending |
| TC-US0071-02 | Upload valid key stores with 600 perms | AC2 | API | Pending |
| TC-US0071-03 | Upload invalid key returns 400 | AC2 | API | Pending |
| TC-US0071-04 | Delete key removes file | AC3 | API | Pending |
| TC-US0071-05 | Default username saved and used | AC4 | Integration | Pending |
| TC-US0071-06 | Connection test success | AC5 | API | Pending |
| TC-US0071-07 | Connection test failure message | AC5 | API | Pending |
| TC-US0071-08 | Service discovery uses keys | AC6 | Integration | Pending |
| TC-US0071-09 | Agent install uses keys | AC6 | Integration | Pending |
| TC-US0071-10 | Empty state display | AC7 | UI | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 9/8 minimum documented
- [x] Test scenarios: 13/10 minimum listed
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
| US0037: SSH Key Configuration | Story | Done |
| US0043: System Settings Configuration | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium-High - Backend API, frontend UI, security considerations, integration testing

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | Claude | Initial story creation (replaces BG0019) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
