# TS0012: Agent CPU Details Collection Tests

> **Status:** Complete
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Last Updated:** 2026-01-20

## Overview

Test specification for agent CPU information collection and storage. Covers the `get_cpu_info()` collector, heartbeat payload extension, backend storage, and server API response fields.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0053](../stories/US0053-agent-cpu-details.md) | Agent CPU Details Collection | High |

### AC Coverage Matrix

Maps each Story AC to test cases ensuring complete coverage.

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0053 | AC1 | Agent collects CPU model from /proc/cpuinfo | TC180, TC181, TC182 | Covered |
| US0053 | AC2 | Agent collects CPU core count via os.cpu_count() | TC183 | Covered |
| US0053 | AC3 | CPU info included in heartbeat payload | TC184, TC185 | Covered |
| US0053 | AC4 | Backend stores CPU info in Server record | TC186, TC187 | Covered |
| US0053 | AC5 | CPU info visible in server detail API | TC188, TC189 | Covered |

**Coverage Summary:**
- Total ACs: 5
- Covered: 5
- Uncovered: 0

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test get_cpu_info() in isolation with mocked /proc/cpuinfo |
| Integration | Yes | Test heartbeat with cpu_info stores values correctly |
| API | Yes | Test server detail response includes cpu_model and cpu_cores |
| E2E | No | Backend/agent-focused feature; no UI components |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, httpx, test database |
| External Services | None (mock /proc/cpuinfo) |
| Test Data | Sample cpuinfo content for x86 and ARM |

---

## Test Cases

### TC180: get_cpu_info returns x86 CPU model

**Type:** Unit
**Priority:** High
**Story:** US0053 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given mock /proc/cpuinfo with x86 content | File exists with "model name" field |
| 2 | When calling get_cpu_info() | Function reads file |
| 3 | Then returns cpu_model from model name line | cpu_model = "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz" |

#### Test Data

```yaml
input:
  cpuinfo_content: |
    processor       : 0
    vendor_id       : GenuineIntel
    model name      : Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz
    cpu MHz         : 1800.000
expected:
  cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"
```

#### Assertions

- [ ] cpu_model matches expected string
- [ ] cpu_model is not None
- [ ] No exceptions raised

---

### TC181: get_cpu_info returns ARM CPU model (Model field)

**Type:** Unit
**Priority:** High
**Story:** US0053 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given mock /proc/cpuinfo with ARM content using "Model" | File exists with Model field |
| 2 | When calling get_cpu_info() | Function reads file |
| 3 | Then returns cpu_model from Model line | cpu_model = "Raspberry Pi 4 Model B Rev 1.4" |

#### Test Data

```yaml
input:
  cpuinfo_content: |
    processor       : 0
    BogoMIPS        : 108.00
    Features        : fp asimd
    CPU implementer : 0x41
    Hardware        : BCM2711
    Revision        : d03114
    Model           : Raspberry Pi 4 Model B Rev 1.4
expected:
  cpu_model: "Raspberry Pi 4 Model B Rev 1.4"
```

#### Assertions

- [ ] cpu_model matches expected string for ARM
- [ ] Model field takes precedence over Hardware

---

### TC182: get_cpu_info handles ARM with Hardware fallback

**Type:** Unit
**Priority:** Medium
**Story:** US0053 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given mock /proc/cpuinfo with only Hardware field | No Model field present |
| 2 | When calling get_cpu_info() | Function reads file |
| 3 | Then returns cpu_model from Hardware line | cpu_model = "BCM2711" |

#### Test Data

```yaml
input:
  cpuinfo_content: |
    processor       : 0
    Hardware        : BCM2711
expected:
  cpu_model: "BCM2711"
```

#### Assertions

- [ ] Hardware field used as fallback
- [ ] cpu_model is not None

---

### TC183: get_cpu_info returns core count

