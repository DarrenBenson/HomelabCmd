# US0117: Configuration Compliance Checker

> **Status:** Done
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 8

## User Story

**As a** system administrator
**I want** to check if a machine complies with a configuration pack
**So that** I know what's missing or different

## Context

### Persona Reference
**System Administrator** - Needs to verify machine configurations match standards
[Full persona details](../personas.md#system-administrator)

### Background

Once configuration packs are defined (US0116), we need the ability to check a machine's actual configuration against the expected state. The compliance checker connects via SSH (using the existing SSH Executor from EP0013) to inspect files, packages, and settings on the target machine.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | <10s per machine | Parallel SSH commands |
| TRD | Architecture | SSH via Tailscale | Use existing SSHPooledExecutor |
| Epic | Security | Read-only check | No modifications during check |

---

## Acceptance Criteria

### AC1: Check Endpoint
- **Given** `POST /api/v1/servers/{id}/config/check`
- **When** called with `{"pack": "base"}`
- **Then** executes compliance check via SSH
- **And** returns compliance result within 10 seconds

### AC2: File Compliance Check
- **Given** a pack file item with path `~/.bashrc.d/aliases.sh`
- **When** checked
- **Then** verifies:
  - File exists
  - File permissions match expected mode
  - File content hash matches expected (if specified)

### AC3: Package Compliance Check
- **Given** a pack package item `curl >= 8.0.0`
- **When** checked
- **Then** verifies:
  - Package is installed
  - Installed version >= minimum version

### AC4: Setting Compliance Check
- **Given** a pack setting `EDITOR=vim` (type: env_var)
- **When** checked
- **Then** verifies the environment variable value matches

### AC5: Compliance Result Storage
- **Given** a completed check
- **When** results returned
- **Then** results stored in `ConfigCheck` table with:
  - machine_id, pack_name, is_compliant, mismatches JSON, checked_at, duration_ms

### AC6: Mismatch Types
- **Given** a non-compliant item
- **When** reported
- **Then** mismatch includes type:
  - `missing_file`, `wrong_permissions`, `wrong_content`
  - `missing_package`, `wrong_version`
  - `wrong_setting`

### AC7: Response Format
- **Given** a compliance check
- **When** complete
- **Then** response includes:
  ```json
  {
    "is_compliant": false,
    "pack": "base",
    "checked_at": "2026-01-28T10:00:00Z",
    "duration_ms": 2340,
    "summary": { "total": 12, "compliant": 10, "mismatched": 2 },
    "mismatches": [...]
  }
  ```

---

## Scope

### In Scope
- `POST /api/v1/servers/{id}/config/check` endpoint
- File existence, permission, and content checks
- Package installation and version checks
- Environment variable checks
- ConfigCheck database model and storage
- SSH command execution via existing executor

### Out of Scope
- Config file parsing (only hash comparison)
- Windows support (Linux only)
- Check scheduling (see US0122)
- Remediation (see US0119)

---

## Technical Notes

### Database Model

```python
class ConfigCheck(Base):
    __tablename__ = "config_check"

    id = Column(Integer, primary_key=True)
    server_id = Column(String, ForeignKey("server.id"), nullable=False)
    pack_name = Column(String, nullable=False)
    is_compliant = Column(Boolean, nullable=False)
    mismatches = Column(JSON, nullable=True)  # Array of mismatch objects
    checked_at = Column(DateTime, default=datetime.utcnow)
    check_duration_ms = Column(Integer)

    server = relationship("Server", back_populates="config_checks")
```

### Compliance Check Implementation

```python
async def check_compliance(server_id: UUID, pack_name: str) -> ConfigCheckResult:
    pack = await load_pack(pack_name)
    mismatches = []
    start = time.monotonic()

    # Check files (parallel where possible)
    for file in pack.files:
        cmd = f"test -f {file.path} && stat -c '%a' {file.path}"
        if file.content_hash:
            cmd += f" && sha256sum {file.path}"
        result = await ssh_executor.execute(server_id, cmd)

        if result.exit_code != 0:
            mismatches.append(FileMismatch(type="missing_file", path=file.path))
        elif not check_permissions(result, file.mode):
            mismatches.append(FileMismatch(type="wrong_permissions", ...))
        elif file.content_hash and not check_hash(result, file.content_hash):
            mismatches.append(FileMismatch(type="wrong_content", ...))

    # Check packages
    for package in pack.packages:
        result = await ssh_executor.execute(server_id,
            f"dpkg -l {package.name} 2>/dev/null | grep -E '^ii' | awk '{{print $3}}'")
        if result.exit_code != 0 or not result.stdout.strip():
            mismatches.append(PackageMismatch(type="missing_package", ...))
        elif not version_satisfies(result.stdout.strip(), package.min_version):
            mismatches.append(PackageMismatch(type="wrong_version", ...))

    # Check settings
    for setting in pack.settings:
        if setting.type == "env_var":
            result = await ssh_executor.execute(server_id, f"echo ${setting.key}")
            if result.stdout.strip() != setting.expected:
                mismatches.append(SettingMismatch(type="wrong_setting", ...))

    duration_ms = int((time.monotonic() - start) * 1000)
    return ConfigCheckResult(
        is_compliant=len(mismatches) == 0,
        mismatches=mismatches,
        duration_ms=duration_ms
    )
```

### SSH Command Batching

For performance, batch multiple checks into single SSH commands where possible:

```bash
# Single command to check multiple files
for f in ~/.bashrc ~/.gitconfig ~/.ssh/config; do
  test -f "$f" && stat -c "$f %a" "$f" || echo "$f MISSING"
done
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| SSH connection fails | Return error, don't store check result |
| SSH timeout (>30s) | Abort check, return partial results |
| File with spaces in path | Properly quote paths in SSH commands |
| Package manager not dpkg | Detect OS and use appropriate command |
| Home directory varies | Expand ~ to actual home directory |
| Permission denied on file | Report as mismatch with reason |
| Server offline | Return error immediately |

---

## Test Scenarios

- [ ] Verify check detects missing file
- [ ] Verify check detects wrong file permissions
- [ ] Verify check detects wrong file content
- [ ] Verify check detects missing package
- [ ] Verify check detects wrong package version
- [ ] Verify check detects wrong env var value
- [ ] Verify compliant machine returns is_compliant=true
- [ ] Verify check completes under 10 seconds
- [ ] Verify results stored in ConfigCheck table
- [ ] Verify SSH timeout handled gracefully

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0116 | Data | Pack definitions to check against | Done |
| EP0013 | Service | SSH Executor for remote commands | Complete |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| SSHPooledExecutor | Service | Available |
| Server model | Database | Available |

---

## Estimation

**Story Points:** 8
**Complexity:** High (SSH command orchestration, multiple check types, error handling)

---

## Open Questions

None

---

## Implementation Artefacts

| Artefact | Link | Status |
|----------|------|--------|
| Plan | [PL0181](../plans/PL0181-pack-compliance-check.md) | Complete |
| Test Spec | [TS0181](../test-specs/TS0181-pack-compliance-check.md) | Complete |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0095) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
| 2026-01-29 | Claude | Status: Draft → Planned. Plan PL0181 and Test Spec TS0181 created |
| 2026-01-29 | Claude | Status: Planned → Done. All 30 tests passing |
