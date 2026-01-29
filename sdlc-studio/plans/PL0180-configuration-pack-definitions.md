# PL0180: Configuration Pack Definitions - Implementation Plan

> **Status:** Draft
> **Story:** [US0116: Configuration Pack Definitions](../stories/US0116-configuration-pack-definitions.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python + TypeScript

## Overview

Implement the foundation for configuration management by defining YAML-based configuration packs (Base, Developer Lite, Developer Max) and an API endpoint to list available packs. This story establishes the data format, storage structure, and pack loading service that all subsequent configuration management stories will build upon.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Base Pack Defined | Base Pack with shell aliases, git config, core packages |
| AC2 | Developer Lite Pack Defined | Extends Base with Starship, Ghostty, Python, Node.js |
| AC3 | Developer Max Pack Defined | Extends Developer Lite with AI tooling, containers |
| AC4 | Pack YAML Structure | Standard schema with name, description, extends, items |
| AC5 | List Packs API | `GET /api/v1/config/packs` returns pack metadata |
| AC6 | Pack Storage Location | Packs loaded from `data/config-packs/` |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI + SQLAlchemy
- **Test Framework:** pytest

### Relevant Best Practices
- Use `yaml.safe_load()` for YAML parsing (security)
- Specific exception handling (not bare except)
- Pydantic response models for API contracts
- Service class pattern with async session

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /websites/fastapi_tiangolo | Router with response_model, Depends injection |
| PyYAML | Standard library | yaml.safe_load() for untrusted input |
| Pydantic | Standard (v2) | BaseModel, Field with descriptions |

### Existing Patterns

**API Routes:** Follow `backend/src/homelab_cmd/api/routes/servers.py` pattern:
- Router with `response_model`, `operation_id`, `summary`
- `Depends(get_async_session)` for DB, `Depends(verify_api_key)` for auth
- Response wrapper with list + total count

**Schemas:** Follow `backend/src/homelab_cmd/api/schemas/server.py` pattern:
- ListResponse with items array and total count
- Field descriptions for OpenAPI docs

**Services:** Follow `backend/src/homelab_cmd/services/alerting.py` pattern:
- Constructor accepts session if needed
- Async methods for I/O operations
- Return typed dataclasses or Pydantic models

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is a greenfield feature with straightforward YAML parsing. The schema design needs iteration as we write the pack files. Writing tests after implementation allows faster iteration on the pack format.

### Test Priority
1. Pack YAML parsing and validation
2. Pack extends resolution (inheritance)
3. API endpoint returns correct metadata

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create config-packs directory structure | `data/config-packs/` | - | [ ] |
| 2 | Write Base Pack YAML | `data/config-packs/base.yaml` | 1 | [ ] |
| 3 | Write Developer Lite Pack YAML | `data/config-packs/developer-lite.yaml` | 2 | [ ] |
| 4 | Write Developer Max Pack YAML | `data/config-packs/developer-max.yaml` | 3 | [ ] |
| 5 | Create template files | `data/config-packs/templates/*.sh` | 1 | [ ] |
| 6 | Create Pydantic schemas | `backend/src/homelab_cmd/api/schemas/config_pack.py` | - | [ ] |
| 7 | Create pack loader service | `backend/src/homelab_cmd/services/config_pack_service.py` | 6 | [ ] |
| 8 | Create API route | `backend/src/homelab_cmd/api/routes/config_packs.py` | 6, 7 | [ ] |
| 9 | Register router in main.py | `backend/src/homelab_cmd/main.py` | 8 | [ ] |
| 10 | Write unit tests | `tests/test_config_packs.py` | 7, 8 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 6 | None |
| B | 2, 3, 4, 5 | Task 1 |
| C | 7 | Task 6 |
| D | 8, 9 | Tasks 6, 7 |
| E | 10 | Tasks 7, 8 |

---

## Implementation Phases

### Phase 1: Pack Data Structure
**Goal:** Create YAML pack files and directory structure

- [ ] Create `data/config-packs/` directory
- [ ] Create `data/config-packs/templates/` subdirectory
- [ ] Write `base.yaml` with files, packages, settings
- [ ] Write `developer-lite.yaml` extending base
- [ ] Write `developer-max.yaml` extending developer-lite
- [ ] Create placeholder template files (bashrc-aliases.sh, starship.toml, ghostty-config)

**Files:**
- `data/config-packs/base.yaml` - Base pack definition
- `data/config-packs/developer-lite.yaml` - Developer Lite definition
- `data/config-packs/developer-max.yaml` - Developer Max definition
- `data/config-packs/templates/bashrc-aliases.sh` - Shell aliases template

### Phase 2: Backend Service
**Goal:** Implement pack loading and validation service

- [ ] Create Pydantic schemas for pack structure
- [ ] Create `ConfigPackService` class
- [ ] Implement `load_pack()` method with YAML parsing
- [ ] Implement `resolve_extends()` for pack inheritance
- [ ] Implement `list_packs()` returning metadata
- [ ] Handle validation errors gracefully

**Files:**
- `backend/src/homelab_cmd/api/schemas/config_pack.py` - Pydantic models
- `backend/src/homelab_cmd/services/config_pack_service.py` - Service class

### Phase 3: API Endpoint
**Goal:** Expose pack listing via REST API

- [ ] Create router for `/api/v1/config/packs`
- [ ] Implement `GET` endpoint returning pack list
- [ ] Add authentication via `verify_api_key`
- [ ] Register router in `main.py`

**Files:**
- `backend/src/homelab_cmd/api/routes/config_packs.py` - API routes
- `backend/src/homelab_cmd/main.py` - Router registration

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test loads Base Pack | `tests/test_config_packs.py` | Pending |
| AC2 | Unit test loads Developer Lite with Base items | `tests/test_config_packs.py` | Pending |
| AC3 | Unit test loads Developer Max with all items | `tests/test_config_packs.py` | Pending |
| AC4 | Schema validation test | `tests/test_config_packs.py` | Pending |
| AC5 | API integration test | `tests/test_config_packs.py` | Pending |
| AC6 | Service reads from data/config-packs/ | `config_pack_service.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Pack file not found | Log warning, return empty list (graceful degradation) | Phase 2 |
| 2 | Invalid YAML syntax | Log error with filename, skip pack, continue loading others | Phase 2 |
| 3 | Missing required field | Pydantic ValidationError with specific field name | Phase 2 |
| 4 | Circular extends reference | Detect cycles during resolution, raise ConfigPackError | Phase 2 |
| 5 | Template file missing | Validate on load, return error with missing template path | Phase 2 |
| 6 | Duplicate pack names | Log warning, last-loaded wins (filesystem order) | Phase 2 |

**Coverage:** 6/6 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YAML injection | High | Use yaml.safe_load() exclusively |
| Circular extends infinite loop | Medium | Track visited packs during resolution |
| Large pack files | Low | Lazy loading, only resolve extends on demand |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)

---

## Notes

**Design Decisions:**
1. Packs stored as static YAML files (not database) for version control and easy editing
2. Template files stored alongside packs for self-contained deployment
3. Extends resolution done at load time, not stored (single source of truth)
4. API returns metadata only - full pack content retrieved separately (US0117)

**Not in this story:**
- Compliance checking (US0117)
- Diff view (US0118)
- Apply pack (US0119)