**Type:** Unit
**Priority:** High
**Story:** US0053 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given os.cpu_count() returns 4 | System has 4 logical cores |
| 2 | When calling get_cpu_info() | Function calls os.cpu_count() |
| 3 | Then returns cpu_cores = 4 | Core count matches |

#### Test Data

```yaml
input:
  cpu_count: 4
expected:
  cpu_cores: 4
```

#### Assertions

- [ ] cpu_cores equals 4
- [ ] cpu_cores is int type

---

### TC184: Heartbeat includes cpu_info

**Type:** Integration
**Priority:** High
**Story:** US0053 AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given agent has CPU info collected | cpu_model and cpu_cores available |
| 2 | When sending heartbeat | POST /api/v1/agents/heartbeat |
| 3 | Then payload includes cpu_info object | cpu_info.cpu_model and cpu_info.cpu_cores present |

#### Test Data

```yaml
input:
  heartbeat_payload:
    server_id: "test-server"
    hostname: "test.local"
    timestamp: "2026-01-20T10:00:00Z"
    cpu_info:
      cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"
      cpu_cores: 4
expected:
  response_status: 200
```

#### Assertions

- [ ] Heartbeat accepted with cpu_info
- [ ] Response status is 200
- [ ] No validation errors

---

### TC185: Heartbeat without cpu_info (backwards compatibility)

**Type:** Integration
**Priority:** High
**Story:** US0053 AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given old agent without cpu_info | No cpu_info in payload |
| 2 | When sending heartbeat | POST /api/v1/agents/heartbeat |
| 3 | Then heartbeat accepted | Status 200, server_registered if new |

#### Test Data

```yaml
input:
  heartbeat_payload:
    server_id: "old-agent-server"
    hostname: "old.local"
    timestamp: "2026-01-20T10:00:00Z"
    # No cpu_info field
expected:
  response_status: 200
```

#### Assertions

- [ ] Heartbeat processed without cpu_info
- [ ] No errors for missing field

---

### TC186: Backend stores CPU info from heartbeat

**Type:** Integration
**Priority:** High
**Story:** US0053 AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given a new server | Server doesn't exist |
| 2 | When heartbeat with cpu_info received | POST /api/v1/agents/heartbeat |
| 3 | Then Server record has cpu_model and cpu_cores | Database stores values |

#### Test Data

```yaml
input:
  server_id: "new-server-cpu"
  cpu_info:
    cpu_model: "AMD Ryzen 5 3600"
    cpu_cores: 12
expected:
  server:
    cpu_model: "AMD Ryzen 5 3600"
    cpu_cores: 12
```

#### Assertions

- [ ] Server.cpu_model matches input
- [ ] Server.cpu_cores matches input
- [ ] Values persisted to database

---

### TC187: Backend updates CPU info on subsequent heartbeat

**Type:** Integration
**Priority:** Medium
**Story:** US0053 AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given existing server with CPU info | Server already has cpu_model |
| 2 | When new heartbeat with different CPU info | Changed cpu_model value |
| 3 | Then Server record updated | cpu_model reflects new value |

#### Test Data

```yaml
input:
  initial_cpu_model: "Intel Core i5"
  updated_cpu_model: "Intel Core i7-10700"
expected:
  final_cpu_model: "Intel Core i7-10700"
```

#### Assertions

- [ ] cpu_model updated to new value
- [ ] No duplicate server records

---

### TC188: Server API returns cpu_model

**Type:** API
**Priority:** High
**Story:** US0053 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with cpu_model stored | Database has CPU info |
| 2 | When GET /api/v1/servers/{id} | Request server detail |
| 3 | Then response includes cpu_model field | cpu_model in JSON response |

#### Test Data

```yaml
input:
  server_id: "test-server-cpu"
  stored_cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"
expected:
  response:
    cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"
```

#### Assertions

- [ ] Response contains cpu_model field
- [ ] cpu_model value matches stored value

---

### TC189: Server API returns cpu_cores

**Type:** API
**Priority:** High
**Story:** US0053 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with cpu_cores stored | Database has core count |
| 2 | When GET /api/v1/servers/{id} | Request server detail |
| 3 | Then response includes cpu_cores field | cpu_cores in JSON response |

