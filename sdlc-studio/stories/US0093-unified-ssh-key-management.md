# US0093: Unified SSH Key Management

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** a single SSH key management system with key selection
**So that** I don't have to configure keys in two different places and can choose which key to use for each operation

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Wants simple, intuitive configuration without having to understand internal system architecture.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently HomelabCmd has two separate SSH key management systems:

1. **SSHKeyManager (EP0006)** - Multiple keys stored in `/app/ssh/` files, used for network scanning and service discovery. Managed via Settings > SSH Configuration.

2. **TailscaleSSHSettings (EP0008)** - Single key stored encrypted in credentials table, used for Tailscale connectivity. Managed via Settings > Connectivity.

This creates confusion when users configure a key in one place but expect it to work everywhere. For example, a user adding an SSH key via SSHKeyManager expects it to work for Tailscale device import with agent installation, but the import modal checks TailscaleSSHSettings instead.

**Problem discovered:** User configured SSH key in SSHKeyManager but saw "Configure SSH key in Settings to enable" when trying to import a Tailscale device with agent installation. The import modal was checking the wrong key store.

**Solution:** Consolidate to a single key management system (SSHKeyManager with encrypted storage) and add key selection dropdown where multiple keys are available.

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key encrypted at rest | All keys must use US0081 encryption |
| UX | Single configuration point | Deprecate TailscaleSSHSettings |
| Migration | Backward compatibility | Migrate existing Tailscale key to unified store |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | Private key protection | Never return key content to frontend |
| UX | Easy setup | Single place to manage all SSH keys |
| Performance | Key selection fast | Dropdown populated from existing key list |

## Acceptance Criteria

### AC1: Single key storage system

- **Given** the existing SSHKeyManager with multiple key support
- **When** I configure SSH keys for any purpose (scanning, agent install, Tailscale)
- **Then** all keys are stored in the unified key manager
- **And** keys are encrypted using the US0081 credential service
- **And** the TailscaleSSHSettings component is removed

### AC2: Key selection in agent installation

- **Given** multiple SSH keys are configured
- **When** I import a Tailscale device with "Install Agent" option
- **Then** I see a dropdown to select which SSH key to use
- **And** the dropdown shows key name, type, and fingerprint
- **And** a default key can be marked for auto-selection

### AC3: Key selection in network scanning

- **Given** multiple SSH keys are configured
- **When** I initiate a network scan
- **Then** I can select which key(s) to try for SSH connections
- **And** the default is to try all keys (existing behaviour)

### AC4: Migration of existing Tailscale key

- **Given** an existing SSH key stored in TailscaleSSHSettings (credentials table)
- **When** the migration runs
- **Then** the key is moved to the unified key manager
- **And** the old credential entry is removed
- **And** the key retains its fingerprint and type metadata

### AC5: Default key configuration

- **Given** multiple SSH keys are configured
- **When** I mark a key as "default"
- **Then** it is pre-selected in all key dropdowns
- **And** it is used when no specific key is requested
- **And** only one key can be default at a time

### AC6: Settings UI consolidation

- **Given** the Settings page
- **When** I view SSH configuration
- **Then** I see a single "SSH Keys" section (not separate Tailscale SSH)
- **And** the connectivity mode selector remains but SSH key config is removed from it
- **And** the SSHKeyManager component handles all key management

## Scope

### In Scope

- Migrate SSHKeyManager to use encrypted storage (US0081)
- Remove TailscaleSSHSettings component
- Add key selection dropdown to ImportDeviceModal
- Add default key marking
- Database migration for existing Tailscale keys
- Update connectivity settings UI to remove SSH key section
- Update all SSH key consumers to use unified service

### Out of Scope

- SSH key generation (user generates locally)
- Password-protected keys (not supported)
- Per-host key assignment beyond selection at operation time
- SSH agent forwarding
- Key rotation/expiry notifications

## UI/UX Requirements

**Settings > SSH Configuration (consolidated):**

```
+----------------------------------------------------+
| SSH Keys                                            |
+----------------------------------------------------+
|                                                    |
| [+ Add Key]                                        |
|                                                    |
| +------------------------------------------------+ |
| | * id_ed25519 (default)              ED25519    | |
| |   SHA256:abc123...                             | |
| |   [Set Default] [Delete]                       | |
| +------------------------------------------------+ |
| | id_rsa_homelab                      RSA-4096   | |
| |   SHA256:xyz789...                             | |
| |   [Set Default] [Delete]                       | |
| +------------------------------------------------+ |
|                                                    |
| Default Username: [homelabcmd          ] [Save]   |
|                                                    |
| [Test Connection]                                  |
|                                                    |
+----------------------------------------------------+
```

**ImportDeviceModal with key selection:**

```
+----------------------------------------------------+
| Import Device: homeserver                           |
+----------------------------------------------------+
|                                                    |
| [x] Install monitoring agent after import          |
|                                                    |
| SSH Key: [id_ed25519 (default) - SHA256:abc1...v] |
|          |-------------------------------------|   |
|          | id_ed25519 (default) - SHA256:abc1 |   |
|          | id_rsa_homelab - SHA256:xyz7...    |   |
|          |-------------------------------------|   |
|                                                    |
| SSH Username: [homelabcmd                        ] |
|                                                    |
|                          [Cancel] [Import & Install]|
+----------------------------------------------------+
```

## Technical Notes

### API Changes

**Existing endpoint modification - GET /api/v1/settings/ssh/keys:**

