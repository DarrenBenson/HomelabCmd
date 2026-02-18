# PL0201: Agent Auto-Update Mechanism - Implementation Plan

> **Status:** Done
> **Story:** [US0184: Agent Auto-Update Mechanism](../stories/US0184-agent-auto-update.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-31
> **Language:** Python (Backend/Agent), TypeScript (Frontend)

## Overview

Implement an agent auto-update mechanism that allows agents to automatically update themselves when a new version is available. The hub advertises the current agent version in heartbeat responses, agents detect version mismatches, and optionally self-update with rollback capability on failure.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Hub version advertisement | Heartbeat response includes `latest_agent_version` |
| AC2 | Agent version detection | Agent detects when newer version available |
| AC3 | Auto-update toggle | Per-server setting to enable/disable auto-update (opt-in) |
| AC4 | Agent self-update | Agent downloads, verifies, replaces, and restarts |
| AC5 | Dashboard status | Update badge and version info visible |
| AC6 | Manual trigger | UI button to trigger update regardless of setting |
| AC7 | Rollback on failure | Revert to previous version if update fails |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (Backend, Agent)
- **Frontend:** TypeScript/React
- **Framework:** FastAPI (Backend), Vitest (Frontend tests)
- **Test Framework:** pytest (Backend), Vitest (Frontend)

### Relevant Best Practices
- Follow existing heartbeat patterns in `agents.py`
- Use Pydantic schemas for request/response validation
- Implement retry logic with exponential backoff
- Store checksums alongside agent binaries
- Graceful degradation when hub unavailable

### Existing Patterns

**Heartbeat Flow:**
- Agent sends POST to `/api/v1/agents/heartbeat` with metrics
- Hub updates server record, returns `HeartbeatResponse`
- Response currently has `pending_commands: []` (deprecated)

**Version Tracking:**
- Agent reads version from `VERSION` file
- Hub stores `agent_version` in Server model
- Updated on every heartbeat

**Server Settings Pattern:**
- Boolean flags like `is_paused`, `is_inactive`
- Settings exposed via PATCH `/api/v1/servers/{id}`

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This feature involves cross-component changes (backend, agent, frontend) and filesystem operations. Test-After allows validating the integration holistically before writing targeted tests.

### Test Priority
1. Heartbeat response includes latest version (API test)
2. Agent version comparison logic (unit test)
3. Auto-update toggle persistence (API + frontend test)
4. Agent update flow with mock downloads (integration test)
5. Rollback on failure (agent unit test)

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add `latest_agent_version` to HeartbeatResponse | `schemas/heartbeat.py` | - | [ ] |
| 2 | Add `update_command` field to HeartbeatResponse | `schemas/heartbeat.py` | 1 | [ ] |
| 3 | Add `auto_update_agent` to Server model | `models/server.py` | - | [ ] |
| 4 | Create Alembic migration | `migrations/versions/` | 3 | [ ] |
| 5 | Update heartbeat endpoint to include version | `routes/agents.py` | 1 | [ ] |
| 6 | Add version config setting | `config.py` | - | [ ] |
| 7 | Create agent download endpoint | `routes/agents.py` | - | [ ] |
| 8 | Add update trigger endpoint | `routes/agents.py` | 2, 3 | [ ] |
| 9 | Add `update_available` to heartbeat request | `schemas/heartbeat.py` | - | [ ] |
| 10 | Update Server PATCH schema for auto_update | `schemas/server.py` | 3 | [ ] |
| 11 | Implement agent version comparison | `agent/updater.py` | - | [ ] |
| 12 | Implement agent download logic | `agent/updater.py` | 11 | [ ] |
| 13 | Implement checksum verification | `agent/updater.py` | 12 | [ ] |
| 14 | Implement self-replacement logic | `agent/updater.py` | 13 | [ ] |
| 15 | Implement rollback mechanism | `agent/updater.py` | 14 | [ ] |
| 16 | Integrate updater with heartbeat loop | `agent/heartbeat.py` | 11, 15 | [ ] |
| 17 | Add update badge to ServerCard | `ServerCard.tsx` | - | [ ] |
| 18 | Add auto-update toggle to ServerDetail | `ServerDetail.tsx` | - | [ ] |
| 19 | Add manual update button | `ServerDetail.tsx` | 8 | [ ] |
| 20 | Add update status display | `ServerDetail.tsx` | 17 | [ ] |
| 21 | Write backend unit tests | `tests/test_agent_update.py` | 1-10 | [ ] |
| 22 | Write agent unit tests | `agent/test_updater.py` | 11-16 | [ ] |
| 23 | Write frontend tests | `__tests__/` | 17-20 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 2, 9 | None (schema changes) |
| B | 3, 6 | None (model/config changes) |
| C | 11, 12, 13, 14, 15 | None (agent module) |
| D | 17, 18 | None (frontend - parallel to backend) |
| E | 4, 5, 7, 8, 10 | A, B complete |
| F | 16 | C, E complete |
| G | 19, 20 | E complete |
| H | 21, 22, 23 | All implementation complete |

---

## Implementation Phases

### Phase 1: Backend Schema and API
**Goal:** Hub can advertise agent version and accept update triggers

**Files:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add version fields
- `backend/src/homelab_cmd/db/models/server.py` - Add `auto_update_agent` boolean
- `backend/src/homelab_cmd/config.py` - Add `AGENT_VERSION` setting
- `backend/src/homelab_cmd/api/routes/agents.py` - Update heartbeat, add download endpoint
- `migrations/versions/xxx_add_auto_update_agent.py` - Migration

**Changes:**

1. **HeartbeatResponse extension:**
```python
class HeartbeatResponse(BaseModel):
    status: str = "ok"
    server_registered: bool = False
    pending_commands: list[str] = []  # Deprecated
    results_acknowledged: list[str] = []  # Deprecated
    # New fields for US0184
    latest_agent_version: str | None = None
    update_command: Literal["update"] | None = None
```

2. **HeartbeatRequest extension:**
```python
class HeartbeatRequest(BaseModel):
    # Existing fields...
    update_available: bool = False  # Agent reports if it knows update available
    update_status: str | None = None  # "downloading", "installing", "failed", "success"
    update_error: str | None = None  # Error message if update failed
```

3. **Server model:**
```python
class Server(Base):
    # Existing fields...
    auto_update_agent: bool = Column(Boolean, default=False, nullable=False)
    agent_update_status: str | None = Column(String(20), nullable=True)  # "pending", "downloading", "failed"
    agent_update_error: str | None = Column(String(500), nullable=True)
```

4. **Agent download endpoint:**
```python
@router.get("/agents/download")
async def download_agent(
    version: str | None = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_api_key),
) -> FileResponse:
    """Download agent binary with checksum header."""
    agent_path = get_agent_package_path(version)
    checksum = calculate_sha256(agent_path)
    return FileResponse(
        agent_path,
        headers={"X-Checksum-SHA256": checksum},
        media_type="application/octet-stream",
    )
```

5. **Update trigger endpoint:**
```python
@router.post("/servers/{server_id}/trigger-update")
async def trigger_agent_update(
    server_id: UUID,
    db: Session = Depends(get_db),
    _: str = Depends(require_api_key),
) -> dict:
    """Queue an update command for the agent."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(404, "Server not found")
    server.agent_update_status = "pending"
    db.commit()
    return {"status": "queued", "server_id": str(server_id)}
```

### Phase 2: Agent Update Module
**Goal:** Agent can detect, download, verify, and apply updates

**Files:**
- `agent/updater.py` - New module for update logic
- `agent/heartbeat.py` - Integrate updater
- `agent/__main__.py` - Handle update triggers

**Changes:**

1. **Version comparison:**
```python
def compare_versions(current: str, latest: str) -> int:
    """Compare semver versions. Returns 1 if latest > current, 0 if equal, -1 if less."""
    from packaging.version import Version
    return (Version(latest) > Version(current)) - (Version(latest) < Version(current))
```

2. **Update flow:**
```python
class AgentUpdater:
    def __init__(self, hub_url: str, current_version: str):
        self.hub_url = hub_url
        self.current_version = current_version
        self.backup_path = "/opt/homelab-agent/agent.py.bak"
        self.agent_path = "/opt/homelab-agent/agent.py"

    async def check_and_update(self, latest_version: str, force: bool = False) -> UpdateResult:
        """Check for update and apply if needed."""
        if not force and compare_versions(self.current_version, latest_version) <= 0:
            return UpdateResult(status="current")

        # Download new version
        new_agent, checksum = await self.download_agent(latest_version)

        # Verify checksum
        if not self.verify_checksum(new_agent, checksum):
            return UpdateResult(status="failed", error="Checksum mismatch")

        # Backup current agent
        self.backup_current()

        # Replace agent
        try:
            self.replace_agent(new_agent)
            self.restart_service()
            return UpdateResult(status="success", version=latest_version)
        except Exception as e:
            self.rollback()
            return UpdateResult(status="failed", error=str(e))
```

3. **Rollback mechanism:**
```python
def rollback(self):
    """Restore previous agent version."""
    if os.path.exists(self.backup_path):
        shutil.copy2(self.backup_path, self.agent_path)
        self.restart_service()
        logger.info("Rolled back to previous agent version")
```

### Phase 3: Frontend Integration
**Goal:** Dashboard shows update status and controls

**Files:**
- `frontend/src/components/ServerCard.tsx` - Update badge
- `frontend/src/pages/ServerDetail.tsx` - Toggle and trigger button
- `frontend/src/api/servers.ts` - API functions

**Changes:**

1. **Update badge on ServerCard:**
```tsx
{server.agent_version && server.latest_agent_version &&
 server.agent_version !== server.latest_agent_version && (
  <Badge variant="warning" className="ml-2">
    Update available
  </Badge>
)}
```

2. **Auto-update toggle:**
```tsx
<Switch
  checked={server.auto_update_agent}
  onCheckedChange={(checked) => updateServer({ auto_update_agent: checked })}
  label="Auto-update agent"
/>
```

3. **Manual update button:**
```tsx
<Button
  onClick={() => triggerAgentUpdate(server.id)}
  disabled={!updateAvailable || updating}
>
  {updating ? <Loader2 className="animate-spin" /> : <Download />}
  Update Agent
</Button>
```

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | API test - heartbeat response | `tests/test_agent_update.py` | Pending |
| AC2 | Unit test - version comparison | `agent/test_updater.py` | Pending |
| AC3 | API + UI test - toggle persistence | `tests/test_servers.py` | Pending |
| AC4 | Integration test - update flow | `agent/test_updater.py` | Pending |
| AC5 | UI test - badge display | `ServerCard.test.tsx` | Pending |
| AC6 | API + UI test - manual trigger | `tests/test_agent_update.py` | Pending |
| AC7 | Unit test - rollback logic | `agent/test_updater.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Download interrupted | Retry 3 times with 5s backoff, then fail | Phase 2 |
| 2 | Checksum mismatch | Reject download, report error to hub | Phase 2 |
| 3 | New agent fails to start | Backup before replace, rollback on failure | Phase 2 |
| 4 | Hub offline during update | Continue with current version, retry next heartbeat | Phase 2 |
| 5 | Disk full | Check available space before download, fail gracefully | Phase 2 |
| 6 | Update during active command | Check for running commands, defer update | Phase 2 |

**Coverage:** 6/6 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent becomes unresponsive after failed update | High | Rollback mechanism with backup; systemd restart policy |
| Hub serves corrupted agent binary | High | SHA256 checksum verification before replacement |
| Multiple agents updating simultaneously | Medium | Randomised update delay (0-60s) to spread load |
| Version string parsing failures | Low | Use `packaging.version` library with fallback |
| Frontend shows stale update status | Low | Refresh status on heartbeat response change |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] E2E test for update flow

---

## Notes

- Agent package location: `/opt/homelab-agent/` (installed) or `./agent/` (dev)
- Current agent version: 2.0.0 (from `agent/VERSION`)
- Heartbeat interval: configurable (default 30s)
- Consider future enhancement: staged rollouts (update X% first)
