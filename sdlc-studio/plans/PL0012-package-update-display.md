# PL0012: Package Update Display - Implementation Plan

> **Status:** Complete
> **Story:** [US0044: Package Update Display](../stories/US0044-package-update-display.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python (Backend/Agent), TypeScript (Frontend)

## Overview

Implement package update visibility across the stack: agent collection (already exists), backend storage, and frontend display. Security updates are highlighted to draw attention to critical patches.

**Key Finding:** The agent already has `get_package_updates()` implemented in `collectors.py` but the data is not yet included in the heartbeat payload or stored in the database.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Agent collects update count | Heartbeat includes `updates_available` and `security_updates` |
| AC2 | Display on server card | Server card shows update indicator (e.g., "12 updates (3 security)") |
| AC3 | Security updates highlighted | Security count displayed in warning colour |
| AC4 | Update details in detail view | Updates section with counts and last check time |
| AC5 | Clean state for zero updates | No indicator or "Up to date" when zero pending |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, SQLAlchemy 2.0 (async)
- **Agent:** Python 3.12 standalone script
- **Frontend:** TypeScript with React 18, Vite, TailwindCSS
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

- Follow existing heartbeat schema patterns (`HeartbeatRequest` in `schemas/heartbeat.py`)
- Use nullable columns for optional data (`Mapped[int | None]`)
- Match frontend types to backend response schemas

### Existing Patterns

**Agent Collection (already implemented):**
```python
# agent/collectors.py:181-236
def get_package_updates() -> dict[str, int | None]:
    """Get available package updates count."""
    # Uses apt-get -s upgrade for simulation
    # Returns: {'updates_available': int, 'security_updates': int}
```

**Heartbeat Payload (needs update):**
```python
# agent/heartbeat.py - currently excludes update data
payload = {
    "server_id": config.server_id,
    "hostname": os_info.get("hostname"),
    "timestamp": timestamp,
    "os_info": os_info,
    "metrics": metrics,
    # TODO: Add updates_available, security_updates
}
```

**Server Model Pattern:**
```python
# All optional fields use this pattern
updates_available: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Extending existing patterns (heartbeat, server model) with well-defined schema. Agent collection already implemented and tested. Focus on integration and display.

### Test Priority

1. Heartbeat stores update counts on Server model
2. Server API responses include update fields
3. Frontend displays update indicator correctly

### Documentation Updates Required

- [ ] Update story status to Planned

## Implementation Steps

### Phase 1: Backend - Schema and Model Updates

**Goal:** Enable storage and retrieval of update counts

#### Step 1.1: Update Server Model

- [ ] Add `updates_available` column (nullable integer)
- [ ] Add `security_updates` column (nullable integer)

**Files to modify:**
- `backend/src/homelab_cmd/db/models/server.py` - Add two columns

**Code:**
```python
# After line 55 (after existing fields like kernel_version)
updates_available: Mapped[int | None] = mapped_column(Integer, nullable=True)
security_updates: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

#### Step 1.2: Update Heartbeat Schema

- [ ] Add `updates_available` to `HeartbeatRequest`
- [ ] Add `security_updates` to `HeartbeatRequest`

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add fields to HeartbeatRequest

**Code:**
```python
class HeartbeatRequest(BaseModel):
    # ... existing fields ...
    updates_available: int | None = None
    security_updates: int | None = None
```

#### Step 1.3: Update Heartbeat Handler

- [ ] Extract update counts from request
- [ ] Store on server object

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Update receive_heartbeat function

**Code (add after OS info update section):**
```python
# Update package update counts
if request.updates_available is not None:
    server.updates_available = request.updates_available
if request.security_updates is not None:
    server.security_updates = request.security_updates
```

#### Step 1.4: Update Server Response Schema

- [ ] Add update fields to `LatestMetrics` or create separate section
- [ ] Ensure fields included in list and detail responses

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py` - Add fields
- `backend/src/homelab_cmd/api/routes/servers.py` - Include in response building

**Note:** Update counts are server-level data (not per-metric), so add directly to ServerResponse/ServerDetailResponse rather than LatestMetrics.

### Phase 2: Agent - Include Updates in Heartbeat

**Goal:** Send collected update data to hub

#### Step 2.1: Update Heartbeat Payload

- [ ] Include `updates_available` and `security_updates` in payload

**Files to modify:**
- `agent/heartbeat.py` - Add to payload dictionary

**Current code (line 56-57):**
```python
# mac_address and package_updates are collected but the hub schema doesn't support them yet
```

**Updated code:**
```python
payload = {
    "server_id": config.server_id,
    "hostname": os_info.get("hostname"),
    "timestamp": timestamp,
    "os_info": os_info,
    "metrics": metrics,
    "updates_available": package_updates.get("updates_available") if package_updates else None,
    "security_updates": package_updates.get("security_updates") if package_updates else None,
}
```

### Phase 3: Frontend - Display Updates

**Goal:** Show update counts in UI with security highlighting

#### Step 3.1: Update TypeScript Types

- [ ] Add `updates_available` and `security_updates` to Server types

**Files to modify:**
- `frontend/src/types/server.ts` - Add to Server and ServerDetail interfaces

**Code:**
```typescript
export interface Server {
  // ... existing fields ...
  updates_available: number | null;
  security_updates: number | null;
}
```

#### Step 3.2: Update Server Card

- [ ] Add update indicator in card footer
- [ ] Highlight security updates in warning colour
- [ ] Hide indicator when zero updates

**Files to modify:**
- `frontend/src/components/ServerCard.tsx` - Add update badge/indicator

**UI Pattern:**
```
📦 12 updates (3 security)  <- security in warning amber
✓ Up to date               <- green, shown when 0 updates
```

#### Step 3.3: Update Server Detail Page

- [ ] Add "System Updates" section between System and Resource Utilisation
- [ ] Display total updates, security updates count
- [ ] Use warning colour for security > 0

**Files to modify:**
- `frontend/src/pages/ServerDetail.tsx` - Add updates section

**Section layout:**
```
┌─────────────────────────────────────────┐
│ System Updates                           │
├─────────────────────────────────────────┤
│ Available Updates:    12                 │
│ Security Updates:     3  ⚠️               │
└─────────────────────────────────────────┘
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Backend Tests

- [ ] Test heartbeat stores update counts
- [ ] Test server list includes update fields
- [ ] Test server detail includes update fields
- [ ] Test null handling (non-Debian systems)

**Files to create/modify:**
- `tests/test_heartbeat.py` - Add tests for update fields

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test: Heartbeat with updates stored on server | Pending |
| AC2 | Manual: Server card shows "12 updates (3 security)" | Pending |
| AC3 | Manual: Security count in warning colour | Pending |
| AC4 | Manual: Detail page has Updates section | Pending |
| AC5 | Manual: Zero updates shows "Up to date" | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| apt not available (non-Debian) | Agent returns null, display "N/A" or hide section |
| Zero updates | Show "Up to date" in green or hide indicator |
| Very large count (100+) | Display as "99+" on card, full number in detail |
| Null values | Display "N/A" or "--" |
| Only security updates (security > total) | Edge case - shouldn't happen, display as-is |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migration on running system | Downtime | Nullable columns safe to add; no data loss |
| Agent update required | Stale data | Existing agents send null until updated |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0003: Agent Heartbeat Endpoint | Story | Done - provides heartbeat infrastructure |
| US0004: Agent Script | Story | Done - provides agent framework |
| US0005: Dashboard Server List | Story | Done - provides server card |
| US0006: Server Detail View | Story | Done - provides detail page |

## Open Questions

None - requirements are clear from story.

## Definition of Done Checklist

- [ ] All 5 acceptance criteria implemented
- [ ] Backend tests for heartbeat update storage
- [ ] Server model has update columns
- [ ] Agent sends updates in heartbeat
- [ ] Server card shows update indicator
- [ ] Server detail has updates section
- [ ] Security updates highlighted in warning colour
- [ ] Zero updates shows clean state
- [ ] No linting errors (ruff, eslint)
- [ ] Ready for code review

## Notes

**File Count:** ~7 files to modify
- Backend: 4 (model, 2 schemas, handler)
- Agent: 1 (heartbeat)
- Frontend: 2 (types, card) + 1 (detail page)

**Estimated Effort:**
- Phase 1 (Backend): 20 min
- Phase 2 (Agent): 5 min
- Phase 3 (Frontend): 30 min
- Phase 4 (Tests): 15 min
