# BG0009: Agent Install Endpoint Returns 500 - Missing external_url Setting

> **Status:** Closed
> **Severity:** High
> **Priority:** P1
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The POST `/api/v1/agents/install` endpoint returns a 500 Internal Server Error because the `agent_deploy.py` service references `self.settings.external_url`, but this attribute does not exist in the `Settings` class.

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md)
- **Story:** [US0062: Agent Installation API](../stories/US0062-agent-installation-api.md)
- **Component:** Backend - Agent Deployment Service

## Environment

- **Version:** 1.0.0
- **Platform:** Docker/Linux
- **Browser:** N/A (API error)

## Reproduction Steps

1. Navigate to Network Discovery page
2. Run a network scan to discover devices
3. Click "Install Agent" on a discovered device with SSH authentication success
4. Submit the agent installation form
5. Observe 500 error returned

## Expected Behaviour

The agent should be installed on the target device, or a meaningful error message should be returned if installation fails.

## Actual Behaviour

Server returns HTTP 500 Internal Server Error with the following traceback:

```
AttributeError: 'Settings' object has no attribute 'external_url'
```

Error occurs at `agent_deploy.py:242`:
```python
hub_url = self.settings.external_url or f"http://{self.settings.host}:{self.settings.port}"
```

## Screenshots/Evidence

Browser console error:
```
api/v1/agents/install:1 Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

Backend logs:
```
File "/usr/local/lib/python3.12/site-packages/homelab_cmd/services/agent_deploy.py", line 242, in install_agent
    hub_url = self.settings.external_url or f"http://{self.settings.host}:{self.settings.port}"
AttributeError: 'Settings' object has no attribute 'external_url'
```

## Root Cause Analysis

The `external_url` setting was referenced in `agent_deploy.py` but never added to the `Settings` class in `config.py`. This is a configuration oversight from the EP0007 implementation.

**Missing configuration:**
- `external_url: str | None` field in `Settings` class
- Corresponding `HOMELAB_CMD_EXTERNAL_URL` environment variable support

## Fix Description

Added the missing `external_url` field to the `Settings` class in `config.py`. The field:
- Is typed as `str | None` with default value `None`
- Can be set via the `HOMELAB_CMD_EXTERNAL_URL` environment variable
- When `None`, the existing fallback logic in `agent_deploy.py` uses `http://{host}:{port}`

### Files Modified

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/config.py:33` | Added `external_url: str \| None = None` field to Settings class |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| test_settings_has_external_url_attribute | Verifies Settings has external_url attribute | tests/test_settings.py |
| test_external_url_defaults_to_none | Verifies external_url defaults to None | tests/test_settings.py |
| test_external_url_from_env | Verifies HOMELAB_CMD_EXTERNAL_URL env var works | tests/test_settings.py |

## Verification

> *To be filled when verifying*

- [ ] Fix verified in development
- [ ] Regression tests pass
- [ ] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** -
**Verification date:** -

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Epic | EP0007 | Agent Management |
| Story | US0062 | Agent Installation API |

## Notes

The `external_url` setting is intended for deployments where the hub is behind a reverse proxy or has a different external address than its internal binding. When `None`, it falls back to `http://{host}:{port}`.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status: Open → In Progress |
| 2026-01-21 | Claude | Status: In Progress → Fixed, added regression tests |
