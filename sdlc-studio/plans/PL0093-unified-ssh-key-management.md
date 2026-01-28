# PL0093: Unified SSH Key Management - Implementation Plan

> **Status:** Review
> **Story:** [US0093: Unified SSH Key Management](../stories/US0093-unified-ssh-key-management.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-27
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Consolidate two separate SSH key management systems (SSHKeyManager from EP0006 and TailscaleSSHSettings from EP0008) into a single unified system. Add key selection dropdown for operations that need SSH access, default key marking, and migrate existing Tailscale keys to the unified store.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Single key storage system | All keys stored in unified SSHKeyManager |
| AC2 | Key selection in agent installation | Dropdown in ImportDeviceModal when multiple keys |
| AC3 | Key selection in network scanning | Option to select which key(s) for scans |
| AC4 | Migration of existing Tailscale key | Move from credentials table to unified store |
| AC5 | Default key configuration | Mark one key as default for auto-selection |
| AC6 | Settings UI consolidation | Single SSH Keys section, remove TailscaleSSHSettings |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+ (Backend), TypeScript (Frontend)
- **Framework:** FastAPI (Backend), React 18 (Frontend)
- **Test Framework:** pytest (Backend), Vitest (Frontend)

### Relevant Best Practices

**Python:**
- Type hints on all function signatures
- Specific exception handling (not bare except)
- Use pathlib for file operations
- Logging instead of print

**TypeScript:**
- Avoid `any`, use proper types
- Explicit return types on exported functions
- Use utility types (Pick, Omit, Partial)
- Handle null/undefined explicitly

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | Path parameters, dependency injection | Path, Depends |
| Pydantic | /pydantic/pydantic | Schema validation with defaults | BaseModel, Field |
| React | /facebook/react | useState, useEffect hooks | Hooks patterns |

### Existing Patterns

**Backend:**
- SSHKeyManager uses file-based storage in `/app/ssh/`
- Key metadata stored in Config table as JSON
- TailscaleSSHSettings uses CredentialService for encrypted storage
- Routes follow `/api/v1/settings/...` pattern

**Frontend:**
- Components use React hooks for state
- API functions in `src/api/` directory
- Types in `src/types/` directory
- Lucide React for icons

## Recommended Approach

**Strategy:** Test-After (Hybrid)
**Rationale:** This is a consolidation/refactoring task. Existing tests cover individual systems. New tests should focus on integration points: migration logic, key selection flow, default key handling.

### Test Priority

1. Migration script - moves existing Tailscale key correctly
2. Default key logic - set, auto-promote on delete
3. Key selection in ImportDeviceModal - dropdown, auto-select single key

### Documentation Updates Required

- [ ] Update CLAUDE.md API endpoint section
- [ ] Update Settings page help text (if any)

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add is_default to key metadata | `backend/src/homelab_cmd/services/ssh.py` | - | No | [ ] |
| 2 | Store default_key_id in Config | `backend/src/homelab_cmd/services/ssh.py` | 1 | No | [ ] |
| 3 | Add set-default endpoint | `backend/src/homelab_cmd/api/routes/scan.py` | 2 | No | [ ] |
| 4 | Update schema with is_default | `backend/src/homelab_cmd/api/schemas/scan.py` | 1 | Yes | [ ] |
| 5 | Auto-promote default on delete | `backend/src/homelab_cmd/services/ssh.py` | 2 | No | [ ] |
| 6 | Add ssh_key_id to import schema | `backend/src/homelab_cmd/api/schemas/tailscale.py` | - | Yes | [ ] |
| 7 | Update import endpoint for key selection | `backend/src/homelab_cmd/api/routes/tailscale.py` | 6 | No | [ ] |
| 8 | Update ssh_executor to use SSHKeyManager | `backend/src/homelab_cmd/services/ssh_executor.py` | 1 | No | [ ] |
| 9 | Update test-ssh endpoint for key_id | `backend/src/homelab_cmd/api/routes/servers.py` | 8 | No | [ ] |
| 10 | Add is_default to frontend types | `frontend/src/types/scan.ts` | - | Yes | [ ] |
| 11 | Add setDefaultKey API function | `frontend/src/api/scans.ts` | 10 | No | [ ] |
| 12 | Update SSHKeyManager with default toggle | `frontend/src/components/SSHKeyManager.tsx` | 11 | No | [ ] |
| 13 | Add key dropdown to ImportDeviceModal | `frontend/src/components/ImportDeviceModal.tsx` | 10,11 | No | [ ] |
| 14 | Remove SSH section from ConnectivitySettings | `frontend/src/components/ConnectivitySettings.tsx` | - | Yes | [ ] |
| 15 | Delete TailscaleSSHSettings component | `frontend/src/components/TailscaleSSHSettings.tsx` | 14 | No | [ ] |
| 16 | Create migration function | `backend/src/homelab_cmd/services/ssh.py` | 1,2 | No | [ ] |
| 17 | Run migration on startup | `backend/src/homelab_cmd/main.py` | 16 | No | [ ] |
| 18 | Deprecate old SSH settings endpoints | `backend/src/homelab_cmd/api/routes/ssh_settings.py` | 17 | No | [ ] |
| 19 | Write backend tests | `backend/tests/test_ssh_key_unified.py` | 1-9 | No | [ ] |
| 20 | Write frontend tests | `frontend/src/__tests__/SSHKeyManager.test.tsx` | 10-15 | No | [ ] |

### Task Dependency Graph

```
1 (is_default metadata)
├─► 2 (store default_key_id)
│   ├─► 3 (set-default endpoint)
│   ├─► 5 (auto-promote on delete)
│   └─► 16 (migration function)
│       └─► 17 (run on startup)
│           └─► 18 (deprecate old endpoints)
├─► 4 (schema) [parallel]
└─► 8 (ssh_executor)
    └─► 9 (test-ssh endpoint)

6 (import schema) [parallel]
└─► 7 (import endpoint)

10 (frontend types) [parallel]
└─► 11 (setDefaultKey API)
    ├─► 12 (SSHKeyManager UI)
    └─► 13 (ImportDeviceModal dropdown)

14 (ConnectivitySettings cleanup) [parallel]
└─► 15 (delete TailscaleSSHSettings)

19 (backend tests) ← depends on 1-9
20 (frontend tests) ← depends on 10-15
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 4, 6, 10, 14 | None (independent starting tasks) |
| B | 3, 5, 7, 11 | After Group A completes |
| C | 8, 12, 13, 15 | After respective Group B tasks |

## Implementation Phases

### Phase 1: Backend - Default Key Support

**Goal:** Extend SSHKeyManager to support default key marking

**Tasks in this phase:** 1, 2, 3, 4, 5

#### Step 1.1: Add is_default to key metadata

- [ ] Modify `list_keys_with_metadata()` to include `is_default` field
- [ ] Read `default_key_id` from Config table
- [ ] Return `is_default: True` for matching key

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Add `get_default_key_id()` and update `list_keys_with_metadata()`

**Code pattern:**
```python
def get_default_key_id(self, session: Session) -> str | None:
    """Get the default SSH key ID from config."""
    config = session.query(Config).filter(Config.key == "ssh").first()
    if config and config.value:
        data = json.loads(config.value)
        return data.get("default_key_id")
    return None

def list_keys_with_metadata(self, session: Session) -> list[dict]:
    """List all SSH keys with metadata including is_default."""
    default_key_id = self.get_default_key_id(session)
    keys = []
    for key_file in self.key_path.glob("*"):
        # ... existing logic ...
        key_data["is_default"] = key_file.name == default_key_id
        keys.append(key_data)
    return keys
```

#### Step 1.2: Add set-default endpoint

- [ ] Create `PUT /api/v1/settings/ssh/keys/{key_id}/default` endpoint
- [ ] Verify key exists before setting as default
- [ ] Update Config table with new default_key_id

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/scan.py` - Add `set_default_key` route
- `backend/src/homelab_cmd/api/schemas/scan.py` - Add response schema

**API Contract:**
```
PUT /api/v1/settings/ssh/keys/{key_id}/default

Response 200:
{
  "success": true,
  "message": "Key 'id_ed25519' set as default"
}

Response 404:
{
  "detail": "SSH key 'nonexistent' not found"
}
```

#### Step 1.3: Auto-promote default on delete

- [ ] In `delete_key()`, check if deleted key was default
- [ ] If so, set next available key as default
- [ ] If no keys remain, clear default_key_id

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Update `delete_key()` method

### Phase 2: Backend - Key Selection in Import

**Goal:** Update Tailscale import to accept optional key selection

**Tasks in this phase:** 6, 7, 8, 9

#### Step 2.1: Update import schema and endpoint

- [ ] Add optional `ssh_key_id` field to ImportDeviceRequest
- [ ] If not provided, use default key
- [ ] If no default and multiple keys, return 400 with helpful error

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/tailscale.py` - Add `ssh_key_id: str | None = None`
- `backend/src/homelab_cmd/api/routes/tailscale.py` - Use provided or default key

**API Contract:**
```
POST /api/v1/tailscale/import

Request:
{
  "device_id": "n123abc",
  "server_id": "homeserver",
  "install_agent": true,
  "ssh_key_id": "id_ed25519",  // optional
  "ssh_username": "homelabcmd"
}

Response 400 (no key selected, multiple available):
{
  "detail": "Multiple SSH keys available. Please select a key or set a default."
}
```

#### Step 2.2: Update ssh_executor to use SSHKeyManager

- [ ] Modify `SSHExecutor` to accept key_id parameter
- [ ] Load key content from SSHKeyManager instead of CredentialService
- [ ] Fall back to default key if none specified

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh_executor.py` - Add `key_id` parameter

### Phase 3: Frontend - Component Updates

**Goal:** Update UI components for unified key management

**Tasks in this phase:** 10, 11, 12, 13, 14, 15

#### Step 3.1: Update types and API

- [ ] Add `is_default: boolean` to SSHKeyMetadata type
- [ ] Add `setDefaultKey(keyId: string)` API function

**Files to modify:**
- `frontend/src/types/scan.ts` - Add is_default field
- `frontend/src/api/scans.ts` - Add setDefaultKey function

#### Step 3.2: Update SSHKeyManager component

- [ ] Show star/badge for default key
- [ ] Add "Set as Default" button for non-default keys
- [ ] Call setDefaultKey API on click

**Files to modify:**
- `frontend/src/components/SSHKeyManager.tsx` - Add default key UI

**UI Mockup:**
```
+------------------------------------------------+
| * id_ed25519 (default)              ED25519    |
|   SHA256:abc123...                             |
|   [Delete]                                     |
+------------------------------------------------+
| id_rsa_homelab                      RSA-4096   |
|   SHA256:xyz789...                             |
|   [Set as Default] [Delete]                    |
+------------------------------------------------+
```

#### Step 3.3: Add key dropdown to ImportDeviceModal

- [ ] Fetch SSH keys on mount using `listSSHKeys()`
- [ ] Show dropdown when keys.length > 1
- [ ] Auto-select when keys.length === 1
- [ ] Pre-select default key
- [ ] Pass selected key_id to import API

**Files to modify:**
- `frontend/src/components/ImportDeviceModal.tsx` - Add key selection

#### Step 3.4: Remove TailscaleSSHSettings

- [ ] Remove SSH key section from ConnectivitySettings
- [ ] Add note: "Manage SSH keys in Settings > SSH Configuration"
- [ ] Delete TailscaleSSHSettings.tsx file
- [ ] Remove unused imports and API functions

**Files to modify:**
- `frontend/src/components/ConnectivitySettings.tsx` - Remove SSH section
- `frontend/src/components/TailscaleSSHSettings.tsx` - DELETE

### Phase 4: Migration and Testing

**Goal:** Migrate existing data and validate implementation

**Tasks in this phase:** 16, 17, 18, 19, 20

#### Step 4.1: Create migration function

- [ ] Check if `ssh_private_key` credential exists
- [ ] Decrypt key content
- [ ] Write to `/app/ssh/` with unique name
- [ ] Set as default if no other default
- [ ] Remove old credential entry
- [ ] Set migration flag in Config

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Add `migrate_tailscale_key()` function

**Migration logic:**
```python
async def migrate_tailscale_key(
    self,
    session: Session,
    credential_service: CredentialService
) -> bool:
    """Migrate Tailscale SSH key to unified storage."""
    # Check if already migrated
    config = session.query(Config).filter(Config.key == "ssh_key_migrated").first()
    if config and config.value == "true":
        return False  # Already migrated

    # Get existing key from credential service
    key_content = await credential_service.get_credential("ssh_private_key")
    if not key_content:
        # Mark as migrated (nothing to migrate)
        session.add(Config(key="ssh_key_migrated", value="true"))
        session.commit()
        return False

    # Check if key with same fingerprint exists
    existing_keys = self.list_keys_with_metadata(session)
    new_fingerprint = self._get_key_fingerprint(key_content)

    for existing in existing_keys:
        if existing["fingerprint"] == new_fingerprint:
            # Key already exists, just remove old entry
            await credential_service.delete_credential("ssh_private_key")
            session.add(Config(key="ssh_key_migrated", value="true"))
            session.commit()
            return True

    # Write key to file
    key_name = f"tailscale_migrated_{datetime.now().strftime('%Y%m%d')}"
    self.upload_key(key_name, key_content, session)

    # Set as default if no default exists
    if not self.get_default_key_id(session):
        self.set_default_key(key_name, session)

    # Remove old credential
    await credential_service.delete_credential("ssh_private_key")

    # Mark as migrated
    session.add(Config(key="ssh_key_migrated", value="true"))
    session.commit()

    return True
```

#### Step 4.2: Run migration on startup

- [ ] Call migration in app lifespan startup
- [ ] Log migration actions

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add migration call to lifespan

#### Step 4.3: Write tests

- [ ] Backend tests for default key logic
- [ ] Backend tests for migration
- [ ] Frontend tests for key dropdown
- [ ] Frontend tests for default key UI

**Test files:**
- `backend/tests/test_ssh_key_unified.py`
- `frontend/src/__tests__/SSHKeyManager.test.tsx`
- `frontend/src/__tests__/ImportDeviceModal.test.tsx`

### Phase 5: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | All keys use SSHKeyManager | `services/ssh.py` | Pending |
| AC2 | Key dropdown in ImportDeviceModal | `ImportDeviceModal.tsx` | Pending |
| AC3 | Key selection in scanning | `scan.py` routes | Pending |
| AC4 | Migration script runs on startup | `main.py`, `ssh.py` | Pending |
| AC5 | Default key toggle in SSHKeyManager | `SSHKeyManager.tsx` | Pending |
| AC6 | Single SSH section, TailscaleSSHSettings deleted | Settings page | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | No keys configured | Show "Add an SSH key to enable agent installation" in ImportDeviceModal | Phase 3 | [ ] |
| 2 | Single key configured | Auto-select it, hide dropdown | Phase 3 | [ ] |
| 3 | Multiple keys, none default | Show dropdown with no pre-selection, require user choice | Phase 3 | [ ] |
| 4 | Delete default key | Auto-promote next key as default, or clear if none remain | Phase 1 | [ ] |
| 5 | Migration finds no Tailscale key | No-op, mark as migrated, continue | Phase 4 | [ ] |
| 6 | Migration finds key with same fingerprint | Skip duplicate, remove old credential entry | Phase 4 | [ ] |
| 7 | Key selection with invalid key_id | Return 404: "SSH key '{key_id}' not found" | Phase 2 | [ ] |
| 8 | Scan with no keys | Return existing error behaviour from SSHKeyManager | Phase 2 | [ ] |
| 9 | Set default on non-existent key | Return 404: "SSH key '{key_id}' not found" | Phase 1 | [ ] |
| 10 | Import with key deleted mid-request | Return 404 with clear message, transaction rollback | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 10
- Handled in plan: 10
- Unhandled: 0

### Edge Case Implementation Notes

- Edge cases 1-3 are UI behaviours in ImportDeviceModal
- Edge case 4 requires careful handling in delete_key() to avoid leaving system without default
- Edge cases 5-6 are migration-specific, require idempotent migration function
- Edge cases 7-10 require proper HTTP error responses with helpful messages

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Tailscale workflow during transition | High | Migration script runs automatically, old data preserved until successful |
| Multiple keys with no default causes confusion | Medium | Clear error message asking user to select or set default |
| Migration fails on corrupted key | Medium | Log error, skip key, mark migration as partial, allow manual recovery |
| Frontend/backend API mismatch | Medium | Update types first, verify API contracts before implementing |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0071: SSH Key Manager UI | Extends | Base SSHKeyManager component |
| US0079: SSH Connection via Tailscale | Modifies | TailscaleSSHSettings to be removed |
| US0081: Credential Encryption | Uses | For migration (reading encrypted key) |
| US0082: Tailscale Import with Agent | Modifies | ImportDeviceModal key selection |

## Open Questions

None - approach is clear from story definition.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled (all 10)
- [ ] Code follows best practices (Python + TypeScript)
- [ ] No linting errors
- [ ] TailscaleSSHSettings component deleted
- [ ] Migration runs successfully on startup
- [ ] Manual verification: import device with key selection works
- [ ] Ready for code review

## Notes

**Key architectural decision:** We're keeping file-based storage from SSHKeyManager rather than moving everything to encrypted database storage. This maintains backward compatibility with the scanning workflow and simplifies the migration.

**Migration is one-time:** The migration function checks a flag in Config table to avoid re-running. This ensures idempotent behaviour across restarts.

**Deprecation strategy:** TailscaleSSHSettings endpoints will be removed entirely rather than redirected, as the unified API provides all needed functionality.
