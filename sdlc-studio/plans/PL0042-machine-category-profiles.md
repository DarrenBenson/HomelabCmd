# PL0042: Machine Category Power Profiles - Implementation Plan

> **Status:** Complete
> **Story:** [US0054: Machine Category Power Profiles](../stories/US0054-machine-category-profiles.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Language:** Python

## Overview

Define machine categories with power profiles, implement CPU-based category inference, and auto-detect category on heartbeat. Enables accurate power estimation based on machine type.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Machine category enum | 9 categories defined in MachineCategory enum |
| AC2 | Power profiles defined | POWER_PROFILES dict with idle/max watts per category |
| AC3 | Category inference | `infer_category_from_cpu()` pattern matching |
| AC4 | Auto-detection on heartbeat | Category auto-set when cpu_info received |
| AC5 | User category preserved | User-set category not overwritten by auto-detection |
| AC6 | Category stored in database | machine_category, machine_category_source, idle_watts columns |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI (backend)
- **Test Framework:** pytest

### Relevant Best Practices

- Use type hints for all function signatures
- Use enums for categorical values
- Compile regex patterns for performance (if needed)
- Pattern matching priority matters - test ordering

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|-----------------|
| FastAPI | /tiangolo/fastapi | Pydantic models | BaseModel, Field |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Column definitions | mapped_column, String |

### Existing Patterns

- **Enums:** Follow existing `ServerStatus` enum pattern
- **Services:** Power service follows service module pattern
- **Heartbeat:** CPU info already in heartbeat via US0053

## Recommended Approach

**Strategy:** TDD (as specified in workflow)
**Rationale:** Pattern matching logic requires comprehensive test coverage for all CPU types

### Test Priority

1. Unit tests for `MachineCategory` enum values (AC1)
2. Unit tests for `POWER_PROFILES` completeness (AC2)
3. Unit tests for `infer_category_from_cpu()` pattern matching (AC3)
4. Integration tests for heartbeat auto-detection (AC4)
5. Integration tests for user category preservation (AC5)
6. Integration tests for database storage (AC6)

### Documentation Updates Required

- [ ] API contract in story already documents response shapes
- [ ] No additional documentation needed

## Implementation Status

All implementation was completed in a prior session. This plan documents testing requirements.

### Completed Work

| Component | File | Status |
|-----------|------|--------|
| MachineCategory enum | `backend/.../services/power.py` | Done |
| PowerProfile dataclass | `backend/.../services/power.py` | Done |
| POWER_PROFILES dict | `backend/.../services/power.py` | Done |
| infer_category_from_cpu() | `backend/.../services/power.py` | Done |
| get_power_config() | `backend/.../services/power.py` | Done |
| calculate_power_watts() | `backend/.../services/power.py` | Done |
| Server model columns | `backend/.../db/models/server.py` | Done |
| Heartbeat handler integration | `backend/.../api/routes/agents.py` | Done |

### Remaining Work

| Component | File | Status |
|-----------|------|--------|
| Power service unit tests | `backend/tests/test_power_service.py` | **Missing** |
| Heartbeat integration tests | `backend/tests/test_heartbeat.py` | **Partial** - needs category tests |
| Server API tests | `backend/tests/test_servers.py` | **Partial** - needs category fields |

## Implementation Steps

### Phase 1: Testing & Validation

**Goal:** Verify all acceptance criteria are met with comprehensive tests

#### Step 1.1: Power Service Unit Tests

- [ ] Test MachineCategory has all 9 values (AC1)
- [ ] Test POWER_PROFILES has entry for each category (AC2)
- [ ] Test idle_watts and max_watts values per category (AC2)
- [ ] Test ARM architecture detected as SBC (AC3)
- [ ] Test Xeon detected as Rack Server (AC3)
- [ ] Test EPYC detected as Rack Server (AC3)
- [ ] Test Core i5-8250U (U-series) detected as Office Laptop (AC3)
- [ ] Test Core i5-12400 detected as Office Desktop (AC3)
- [ ] Test Core i9-13900K detected as Workstation (AC3)
- [ ] Test N100 detected as Mini PC (AC3)
- [ ] Test Celeron detected as Mini PC (AC3)
- [ ] Test unknown CPU returns None (AC3)

**Files to create:**
- `backend/tests/test_power_service.py` - Unit tests for power service

#### Step 1.2: Heartbeat Integration Tests

- [ ] Test heartbeat with cpu_info auto-detects category (AC4)
- [ ] Test user-set category not overwritten (AC5)
- [ ] Test machine_category stored in database (AC6)
- [ ] Test machine_category_source stored as "auto" (AC6)

**Files to modify:**
- `backend/tests/test_heartbeat.py` - Add category detection tests

#### Step 1.3: Server API Tests

- [ ] Test GET `/api/v1/servers/{id}` includes machine_category (AC6)
- [ ] Test GET `/api/v1/servers/{id}` includes machine_category_source (AC6)

**Files to modify:**
- `backend/tests/test_servers.py` - Add category field assertions

#### Step 1.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test: enum values | Pending |
| AC2 | Unit test: profiles complete | Pending |
| AC3 | Unit test: pattern matching | Pending |
| AC4 | Integration test: heartbeat detection | Pending |
| AC5 | Integration test: user preservation | Pending |
| AC6 | Integration test: database storage | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Unknown CPU model | Return None; server requires manual category | Done | [ ] |
| 2 | No cpu_model in heartbeat | Skip auto-detection; preserve existing category | Done | [ ] |
| 3 | User-set category | Never overwrite; machine_category_source="user" protects | Done | [ ] |
| 4 | CPU matches multiple patterns | First match wins (priority order) | Done | [ ] |
| 5 | Very long CPU model | Patterns still match substrings | Done | [ ] |
| 6 | Mixed architecture (M1 Mac) | "m1"/"m2" patterns → Office Laptop | Done | [ ] |
| 7 | Old agent without cpu_info | Skip detection; backwards compatible | Done | [ ] |
| 8 | Category set, idle_watts null | Use category default | Done | [ ] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

### Edge Case Implementation Notes

All edge cases were handled in the implementation. Tests should verify each case.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pattern false positives | Wrong category detected | Comprehensive test coverage for real CPU models |
| Pattern ordering issues | Unexpected matches | Test priority order explicitly |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0053: Agent CPU Details Collection | Story | Done - CPU info in heartbeat |

## Open Questions

None - all questions resolved.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors

## Notes

Implementation was completed in a prior session. Primary remaining work is writing comprehensive tests for the power service, especially for the pattern matching logic in `infer_category_from_cpu()`.
