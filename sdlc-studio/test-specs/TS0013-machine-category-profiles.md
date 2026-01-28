# TS0013: Machine Category Power Profiles Tests

> **Status:** In Progress
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Last Updated:** 2026-01-20

## Overview

Test specification for machine category power profiles. Covers MachineCategory enum, POWER_PROFILES dict, CPU inference patterns, and heartbeat integration.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0054](../stories/US0054-machine-category-profiles.md) | Machine Category Power Profiles | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0054 | AC1 | Machine category enum defined | TC200 | Covered |
| US0054 | AC2 | Power profiles defined | TC201, TC202 | Covered |
| US0054 | AC3 | Category inference from CPU model | TC203-TC214 | Covered |
| US0054 | AC4 | Auto-detection on heartbeat | TC215, TC216 | Covered |
| US0054 | AC5 | User category preserved | TC217 | Covered |
| US0054 | AC6 | Category stored in database | TC218, TC219 | Covered |

**Coverage Summary:**
- Total ACs: 6
- Covered: 6
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test enum, profiles, and inference patterns |
| Integration | Yes | Test heartbeat auto-detection and database storage |
| API | Yes | Test server API includes category fields |
| E2E | No | Backend-focused feature; no UI components |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, httpx, test database |
| External Services | None |
| Test Data | Sample CPU model strings |

---

## Test Cases

### TC200: MachineCategory enum has all values

**Type:** Unit
**Priority:** High
**Story:** US0054 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the MachineCategory enum | Enum is importable |
| 2 | When checking enum values | All 9 categories exist |
| 3 | Then each value matches specification | sbc, mini_pc, nas, office_desktop, gaming_desktop, workstation, office_laptop, gaming_laptop, rack_server |

#### Assertions

- [ ] Enum has exactly 9 members
- [ ] All category values match specification

---

### TC201: POWER_PROFILES has entry for each category

**Type:** Unit
**Priority:** High
**Story:** US0054 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given POWER_PROFILES dict | Dict is importable |
| 2 | When checking dict keys | All MachineCategory values present |
| 3 | Then each entry has profile | PowerProfile with label, idle_watts, max_watts |

#### Assertions

- [ ] POWER_PROFILES has 9 entries
- [ ] Each entry is a PowerProfile
- [ ] Each entry has label, idle_watts, max_watts

---

### TC202: Power profile values match specification

**Type:** Unit
**Priority:** High
**Story:** US0054 AC2
**Automated:** No

#### Test Data

```yaml
expected_profiles:
  sbc: { idle: 2, max: 6 }
  mini_pc: { idle: 10, max: 25 }
  nas: { idle: 15, max: 35 }
  office_desktop: { idle: 40, max: 100 }
  gaming_desktop: { idle: 75, max: 300 }
  workstation: { idle: 100, max: 350 }
  office_laptop: { idle: 10, max: 30 }
  gaming_laptop: { idle: 30, max: 100 }
  rack_server: { idle: 100, max: 300 }
```

#### Assertions

- [ ] Each category has correct idle_watts
- [ ] Each category has correct max_watts

---

### TC203: ARM architecture detected as SBC

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: null, architecture: "aarch64" }
  - { cpu_model: null, architecture: "armv7l" }
  - { cpu_model: "Raspberry Pi 4", architecture: "aarch64" }
  - { cpu_model: "BCM2711", architecture: "arm64" }
expected: sbc
```

#### Assertions

- [ ] aarch64 → SBC
- [ ] armv7l → SBC
- [ ] ARM with Raspberry → SBC
- [ ] ARM with BCM → SBC

---

### TC204: Xeon detected as Rack Server

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel(R) Xeon(R) CPU E5-2680 v4", architecture: "x86_64" }
  - { cpu_model: "Intel Xeon Gold 6226R", architecture: "x86_64" }
expected: rack_server
```

#### Assertions

- [ ] Xeon CPU → Rack Server

---

### TC205: EPYC detected as Rack Server

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "AMD EPYC 7742", architecture: "x86_64" }
  - { cpu_model: "AMD EPYC 9654", architecture: "x86_64" }
expected: rack_server
```

#### Assertions

- [ ] EPYC CPU → Rack Server

---

### TC206: Core i5-8250U (U-series) detected as Office Laptop

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz", architecture: "x86_64" }
  - { cpu_model: "Intel Core i7-1165G7", architecture: "x86_64" }
  - { cpu_model: "Intel Core i5-1235P", architecture: "x86_64" }
expected: office_laptop
```

