# BG0015: Discovery Shows Install Agent Button for Servers with Existing Agent

> **Status:** Closed
> **Severity:** Medium
> **Priority:** P2
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-22
> **Updated:** 2026-01-22

## Summary

The Network Discovery page shows the "Install Agent" button for devices that already have an agent installed and actively reporting to the hub. This creates confusion and could lead to reinstallation attempts on already-monitored servers.

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md)
- **Story:** [US0063: Agent Install via SSH](../stories/US0063-agent-install-via-ssh.md)
- **Component:** NetworkDiscovery, AgentInstallModal

## Environment

- **Version:** Development
- **Platform:** Web (React frontend)
- **Browser:** All

## Reproduction Steps

1. Install an agent on a server (e.g., 10.0.0.115)
2. Verify agent is online and sending heartbeats
3. Navigate to Dashboard
4. Click "Discover" to run network discovery
5. Observe the discovered device list
6. Note that the server with active agent (10.0.0.115) still shows "Install Agent" button

## Expected Behaviour

Servers that already have an agent installed and registered with the hub should:
- NOT show the "Install Agent" button
- Show a different indicator (e.g., "Agent Installed" badge, or link to server detail page)
- Optionally show "View Server" or "Manage" link instead

## Actual Behaviour

All discovered devices with SSH access show the "Install Agent" button, regardless of whether an agent is already installed and reporting.

## Screenshots/Evidence

Screenshot shows 10.0.0.115 (studypi400.local.lan) with "Install Agent" button despite having an active agent.

## Root Cause Analysis

> *Filled when investigating*

The NetworkDiscovery component does not cross-reference discovered devices against the list of registered servers. The discovery result only checks SSH reachability, not existing agent status.

**Likely fix locations:**
- `frontend/src/components/NetworkDiscovery.tsx` - needs to check against servers list
- May need to fetch servers list and match by IP address

## Fix Description

Fixed in two parts:

1. **Backend**: Updated `check_is_monitored()` in `discovery.py` to check both `ip_address` field AND server ID pattern (e.g., "10-0-0-115" derived from IP "10.0.0.115") since agents register with IP-based IDs but may not have `ip_address` field populated.

2. **Frontend**: Changed "Monitored" badge to a "View Server" link that navigates directly to the server detail page.

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/services/discovery.py:154-181` | Enhanced `check_is_monitored()` to match IP-based server IDs |
| `frontend/src/components/NetworkDiscovery.tsx:26-28` | Added `ExternalLink` icon and `Link` from router |
| `frontend/src/components/NetworkDiscovery.tsx:306-315` | Changed "Monitored" badge to "View Server" link |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| - | Manual verification - discovery shows View Server for existing agents | - |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (1283 backend tests pass)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** Claude
**Verification date:** 2026-01-22

### Verification Note

Backend `check_is_monitored()` enhanced to check both IP address and IP-based server ID patterns. Frontend shows "View Server" link instead of "Monitored" badge for discovered devices with existing agents.

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0063 | Agent Install via SSH |
| Epic | EP0007 | Agent Management |

## Notes

- Consider also checking for servers that were "removed" (inactive) - those might want a "Reinstall" option instead
- IP matching may need to handle both IP and hostname variations

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | User | Bug reported |
