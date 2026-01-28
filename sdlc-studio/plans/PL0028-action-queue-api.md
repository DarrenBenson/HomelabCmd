# PL0028: Action Queue API - Implementation Plan

> **Status:** Complete
> **Story:** [US0024: Action Queue API](../stories/US0024-action-queue-api.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Implement API endpoints to queue and list remediation actions. Actions are auto-approved for normal servers and remain pending for servers in maintenance mode (paused). This story also requires implementing the `is_paused` field from US0029 as a prerequisite.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | List actions | GET /actions with filtering and pagination |
| AC2 | Get action | GET /actions/{id} returns full details |
| AC3 | Create (normal) | POST /actions on normal server → status=approved |
| AC4 | Create (paused) | POST /actions on paused server → status=pending |
| AC5 | Whitelist | Non-whitelisted commands rejected with 403 |
| AC6 | Server filter | GET /servers/{id}/actions returns server-specific actions |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with SQLAlchemy 2.0 async
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

- Use Pydantic schemas for request/response validation
- Use FastAPI's `Query` for optional filter parameters
- Follow existing patterns from alerts.py and services.py routes
- Use `joinedload` for eager loading relationships

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | `/tiangolo/fastapi` | query parameters pagination filtering | `Query`, `Depends` |
| SQLAlchemy | `/websites/sqlalchemy_en_20_orm` | async session query with filters | `select`, `where`, `func.count` |

### Existing Patterns

From `backend/src/homelab_cmd/api/routes/alerts.py`:
- Pagination with `limit`, `offset`, and `total` count
- Filtering with optional query parameters
- `joinedload` for eager loading relationships
- Standard error responses with `AUTH_RESPONSES`, `NOT_FOUND_RESPONSE`

From `backend/src/homelab_cmd/api/routes/services.py`:
- RemediationAction creation with `session.add()` and `session.flush()`
- Duplicate action detection with 409 Conflict
- Status enum usage from `ActionStatus`

## Recommended Approach

**Strategy:** TDD
**Rationale:** Test cases TC155-TC159 already defined in TS0009. Clear API contracts in story.

### Test Priority

1. List actions endpoint with pagination (TC155)
2. Get action by ID (TC156)
3. Create action on normal server → auto-approve (TC157)
4. Create action on paused server → pending (TC158)
5. Command whitelist enforcement (TC159)

### Documentation Updates Required

- [ ] Update TS0009 automation status after tests pass
- [ ] Update US0024 status to Done

## Implementation Steps

### Phase 0: Prerequisites (US0029 - Server Maintenance Mode)

**Goal:** Add `is_paused` field to Server model (required for AC3/AC4)

#### Step 0.1: Add is_paused to Server model

- [ ] Add `is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)`
- [ ] Add `paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`

**Files to modify:**
- `backend/src/homelab_cmd/db/models/server.py` - Add is_paused and paused_at columns

#### Step 0.2: Create migration

- [ ] Run `alembic revision --autogenerate -m "add_server_is_paused"`
- [ ] Apply migration with `alembic upgrade head`

**Files to create:**
- `migrations/versions/XXX_add_server_is_paused.py`

#### Step 0.3: Update Server schemas

- [ ] Add `is_paused` to `ServerResponse` schema
- [ ] Update `ServerDetailResponse` if different

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py`

#### Step 0.4: Add pause/unpause endpoints

- [ ] Add `PUT /servers/{server_id}/pause` endpoint
- [ ] Add `PUT /servers/{server_id}/unpause` endpoint

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/servers.py`

---

### Phase 1: Create Action Schemas

**Goal:** Define Pydantic schemas for action requests and responses

#### Step 1.1: Create action schemas

- [ ] Create `ActionCreate` schema (server_id, action_type, service_name, alert_id)
- [ ] Create `ActionResponse` schema (all fields from RemediationAction)
- [ ] Create `ActionListResponse` schema (actions array, total, limit, offset)

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/actions.py`

**Considerations:**
Use existing `RestartActionResponse` pattern from services.py as reference.

---

### Phase 2: Create Actions Router

**Goal:** Implement action CRUD endpoints

#### Step 2.1: Create actions.py router

- [ ] Create new router file with prefix `/actions`
- [ ] Register router in `__init__.py`

**Files to create:**
- `backend/src/homelab_cmd/api/routes/actions.py`

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/__init__.py` - Register actions router

#### Step 2.2: Implement GET /actions

- [ ] Support `?status` filter
- [ ] Support `?server_id` filter
- [ ] Support `?action_type` filter
- [ ] Support `?limit` and `?offset` pagination
- [ ] Return total count for pagination

**Implementation pattern (from alerts.py):**
```python
@router.get("", response_model=ActionListResponse)
async def list_actions(
    status: str | None = Query(None),
    server_id: str | None = Query(None),
    action_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionListResponse:
    ...
```

#### Step 2.3: Implement GET /actions/{action_id}

- [ ] Return full action details
- [ ] Return 404 if action not found

#### Step 2.4: Implement POST /actions

- [ ] Validate server exists (404 if not)
- [ ] Build command from whitelist (403 if not whitelisted)
- [ ] Check `server.is_paused`:
  - If `is_paused=False`: status=APPROVED, approved_at=now, approved_by="auto"
  - If `is_paused=True`: status=PENDING
- [ ] Check for duplicate pending action (409 Conflict)
- [ ] Return 201 with created action

**Command whitelist:**
```python
ALLOWED_ACTION_TYPES = {
    "restart_service": lambda data: f"systemctl restart {data.service_name}",
    "clear_logs": lambda data: "journalctl --vacuum-time=7d",
}
```

---

### Phase 3: Server-Specific Actions Endpoint

**Goal:** Add endpoint to list actions for a specific server

#### Step 3.1: Add GET /servers/{server_id}/actions

- [ ] Create endpoint in servers.py or services.py
- [ ] Support `?status` filter
- [ ] Verify server exists (404 if not)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/servers.py` - Add actions endpoint

---

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Write Unit Tests for Schemas

- [ ] Test ActionCreate validation
- [ ] Test ActionResponse serialisation

**Files to create:**
- `tests/test_action_schemas.py` (if needed)

#### Step 4.2: Write API Tests

- [ ] TC155: List actions with filters
- [ ] TC156: Get action by ID
- [ ] TC157: Create action on normal server → approved
- [ ] TC158: Create action on paused server → pending
- [ ] TC159: Command whitelist enforcement

**Files to create:**
- `tests/test_actions_api.py`

#### Step 4.3: Update existing restart_service tests

- [ ] Update `tests/test_service_restart.py` to test maintenance mode behaviour

#### Step 4.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test list_actions with filters | Pending |
| AC2 | Test get_action returns full details | Pending |
| AC3 | Test create on normal server → approved | Pending |
| AC4 | Test create on paused server → pending | Pending |
| AC5 | Test whitelist rejection with 403 | Pending |
| AC6 | Test server-specific actions endpoint | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Server not found | 404 Not Found |
| Action not found | 404 Not Found |
| Invalid action_type | 422 Unprocessable Entity |
| Non-whitelisted command | 403 Forbidden |
| Duplicate pending action | 409 Conflict |
| Missing required fields | 422 Unprocessable Entity |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| US0029 not complete | Blocks AC3/AC4 | Include as Phase 0 |
| Existing restart endpoint inconsistent | Medium | Update to use new logic |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0023: Extended Schema | Story | Review - provides ActionStatus enum |
| US0029: Server Maintenance Mode | Story | Draft - provides is_paused field |

## Open Questions

None - requirements are clear from story.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] API tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] US0029 is_paused field added
- [ ] Ready for code review

## Notes

This plan includes US0029 (Server Maintenance Mode) as Phase 0 since US0024 depends on `is_paused`. The existing `restart_service` endpoint in services.py creates actions with PENDING status always - this should be updated to use the new maintenance mode logic in a follow-up.
