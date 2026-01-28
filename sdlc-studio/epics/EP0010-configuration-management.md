# EP0010: Configuration Management

> **Status:** Draft
> **Owner:** Darren
> **Created:** 2026-01-26
> **Target Release:** Phase 3 (GA)
> **Story Points:** 42

---

## Overview

Enable HomelabCmd to check, compare, and apply standardised configuration packs across machines. This ensures workstations and servers maintain consistent environments (shell configuration, development tools, API keys) with visibility into compliance status and one-click remediation.

**Key Concept:** Configuration packs are optional blueprints. Check → Diff → Apply workflow. Warnings, not blocks.

---

## Goals

### Primary Goals
- Define configuration packs (Base, Developer Lite, Developer Max)
- Check machine configuration compliance via SSH
- Show diff view comparing expected vs actual configuration
- Apply configuration standards with one-click "Apply Pack" button
- Track compliance status across all machines
- Display compliance dashboard widget

### Success Criteria
- Configuration packs defined with files, packages, and settings
- Compliance check completes in <10 seconds per machine
- Diff view shows clear expected vs actual comparison
- Apply action executes via SSH synchronously
- Compliance dashboard shows status for all machines
- Non-compliant machines show warnings (not blocking errors)

---

## User Stories

### US0116: Configuration Pack Definitions
**Story Points:** 5
**Priority:** P0
**Dependencies:** None

**As a** system administrator
**I want** configuration packs defined in YAML format
**So that** I can standardise what configurations should be checked

**Acceptance Criteria:**
- [ ] Base Pack defined with essential Linux configs
- [ ] Developer Lite Pack defined with basic dev tools
- [ ] Developer Max Pack contains all of Developer Lite plus additional tools
- [ ] Pack format specifies: files (path, content hash), packages (name, min version), settings (key, expected value)
- [ ] Packs stored in `data/config-packs/` as YAML files
- [ ] API endpoint to list available packs: `GET /api/v1/config/packs`
- [ ] Pack metadata includes: name, description, item count, last updated

**Technical Notes:**
- Pack structure:
  ```yaml
  # base-pack.yaml
  name: Base Pack
  description: Essential Linux environment configuration
  items:
    files:
      - path: ~/.bashrc.d/aliases.sh
        mode: 0644
        content_hash: sha256:abc123...  # or template reference
      - path: ~/.config/starship.toml
        mode: 0644
        template: starship-config.toml
    packages:
      - name: curl
        min_version: "8.0.0"
      - name: git
        min_version: "2.40.0"
    settings:
      - key: EDITOR
        expected: vim
        type: env_var
  ```

**Pack Hierarchy:**
```
Base Pack (all machines)
  ├── Shell aliases and functions
  ├── Git configuration
  ├── SSH agent configuration
  └── Core utilities (curl, wget, jq, yq)

Developer Lite Pack (extends Base)
  ├── Ghostty terminal config
  ├── Starship prompt config
  ├── Python development tools
  └── Node.js LTS

Developer Max Pack (extends Developer Lite)
  ├── AI tooling (Claude Code, OpenCode, Ollama config)
  ├── Container tools (Docker, Podman)
  ├── Language servers and linters
  └── Full development environment
```

---

### US0117: Configuration Compliance Checker
**Story Points:** 8
**Priority:** P0
**Dependencies:** US0116, EP0013 (SSH Executor)

**As a** system administrator
**I want** to check if a machine complies with a configuration pack
**So that** I know what's missing or different

**Acceptance Criteria:**
- [ ] API endpoint: `POST /api/v1/machines/{id}/config/check`
- [ ] Check executes via SSH using synchronous executor
- [ ] File checks: existence, permissions, content hash
- [ ] Package checks: installed, version >= minimum
- [ ] Setting checks: environment variable values
- [ ] Check completes in <10 seconds per machine
- [ ] Results stored in `ConfigCheck` table
- [ ] Returns compliance status and mismatch array

