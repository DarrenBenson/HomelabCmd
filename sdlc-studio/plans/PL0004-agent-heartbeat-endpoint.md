# PL0004: Agent Heartbeat Endpoint - Implementation Plan

> **Status:** Complete
> **Story:** [US0003: Agent Heartbeat Endpoint](../stories/US0003-agent-heartbeat-endpoint.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

This plan implements the Agent Heartbeat endpoint for HomelabCmd. The heartbeat is the primary communication channel between agents and the hub - agents POST metrics every 60 seconds. The endpoint stores metrics, updates server status to "online", auto-registers unknown servers, updates OS info, and returns pending commands (empty array for MVP).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Heartbeat stores metrics | Metrics stored in database with current timestamp |
| AC2 | Status updated to online | Server status set to "online" and last_seen updated |
| AC3 | Auto-registers unknown servers | New server record created from heartbeat data |
| AC4 | Updates OS info | os_distribution, os_version, kernel, architecture updated |
| AC5 | Pending commands in response | Response includes pending_commands array (empty for MVP) |

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
- Logging for operational visibility

### Existing Patterns

From US0001/US0002/US0045 implementation:
- Server and Metrics models in `backend/src/homelab_cmd/db/models/`
- Async session management in `backend/src/homelab_cmd/db/session.py`
- API key authentication in `backend/src/homelab_cmd/api/deps.py`
- Schema patterns in `backend/src/homelab_cmd/api/schemas/server.py`
- Route registration in `backend/src/homelab_cmd/main.py`

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** TDD stub tests already exist in `tests/test_heartbeat.py`. Implementation will:
1. Remove skip decorators incrementally
2. Replace `pytest.fail()` stubs with actual assertions
3. Run tests to see failures
4. Implement to make tests pass
5. Refactor if needed

### Test Priority

1. Heartbeat returns 200 OK
2. Heartbeat auto-registers unknown server
3. Heartbeat updates server status to online
4. Heartbeat stores metrics in database
5. Heartbeat updates OS info
6. Response includes pending_commands array
7. Authentication required (401 without API key)

### Documentation Updates Required

- [ ] Update test skip reasons as endpoint is implemented

## Implementation Steps

### Phase 1: Pydantic Schemas for Heartbeat

**Goal:** Define request/response models for heartbeat API validation

#### Step 1.1: Create heartbeat schemas

- [ ] Create `backend/src/homelab_cmd/api/schemas/heartbeat.py`
- [ ] Define OSInfo schema (nested object)
- [ ] Define MetricsPayload schema (all fields optional)
- [ ] Define HeartbeatRequest schema
- [ ] Define HeartbeatResponse schema
- [ ] Export from `backend/src/homelab_cmd/api/schemas/__init__.py`

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py`

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/__init__.py`

**Schema definitions:**

```python
from datetime import datetime
from pydantic import BaseModel, Field


class OSInfo(BaseModel):
    """Operating system information from agent."""

    distribution: str | None = Field(None, max_length=100)
    version: str | None = Field(None, max_length=100)
    kernel: str | None = Field(None, max_length=100)
    architecture: str | None = Field(None, max_length=20)


class MetricsPayload(BaseModel):
    """Metrics collected by agent (all fields optional)."""

    cpu_percent: float | None = Field(None, ge=0, le=100)
    memory_percent: float | None = Field(None, ge=0, le=100)
    memory_total_mb: int | None = Field(None, ge=0)
    memory_used_mb: int | None = Field(None, ge=0)
    disk_percent: float | None = Field(None, ge=0, le=100)
    disk_total_gb: float | None = Field(None, ge=0)
    disk_used_gb: float | None = Field(None, ge=0)
    network_rx_bytes: int | None = Field(None, ge=0)
    network_tx_bytes: int | None = Field(None, ge=0)
    load_1m: float | None = Field(None, ge=0)
    load_5m: float | None = Field(None, ge=0)
    load_15m: float | None = Field(None, ge=0)
    uptime_seconds: int | None = Field(None, ge=0)


class HeartbeatRequest(BaseModel):
    """Schema for agent heartbeat request."""

    server_id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    hostname: str = Field(..., min_length=1, max_length=255)
    timestamp: datetime
    os_info: OSInfo | None = None
    metrics: MetricsPayload | None = None


class HeartbeatResponse(BaseModel):
    """Schema for heartbeat response."""

    status: str = "ok"
    server_registered: bool = False
    pending_commands: list = Field(default_factory=list)
```

### Phase 2: Agents Router

**Goal:** Implement the heartbeat endpoint

#### Step 2.1: Create agents router

- [ ] Create `backend/src/homelab_cmd/api/routes/agents.py`
- [ ] Add router with `/agents` prefix
- [ ] Import dependencies (auth, session, schemas)

**Files to create:**
- `backend/src/homelab_cmd/api/routes/agents.py`

**Router setup:**
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/agents", tags=["Agents"])
```

#### Step 2.2: Implement heartbeat endpoint (POST /api/v1/agents/heartbeat)

- [ ] Add heartbeat endpoint
- [ ] Check if server exists
- [ ] If server exists: update status, last_seen, OS info
- [ ] If server doesn't exist: auto-register with data from heartbeat
- [ ] Store metrics in database
- [ ] Return HeartbeatResponse with server_registered flag

**AC1-AC5 Implementation:**
```python
from datetime import UTC, datetime
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.schemas.heartbeat import HeartbeatRequest, HeartbeatResponse
from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/agents", tags=["Agents"])
logger = logging.getLogger(__name__)


@router.post("/heartbeat", response_model=HeartbeatResponse)
async def receive_heartbeat(
    heartbeat: HeartbeatRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> HeartbeatResponse:
    """Receive heartbeat from agent.

    Stores metrics, updates server status to online, and auto-registers
    unknown servers. Returns any pending commands for the agent.
    """
    now = datetime.now(UTC)
    server_registered = False

    # Check if server exists
    server = await session.get(Server, heartbeat.server_id)

    if server is None:
        # Auto-register new server (AC3)
        server = Server(
            id=heartbeat.server_id,
            hostname=heartbeat.hostname,
            status=ServerStatus.ONLINE.value,
            last_seen=now,
        )
        session.add(server)
        server_registered = True
        logger.info("Auto-registered new server: %s", heartbeat.server_id)

    # Update server status and last_seen (AC2)
    server.status = ServerStatus.ONLINE.value
    server.last_seen = now

    # Update OS info if provided (AC4)
    if heartbeat.os_info:
        server.os_distribution = heartbeat.os_info.distribution
        server.os_version = heartbeat.os_info.version
        server.kernel_version = heartbeat.os_info.kernel
        server.architecture = heartbeat.os_info.architecture

    # Store metrics if provided (AC1)
    if heartbeat.metrics:
        metrics = Metrics(
            server_id=heartbeat.server_id,
            timestamp=heartbeat.timestamp,
            cpu_percent=heartbeat.metrics.cpu_percent,
            memory_percent=heartbeat.metrics.memory_percent,
            memory_total_mb=heartbeat.metrics.memory_total_mb,
            memory_used_mb=heartbeat.metrics.memory_used_mb,
            disk_percent=heartbeat.metrics.disk_percent,
            disk_total_gb=heartbeat.metrics.disk_total_gb,
            disk_used_gb=heartbeat.metrics.disk_used_gb,
            network_rx_bytes=heartbeat.metrics.network_rx_bytes,
            network_tx_bytes=heartbeat.metrics.network_tx_bytes,
            load_1m=heartbeat.metrics.load_1m,
            load_5m=heartbeat.metrics.load_5m,
            load_15m=heartbeat.metrics.load_15m,
            uptime_seconds=heartbeat.metrics.uptime_seconds,
        )
        session.add(metrics)

    await session.flush()

    logger.debug("Heartbeat received from %s", heartbeat.server_id)

    # Return response with pending commands (AC5 - empty for MVP)
    return HeartbeatResponse(
        status="ok",
        server_registered=server_registered,
        pending_commands=[],
    )
```

### Phase 3: Route Registration

**Goal:** Register agents routes with the FastAPI application

#### Step 3.1: Update main.py

- [ ] Import agents router
- [ ] Include router with `/api/v1` prefix

**Files to modify:**
- `backend/src/homelab_cmd/main.py`

**Addition:**
```python
from homelab_cmd.api.routes import agents, servers, system

# Mount agent routes (auth required)
app.include_router(agents.router, prefix="/api/v1")
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria with TDD tests

#### Step 4.1: Update and enable tests

- [ ] Update `tests/test_heartbeat.py` with proper test implementations
- [ ] Remove skip decorators
- [ ] Replace `pytest.fail()` stubs with actual assertions
- [ ] Run tests to verify each acceptance criterion

**Test classes to update:**
- TestHeartbeatStoresMetrics (TC013)
- TestHeartbeatUpdatesStatus (TC014)
- TestHeartbeatAutoRegisters (TC015)
- TestHeartbeatUpdatesOsInfo (TC016)
- TestHeartbeatResponsePendingCommands (TC017)

#### Step 4.2: Add authentication tests

- [ ] Add TestHeartbeatAuthentication class
- [ ] Verify 401 returned without API key

**New test class:**
```python
class TestHeartbeatAuthentication:
    """Heartbeat authentication tests."""

    def test_heartbeat_requires_auth(self, client: TestClient) -> None:
        """POST /api/v1/agents/heartbeat without auth should return 401."""
        heartbeat_data = {
            "server_id": "test",
            "hostname": "test",
            "timestamp": "2026-01-18T10:30:00Z",
        }
        response = client.post("/api/v1/agents/heartbeat", json=heartbeat_data)
        assert response.status_code == 401
```

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | TestHeartbeatStoresMetrics passes | Pending |
| AC2 | TestHeartbeatUpdatesStatus passes | Pending |
| AC3 | TestHeartbeatAutoRegisters passes | Pending |
| AC4 | TestHeartbeatUpdatesOsInfo passes | Pending |
| AC5 | TestHeartbeatResponsePendingCommands passes | Pending |

## Project Structure (After Implementation)

```
backend/src/homelab_cmd/
├── __init__.py
├── main.py                    # Updated with agents router
├── config.py
├── api/
│   ├── __init__.py
│   ├── deps.py               # Auth dependencies (existing)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── system.py         # Health/info endpoints (existing)
│   │   ├── servers.py        # Server CRUD endpoints (existing)
│   │   └── agents.py         # Agent heartbeat endpoint (new)
│   └── schemas/
│       ├── __init__.py       # Updated exports
│       ├── server.py         # Server schemas (existing)
│       └── heartbeat.py      # Heartbeat schemas (new)
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
├── test_servers.py           # Server API tests (existing)
└── test_heartbeat.py         # Heartbeat tests (update)
```

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Missing server_id | 422 Unprocessable Entity via Pydantic |
| Invalid server_id format | 422 via regex pattern validation |
| Missing timestamp | 422 Unprocessable Entity via Pydantic |
| Invalid metrics values (negative) | 422 via ge=0 constraints |
| Partial metrics (some fields null) | Accepted - all fields optional |
| No metrics in heartbeat | Accepted - server status still updated |
| No OS info in heartbeat | Accepted - OS fields not updated |
| Invalid API key | 401 Unauthorized (existing middleware) |
| Duplicate heartbeat (same timestamp) | Accepted - creates new metrics record |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| High frequency requests | Performance degradation | SQLite handles 11/min easily |
| Test database isolation | Test pollution | Each test uses fresh in-memory DB |
| Auth bypass | Security vulnerability | All routes use verify_api_key dependency |
| Schema validation gaps | Invalid data stored | Comprehensive Pydantic validation |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001 | Story | Provides Server and Metrics models |
| US0002 | Story | Provides server CRUD for verification tests |
| US0045 | Story | Provides auth middleware, FastAPI structure |

## Open Questions

None - API contracts fully specified in US0003.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows Python best practices
- [ ] No linting errors (ruff)
- [ ] Pydantic schemas match story contracts
- [ ] Logging shows heartbeat received events
- [ ] OpenAPI spec auto-generated correctly

## Notes

This story is critical for real-time monitoring. Key design decisions:
- All metrics fields are optional to handle partial agent data
- Auto-registration enables zero-config agent deployment
- Pending commands array is empty for MVP (EP0004 will populate it)
- Logging at DEBUG level for heartbeats to avoid log spam

## Next Steps After Completion

- **US0004**: Agent Script (client-side heartbeat sender)
- **US0008**: Server Offline Detection (mark servers offline if no heartbeat)
