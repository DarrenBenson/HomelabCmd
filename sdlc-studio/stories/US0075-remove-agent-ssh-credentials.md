# US0075: Remove Agent API SSH Credentials and Verification

> **Status:** Done
> **Plan:** [PL0075: Remove Agent SSH Credentials](../plans/PL0075-remove-agent-ssh-credentials.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-24
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** the remove-agent API to accept optional SSH username and password credentials with verification steps
**So that** I can reliably uninstall agents even when key-based SSH is unavailable and know whether removal succeeded

## Context

### Persona Reference

**Darren** - Maintains multiple servers with mixed SSH authentication methods and wants confidence that agents are fully removed when requested.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Agent removal currently relies on SSH keys and runs best-effort uninstall commands. When a server only permits password authentication or when uninstall steps fail, the API marks the server inactive without clear confirmation. Adding optional credentials and verification steps provides a reliable path for removal and clearer operator feedback.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Performance | Dashboard load < 2 seconds | Removal workflow must keep API response time bounded with SSH timeouts |
| Performance | Agent heartbeat success > 99.5% | Removal flow must not disrupt ongoing heartbeat processing |
| Architecture | LAN-only deployment | All SSH operations remain internal, no external services |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | API key authentication | Removal endpoint remains protected with API key checks |
| UX | Minimal daily maintenance | Warnings must be explicit and actionable for quick follow-up |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Optional SSH credentials accepted for removal

- **Given** I call `POST /api/v1/agents/{server_id}/remove` with `ssh_username` and `ssh_password`
- **When** the API attempts the uninstall
- **Then** the SSH connection uses the provided credentials for password authentication
- **And** existing key-based authentication remains available when credentials are not provided

### AC2: Credentials are not persisted or echoed

- **Given** I provide `ssh_username` and `ssh_password` in the remove-agent request
- **When** the request completes
- **Then** the credentials are not stored in the database or server configuration
- **And** the response body does not include the password or any derived secret

### AC3: Verification steps confirm uninstall outcome

- **Given** the uninstall command completes (success or failure)
- **When** the service performs verification checks (service status and file removal)
- **Then** the API response message indicates whether verification passed
- **And** a warning is included when verification fails or is inconclusive

### AC4: Bounded timeouts for SSH operations

- **Given** the remove-agent API attempts SSH uninstall and verification
- **When** SSH connectivity is slow or unavailable
- **Then** each SSH operation respects timeouts and returns a warning rather than hanging indefinitely

## Scope

### In Scope

- Add optional `ssh_username` and `ssh_password` to remove-agent request schema
- Pass optional credentials to SSH execution when removing agents
- Add verification checks after uninstall (service stopped, files removed)
- Return explicit warnings when verification fails or cannot be performed

### Out of Scope

- Storing passwords or supporting password rotation
- Multi-factor authentication flows
- UI changes for agent removal form (API-only enhancement)

## UI/UX Requirements

No UI updates are required for this API-only change. If UI fields are added later, follow `sdlc-studio/brand-guide.md` for form styling and warning presentation.

## Technical Notes

### API Contracts

**POST /api/v1/agents/{server_id}/remove**

Request (new optional fields):
```json
{
  "delete_completely": false,
  "ssh_username": "darren",
  "ssh_password": "example-password"
}
```

Response 200 (unchanged shape, message enriched):
```json
{
  "success": true,
  "server_id": "server-123",
  "message": "Agent removed, server marked inactive. Warning: verification failed for homelab-agent service status.",
  "error": null
}
```

Response 404 (server not found):
```json
{
  "detail": "Server 'server-123' not found"
}
```

Response 401 (invalid or missing API key):
```json
{
  "detail": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

### Data Requirements

- Credentials are used in-memory for SSH connections only
- No database fields or configuration updates are required for credentials
- Verification output should be logged for operator troubleshooting

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| `ssh_password` provided without `ssh_username` | Treat as invalid credentials, return warning and fall back to key-based auth |
| Invalid password authentication | Return warning that uninstall could not authenticate, server still marked inactive |
| SSH key succeeds while password fails | Continue with key-based uninstall, include warning about password auth failure |
| Uninstall command succeeds but service still active | Include verification warning indicating service is still running |
| Uninstall command succeeds but files remain | Include verification warning naming remaining paths |
| Hostname or IP missing | Return existing uninstall warning and skip verification attempts |
| SSH timeout during verification | Return warning noting verification timed out |
| Delete completely with uninstall failure | Delete server data but include warning that remote agent may remain |

## Test Scenarios

- [ ] Remove agent with valid SSH username and password succeeds
- [ ] Remove agent with missing credentials uses key-based auth
- [ ] Password auth fails and returns warning
- [ ] Password provided without username returns warning and falls back to keys
- [ ] Verification detects running service and returns warning
- [ ] Verification detects leftover files and returns warning
- [ ] Verification timeout returns warning without hanging
- [ ] Credentials are not persisted in database
- [ ] Response omits password values
- [ ] Delete completely still returns warning when uninstall fails

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0075-01 | Remove agent with SSH password auth | AC1 | Unit | Pass |
| TC-US0075-02 | Password without username warns | AC1 | Unit | Pass |
| TC-US0075-03 | Password auth fails, falls back to keys | AC1 | Unit | Pass |
| TC-US0075-04 | Verification: service still running | AC3 | Unit | Pass |
| TC-US0075-05 | Verification: files remain | AC3 | Unit | Pass |
| TC-US0075-06 | Verification timeout warning | AC4 | Unit | Pass |
| TC-US0075-07 | Response excludes credentials | AC2 | Unit | Pass |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0004](US0004-agent-script.md) | Service | Agent service name and uninstall paths | Done |
| [US0045](US0045-api-infrastructure.md) | API | Authenticated endpoint framework | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| AgentRemoveRequest | [US0002](US0002-server-registration-api.md) | Optional `ssh_username`, `ssh_password` |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| POST /api/v1/agents/{server_id}/remove | [US0002](US0002-server-registration-api.md) | Extend request to accept credentials |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| SSH access to target server | Infrastructure | Required |

## Estimation

**Story Points:** 3

**Complexity:** Medium - API schema update, SSH auth fallback, verification checks

## Open Questions

None.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 10/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language (avoid: "handles errors", "returns data", "works correctly")
- [x] Open Questions: 0/0 resolved (critical must be resolved)
- [x] Given/When/Then uses concrete values, not placeholders
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met (API stories)
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented (not just happy path)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-24 | Claude | Initial story creation |
| 2026-01-24 | Claude | Ready for implementation; added error response details |
| 2026-01-26 | Claude | Verified implementation complete, added 7 tests, marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
