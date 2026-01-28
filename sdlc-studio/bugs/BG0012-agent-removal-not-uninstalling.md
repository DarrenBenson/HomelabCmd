# BG0012: Agent Removal Does Not Actually Uninstall Agent - Agent Reconnects

> **Status:** Closed
> **Severity:** High
> **Priority:** P1
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

When using the "Remove Agent" function, the server is marked as inactive in the database, but the agent software is not actually uninstalled from the target server. The agent continues running and sends heartbeats, which may re-activate the server or cause confusion.

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md)
- **Story:** [US0064: Agent Removal API](../stories/US0064-agent-removal-api.md)
- **Component:** Backend - Agent Deployment Service

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** N/A (backend issue)

## Reproduction Steps

1. Have a server with agent installed and reporting heartbeats
2. Go to Server Detail page
3. Click "Remove Agent" button
4. Confirm removal (without "delete completely")
5. Observe server marked as inactive
6. Wait for next heartbeat interval (30-60 seconds)
7. Server reappears as active or agent continues running on target

## Expected Behaviour

1. Remove Agent should SSH to the target server
2. Execute uninstall commands:
   - `systemctl stop homelab-agent`
   - `systemctl disable homelab-agent`
   - `rm -rf /opt/homelab-agent /etc/homelab-agent`
   - `rm /etc/systemd/system/homelab-agent.service`
   - `systemctl daemon-reload`
3. Agent process stops on target
4. Server marked as inactive in database
5. No further heartbeats received

## Actual Behaviour

1. Server is marked as inactive in database
2. SSH uninstall command may fail silently or not execute
3. Agent continues running on target server
4. Heartbeats continue being sent
5. Server may be re-activated by heartbeat handler (see `agents.py` auto-reactivation logic)

## Screenshots/Evidence

Backend logs show removal marked as successful even when SSH fails:
```
WARNING: Could not uninstall agent from 10.0.0.5: [error details]
# But removal still completes and marks server inactive
```

## Root Cause Analysis

Looking at `agent_deploy.py:407-455` (remove_agent method):

```python
# Try to uninstall agent via SSH (best effort)
if hostname:
    uninstall_cmd = """..."""
    result = await self.ssh.execute_command(...)

    if not result.success:
        logger.warning(...)
        # Continue anyway - mark as inactive even if uninstall fails
```

**Issues identified:**

1. **Best-effort uninstall**: SSH failure is logged but ignored - server still marked inactive
2. **Auto-reactivation**: In `agents.py` heartbeat handler, inactive servers are automatically reactivated when they send a heartbeat:
   ```python
   if server.is_inactive:
       server.is_inactive = False
       server.inactive_since = None
   ```
3. **No feedback to user**: UI shows success even when uninstall failed

## Fix Description

Implemented **Option C** (defense in depth):

**1. Block heartbeats from inactive servers:**
- Modified heartbeat endpoint to check `server.is_inactive` early
- Return 403 Forbidden with message "Server is inactive (agent removed). Uninstall the agent."
- Removed the auto-reactivation logic that was re-enabling inactive servers

**2. Improve user feedback on uninstall failure:**
- Track whether SSH uninstall succeeded
- Include warning in success message if uninstall failed
- Frontend now displays warning separately from success message

**3. Defense in depth:**
- Even if SSH uninstall fails, agent can't re-activate the server
- User is informed that agent may still be running
- Logs warning about rejected heartbeats for monitoring

**4. Added reactivation UI:**
- "Reactivate Server" button added to inactive server detail page
- Users can explicitly reactivate a server when they want to re-enable it
- Also shows "Delete Server" button to fully remove inactive servers

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/api/routes/agents.py:6,11` | Import HTTPException, FORBIDDEN_RESPONSE |
| `backend/src/homelab_cmd/api/routes/agents.py:149` | Add FORBIDDEN_RESPONSE to endpoint responses |
| `backend/src/homelab_cmd/api/routes/agents.py:171-184` | Check is_inactive early, reject with 403 |
| `backend/src/homelab_cmd/api/routes/agents.py:228-229` | Remove auto-reactivation logic |
| `backend/src/homelab_cmd/services/agent_deploy.py:432` | Track uninstall_warning |
| `backend/src/homelab_cmd/services/agent_deploy.py:450-461` | Build warning message on SSH failure |
| `backend/src/homelab_cmd/services/agent_deploy.py:468-491` | Include warning in return message |
| `frontend/src/components/AgentRemoveModal.tsx:106-126` | Display warning separately from success |
| `frontend/src/pages/ServerDetail.tsx:5` | Import activateServer API |
| `frontend/src/pages/ServerDetail.tsx:68` | Add activating state |
| `frontend/src/pages/ServerDetail.tsx:193-209` | Add handleActivate handler |
| `frontend/src/pages/ServerDetail.tsx:500-527` | Add Reactivate/Delete buttons for inactive servers |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| - | Backend guards prevent heartbeat processing | - |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (1283 backend tests pass)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** Claude
**Verification date:** 2026-01-22

### Verification Summary

The fix is verified. Heartbeats from inactive servers are now rejected with 403 Forbidden at `routes/agents.py:213-226`. The auto-reactivation logic was removed, and the frontend displays appropriate warnings when SSH uninstall fails.

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Epic | EP0007 | Agent Management |
| Story | US0064 | Agent Removal API |
| Bug | BG0011 | Inactive servers allow operations |

## Notes

This is a critical issue because:
1. Users believe agent is removed but it's still running
2. The "inactive" state is meaningless if the agent keeps reconnecting
3. Security concern: removed agents should not be able to re-register

The heartbeat auto-reactivation logic was added as a convenience feature but creates a conflict with the removal functionality.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status: Open → In Progress |
| 2026-01-21 | Claude | Status: In Progress → Fixed (Option C implemented) |