**Technical Notes:**
- Compliance check implementation:
  ```python
  async def check_compliance(machine_id: UUID, pack_name: str) -> ConfigCheckResult:
      pack = load_pack(pack_name)
      mismatches = []

      for file in pack.files:
          result = await ssh_executor.execute(machine_id,
              f"test -f {file.path} && stat -c '%a' {file.path} && sha256sum {file.path}")
          if not matches_expected(result, file):
              mismatches.append(FileMismatch(path=file.path, expected=..., actual=...))

      for package in pack.packages:
          result = await ssh_executor.execute(machine_id,
              f"dpkg -l {package.name} 2>/dev/null | grep -E '^ii'")
          # Parse version, compare

      return ConfigCheckResult(
          is_compliant=len(mismatches) == 0,
          mismatches=mismatches,
          checked_at=datetime.utcnow()
      )
  ```

**Mismatch Types:**
```
- missing_file: File should exist but doesn't
- wrong_permissions: File exists but wrong permissions
- wrong_content: File exists but content differs
- missing_package: Package should be installed but isn't
- wrong_version: Package installed but version too old
- wrong_setting: Environment variable or config value differs
```

---

### US0118: Configuration Diff View
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0117

**As a** system administrator
**I want** to see a diff between expected and actual configuration
**So that** I understand exactly what needs to change

**Acceptance Criteria:**
- [ ] API endpoint: `GET /api/v1/machines/{id}/config/diff?pack={pack_name}`
- [ ] Returns structured diff for all mismatched items
- [ ] File content diffs in unified diff format
- [ ] Package version comparisons with expected vs actual
- [ ] Setting comparisons with expected vs actual values
- [ ] Frontend displays diff in readable format
- [ ] Colour-coded: additions (green), deletions (red), changes (yellow)
- [ ] Collapsible sections per mismatch type

**Technical Notes:**
- Diff response format:
  ```json
  {
    "machine_id": "studypc",
    "pack_name": "developer_max",
    "is_compliant": false,
    "summary": {
      "total_items": 45,
      "compliant": 42,
      "mismatched": 3
    },
    "mismatches": [
      {
        "type": "missing_file",
        "path": "~/.bashrc.d/aliases.sh",
        "expected": {"exists": true, "mode": "0644"},
        "actual": {"exists": false}
      },
      {
        "type": "wrong_version",
        "package": "curl",
        "expected": "8.5.0",
        "actual": "8.2.0"
      },
      {
        "type": "file_content_diff",
        "path": "~/.config/ghostty/config",
        "diff": "--- expected\n+++ actual\n@@ -1,3 +1,3 @@\n font-size = 14\n-theme = catppuccin-mocha\n+theme = default"
      }
    ]
  }
  ```

**UI Mockup:**
```
┌────────────────────────────────────────────────────────────┐
│ Configuration Compliance: StudyPC                          │
│ Pack: Developer Max                   [Check Again]        │
├────────────────────────────────────────────────────────────┤
│ ⚠️ 3 mismatches found                                       │
│                                                            │
│ ▼ Missing Files (1)                                        │
│   ┌────────────────────────────────────────────────────┐  │
│   │ ~/.bashrc.d/aliases.sh                              │  │
│   │ Expected: file should exist with mode 0644          │  │
│   │ Actual: file not found                              │  │
│   └────────────────────────────────────────────────────┘  │
│                                                            │
│ ▼ Version Mismatches (1)                                   │
│   ┌────────────────────────────────────────────────────┐  │
│   │ Package: curl                                       │  │
│   │ Expected: >= 8.5.0                                  │  │
│   │ Actual: 8.2.0                                       │  │
│   └────────────────────────────────────────────────────┘  │
│                                                            │
│ ▼ Content Differences (1)                                  │
│   ┌────────────────────────────────────────────────────┐  │
│   │ ~/.config/ghostty/config                            │  │
│   │  font-size = 14                                     │  │
│   │ -theme = catppuccin-mocha                           │  │
│   │ +theme = default                                    │  │
│   └────────────────────────────────────────────────────┘  │
│                                                            │
│                    [Apply Developer Max Pack]              │
└────────────────────────────────────────────────────────────┘
```

---

