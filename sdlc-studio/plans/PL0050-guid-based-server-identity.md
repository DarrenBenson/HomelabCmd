# PL0050: GUID-Based Server Identity - Implementation Plan

> **Status:** Complete
> **Story:** [US0070: GUID-Based Server Identity](../stories/US0070-guid-based-server-identity.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-22
> **Language:** Python / TypeScript

## Overview

Implement permanent GUID-based server identity to solve the DHCP/dynamic IP problem. Currently servers are identified by IP/hostname which can change, causing servers to become orphaned or duplicated. This change introduces a permanent UUID that agents generate once and report in every heartbeat.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Agent GUID Generation | Agent generates UUID v4 on first run, stores permanently in config |
| AC2 | Agent GUID Persistence | Same GUID used after restart (never regenerated) |
| AC3 | Heartbeat Includes GUID | Heartbeat payload includes server_guid + current hostname |
| AC4 | Hub Stores GUID | Hub matches/creates server by GUID (not server_id or hostname) |
| AC5 | Hub Updates Volatile Fields | ip_address and hostname updated on every heartbeat |
| AC6 | SSH Uses Current IP | SSH operations use current IP from last heartbeat |
| AC7 | Discovery Matches by GUID | Discovery queries agent GUID for reliable matching |
| AC8 | Migration Path | Existing servers get GUID on first new-agent heartbeat |

## Technical Context

### Language & Framework

- **Primary Languages:** Python (backend + agent), TypeScript (frontend)
- **Backend Framework:** FastAPI
- **Agent:** Standalone Python script with systemd
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use `yaml.safe_load()` for config loading (already done)
- Specific exception handling for config write failures
- Type hints on all new functions
- Pathlib for file operations

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | Pydantic validation patterns | Field validators, regex patterns |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Alembic migration patterns | nullable columns, unique constraints |
| uuid | stdlib | UUID v4 generation | uuid4() returns UUID object, str() for string |

### Existing Patterns

**Server Model** (`backend/src/homelab_cmd/db/models/server.py`):
- String primary key (`id`) with slug pattern
- Nullable fields for optional data
- Relationships with cascade delete

**Agent Config** (`agent/config.py`):
- Loads from YAML file or environment variables
- Dataclass-based config object
- Socket.gethostname() fallback for server_id

**Heartbeat Handler** (`backend/src/homelab_cmd/api/routes/agents.py`):
- Pydantic schema validation
- Auto-registration on first heartbeat
- Updates server fields on each heartbeat

## Recommended Approach

**Strategy:** Test-After (Hybrid)
**Rationale:** Schema changes and migrations need working database first. Agent config changes require integration testing. Core GUID matching logic will have focused unit tests.

### Test Priority

1. Heartbeat handler GUID matching logic (unit tests)
2. Migration path - existing server + new agent with GUID
3. Duplicate GUID rejection (409 Conflict)
4. Agent config GUID generation and persistence
5. Discovery GUID query via SSH

### Documentation Updates Required

- [ ] Backend API docs - HeartbeatRequest schema change (server_guid field)
- [ ] Agent configuration docs - server_guid field and generation
- [ ] Deployment/migration guide for existing installations

## Implementation Steps

### Phase 1: Database Schema Changes

**Goal:** Add `guid` column to servers table without breaking existing functionality

#### Step 1.1: Update Server Model

- [ ] Add `guid` field to Server model (nullable, unique, indexed)
- [ ] Ensure migration compatibility

**Files to modify:**
- `backend/src/homelab_cmd/db/models/server.py` - Add guid field

**Code changes:**
```python
# Add after id field
guid: Mapped[str | None] = mapped_column(
    String(36),
    unique=True,
    index=True,
    nullable=True,  # Nullable for migration - existing servers won't have GUID initially
)
```

#### Step 1.2: Create Alembic Migration

- [ ] Generate migration for guid column
- [ ] Test migration on dev database

**Files to create:**
- `migrations/versions/XXXX_add_server_guid.py` - New migration

**Migration commands:**
```bash
cd backend
alembic revision -m "add_server_guid_column"
alembic upgrade head
```

### Phase 2: Agent GUID Generation

**Goal:** Agent generates and persists UUID on first run

#### Step 2.1: Update Agent Config

- [ ] Add `server_guid` field to AgentConfig
- [ ] Implement GUID generation on first run
- [ ] Implement config persistence (write GUID back to YAML)

**Files to modify:**
- `agent/config.py` - Add server_guid field and generation logic

**Code changes:**
```python
from uuid import uuid4

@dataclass
class AgentConfig:
    server_guid: str  # UUID v4 - generated once, persisted
    server_id: str
    # ... existing fields

def load_config() -> AgentConfig:
    # ... existing loading logic

    # Generate GUID if not present
    server_guid = config_data.get("server_guid")
    if not server_guid:
        server_guid = str(uuid4())
        # Persist GUID to config file
        _save_guid_to_config(config_path, server_guid)

    return AgentConfig(
        server_guid=server_guid,
        # ... other fields
    )

def _save_guid_to_config(config_path: Path, guid: str) -> None:
    """Persist generated GUID to config file."""
    try:
        with open(config_path) as f:
            config_data = yaml.safe_load(f) or {}
        config_data["server_guid"] = guid
        with open(config_path, "w") as f:
            yaml.dump(config_data, f)
    except OSError as e:
        logger.warning("Could not persist GUID to config: %s", e)
```

**Considerations:**
- Handle read-only config file gracefully (log warning, continue)
- GUID stored as string "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"

#### Step 2.2: Update Agent Heartbeat Payload

- [ ] Include server_guid in heartbeat payload
- [ ] Keep server_id for backward compatibility and display name

**Files to modify:**
- `agent/heartbeat.py` - Add server_guid to payload

**Code changes:**
```python
payload: dict[str, Any] = {
    "server_guid": config.server_guid,  # NEW - permanent identifier
    "server_id": config.server_id,       # Existing - display name
    "hostname": socket.gethostname(),    # Current hostname (may change)
    # ... rest of existing payload
}
```

### Phase 3: Hub Schema Changes

**Goal:** Accept server_guid in heartbeat requests

#### Step 3.1: Update Heartbeat Schema

- [ ] Add server_guid field (optional for backward compat)
- [ ] Add UUID v4 format validation

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add server_guid field

**Code changes:**
```python
class HeartbeatRequest(BaseModel):
    server_guid: str | None = Field(
        None,
        min_length=36,
        max_length=36,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        description="Agent's permanent UUID (optional for backward compatibility)",
    )
    server_id: str = Field(...)  # Keep existing
    hostname: str = Field(...)   # Keep existing
    # ... rest of existing fields
```

### Phase 4: Hub Heartbeat Handler Changes

**Goal:** Match by GUID, update volatile fields, handle migration

#### Step 4.1: Update Heartbeat Handler Logic

- [ ] Match by GUID first (if provided)
- [ ] Fall back to server_id for old agents
- [ ] Migration: add GUID to existing server
- [ ] Update ip_address from request source
- [ ] Update hostname from payload
- [ ] Handle duplicate GUID (409 Conflict)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Update receive_heartbeat()

**Code changes:**
```python
@router.post("/heartbeat", response_model=HeartbeatResponse)
async def receive_heartbeat(
    heartbeat: HeartbeatRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> HeartbeatResponse:
    server = None

    # 1. Try GUID match first (preferred for new agents)
    if heartbeat.server_guid:
        result = await session.execute(
            select(Server).where(Server.guid == heartbeat.server_guid)
        )
        server = result.scalar_one_or_none()

    # 2. Fall back to server_id match (backward compatibility)
    if server is None:
        server = await session.get(Server, heartbeat.server_id)

        # Migration: existing server gets GUID from upgraded agent
        if server and heartbeat.server_guid:
            if server.guid is None:
                server.guid = heartbeat.server_guid
            elif server.guid != heartbeat.server_guid:
                # GUID mismatch - this shouldn't happen
                raise HTTPException(
                    status_code=409,
                    detail=f"Server {heartbeat.server_id} already has a different GUID"
                )

    # 3. Auto-register if not found
    if server is None:
        # Check for duplicate GUID before insert
        if heartbeat.server_guid:
            existing = await session.execute(
                select(Server).where(Server.guid == heartbeat.server_guid)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail=f"GUID {heartbeat.server_guid} already registered to another server"
                )

        server = Server(
            id=heartbeat.server_id,
            guid=heartbeat.server_guid,  # May be None for old agents
            hostname=heartbeat.hostname,
            status=ServerStatus.ONLINE.value,
            last_seen=datetime.now(UTC),
        )
        session.add(server)

    # 4. Update volatile fields on EVERY heartbeat
    server.hostname = heartbeat.hostname
    if request.client:
        server.ip_address = str(request.client.host)
    server.last_seen = datetime.now(UTC)
    server.status = ServerStatus.ONLINE.value

    # ... rest of existing heartbeat processing
```

### Phase 5: Discovery Service Changes

**Goal:** Query agent GUID via SSH for reliable matching

#### Step 5.1: Add GUID Query Method

- [ ] Implement SSH-based GUID query
- [ ] Handle timeout and failures gracefully

**Files to modify:**
- `backend/src/homelab_cmd/services/discovery.py` - Add get_agent_guid method

**Code changes:**
```python
async def get_agent_guid(self, ip: str) -> str | None:
    """Query agent's GUID via SSH by reading config file."""
    try:
        result = await self.ssh_service.execute_command(
            hostname=ip,
            command="grep server_guid /etc/homelab-agent/config.yaml | cut -d: -f2 | tr -d ' \"'",
            timeout=10,
        )
        if result.success and result.stdout:
            guid = result.stdout.strip()
            # Validate UUID v4 format
            uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
            if re.match(uuid_pattern, guid, re.IGNORECASE):
                return guid.lower()
    except Exception as e:
        logger.debug("Could not query agent GUID from %s: %s", ip, e)
    return None
```

#### Step 5.2: Update is_monitored Check

- [ ] Query GUID when SSH is available
- [ ] Match by GUID first, fall back to IP/hostname

**Files to modify:**
- `backend/src/homelab_cmd/services/discovery.py` - Update check_is_monitored

**Code changes:**
```python
async def check_is_monitored(
    self, session: AsyncSession, ip: str, hostname: str | None = None,
    ssh_success: bool = False
) -> tuple[bool, str | None]:
    """Check if device is monitored, returning (is_monitored, matched_server_id)."""

    # 1. If SSH available, try GUID match (most reliable)
    if ssh_success:
        agent_guid = await self.get_agent_guid(ip)
        if agent_guid:
            result = await session.execute(
                select(Server).where(Server.guid == agent_guid)
            )
            server = result.scalar_one_or_none()
            if server:
                return True, server.id

    # 2. Fall back to existing IP/hostname matching
    # ... existing matching logic
```

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Unit Tests - Heartbeat Handler

- [ ] Test GUID matching finds correct server
- [ ] Test server_id fallback for old agents
- [ ] Test migration path (server gets GUID)
- [ ] Test duplicate GUID rejection (409)
- [ ] Test IP/hostname update on heartbeat

**Files to create:**
- `backend/tests/api/test_heartbeat_guid.py` - New test file

#### Step 6.2: Unit Tests - Agent Config

- [ ] Test GUID generation on first run
- [ ] Test GUID persistence (not regenerated)
- [ ] Test config file write failure handling

**Files to create:**
- `agent/tests/test_config_guid.py` - New test file (or add to existing)

#### Step 6.3: Integration Tests

- [ ] Test full heartbeat flow with GUID
- [ ] Test discovery GUID query
- [ ] Test SSH operations use current IP

#### Step 6.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test: GUID generated on first run | Pending |
| AC2 | Unit test: Same GUID after config reload | Pending |
| AC3 | Unit test: Heartbeat payload includes server_guid | Pending |
| AC4 | Unit test: Hub matches by GUID | Pending |
| AC5 | Unit test: ip_address updated from request | Pending |
| AC6 | Integration test: SSH uses server.ip_address | Pending |
| AC7 | Integration test: Discovery queries GUID | Pending |
| AC8 | Unit test: Existing server gets GUID on heartbeat | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Agent config file corrupted/deleted | Regenerate GUID on startup if missing from config. Server appears as new device. Log warning. | Phase 2 | [ ] |
| 2 | Two agents with same GUID (copy/paste error) | Database unique constraint rejects insert. Hub returns 409 Conflict with clear error message. | Phase 4 | [ ] |
| 3 | Heartbeat without GUID (old agent) | Fall back to server_id matching. Log info suggesting agent upgrade. | Phase 4 | [ ] |
| 4 | Discovery can't reach agent identity endpoint | Catch SSH timeout/failure. Continue with IP/hostname fallback matching only. | Phase 5 | [ ] |
| 5 | Server has GUID but IP changed between heartbeats | Always update server.ip_address from request.client.host on every heartbeat. | Phase 4 | [ ] |
| 6 | Migration: existing server, new GUID | If server found by server_id and server.guid is None, set server.guid from heartbeat. | Phase 4 | [ ] |
| 7 | GUID format invalid | Pydantic schema validation with UUID v4 regex pattern rejects with 422 Unprocessable Entity. | Phase 3 | [ ] |
| 8 | Agent identity endpoint timeout | SSH timeout (10s) caught in get_agent_guid(). Return None, fallback to other matching. | Phase 5 | [ ] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

### Edge Case Implementation Notes

**Duplicate GUID prevention:** The database unique constraint on `guid` column is the primary defence. The hub also explicitly checks before auto-registration to provide a better error message.

**Migration safety:** The migration path only sets GUID on existing servers, never overwrites. If a server already has a GUID and receives a heartbeat with a different GUID, it returns 409 Conflict rather than silently overwriting.

**Config write failure:** If the agent cannot persist the GUID to config.yaml (permissions, disk full), it logs a warning but continues with the generated GUID in memory. Next restart will generate a new GUID - this is acceptable as the server will register as new.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks existing deployments | High | GUID field is nullable; old agents continue to work with server_id matching |
| Config write permissions on agent | Medium | Log warning, continue with in-memory GUID; document required permissions |
| SSH GUID query slows discovery | Low | 10s timeout per device; runs in parallel; fallback to IP/hostname |
| Database unique constraint error | Low | Explicit check before insert provides better error message |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Alembic migration system | Runtime | Must run migration before deploying new code |
| Agent upgrade mechanism | Operational | Existing agents need upgrade to send GUID |
| SSH access for discovery | Optional | GUID matching only works if SSH configured |

## Open Questions

None - all questions resolved in story US0070.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices (yaml.safe_load, specific exceptions, type hints)
- [ ] No linting errors
- [ ] Database migration tested
- [ ] Manual verification: heartbeat with GUID works
- [ ] Manual verification: discovery matches by GUID
- [ ] Documentation updated

## Notes

**Migration Path:**
1. Deploy backend with new schema (migration adds nullable guid column)
2. Existing agents continue to work (no GUID, matched by server_id)
3. Upgrade agents one by one (they generate GUIDs)
4. On first heartbeat after upgrade, server record gets GUID
5. Future heartbeats match by GUID

**No Breaking Changes:**
- HeartbeatRequest.server_guid is optional (None allowed)
- Heartbeat handler falls back to server_id if no GUID
- Existing servers without GUID continue to work
- Frontend is not affected (guid is internal identifier)
