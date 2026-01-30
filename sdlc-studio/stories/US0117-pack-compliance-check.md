# US0117: Configuration Compliance Checker

> **Status:** Done
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-29
> **Completed:** 2026-01-29
> **Story Points:** 8

## User Story

**As a** system administrator
**I want** to check if a machine complies with a configuration pack
**So that** I know what's missing or different

## Context

### Persona Reference
**System Administrator** - Manages homelab infrastructure, needs standardised configurations across machines
[Full persona details](../personas.md#system-administrator)

### Background

Configuration compliance checking is the core feature of configuration management. It connects to a machine via SSH, inspects the current state (files, packages, settings), and compares against the expected state defined in a configuration pack (from US0116).

The compliance check must:
1. Execute commands via SSH using the existing `SSHPooledExecutor`
2. Check file existence, permissions, and content hashes
3. Check package installation status and versions
4. Check environment variable and configuration values
5. Return structured results with mismatch details

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | <10 seconds per machine | Parallel checks, efficient SSH commands |
| Epic | Dependency | US0116 ConfigPackService | Use existing pack loading |
| EP0008 | Infrastructure | SSHPooledExecutor | Use existing SSH execution |

---

## Acceptance Criteria

### AC1: Compliance Check API Endpoint
- **Given** a registered server with SSH connectivity
- **When** I call `POST /api/v1/servers/{id}/config/check` with `{"pack_name": "base"}`
- **Then** the endpoint returns a compliance check result with:
  - `is_compliant`: boolean
  - `mismatches`: array of mismatch objects
  - `checked_at`: ISO timestamp
  - `check_duration_ms`: integer

### AC2: File Compliance Checking
- **Given** a pack defines file `~/.bashrc.d/aliases.sh` with mode `0644`
- **When** the compliance check runs
- **Then** it checks:
  - File existence (missing_file if not found)
  - File permissions (wrong_permissions if differs)
  - Content hash if specified (wrong_content if differs)

### AC3: Package Compliance Checking
- **Given** a pack defines package `curl` with min_version `8.0.0`
- **When** the compliance check runs
- **Then** it checks:
  - Package installation (missing_package if not installed)
  - Version comparison (wrong_version if installed version < min_version)

### AC4: Setting Compliance Checking
- **Given** a pack defines setting `EDITOR=vim` of type `env_var`
- **When** the compliance check runs
- **Then** it checks the environment variable value (wrong_setting if differs)

### AC5: Check Duration Under 10 Seconds
- **Given** a configuration pack with up to 50 items
- **When** the compliance check runs
- **Then** the total check duration is under 10 seconds
- **And** commands are batched where possible to minimise SSH round-trips

### AC6: Results Stored in Database
- **Given** a compliance check completes
- **When** the check finishes
- **Then** the result is stored in a `ConfigCheck` table
- **And** includes: server_id, pack_name, is_compliant, mismatches (JSON), checked_at, check_duration_ms

### AC7: Server Offline Handling
- **Given** a server that is offline or SSH unreachable
- **When** I call the compliance check endpoint
- **Then** the endpoint returns 503 Service Unavailable with error details

### AC8: Pack Not Found Handling
- **Given** an invalid pack name
- **When** I call the compliance check endpoint
- **Then** the endpoint returns 404 Not Found with error message

---

## Scope

### In Scope
- `POST /api/v1/servers/{id}/config/check` endpoint
- File compliance checking (existence, permissions, content hash)
- Package compliance checking (installed, version)
- Setting compliance checking (env_var type)
- ConfigCheck database model and migration
- Mismatch result structures

### Out of Scope
- Diff view generation (US0118)
- Apply pack functionality (US0119)
- Automatic/scheduled compliance checking (US0122)
- Config file parsing (settings type: config) - env_var only for now

---

## Technical Notes

### API Contract

**Request:**
```http
POST /api/v1/servers/{server_id}/config/check
Content-Type: application/json

{
  "pack_name": "base"
}
```

**Response (200 OK):**
```json
{
  "server_id": "homeserver",
  "pack_name": "base",
  "is_compliant": false,
  "mismatches": [
    {
      "type": "missing_file",
      "item": "~/.bashrc.d/aliases.sh",
      "expected": {"exists": true, "mode": "0644"},
      "actual": {"exists": false}
    },
    {
      "type": "wrong_version",
      "item": "curl",
      "expected": {"installed": true, "min_version": "8.0.0"},
      "actual": {"installed": true, "version": "7.88.0"}
    }
  ],
  "checked_at": "2026-01-29T10:30:00Z",
  "check_duration_ms": 2450
}
```

### Mismatch Types

| Type | Description | Fields |
|------|-------------|--------|
| `missing_file` | File should exist but doesn't | item, expected.exists, actual.exists |
| `wrong_permissions` | File exists but wrong mode | item, expected.mode, actual.mode |
| `wrong_content` | File exists but content hash differs | item, expected.hash, actual.hash |
| `missing_package` | Package should be installed but isn't | item, expected.installed, actual.installed |
| `wrong_version` | Package version below minimum | item, expected.min_version, actual.version |
| `wrong_setting` | Environment variable value differs | item, expected.value, actual.value |

### SSH Command Strategy

Batch commands to minimise round-trips:

```bash
# File checks (batched)
for path in paths; do
  echo "---FILE:$path---"
  test -f "$path" && echo "EXISTS" || echo "MISSING"
  test -f "$path" && stat -c '%a' "$path"
  test -f "$path" && sha256sum "$path" | cut -d' ' -f1
done

# Package checks (batched)
dpkg-query -W -f='${Package}\t${Version}\t${Status}\n' curl git vim 2>/dev/null

# Setting checks (batched)
echo "EDITOR=$EDITOR"
echo "TERM=$TERM"
```

### Data Model

```python
class ConfigCheck(Base):
    __tablename__ = "config_check"

    id = Column(Integer, primary_key=True)
    server_id = Column(String, ForeignKey("server.id"), nullable=False)
    pack_name = Column(String, nullable=False)
    is_compliant = Column(Boolean, nullable=False)
    mismatches = Column(JSON, default=[])
    checked_at = Column(DateTime(timezone=True), server_default=func.now())
    check_duration_ms = Column(Integer)

    server = relationship("Server", back_populates="config_checks")
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server offline | Return 503 with error message |
| SSH authentication failure | Return 503 with auth error details |
| SSH timeout | Return 503 with timeout error |
| Pack not found | Return 404 with pack name in error |
| Server not found | Return 404 with server ID in error |
| Invalid pack_name in request | Return 422 validation error |
| SSH command fails mid-check | Continue checking other items, report partial results |
| File path has spaces | Properly quote paths in SSH commands |
| Package manager differs (apt vs yum) | Support dpkg for now, document limitation |
| Empty pack (no items) | Return is_compliant=true, empty mismatches |
| Home directory expansion (~) | Expand to actual user home directory |

---

## Test Scenarios

- [x] Verify endpoint returns 401 without auth
- [x] Verify endpoint returns 404 for unknown server
- [x] Verify endpoint returns 404 for unknown pack
- [x] Verify endpoint returns 422 for missing pack_name
- [x] Verify file existence check detects missing file
- [x] Verify file permission check detects wrong mode
- [x] Verify file content check detects hash mismatch
- [x] Verify package installed check detects missing package
- [x] Verify package version check detects old version
- [x] Verify setting check detects wrong env var value
- [x] Verify is_compliant is true when all checks pass
- [x] Verify is_compliant is false when any check fails
- [x] Verify results are stored in ConfigCheck table
- [x] Verify check_duration_ms is recorded
- [x] Verify check completes under 10 seconds for 50 items
- [x] Verify SSH connection errors return 503
- [x] Verify partial results returned on mid-check failure

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0116](US0116-configuration-pack-definitions.md) | Schema | ConfigPack, PackItems, ConfigPackService | Done |
| [US0079](US0079-ssh-connection-tailscale.md) | Service | SSHPooledExecutor | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| paramiko | Library | Available |
| SSH connectivity | Infrastructure | Required |

---

## Estimation

**Story Points:** 8
**Complexity:** High (SSH command orchestration, result parsing, database storage)

---

## Open Questions

None - dependencies are complete.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0010 |
| 2026-01-29 | Claude | Implementation complete - 21 tests passing |
