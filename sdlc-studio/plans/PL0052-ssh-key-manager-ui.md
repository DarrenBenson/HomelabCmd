# PL0052: SSH Key Manager UI - Implementation Plan

> **Status:** In Progress
> **Story:** [US0071: SSH Key Manager UI](../stories/US0071-ssh-key-manager-ui.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-22
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Implement a web UI for managing SSH keys and credentials, enabling users to upload, view, and delete SSH keys without manually copying files to the server. This extends the existing SSH configuration (US0037) with key management capabilities.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | View SSH keys | List keys showing name, type, fingerprint, created date (NOT private key content) |
| AC2 | Upload SSH key | Validate format, store with 600 perms, return metadata only |
| AC3 | Delete SSH key | Remove file from /app/ssh/, update list |
| AC4 | Configure default username | Save to settings, used by discovery and agent install |
| AC5 | Test SSH connection | Enter hostname, show success with response time or clear error |
| AC6 | Integration | Service discovery and agent install use managed keys |
| AC7 | Empty state | Helpful message and prominent Add Key button when no keys |

## Technical Context

### Language & Framework

- **Backend:** Python 3.11+ / FastAPI
- **Frontend:** TypeScript / React / Vite
- **Test Frameworks:** pytest (backend), vitest (frontend)

### Relevant Best Practices

- Use `yaml.safe_load()` for any YAML parsing
- HTTP requests need explicit timeouts
- File operations use pathlib and context managers
- Type hints on all public functions
- Frontend: useState/useEffect patterns from existing Settings.tsx

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | file upload endpoints, request validation | Pydantic models, HTTPException |
| paramiko | /paramiko/paramiko | SSH key fingerprint, key type detection | PKey.get_fingerprint(), key type classes |
| React | /facebook/react | useState, useEffect, form handling | Controlled inputs, async state |

### Existing Patterns

- **SSH Service:** `backend/src/homelab_cmd/services/ssh.py` - SSHConnectionService with key discovery and validation
- **SSH Routes:** `backend/src/homelab_cmd/api/routes/scan.py` - GET/PUT /settings/ssh endpoints
- **SSH Schemas:** `backend/src/homelab_cmd/api/schemas/scan.py` - SSHConfig, SSHConfigUpdate
- **Settings Page:** `frontend/src/pages/Settings.tsx` - Section cards, form state, modals
- **API Client:** `frontend/src/api/scans.ts` - getSSHConfig, updateSSHConfig

## Recommended Approach

**Strategy:** TDD
**Rationale:** API-focused story with exact contract definitions, 9 edge cases requiring systematic coverage, security-critical code (key storage, permissions), clear stable AC unlikely to change.

### Test Priority

1. Backend key validation tests (valid/invalid/password-protected keys)
2. Backend key storage tests (permissions, duplicate handling)
3. Frontend API client tests (mock responses)
4. Frontend component tests (render states, user interactions)

### Documentation Updates Required

- [ ] Update CLAUDE.md if any new patterns introduced
- [ ] Update story status upon completion

## Implementation Steps

### Phase 1: Backend - SSH Key Metadata Service

**Goal:** Add methods to SSHConnectionService for extracting key metadata (type, fingerprint, created_at)

#### Step 1.1: Add Key Metadata Methods

- [ ] Add `get_key_metadata(key_name: str)` method to SSHConnectionService
- [ ] Add `get_all_keys_metadata()` method returning list of key info
- [ ] Implement fingerprint extraction using paramiko's `PKey.get_fingerprint()`
- [ ] Detect key type from loaded key class (RSAKey, Ed25519Key, ECDSAKey)
- [ ] Get created_at from file stat

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Add metadata methods

**Considerations:**
- Use hashlib to format fingerprint as SHA256:xxx format
- Handle case where key can't be loaded (return type "Unknown")

#### Step 1.2: Add Key Validation Methods

- [ ] Add `validate_private_key(content: str)` method
- [ ] Return validation result with type or error message
- [ ] Detect password-protected keys (paramiko raises PasswordRequiredException)
- [ ] Handle all supported key types (RSA, Ed25519, ECDSA)

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Add validation method

### Phase 2: Backend - API Schemas

**Goal:** Define Pydantic schemas for SSH key management API

#### Step 2.1: Create SSH Key Schemas

- [ ] Create `SSHKeyMetadata` schema (id, name, type, fingerprint, created_at)
- [ ] Create `SSHKeyListResponse` schema (keys: list[SSHKeyMetadata])
- [ ] Create `SSHKeyUploadRequest` schema (name, private_key)
- [ ] Add validation for key name (alphanumeric, underscore, hyphen only)

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/scan.py` - Add new schemas

### Phase 3: Backend - API Endpoints

**Goal:** Implement REST endpoints for SSH key management

#### Step 3.1: GET /api/v1/settings/ssh/keys

- [ ] Add endpoint to list all SSH keys with metadata
- [ ] Return SSHKeyListResponse with key metadata
- [ ] NEVER include private key content in response

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/scan.py` - Add endpoint

#### Step 3.2: POST /api/v1/settings/ssh/keys

- [ ] Add endpoint to upload new SSH key
- [ ] Validate key format using service method
- [ ] Check for duplicate key name (409 Conflict)
- [ ] Sanitise key name to safe characters
- [ ] Write key to /app/ssh/{name} with 600 permissions
- [ ] Return key metadata (not content)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/scan.py` - Add endpoint

**Considerations:**
- Use `os.chmod(path, 0o600)` immediately after writing
- Handle IOError for permission failures

#### Step 3.3: DELETE /api/v1/settings/ssh/keys/{key_id}

- [ ] Add endpoint to delete SSH key
- [ ] Remove file from /app/ssh/
- [ ] Return 204 No Content on success
- [ ] Return 404 if key not found

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/scan.py` - Add endpoint

### Phase 4: Frontend - Types and API Client

**Goal:** Add TypeScript types and API client functions for SSH key management

#### Step 4.1: Add TypeScript Types

- [ ] Add `SSHKeyMetadata` interface
- [ ] Add `SSHKeyListResponse` interface
- [ ] Add `SSHKeyUploadRequest` interface

**Files to modify:**
- `frontend/src/types/scan.ts` - Add types

#### Step 4.2: Add API Client Functions

- [ ] Add `getSSHKeys()` function
- [ ] Add `uploadSSHKey(name, privateKey)` function
- [ ] Add `deleteSSHKey(keyId)` function

**Files to modify:**
- `frontend/src/api/scans.ts` - Add functions

### Phase 5: Frontend - SSH Configuration Section

**Goal:** Add SSH Configuration section to Settings page

#### Step 5.1: Create SSHKeyList Component

- [ ] Create component to display list of SSH keys
- [ ] Show key name, type, fingerprint (truncated), created date
- [ ] Add delete button for each key with confirmation
- [ ] Show empty state when no keys configured

**Files to create:**
- `frontend/src/components/SSHKeyList.tsx`

#### Step 5.2: Create AddKeyModal Component

- [ ] Create modal for adding new SSH key
- [ ] Include key name input with validation
- [ ] Include textarea for pasting private key content
- [ ] Show validation errors (invalid format, password-protected, duplicate name)
- [ ] Clear form on successful upload

**Files to create:**
- `frontend/src/components/AddKeyModal.tsx`

#### Step 5.3: Create ConnectionTestForm Component

- [ ] Create form for testing SSH connection
- [ ] Include hostname, port (optional), username (optional) inputs
- [ ] Show test button with loading state
- [ ] Display success with response time or error message

**Files to create:**
- `frontend/src/components/ConnectionTestForm.tsx`

#### Step 5.4: Integrate into Settings Page

- [ ] Add SSH Configuration section to Settings.tsx
- [ ] Include default username input (existing pattern)
- [ ] Include SSHKeyList component
- [ ] Include Add Key button that opens AddKeyModal
- [ ] Include ConnectionTestForm
- [ ] Fetch SSH keys on page load
- [ ] Handle key upload, delete operations

**Files to modify:**
- `frontend/src/pages/Settings.tsx` - Add SSH section

### Phase 6: Integration Verification

**Goal:** Verify managed keys work with existing SSH features

#### Step 6.1: Verify Service Discovery Integration

- [ ] Confirm service discovery uses SSHConnectionService
- [ ] Verify keys uploaded via UI are discovered by get_available_keys()

#### Step 6.2: Verify Agent Install Integration

- [ ] Confirm agent install uses SSHConnectionService
- [ ] Verify keys uploaded via UI work for agent installation

**Files to verify:**
- `backend/src/homelab_cmd/services/discovery.py`
- `backend/src/homelab_cmd/services/agent_deploy.py`

### Phase 7: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 7.1: Backend Unit Tests

- [ ] Test key metadata extraction
- [ ] Test key validation (valid, invalid, password-protected)
- [ ] Test key upload with permissions
- [ ] Test duplicate key rejection
- [ ] Test key deletion
- [ ] Test key name sanitisation

**Files to create:**
- `backend/tests/test_ssh_keys_api.py`

#### Step 7.2: Frontend Unit Tests

- [ ] Test API client functions
- [ ] Test SSHKeyList component rendering
- [ ] Test AddKeyModal form validation
- [ ] Test ConnectionTestForm interactions

**Files to create:**
- `frontend/src/api/__tests__/ssh-keys.test.ts`
- `frontend/src/components/__tests__/SSHKeyList.test.tsx`
- `frontend/src/components/__tests__/AddKeyModal.test.tsx`
- `frontend/src/components/__tests__/ConnectionTestForm.test.tsx`

#### Step 7.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Manual: View Settings page, verify key list shows metadata | Pending |
| AC2 | Manual: Upload key, verify stored with 600 perms | Pending |
| AC3 | Manual: Delete key, verify file removed | Pending |
| AC4 | Manual: Change username, verify used in discovery | Pending |
| AC5 | Manual: Test connection, verify success/error display | Pending |
| AC6 | Manual: Service discovery and agent install use uploaded keys | Pending |
| AC7 | Manual: Remove all keys, verify empty state | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Invalid key format | Try loading with paramiko, return 400 "Invalid SSH private key format" | Phase 3.2 | [ ] |
| 2 | Password-protected key | Catch PasswordRequiredException, return 400 "Password-protected keys not supported" | Phase 3.2 | [ ] |
| 3 | Duplicate key name | Check file exists before write, return 409 Conflict | Phase 3.2 | [ ] |
| 4 | Key name with special chars | Regex sanitise to [a-zA-Z0-9_-], reject if resulting name empty | Phase 3.2 | [ ] |
| 5 | Empty key content | Pydantic validation, return 400 validation error | Phase 2.1 | [ ] |
| 6 | Delete last key | Allow deletion, show warning in UI that no keys configured | Phase 3.3, 5.1 | [ ] |
| 7 | Connection test timeout | SSHConnectionService uses 10s timeout, return error message | Phase 1.1 (existing) | [ ] |
| 8 | Connection test no keys | Check keys list, return 400 "No SSH keys configured" | Phase 3.3 (existing test endpoint) | [ ] |
| 9 | Key file permissions fail | Try chmod 600, catch OSError, return 500 with error | Phase 3.2 | [ ] |

### Coverage Summary

- Story edge cases: 9
- Handled in plan: 9
- Unhandled: 0

### Edge Case Implementation Notes

- Password-protected key detection: paramiko raises `paramiko.ssh_exception.PasswordRequiredException` when loading password-protected keys
- Key name sanitisation uses regex: `re.sub(r'[^a-zA-Z0-9_-]', '', name)`
- File permissions set using `os.chmod(path, 0o600)` immediately after writing

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Key validation not catching all invalid formats | Low | Test with various malformed keys, rely on paramiko |
| Permissions may not work in Docker | Medium | Test in Docker environment, document any host mount requirements |
| Concurrent key operations | Low | Keys are file-based, atomic writes, low concurrency in home lab context |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0037 (SSH Key Configuration) | Story | Done - provides SSHConnectionService foundation |
| US0043 (System Settings Configuration) | Story | Done - provides Settings page structure |
| paramiko | Library | Already installed, used for key loading and validation |

## Open Questions

- [x] Should key upload support file upload in addition to paste? **Decision:** Support paste only for v1, file upload adds complexity
- [x] Should we show full fingerprint or truncate? **Decision:** Show truncated (first 16 chars) with tooltip for full

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] Ready for code review

## Notes

- The existing `/api/v1/scan/test` endpoint handles connection testing; may need minor updates to use configured username
- Keys are stored as files matching existing pattern in SSHConnectionService
- Integration with service discovery and agent install requires no changes - they already use SSHConnectionService.get_available_keys()
