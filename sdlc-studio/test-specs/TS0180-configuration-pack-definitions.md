# TS0180: Configuration Pack Definitions

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for US0116: Configuration Pack Definitions. Validates YAML pack structure, pack loading service, extends resolution, and the `GET /api/v1/config/packs` endpoint.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0116](../stories/US0116-configuration-pack-definitions.md) | Configuration Pack Definitions | P0 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0116 | AC1 | Base Pack Defined | TC01 | Pending |
| US0116 | AC2 | Developer Lite Pack Defined | TC02 | Pending |
| US0116 | AC3 | Developer Max Pack Defined | TC03 | Pending |
| US0116 | AC4 | Pack YAML Structure | TC04, TC05 | Pending |
| US0116 | AC5 | List Packs API | TC06, TC07 | Pending |
| US0116 | AC6 | Pack Storage Location | TC08 | Pending |

**Coverage:** 6/6 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Pack parsing, validation, extends resolution |
| Integration | Yes | API endpoint with pack service |
| E2E | No | No frontend changes in this story |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Backend running, `data/config-packs/` exists |
| External Services | None |
| Test Data | YAML pack fixtures in `tests/fixtures/config-packs/` |

---

## Test Cases

### TC01: Base Pack Contains Expected Items

**Type:** Unit | **Priority:** High | **Story:** US0116-AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Base Pack YAML exists at `data/config-packs/base.yaml` | File readable |
| When | Load Base Pack via `ConfigPackService.load_pack("base")` | Pack object returned |
| Then | Pack contains expected files | `~/.bashrc.d/aliases.sh`, `~/.gitconfig`, `~/.ssh/config` |
| Then | Pack contains expected packages | curl (>=8.0.0), git (>=2.40.0), jq, yq, wget |
| Then | Pack contains expected settings | EDITOR env var |

**Assertions:**
- [ ] Pack name is "Base Pack"
- [ ] Pack has exactly 3 files
- [ ] Pack has exactly 5 packages
- [ ] curl min_version is "8.0.0"
- [ ] git min_version is "2.40.0"
- [ ] Pack has 1 setting with key "EDITOR"

---

### TC02: Developer Lite Pack Extends Base

**Type:** Unit | **Priority:** High | **Story:** US0116-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Developer Lite Pack YAML exists with `extends: base` | File readable |
| When | Load Developer Lite Pack via `ConfigPackService.load_pack("developer-lite")` | Pack object with resolved extends |
| Then | Pack includes all Base Pack items | Files, packages, settings from base |
| Then | Pack includes Developer Lite specific items | Starship, Ghostty, Python, Node.js |

**Assertions:**
- [ ] Pack name is "Developer Lite"
- [ ] Pack extends is "base"
- [ ] Resolved pack has Base files plus ~/.config/starship.toml, ~/.config/ghostty/config
- [ ] Resolved pack has Base packages plus python3 (>=3.11), nodejs (>=20.0.0), npm
- [ ] Total file count is base files + 2
- [ ] Total package count is base packages + 3

---

### TC03: Developer Max Pack Extends Developer Lite

**Type:** Unit | **Priority:** High | **Story:** US0116-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Developer Max Pack YAML exists with `extends: developer-lite` | File readable |
| When | Load Developer Max Pack via `ConfigPackService.load_pack("developer-max")` | Pack object with resolved extends |
| Then | Pack includes all Developer Lite items (which includes Base) | Full inheritance chain resolved |
| Then | Pack includes Developer Max specific items | Claude Code config, Ollama config, docker-ce, podman |

**Assertions:**
- [ ] Pack name is "Developer Max"
- [ ] Pack extends is "developer-lite"
- [ ] Resolved pack has all base + developer-lite files plus 2 new files
- [ ] Resolved pack has docker-ce and podman packages
- [ ] Total unique items = base + developer-lite + developer-max items

---

### TC04: Pack YAML Schema Validation - Valid

**Type:** Unit | **Priority:** High | **Story:** US0116-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A valid pack YAML with all required fields | name, description, items |
| When | Parse with Pydantic schema | ConfigPack object created |
| Then | All fields accessible | name, description, extends, items.files, items.packages, items.settings |

**Assertions:**
- [ ] name field is string
- [ ] description field is string
- [ ] extends field is optional string or null
- [ ] items.files is list of FileItem
- [ ] items.packages is list of PackageItem
- [ ] items.settings is list of SettingItem
- [ ] FileItem has path, mode, and (content_hash or template)
- [ ] PackageItem has name and optional min_version
- [ ] SettingItem has key, expected, type

---

### TC05: Pack YAML Schema Validation - Invalid

**Type:** Unit | **Priority:** Medium | **Story:** US0116-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack YAML missing required `name` field | Invalid YAML |
| When | Parse with Pydantic schema | ValidationError raised |
| Then | Error message indicates missing field | "name" in error message |

