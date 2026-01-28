# PL0048: Network Discovery - Implementation Plan

> **Status:** Complete
> **Story:** [US0041: Network Discovery](../stories/US0041-network-discovery.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Language:** Python + TypeScript

## Overview

Implement network discovery feature for finding active devices on the local subnet. This enables operators to discover SSH-capable devices by scanning TCP port 22. Discovery runs asynchronously with progress tracking and results cross-referenced against registered servers to show "monitored" status.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Initiate network discovery | POST /api/v1/discovery initiates discovery scan |
| AC2 | Subnet configurable | Discovery uses configurable subnet (e.g., 192.168.1.0/24) |
| AC3 | Discovery results displayed | Found devices show IP, hostname, and response time |
| AC4 | Select device for scan | Clicking "Scan" pre-populates scan form with IP |
| AC5 | Discovery progress shown | Progress (IPs scanned / total) displayed during discovery |

## Technical Context

### Language & Framework

- **Backend:** Python 3.11+ with FastAPI
- **Frontend:** React 18 with TypeScript, Vite
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use asyncio for concurrent TCP connections
- Always set timeouts on network operations
- Use specific exceptions
- Type hints on all public functions

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| asyncio | Python stdlib | TCP connections | asyncio.open_connection with timeout |
| ipaddress | Python stdlib | Subnet parsing | ipaddress.ip_network for CIDR parsing |

### Existing Patterns

From codebase exploration:
- **Config storage:** Use `Config` model with key-value JSON storage (see config.py routes)
- **Background tasks:** Use asyncio.create_task for async execution
- **Progress tracking:** Follow Scan model pattern with progress/current_step fields
- **Cross-reference servers:** Query Server model by IP address

## Recommended Approach

**Strategy:** Test-After
**Rationale:**
- Network I/O is inherently difficult to unit test without mocking
- TCP port scanning requires understanding real-world behaviour
- Progress tracking state machine benefits from implementation-first approach
- Similar to scan initiation pattern (US0038)

### Test Priority

1. Unit tests for subnet parsing and IP iteration
2. API tests for POST /api/v1/discovery and GET /api/v1/discovery/{id}
3. Frontend tests for discovery UI components

### Documentation Updates Required

- [ ] Update API docs with discovery endpoints
- [ ] Add discovery endpoint to OpenAPI tags

## Implementation Steps

### Phase 1: Database Model

**Goal:** Create Discovery model for storing discovery sessions and results

#### Step 1.1: Create Discovery Model

- [ ] Create `DiscoveryStatus` enum (pending, running, completed, failed)
- [ ] Create `Discovery` model with all required fields
- [ ] Add index on status for finding active discoveries

**Files to create:**
- `backend/src/homelab_cmd/db/models/discovery.py` - Discovery model

**Model fields:**
```python
id: int (PK, autoincrement)
subnet: str (not null, e.g., "192.168.1.0/24")
status: str ('pending', 'running', 'completed', 'failed')
progress_scanned: int (default 0)
progress_total: int (default 0)
devices_found: int (default 0)
devices: list[dict] (JSON, array of discovered devices)
started_at: datetime | None
completed_at: datetime | None
error: str | None
created_at, updated_at (from TimestampMixin)
```

**Device schema in devices JSON:**
```python
{
  "ip": "192.168.1.1",
  "hostname": "router" | null,
  "response_time_ms": 5,
  "is_monitored": false
}
```

#### Step 1.2: Register Model

- [ ] Import Discovery model in `db/models/__init__.py`
- [ ] Export enum and model in `__all__`

**Files to modify:**
- `backend/src/homelab_cmd/db/models/__init__.py` - Add imports

### Phase 2: Discovery Service

**Goal:** Create service layer for TCP port 22 scanning

#### Step 2.1: Create Discovery Service

- [ ] Create `DiscoveryService` class
- [ ] Implement `discover_host()` - check single IP
- [ ] Implement `discover_subnet()` - scan all IPs in subnet
- [ ] Implement `get_hostname()` - reverse DNS lookup
- [ ] Add concurrency limit (e.g., 50 concurrent connections)
- [ ] Cross-reference with registered servers for is_monitored flag

**Files to create:**
- `backend/src/homelab_cmd/services/discovery.py` - Discovery service

**Discovery algorithm:**
```python
async def discover_host(ip: str, timeout: float = 0.5) -> dict | None:
    """Check if host responds on TCP port 22."""
    start = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, 22),
            timeout=timeout
        )
        response_time_ms = int((time.monotonic() - start) * 1000)
        writer.close()
        await writer.wait_closed()

        # Try reverse DNS
        try:
            hostname = socket.gethostbyaddr(ip)[0]
        except socket.herror:
            hostname = None

        return {
            'ip': ip,
            'hostname': hostname,
            'response_time_ms': response_time_ms,
        }
    except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
        return None
```

**Concurrency control:**
- Use `asyncio.Semaphore(50)` to limit concurrent connections
- Batch updates to database every 10 IPs scanned

#### Step 2.2: Add Discovery Settings

- [ ] Add "discovery" config key with default_subnet and timeout_ms
- [ ] Create helper functions for getting/setting discovery config

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/config.py` - Add discovery settings endpoint

**Default settings:**
```python
DEFAULT_DISCOVERY = {
    "default_subnet": "192.168.1.0/24",
    "timeout_ms": 500
}
```

### Phase 3: API Endpoints

**Goal:** Create REST API for discovery management

#### Step 3.1: Create Pydantic Schemas

- [ ] Create `DiscoveryRequest` schema (subnet optional)
- [ ] Create `DiscoveryResponse` schema (id, status, progress, devices)
- [ ] Create `DiscoveryDevice` schema (ip, hostname, response_time_ms, is_monitored)
- [ ] Create `DiscoverySettingsResponse` schema

**Files to create/modify:**
- `backend/src/homelab_cmd/api/schemas/discovery.py` - Discovery schemas

#### Step 3.2: Create Discovery Router

- [ ] Implement POST /api/v1/discovery - Initiate discovery
- [ ] Implement GET /api/v1/discovery/{discovery_id} - Get discovery status/results
- [ ] Implement GET /api/v1/settings/discovery - Get discovery settings
- [ ] Add authentication to all endpoints
- [ ] Handle "discovery already running" case

**Files to create:**
- `backend/src/homelab_cmd/api/routes/discovery.py` - Discovery router

**Endpoint logic:**

POST /api/v1/discovery:
1. Check for running discovery - return existing ID if found
2. Parse subnet (use default if not provided)
3. Validate subnet is not too large (> /16 returns 400)
4. Create Discovery record with status="pending"
5. Start background task for discovery execution
6. Return 202 Accepted with discovery_id

GET /api/v1/discovery/{discovery_id}:
1. Fetch discovery by ID
2. Return current status, progress, devices (if complete/in-progress)

GET /api/v1/settings/discovery:
1. Return default_subnet and timeout_ms from config

#### Step 3.3: Register Router

- [ ] Add discovery router to main.py
- [ ] Add "Discovery" tag to OpenAPI

**Files to modify:**
- `backend/src/homelab_cmd/api/main.py` - Register router

### Phase 4: Backend Background Execution

**Goal:** Execute discovery asynchronously with progress updates

#### Step 4.1: Implement Background Discovery

- [ ] Create async function for discovery execution
- [ ] Update progress in database as IPs are scanned
- [ ] Cross-reference found devices with Server model for is_monitored
- [ ] Handle errors and update status to "failed"
- [ ] Mark complete with results on success

**Files to modify:**
- `backend/src/homelab_cmd/services/discovery.py` - Add background execution

**Considerations:**
- Use asyncio.Semaphore for concurrency control
- Update database in batches (every 10 IPs or 2 seconds)
- Query Server model to check if IP matches any registered server
- Commit changes immediately for real-time progress visibility

### Phase 5: Frontend Implementation

**Goal:** Add discovery UI to scan page

#### Step 5.1: Create API Client Functions

- [ ] Add `startDiscovery()` function
- [ ] Add `getDiscovery()` function
- [ ] Add `getDiscoverySettings()` function
- [ ] Add types for discovery data

**Files to create/modify:**
- `frontend/src/api/discovery.ts` - Discovery API client
- `frontend/src/types/discovery.ts` - Discovery types

#### Step 5.2: Create Discovery Components

- [ ] Create `NetworkDiscovery` component (main container)
- [ ] Create `DiscoveryProgress` component (progress bar)
- [ ] Create `DiscoveryResults` component (device table)
- [ ] Add "Scan" button per device row

**Files to create:**
- `frontend/src/components/NetworkDiscovery.tsx` - Main discovery component
- `frontend/src/components/DiscoveryProgress.tsx` - Progress display
- `frontend/src/components/DiscoveryResults.tsx` - Results table

**UI elements:**
- Subnet display with settings link
- "Discover Now" button
- Progress bar with "X / Y IPs scanned" text
- Results table: IP | Hostname | Response Time | Status/Action
- "★ Monitored" badge for registered servers
- "Scan" button for unregistered devices
- "Last discovery: X minutes ago" timestamp

#### Step 5.3: Create Scans Page

- [ ] Create `/scans` route with ScanPage component
- [ ] Add manual scan section (hostname input, quick/full buttons)
- [ ] Add network discovery section
- [ ] Handle navigation from discovery to scan results

**Files to create:**
- `frontend/src/pages/ScansPage.tsx` - Main scans page

**Page layout (from wireframe):**
```
┌─────────────────────────────────────────┐
│ Manual Scan                             │
│ Hostname/IP: [____] [Quick] [Full]      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Network Discovery            [Settings] │
│ Subnet: 192.168.1.0/24   [Discover Now] │
│ Progress: ████░░░░  127/254 IPs         │
│                                         │
│ Found Devices (8)                       │
│ ┌─────────────────────────────────────┐ │
│ │ IP          │ Host  │ Time │ Action│ │
│ │ 192.168.1.1 │ router│ 1ms  │ [Scan]│ │
│ │ 192.168.1.10│ omv   │ 2ms  │ ★ Mon │ │
│ └─────────────────────────────────────┘ │
│ Last discovery: 2 min ago               │
└─────────────────────────────────────────┘
```

#### Step 5.4: Update App Router

- [ ] Add `/scans` route to App.tsx
- [ ] Update navigation links if needed

**Files to modify:**
- `frontend/src/App.tsx` - Add route

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Backend Unit Tests

- [ ] Test subnet parsing (valid/invalid CIDR)
- [ ] Test IP iteration from subnet
- [ ] Test discovery service with mocked connections
- [ ] Test is_monitored cross-reference logic

**Files to create:**
- `backend/tests/test_discovery_service.py` - Unit tests

#### Step 6.2: Backend API Tests

- [ ] Test POST /api/v1/discovery creates discovery
- [ ] Test POST /api/v1/discovery with running discovery returns existing
- [ ] Test POST /api/v1/discovery with large subnet returns 400
- [ ] Test GET /api/v1/discovery/{id} returns status
- [ ] Test GET /api/v1/settings/discovery returns config
- [ ] Test authentication required on all endpoints

**Files to create:**
- `backend/tests/test_discovery_api.py` - API tests

#### Step 6.3: Frontend Tests

- [ ] Test NetworkDiscovery component renders
- [ ] Test discovery progress updates
- [ ] Test results table displays devices
- [ ] Test "Scan" button navigates correctly
- [ ] Test "Monitored" badge for registered servers
- [ ] Test empty state when no devices found

**Files to create:**
- `frontend/src/__tests__/network-discovery.test.tsx` - Component tests

#### Step 6.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | POST /api/v1/discovery returns 202, creates discovery | Pending |
| AC2 | Discovery uses subnet from settings or request | Pending |
| AC3 | GET /discovery/{id} returns devices with IP, hostname, response_time | Pending |
| AC4 | Click "Scan" navigates to scan form with IP pre-filled | Pending |
| AC5 | GET /discovery/{id} returns progress_scanned and progress_total | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Large subnet (/16) | Return HTTP 400 with message "Subnet too large. Maximum allowed is /16 (65534 hosts)." | Phase 3 | [ ] |
| 2 | No devices found | Return empty devices array, frontend shows "No devices found" message | Phase 4 | [ ] |
| 3 | Device offline during scan | Connection timeout, not included in results | Phase 2 | [ ] |
| 4 | Discovery already running | Return existing discovery_id with status=running, don't start new one | Phase 3 | [ ] |

### Coverage Summary

- Story edge cases: 4
- Handled in plan: 4
- Unhandled: 0

### Edge Case Implementation Notes

- **Large subnet:** Calculate host count from CIDR, reject if > 65534 (which is /16)
- **No devices found:** devices array will be empty, is_monitored flags don't apply
- **Device offline:** asyncio.wait_for timeout handles this, no result added
- **Discovery already running:** Query for status="running", return that discovery

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TCP port 22 not open on all devices | Medium | Clear UI messaging that only SSH-enabled devices are detected |
| Firewall blocks scanning | Medium | Document in edge cases, show helpful error message |
| Slow subnet scan on large networks | Medium | Progress tracking, limit to /16, use concurrency |
| Rate limiting by network equipment | Low | Configurable timeout, semaphore for concurrency |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0002: Server Registration API | Story | Done - needed for is_monitored cross-reference |
| US0038: Scan Initiation | Story | Done - provides scan form to pre-populate |
| ipaddress | Python stdlib | For CIDR parsing |

## Open Questions

None - all questions resolved during planning.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] API tests written and passing
- [ ] Frontend tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Build succeeds

## Notes

- TCP port 22 scanning does not require elevated privileges
- Only SSH-enabled devices are discovered (which are the scannable ones anyway)
- Progress updates enable real-time UI feedback during long scans
- Discovery results are not persisted long-term (only latest discovery stored)
