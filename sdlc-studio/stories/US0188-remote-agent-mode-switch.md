# US0188: Remote Agent Mode Switch

> **Status:** Draft
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to switch an agent from readonly to readwrite mode via the UI
**So that** I don't have to manually SSH into each server to enable command execution

## Context

### Persona Reference

**Darren** - Technical professional managing 11+ servers. Currently, switching agent mode requires SSHing into each server manually, which is tedious when the hub already has SSH access configured.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Agents can run in two modes:
- **readonly**: Metrics collection only, no command execution
- **readwrite**: Full management including command execution

Currently, to switch from readonly to readwrite, users must:
1. SSH into the server manually
2. Run `/opt/homelab-agent/install.sh --mode readwrite`
3. Restart the agent service

This is a poor UX when the hub already has SSH credentials configured and can execute commands on the server. The hub should offer a "Switch to Read/Write" button that performs this automatically.

---

## Acceptance Criteria

### AC1: Switch mode button visible for readonly agents

- **Given** a server with an agent in readonly mode
- **When** I view the Server Detail page
- **Then** I see a "Switch to Read/Write" button near the agent mode indicator
- **And** the button is only visible when SSH is configured for that server

### AC2: Switch mode via SSH

- **Given** I click "Switch to Read/Write"
- **When** the hub has valid SSH credentials
- **Then** the hub SSHs into the server
- **And** runs `/opt/homelab-agent/install.sh --mode readwrite`
- **And** restarts the agent service

### AC3: Progress feedback during switch

- **Given** a mode switch is in progress
- **When** viewing the Server Detail page
- **Then** I see a loading indicator on the button
- **And** the button is disabled during the operation

### AC4: Success confirmation

- **Given** the mode switch completes successfully
- **When** the agent sends its next heartbeat
- **Then** the agent mode updates to "readwrite" in the UI
- **And** the "Switch to Read/Write" button disappears
- **And** a success toast notification is shown

### AC5: Error handling

- **Given** the mode switch fails (SSH error, permission denied, etc.)
- **When** the operation completes
- **Then** an error message is shown with the failure reason
- **And** the button returns to its normal state
- **And** I can retry the operation

### AC6: Switch back to readonly (optional)

- **Given** a server with an agent in readwrite mode
- **When** I view the Server Detail page
- **Then** I can optionally switch back to readonly mode
- **And** this follows the same flow as switching to readwrite

---

## Scope

### In Scope

- "Switch to Read/Write" button on Server Detail page
- API endpoint to trigger mode switch via SSH
- SSH command execution to reinstall agent with new mode
- Progress feedback and error handling
- Success/failure notifications

### Out of Scope

- Bulk mode switch for multiple servers (future enhancement)
- Scheduled mode switches
- Mode switch via agent heartbeat command (chicken-and-egg problem)

---

## Technical Notes

### Implementation Approach

1. **New API endpoint:**
   ```
   POST /api/v1/servers/{server_id}/agent/mode
   Body: { "mode": "readwrite" | "readonly" }
   ```

2. **SSH command sequence:**
   ```bash
   sudo /opt/homelab-agent/install.sh --mode {mode} && \
   sudo systemctl restart homelab-agent
   ```

3. **Use existing SSH infrastructure:**
   - SSHPooledExecutor for connection management
   - Credential service for SSH key retrieval
   - Host key service for known hosts

### Files to Create/Modify

- `backend/src/homelab_cmd/api/routes/agent_deploy.py` - Add mode switch endpoint
- `backend/src/homelab_cmd/services/agent_deploy.py` - Add switch_agent_mode method
- `frontend/src/pages/ServerDetail.tsx` - Add switch mode button
- `frontend/src/api/agent.ts` - Add switchAgentMode API call

### API Response

```python
class AgentModeSwitchResponse(BaseModel):
    success: bool
    server_id: str
    new_mode: str | None
    message: str
    error: str | None
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | SSH connection fails | Show error, allow retry |
| 2 | sudo permission denied | Show specific error about sudo access |
| 3 | Agent install script missing | Show error about agent not properly installed |
| 4 | Service restart fails | Show error, agent may be in inconsistent state |
| 5 | Network timeout | Show timeout error, allow retry |
| 6 | SSH key not configured | Button disabled with tooltip explaining why |

---

## Test Scenarios

- [ ] Button visible only for readonly agents with SSH configured
- [ ] Button disabled when SSH not configured
- [ ] Mode switch succeeds and UI updates
- [ ] Error displayed on SSH failure
- [ ] Loading state shown during operation
- [ ] Success notification shown
- [ ] Agent heartbeat reflects new mode

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0079 | SSH via Tailscale | Done |
| US0151 | SSH Executor Service | Done |
| US0153 | Synchronous Command Execution API | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Leverages existing SSH infrastructure, primarily UI + thin API layer

---

## Open Questions

1. Should we support switching back to readonly mode? (Included as AC6 but marked optional)

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from user feedback |