#### Assertions

- [ ] U-series Core → Office Laptop
- [ ] G-series Core → Office Laptop
- [ ] P-series Core → Office Laptop

---

### TC207: Core i5-12400 detected as Office Desktop

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel(R) Core(TM) i5-12400", architecture: "x86_64" }
  - { cpu_model: "Intel Core i3-10100", architecture: "x86_64" }
  - { cpu_model: "AMD Ryzen 5 5600X", architecture: "x86_64" }
expected: office_desktop
```

#### Assertions

- [ ] Desktop i3/i5 → Office Desktop
- [ ] Ryzen 5 → Office Desktop

---

### TC208: Core i9-13900K detected as Workstation

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel(R) Core(TM) i9-13900K", architecture: "x86_64" }
  - { cpu_model: "Intel Core i7-12700K", architecture: "x86_64" }
  - { cpu_model: "AMD Ryzen 9 7950X", architecture: "x86_64" }
  - { cpu_model: "AMD Ryzen 7 5800X", architecture: "x86_64" }
expected: workstation
```

#### Assertions

- [ ] Desktop i7/i9 → Workstation
- [ ] Ryzen 7/9 → Workstation

---

### TC209: N100 detected as Mini PC

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel N100", architecture: "x86_64" }
  - { cpu_model: "Intel(R) N5095", architecture: "x86_64" }
expected: mini_pc
```

#### Assertions

- [ ] N-series → Mini PC

---

### TC210: Celeron detected as Mini PC

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel Celeron J4125", architecture: "x86_64" }
  - { cpu_model: "Intel(R) Celeron(R) N4100", architecture: "x86_64" }
expected: mini_pc
```

#### Assertions

- [ ] Celeron → Mini PC

---

### TC211: Atom detected as Mini PC

**Type:** Unit
**Priority:** Medium
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel Atom x5-Z8350", architecture: "x86_64" }
expected: mini_pc
```

#### Assertions

- [ ] Atom → Mini PC

---

### TC212: Pentium detected as Mini PC

**Type:** Unit
**Priority:** Medium
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Intel Pentium Silver N6000", architecture: "x86_64" }
expected: mini_pc
```

#### Assertions

- [ ] Pentium → Mini PC

---

### TC213: Unknown CPU returns None

**Type:** Unit
**Priority:** High
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Unknown CPU Model", architecture: "x86_64" }
  - { cpu_model: null, architecture: "x86_64" }
  - { cpu_model: null, architecture: null }
expected: null
```

#### Assertions

- [ ] Unknown CPU → None
- [ ] No CPU model on x86 → None
- [ ] No CPU model, no architecture → None

---

### TC214: Apple M1/M2 detected as Office Laptop

**Type:** Unit
**Priority:** Medium
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "Apple M1", architecture: "arm64" }
  - { cpu_model: "Apple M2", architecture: "arm64" }
  - { cpu_model: "Apple M3 Pro", architecture: "arm64" }
expected: office_laptop
```

#### Assertions

- [ ] Apple M-series → Office Laptop

---

### TC215: Heartbeat auto-detects category

**Type:** Integration
**Priority:** High
**Story:** US0054 AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a new server | No category set |
| 2 | When heartbeat with cpu_info received | POST /api/v1/agents/heartbeat |
| 3 | Then machine_category auto-detected | Category stored with source="auto" |

#### Test Data

```yaml
input:
  server_id: "new-server-category"
  cpu_info:
    cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"
    cpu_cores: 4
  os_info:
    architecture: "x86_64"
expected:
  machine_category: "office_laptop"
  machine_category_source: "auto"
```

#### Assertions

- [ ] Category detected as office_laptop
- [ ] Source is "auto"

---

### TC216: Heartbeat without cpu_info skips detection

**Type:** Integration
**Priority:** Medium
**Story:** US0054 AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given existing server with category | Category already set |
| 2 | When heartbeat without cpu_info | No cpu_info in payload |
| 3 | Then category preserved | Category unchanged |

#### Assertions

- [ ] Existing category not cleared
- [ ] No error for missing cpu_info

---

### TC217: User-set category not overwritten

**Type:** Integration
**Priority:** High
**Story:** US0054 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with machine_category_source="user" | User set workstation |
| 2 | When heartbeat with Mini PC CPU info | N100 would auto-detect as mini_pc |
| 3 | Then user category preserved | Still workstation |

#### Test Data

