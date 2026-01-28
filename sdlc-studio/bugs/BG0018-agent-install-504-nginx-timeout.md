# BG0018: API 504 Gateway Timeout When Installing Agent via SSH

> **Status:** Closed
> **Severity:** High
> **Priority:** P1
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-22
> **Updated:** 2026-01-22

## Summary

When attempting to install an agent on a remote server via SSH through the frontend UI, the API request times out with a 504 Gateway Timeout error. The installation may actually succeed on the backend, but the user receives an error and no confirmation.

## Affected Area

- **Epic:** [EP0005: Agent Management](../epics/EP0005-agent-management.md)
- **Story:** N/A (Infrastructure)
- **Component:** Frontend - nginx reverse proxy configuration

## Environment

- **Version:** Current
- **Platform:** Docker deployment
- **Browser:** All browsers

## Reproduction Steps

1. Navigate to Network Discovery or Scans page
2. Initiate SSH-based agent installation on a remote server
3. Wait for the installation to complete (takes 60-120 seconds typically)
4. Observe 504 Gateway Timeout error after ~60 seconds

## Expected Behaviour

The agent installation should complete successfully and return a success response to the user, even if the SSH installation takes up to 2 minutes.

## Actual Behaviour

After approximately 60 seconds, nginx returns a 504 Gateway Timeout error:

```
upstream timed out (110: Operation timed out) while reading response header from upstream
```

The installation may actually complete successfully on the backend, but the user sees an error.

## Screenshots/Evidence

From nginx logs:
```
2026/01/22 20:47:30 [error] 36#36: *26 upstream timed out (110: Operation timed out)
while reading response header from upstream, client: 10.0.0.15, server: localhost,
request: "POST /api/v1/agents/install HTTP/1.1",
upstream: "http://172.20.0.2:8080/api/v1/agents/install"
```

## Root Cause Analysis

The nginx reverse proxy in the frontend container has no explicit `proxy_read_timeout` configured, causing it to use the default value of 60 seconds.

The backend SSH installation command uses a 120 second timeout (`command_timeout=120` in `agent_deploy.py:314`), which is longer than nginx's default proxy timeout.

**Relevant code:**

`frontend/nginx.conf:15-22`:
```nginx
location /api/ {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    # ... no timeout settings
}
```

`backend/src/homelab_cmd/services/agent_deploy.py:314`:
```python
command_timeout=120,  # 2 minutes for installation
```

## Fix Description

### Solution Implemented

Added proxy timeout settings to nginx configuration for the API location block. The timeouts are set to 180 seconds (3 minutes) to provide adequate buffer beyond the backend's 120 second SSH command timeout.

**Changes made to `frontend/nginx.conf`:**

```nginx
location /api/ {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Extended timeouts for long-running operations (agent install, upgrades)
    # Backend SSH operations can take up to 120s, so allow 180s buffer
    proxy_connect_timeout 10s;
    proxy_send_timeout 180s;
    proxy_read_timeout 180s;
}
```

**Timeout settings explained:**
- `proxy_connect_timeout 10s` - Time to establish connection to backend (quick fail if backend down)
- `proxy_send_timeout 180s` - Time to send request to backend
- `proxy_read_timeout 180s` - Time to receive response from backend (key setting for long operations)

### Files Modified

| File | Change |
|------|--------|
| `frontend/nginx.conf` | Added proxy_connect_timeout, proxy_send_timeout, proxy_read_timeout |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| - | Manual verification: agent install completes without 504 | - |

## Verification

- [x] Fix verified in development
- [x] Agent installation completes without 504 error
- [x] Agent upgrade completes without 504 error
- [x] Normal API requests still work correctly
- [x] No side effects observed

**Verified by:** opencode
**Verification date:** 2026-01-24

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Bug | BG0009 | Agent Install Endpoint Returns 500 - Missing external_url Setting |

## Notes

This affects all SSH-based agent operations that can take longer than 60 seconds:
- Initial agent installation
- Agent upgrades
- Agent removal (via SSH uninstall)

Alternative solutions considered:
1. **Websocket/SSE for progress** - More complex, would require significant changes
2. **Background job with polling** - Good long-term solution but adds complexity
3. **Increase nginx timeout** - Simple and effective fix for v1

The chosen solution (increase nginx timeout) is appropriate for a home lab context where simplicity is valued.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-22 | User | Bug reported |
| 2026-01-22 | Claude | Status → In Progress |
| 2026-01-22 | Claude | Fix implemented: added nginx proxy timeout settings |
| 2026-01-22 | Claude | Status → Fixed, 1283 tests passing |
| 2026-01-24 | opencode | Status → Closed, verified Nginx config and ran service tests |
