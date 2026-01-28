# US0123: Remove Configuration Pack

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** to remove a configuration pack from a machine
**So that** I can uninstall development tools when no longer needed

## Context

### Persona Reference
**System Administrator** - Needs to clean up configurations when machine purpose changes
[Full persona details](../personas.md#system-administrator)

### Background

When a workstation is repurposed or a development environment is no longer needed, users may want to remove pack configurations. This story provides a "reverse apply" that removes files created by a pack. Packages are NOT removed to avoid breaking dependencies.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Safety | Don't break system | Packages NOT uninstalled |
| Epic | Recovery | Allow rollback | Backup files before deletion |

---

## Acceptance Criteria

### AC1: Remove Endpoint
- **Given** `DELETE /api/v1/servers/{id}/config/apply?pack={pack_name}`
- **When** called
- **Then** removes pack-specific items from the machine

### AC2: File Removal
- **Given** a file from the pack
- **When** remove executed
- **Then** file is deleted
- **And** backup created at `{path}.homelabcmd.bak`

### AC3: Package Preservation
- **Given** a package from the pack
- **When** remove executed
- **Then** package is NOT uninstalled
- **And** result notes "Package skipped - may break dependencies"

### AC4: Settings Cleanup
- **Given** an environment variable from the pack
- **When** remove executed
- **Then** the export line is removed from shell config

### AC5: Confirmation Required
- **Given** remove request
- **When** submitted without `confirm=true`
- **Then** returns preview of items to remove

### AC6: Warning Display
- **Given** remove confirmation modal
- **When** displayed
- **Then** shows warning: "Files will be deleted. Packages will remain installed."

### AC7: Audit Logging
- **Given** remove executed
- **When** complete
- **Then** audit log entry created with items removed

---

## Scope

### In Scope
- `DELETE /api/v1/servers/{id}/config/apply` endpoint
- File deletion with backup
- Setting removal from shell config
- Package skip with warning
- Confirmation flow
- Audit logging

### Out of Scope
- Package removal (too risky)
- Directory removal (only files)
- Restore from backup UI
- Undo functionality

---

## Technical Notes

### Remove Implementation

```python
async def remove_pack(
    server_id: UUID,
    pack_name: str,
    confirm: bool = False
) -> RemoveResult:
    pack = await load_pack(pack_name)
    results = []

    if not confirm:
        # Preview mode
        for file in pack.files:
            results.append(RemovePreviewItem(
                type="file",
                path=file.path,
                action="delete",
                note="Will create backup at {path}.homelabcmd.bak"
            ))
        for package in pack.packages:
            results.append(RemovePreviewItem(
                type="package",
                name=package.name,
                action="skip",
                note="Packages not removed - may break dependencies"
            ))
        for setting in pack.settings:
            results.append(RemovePreviewItem(
                type="setting",
                key=setting.key,
                action="remove",
                note="Will remove from shell config"
            ))
        return RemoveResult(preview=True, items=results)

    # Execute removal
    for file in pack.files:
        # Backup first
        backup_result = await ssh_executor.execute(server_id,
            f"cp {file.path} {file.path}.homelabcmd.bak 2>/dev/null || true")
        # Delete file
        result = await ssh_executor.execute(server_id,
            f"rm -f {file.path}")
        results.append(RemoveItemResult(
            type="file",
            path=file.path,
            action="deleted",
            success=result.exit_code == 0,
            backup_path=f"{file.path}.homelabcmd.bak"
        ))

    # Packages - explicitly skip
    for package in pack.packages:
        results.append(RemoveItemResult(
            type="package",
            name=package.name,
            action="skipped",
            success=True,
            note="Not removed - may break dependencies"
        ))

    # Settings - remove from shell config
    for setting in pack.settings:
        if setting.type == "env_var":
            # Remove export line from .bashrc.d/env.sh
            await ssh_executor.execute(server_id,
                f"sed -i '/^export {setting.key}=/d' ~/.bashrc.d/env.sh 2>/dev/null || true")
            results.append(RemoveItemResult(
                type="setting",
                key=setting.key,
                action="removed",
                success=True
            ))

    # Audit log
    await create_audit_log(
        server_id=server_id,
        action="config_remove",
        pack_name=pack_name,
        items_removed=len([r for r in results if r.action in ("deleted", "removed")]),
        triggered_by="user"
    )

    return RemoveResult(
        preview=False,
        success=True,
        items=results,
        removed_at=datetime.utcnow()
    )
```

### Confirmation Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Remove Developer Max Pack from StudyPC                       │
├─────────────────────────────────────────────────────────────┤
│ ⚠️  Warning: This will delete configuration files.          │
│                                                              │
│ The following will be DELETED (backups created):            │
│   • ~/.bashrc.d/aliases.sh                                  │
│   • ~/.config/ghostty/config                                │
│   • ~/.config/starship.toml                                 │
│                                                              │
│ The following will be REMOVED from shell config:            │
│   • EDITOR environment variable                             │
│                                                              │
│ The following will remain UNCHANGED:                        │
│   • curl (package - not removed)                            │
│   • nodejs (package - not removed)                          │
│   • docker-ce (package - not removed)                       │
│                                                              │
│ 💡 Tip: Packages are not removed as they may be            │
│    dependencies for other software.                         │
│                                                              │
│              [Cancel]  [Remove Files]                        │
└─────────────────────────────────────────────────────────────┘
```

### Results Display

```
┌─────────────────────────────────────────────────────────────┐
│ Pack Removal Complete                                        │
├─────────────────────────────────────────────────────────────┤
│ ✅ ~/.bashrc.d/aliases.sh deleted                           │
│    Backup: ~/.bashrc.d/aliases.sh.homelabcmd.bak           │
│                                                              │
│ ✅ ~/.config/ghostty/config deleted                         │
│    Backup: ~/.config/ghostty/config.homelabcmd.bak         │
│                                                              │
│ ⏭️  curl skipped (package)                                   │
│ ⏭️  nodejs skipped (package)                                 │
│                                                              │
│ ✅ EDITOR removed from shell config                         │
│                                                              │
│ 💡 To restore files, copy from .homelabcmd.bak backups     │
│                                                              │
│                    [Done]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| File doesn't exist | Skip with "already removed" note |
| Backup fails | Proceed anyway, log warning |
| File deletion fails | Report error, continue with others |
| Setting not in config | Skip with "not found" note |
| Pack not assigned | Allow removal anyway (clean up) |
| SSH connection fails | Abort, no changes made |

---

## Test Scenarios

- [ ] Verify preview mode returns items list
- [ ] Verify file deleted with backup created
- [ ] Verify packages are NOT uninstalled
- [ ] Verify env var removed from shell config
- [ ] Verify audit log created
- [ ] Verify confirmation required
- [ ] Verify backup path returned in results
- [ ] Verify non-existent file handled gracefully

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0116 | Data | Pack definitions | Draft |
| US0119 | Pattern | Apply implementation pattern | Draft |
| EP0013 | Service | SSH Executor | Complete |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| SSHPooledExecutor | Service | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium (simpler than apply, just deletion)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0101) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