### US0119: Apply Configuration Pack
**Story Points:** 8
**Priority:** P0
**Dependencies:** US0118, EP0013 (SSH Executor)

**As a** system administrator
**I want** to apply a configuration pack to a machine with one click
**So that** I can quickly standardise machine configuration

**Acceptance Criteria:**
- [ ] API endpoint: `POST /api/v1/machines/{id}/config/apply`
- [ ] Request body includes pack name and optional item filter
- [ ] Previews changes before applying (dry-run option)
- [ ] Executes via SSH synchronously
- [ ] Installs missing packages via apt
- [ ] Creates/updates files with correct permissions
- [ ] Sets environment variables in appropriate shell config
- [ ] Returns detailed result with success/failure per item
- [ ] Creates audit log entry for apply action
- [ ] Frontend shows progress and results

**Technical Notes:**
- Apply implementation:
  ```python
  async def apply_pack(machine_id: UUID, pack_name: str, dry_run: bool = False) -> ApplyResult:
      pack = load_pack(pack_name)
      results = []

      for file in pack.files:
          if dry_run:
              results.append(DryRunResult(action="create_file", path=file.path))
          else:
              # Upload file content via SSH
              content = render_template(file.template) if file.template else file.content
              result = await ssh_executor.execute(machine_id,
                  f"cat > {file.path} << 'EOF'\n{content}\nEOF && chmod {file.mode} {file.path}")
              results.append(ApplyItemResult(item=file.path, success=result.exit_code == 0))

      for package in pack.packages:
          if dry_run:
              results.append(DryRunResult(action="install_package", package=package.name))
          else:
              result = await ssh_executor.execute(machine_id,
                  f"sudo apt-get install -y {package.name}")
              results.append(ApplyItemResult(item=package.name, success=result.exit_code == 0))

      return ApplyResult(
          success=all(r.success for r in results if not isinstance(r, DryRunResult)),
          items=results,
          applied_at=datetime.utcnow()
      )
  ```

**Apply Workflow:**
```
User clicks "Apply Developer Max Pack"
    ↓
Preview modal shows:
  - 3 files to create
  - 2 packages to install
  - 1 setting to update
    ↓
User clicks "Confirm Apply"
    ↓
SSH executes commands synchronously
    ↓
Progress indicator shows current item
    ↓
Results displayed:
  ✅ ~/.bashrc.d/aliases.sh created
  ✅ curl upgraded to 8.5.0
  ✅ ~/.config/ghostty/config updated
    ↓
Compliance re-check triggered automatically
```

---

### US0120: Compliance Dashboard Widget
**Story Points:** 5
**Priority:** P1
**Dependencies:** US0117

**As a** system administrator
**I want** to see compliance status for all machines on the dashboard
**So that** I have quick visibility into configuration health

**Acceptance Criteria:**
- [ ] API endpoint: `GET /api/v1/config/compliance`
- [ ] Returns summary for all machines with latest check status
- [ ] Dashboard widget shows: compliant count, non-compliant count, never checked count
- [ ] Clicking widget navigates to configuration management page
- [ ] Widget colour-coded: green (all compliant), amber (some non-compliant), grey (never checked)
- [ ] Machine list within widget shows per-machine status
- [ ] Refresh button triggers re-check for all machines

**Technical Notes:**
- Summary response:
  ```json
  {
    "summary": {
      "compliant": 8,
      "non_compliant": 3,
      "never_checked": 2,
      "total": 13
    },
    "machines": [
      {"id": "homeserver", "status": "compliant", "pack": "base", "checked_at": "..."},
      {"id": "studypc", "status": "non_compliant", "mismatches": 3, "pack": "developer_max", "checked_at": "..."},
      {"id": "laptoppro", "status": "never_checked", "pack": null, "checked_at": null}
    ]
  }
  ```

