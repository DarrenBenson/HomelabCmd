# PL0044: SSH Key Configuration - Implementation Plan

> **Status:** Complete
> **Story:** [US0037: SSH Key Configuration](../stories/US0037-ssh-key-configuration.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Language:** Python

## Overview

Implement SSH key configuration for ad-hoc device scanning. This is the foundation story for EP0006, enabling secure SSH connections to transient devices using key-based authentication. The implementation includes settings endpoints, a connection test API, and the core SSH service layer.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | SSH key path configurable | Scanner uses specified key path from configuration |
| AC2 | Default key location | Uses /app/ssh/id_rsa when no custom path configured |
| AC3 | Test connection | POST /api/v1/scan/test returns connection success/failure |
| AC4 | Key permissions validated | Validates keys have 600 permissions on startup |
| AC5 | Multiple keys supported | Tries keys in order until one succeeds |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use specific exceptions (AuthenticationException, SSHException)
- Always set timeouts on network operations
- Use context managers for resource cleanup
- Type hints on all public functions
- Use logging module, not print

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| paramiko | /paramiko/paramiko | SSH client key authentication | SSHClient with AutoAddPolicy, PKey.from_path(), timeout/auth_timeout params |
| FastAPI | /tiangolo/fastapi | API routes dependency injection | Depends(), APIRouter, HTTPException |

### Existing Patterns

From codebase exploration:
- **Settings storage:** Config table with key-value JSON (`db/models/config.py`)
- **Config helpers:** `get_config_value()`, `set_config_value()` in `routes/config.py`
- **Service pattern:** Service classes in `services/` with async methods
- **Schema pattern:** BaseModel with optional fields for updates
- **Auth pattern:** `_: str = Depends(verify_api_key)` on all protected endpoints

## Recommended Approach

**Strategy:** Test-After
**Rationale:**
- External dependency (paramiko/SSH) requires understanding real behaviour before mocking
- Complex error handling paths easier to implement first, then test
- AC3 (connection test) involves network simulation that benefits from implementation-first

### Test Priority

1. Unit tests for SSHConnectionService (permission validation, key listing)
2. API tests for settings endpoints (GET/PUT)
3. Integration tests for connection test endpoint (mocked SSH)

### Documentation Updates Required

- [ ] Update docker-compose.yml with SSH key volume mount
- [ ] Create ssh-keys/.gitkeep placeholder

## Implementation Steps

### Phase 1: Backend Foundation

**Goal:** Create SSH service class and configuration settings

#### Step 1.1: Add SSH Settings to Application Config

- [ ] Add SSH-related settings to Settings class
- [ ] Set sensible defaults for key path, username, port, timeout

**Files to modify:**
- `backend/src/homelab_cmd/config.py` - Add SSH settings fields

**Settings to add:**
```python
ssh_key_path: str = "/app/ssh"
ssh_default_username: str = "root"
ssh_default_port: int = 22
ssh_connection_timeout: int = 10
```

#### Step 1.2: Create SSH Connection Service

- [ ] Create SSHConnectionService class
- [ ] Implement validate_key_permissions() method
- [ ] Implement get_available_keys() method
- [ ] Implement test_connection() async method
- [ ] Handle multiple key attempts (AC5)

**Files to create:**
- `backend/src/homelab_cmd/services/ssh.py` - SSH service class

**Considerations:**
- Use paramiko.SSHClient with AutoAddPolicy (no strict host checking)
- Set timeout=10 and auth_timeout=10 for connection attempts
- Try each key in order, return on first success
- Log warnings for permission issues, don't block

### Phase 2: API Endpoints

**Goal:** Create REST endpoints for SSH settings and connection testing

#### Step 2.1: Create Pydantic Schemas

- [ ] Create SSHConfig response schema
- [ ] Create SSHConfigUpdate request schema
- [ ] Create TestConnectionRequest schema
- [ ] Create TestConnectionResponse schema

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/scan.py` - Pydantic schemas

**Schema definitions:**
```python
class SSHConfig(BaseModel):
    key_path: str
    keys_found: list[str]
    default_username: str
    default_port: int

class SSHConfigUpdate(BaseModel):
    default_username: str | None = None
    default_port: int | None = None

class TestConnectionRequest(BaseModel):
    hostname: str
    port: int = 22
    username: str | None = None

class TestConnectionResponse(BaseModel):
    status: str  # "success" or "failed"
    hostname: str
    remote_hostname: str | None = None
    response_time_ms: int | None = None
    error: str | None = None
```

#### Step 2.2: Create Scan Router

- [ ] Implement GET /api/v1/settings/ssh endpoint
- [ ] Implement PUT /api/v1/settings/ssh endpoint
- [ ] Implement POST /api/v1/scan/test endpoint
- [ ] Add API key authentication to all endpoints

**Files to create:**
- `backend/src/homelab_cmd/api/routes/scan.py` - Router with endpoints

#### Step 2.3: Register Router

- [ ] Import scan router in main.py
- [ ] Register with /api/v1 prefix

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add router registration

### Phase 3: Docker Configuration

**Goal:** Configure Docker volume mount for SSH keys

#### Step 3.1: Update docker-compose.yml

- [ ] Add SSH keys volume mount (read-only)
- [ ] Add environment variable for SSH key path

**Files to modify:**
- `docker-compose.yml` - Add volume mount

**Volume configuration:**
```yaml
volumes:
  - ./data:/app/data
  - ./ssh-keys:/app/ssh:ro
```

#### Step 3.2: Create Placeholder Directory

- [ ] Create ssh-keys directory
- [ ] Add .gitkeep file

**Files to create:**
- `ssh-keys/.gitkeep` - Placeholder

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Unit Tests

- [ ] Test SSHConnectionService.validate_key_permissions()
- [ ] Test SSHConnectionService.get_available_keys()
- [ ] Test permission warning on invalid permissions

**Files to create:**
- `tests/test_ssh_service.py` - Unit tests for SSH service

#### Step 4.2: API Tests

- [ ] Test GET /api/v1/settings/ssh returns config
- [ ] Test PUT /api/v1/settings/ssh updates config
- [ ] Test POST /api/v1/scan/test with mocked SSH
- [ ] Test authentication required on all endpoints

**Files to create:**
- `tests/test_scan_ssh_config.py` - API tests

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | PUT settings updates config, GET reflects change | Pending |
| AC2 | GET settings returns default /app/ssh path | Pending |
| AC3 | POST /scan/test returns success/failure response | Pending |
| AC4 | Service logs warning for wrong permissions | Pending |
| AC5 | Connection tries multiple keys in order | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | No keys found | get_available_keys() returns empty list; test_connection() returns error "No SSH keys configured in /app/ssh" | Phase 1, Step 1.2 | [ ] |
| 2 | Key permissions wrong | validate_key_permissions() checks stat.S_IMODE; logs warning with chmod 600 suggestion; continues operation | Phase 1, Step 1.2 | [ ] |
| 3 | Connection timeout | paramiko connect with timeout=10, auth_timeout=10; catch socket.timeout; return error "Connection timed out after 10s" | Phase 2, Step 2.2 | [ ] |
| 4 | Unknown host | SSHClient.set_missing_host_key_policy(AutoAddPolicy()); no strict host checking | Phase 1, Step 1.2 | [ ] |
| 5 | Key rejected | Loop through available keys; on AuthenticationException try next; if all fail return error with count of keys tried | Phase 1, Step 1.2 | [ ] |

### Coverage Summary

- Story edge cases: 5
- Handled in plan: 5
- Unhandled: 0

### Edge Case Implementation Notes

- **No keys found:** The service should still start and respond to settings endpoints. Only connection test should fail.
- **Key permissions:** Warning only, not blocking. Some Docker environments may not preserve permissions correctly.
- **Connection timeout:** Use separate timeout (connect) and auth_timeout (authentication phase) for clarity.
- **Unknown host:** Security trade-off acceptable for LAN-only homelab use case.
- **Key rejection:** Provides diagnostic info about how many keys were attempted.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| paramiko version incompatibility | Medium | Pin paramiko version in requirements.txt |
| Docker volume permissions differ by platform | Low | Log warning but don't block; document in README |
| SSH key format variations (RSA/Ed25519/ECDSA) | Low | Use PKey.from_path() which auto-detects key type |
| Blocking on slow SSH connections | Medium | Use asyncio.to_thread() for paramiko calls |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| paramiko | PyPI package | Add to requirements.txt |
| US0001: Database Schema | Story | Done - Config table exists |

## Open Questions

None - all questions resolved during planning.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing
- [x] API tests written and passing
- [x] Edge cases handled
- [x] Code follows Python best practices
- [x] No linting errors (ruff check)
- [x] Docker configuration updated
- [x] paramiko added to pyproject.toml

## Notes

- This is the foundation story for EP0006 Ad-hoc Scanning
- Subsequent stories (US0038-US0042) depend on this SSH service
- The test connection endpoint is synchronous for simplicity; actual scans in US0038 may use background tasks
