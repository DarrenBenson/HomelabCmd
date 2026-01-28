# BG0016: Agent Removal Silently Skips SSH Uninstall When No Hostname Available

> **Status:** Closed
> **Severity:** Medium
> **Priority:** P2
> **Reporter:** User
> **Assignee:** Unassigned
> **Created:** 2026-01-22
> **Updated:** 2026-01-22

## Summary

When removing an agent, if the server has no `ip_address` AND no usable `hostname`, the SSH uninstall step is silently skipped. The user sees "Agent removed" success message but is NOT warned that the agent was not actually uninstalled from the remote machine.

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md)
- **Story:** [US0064: Agent Removal API](../stories/US0064-agent-removal-api.md)
- **Component:** Backend - AgentDeployService.remove_agent()

## Environment

- **Version:** Development
- **Platform:** All
- **Browser:** N/A (backend issue)

## Reproduction Steps

1. Have a server registered without a usable hostname or IP address
2. Click "Remove Agent" on the server
3. Confirm removal
4. Observe success message without any warning

## Expected Behaviour

If SSH uninstall cannot be attempted (no hostname available), the user should be warned:
- "Could not uninstall agent: no hostname or IP address available for SSH connection. The agent may still be running on the remote server."

## Actual Behaviour

The removal succeeds silently with message "Agent removed, server marked inactive" - no indication that the actual uninstall was skipped.

## Screenshots/Evidence

N/A

## Root Cause Analysis

In `agent_deploy.py:445-449`:

```python
hostname = server.ip_address or server.hostname
uninstall_warning: str | None = None

if hostname:  # If hostname is None, SSH uninstall is SKIPPED
    # ... SSH uninstall attempt ...
```

When `hostname` is falsy (None or empty string), the entire SSH block is skipped and `uninstall_warning` remains `None`, so no warning is appended to the success message.

## Fix Description

Added an `else` branch to set a warning when hostname is unavailable. The warning is included in the response message so users know the agent may still be running on the remote server.

```python
hostname = server.ip_address or server.hostname

if hostname:
    # ... existing SSH uninstall code ...
else:
    # BG0016: Warn user when SSH uninstall cannot be attempted
    uninstall_warning = (
        "Could not uninstall agent: no hostname or IP address available for SSH. "
        "The agent may still be running on the remote server."
    )
    logger.warning(
        "Cannot uninstall agent from server %s: no hostname or IP available",
        server_id,
    )
```

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/services/agent_deploy.py` | Added else branch with warning when hostname unavailable |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| test_remove_agent_no_hostname_warns_user | Verifies warning when marking inactive with no hostname | `tests/test_agent_deploy_service.py` |
| test_remove_agent_no_hostname_delete_completely_warns | Verifies warning when deleting with no hostname | `tests/test_agent_deploy_service.py` |

## Verification

- [x] Fix verified in development
- [x] Regression tests pass (30 tests pass in test_agent_deploy_service.py including `test_remove_agent_no_hostname_warns_user`)
- [x] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** Claude
**Verification date:** 2026-01-22

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Bug | BG0012 | Agent Removal Does Not Actually Uninstall Agent |
| Story | US0064 | Agent Removal API |

## Notes

This is a sub-issue of BG0012. Even if SSH uninstall is working correctly, this edge case would still cause silent failures.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | User | Bug reported |
| 2026-01-22 | Claude | Fixed: Added else branch with warning, added 2 regression tests |
