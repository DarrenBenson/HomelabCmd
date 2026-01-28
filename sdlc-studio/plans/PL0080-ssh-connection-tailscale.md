# PL0080: SSH Connection via Tailscale - Implementation Plan

> **Status:** In Progress
> **Story:** [US0079: SSH Connection via Tailscale](../stories/US0079-ssh-connection-tailscale.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-26
> **Language:** Python / TypeScript

## Overview

Implement SSH connection service for HomelabCmd that connects to machines via Tailscale hostnames. The existing `SSHConnectionService` uses Paramiko; this plan extends it with connection pooling, retry logic, host key management, and settings API. Uses the existing `CredentialService` for encrypted SSH key storage.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Use Tailscale hostname | Connect via `tailscale_hostname` not IP |
| AC2 | SSH key encrypted storage | Upload/store via CredentialService |
| AC3 | Connection pooling | Reuse connections for 5 minutes |
| AC4 | Automatic retry | 3 attempts, 2s delay on transient failures |
| AC5 | Test connection endpoint | POST /api/v1/machines/{id}/test-ssh |
| AC6 | Host key verification | Store and verify host keys (TOFU) |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Backend Framework:** FastAPI with SQLAlchemy 2.0
- **SSH Library:** Paramiko 3.4.0+ (already installed)
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Catch specific exceptions, not bare `except:`
- Always set explicit timeouts on network operations
- Use context managers for resource cleanup

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| Paramiko | /paramiko/paramiko | SSH connection pooling, host key verification | SSHClient, AutoAddPolicy, HostKeys |
| FastAPI | /tiangolo/fastapi | File upload endpoint, background tasks | UploadFile, BackgroundTasks |

### Existing Patterns

**SSHConnectionService (existing):**
- Located at `backend/src/homelab_cmd/services/ssh.py`
- Uses Paramiko for connections
- Has `test_connection()`, `execute_command()` methods
- Key management via file system (to be replaced with CredentialService)
- Supports RSA, Ed25519, ECDSA key types

**CredentialService (US0081):**
- `ssh_private_key` already in `ALLOWED_CREDENTIAL_TYPES`
- `store_credential()`, `get_credential()`, `delete_credential()` methods
- Fernet encryption for secure storage

**Settings API Pattern (tailscale.py):**
- Router with `/settings/{service}` prefix
- Helper function `_get_credential_service(session)`
- Standard response schemas with success/message fields

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Story extends existing `SSHConnectionService` patterns. Connection pooling and retry logic follow standard patterns. Database migration is straightforward. Most risk is in SSH host key verification which has well-documented Paramiko patterns.

### Test Priority

1. SSH key upload stores encrypted value via CredentialService
2. Connection retry logic (3 attempts, 2s delay)
3. Connection pool reuses connection within TTL
4. Host key stored on first connection (TOFU)
5. Host key change detected and reported

### Documentation Updates Required

- [ ] AGENTS.md - Add SSH settings endpoints and test-ssh endpoint

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Create ssh_host_keys model | `backend/src/homelab_cmd/db/models/ssh_host_key.py` | - | Yes | [x] |
| 2 | Create Alembic migration | `migrations/versions/b5c0043d0f8b_add_ssh_host_keys_table_for_tofu_host_.py` | 1 | No | [x] |
| 3 | Add ssh_host_key to models __init__ | `backend/src/homelab_cmd/db/models/__init__.py` | 1 | No | [x] |
| 4 | Create HostKeyService | `backend/src/homelab_cmd/services/host_key_service.py` | 1 | No | [x] |
| 5 | Create SSHPooledExecutor service | `backend/src/homelab_cmd/services/ssh_executor.py` | 4 | No | [x] |
| 6 | Create SSH settings schemas | `backend/src/homelab_cmd/api/schemas/ssh.py` | - | Yes | [x] |
| 7 | Create SSH settings router | `backend/src/homelab_cmd/api/routes/ssh_settings.py` | 5, 6 | No | [x] |
| 8 | Add test-ssh endpoint | `backend/src/homelab_cmd/api/routes/servers.py` | 5 | No | [x] |
| 9 | Register routers in main.py | `backend/src/homelab_cmd/main.py` | 7 | No | [x] |
| 10 | Add TypeScript types | `frontend/src/types/ssh.ts` | - | Yes | [x] |
| 11 | Add SSH API client | `frontend/src/api/ssh.ts` | 10 | No | [x] |
| 12 | Create SSH settings UI | `frontend/src/pages/Settings.tsx` | 11 | No | [x] |
| 13 | Add test-ssh to machine detail | `frontend/src/pages/ServerDetail.tsx` | 11 | No | [x] |
| 14 | Write backend tests | `tests/test_ssh_settings.py` | 7, 8 | No | [x] |
| 15 | Update AGENTS.md | `AGENTS.md` | 7, 8 | No | [x] |

### Task Dependency Graph

```
1 (model) ──► 2 (migration) ──► 3 (init) ──► 4 (host key svc)
                                              │
                                              ▼
6 (schemas) ─────────────────────► 5 (executor) ──► 7 (settings route)
                                              │         │
                                              │         ▼
                                              └──► 8 (test-ssh) ──► 9 (main.py)
                                                        │
10 (TS types) ──► 11 (API client) ──► 12 (settings UI)│
                        │                              │
                        └──► 13 (server detail) ◄─────┘
                                    │
                              14 (tests) ──► 15 (docs)
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 6, 10 | None |
| 2 | 2, 3, 4 | Task 1 |
| 3 | 5, 11 | Tasks 4, 6, 10 |
| 4 | 7, 8, 12, 13 | Task 5, 11 |
| 5 | 9, 14, 15 | Tasks 7, 8, 12, 13 |

## Implementation Phases

### Phase 1: Database - Host Key Model and Migration

**Goal:** Create ssh_host_keys table for storing verified host keys

**Tasks in this phase:** 1, 2, 3

#### Step 1.1: Create SSHHostKey Model ✓

- [x] Create new model file with SQLAlchemy 2.0 patterns
- [x] Include fields: id, machine_id (FK), hostname, key_type, public_key, fingerprint, first_seen, last_seen
- [x] Add unique constraint on machine_id

**Files modified:**
- `backend/src/homelab_cmd/db/models/ssh_host_key.py` - New model
- `backend/src/homelab_cmd/db/models/__init__.py` - Export model

#### Step 1.2: Create Migration ✓

- [x] Create Alembic migration for ssh_host_keys table
- [x] Include foreign key to servers table
- [x] Include unique constraint on machine_id

**Files modified:**
- `migrations/versions/b5c0043d0f8b_add_ssh_host_keys_table_for_tofu_host_.py` - New migration

### Phase 2: Backend Services

**Goal:** Create HostKeyService and SSHPooledExecutor

**Tasks in this phase:** 4, 5

#### Step 2.1: Create HostKeyService ✓

- [x] CRUD operations for host keys
- [x] Methods: get_host_key, store_host_key, update_last_seen, delete_host_key
- [x] Use async SQLAlchemy patterns

**Files modified:**
- `backend/src/homelab_cmd/services/host_key_service.py` - New service

#### Step 2.2: Create SSHPooledExecutor ✓

- [x] Connection pooling with 5-minute TTL
- [x] Retry logic (3 attempts, 2s delay)
- [x] 10-second connection timeout
- [x] Host key verification via HostKeyService
- [x] Integration with CredentialService for SSH key
- [x] Use existing Paramiko patterns from ssh.py

**Files modified:**
- `backend/src/homelab_cmd/services/ssh_executor.py` - New service

**Considerations:**
- Use `asyncio.to_thread()` for blocking Paramiko calls (existing pattern)
- Clear pool when SSH key changes
- Handle `HostKeyChangedError` separately (no retry)

### Phase 3: Backend API - Schemas and Routes

**Goal:** Create SSH settings API and test-ssh endpoint

**Tasks in this phase:** 6, 7, 8, 9

#### Step 3.1: Create Pydantic Schemas ✓

- [x] SSHKeyUploadResponse (success, message, key_type, fingerprint)
- [x] SSHKeyStatusResponse (configured, fingerprint, key_type, uploaded_at)
- [x] SSHUsernameRequest/Response
- [x] SSHTestResponse (success, hostname, latency_ms, host_key_fingerprint, error, attempts)

**Files modified:**
- `backend/src/homelab_cmd/api/schemas/ssh.py` - New schema file

#### Step 3.2: Create SSH Settings Router ✓

- [x] POST /api/v1/settings/ssh/key - Upload SSH private key
- [x] DELETE /api/v1/settings/ssh/key - Remove SSH key
- [x] GET /api/v1/settings/ssh/status - Get SSH configuration status
- [x] PUT /api/v1/settings/ssh/username - Set default SSH username

**Files modified:**
- `backend/src/homelab_cmd/api/routes/ssh_settings.py` - New router

#### Step 3.3: Add Test SSH Endpoint ✓

- [x] POST /api/v1/servers/{server_id}/test-ssh
- [x] Validate machine has tailscale_hostname
- [x] Return latency, host key fingerprint, or error details

**Files modified:**
- `backend/src/homelab_cmd/api/routes/servers.py` - Add endpoint

#### Step 3.4: Register Routers ✓

- [x] Add ssh_settings_router to main.py
- [x] Ensure proper prefix and tags

**Files modified:**
- `backend/src/homelab_cmd/main.py` - Register router

### Phase 4: Frontend - Types, API, and UI

**Goal:** Create SSH settings UI and test connection button

**Tasks in this phase:** 10, 11, 12, 13

#### Step 4.1: Add TypeScript Types ✓

- [x] SSHKeyUploadResponse
- [x] SSHKeyStatusResponse
- [x] SSHTestResponse
- [x] SSHUsernameRequest

**Files modified:**
- `frontend/src/types/ssh.ts` - New type file

#### Step 4.2: Add SSH API Client ✓

- [x] uploadSSHKey(file: File)
- [x] removeSSHKey()
- [x] getSSHStatus()
- [x] updateSSHUsername(username: string)
- [x] testSSHConnection(machineId: string)

**Files modified:**
- `frontend/src/api/ssh.ts` - New API client

#### Step 4.3: Create SSH Settings Section ✓

- [x] Add SSH section to Settings page (TailscaleSSHSettings component)
- [x] File upload for SSH key
- [x] Display key status (configured, fingerprint)
- [x] Username configuration input
- [x] Remove key button

**Files modified:**
- `frontend/src/components/TailscaleSSHSettings.tsx` - New component
- `frontend/src/pages/Settings.tsx` - Import and render TailscaleSSHSettings

#### Step 4.4: Add Test SSH to Machine Detail ✓

- [x] Add "Test SSH Connection" button
- [x] Display test results (success/failure, latency)
- [x] Handle host key changed warning

**Files modified:**
- `frontend/src/pages/ServerDetail.tsx` - Add test button and result display

### Phase 5: Testing & Documentation

**Goal:** Verify all acceptance criteria and update docs

**Tasks in this phase:** 14, 15

#### Step 5.1: Backend Tests ✓

- [x] Test SSH key upload stores encrypted value
- [x] Test SSH key removal
- [x] Test connection retry logic
- [x] Test connection pool TTL
- [x] Test host key storage (TOFU)
- [x] Test host key change detection
- [x] Test test-ssh endpoint success/failure

**Test file:** `tests/test_ssh_settings.py` - 20 tests passing

#### Step 5.2: Update Documentation ✓

- [x] Add SSH settings endpoints to AGENTS.md
- [x] Add test-ssh endpoint to AGENTS.md
- [x] Add ssh_settings.py, ssh_executor.py, host_key_service.py to project structure

**Files modified:**
- `AGENTS.md` - Add endpoint documentation and project structure updates

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test connects via hostname | `ssh_executor.py` | Done |
| AC2 | Integration test key encrypted | `test_ssh_settings.py` | Done |
| AC3 | Unit test pool reuse | `test_ssh_settings.py` | Done |
| AC4 | Unit test retry logic | `test_ssh_settings.py` | Done |
| AC5 | API test endpoint | `test_ssh_settings.py` | Done |
| AC6 | Integration test host key | `test_ssh_settings.py` | Done |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | No SSH key configured | Return 400 with NO_SSH_KEY code | Phase 3 (test-ssh endpoint) | [ ] |
| 2 | Invalid SSH key format | Validate PEM format, return 400 with INVALID_SSH_KEY | Phase 3 (upload endpoint) | [ ] |
| 3 | Connection timeout (10s) | Set timeout in Paramiko connect, retry 3x | Phase 2 (SSHPooledExecutor) | [ ] |
| 4 | Connection refused | Catch socket error, retry 3x, return error details | Phase 2 (SSHPooledExecutor) | [ ] |
| 5 | Host unreachable | Catch socket error, retry 3x, return "Host unreachable" | Phase 2 (SSHPooledExecutor) | [ ] |
| 6 | Authentication failed | No retry (not transient), return immediately | Phase 2 (SSHPooledExecutor) | [ ] |
| 7 | Host key changed | Raise HostKeyChangedError, prompt user to accept | Phase 2 (SSHPooledExecutor) | [ ] |
| 8 | Connection pool expired | Check timestamp, close old connection, create new | Phase 2 (SSHPooledExecutor) | [ ] |
| 9 | SSH key changed while connections active | Clear entire pool on key change | Phase 3 (upload endpoint) | [ ] |
| 10 | Machine has no tailscale_hostname | Return 400 with NO_TAILSCALE_HOSTNAME code | Phase 3 (test-ssh endpoint) | [ ] |

### Coverage Summary

- Story edge cases: 10
- Handled in plan: 10
- Unhandled: 0

### Edge Case Implementation Notes

- **Authentication failures** should NOT retry since the key won't magically become correct
- **Host key changes** require user confirmation via separate endpoint
- **Pool clearing** ensures stale connections don't persist after key rotation

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Paramiko blocking calls | Could block async event loop | Use `asyncio.to_thread()` pattern from existing ssh.py |
| Connection pool memory | Many machines = many connections | Set max pool size, implement LRU eviction |
| SSH key format variations | User uploads incompatible key | Validate key format on upload, provide clear error messages |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0078 (Machine Registration) | Data | Machines with `tailscale_hostname` - Done |
| US0081 (Credential Service) | Service | SSH key storage - Done |
| Paramiko 3.4.0+ | Library | Already in pyproject.toml |
| Tailscale on machines | Infrastructure | User responsibility |

## Open Questions

None - all questions resolved in story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (20 tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (AGENTS.md)
- [x] Ready for code review

## Notes

- The existing `SSHConnectionService` in `ssh.py` handles key file management and basic connections. The new `SSHPooledExecutor` will complement it with pooling, retry, and host key verification.
- Consider refactoring later to consolidate SSH services, but for this story, keep them separate to minimise risk.
- The frontend SSH settings can be added to the existing Settings page rather than creating a new page.
