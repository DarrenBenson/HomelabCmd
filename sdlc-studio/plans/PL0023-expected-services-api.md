# PL0023: Expected Services Configuration API - Implementation Plan

> **Status:** Complete
> **Story:** [US0019: Expected Services Configuration API](../stories/US0019-expected-services-api.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Implement CRUD API endpoints for configuring expected services per server. This allows users to define which services each server should run, mark them as critical or non-critical, and enable/disable monitoring. The list endpoint includes current service status from the latest heartbeat.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | List expected services | GET returns array of services with current status |
| AC2 | Add expected service | POST creates new expected service |
| AC3 | Update expected service | PUT updates service configuration |
| AC4 | Delete expected service | DELETE removes expected service |
| AC5 | Critical flag configurable | is_critical flag can be set and updated |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12
- **Framework:** FastAPI
- **Test Framework:** pytest with TestClient

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling
- Pydantic models for validation
- Logging instead of print

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | nested routes path params | APIRouter, HTTPException |
| Pydantic | /pydantic/pydantic | optional fields validation | Field(), model_dump(exclude_unset=True) |

### Existing Patterns

From codebase exploration:

1. **CRUD route pattern:** `routes/servers.py` - GET list, POST create, GET single, PUT update, DELETE
2. **Schema pattern:** `schemas/server.py` - Create/Update/Response models with ConfigDict
3. **Error responses:** `api/responses.py` - AUTH_RESPONSES, NOT_FOUND_RESPONSE, CONFLICT_RESPONSE
4. **Database access:** async session with select(), session.get(), session.add(), session.delete()

Reference files:
- `backend/src/homelab_cmd/api/routes/servers.py` - CRUD pattern for servers
- `backend/src/homelab_cmd/api/schemas/server.py` - Schema patterns
- `backend/src/homelab_cmd/db/models/service.py` - ExpectedService and ServiceStatus models

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Standard CRUD patterns with clear requirements. API testing is straightforward with TestClient and doesn't require mocking.

### Test Priority

1. CRUD operations work correctly (create, read, update, delete)
2. Error cases return correct status codes (404, 409)
3. List includes current_status from ServiceStatus

### Documentation Updates Required

- [ ] None required (OpenAPI auto-generated from schemas)

## Implementation Steps

### Phase 1: Create Pydantic Schemas

**Goal:** Define request/response schemas for service endpoints

#### Step 1.1: Create service schemas file

- [x] Create `backend/src/homelab_cmd/api/schemas/service.py`
- [x] Add ExpectedServiceCreate schema (service_name required, display_name/is_critical optional)
- [x] Add ExpectedServiceUpdate schema (all fields optional)
- [x] Add ServiceCurrentStatus schema (status, pid, memory_mb, cpu_percent, last_seen)
- [x] Add ExpectedServiceResponse schema (includes current_status)
- [x] Add ExpectedServiceListResponse schema (services array + total)

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/service.py` - New schema file

**Schema structure:**

```python
class ExpectedServiceCreate(BaseModel):
    service_name: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9@._-]+$")
    display_name: str | None = Field(None, max_length=255)
    is_critical: bool = False

class ExpectedServiceUpdate(BaseModel):
    display_name: str | None = None
    is_critical: bool | None = None
    enabled: bool | None = None

class ServiceCurrentStatus(BaseModel):
    status: str
    pid: int | None
    memory_mb: float | None
    cpu_percent: float | None
    last_seen: datetime

class ExpectedServiceResponse(BaseModel):
    service_name: str
    display_name: str | None
    is_critical: bool
    enabled: bool
    current_status: ServiceCurrentStatus | None = None

class ExpectedServiceListResponse(BaseModel):
    services: list[ExpectedServiceResponse]
    total: int
```

### Phase 2: Create Services Route

**Goal:** Implement CRUD endpoints for expected services

#### Step 2.1: Create services route file

- [x] Create `backend/src/homelab_cmd/api/routes/services.py`
- [x] Implement GET `/servers/{server_id}/services` (list)
- [x] Implement POST `/servers/{server_id}/services` (create)
- [x] Implement PUT `/servers/{server_id}/services/{service_name}` (update)
- [x] Implement DELETE `/servers/{server_id}/services/{service_name}` (delete)

**Files to create:**
- `backend/src/homelab_cmd/api/routes/services.py` - New route file

**Implementation details:**

```python
router = APIRouter(prefix="/servers", tags=["Services"])

@router.get("/{server_id}/services")
# Query ExpectedService by server_id
# For each, query latest ServiceStatus for current_status
# Return ExpectedServiceListResponse

@router.post("/{server_id}/services", status_code=201)
# Verify server exists
# Check for duplicate service_name
# Create ExpectedService record
# Return ExpectedServiceResponse

@router.put("/{server_id}/services/{service_name}")
# Find ExpectedService by server_id + service_name
# Update with exclude_unset pattern
# Return ExpectedServiceResponse

@router.delete("/{server_id}/services/{service_name}", status_code=204)
# Find and delete ExpectedService
```

#### Step 2.2: Register router in main.py

- [x] Import services router
- [x] Add include_router call

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add router registration

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 3.1: Create API Tests

- [x] Create `tests/test_services_api.py`
- [x] Test list services returns empty for no services
- [x] Test list services returns all expected services
- [x] Test list includes current_status when available
- [x] Test create service with minimal fields
- [x] Test create service with all fields
- [x] Test duplicate service returns 409
- [x] Test update changes only specified fields
- [x] Test update critical flag (AC5)
- [x] Test delete removes service
- [x] Test 404 for non-existent server
- [x] Test 404 for non-existent service
- [x] Test authentication required

**Files to create:**
- `tests/test_services_api.py` - API tests

#### Step 3.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test GET returns services array with current_status | Pass |
| AC2 | Test POST creates service correctly | Pass |
| AC3 | Test PUT updates service fields | Pass |
| AC4 | Test DELETE removes service | Pass |
| AC5 | Test is_critical can be set and updated | Pass |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Server not found | Return 404 with error message |
| Service already exists | Return 409 Conflict |
| Service not found (update/delete) | Return 404 |
| No services configured | Return empty array |
| No current status available | current_status = None |
| Invalid service name format | Return 422 validation error |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Query performance with many services | Low | Indexed queries, limit to single server |
| Race condition on create | Low | Unique constraint in database |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0002: Server Registration API | Story | Done |
| US0017: Service Schema | Story | Done |
| US0018: Agent Service Collection | Story | Done |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (25 tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Ready for code review

## Notes

- Service name pattern allows systemd-style names: lowercase alphanumeric, dots, hyphens, underscores, @ symbol
- The current_status is derived from the most recent ServiceStatus record for each service
- When display_name is not provided, it defaults to service_name in the response
