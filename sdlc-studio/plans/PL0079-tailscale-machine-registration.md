# PL0079: Machine Registration via Tailscale - Implementation Plan

> **Status:** Complete
> **Story:** [US0078: Machine Registration via Tailscale](../stories/US0078-tailscale-machine-registration.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-26
> **Language:** Python / TypeScript

## Overview

Implement machine registration from Tailscale devices for HomelabCmd. This enables users to import discovered Tailscale devices as monitored servers with pre-filled metadata. Builds on device discovery (US0077) with a modal form, validation, and database integration.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Import modal pre-fills data | Opens modal with Tailscale data, editable display_name and TDP |
| AC2 | Import creates machine record | POST endpoint creates Server with tailscale fields |
| AC3 | Duplicate detection | 409 response if hostname already exists |
| AC4 | Form validation | Required display_name, positive TDP validation |
| AC5 | Already imported indicator | Badge and "View Machine" link on discovery page |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Backend Framework:** FastAPI with SQLAlchemy 2.0
- **Frontend Framework:** React 18 with TypeScript
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use dataclasses for structured responses
- Catch specific exceptions, not bare `except:`
- Always set explicit timeouts on HTTP requests

### Existing Patterns

**TailscaleDevices.tsx (from US0077):**
- handleImport placeholder calls console.log + alert
- DeviceCard component with Import button
- Already imported devices show disabled state

**Server model (existing):**
- id (slug), hostname, display_name fields
- tdp_watts, machine_category fields
- No existing tailscale_* fields - need migration

**API Route Pattern (from tailscale.py):**
- devices_router with /tailscale prefix
- Exception handling maps service errors to HTTP responses
- SQLAlchemy select for database queries

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Story follows established patterns. Import endpoint is a standard POST with validation. Modal extends existing DeviceCard component. Form validation is straightforward. Migration adds simple columns.

### Test Priority

1. Import endpoint validation (required fields, TDP positive)
2. Duplicate detection returns 409 with existing ID
3. Server record created with tailscale fields
4. Check endpoint returns correct imported status

### Documentation Updates Required

- [x] AGENTS.md - Add import endpoint

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add tailscale columns to Server model | `backend/src/homelab_cmd/db/models/server.py` | - | Yes | [x] |
| 2 | Create Alembic migration | `migrations/versions/` | 1 | No | [x] |
| 3 | Add import request/response schemas | `backend/src/homelab_cmd/api/schemas/tailscale.py` | - | Yes | [x] |
| 4 | Add check endpoint schema | `backend/src/homelab_cmd/api/schemas/tailscale.py` | 3 | No | [x] |
| 5 | Add import endpoint | `backend/src/homelab_cmd/api/routes/tailscale.py` | 2, 3 | No | [x] |
| 6 | Add check endpoint | `backend/src/homelab_cmd/api/routes/tailscale.py` | 4 | No | [x] |
| 7 | Add TypeScript import types | `frontend/src/types/tailscale.ts` | - | Yes | [x] |
| 8 | Add import API client functions | `frontend/src/api/tailscale.ts` | 7 | No | [x] |
| 9 | Create ImportDeviceModal component | `frontend/src/components/ImportDeviceModal.tsx` | 8 | No | [x] |
| 10 | Integrate modal in TailscaleDevices | `frontend/src/pages/TailscaleDevices.tsx` | 9 | No | [x] |
| 11 | Write import endpoint tests | `tests/test_tailscale_api.py` | 5 | No | [x] |
| 12 | Write check endpoint tests | `tests/test_tailscale_api.py` | 6 | No | [x] |
| 13 | Update AGENTS.md | `AGENTS.md` | 5, 6 | No | [x] |

### Task Dependency Graph

```
1 (model) ──► 2 (migration) ──► 5 (import endpoint)
                                │
3 (schemas) ──► 4 (check schema)┴──► 6 (check endpoint)
                                │
7 (TS types) ──► 8 (API client) ──► 9 (modal) ──► 10 (integration)
                                │
                                ├──► 11 (import tests)
                                ├──► 12 (check tests)
                                └──► 13 (docs)
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 3, 7 | None |
| 2 | 2 | Task 1 |
| 3 | 4, 5, 8 | Tasks 2, 3, 7 |
| 4 | 6, 9 | Tasks 4, 5, 8 |
| 5 | 10, 11, 12, 13 | Tasks 6, 9 |

## Implementation Phases

### Phase 1: Database - Model and Migration

**Goal:** Add Tailscale-specific columns to Server model

**Tasks in this phase:** 1, 2

#### Step 1.1: Add Columns to Server Model

- [ ] Add tailscale_hostname column (unique, indexed)
- [ ] Add tailscale_device_id column
- [ ] Add machine_type column with default 'server'

**Files to modify:**
- `backend/src/homelab_cmd/db/models/server.py`

**Code structure:**
```python
# After ip_address field
# Tailscale integration fields (EP0008: US0078)
tailscale_hostname: Mapped[str | None] = mapped_column(
    String(255), unique=True, index=True, nullable=True
)
tailscale_device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
machine_type: Mapped[str] = mapped_column(
    String(20), default="server", nullable=False
)
```

#### Step 1.2: Create Alembic Migration

- [ ] Generate migration with autogenerate
- [ ] Verify unique constraint on tailscale_hostname
- [ ] Test upgrade and downgrade

**Files to create:**
- `migrations/versions/b1c2d3e4f5g6_add_tailscale_fields.py`

**Migration content:**
```python
def upgrade() -> None:
    op.add_column("servers", sa.Column("tailscale_hostname", sa.String(255), nullable=True))
    op.add_column("servers", sa.Column("tailscale_device_id", sa.String(100), nullable=True))
    op.add_column("servers", sa.Column("machine_type", sa.String(20), nullable=False, server_default="server"))
    op.create_index("idx_servers_tailscale_hostname", "servers", ["tailscale_hostname"], unique=True)

def downgrade() -> None:
    op.drop_index("idx_servers_tailscale_hostname", table_name="servers")
    op.drop_column("servers", "machine_type")
    op.drop_column("servers", "tailscale_device_id")
    op.drop_column("servers", "tailscale_hostname")
```

### Phase 2: Backend - Schemas

**Goal:** Define request/response schemas for import and check endpoints

**Tasks in this phase:** 3, 4

#### Step 2.1: Add Import Schemas

- [ ] TailscaleImportRequest with validation
- [ ] TailscaleImportResponse with machine data
- [ ] TailscaleImportErrorResponse for 400/409

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/tailscale.py`

**Code structure:**
```python
class TailscaleImportRequest(BaseModel):
    """Request to import a Tailscale device as a server."""

    tailscale_device_id: str = Field(..., description="Tailscale device ID")
    tailscale_hostname: str = Field(..., description="Full Tailscale hostname")
    tailscale_ip: str = Field(..., description="Tailscale IP address")
    os: str = Field(..., description="Operating system")
    display_name: str = Field(
        ..., min_length=1, max_length=100, description="Display name for the server"
    )
    machine_type: Literal["server", "workstation"] = Field(
        "server", description="Machine type"
    )
    tdp: int | None = Field(None, gt=0, description="TDP in watts (optional, must be positive)")
    category_id: str | None = Field(None, description="Machine category ID (optional)")


class TailscaleImportedMachine(BaseModel):
    """Imported machine details returned after successful import."""

    id: str
    server_id: str
    display_name: str
    tailscale_hostname: str
    tailscale_device_id: str
    machine_type: str
    status: str
    created_at: datetime


class TailscaleImportResponse(BaseModel):
    """Response after successfully importing a Tailscale device."""

    success: bool = True
    machine: TailscaleImportedMachine
    message: str
```

#### Step 2.2: Add Check Endpoint Schema

- [ ] TailscaleImportCheckResponse with imported status

**Code structure:**
```python
class TailscaleImportCheckResponse(BaseModel):
    """Response for import check endpoint."""

    imported: bool
    machine_id: str | None = None
    display_name: str | None = None
    imported_at: datetime | None = None
```

### Phase 3: Backend - API Endpoints

**Goal:** Create import and check endpoints

**Tasks in this phase:** 5, 6

#### Step 3.1: Add Import Endpoint

- [ ] POST /api/v1/tailscale/import
- [ ] Validate display_name and TDP
- [ ] Check for duplicate hostname
- [ ] Create Server record
- [ ] Return created machine

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/tailscale.py`

**Code structure:**
```python
@devices_router.post(
    "/import",
    response_model=TailscaleImportResponse,
    status_code=201,
    operation_id="import_tailscale_device",
    summary="Import Tailscale device as server",
    responses={
        **AUTH_RESPONSES,
        400: {"description": "Validation error"},
        409: {"description": "Machine with hostname already exists"},
    },
)
async def import_device(
    request: TailscaleImportRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleImportResponse:
    """Import a Tailscale device as a monitored server."""
    # Check for duplicate
    result = await session.execute(
        select(Server).where(Server.tailscale_hostname == request.tailscale_hostname)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_MACHINE",
                "message": f"A machine with hostname {request.tailscale_hostname} already exists",
                "existing_machine_id": existing.id,
            },
        )

    # Generate server_id from hostname
    server_id = request.tailscale_hostname.split(".")[0].lower()

    # Create server record
    server = Server(
        id=server_id,
        hostname=request.tailscale_hostname,
        display_name=request.display_name,
        tailscale_hostname=request.tailscale_hostname,
        tailscale_device_id=request.tailscale_device_id,
        machine_type=request.machine_type,
        tdp_watts=request.tdp,
        machine_category=request.category_id,
    )
    session.add(server)
    await session.commit()
    await session.refresh(server)

    return TailscaleImportResponse(
        success=True,
        machine=TailscaleImportedMachine(
            id=server.id,
            server_id=server.id,
            display_name=server.display_name,
            tailscale_hostname=server.tailscale_hostname,
            tailscale_device_id=server.tailscale_device_id,
            machine_type=server.machine_type,
            status=server.status,
            created_at=server.created_at,
        ),
        message=f"Imported {request.display_name} successfully",
    )
```

#### Step 3.2: Add Check Endpoint

- [ ] GET /api/v1/tailscale/import/check
- [ ] Query param: hostname
- [ ] Return imported status with machine details if found

**Code structure:**
```python
@devices_router.get(
    "/import/check",
    response_model=TailscaleImportCheckResponse,
    operation_id="check_tailscale_import",
    summary="Check if device is already imported",
    responses={**AUTH_RESPONSES},
)
async def check_import(
    hostname: str = Query(..., description="Tailscale hostname to check"),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> TailscaleImportCheckResponse:
    """Check if a Tailscale device has already been imported."""
    result = await session.execute(
        select(Server).where(Server.tailscale_hostname == hostname)
    )
    server = result.scalar_one_or_none()

    if server:
        return TailscaleImportCheckResponse(
            imported=True,
            machine_id=server.id,
            display_name=server.display_name,
            imported_at=server.created_at,
        )

    return TailscaleImportCheckResponse(imported=False)
```

### Phase 4: Frontend - Types and API Client

**Goal:** Add TypeScript types and API client functions

**Tasks in this phase:** 7, 8

#### Step 4.1: Add TypeScript Types

- [ ] TailscaleImportRequest interface
- [ ] TailscaleImportResponse interface
- [ ] TailscaleImportCheckResponse interface

**Files to modify:**
- `frontend/src/types/tailscale.ts`

#### Step 4.2: Add API Client Functions

- [ ] importTailscaleDevice(request) function
- [ ] checkTailscaleImport(hostname) function

**Files to modify:**
- `frontend/src/api/tailscale.ts`

### Phase 5: Frontend - Import Modal

**Goal:** Create modal component for importing devices

**Tasks in this phase:** 9, 10

#### Step 5.1: Create ImportDeviceModal Component

- [ ] Modal overlay with form
- [ ] Read-only fields: hostname, IP, OS
- [ ] Editable fields: display_name, machine_type, TDP
- [ ] Validation messages
- [ ] Duplicate warning state
- [ ] Success/error handling
- [ ] Close on success or cancel

**Files to create:**
- `frontend/src/components/ImportDeviceModal.tsx`

**Component structure:**
```typescript
interface ImportDeviceModalProps {
  device: TailscaleDevice;
  onClose: () => void;
  onSuccess: (machine: TailscaleImportedMachine) => void;
}

export function ImportDeviceModal({ device, onClose, onSuccess }: ImportDeviceModalProps) {
  // Form state
  const [displayName, setDisplayName] = useState(
    device.hostname.split('.')[0].toUpperCase()
  );
  const [machineType, setMachineType] = useState<'server' | 'workstation'>('server');
  const [tdp, setTdp] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<{
    machine_id: string;
    display_name: string;
  } | null>(null);

  // Check for duplicate on mount
  useEffect(() => {
    checkTailscaleImport(device.hostname).then((result) => {
      if (result.imported) {
        setDuplicate({
          machine_id: result.machine_id!,
          display_name: result.display_name!,
        });
      }
    });
  }, [device.hostname]);

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!displayName.trim()) {
      errors.displayName = 'Display name is required';
    }
    if (displayName.length > 100) {
      errors.displayName = 'Display name must be 100 characters or less';
    }
    if (tdp && (isNaN(Number(tdp)) || Number(tdp) <= 0)) {
      errors.tdp = 'TDP must be a positive number';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit
  const handleSubmit = async () => {
    if (!validate()) return;
    // ... import logic
  };

  return (
    // Modal JSX
  );
}
```

#### Step 5.2: Integrate Modal in TailscaleDevices

- [ ] Add modal state (selectedDevice, showModal)
- [ ] Update handleImport to open modal
- [ ] Handle success - refresh device list
- [ ] Update DeviceCard for already_imported to show "View Machine" link

**Files to modify:**
- `frontend/src/pages/TailscaleDevices.tsx`

### Phase 6: Testing & Documentation

**Goal:** Verify all acceptance criteria with tests

**Tasks in this phase:** 11, 12, 13

#### Step 6.1: Import Endpoint Tests

- [ ] Test successful import creates server
- [ ] Test duplicate hostname returns 409
- [ ] Test empty display_name returns 400
- [ ] Test TDP zero/negative returns 400
- [ ] Test invalid machine_type returns 400
- [ ] Test tailscale fields stored correctly

**Test file:** `tests/test_tailscale_api.py`

#### Step 6.2: Check Endpoint Tests

- [ ] Test not imported returns imported=false
- [ ] Test imported returns machine details
- [ ] Test no auth returns 401

**Test file:** `tests/test_tailscale_api.py`

#### Step 6.3: Update Documentation

- [ ] Add import endpoint to AGENTS.md
- [ ] Add check endpoint to AGENTS.md

**Files to modify:**
- `AGENTS.md`

### Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Manual UI verification | `ImportDeviceModal.tsx` | Pending |
| AC2 | Test import endpoint | `test_tailscale_api.py` | Pending |
| AC3 | Test duplicate returns 409 | `test_tailscale_api.py` | Pending |
| AC4 | Test validation errors | `test_tailscale_api.py` | Pending |
| AC5 | Manual UI verification | `TailscaleDevices.tsx` | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Hostname already exists | Query tailscale_hostname before insert, return 409 with existing ID | Phase 3 | [ ] |
| 2 | Display name empty | Pydantic min_length=1 validation, 422 response | Phase 2 | [ ] |
| 3 | Display name too long | Pydantic max_length=100 validation, 422 response | Phase 2 | [ ] |
| 4 | TDP is zero | Pydantic gt=0 validation, 422 response | Phase 2 | [ ] |
| 5 | TDP is negative | Pydantic gt=0 validation, 422 response | Phase 2 | [ ] |
| 6 | TDP is non-numeric | Pydantic type validation, 422 response | Phase 2 | [ ] |
| 7 | Invalid machine_type | Pydantic Literal["server", "workstation"], 422 response | Phase 2 | [ ] |
| 8 | Tailscale device no longer exists | Import succeeds - device ID is for reference only | Phase 3 | [ ] |
| 9 | Import while offline | Standard network error handling in frontend | Phase 5 | [ ] |
| 10 | Concurrent imports of same device | Unique constraint on tailscale_hostname - DB handles race | Phase 1 | [ ] |

### Coverage Summary

- Story edge cases: 10
- Handled in plan: 10
- Unhandled: 0

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server ID collision | Import fails with integrity error | Generate unique ID from hostname + suffix if needed |
| Long tailscale hostnames | Truncation or DB error | Use VARCHAR(255) which exceeds Tailscale limits |
| Modal doesn't close on error | User frustration | Keep modal open, show error inline |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0077 (Device Discovery) | Story | Done - provides device list and already_imported flag |
| US0081 (Credential Storage) | Story | Done - not directly used but part of EP0008 |
| Server model | Code | Existing - adding columns |

## Open Questions

None.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled (10/10)
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (AGENTS.md)
- [ ] Ready for code review

## Notes

- Machine category dropdown is optional - uses existing machine_category field
- Agent deployment is a separate workflow (out of scope)
- The Import button placeholder in TailscaleDevices.tsx will be replaced with modal trigger
- server_id is derived from hostname (first part, lowercase)
