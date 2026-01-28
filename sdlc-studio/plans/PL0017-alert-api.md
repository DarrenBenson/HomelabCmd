# PL0017: Alert API Endpoints - Implementation Plan

> **Status:** Complete
> **Story:** [US0014: Alert API Endpoints](../stories/US0014-alert-api.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Implement REST API endpoints for listing, viewing, acknowledging, and resolving alerts. The Alert model and database schema already exist (from US0010). This story adds the API layer following existing patterns from servers.py and metrics.py.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | List alerts | GET /api/v1/alerts returns array of alerts |
| AC2 | Filter by status | ?status=open filters to open alerts only |
| AC3 | Filter by severity | ?severity=critical filters to critical alerts only |
| AC4 | Acknowledge alert | POST /alerts/{id}/acknowledge changes status |
| AC5 | Resolve alert | POST /alerts/{id}/resolve changes status |
| AC6 | Get alert details | GET /alerts/{id} returns full alert info |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI
- **Test Framework:** pytest

### Relevant Best Practices

- Use `ConfigDict(from_attributes=True)` for ORM model conversion
- HTTP requests should have explicit timeouts
- Catch specific exceptions, not bare `except:`
- Use type hints on public functions
- Use logging instead of print for debugging

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | Query parameters, path operations | Query(...), Path(...), Depends() |
| Pydantic | /pydantic/pydantic | Model validation, from_attributes | model_validate, ConfigDict |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Async queries, filtering | select().where(), .scalars().all() |

### Existing Patterns

**From servers.py - List endpoint:**
```python
@router.get("", response_model=ServerListResponse)
async def list_servers(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ServerListResponse:
    result = await session.execute(select(Server))
    servers = result.scalars().all()
    return ServerListResponse(servers=..., total=len(servers))
```

**From servers.py - Detail with 404:**
```python
@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(server_id: str, ...):
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail={...})
```

**From metrics.py - Query filtering:**
```python
result = await session.execute(
    select(Metrics)
    .where(Metrics.server_id == server_id)
    .order_by(Metrics.timestamp)
)
```

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Standard CRUD patterns with clear existing examples. Implementation is straightforward; tests verify correctness after.

### Test Priority

1. List alerts with various filter combinations
2. Acknowledge and resolve status transitions
3. 404 handling for non-existent alerts
4. Idempotent operations (re-acknowledge, re-resolve)

### Documentation Updates Required

- [ ] OpenAPI spec automatically updated via FastAPI

## Implementation Steps

### Phase 1: Create Alert Schemas

**Goal:** Define Pydantic models for API request/response.

#### Step 1.1: Create alerts.py schema file

- [ ] Create `backend/src/homelab_cmd/api/schemas/alerts.py`
- [ ] Define AlertResponse model matching Alert ORM model
- [ ] Define AlertListResponse with pagination fields
- [ ] Define AlertAcknowledgeResponse
- [ ] Define AlertResolveResponse

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/alerts.py` - All alert schemas

**Schema definitions:**
```python
class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: str
    server_name: str | None = None  # From server relationship
    alert_type: str
    severity: str
    status: str
    title: str
    message: str | None = None
    threshold_value: float | None = None
    actual_value: float | None = None
    created_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    auto_resolved: bool = False

class AlertListResponse(BaseModel):
    alerts: list[AlertResponse]
    total: int
    limit: int
    offset: int

class AlertAcknowledgeResponse(BaseModel):
    id: int
    status: str
    acknowledged_at: datetime

class AlertResolveResponse(BaseModel):
    id: int
    status: str
    resolved_at: datetime
    auto_resolved: bool
```

#### Step 1.2: Update schemas __init__.py

- [ ] Export alert schemas from `__init__.py`

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/__init__.py` - Add exports

### Phase 2: Create Alert Router

**Goal:** Implement all API endpoints.

#### Step 2.1: Create alerts router

- [ ] Create `backend/src/homelab_cmd/api/routes/alerts.py`
- [ ] Implement GET /alerts with query params
- [ ] Implement GET /alerts/{alert_id}
- [ ] Implement POST /alerts/{alert_id}/acknowledge
- [ ] Implement POST /alerts/{alert_id}/resolve

**Files to create:**
- `backend/src/homelab_cmd/api/routes/alerts.py` - All alert endpoints

**Endpoint implementations:**

```python
router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=AlertListResponse)
async def list_alerts(
    status: str | None = Query(None, description="Filter by status"),
    severity: str | None = Query(None, description="Filter by severity"),
    server_id: str | None = Query(None, description="Filter by server"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AlertListResponse:
    query = select(Alert)

    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    if server_id:
        query = query.where(Alert.server_id == server_id)

    # Get total count before pagination
    count_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    alerts = result.scalars().all()

    return AlertListResponse(
        alerts=[_to_response(a) for a in alerts],
        total=total,
        limit=limit,
        offset=offset,
    )
```

#### Step 2.2: Register router in main.py

- [ ] Import alerts router
- [ ] Add `app.include_router(alerts.router, prefix="/api/v1")`

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Import and register alerts router

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met.

#### Step 3.1: API Tests

- [ ] Create `tests/test_alerts_api.py`
- [ ] Test list alerts (empty, with data)
- [ ] Test filter by status
- [ ] Test filter by severity
- [ ] Test filter by server_id
- [ ] Test combined filters
- [ ] Test pagination (limit, offset)
- [ ] Test get alert detail
- [ ] Test acknowledge alert
- [ ] Test resolve alert
- [ ] Test 404 for non-existent alert
- [ ] Test idempotent acknowledge
- [ ] Test idempotent resolve
- [ ] Test authentication required

**Files to create:**
- `tests/test_alerts_api.py` - All API tests

#### Step 3.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test list returns array | Complete |
| AC2 | Test ?status=open filter | Complete |
| AC3 | Test ?severity=critical filter | Complete |
| AC4 | Test POST /acknowledge changes status | Complete |
| AC5 | Test POST /resolve changes status | Complete |
| AC6 | Test GET /{id} returns full detail | Complete |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Alert not found | 404 with error detail |
| Acknowledge already acknowledged | 200 OK (idempotent) |
| Acknowledge resolved alert | 400 Bad Request |
| Resolve already resolved | 200 OK (idempotent) |
| Resolve open alert (skip ack) | 200 OK (allowed) |
| Invalid filter value | 422 Unprocessable Entity (FastAPI validation) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| N+1 query for server_name | Performance | Use joinedload or add server_name to Alert model |
| Large alert lists | Memory | Enforce limit cap (100 max) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0010: Alert Schema | Story | Done - Alert model exists |
| SQLAlchemy async session | Internal | Already configured |
| FastAPI auth | Internal | verify_api_key exists |

## Open Questions

None - all requirements are clear.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] API tests written and passing (41 tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] OpenAPI spec includes alert endpoints

## Notes

- Alert creation happens internally via threshold evaluation (not via API)
- Alerts are never deleted, only resolved
- server_name comes from joining with Server table
- Use existing Alert.acknowledge() and Alert.resolve() methods
