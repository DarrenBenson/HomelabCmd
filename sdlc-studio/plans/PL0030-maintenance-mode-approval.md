# PL0030: Maintenance Mode Approval - Implementation Plan

> **Status:** Complete
> **Story:** [US0026: Maintenance Mode Approval](../stories/US0026-maintenance-mode-approval.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Implement API endpoints for approving or rejecting pending actions on paused (maintenance mode) servers. When a server is paused, actions are created with "pending" status and require manual approval. This story provides the approve/reject endpoints with audit trail support.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Approve action | POST /actions/{id}/approve changes status to "approved" with audit fields |
| AC2 | Reject action | POST /actions/{id}/reject changes status to "rejected" with reason |
| AC3 | Cannot approve non-pending | 409 Conflict returned for non-pending actions |
| AC4 | Audit trail | approved_at and approved_by populated on approval |
| AC5 | Rejection reason required | 422 if no reason provided on reject |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with SQLAlchemy 2.0 async
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

- Use Pydantic schemas for request/response validation
- Follow existing action endpoint patterns (get_action, create_action)
- Return full ActionResponse on state changes
- Use structured error responses with code and message

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | `/tiangolo/fastapi` | POST endpoint with path parameter | `@router.post("/{id}/action")` |
| Pydantic | `/pydantic/pydantic` | optional field with default | `Field(default=...)` |

### Existing Patterns

From `backend/src/homelab_cmd/api/routes/actions.py`:
- Action retrieval with `session.get(RemediationAction, action_id)`
- 404 handling with structured error response
- ActionResponse.model_validate() for response formatting
- ActionStatus enum for status values

From `backend/src/homelab_cmd/api/routes/servers.py` (pause/unpause endpoints):
- POST endpoints for state transitions
- 200 response with updated resource

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Simple CRUD operations with straightforward state transitions. Two endpoints, minimal logic. Clear API contract. Not complex enough to warrant TDD overhead.

### Test Priority

1. Approve changes status to approved (TC165)
2. Reject changes status to rejected with reason (TC166)
3. Cannot approve non-pending action (TC167)
4. Audit fields populated correctly
5. Missing rejection reason returns 422

### Documentation Updates Required

- [ ] Update TS0009 automation status after tests pass
- [ ] Update US0026 status to Review/Done

## Implementation Steps

### Phase 1: Add Rejection Schema

**Goal:** Create schema for reject request body

#### Step 1.1: Create RejectActionRequest schema

- [ ] Create `RejectActionRequest` with required `reason` field
- [ ] Add validation (min_length=1, max_length=1000)

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/actions.py` - Add RejectActionRequest

**Implementation:**
```python
class RejectActionRequest(BaseModel):
    """Schema for rejecting an action."""

    reason: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Reason for rejection",
        examples=["Not needed - service recovered automatically"],
    )
```

---

### Phase 2: Implement Approve Endpoint

**Goal:** Add POST /actions/{id}/approve endpoint

#### Step 2.1: Add approve endpoint

- [ ] Add `@router.post("/{action_id}/approve")` endpoint
- [ ] Verify action exists (404 if not)
- [ ] Verify action status is PENDING (409 if not)
- [ ] Update status to APPROVED
- [ ] Set approved_at to now
- [ ] Set approved_by to "dashboard"
- [ ] Return ActionResponse

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/actions.py` - Add approve_action endpoint

**Implementation pattern:**
```python
@router.post(
    "/{action_id}/approve",
    response_model=ActionResponse,
    operation_id="approve_action",
    summary="Approve a pending action",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
)
async def approve_action(
    action_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Approve a pending action for execution."""
    action = await session.get(RemediationAction, action_id)

    if not action:
        raise HTTPException(404, detail={...})

    if action.status != ActionStatus.PENDING.value:
        raise HTTPException(409, detail={...})

    action.status = ActionStatus.APPROVED.value
    action.approved_at = datetime.now(UTC)
    action.approved_by = "dashboard"

    await session.flush()
    return ActionResponse.model_validate(action)
```

---

### Phase 3: Implement Reject Endpoint

**Goal:** Add POST /actions/{id}/reject endpoint

#### Step 3.1: Add reject endpoint

- [ ] Add `@router.post("/{action_id}/reject")` endpoint
- [ ] Accept RejectActionRequest body
- [ ] Verify action exists (404 if not)
- [ ] Verify action status is PENDING (409 if not)
- [ ] Update status to REJECTED
- [ ] Set rejected_at to now
- [ ] Set rejected_by to "dashboard"
- [ ] Set rejection_reason from request
- [ ] Return ActionResponse

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/actions.py` - Add reject_action endpoint

**Implementation pattern:**
```python
@router.post(
    "/{action_id}/reject",
    response_model=ActionResponse,
    operation_id="reject_action",
    summary="Reject a pending action",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
)
async def reject_action(
    action_id: int,
    request: RejectActionRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> ActionResponse:
    """Reject a pending action with reason."""
    # Similar pattern to approve_action
```

---

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Write API Tests

- [ ] TC165: Approve changes status to approved
- [ ] TC166: Reject changes status to rejected with reason
- [ ] TC167: Cannot approve non-pending action
- [ ] Cannot reject non-pending action
- [ ] Audit fields populated on approval
- [ ] Audit fields populated on rejection
- [ ] Missing rejection reason returns 422
- [ ] 404 for non-existent action

**Files to create:**
- `tests/test_action_approval.py`

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test approve endpoint updates status and audit fields | Pending |
| AC2 | Test reject endpoint updates status with reason | Pending |
| AC3 | Test 409 for non-pending actions | Pending |
| AC4 | Verify approved_at/approved_by fields | Pending |
| AC5 | Test 422 when reason missing | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Action not found | 404 Not Found |
| Already approved | 409 Conflict |
| Already rejected | 409 Conflict |
| Already executing | 409 Conflict |
| Already completed | 409 Conflict |
| Already failed | 409 Conflict |
| Empty rejection reason | 422 (Pydantic validation) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Race condition on status change | Low | Single-user system, database session isolation |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0023: Remediation Action Schema | Story | Complete - provides action model |
| US0024: Action Queue API | Story | Complete - provides base endpoints |

## Open Questions

None

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] API tests written and passing
- [ ] Edge cases handled (non-pending actions)
- [ ] Code follows existing patterns
- [ ] No linting errors
- [ ] OpenAPI spec updated automatically
- [ ] Ready for code review

## Notes

This is a simple story (2 story points) with straightforward state transitions. The main complexity is ensuring proper validation of the current action status before allowing approve/reject operations.

The endpoints follow the existing pattern from pause/unpause on servers - POST operations that change state and return the updated resource.