#### Test Data

```yaml
input:
  server_id: "test-server-cpu"
  stored_cpu_cores: 8
expected:
  response:
    cpu_cores: 8
```

#### Assertions

- [ ] Response contains cpu_cores field
- [ ] cpu_cores value matches stored value

---

### TC190: get_cpu_info handles missing /proc/cpuinfo

**Type:** Unit
**Priority:** Medium
**Story:** US0053 AC1 (edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given /proc/cpuinfo does not exist | Container or non-Linux |
| 2 | When calling get_cpu_info() | Function handles gracefully |
| 3 | Then returns None for cpu_model | Warning logged |

#### Test Data

```yaml
input:
  cpuinfo_exists: false
expected:
  cpu_model: null
  cpu_cores: 4  # From os.cpu_count()
```

#### Assertions

- [ ] cpu_model is None
- [ ] cpu_cores still populated from os.cpu_count()
- [ ] Warning logged

---

### TC191: get_cpu_info truncates long CPU model

**Type:** Unit
**Priority:** Low
**Story:** US0053 AC1 (edge case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given CPU model > 255 characters | Unlikely but possible |
| 2 | When stored via heartbeat | Schema has max_length=255 |
| 3 | Then value truncated or validation error | No crash |

#### Test Data

```yaml
input:
  cpu_model: "A" * 300
expected:
  cpu_model_length: <= 255
```

#### Assertions

- [ ] No crash on long string
- [ ] Value truncated or rejected

---

## Fixtures

```yaml
# Shared test data for this spec
x86_cpuinfo: |
  processor       : 0
  vendor_id       : GenuineIntel
  model name      : Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz
  cpu MHz         : 1800.000
  cache size      : 6144 KB

arm_cpuinfo_with_model: |
  processor       : 0
  BogoMIPS        : 108.00
  Features        : fp asimd evtstrm
  Hardware        : BCM2711
  Model           : Raspberry Pi 4 Model B Rev 1.4

arm_cpuinfo_hardware_only: |
  processor       : 0
  Hardware        : BCM2711

test_server:
  id: "test-server-cpu"
  hostname: "test.local"
  cpu_model: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz"
  cpu_cores: 4
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC180 | get_cpu_info returns x86 CPU model | Automated | tests/test_agent.py::TestGetCpuInfo |
| TC181 | get_cpu_info returns ARM CPU model | Automated | tests/test_agent.py::TestGetCpuInfo |
| TC182 | get_cpu_info ARM Hardware fallback | Automated | tests/test_agent.py::TestGetCpuInfo |
| TC183 | get_cpu_info returns core count | Automated | tests/test_agent.py::TestGetCpuInfo |
| TC184 | Heartbeat includes cpu_info | Automated | tests/test_heartbeat.py::TestHeartbeatCpuInfo |
| TC185 | Heartbeat backwards compatibility | Automated | tests/test_heartbeat.py::TestHeartbeatCpuInfo |
| TC186 | Backend stores CPU info | Automated | tests/test_heartbeat.py::TestHeartbeatCpuInfo |
| TC187 | Backend updates CPU info | Automated | tests/test_heartbeat.py::TestHeartbeatCpuInfo |
| TC188 | Server API returns cpu_model | Automated | tests/test_servers.py::TestServerCpuInfo |
| TC189 | Server API returns cpu_cores | Automated | tests/test_servers.py::TestServerCpuInfo |
| TC190 | Handle missing /proc/cpuinfo | Automated | tests/test_agent.py::TestGetCpuInfo |
| TC191 | Truncate long CPU model | Automated | tests/test_heartbeat.py::TestHeartbeatCpuInfo |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0005](../epics/EP0005-cost-tracking.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0041](../plans/PL0041-agent-cpu-details.md) |

## Lessons Learned

<!-- To be filled after testing -->

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial spec generation for US0053 |