**Assertions:**
- [ ] ValidationError raised for missing name
- [ ] ValidationError raised for missing description
- [ ] ValidationError raised for invalid file item (missing path)
- [ ] ValidationError raised for invalid package item (missing name)
- [ ] Error messages are descriptive (field name included)

---

### TC06: List Packs API Returns All Packs

**Type:** Integration | **Priority:** High | **Story:** US0116-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | API key is valid | X-API-Key header set |
| Given | Pack files exist in data/config-packs/ | base.yaml, developer-lite.yaml, developer-max.yaml |
| When | Call `GET /api/v1/config/packs` | HTTP 200 |
| Then | Response contains all pack metadata | Array with 3 items |

**Assertions:**
- [ ] HTTP status is 200
- [ ] Response has `packs` array
- [ ] Response has `total` count = 3
- [ ] Each pack has: name, display_name, description, item_count, extends, last_updated
- [ ] Packs include "base", "developer-lite", "developer-max"
- [ ] item_count is accurate for each pack

---

### TC07: List Packs API Response Time

**Type:** Integration | **Priority:** Medium | **Story:** US0116-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | API key is valid | X-API-Key header set |
| When | Call `GET /api/v1/config/packs` | HTTP 200 |
| Then | Response time is under 100ms | Performance requirement |

**Assertions:**
- [ ] Response time < 100ms
- [ ] No N+1 queries (single directory scan)

---

### TC08: Packs Load from Correct Directory

**Type:** Unit | **Priority:** Medium | **Story:** US0116-AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack files in data/config-packs/ | Files exist |
| When | ConfigPackService initialised | Reads from data/config-packs/ |
| Then | Packs loaded from correct path | Path matches config |

**Assertions:**
- [ ] Service reads from `data/config-packs/`
- [ ] Templates loaded from `data/config-packs/templates/`
- [ ] Path is relative to project root
- [ ] Non-existent directory returns empty list (graceful)

---

### TC09: Invalid YAML Handled Gracefully

**Type:** Unit | **Priority:** Medium | **Story:** US0116 (Edge Case)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack file with invalid YAML syntax | Malformed YAML |
| When | Load packs via service | Warning logged, pack skipped |
| Then | Other valid packs still loaded | Graceful degradation |

**Assertions:**
- [ ] Invalid pack is skipped
- [ ] Warning logged with filename
- [ ] Valid packs in same directory still loaded
- [ ] No exception raised to caller

---

### TC10: Circular Extends Detected

**Type:** Unit | **Priority:** Medium | **Story:** US0116 (Edge Case)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack A extends Pack B, Pack B extends Pack A | Circular reference |
| When | Resolve extends for Pack A | ConfigPackError raised |
| Then | Error message indicates cycle | "Circular extends" in message |

**Assertions:**
- [ ] ConfigPackError raised
- [ ] Error message contains pack names in cycle
- [ ] Detection occurs before infinite loop

---

### TC11: Missing Template File

**Type:** Unit | **Priority:** Medium | **Story:** US0116 (Edge Case)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Pack references template that doesn't exist | template: nonexistent.sh |
| When | Load pack via service | Validation error |
| Then | Error indicates missing template | Template path in error |

**Assertions:**
- [ ] Error raised on load (not later on use)
- [ ] Error message includes template path
- [ ] Pack is not partially loaded

---

## Fixtures

```yaml
# Test fixture: tests/fixtures/config-packs/valid-minimal.yaml
name: Minimal Test Pack
description: Minimal pack for testing
extends: null

items:
  files: []
  packages: []
  settings: []

# Test fixture: tests/fixtures/config-packs/invalid-missing-name.yaml
# name: missing
description: Pack without name field
extends: null
items:
  files: []
  packages: []
  settings: []

# Test fixture: tests/fixtures/config-packs/circular-a.yaml
name: Circular A
description: Creates circular reference
extends: circular-b
items:
  files: []
  packages: []
  settings: []

# Test fixture: tests/fixtures/config-packs/circular-b.yaml
name: Circular B
description: Creates circular reference
extends: circular-a
items:
  files: []
  packages: []
  settings: []
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Base Pack Contains Expected Items | Pending | - |
| TC02 | Developer Lite Pack Extends Base | Pending | - |
| TC03 | Developer Max Pack Extends Developer Lite | Pending | - |
| TC04 | Pack YAML Schema Validation - Valid | Pending | - |
| TC05 | Pack YAML Schema Validation - Invalid | Pending | - |
| TC06 | List Packs API Returns All Packs | Pending | - |
| TC07 | List Packs API Response Time | Pending | - |
| TC08 | Packs Load from Correct Directory | Pending | - |
| TC09 | Invalid YAML Handled Gracefully | Pending | - |
| TC10 | Circular Extends Detected | Pending | - |
| TC11 | Missing Template File | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010](../epics/EP0010-configuration-management.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0180](../plans/PL0180-configuration-pack-definitions.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