**Dashboard Widget:**
```
┌────────────────────────────────────────┐
│ Configuration Compliance               │
├────────────────────────────────────────┤
│ ⚠️ 3 machines need attention           │
│                                        │
│ ✅ Compliant: 8                        │
│ ⚠️ Non-compliant: 3                    │
│ ⚪ Never checked: 2                    │
│                                        │
│ Non-compliant:                         │
│   StudyPC - 3 items                    │
│   LaptopPro - 1 item                   │
│   GamingPC - 5 items                   │
│                                        │
│ [Check All] [View Details]             │
└────────────────────────────────────────┘
```

---

### US0121: Pack Assignment per Machine
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0116

**As a** system administrator
**I want** to assign which packs apply to each machine
**So that** servers and workstations can have different requirements

**Acceptance Criteria:**
- [ ] Machine model has `assigned_packs` field (array of pack names)
- [ ] API endpoint: `PUT /api/v1/machines/{id}/config/packs`
- [ ] Machine detail page shows assigned packs
- [ ] Can assign multiple packs (e.g., Base + Developer Lite)
- [ ] Pack assignment UI in machine settings
- [ ] Default assignment: servers get Base, workstations get Developer Lite
- [ ] Compliance checks run against assigned packs only

**Technical Notes:**
- Database field:
  ```python
  class Machine(Base):
      # ...
      assigned_packs = Column(JSON, nullable=True, default=["base"])
  ```

**Pack Assignment UI:**
```
┌────────────────────────────────────────┐
│ Machine Settings: StudyPC              │
├────────────────────────────────────────┤
│ Configuration Packs:                   │
│                                        │
│ ☑ Base Pack (required)                 │
│ ☐ Developer Lite                       │
│ ☑ Developer Max                        │
│                                        │
│ Note: Developer Max includes all of    │
│ Developer Lite items.                  │
│                                        │
│        [Save] [Check Compliance]       │
└────────────────────────────────────────┘
```

---

### US0122: Configuration Drift Detection
**Story Points:** 5
**Priority:** P1
**Dependencies:** US0117

**As a** system administrator
**I want** to be alerted when configuration drifts from compliance
**So that** I can proactively maintain standards

**Acceptance Criteria:**
- [ ] Scheduled compliance check runs daily for all machines
- [ ] If machine transitions from compliant to non-compliant, create alert
- [ ] Alert type: `config_drift`, severity: `warning`
- [ ] Alert includes: machine name, pack name, mismatch count
- [ ] Alert links to compliance diff view
- [ ] Slack notification sent for drift detection
- [ ] Alert auto-resolves when machine returns to compliance
- [ ] Can disable drift detection per machine

**Technical Notes:**
- Scheduler task:
  ```python
  @scheduler.scheduled_job('cron', hour=6)  # Daily at 6am
  async def check_configuration_drift():
      for machine in await get_machines_with_assigned_packs():
          for pack in machine.assigned_packs:
              result = await check_compliance(machine.id, pack)
              previous = await get_last_check(machine.id, pack)

              if previous and previous.is_compliant and not result.is_compliant:
                  await create_alert(
                      machine_id=machine.id,
                      alert_type="config_drift",
                      severity="warning",
                      title=f"Configuration drift detected on {machine.display_name}",
                      message=f"{len(result.mismatches)} items no longer compliant with {pack}"
                  )
  ```

---

### US0123: Remove Configuration Pack
**Story Points:** 3
**Priority:** P2
**Dependencies:** US0119

**As a** system administrator
**I want** to remove a configuration pack from a machine
**So that** I can uninstall development tools when no longer needed

**Acceptance Criteria:**
- [ ] API endpoint: `DELETE /api/v1/machines/{id}/config/apply?pack={pack_name}`
- [ ] Removal only removes items specific to that pack (not shared with other packs)
- [ ] Files are deleted (with backup option)
- [ ] Packages are NOT removed (too risky, may break dependencies)
- [ ] Settings are reverted to defaults
- [ ] Warning displayed: "Files will be deleted. Packages will remain installed."
- [ ] Audit log entry for removal action

