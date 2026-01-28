# PL0026: Service Restart Action - Implementation Plan

> **Status:** Complete
> **Story:** [US0022: Service Restart Action](../stories/US0022-service-restart-action.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python, TypeScript

## Overview

Create the API endpoint and frontend functionality to queue a service restart action. This is the last story in EP0003 and creates the foundation for EP0004 (Remediation Engine). The restart action is queued with "pending" status; actual execution and approval workflow is handled in EP0004.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Restart action can be queued | POST endpoint creates pending action |
| AC2 | Action includes service name | Action has service name and command |
| AC3 | Action starts in pending status | Initial status is "pending" |
| AC4 | Restart button triggers action | UI button calls API and shows confirmation |
| AC5 | No duplicate pending actions | 409 Conflict for duplicate |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0
- **Frontend:** TypeScript, React, TanStack Query
- **Test Framework:** pytest with pytest-asyncio, Vitest

### Existing Patterns

From codebase exploration:

1. **ServiceCard.tsx** - Restart button exists but is disabled
   - Uses `onRestart` callback prop (not wired up)
   - Shows only when service status is stopped/failed
   - Has `data-testid="restart-button"` for testing

2. **ServicesPanel.tsx** - Parent component
   - Maps over services rendering ServiceCard
   - Currently doesn't pass onRestart callback
   - Uses polling to refresh services

3. **services.py routes** - Existing service endpoints
   - GET/POST/PUT/DELETE for expected services
   - Uses `verify_api_key` dependency
   - Standard error handling patterns

4. **Database models** - Patterns in db/models/
   - Enum classes for status values
   - snake_case table names (plurals)
   - DateTime(timezone=True) for timestamps
   - TimestampMixin available for created_at/updated_at

Reference files:
- `frontend/src/components/ServiceCard.tsx` - Restart button
- `frontend/src/components/ServicesPanel.tsx` - Parent panel
- `backend/src/homelab_cmd/api/routes/services.py` - Services API
- `backend/src/homelab_cmd/db/models/service.py` - Service models
- `backend/src/homelab_cmd/api/schemas/service.py` - Service schemas

## Recommended Approach

**Strategy:** TDD
**Rationale:** The endpoint has clear input/output contract and multiple edge cases (duplicate detection, validation). TDD ensures correct 409 handling and proper response format before implementation.

### Test Priority

1. POST creates pending restart action with correct fields
2. Duplicate pending action returns 409 with existing_action_id
3. Action includes systemctl restart command
4. Action status is "pending"
5. Server not found returns 404

### Documentation Updates Required

- [ ] None required (internal feature)

## Implementation Steps

### Phase 1: Backend Model & Migration

**Goal:** Create RemediationAction model (basic version)

#### Step 1.1: Create ActionStatus enum and model

- [ ] Create `backend/src/homelab_cmd/db/models/remediation.py`
- [ ] Define `ActionStatus` enum with `pending` value (extended in EP0004)
- [ ] Define `RemediationAction` model with basic fields

**Files to create:**
- `backend/src/homelab_cmd/db/models/remediation.py`

**Model definition:**
```python
class ActionStatus(str, Enum):
    PENDING = "pending"
    # Extended in US0023: approved, rejected, executing, completed, failed


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("servers.id", ondelete="CASCADE"), index=True
    )
    action_type: Mapped[str] = mapped_column(String(50))  # 'restart_service'
    status: Mapped[str] = mapped_column(String(20), default=ActionStatus.PENDING.value)
    service_name: Mapped[str | None] = mapped_column(String(255))
    command: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    created_by: Mapped[str] = mapped_column(String(50), default="dashboard")

    # Relationship
    server: Mapped["Server"] = relationship(back_populates="remediation_actions")
```

#### Step 1.2: Register model in __init__.py

- [ ] Add import to `backend/src/homelab_cmd/db/models/__init__.py`
- [ ] Update Server model with relationship (optional, for navigation)

**Files to modify:**
- `backend/src/homelab_cmd/db/models/__init__.py`

#### Step 1.3: Create migration

- [ ] Generate Alembic migration for remediation_actions table
- [ ] Include index on (server_id, status) for duplicate check

**Command:**
```bash
cd src && alembic revision --autogenerate -m "Add remediation_actions table"
```

### Phase 2: Backend API

**Goal:** Create restart endpoint with duplicate detection

#### Step 2.1: Write API tests

- [ ] Create `tests/api/test_service_restart.py`
- [ ] Test POST creates pending action with 201
- [ ] Test duplicate pending returns 409 with existing_action_id
- [ ] Test server not found returns 404
- [ ] Test response includes all required fields

**Files to create:**
- `tests/api/test_service_restart.py`

**Test cases:**
```python
async def test_restart_creates_pending_action(client, db_session, test_server):
    """POST /servers/{id}/services/{name}/restart creates pending action."""

async def test_restart_returns_action_details(client, db_session, test_server):
    """Response includes action_id, command, status, etc."""

async def test_duplicate_pending_returns_409(client, db_session, test_server):
    """Second restart for same service returns 409."""

async def test_409_includes_existing_action_id(client, db_session, test_server):
    """409 response includes existing_action_id."""

async def test_restart_unknown_server_404(client, db_session):
    """Restart on unknown server returns 404."""

async def test_restart_generates_correct_command(client, db_session, test_server):
    """Command is 'systemctl restart {service_name}'."""
```

#### Step 2.2: Create response schemas

- [ ] Create `RestartActionResponse` schema
- [ ] Create `DuplicateActionError` schema for 409

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/service.py`

**Schemas:**
```python
class RestartActionResponse(BaseModel):
    """Response after queuing a restart action."""
    action_id: int
    action_type: str = "restart_service"
    server_id: str
    service_name: str
    command: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DuplicateActionError(BaseModel):
    """Error response when action already pending."""
    detail: str
    existing_action_id: int
```

#### Step 2.3: Implement restart endpoint

- [ ] Add POST `/servers/{server_id}/services/{service_name}/restart` endpoint
- [ ] Validate server exists
- [ ] Check for existing pending action (duplicate detection)
- [ ] Create RemediationAction with status="pending"
- [ ] Return 201 with action details or 409 with existing action

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/services.py`

**Endpoint implementation:**
```python
@router.post(
    "/servers/{server_id}/services/{service_name}/restart",
    response_model=RestartActionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: NOT_FOUND_RESPONSE,
        409: {"model": DuplicateActionError, "description": "Action already pending"},
    },
)
async def restart_service(
    server_id: str,
    service_name: str,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(verify_api_key),
) -> RestartActionResponse:
    """Queue a service restart action."""
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    # Check for duplicate pending action
    existing = await session.execute(
        select(RemediationAction)
        .where(RemediationAction.server_id == server_id)
        .where(RemediationAction.service_name == service_name)
        .where(RemediationAction.status == ActionStatus.PENDING.value)
    )
    existing_action = existing.scalar_one_or_none()
    if existing_action:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": "A restart action for this service is already pending",
                "existing_action_id": existing_action.id,
            },
        )

    # Create action
    action = RemediationAction(
        server_id=server_id,
        action_type="restart_service",
        service_name=service_name,
        command=f"systemctl restart {service_name}",
        status=ActionStatus.PENDING.value,
    )
    session.add(action)
    await session.commit()
    await session.refresh(action)

    return RestartActionResponse.model_validate(action)
```

### Phase 3: Frontend Integration

**Goal:** Enable restart button and wire up API call

#### Step 3.1: Add API function

- [ ] Add `restartService(serverId, serviceName)` function
- [ ] Return action response or throw on error

**Files to modify:**
- `frontend/src/api/services.ts`

**Implementation:**
```typescript
export interface RestartActionResponse {
  action_id: number;
  action_type: string;
  server_id: string;
  service_name: string;
  command: string;
  status: string;
  created_at: string;
}

export function restartService(
  serverId: string,
  serviceName: string
): Promise<RestartActionResponse> {
  return api.post<RestartActionResponse>(
    `/api/v1/servers/${serverId}/services/${serviceName}/restart`,
    {}
  );
}
```

#### Step 3.2: Update ServicesPanel to handle restart

- [ ] Add `handleRestart` callback function
- [ ] Use mutation with toast notifications
- [ ] Pass callback to ServiceCard

**Files to modify:**
- `frontend/src/components/ServicesPanel.tsx`

**Implementation:**
```typescript
const restartMutation = useMutation({
  mutationFn: ({ serviceName }: { serviceName: string }) =>
    restartService(serverId, serviceName),
  onSuccess: () => {
    toast.success('Restart action queued for approval');
  },
  onError: (error: ApiError) => {
    if (error.status === 409) {
      toast.info('Restart already pending for this service');
    } else {
      toast.error(`Failed to queue restart: ${error.message}`);
    }
  },
});

const handleRestart = (serviceName: string) => {
  restartMutation.mutate({ serviceName });
};

// In JSX:
<ServiceCard
  key={service.service_name}
  service={service}
  onRestart={() => handleRestart(service.service_name)}
/>
```

#### Step 3.3: Enable restart button in ServiceCard

- [ ] Remove `disabled` attribute
- [ ] Remove `opacity-50` class
- [ ] Update title to "Restart service"
- [ ] Call `onRestart` on click

**Files to modify:**
- `frontend/src/components/ServiceCard.tsx`

**Changes:**
```typescript
// Before:
<button
  onClick={onRestart}
  disabled
  className="... opacity-50 ... disabled:cursor-not-allowed"
  title="Restart service (coming soon)"
>

// After:
<button
  onClick={onRestart}
  className="... hover:bg-bg-tertiary hover:text-text-primary"
  title="Restart service"
>
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Backend Unit Tests

- [ ] POST creates pending action (201)
- [ ] Response includes all required fields
- [ ] Duplicate pending returns 409
- [ ] 409 includes existing_action_id
- [ ] Command is correct format

#### Step 4.2: Frontend Tests

- [ ] Restart button enabled for stopped services
- [ ] Click calls API
- [ ] Success shows toast
- [ ] 409 shows "already pending" message

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test POST creates action | Pending |
| AC2 | Test action includes service_name and command | Pending |
| AC3 | Test status is "pending" | Pending |
| AC4 | Manual test button click and toast | Pending |
| AC5 | Test 409 on duplicate | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Service is running | Allow restart anyway (user intent) |
| Server is offline | Queue action (EP0004 will handle execution) |
| Service not in expected list | Allow anyway (manual restart valid) |
| Invalid service name with special chars | Accept as-is (shell escaping is EP0004 concern) |
| Server deleted with pending action | CASCADE delete removes action |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema incompatible with EP0004 | High | Used basic fields only; US0023 extends table |
| No execution mechanism yet | Low | Expected - this is foundation only |
| Race condition on duplicate check | Low | Single-user homelab; transaction isolation sufficient |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0017: Service Schema | Story | Done - ExpectedService exists |
| US0020: Service Status Display | Story | Done - Button exists (disabled) |

## Open Questions

None - story requirements are clear.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Backend unit tests written and passing
- [ ] Frontend tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration tested
- [ ] EP0004 extension path clear
- [ ] Ready for code review

## Notes

- This is the last story in EP0003 (Service Monitoring)
- Creates foundation for EP0004 (Remediation Engine)
- US0023 will extend the RemediationAction table with full lifecycle fields
- No actual execution - actions remain "pending" until EP0004 adds approval workflow
- Command format is `systemctl restart {service_name}` - hardcoded for simplicity
