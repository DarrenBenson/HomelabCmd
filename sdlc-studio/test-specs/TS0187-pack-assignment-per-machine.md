# TS0187: Pack Assignment per Machine

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Story:** [US0121: Pack Assignment per Machine](../stories/US0121-pack-assignment-per-machine.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for pack assignment functionality including database field, API endpoints, default assignment logic, and UI components.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0121](../stories/US0121-pack-assignment-per-machine.md) | Pack Assignment per Machine | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0121 | AC1 | Database field assigned_packs | TC01 | Pending |
| US0121 | AC2 | PUT /servers/{id}/config/packs | TC02, TC03, TC04 | Pending |
| US0121 | AC3 | GET /servers/{id}/config/packs | TC05, TC06 | Pending |
| US0121 | AC4 | Machine detail display | TC07 | Pending |
| US0121 | AC5 | Pack assignment UI | TC08, TC09 | Pending |
| US0121 | AC6 | Default assignment | TC10, TC11 | Pending |
| US0121 | AC7 | Compliance check integration | TC12 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Backend validation, frontend component |
| Integration | Yes | API endpoints, database operations |
| E2E | No | Simple CRUD, unit/integration sufficient |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, pytest-asyncio, Vitest |
| External Services | None (mocked) |
| Test Data | Mock servers, mock pack list |

---

## Test Cases

### TC01: Database Field Exists

**Type:** Integration | **Priority:** High | **Story:** US0121/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Alembic migration applied | Database updated |
| When | Query Server table schema | Column exists |
| Then | assigned_packs column is JSON type | Correct type |

**Assertions:**
- [ ] assigned_packs column exists in servers table
- [ ] Column type is JSON
- [ ] Column allows NULL values
- [ ] drift_detection_enabled column also exists (boolean, default True)

---

### TC02: PUT Endpoint Updates Packs

**Type:** Integration | **Priority:** High | **Story:** US0121/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists with assigned_packs=["base"] | Initial state |
| When | PUT /servers/{id}/config/packs with {"packs": ["base", "developer-max"]} | Request sent |
| Then | Response 200 with updated packs | Packs updated |

**Assertions:**
- [ ] Response status is 200
- [ ] Response body contains {"server_id": "...", "assigned_packs": ["base", "developer-max"]}
- [ ] Database record updated

---

### TC03: PUT Endpoint Rejects Unknown Pack

**Type:** Integration | **Priority:** High | **Story:** US0121/AC2, Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists | Initial state |
| When | PUT with {"packs": ["base", "unknown-pack"]} | Invalid pack |
| Then | Response 400 with error | Validation failed |

**Assertions:**
- [ ] Response status is 400
- [ ] Response contains error message about unknown pack
- [ ] Database not modified

---

### TC04: PUT Endpoint Prevents Removing Base Pack

**Type:** Integration | **Priority:** High | **Story:** US0121/AC2, Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists with assigned_packs=["base", "developer-lite"] | Initial state |
| When | PUT with {"packs": ["developer-lite"]} | Missing base |
| Then | Response 400 with error | Base required |

**Assertions:**
- [ ] Response status is 400
- [ ] Response contains error about base pack required
- [ ] Database not modified

---

### TC05: GET Endpoint Returns Packs

**Type:** Integration | **Priority:** High | **Story:** US0121/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists with assigned_packs=["base", "developer-max"] | Initial state |
| When | GET /servers/{id}/config/packs | Request sent |
| Then | Response 200 with packs array | Packs returned |

**Assertions:**
- [ ] Response status is 200
- [ ] Response body contains {"server_id": "...", "assigned_packs": ["base", "developer-max"]}

---

### TC06: GET Endpoint Returns Default for Null

**Type:** Integration | **Priority:** Medium | **Story:** US0121/AC3, Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists with assigned_packs=null | Legacy server |
| When | GET /servers/{id}/config/packs | Request sent |
| Then | Response 200 with ["base"] | Default returned |

**Assertions:**
- [ ] Response status is 200
- [ ] Response body contains {"assigned_packs": ["base"]}

---

### TC07: Machine Detail Shows Packs

**Type:** Unit | **Priority:** Medium | **Story:** US0121/AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | ServerDetail page loaded | Page renders |
| When | Server has assigned_packs=["base", "developer-lite"] | Data fetched |
| Then | Packs displayed in UI | Visible |

**Assertions:**
- [ ] Pack names displayed in advanced section
- [ ] Each pack name visible

---

### TC08: Pack Assignment UI Shows Checkboxes

**Type:** Unit | **Priority:** High | **Story:** US0121/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | PackAssignment component rendered | Component mounts |
| When | Available packs: base, developer-lite, developer-max | Packs loaded |
| Then | Checkbox for each pack visible | Checkboxes rendered |

