# US0024: Action Queue API

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Updated:** 2026-01-19

## User Story

**As a** Darren (Homelab Operator)
**I want** API endpoints to queue and list remediation actions
**So that** I can trigger actions from the dashboard and see their status

## Context

### Persona Reference

**Darren** - Needs to trigger actions from dashboard, view pending actions, and see action history.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This story provides the core API endpoints for remediation actions. Actions are created with status based on server mode: normal servers get immediate approval (`APPROVED`), while paused servers create pending actions requiring approval.

## Acceptance Criteria

### AC1: List actions with filtering

- **Given** remediation actions exist
- **When** GET `/api/v1/actions` is called with optional filters
- **Then** matching actions are returned with pagination

### AC2: Get action by ID

- **Given** an action with id=42
- **When** GET `/api/v1/actions/42` is called
- **Then** the full action details are returned

### AC3: Create action on normal server

- **Given** a valid action payload for a server with `is_paused=false`
- **When** POST `/api/v1/actions` is called
- **Then** a new action is created with status "approved" and `approved_by="auto"`

### AC4: Create action on paused server

- **Given** a valid action payload for a server with `is_paused=true`
- **When** POST `/api/v1/actions` is called
- **Then** a new action is created with status "pending"

### AC5: Command whitelist enforced

- **Given** an action with non-whitelisted command
- **When** POST `/api/v1/actions` is called
- **Then** 403 Forbidden is returned

### AC6: Pending actions for server

- **Given** server "omv-mediaserver" has pending actions
- **When** GET `/api/v1/servers/omv-mediaserver/actions?status=pending`
- **Then** only pending actions for that server are returned

## Scope

### In Scope

- GET /api/v1/actions (list with filters)
- GET /api/v1/actions/{action_id} (detail)
- POST /api/v1/actions (create with maintenance mode check)
- GET /api/v1/servers/{server_id}/actions (server-specific)
- Command whitelist validation
- Pagination for list endpoints

### Out of Scope

- Approval/rejection (US0026)
- Execution and result reporting (US0025)
- Action history view (US0031)

## Technical Notes

### API Contracts

**GET /api/v1/actions**
```json
Query params:
  - server_id: Filter by server
  - status: pending|approved|executing|completed|failed|rejected
  - action_type: restart_service|clear_logs|custom
  - limit: Pagination limit (default 50)
  - offset: Pagination offset (default 0)

Response 200:
{
  "actions": [
    {
      "id": 42,
      "server_id": "omv-mediaserver",
      "action_type": "restart_service",
      "status": "approved",
      "service_name": "plex",
      "command": "systemctl restart plex",
      "alert_id": 15,
      "created_at": "2026-01-18T10:30:00Z",
      "created_by": "dashboard",
      "approved_at": "2026-01-18T10:30:00Z",
      "approved_by": "auto"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**GET /api/v1/actions/{action_id}**
```json
Response 200:
{
  "id": 42,
  "server_id": "omv-mediaserver",
  "action_type": "restart_service",
  "status": "completed",
  "service_name": "plex",
  "command": "systemctl restart plex",
  "alert_id": 15,
  "created_at": "2026-01-18T10:30:00Z",
  "created_by": "dashboard",
  "approved_at": "2026-01-18T10:30:00Z",
  "approved_by": "auto",
  "executed_at": "2026-01-18T10:31:30Z",
  "completed_at": "2026-01-18T10:31:32Z",
  "exit_code": 0,
  "stdout": "",
  "stderr": ""
}
```

**POST /api/v1/actions**
```json
Request:
{
  "server_id": "omv-mediaserver",
  "action_type": "restart_service",
  "service_name": "plex",
  "alert_id": 15  // Optional
}

Response 201 (normal server):
{
  "id": 43,
  "server_id": "omv-mediaserver",
  "action_type": "restart_service",
  "status": "approved",
  "service_name": "plex",
  "command": "systemctl restart plex",
  "created_at": "2026-01-18T10:35:00Z",
  "created_by": "dashboard",
  "approved_at": "2026-01-18T10:35:00Z",
  "approved_by": "auto"
}

Response 201 (paused server):
{
  "id": 43,
  "server_id": "omv-mediaserver",
  "action_type": "restart_service",
  "status": "pending",
  "service_name": "plex",
  "command": "systemctl restart plex",
  "created_at": "2026-01-18T10:35:00Z",
  "created_by": "dashboard",
  "approved_at": null,
  "approved_by": null
}
```

**TRD Reference:** [§4 API Contracts - Actions](../trd.md#4-api-contracts)

### Action Creation Logic

```python
async def create_action(action_data: ActionCreate) -> Action:
    server = await get_server(action_data.server_id)
    if not server:
        raise HTTPException(404, "Server not found")

    # Build command from whitelist
    command = build_whitelisted_command(action_data)
    if not command:
        raise HTTPException(403, "Command not in whitelist")

    action = Action(
        server_id=action_data.server_id,
        action_type=action_data.action_type,
        service_name=action_data.service_name,
        command=command,
        alert_id=action_data.alert_id,
        created_by="dashboard",
    )

    # Check server maintenance mode
    if server.is_paused:
        action.status = ActionStatus.PENDING
    else:
        action.status = ActionStatus.APPROVED
        action.approved_at = datetime.now(UTC)
        action.approved_by = "auto"

    await save_action(action)
    return action
```

### Data Requirements

**Command Whitelist:**
```python
ALLOWED_COMMANDS = {
    'restart_service': 'systemctl restart {service_name}',
    'clear_logs': 'journalctl --vacuum-time=7d',
}
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | 404 Not Found |
| Invalid action_type | 422 Unprocessable Entity |
| Command not in whitelist | 403 Forbidden |
| Duplicate pending action | 409 Conflict (from US0022 logic) |

## Test Scenarios

- [ ] List actions returns all actions
- [ ] Filter by status works
- [ ] Filter by server works
- [ ] Pagination works
- [ ] Get action by ID returns full details
- [ ] Create action on normal server → status=approved
- [ ] Create action on paused server → status=pending
- [ ] Create action fails for non-whitelisted command
- [ ] 404 for non-existent action

## Definition of Done


**Story-specific additions:**

- [ ] OpenAPI spec updated with action endpoints
- [ ] Command whitelist configurable

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0023: Remediation Action Schema | Story | Review |
| US0029: Server Maintenance Mode | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - CRUD with maintenance mode logic

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Simplified for maintenance mode model; reduced from 5 to 3 points |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
