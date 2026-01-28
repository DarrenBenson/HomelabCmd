# PL0041: Agent CPU Details Collection - Implementation Plan

> **Status:** Complete
> **Story:** [US0053: Agent CPU Details Collection](../stories/US0053-agent-cpu-details.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Language:** Python / TypeScript

## Overview

Extend the agent to collect CPU model and core count, transmit via heartbeat, and store in the Server entity. This enables auto-detection of machine categories for more accurate power estimation.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Agent collects CPU model | Extract CPU model from `/proc/cpuinfo` |
| AC2 | Agent collects CPU core count | Obtain core count via `os.cpu_count()` |
| AC3 | CPU info in heartbeat | Payload includes `cpu_info.cpu_model` and `cpu_info.cpu_cores` |
| AC4 | Backend stores CPU info | Server record updated with cpu_model and cpu_cores |
| AC5 | CPU info in server API | GET `/api/v1/servers/{id}` returns cpu_model and cpu_cores |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI (backend), standalone Python script (agent)
- **Test Framework:** pytest (backend), pytest (agent)

### Relevant Best Practices

- Use type hints for all function signatures
- Follow existing patterns for collectors and heartbeat payload
- Maintain backwards compatibility with old agents

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | Pydantic models | BaseModel, Field |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Column definitions | mapped_column, String |

### Existing Patterns

- **Collectors:** `agent/collectors.py` has `get_os_info()`, `get_metrics()` - follow same pattern
- **Heartbeat:** `agent/heartbeat.py` constructs payload, sends POST to hub
- **Schema:** `backend/.../schemas/heartbeat.py` has `OSInfo`, `MetricsPayload` - add `CPUInfo`
- **Handler:** `backend/.../routes/agents.py` processes heartbeat, updates Server

## Recommended Approach

**Strategy:** TDD (as specified in workflow)
**Rationale:** API story with clear edge cases and Given/When/Then ACs; extends existing patterns

### Test Priority

1. Unit tests for `get_cpu_info()` with mocked `/proc/cpuinfo`
2. Integration tests for heartbeat with cpu_info payload
3. API tests for server detail response with cpu fields

### Documentation Updates Required

- [ ] API contract in story already documents request/response shapes
- [ ] No additional documentation needed

## Implementation Status

Most implementation was completed in a prior session. This plan documents remaining work.

### Completed Work

| Component | File | Status |
|-----------|------|--------|
| Agent collector | `agent/collectors.py` | Done - `get_cpu_info()` implemented |
| Agent heartbeat | `agent/heartbeat.py` | Done - cpu_info parameter added |
| Agent main | `agent/__main__.py` | Done - collects and logs CPU info |
| Backend schema | `backend/.../schemas/heartbeat.py` | Done - CPUInfo model |
| Backend model | `backend/.../db/models/server.py` | Done - cpu_model, cpu_cores columns |
| Migration | `migrations/.../4d5e6f7g8h9i_*.py` | Done - adds columns |
| Heartbeat handler | `backend/.../routes/agents.py` | Done - stores CPU info |

### Remaining Work

| Component | File | Status |
|-----------|------|--------|
| Server API schema | `backend/.../schemas/server.py` | **Missing** - cpu_model, cpu_cores fields |
| Tests | `tests/test_collectors.py` | **Missing** - unit tests for get_cpu_info |
| Tests | `tests/test_heartbeat_cpu.py` | **Missing** - integration tests |
| Tests | `tests/test_servers_api.py` | **Missing** - server detail includes CPU |

## Implementation Steps

### Phase 1: Complete API Schema (AC5)

**Goal:** Server API response includes cpu_model and cpu_cores

#### Step 1.1: Update ServerResponse Schema

- [ ] Add `cpu_model: str | None` field to `ServerResponse`
- [ ] Add `cpu_cores: int | None` field to `ServerResponse`

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py` - Add CPU fields to response

**Considerations:**
Fields are already in the model with `from_attributes=True`, so just adding to schema will work.

### Phase 2: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 2.1: Agent Unit Tests

- [ ] Test `get_cpu_info()` returns model and cores
- [ ] Test x86 CPU model detection from `/proc/cpuinfo`
- [ ] Test ARM CPU model detection (Model/Hardware fields)
- [ ] Test fallback when `/proc/cpuinfo` not readable
- [ ] Test fallback to `platform.processor()`

**Files to create:**
- `agent/test_collectors.py` - Unit tests for collectors

#### Step 2.2: Backend Integration Tests

- [ ] Test heartbeat with cpu_info stores values
- [ ] Test heartbeat without cpu_info (backwards compat)
- [ ] Test very long CPU model is truncated

**Files to modify:**
- `backend/tests/test_heartbeat.py` - Add CPU info test cases

#### Step 2.3: API Tests

- [ ] Test GET `/api/v1/servers/{id}` includes cpu_model
- [ ] Test GET `/api/v1/servers/{id}` includes cpu_cores

**Files to modify:**
- `backend/tests/test_servers.py` - Add CPU field assertions

#### Step 2.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test: get_cpu_info returns model | Pending |
| AC2 | Unit test: get_cpu_info returns cores | Pending |
| AC3 | Integration test: heartbeat payload | Pending |
| AC4 | Integration test: server record updated | Pending |
| AC5 | API test: server response fields | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | `/proc/cpuinfo` not readable | Log warning, return None for cpu_model | Phase 1 (done) | [ ] |
| 2 | ARM without Model field | Use Hardware field as fallback | Phase 1 (done) | [ ] |
| 3 | `os.cpu_count()` returns None | Store None, no error | Phase 1 (done) | [ ] |
| 4 | Very long CPU model string | Truncate to 255 characters (schema max_length) | Phase 1 (done) | [ ] |
| 5 | Old agent (no cpu_info) | Backend ignores missing field | Phase 1 (done) | [ ] |
| 6 | CPU model contains special characters | Store as-is; no sanitisation | Phase 1 (done) | [ ] |
| 7 | Container without `/proc/cpuinfo` | Log warning, return None | Phase 1 (done) | [ ] |
| 8 | Multiple CPU sockets | Return first model found | Phase 1 (done) | [ ] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

### Edge Case Implementation Notes

All edge cases were handled in the collector implementation. Tests should verify each case.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent not deployed | No CPU info available | Graceful null handling |
| Migration not applied | Column missing | Migration runs on startup |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0003: Agent Heartbeat Endpoint | Story | Done - heartbeat infrastructure |
| US0004: Agent Script | Story | Done - agent already deployed |

## Open Questions

None - all questions resolved.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Schema complete (AC5)

## Notes

Implementation was largely completed in a prior session. Primary remaining work:
1. Add cpu_model/cpu_cores to ServerResponse schema (AC5)
2. Write comprehensive tests for all ACs and edge cases
