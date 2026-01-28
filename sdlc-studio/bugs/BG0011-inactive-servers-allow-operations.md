# BG0011: Inactive Servers Still Allow System Updates and Operations

> **Status:** Closed
> **Severity:** Medium
> **Priority:** P2
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

Servers marked as inactive (agent removed) still allow operations that should be disabled, including:
- Triggering system package updates
- Receiving alerts/notifications
- Service monitoring and restart actions
- Other remediation actions

Inactive servers should have all operational functionality disabled since the agent is no longer running.

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md) / [EP0004: Remediation](../epics/EP0004-remediation.md)
- **Story:** US0065 (Server Inactive State)
- **Component:** Backend API, Frontend UI

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All

## Reproduction Steps

1. Install agent on a server
2. Remove agent (mark server as inactive)
3. Navigate to server detail page
4. Observe that "Apply Updates" button is still enabled
5. Click the button - operation will fail but shouldn't be possible

## Expected Behaviour

For inactive servers:
1. **Package Updates**: "Apply Updates" button should be disabled/hidden
2. **Alerts**: No new alerts should be generated (no heartbeat = no metrics)
3. **Service Monitoring**: Service panel should be hidden or show "Agent Inactive"
4. **Remediation Actions**: All action buttons should be disabled
5. **API Endpoints**: Should return 400/409 error if operation attempted on inactive server

## Actual Behaviour

1. **Package Updates**: Button is still clickable, operation fails at execution
2. **Alerts**: May still show stale alerts (not generating new ones, but UI not clear)
3. **Service Monitoring**: Services panel still visible with stale data
4. **Remediation Actions**: Buttons may still be clickable
5. **API Endpoints**: May accept requests and fail later

## Screenshots/Evidence

N/A - Functional behaviour issue

## Root Cause Analysis

The `is_inactive` flag was added to the Server model but guards were not added to:
1. Frontend components to disable/hide action buttons
2. Backend API endpoints to reject operations on inactive servers
3. Alert generation to skip inactive servers
4. Service monitoring display

**Files needing guards:**

| Area | Files |
|------|-------|
| Package Updates | `ServerDetail.tsx`, package update API routes |
| Service Actions | `ServicePanel.tsx`, service restart API |
| Remediation | Action queue API routes |
| Alerts | Alert evaluation service |

## Fix Description

Implemented guards at both frontend and backend layers to prevent operations on inactive servers:

**Frontend:**
1. **ServerDetail.tsx**: Hide `PackageList` component when `server.is_inactive` is true
2. **ServicesPanel.tsx**: Accept `isInactive` prop, show "Agent Inactive" message and hide service list/actions

**Backend:**
1. **actions.py**: Reject action creation with 409 Conflict for inactive servers
2. **scheduler.py**: Skip inactive servers in `check_stale_servers` and `check_offline_reminders`

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/ServerDetail.tsx:615` | Conditional render PackageList only for active servers |
| `frontend/src/pages/ServerDetail.tsx:716` | Pass `isInactive` prop to ServicesPanel |
| `frontend/src/components/ServicesPanel.tsx:9-13` | Added `isInactive` prop to interface |
| `frontend/src/components/ServicesPanel.tsx:21` | Accept and destructure `isInactive` prop |
| `frontend/src/components/ServicesPanel.tsx:147-155` | Added inactive state message JSX |
| `frontend/src/components/ServicesPanel.tsx:157-162` | Conditional empty state (exclude inactive) |
| `frontend/src/components/ServicesPanel.tsx:180-193` | Conditional services list (exclude inactive) |
| `backend/src/homelab_cmd/api/routes/actions.py:206-214` | Reject actions for inactive servers |
| `backend/src/homelab_cmd/services/scheduler.py:60-67` | Skip inactive in stale server check |
| `backend/src/homelab_cmd/services/scheduler.py:124-129` | Skip inactive in offline reminders |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| test_action_on_inactive_server_returns_409 | Creating action on inactive server returns 409 | `tests/test_bg0011_inactive_server_actions.py` |
| test_action_on_inactive_server_error_mentions_agent_removed | Error message indicates agent removed | `tests/test_bg0011_inactive_server_actions.py` |
| test_apt_action_on_inactive_server_returns_409 | APT actions also rejected on inactive servers | `tests/test_bg0011_inactive_server_actions.py` |
| test_action_on_active_server_succeeds | Active server still allows action creation | `tests/test_bg0011_inactive_server_actions.py`, `tests/test_actions_api.py` |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (4 tests in test_bg0011_inactive_server_actions.py all pass)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** Claude
**Verification date:** 2026-01-22

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Epic | EP0007 | Agent Management |
| Story | US0065 | Server Inactive State |
| Story | US0052 | Trigger Package Updates |
| Story | US0022 | Service Restart Action |

## Notes

This is a gap in the EP0007 implementation. The inactive state was added to the data model but the business logic guards were not fully implemented across all operations.

**Operations to disable for inactive servers:**
- Package updates (apt upgrade)
- Service restarts
- Any remediation actions
- Alert generation
- Command execution

**Operations to keep for inactive servers:**
- View historical data
- View historical alerts (read-only)
- Delete server completely
- Re-activate server

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status: Open → In Progress |
| 2026-01-21 | Claude | Status: In Progress → Fixed |
| 2026-01-22 | Claude | Added 4 regression tests in tests/test_actions_api.py |
