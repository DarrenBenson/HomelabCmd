# US0119: Apply Configuration Pack

> **Status:** Done
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 8

## User Story

**As a** system administrator
**I want** to apply a configuration pack to a machine with one click
**So that** I can quickly standardise machine configuration

## Context

### Persona Reference
**System Administrator** - Needs efficient way to remediate configuration drift
[Full persona details](../personas.md#system-administrator)

### Background

After seeing the configuration diff (US0118), users need the ability to apply the expected configuration to bring a machine into compliance. This story implements the "Apply Pack" action that installs missing packages, creates/updates files, and sets configuration values via SSH.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| TRD | Architecture | SSH via Tailscale | Use existing SSHPooledExecutor |
| Epic | UX | Preview before apply | Dry-run required |
| Epic | Security | Audit trail | Log all changes |

---

## Acceptance Criteria

### AC1: Apply Endpoint
- **Given** `POST /api/v1/servers/{id}/config/apply`
- **When** called with `{"pack": "developer-max"}`
- **Then** applies all pack items via SSH

### AC2: Dry-Run Option
- **Given** apply request with `{"pack": "developer-max", "dry_run": true}`
- **When** executed
- **Then** returns preview of changes without applying:
  - Files to create/update
  - Packages to install
  - Settings to change

### AC3: File Creation
- **Given** a missing file in the pack
- **When** apply executed
- **Then** file created with:
  - Content from template or inline
  - Correct permissions (mode)
  - Parent directories created if needed

### AC4: Package Installation
- **Given** a missing or outdated package
- **When** apply executed
- **Then** package installed via `apt-get install -y`
- **And** uses sudo for elevated privileges

### AC5: Progress Tracking
- **Given** an apply operation
- **When** in progress
- **Then** frontend shows:
  - Current item being processed
  - Success/failure per item
  - Overall progress percentage

### AC6: Result Details
- **Given** apply completes
- **When** response returned
- **Then** includes per-item results:
  - Item path/name
  - Action taken (created, updated, installed)
  - Success/failure
  - Error message if failed

### AC7: Audit Logging
- **Given** an apply operation
- **When** executed
- **Then** audit log entry created with:
  - Server ID, pack name
  - User who triggered apply
  - Items changed
  - Timestamp

### AC8: Auto-Recheck
- **Given** apply completes successfully
- **When** operation finishes
- **Then** compliance re-check triggered automatically

---

## Scope

### In Scope
- `POST /api/v1/servers/{id}/config/apply` endpoint
- Dry-run preview mode
- File creation with templates
- Package installation via apt
- Progress tracking and results
- Audit logging
- Automatic re-check after apply

### Out of Scope
- Rollback on partial failure
- Non-apt package managers (yum, dnf)
- Windows support
- Selective item apply (all or nothing)

---

## Technical Notes

### Apply Implementation

```python
async def apply_pack(
    server_id: UUID,
    pack_name: str,
    dry_run: bool = False
) -> ApplyResult:
    pack = await load_pack(pack_name)
    results = []

    # Files
    for file in pack.files:
        if dry_run:
            results.append(DryRunItem(
                action="create_file",
                path=file.path,
                description=f"Create {file.path} with mode {file.mode}"
            ))
        else:
            content = await render_template(file.template) if file.template else file.content
            # Create parent directories
            await ssh_executor.execute(server_id, f"mkdir -p $(dirname {file.path})")
            # Create file with content
            result = await ssh_executor.execute(server_id,
                f"cat > {file.path} << 'HOMELABCMD_EOF'\n{content}\nHOMELABCMD_EOF")
            # Set permissions
            await ssh_executor.execute(server_id, f"chmod {file.mode} {file.path}")
            results.append(ApplyItemResult(
                item=file.path,
                action="created",
                success=result.exit_code == 0,
                error=result.stderr if result.exit_code != 0 else None
            ))

    # Packages
    for package in pack.packages:
        if dry_run:
            results.append(DryRunItem(
                action="install_package",
                package=package.name,
                description=f"Install {package.name} >= {package.min_version}"
            ))
        else:
            result = await ssh_executor.execute(server_id,
                f"sudo apt-get install -y {package.name}")
            results.append(ApplyItemResult(
                item=package.name,
                action="installed",
                success=result.exit_code == 0,
                error=result.stderr if result.exit_code != 0 else None
            ))

    # Settings (env vars in .bashrc)
    for setting in pack.settings:
        if setting.type == "env_var":
            if dry_run:
                results.append(DryRunItem(
                    action="set_env_var",
                    key=setting.key,
                    value=setting.expected
                ))
            else:
                # Add to .bashrc.d/env.sh
                await ssh_executor.execute(server_id,
                    f"echo 'export {setting.key}=\"{setting.expected}\"' >> ~/.bashrc.d/env.sh")
                results.append(ApplyItemResult(
                    item=f"env:{setting.key}",
                    action="set",
                    success=True
                ))

    # Create audit log
    if not dry_run:
        await create_audit_log(
            server_id=server_id,
            action="config_apply",
            pack_name=pack_name,
            items_changed=len([r for r in results if r.success]),
            triggered_by="user"
        )

    return ApplyResult(
        dry_run=dry_run,
        success=all(r.success for r in results if isinstance(r, ApplyItemResult)),
        items=results,
        applied_at=datetime.utcnow() if not dry_run else None
    )
```

### Preview Modal UI

```
┌─────────────────────────────────────────────────────────────┐
│ Apply Developer Max Pack to StudyPC                          │
├─────────────────────────────────────────────────────────────┤
│ This will make the following changes:                        │
│                                                              │
│ 📁 Files to create/update:                                   │
│   • ~/.bashrc.d/aliases.sh (0644)                           │
│   • ~/.config/ghostty/config (0644)                         │
│   • ~/.config/starship.toml (0644)                          │
│                                                              │
│ 📦 Packages to install:                                      │
│   • curl (upgrade to >= 8.5.0)                              │
│   • nodejs (install >= 20.0.0)                              │
│                                                              │
│ ⚙️  Settings to change:                                      │
│   • EDITOR = vim                                            │
│                                                              │
│ ⚠️  This will execute commands with sudo on the target       │
│    machine. Ensure you trust this pack's contents.          │
│                                                              │
│              [Cancel]  [Confirm and Apply]                   │
└─────────────────────────────────────────────────────────────┘
```

### Progress UI

```
┌─────────────────────────────────────────────────────────────┐
│ Applying Developer Max Pack...                               │
├─────────────────────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░ 40%                │
│                                                              │
│ ✅ ~/.bashrc.d/aliases.sh created                           │
│ ✅ curl upgraded to 8.5.0                                   │
│ 🔄 Installing nodejs...                                     │
│ ⏳ ~/.config/ghostty/config                                  │
│ ⏳ ~/.config/starship.toml                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| SSH connection fails | Return error, no changes made |
| Single item fails | Continue with remaining items, report partial |
| Sudo password required | Use credential from CredentialService |
| File content has special chars | Use heredoc with unique delimiter |
| Package not in apt repos | Report failure with apt error message |
| Disk full | Report failure, suggest cleanup |
| Network interruption during apply | Report partial results, items may be inconsistent |

---

## Test Scenarios

- [ ] Verify dry-run returns preview without changes
- [ ] Verify file created with correct content
- [ ] Verify file created with correct permissions
- [ ] Verify parent directories created
- [ ] Verify package installed via apt
- [ ] Verify env var added to .bashrc.d
- [ ] Verify progress reported during apply
- [ ] Verify results include per-item status
- [ ] Verify audit log created
- [ ] Verify re-check triggered after apply
- [ ] Verify partial failure handled gracefully

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0116 | Data | Pack definitions | Done |
| US0118 | UX | Diff view (apply button) | Done |
| EP0013 | Service | SSH Executor | Complete |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| SSHPooledExecutor | Service | Available |
| CredentialService | Service | Available |

---

## Estimation

**Story Points:** 8
**Complexity:** High (SSH orchestration, error handling, UI progress)

---

## Open Questions

None

---

## Implementation Artefacts

| Artefact | Link | Status |
|----------|------|--------|
| Plan | [PL0183](../plans/PL0183-apply-configuration-pack.md) | Complete |
| Test Spec | [TS0183](../test-specs/TS0183-apply-configuration-pack.md) | Complete |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0097) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
| 2026-01-29 | Claude | Implementation complete. 48 tests passing (17 backend + 31 frontend) |