```yaml
setup:
  server_id: "user-category-server"
  machine_category: "workstation"
  machine_category_source: "user"
input:
  cpu_info:
    cpu_model: "Intel N100"
    cpu_cores: 4
expected:
  machine_category: "workstation"
  machine_category_source: "user"
```

#### Assertions

- [ ] Category remains workstation
- [ ] Source remains "user"

---

### TC218: Server API returns machine_category

**Type:** API
**Priority:** High
**Story:** US0054 AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with category | Category stored |
| 2 | When GET /api/v1/servers/{id} | Request server detail |
| 3 | Then response includes machine_category | Field present in JSON |

#### Assertions

- [ ] Response contains machine_category
- [ ] Value matches stored value

---

### TC219: Server API returns machine_category_source

**Type:** API
**Priority:** High
**Story:** US0054 AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with category source | Source stored |
| 2 | When GET /api/v1/servers/{id} | Request server detail |
| 3 | Then response includes machine_category_source | Field present in JSON |

#### Assertions

- [ ] Response contains machine_category_source
- [ ] Value is "auto" or "user"

---

### TC220: Threadripper detected as Workstation

**Type:** Unit
**Priority:** Medium
**Story:** US0054 AC3
**Automated:** No

#### Test Data

```yaml
inputs:
  - { cpu_model: "AMD Ryzen Threadripper 3960X", architecture: "x86_64" }
expected: workstation
```

#### Assertions

- [ ] Threadripper → Workstation

---

## Fixtures

```yaml
# Shared test data for this spec
cpu_models:
  sbc:
    - { model: "Raspberry Pi 4 Model B", arch: "aarch64" }
    - { model: "BCM2711", arch: "arm64" }
  mini_pc:
    - { model: "Intel N100", arch: "x86_64" }
    - { model: "Intel Celeron J4125", arch: "x86_64" }
  office_laptop:
    - { model: "Intel Core i5-8250U", arch: "x86_64" }
    - { model: "Apple M1", arch: "arm64" }
  office_desktop:
    - { model: "Intel Core i5-12400", arch: "x86_64" }
    - { model: "AMD Ryzen 5 5600X", arch: "x86_64" }
  workstation:
    - { model: "Intel Core i9-13900K", arch: "x86_64" }
    - { model: "AMD Ryzen 9 7950X", arch: "x86_64" }
  rack_server:
    - { model: "Intel Xeon E5-2680", arch: "x86_64" }
    - { model: "AMD EPYC 7742", arch: "x86_64" }
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC200 | MachineCategory enum has all values | Pending | tests/test_power_service.py |
| TC201 | POWER_PROFILES has entry for each category | Pending | tests/test_power_service.py |
| TC202 | Power profile values match specification | Pending | tests/test_power_service.py |
| TC203 | ARM architecture detected as SBC | Pending | tests/test_power_service.py |
| TC204 | Xeon detected as Rack Server | Pending | tests/test_power_service.py |
| TC205 | EPYC detected as Rack Server | Pending | tests/test_power_service.py |
| TC206 | Mobile CPU detected as Office Laptop | Pending | tests/test_power_service.py |
| TC207 | Desktop i3/i5 detected as Office Desktop | Pending | tests/test_power_service.py |
| TC208 | Desktop i7/i9 detected as Workstation | Pending | tests/test_power_service.py |
| TC209 | N-series detected as Mini PC | Pending | tests/test_power_service.py |
| TC210 | Celeron detected as Mini PC | Pending | tests/test_power_service.py |
| TC211 | Atom detected as Mini PC | Pending | tests/test_power_service.py |
| TC212 | Pentium detected as Mini PC | Pending | tests/test_power_service.py |
| TC213 | Unknown CPU returns None | Pending | tests/test_power_service.py |
| TC214 | Apple M1/M2 detected as Office Laptop | Pending | tests/test_power_service.py |
| TC215 | Heartbeat auto-detects category | Pending | tests/test_heartbeat.py |
| TC216 | Heartbeat without cpu_info skips detection | Pending | tests/test_heartbeat.py |
| TC217 | User-set category not overwritten | Pending | tests/test_heartbeat.py |
| TC218 | Server API returns machine_category | Pending | tests/test_servers.py |
| TC219 | Server API returns machine_category_source | Pending | tests/test_servers.py |
| TC220 | Threadripper detected as Workstation | Pending | tests/test_power_service.py |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0005](../epics/EP0005-cost-tracking.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0042](../plans/PL0042-machine-category-profiles.md) |

## Lessons Learned

<!-- To be filled after testing -->

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial spec generation for US0054 |
