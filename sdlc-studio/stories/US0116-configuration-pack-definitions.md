# US0116: Configuration Pack Definitions

> **Status:** Planned
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** configuration packs defined in YAML format
**So that** I can standardise what configurations should be checked

## Context

### Persona Reference
**System Administrator** - Manages homelab infrastructure, needs standardised configurations across machines
[Full persona details](../personas.md#system-administrator)

### Background

Configuration packs define the expected state of a machine's configuration. They specify which files should exist, which packages should be installed, and what settings should be configured. This foundation enables compliance checking, diff viewing, and configuration application.

**Pack Hierarchy:**
- **Base Pack** - Essential Linux environment (shell aliases, Git config, core utilities)
- **Developer Lite Pack** - Extends Base with terminal config, Starship prompt, Python/Node.js
- **Developer Max Pack** - Extends Developer Lite with AI tooling, containers, language servers

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Storage | YAML format | Pack files must be valid YAML |
| TRD | Tech Stack | Python + PyYAML | Use existing YAML parsing |

---

## Acceptance Criteria

### AC1: Base Pack Defined
- **Given** the config-packs directory exists
- **When** I load the Base Pack
- **Then** it contains:
  - Files: ~/.bashrc.d/aliases.sh, ~/.gitconfig, ~/.ssh/config
  - Packages: curl (>=8.0.0), git (>=2.40.0), jq, yq, wget
  - Settings: EDITOR env var

### AC2: Developer Lite Pack Defined
- **Given** the config-packs directory exists
- **When** I load the Developer Lite Pack
- **Then** it contains:
  - All Base Pack items (extends)
  - Files: ~/.config/starship.toml, ~/.config/ghostty/config
  - Packages: python3 (>=3.11), nodejs (>=20.0.0), npm

### AC3: Developer Max Pack Defined
- **Given** the config-packs directory exists
- **When** I load the Developer Max Pack
- **Then** it contains:
  - All Developer Lite items (extends)
  - Files: Claude Code config, Ollama config
  - Packages: docker-ce, podman

### AC4: Pack YAML Structure
- **Given** a pack YAML file
- **When** parsed
- **Then** it contains:
  - `name`: Pack display name
  - `description`: Pack purpose
  - `extends`: Optional parent pack name
  - `items.files[]`: path, mode, content_hash or template
  - `items.packages[]`: name, min_version
  - `items.settings[]`: key, expected, type (env_var, config)

### AC5: List Packs API
- **Given** `GET /api/v1/config/packs`
- **When** called
- **Then** returns array of pack metadata:
  - name, description, item count, last updated
- **And** response is under 100ms

### AC6: Pack Storage Location
- **Given** the application
- **When** packs are loaded
- **Then** they are read from `data/config-packs/` directory
- **And** templates from `data/config-packs/templates/`

---

## Scope

### In Scope
- Base, Developer Lite, Developer Max pack definitions
- YAML pack file format specification
- Pack loading and validation service
- `GET /api/v1/config/packs` endpoint
- Template file storage for config content

### Out of Scope
- Custom user-defined packs (future)
- Pack versioning
- Pack import/export
- UI for editing packs

---

## Technical Notes

### Pack YAML Format

```yaml
# data/config-packs/base.yaml
name: Base Pack
description: Essential Linux environment configuration
extends: null

items:
  files:
    - path: ~/.bashrc.d/aliases.sh
      mode: "0644"
      template: bashrc-aliases.sh
    - path: ~/.gitconfig
      mode: "0644"
      content_hash: sha256:abc123...

  packages:
    - name: curl
      min_version: "8.0.0"
    - name: git
      min_version: "2.40.0"
    - name: jq
    - name: yq

  settings:
    - key: EDITOR
      expected: vim
      type: env_var
```

### Directory Structure

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

### API Response

```json
GET /api/v1/config/packs

[
  {
    "name": "base",
    "display_name": "Base Pack",
    "description": "Essential Linux environment configuration",
    "item_count": 12,
    "extends": null,
    "last_updated": "2026-01-28T10:00:00Z"
  },
  {
    "name": "developer-lite",
    "display_name": "Developer Lite",
    "description": "Basic development environment",
    "item_count": 8,
    "extends": "base",
    "last_updated": "2026-01-28T10:00:00Z"
  }
]
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Pack file not found | Log warning, return empty pack list |
| Invalid YAML syntax | Log error with line number, skip pack |
| Missing required field | Validation error on load |
| Circular extends reference | Detect and reject with error |
| Template file missing | Validation error listing missing template |
| Duplicate pack names | Last loaded wins, log warning |

---

## Test Scenarios

- [ ] Verify Base Pack loads with all expected items
- [ ] Verify Developer Lite Pack extends Base Pack
- [ ] Verify Developer Max Pack extends Developer Lite
- [ ] Verify pack YAML validation catches missing fields
- [ ] Verify `GET /api/v1/config/packs` returns all packs
- [ ] Verify extends resolution creates merged pack
- [ ] Verify invalid YAML is handled gracefully
- [ ] Verify template files are loaded correctly

---

## Dependencies

### Story Dependencies

None - foundation story

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| PyYAML | Library | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium (YAML schema design, extends resolution)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0094) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
