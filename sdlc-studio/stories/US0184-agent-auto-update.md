# US0184: Agent Auto-Update Mechanism

> **Status:** Draft
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 8

## User Story

**As a** Darren (Homelab Operator)
**I want** agents to automatically update themselves when a new version is available
**So that** I don't have to manually reinstall agents across all servers

## Context

### Persona Reference

**Darren** - Technical professional managing 11+ servers. Manual agent updates across all servers is time-consuming and error-prone.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, updating agents requires manually triggering a reinstall from the hub for each server. With 11+ servers, this is tedious. An auto-update mechanism would ensure all agents stay current with minimal intervention.

---

## Acceptance Criteria

### AC1: Hub advertises current agent version

- **Given** the hub is running
- **When** an agent sends a heartbeat
- **Then** the heartbeat response includes `latest_agent_version`
- **And** the version follows semver format (e.g., "1.2.3")

### AC2: Agent detects version mismatch

- **Given** an agent receives a heartbeat response
- **When** `latest_agent_version` > `current_agent_version`
- **Then** the agent logs "New version available: {version}"
- **And** the agent sets `update_available: true` in next heartbeat

### AC3: Auto-update toggle per server

- **Given** a server in the dashboard
- **When** I view server settings
- **Then** I can enable/disable auto-update for that server
- **And** the default is disabled (opt-in)

### AC4: Agent self-updates when enabled

- **Given** auto-update is enabled for a server
- **When** the agent detects a newer version available
- **Then** the agent downloads the new version from the hub
- **And** the agent verifies the download (checksum)
- **And** the agent replaces itself and restarts

### AC5: Update status visible in dashboard

- **Given** agents with updates available
- **When** I view the dashboard
- **Then** I see an "Update available" badge on servers with outdated agents
- **And** I can see current vs latest version

### AC6: Manual update trigger

- **Given** a server with an outdated agent
- **When** I click "Update Agent" in the UI
- **Then** the hub sends an update command via heartbeat response
- **And** the agent updates regardless of auto-update setting

### AC7: Rollback on update failure

- **Given** an agent is updating
- **When** the update fails (download error, checksum mismatch, startup failure)
- **Then** the agent reverts to the previous version
- **And** the agent reports the failure to the hub
- **And** the failure is visible in the dashboard

---

## Scope

### In Scope

- Hub version advertisement in heartbeat response
- Agent version comparison logic
- Auto-update setting per server
- Agent self-update mechanism
- Download verification (checksum)
- Update status in dashboard
- Manual update trigger
- Basic rollback on failure

### Out of Scope

- Staged rollouts (update X% of agents first)
- Update scheduling (update at specific time)
- Agent downgrade capability
- Multi-architecture agent binaries (assume same arch)

---

## Technical Notes

### Implementation Approach

1. **Heartbeat response extension:**
   ```python
   class HeartbeatResponse(BaseModel):
       # Existing fields...
       latest_agent_version: str | None = None
       update_command: str | None = None  # "update" to trigger
   ```

2. **Agent update flow:**
   ```
   Agent heartbeat → Hub responds with latest_version
   Agent compares versions → If newer and auto_update enabled
   Agent requests /api/v1/agents/download?version=X.Y.Z
   Agent verifies checksum → Downloads to temp location
   Agent stops service → Replaces binary → Restarts service
   If startup fails → Revert to backup
   ```

3. **Server setting:**
   ```python
   class Server(Base):
       # Existing fields...
       auto_update_agent: bool = False
   ```

### Files to Create/Modify

- `backend/src/homelab_cmd/api/routes/agents.py` - Download endpoint
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add version fields
- `backend/src/homelab_cmd/db/models/server.py` - Add auto_update_agent
- `agent/agent.py` - Self-update logic
- `frontend/src/pages/ServerDetail.tsx` - Auto-update toggle
- `frontend/src/components/ServerCard.tsx` - Update badge

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Download interrupted | Retry up to 3 times, then fail gracefully |
| 2 | Checksum mismatch | Reject download, report error |
| 3 | New agent fails to start | Revert to previous version |
| 4 | Hub offline during update | Agent continues with current version |
| 5 | Disk full | Fail gracefully, report error |
| 6 | Update during active command | Wait for command completion first |

---

## Test Scenarios

- [ ] Hub includes latest_agent_version in heartbeat response
- [ ] Agent detects version mismatch correctly
- [ ] Auto-update setting persists per server
- [ ] Agent downloads and verifies new version
- [ ] Agent restarts successfully after update
- [ ] Rollback works on startup failure
- [ ] Manual update trigger works
- [ ] Update badge shows on dashboard

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0004 | Agent script infrastructure | Done |
| US0003 | Heartbeat endpoint | Done |

---

## Estimation

**Story Points:** 8
**Complexity:** High - agent self-modification, rollback logic, cross-component changes

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0001 open question |
