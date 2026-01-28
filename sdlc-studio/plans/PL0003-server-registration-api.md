# PL0003: Server Registration API - Implementation Plan

> **Status:** Complete
> **Story:** [US0002: Server Registration API](../stories/US0002-server-registration-api.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

This plan implements the Server Registration API endpoints for HomelabCmd. Building on the database layer from US0001, it provides CRUD operations for server management. Servers can be pre-registered with TDP values for cost tracking and meaningful display names before agent deployment.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | List all servers | GET `/api/v1/servers` returns array of all servers with status |
| AC2 | Register new server | POST `/api/v1/servers` creates server with status "unknown" |
| AC3 | Get server details | GET `/api/v1/servers/{id}` returns full server details |
| AC4 | Update server | PUT `/api/v1/servers/{id}` updates specified fields |
| AC5 | Delete server | DELETE `/api/v1/servers/{id}` removes server and metrics |
| AC6 | API authentication | All endpoints require valid X-API-Key header |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with Pydantic v2
- **ORM:** SQLAlchemy 2.0+ (async)
- **Test Framework:** pytest + pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling
- Use Pydantic for request/response validation
- FastAPI dependency injection patterns
- Descriptive HTTP status codes

### Existing Patterns

From US0001/US0045 implementation:
- Server and Metrics models in `backend/src/homelab_cmd/db/models/`
- Async session management in `backend/src/homelab_cmd/db/session.py`
- API key authentication in `backend/src/homelab_cmd/api/deps.py`
- Route registration in `backend/src/homelab_cmd/main.py`
- System routes at `backend/src/homelab_cmd/api/routes/system.py`

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** TDD stub tests already exist in `tests/test_servers.py`. Implementation will:
1. Remove skip decorators incrementally
2. Run tests to see failures
3. Implement to make tests pass
4. Refactor if needed

### Test Priority

1. List servers (empty array initially)
2. Register server with minimal fields
3. Register server with all fields
4. Get server details
5. Update server
6. Delete server
7. Error cases (404, 409, 401)

### Documentation Updates Required

- [ ] Update test skip reasons as endpoints are implemented

## Implementation Steps

### Phase 1: Pydantic Schemas

**Goal:** Define request/response models for API validation

#### Step 1.1: Create server schemas

- [ ] Create `backend/src/homelab_cmd/api/schemas/__init__.py`
- [ ] Create `backend/src/homelab_cmd/api/schemas/server.py`
- [ ] Define ServerCreate schema (POST request body)
- [ ] Define ServerUpdate schema (PUT request body)
- [ ] Define ServerResponse schema (single server response)
- [ ] Define ServerListResponse schema (list response with total)

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/__init__.py`
- `backend/src/homelab_cmd/api/schemas/server.py`

**Schema definitions:**

```python
from pydantic import BaseModel, Field
from datetime import datetime

class ServerCreate(BaseModel):
    """Schema for creating a new server."""
    id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    hostname: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = Field(None, max_length=255)
    ip_address: str | None = Field(None, max_length=45)
    tdp_watts: int | None = Field(None, ge=0, le=10000)

class ServerUpdate(BaseModel):
    """Schema for updating a server (all fields optional)."""
    hostname: str | None = Field(None, min_length=1, max_length=255)
    display_name: str | None = Field(None, max_length=255)
    ip_address: str | None = Field(None, max_length=45)
    tdp_watts: int | None = Field(None, ge=0, le=10000)

class LatestMetrics(BaseModel):
    """Schema for latest metrics summary."""
    cpu_percent: float | None = None
    memory_percent: float | None = None
    disk_percent: float | None = None

class ServerResponse(BaseModel):
    """Schema for server response."""
    id: str
    hostname: str
    display_name: str | None = None
    ip_address: str | None = None
    status: str
    tdp_watts: int | None = None
    os_distribution: str | None = None
    os_version: str | None = None
    kernel_version: str | None = None
    architecture: str | None = None
    last_seen: datetime | None = None
    created_at: datetime
    updated_at: datetime
    latest_metrics: LatestMetrics | None = None

    model_config = {"from_attributes": True}

class ServerListResponse(BaseModel):
    """Schema for server list response."""
    servers: list[ServerResponse]
    total: int
```

### Phase 2: Server Routes

**Goal:** Implement CRUD endpoints for server management

#### Step 2.1: Create servers router

- [ ] Create `backend/src/homelab_cmd/api/routes/servers.py`
- [ ] Add router with `/servers` prefix
- [ ] Import dependencies (auth, session, schemas)

**Files to create:**
- `backend/src/homelab_cmd/api/routes/servers.py`

**Router setup:**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/servers", tags=["servers"])
```

#### Step 2.2: Implement list servers (GET /api/v1/servers)

- [ ] Add list endpoint
- [ ] Query all servers from database
- [ ] Include latest metrics for each server (optional)
- [ ] Return ServerListResponse with total count

**AC1 Implementation:**
```python
@router.get("", response_model=ServerListResponse)
async def list_servers(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerListResponse:
    """List all registered servers."""
    result = await session.execute(select(Server))
    servers = result.scalars().all()
    return ServerListResponse(
        servers=[ServerResponse.model_validate(s) for s in servers],
        total=len(servers),
    )
```

#### Step 2.3: Implement register server (POST /api/v1/servers)

- [ ] Add create endpoint
- [ ] Validate request body with ServerCreate
- [ ] Check for duplicate server_id (409 Conflict)
- [ ] Create server with status="unknown"
- [ ] Return ServerResponse with 201 Created

**AC2 Implementation:**
```python
@router.post("", response_model=ServerResponse, status_code=201)
async def register_server(
    server_data: ServerCreate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Register a new server."""
    # Check for existing server
    existing = await session.get(Server, server_data.id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFLICT", "message": f"Server '{server_data.id}' already exists"},
        )

    server = Server(
        id=server_data.id,
        hostname=server_data.hostname,
        display_name=server_data.display_name,
        ip_address=server_data.ip_address,
        tdp_watts=server_data.tdp_watts,
        status=ServerStatus.UNKNOWN.value,
    )
    session.add(server)
    await session.flush()
    await session.refresh(server)
    return ServerResponse.model_validate(server)
```

#### Step 2.4: Implement get server details (GET /api/v1/servers/{server_id})

- [ ] Add detail endpoint with path parameter
- [ ] Retrieve server by ID
- [ ] Return 404 if not found
- [ ] Include latest metrics if available

**AC3 Implementation:**
```python
@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Get server details by ID."""
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )
    return ServerResponse.model_validate(server)
```

#### Step 2.5: Implement update server (PUT /api/v1/servers/{server_id})

- [ ] Add update endpoint
- [ ] Validate request body with ServerUpdate
- [ ] Return 404 if server not found
- [ ] Update only provided fields (exclude_unset)
- [ ] Return updated ServerResponse

**AC4 Implementation:**
```python
@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: str,
    server_data: ServerUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerResponse:
    """Update server configuration."""
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    update_data = server_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)

    await session.flush()
    await session.refresh(server)
    return ServerResponse.model_validate(server)
```

#### Step 2.6: Implement delete server (DELETE /api/v1/servers/{server_id})

- [ ] Add delete endpoint
- [ ] Return 404 if server not found
- [ ] Delete server (cascade deletes metrics via FK)
- [ ] Return 204 No Content

**AC5 Implementation:**
```python
@router.delete("/{server_id}", status_code=204)
async def delete_server(
    server_id: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> None:
    """Delete a server and its associated metrics."""
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    await session.delete(server)
```

### Phase 3: Route Registration

**Goal:** Register server routes with the FastAPI application

#### Step 3.1: Update main.py

- [ ] Import servers router
- [ ] Include router with `/api/v1` prefix

**Files to modify:**
- `backend/src/homelab_cmd/main.py`

**Addition:**
```python
from homelab_cmd.api.routes.servers import router as servers_router

app.include_router(servers_router, prefix="/api/v1")
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria with existing TDD tests

#### Step 4.1: Update test fixtures

- [ ] Ensure test database includes server table
- [ ] Add any needed test helpers

**Files to modify:**
- `tests/conftest.py` (if needed)

#### Step 4.2: Enable and run tests

- [ ] Remove skip decorators from `tests/test_servers.py` incrementally
- [ ] Run tests to verify each endpoint
- [ ] Fix any failures

**Test classes to enable:**
- TestListServers (TC006)
- TestRegisterServer (TC007)
- TestDuplicateServer (TC008)
- TestGetServerDetails (TC009)
- TestGetNonexistentServer (TC010)
- TestUpdateServer (TC011)
- TestDeleteServer (TC012)

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | TestListServers passes | Pending |
| AC2 | TestRegisterServer passes | Pending |
| AC3 | TestGetServerDetails passes | Pending |
| AC4 | TestUpdateServer passes | Pending |
| AC5 | TestDeleteServer passes | Pending |
| AC6 | All tests use auth_headers fixture | Pending |

## Project Structure (After Implementation)

```
backend/src/homelab_cmd/
├── __init__.py
├── main.py                    # Updated with servers router
├── config.py
├── api/
│   ├── __init__.py
│   ├── deps.py               # Auth dependencies (existing)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── system.py         # Health/info endpoints (existing)
│   │   └── servers.py        # Server CRUD endpoints (new)
│   └── schemas/
│       ├── __init__.py       # New
│       └── server.py         # Server schemas (new)
└── db/
    ├── __init__.py
    ├── base.py
    ├── session.py
    └── models/
        ├── __init__.py
        ├── server.py         # Server model (existing)
        └── metrics.py        # Metrics model (existing)

tests/
├── conftest.py
├── test_auth.py
├── test_health.py
├── test_docs.py
├── test_database.py
└── test_servers.py           # Tests to enable
```

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Duplicate server_id | 409 Conflict with clear error message |
| Invalid server_id format | 422 Unprocessable Entity via Pydantic |
| Server not found | 404 Not Found with NOT_FOUND code |
| Invalid API key | 401 Unauthorized (existing middleware) |
| Missing required field | 422 with field-specific error (Pydantic) |
| Empty request body on PUT | No changes made, return current state |
| Server ID with invalid chars | 422 via regex pattern validation |
| TDP watts negative | 422 via ge=0 constraint |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Test database isolation | Test pollution | Each test uses fresh in-memory DB |
| Cascade delete issues | Orphan metrics | Already tested in US0001 |
| Auth bypass | Security vulnerability | All routes use verify_api_key dependency |
| Schema validation gaps | Invalid data stored | Comprehensive Pydantic validation |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001 | Story | Provides Server and Metrics models |
| US0045 | Story | Provides auth middleware, FastAPI structure |
| Pydantic | Python package | Already installed (FastAPI dependency) |
| SQLAlchemy | Python package | Already installed |

## Open Questions

None - API contracts fully specified in US0002.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing (TC006-TC012)
- [ ] Edge cases handled
- [ ] Code follows Python best practices
- [ ] No linting errors (ruff)
- [ ] Pydantic schemas match TRD/story contracts
- [ ] OpenAPI spec auto-generated correctly
- [ ] All endpoints documented

## Notes

This story builds directly on US0001's database models. Key patterns:
- Uses `from_attributes=True` for Pydantic model serialisation from SQLAlchemy
- Follows FastAPI dependency injection for session and auth
- Returns structured error responses with `code` and `message`

The `latest_metrics` field in ServerResponse is optional for now and will be populated in US0003 (Agent Heartbeat) when metrics are collected.

## Next Steps After Completion

- **US0003**: Agent Heartbeat Endpoint (metrics collection)
- **US0004**: Agent Script (client-side heartbeat sender)
