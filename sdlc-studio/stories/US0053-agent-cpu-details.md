# US0053: Agent CPU Details Collection

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-20
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** the agent to collect and report CPU model and core count
**So that** the system can auto-detect the machine category for accurate power estimation

## Context

### Persona Reference

**Darren** - Wants accurate cost estimates without manually researching TDP for each server. Auto-detection reduces configuration burden.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Current cost estimation uses static TDP values that require manual configuration. By collecting CPU information (model name, core count), the system can automatically categorise servers (SBC, mini PC, workstation, etc.) and apply appropriate power profiles. This makes power estimation more accurate and reduces user configuration effort.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Scope | TDP estimates only | CPU info enables auto-detection, not measurement |
| Data | Extend Server entity | Add cpu_model, cpu_cores columns |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Cost accuracy within 10% | CPU model enables better category inference |
| UX | Easy configuration | Auto-detection reduces manual work |
| Architecture | Monolith deployment | CPU info stored in Server table |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Agent collects CPU model

- **Given** the agent is running on a Linux server
- **When** collecting system information
- **Then** the CPU model name is extracted from `/proc/cpuinfo`

### AC2: Agent collects CPU core count

- **Given** the agent is running on a Linux server
- **When** collecting system information
- **Then** the logical CPU core count is obtained via `os.cpu_count()`

### AC3: CPU info included in heartbeat

- **Given** the agent has collected CPU information
- **When** sending a heartbeat to the hub
- **Then** the payload includes `cpu_info.cpu_model` and `cpu_info.cpu_cores`

### AC4: Backend stores CPU info

- **Given** a heartbeat containing cpu_info
- **When** processing the heartbeat
- **Then** the Server record is updated with cpu_model and cpu_cores

### AC5: CPU info visible in server detail API

- **Given** a server with CPU info stored
- **When** calling GET `/api/v1/servers/{server_id}`
- **Then** the response includes cpu_model and cpu_cores fields

## Scope

### In Scope

- Agent `get_cpu_info()` collector function
- CPU model extraction from `/proc/cpuinfo`
- Core count via `os.cpu_count()`
- ARM architecture support (Raspberry Pi model detection)
- Heartbeat payload extension with cpu_info object
- Backend schema extension (cpu_model, cpu_cores columns)
- Migration for new columns
- Heartbeat handler to store CPU info
- Server API response with CPU fields

### Out of Scope

- CPU frequency monitoring
- CPU temperature monitoring
- Real-time CPU load for power calculation (separate story)
- Windows/macOS agent support

## UI/UX Requirements

CPU info displayed in Server Detail view (implementation in US0056):

```
System Information
  OS: Debian 12
  Architecture: x86_64
  CPU: Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz (4 cores)
  Category: Office Desktop (auto-detected)
```

## Technical Notes

### API Contracts

**Heartbeat Request (extended)**
```json
{
  "server_id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "timestamp": "2026-01-20T10:00:00Z",
  "os_info": { ... },
  "metrics": { ... },
  "cpu_info": {
    "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
    "cpu_cores": 4
  }
}
```

**Server Response (extended)**
```json
{
  "id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
  "cpu_cores": 4,
  ...
}
```

### Data Requirements

**New Server columns:**
- `cpu_model`: VARCHAR(255), nullable
- `cpu_cores`: INTEGER, nullable

**CPU Model Detection Priority:**
1. `/proc/cpuinfo` "model name" (x86/x86_64)
2. `/proc/cpuinfo` "Model" (ARM)
3. `/proc/cpuinfo` "Hardware" (ARM fallback)
4. `platform.processor()` (final fallback)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| `/proc/cpuinfo` not readable | Log warning, return None for cpu_model |
| ARM without Model field | Use Hardware field as fallback |
| `os.cpu_count()` returns None | Store None, category inference proceeds without |
| Very long CPU model string | Truncate to 255 characters |
| Old agent (no cpu_info) | Backend ignores missing field; existing behaviour preserved |
| CPU model contains special characters | Store as-is; no sanitisation needed |
| Container without `/proc/cpuinfo` | Log warning, return None |
| Multiple CPU sockets | Return first model found |

## Test Scenarios

- [ ] Agent extracts CPU model from x86 `/proc/cpuinfo`
- [ ] Agent extracts CPU model from ARM `/proc/cpuinfo`
- [ ] Agent extracts core count via os.cpu_count()
- [ ] Heartbeat includes cpu_info when available
- [ ] Heartbeat works without cpu_info (backwards compatibility)
- [ ] Backend stores cpu_model in Server
- [ ] Backend stores cpu_cores in Server
- [ ] Server API returns cpu_model and cpu_cores
- [ ] Migration adds columns without data loss
- [ ] CPU info logged at agent startup

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0053-01 | get_cpu_info returns model and cores | AC1, AC2 | Unit | Pending |
| TC-US0053-02 | ARM CPU model detection | AC1 | Unit | Pending |
| TC-US0053-03 | Heartbeat includes cpu_info | AC3 | Integration | Pending |
| TC-US0053-04 | Backend stores CPU info | AC4 | Integration | Pending |
| TC-US0053-05 | Server API returns CPU fields | AC5 | API | Pending |
| TC-US0053-06 | Old agent without cpu_info | AC4 | Integration | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 10/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0003: Agent Heartbeat Endpoint | Story | Done |
| US0004: Agent Script | Story | Done |

## Estimation

**Story Points:** 2

**Complexity:** Low - collector function and schema extension

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial story creation for enhanced power estimation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