**Assertions:**
- [ ] Checkbox with label "Base Pack" visible
- [ ] Checkbox with label "Developer Lite" visible
- [ ] Checkbox with label "Developer Max" visible
- [ ] Base pack checkbox is disabled (required)

---

### TC09: Pack Assignment UI Saves Changes

**Type:** Unit | **Priority:** High | **Story:** US0121/AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | PackAssignment with current=["base"] | Initial state |
| When | User checks "Developer Lite" and clicks Save | User action |
| Then | API called with ["base", "developer-lite"] | Save triggered |

**Assertions:**
- [ ] updateAssignedPacks called with correct server ID
- [ ] updateAssignedPacks called with ["base", "developer-lite"]
- [ ] onUpdate callback called after success

---

### TC10: Default Packs for Server Registration

**Type:** Integration | **Priority:** High | **Story:** US0121/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No server with ID "new-server" | Clean state |
| When | POST /servers with machine_type="server" | Registration |
| Then | assigned_packs defaults to ["base"] | Default applied |

**Assertions:**
- [ ] Response status is 201
- [ ] Server created with assigned_packs=["base"]

---

### TC11: Default Packs for Workstation Registration

**Type:** Integration | **Priority:** High | **Story:** US0121/AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No server with ID "new-workstation" | Clean state |
| When | POST /servers with machine_type="workstation" | Registration |
| Then | assigned_packs defaults to ["base", "developer-lite"] | Default applied |

**Assertions:**
- [ ] Response status is 201
- [ ] Server created with assigned_packs=["base", "developer-lite"]

---

### TC12: Compliance Check Uses Assigned Packs

**Type:** Unit | **Priority:** Medium | **Story:** US0121/AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with assigned_packs=["base", "developer-max"] | Packs assigned |
| When | Compliance check run without explicit pack | Auto-select |
| Then | Both packs checked | Both validated |

**Assertions:**
- [ ] Compliance service receives correct server
- [ ] If no pack specified, uses assigned_packs from server
- [ ] Check runs for each assigned pack

---

### TC13: Empty Packs Array Defaults to Base

**Type:** Integration | **Priority:** Medium | **Story:** Edge Case

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server exists | Initial state |
| When | PUT with {"packs": []} | Empty array |
| Then | Response 400 or defaults to ["base"] | Handled |

**Assertions:**
- [ ] Either returns 400 error or defaults to ["base"]
- [ ] Server never has empty assigned_packs

---

## Fixtures

```yaml
# Test fixtures for pack assignment tests

servers:
  test_server:
    id: "test-server"
    hostname: "test.local"
    display_name: "Test Server"
    machine_type: "server"
    assigned_packs: ["base"]

  test_workstation:
    id: "test-workstation"
    hostname: "workstation.local"
    display_name: "Test Workstation"
    machine_type: "workstation"
    assigned_packs: ["base", "developer-lite"]

  legacy_server:
    id: "legacy-server"
    hostname: "legacy.local"
    machine_type: "server"
    assigned_packs: null  # Pre-migration state

available_packs:
  - name: "base"
    display_name: "Base Pack"
    description: "Essential Linux environment"
    item_count: 15
  - name: "developer-lite"
    display_name: "Developer Lite"
    description: "Basic development environment"
    item_count: 25
  - name: "developer-max"
    display_name: "Developer Max"
    description: "Full development environment"
    item_count: 40

api_responses:
  get_packs_success:
    server_id: "test-server"
    assigned_packs: ["base", "developer-max"]

  put_packs_success:
    server_id: "test-server"
    assigned_packs: ["base", "developer-lite"]

  error_unknown_pack:
    detail:
      code: "UNKNOWN_PACK"
      message: "Unknown pack: invalid-pack"

  error_base_required:
    detail:
      code: "BASE_PACK_REQUIRED"
      message: "Base pack is required and cannot be removed"
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Database Field Exists | Pending | - |
| TC02 | PUT Endpoint Updates Packs | Pending | - |
| TC03 | PUT Endpoint Rejects Unknown Pack | Pending | - |
| TC04 | PUT Endpoint Prevents Removing Base | Pending | - |
| TC05 | GET Endpoint Returns Packs | Pending | - |
| TC06 | GET Endpoint Returns Default for Null | Pending | - |
| TC07 | Machine Detail Shows Packs | Pending | - |
| TC08 | Pack Assignment UI Shows Checkboxes | Pending | - |
| TC09 | Pack Assignment UI Saves Changes | Pending | - |
| TC10 | Default Packs for Server Registration | Pending | - |
| TC11 | Default Packs for Workstation Registration | Pending | - |
| TC12 | Compliance Check Uses Assigned Packs | Pending | - |
| TC13 | Empty Packs Array Defaults to Base | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0010: Configuration Management](../epics/EP0010-configuration-management.md) |
| Plan | [PL0187: Pack Assignment per Machine](../plans/PL0187-pack-assignment-per-machine.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec from story plan workflow |
