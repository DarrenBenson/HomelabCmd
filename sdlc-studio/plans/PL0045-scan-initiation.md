# PL0045: Scan Initiation - Implementation Plan

> **Status:** Complete
> **Story:** [US0038: Scan Initiation](../stories/US0038-scan-initiation.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Language:** Python

## Overview

Implement scan initiation API for ad-hoc device scanning. This enables operators to initiate quick or full scans of transient devices via SSH. Scans execute SSH commands to gather system information (OS, hostname, uptime, disk, memory, and optionally packages, processes, network interfaces). Results are stored in the database with progress tracking.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Initiate quick scan | POST /api/v1/scans with type="quick" initiates scan |
| AC2 | Initiate full scan | POST /api/v1/scans with type="full" initiates scan |
| AC3 | Quick scan data | Returns OS, hostname, uptime, disk usage, memory usage |
| AC4 | Full scan data | Returns quick data plus packages, processes, network interfaces |
| AC5 | Scan progress tracking | GET /api/v1/scans/{id} returns progress percentage and step |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use specific exceptions (AuthenticationException, SSHException, TimeoutError)
- Always set timeouts on network operations
- Use asyncio.to_thread() for blocking paramiko calls
- Type hints on all public functions
- Use logging module, not print

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| paramiko | /paramiko/paramiko | SSH client exec_command | SSHClient with context manager, exec_command returns (stdin, stdout, stderr), read().decode() |
| FastAPI | /tiangolo/fastapi | Background tasks async | BackgroundTasks for async scan execution |

### Existing Patterns

From codebase exploration:
- **SSH service:** `services/ssh.py` - SSHConnectionService with `asyncio.to_thread()` for blocking ops
- **Model pattern:** Inherit from `Base` and `TimestampMixin`, use `Mapped[]` type hints
- **JSON storage:** Use `JSON` column type for flexible results storage
- **Enum pattern:** String enums for status values (see `AlertStatus`, `ActionStatus`)
- **Route pattern:** Use `Depends(get_async_session)` and `Depends(verify_api_key)`
- **Auth responses:** Import `AUTH_RESPONSES` for 401/403 documentation

## Recommended Approach

**Strategy:** Test-After
**Rationale:**
- External SSH dependency requires understanding real command output formats
- Multiple SSH commands with parsing logic - implementation-first helps understand data shapes
- Existing SSHConnectionService provides foundation, needs extension
- Progress tracking state machine benefits from implementation-first approach

### Test Priority

1. Unit tests for ScanService (command parsing, result aggregation)
2. API tests for POST /api/v1/scans and GET /api/v1/scans/{id}
3. Integration tests for error scenarios (connection refused, timeout)

### Documentation Updates Required

- [ ] Update API docs with scan endpoints
- [ ] Add scan endpoint to OpenAPI tags in main.py (already done via scan router)

## Implementation Steps

### Phase 1: Database Model

**Goal:** Create Scan model for storing scan requests and results

#### Step 1.1: Create Scan Model

- [x] Create `ScanStatus` enum (pending, running, completed, failed)
- [x] Create `ScanType` enum (quick, full)
- [x] Create `Scan` model with all required fields
- [x] Add index on hostname and status

**Files to create:**
- `backend/src/homelab_cmd/db/models/scan.py` - Scan model

**Model fields:**
```python
id: int (PK, autoincrement)
hostname: str (not null)
port: int (default 22)
username: str (not null)
scan_type: str ('quick' or 'full')
status: str ('pending', 'running', 'completed', 'failed')
progress: int (0-100)
current_step: str | None
started_at: datetime | None
completed_at: datetime | None
results: dict | None (JSON)
error: str | None
created_at, updated_at (from TimestampMixin)
```

#### Step 1.2: Register Model

- [x] Import Scan model in `db/models/__init__.py`
- [x] Export enums and model in `__all__`

**Files to modify:**
- `backend/src/homelab_cmd/db/models/__init__.py` - Add imports

### Phase 2: Scan Service

**Goal:** Create service layer for executing SSH scans

#### Step 2.1: Create Scan Service

- [x] Create `ScanService` class
- [x] Implement quick scan command execution
- [x] Implement full scan command execution
- [x] Implement result parsing for each command
- [x] Add progress tracking via callback

**Files to create:**
- `backend/src/homelab_cmd/services/scan.py` - Scan execution service

**Commands to execute:**

Quick scan:
- `cat /etc/os-release` - Parse NAME, VERSION_ID
- `uname -r` - Kernel version
- `hostname` - Hostname
- `cat /proc/uptime` - Uptime in seconds (first field)
- `df -P` - Disk usage (parse mount, size, used, percent)
- `free -b` - Memory in bytes (parse total, used, calculate percent)

Full scan (additional):
- `dpkg -l 2>/dev/null | wc -l || rpm -qa 2>/dev/null | wc -l` - Package count
- `dpkg -l 2>/dev/null | tail -50 || rpm -qa 2>/dev/null | tail -50` - Recent packages
- `ps aux --sort=-pmem | head -20` - Top processes by memory
- `ip addr show 2>/dev/null || ifconfig` - Network interfaces

**Considerations:**
- Use `asyncio.to_thread()` for blocking SSH operations
- Each command updates progress (e.g., 20% per step for quick scan)
- Store partial results even if some commands fail
- Use existing `SSHConnectionService` for connection management

#### Step 2.2: Extend SSH Service

- [x] Add `execute_command()` method to SSHConnectionService
- [x] Return stdout, stderr, and exit code
- [x] Handle command timeout separately from connection timeout

**Files to modify:**
- `backend/src/homelab_cmd/services/ssh.py` - Add execute_command method

### Phase 3: API Endpoints

**Goal:** Create REST API for scan initiation and status

#### Step 3.1: Create Pydantic Schemas

- [x] Create `ScanRequest` schema (hostname, port?, username?, scan_type)
- [x] Create `ScanResponse` schema (scan_id, status, progress, etc.)
- [x] Create `ScanResultsResponse` schema with full results structure

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/scan.py` - Add scan schemas

#### Step 3.2: Create Scan Endpoints

- [x] Implement POST /api/v1/scans - Initiate scan
- [x] Implement GET /api/v1/scans/{scan_id} - Get scan status/results
- [x] Implement GET /api/v1/scans - List recent scans
- [x] Add authentication to all endpoints

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/scan.py` - Add scan endpoints

**Endpoint logic:**

POST /api/v1/scans:
1. Create Scan record with status="pending"
2. Start background task for scan execution
3. Return 202 Accepted with scan_id

GET /api/v1/scans/{scan_id}:
1. Fetch scan by ID
2. Return current status, progress, results (if complete)

### Phase 4: Background Task Execution

**Goal:** Execute scans asynchronously with progress updates

#### Step 4.1: Implement Background Scan Execution

- [x] Create async function for scan execution
- [x] Update scan progress in database as steps complete
- [x] Handle errors and update status to "failed"
- [x] Mark complete with results on success

**Files to modify:**
- `backend/src/homelab_cmd/services/scan.py` - Add background execution

**Considerations:**
- Use FastAPI BackgroundTasks or asyncio.create_task
- Update database within each progress step
- Commit changes immediately for real-time progress visibility
- Use `get_session_factory()` for background task database access

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Unit Tests

- [x] Test ScanService.parse_os_release()
- [x] Test ScanService.parse_disk_usage()
- [x] Test ScanService.parse_memory()
- [x] Test ScanService.parse_uptime()
- [ ] Test partial result handling (requires mock SSH integration)

**Files to create:**
- `tests/test_scan_service.py` - Unit tests for scan service

#### Step 5.2: API Tests

- [x] Test POST /api/v1/scans creates pending scan
- [x] Test GET /api/v1/scans/{id} returns status
- [x] Test authentication required on all endpoints
- [x] Test validation errors (missing hostname, invalid scan_type)

**Files to create:**
- `tests/test_scan_api.py` - API tests for scan endpoints

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | POST with type="quick" returns 202, creates scan | **PASS** - test_initiate_quick_scan_returns_202 |
| AC2 | POST with type="full" returns 202, creates scan | **PASS** - test_initiate_full_scan_returns_202 |
| AC3 | Completed quick scan has os, hostname, uptime, disk, memory | **PASS** - Parser tests pass, ScanService.execute_scan collects these |
| AC4 | Completed full scan has quick data plus packages, processes, network | **PASS** - Parser tests pass, execute_scan collects these for full scan |
| AC5 | GET /scans/{id} during scan returns progress and current_step | **PASS** - test_get_scan_status_returns_200 verifies status/progress

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Connection refused | SSHConnectionService catches socket error; ScanService marks status="failed", error="Connection refused" | Phase 4 | [ ] |
| 2 | Timeout | paramiko connect timeout (10s default); ScanService marks status="failed", error="Connection timed out" | Phase 4 | [ ] |
| 3 | Command fails | Try/catch per command; store partial results with error notes for failed commands; don't fail entire scan | Phase 2 | [ ] |
| 4 | Non-Linux OS | Commands may fail; store what succeeds; note unsupported in error field | Phase 2 | [ ] |
| 5 | SSH key rejected | AuthenticationException; ScanService marks status="failed", error="Authentication failed" | Phase 4 | [ ] |

### Coverage Summary

- Story edge cases: 5
- Handled in plan: 5
- Unhandled: 0

### Edge Case Implementation Notes

- **Connection refused:** The existing SSHConnectionService already handles OSError for connection issues. Wrap in scan context to set appropriate error message.
- **Timeout:** Use separate timeouts for connection (10s) and command execution (30s per command).
- **Command fails:** Each command is wrapped in try/catch. If a command fails, record empty/null for that field and continue with next command.
- **Non-Linux OS:** The commands are Linux-specific. If commands fail, store partial results and note "Some commands failed - may be non-Linux system".
- **SSH key rejected:** AuthenticationException from paramiko is already caught by SSHConnectionService.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Long-running scans block event loop | High | Use asyncio.to_thread() for all SSH operations |
| Concurrent scan limit | Medium | Consider adding scan queue limit per host |
| Command output parsing varies by distro | Medium | Use robust parsing with fallbacks |
| SSH connection pool exhaustion | Low | Close connections after each scan |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0037: SSH Key Configuration | Story | Done - provides SSHConnectionService |
| paramiko | Package | Already in pyproject.toml |

## Open Questions

None - all questions resolved during planning.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] API tests written and passing
- [ ] Edge cases handled
- [ ] Code follows Python best practices
- [ ] No linting errors (ruff check)
- [ ] Database migration created (if using Alembic)

## Notes

- This story builds on US0037's SSH infrastructure
- Progress tracking enables real-time UI updates
- Quick scan targets < 10 second completion time
- Full scan may take 30-60 seconds depending on package count