Add `is_default` field to response:
```json
{
  "keys": [
    {
      "id": "id_ed25519",
      "name": "id_ed25519",
      "type": "ED25519",
      "fingerprint": "SHA256:abc123...",
      "created_at": "2026-01-22T10:30:00Z",
      "is_default": true
    }
  ]
}
```

**New endpoint - PUT /api/v1/settings/ssh/keys/{key_id}/default:**

```json
Response 200:
{
  "success": true,
  "message": "Key 'id_ed25519' set as default"
}
```

**Remove endpoints:**
- `POST /api/v1/settings/ssh/key` (Tailscale single key upload)
- `DELETE /api/v1/settings/ssh/key` (Tailscale single key delete)
- `GET /api/v1/settings/ssh/status` (replace with unified status)

**Modify endpoint - POST /api/v1/tailscale/import:**

Add optional `ssh_key_id` parameter:
```json
Request:
{
  "device_id": "n123abc",
  "server_id": "homeserver",
  "install_agent": true,
  "ssh_key_id": "id_ed25519",  // NEW: optional, uses default if omitted
  "ssh_username": "homelabcmd"
}
```

### Data Migration

```sql
-- Migration: Move Tailscale SSH key to unified storage
-- 1. Check if tailscale key exists in credentials table
-- 2. Extract key content
-- 3. Write to /app/ssh/ with proper permissions
-- 4. Add to ssh_keys tracking (if using database for metadata)
-- 5. Mark as default if no other keys exist
-- 6. Remove old credential entry
```

### Backend Service Changes

1. **SSHKeyService** - Extend to support:
   - Default key marking
   - Encrypted storage option (for Docker volume persistence)
   - Key retrieval by ID for specific operations

2. **Remove TailscaleSSHSettings routes** - Delete `/api/v1/settings/ssh/status`, `/key` endpoints

3. **Update consumers:**
   - `ssh_executor.py` - Use SSHKeyService instead of credential_service for SSH key
   - `tailscale.py` routes - Accept key_id parameter
   - `scan.py` - Already uses SSHKeyService (no change needed)

### Frontend Changes

1. **Delete:** `TailscaleSSHSettings.tsx`
2. **Modify:** `SSHKeyManager.tsx` - Add default key toggle
3. **Modify:** `ImportDeviceModal.tsx` - Add key selection dropdown
4. **Modify:** `ConnectivitySettings.tsx` - Remove SSH key section

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No keys configured | Show "Add an SSH key to enable agent installation" in import modal |
| Single key configured | Auto-select it, no dropdown shown |
| Multiple keys, none default | Show dropdown with no pre-selection, require user choice |
| Delete default key | Next key becomes default, or none if no keys remain |
| Migration finds no Tailscale key | No-op, migration completes successfully |
| Migration finds existing key with same fingerprint | Skip (don't duplicate), remove old entry |
| Key selection with invalid key_id | Return 404: "SSH key '{key_id}' not found" |
| Scan with no keys | Return existing error behaviour |
| Set default on non-existent key | Return 404: "SSH key '{key_id}' not found" |
| Import with key that has been deleted mid-request | Return 404 with clear message |

## Test Scenarios

- [ ] Single key manager stores all keys
- [ ] Keys are encrypted at rest
- [ ] TailscaleSSHSettings component removed
- [ ] ImportDeviceModal shows key dropdown when multiple keys
- [ ] ImportDeviceModal auto-selects when single key
- [ ] Default key is pre-selected in dropdown
- [ ] Setting default key clears previous default
- [ ] Migration moves existing Tailscale key
- [ ] Migration handles no existing key
- [ ] Connectivity settings no longer shows SSH key section
- [ ] Network scan still works with unified keys
- [ ] Agent installation uses selected key
- [ ] Test SSH connection uses selected key

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0093-01 | Keys stored encrypted | AC1 | Integration | Pending |
| TC-US0093-02 | TailscaleSSHSettings removed | AC1 | Unit | Pending |
| TC-US0093-03 | Key dropdown shows in import modal | AC2 | UI | Pending |
| TC-US0093-04 | Key dropdown shows metadata | AC2 | UI | Pending |
| TC-US0093-05 | Network scan uses unified keys | AC3 | Integration | Pending |
| TC-US0093-06 | Migration moves Tailscale key | AC4 | Integration | Pending |
| TC-US0093-07 | Default key pre-selected | AC5 | UI | Pending |
| TC-US0093-08 | Only one default key allowed | AC5 | Unit | Pending |
| TC-US0093-09 | Settings shows single SSH section | AC6 | UI | Pending |
| TC-US0093-10 | Connectivity settings no SSH key | AC6 | UI | Pending |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0071](US0071-ssh-key-manager-ui.md) | Extends | SSHKeyManager component and API | Done |
| [US0079](US0079-ssh-connection-tailscale.md) | Modifies | TailscaleSSHSettings to be removed | Done |
| [US0081](US0081-credential-encryption-storage.md) | Uses | Encryption service for key storage | Done |
| [US0082](US0082-tailscale-import-with-agent-install.md) | Modifies | ImportDeviceModal key selection | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| ssh_keys | [US0071](US0071-ssh-key-manager-ui.md) | Add is_default column |
| credentials | [US0081](US0081-credential-encryption-storage.md) | Remove ssh_private_key entry |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

## Estimation

**Story Points:** 5

**Complexity:** Medium - Consolidation and migration, but building on existing components

## Open Questions

None - the approach is clear: consolidate to SSHKeyManager with encrypted storage and add key selection.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 10/8 minimum documented
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

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation from UX issue discovered during testing |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