**Technical Notes:**
- Removal implementation:
  ```python
  async def remove_pack(machine_id: UUID, pack_name: str) -> RemoveResult:
      pack = load_pack(pack_name)
      results = []

      for file in pack.files:
          # Backup first
          await ssh_executor.execute(machine_id, f"cp {file.path} {file.path}.bak 2>/dev/null")
          result = await ssh_executor.execute(machine_id, f"rm -f {file.path}")
          results.append(RemoveItemResult(item=file.path, success=result.exit_code == 0))

      # Packages NOT removed - add warning
      for package in pack.packages:
          results.append(RemoveItemResult(item=package.name, skipped=True,
              reason="Packages not removed - may break dependencies"))

      return RemoveResult(items=results, removed_at=datetime.utcnow())
  ```

---

## Technical Architecture

### Data Model Changes

**ConfigCheck Table:**
```sql
CREATE TABLE config_check (
  id INTEGER PRIMARY KEY,
  machine_id TEXT REFERENCES machine(id),
  pack_name TEXT NOT NULL,
  is_compliant BOOLEAN NOT NULL,
  mismatches JSON,  -- Array of mismatch objects
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  check_duration_ms INTEGER
);

CREATE INDEX idx_config_check_machine ON config_check(machine_id, checked_at);
CREATE INDEX idx_config_check_compliant ON config_check(is_compliant);
```

**Machine Table Update:**
```sql
ALTER TABLE machine ADD COLUMN assigned_packs JSON DEFAULT '["base"]';
```

### Configuration Pack Storage

```
data/
└── config-packs/
    ├── base.yaml
    ├── developer-lite.yaml
    ├── developer-max.yaml
    └── templates/
        ├── bashrc-aliases.sh
        ├── starship.toml
        └── ghostty-config
```

---

## Dependencies

**Backend:**
- No new libraries (uses existing SQLAlchemy, asyncssh, Pydantic)
- YAML parsing: PyYAML (already have)

**Frontend:**
- diff2html or similar for diff rendering
- Existing Tailwind CSS for styling

---

## Testing Strategy

### Unit Tests
- Pack definition parsing and validation
- Compliance check logic (mock SSH responses)
- Diff generation
- Apply action command generation

### Integration Tests
- Full compliance check cycle
- Apply pack with mocked SSH
- Pack assignment persistence
- Drift detection scheduler

### E2E Tests
- Navigate to configuration page → see compliance status
- Run compliance check → see diff view
- Apply pack → see progress and results
- Assign packs to machine → verify saved

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSH command fails during apply | Medium | High | Atomic operations, rollback on failure |
| Pack definition syntax errors | Low | Medium | YAML validation on load, schema enforcement |
| Large file content transfer | Low | Medium | Stream files, chunk large content |
| Conflicting pack requirements | Low | Medium | Warn if packs define same file differently |

---

## Story Breakdown

| Story | Description | Points | Priority | Status |
|-------|-------------|--------|----------|--------|
| [US0116](../stories/US0116-configuration-pack-definitions.md) | Configuration Pack Definitions | 5 | P0 | Draft |
| [US0117](../stories/US0117-configuration-compliance-checker.md) | Configuration Compliance Checker | 8 | P0 | Draft |
| [US0118](../stories/US0118-configuration-diff-view.md) | Configuration Diff View | 5 | P0 | Draft |
| [US0119](../stories/US0119-apply-configuration-pack.md) | Apply Configuration Pack | 8 | P0 | Draft |
| [US0120](../stories/US0120-compliance-dashboard-widget.md) | Compliance Dashboard Widget | 5 | P1 | Draft |
| [US0121](../stories/US0121-pack-assignment-per-machine.md) | Pack Assignment per Machine | 3 | P1 | Draft |
| [US0122](../stories/US0122-configuration-drift-detection.md) | Configuration Drift Detection | 5 | P1 | Draft |
| [US0123](../stories/US0123-remove-configuration-pack.md) | Remove Configuration Pack | 3 | P2 | Draft |
| **Total** | | **42** | | |

---

**Created:** 2026-01-26
**Last Updated:** 2026-01-28
**Epic Owner:** Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Darren | Initial epic creation |
| 2026-01-28 | Claude | Renumbered stories US0094-US0101 to US0116-US0123 to resolve ID conflict with EP0016 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
