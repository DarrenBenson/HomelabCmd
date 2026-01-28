# US0029: Server Maintenance Mode

> **Status:** Done
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Owner:** Darren
> **Created:** 2026-01-19
> **Story Points:** 2
> **Updated:** 2026-01-19
> **Plan:** [PL0032](../plans/PL0032-maintenance-mode-frontend.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** to put servers into maintenance mode
**So that** all actions on that server require manual approval before execution

## Context

### Persona Reference

**Darren** - Wants immediate remediation by default, but needs the ability to pause a server for maintenance when extra caution is required.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

By default, servers are in normal mode where actions execute immediately without approval. When performing maintenance or investigating issues, the operator can pause a server to require approval for all actions. This provides a safety mechanism without adding complexity to normal operations.

## Acceptance Criteria

### AC1: Server has is_paused flag

- **Given** the server model
- **When** viewing server details
- **Then** an `is_paused` boolean field exists (default: false)

### AC2: Pause server endpoint

- **Given** a server in normal mode
- **When** PUT `/api/v1/servers/{id}/pause` is called
- **Then** the server's `is_paused` is set to true

### AC3: Unpause server endpoint

- **Given** a server in maintenance mode
- **When** PUT `/api/v1/servers/{id}/unpause` is called
- **Then** the server's `is_paused` is set to false

### AC4: Maintenance mode visible in UI

- **Given** a paused server
- **When** viewing the dashboard
- **Then** the server card shows a maintenance mode indicator

### AC5: Server detail shows mode

- **Given** a server in any mode
- **When** viewing the server detail page
- **Then** the current mode (normal/maintenance) is displayed with toggle option

## Scope

### In Scope

- `is_paused` field on Server model
- PUT /api/v1/servers/{id}/pause endpoint
- PUT /api/v1/servers/{id}/unpause endpoint
- Server list API returns is_paused field
- Dashboard indicator for paused servers
- Server detail toggle for maintenance mode

### Out of Scope

- Scheduled maintenance windows
- Automatic pause based on conditions
- Bulk pause/unpause operations
- Maintenance mode notifications

## Technical Notes

### API Contracts

**PUT /api/v1/servers/{server_id}/pause**
```json
Request: {}  // Empty body

Response 200:
{
  "server_id": "omv-mediaserver",
  "is_paused": true,
  "paused_at": "2026-01-19T10:30:00Z"
}
```

**PUT /api/v1/servers/{server_id}/unpause**
```json
Request: {}  // Empty body

Response 200:
{
  "server_id": "omv-mediaserver",
  "is_paused": false,
  "paused_at": null
}
```

**GET /api/v1/servers (extended response)**
```json
{
  "servers": [
    {
      "server_id": "omv-mediaserver",
      "display_name": "OMV MediaServer",
      "status": "online",
      "is_paused": true,
      ...
    }
  ]
}
```

**TRD Reference:** [§4 API Contracts - Servers](../trd.md#4-api-contracts)

### Data Requirements

**Server Table (extended):**
```sql
ALTER TABLE servers ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE servers ADD COLUMN paused_at TIMESTAMP;
```

**SQLAlchemy Model:**
```python
is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
paused_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | 404 Not Found |
| Pause already-paused server | Idempotent - returns 200 with current state |
| Unpause normal server | Idempotent - returns 200 with current state |
| Server goes offline while paused | Remains paused; actions queue but need approval |

## Test Scenarios

- [ ] Pause endpoint sets is_paused to true
- [ ] Unpause endpoint sets is_paused to false
- [ ] Pause is idempotent
- [ ] Unpause is idempotent
- [ ] Server list includes is_paused field
- [ ] Server detail includes is_paused field
- [ ] 404 for non-existent server
- [ ] paused_at timestamp recorded on pause
- [ ] paused_at cleared on unpause

## Definition of Done


**Story-specific additions:**

- [ ] Migration adds is_paused column
- [ ] Dashboard shows maintenance indicator

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0002: Server Registration API | Story | Done |
| US0023: Remediation Action Schema | Story | Done |

## Implementation Status

| Component | AC | Status | Notes |
|-----------|-----|--------|-------|
| Backend: is_paused field | AC1 | Done | `backend/src/homelab_cmd/db/models/server.py` |
| Backend: Pause endpoint | AC2 | Done | `PUT /api/v1/servers/{id}/pause` |
| Backend: Unpause endpoint | AC3 | Done | `PUT /api/v1/servers/{id}/unpause` |
| Frontend: Dashboard indicator | AC4 | Done | PL0032 |
| Frontend: Server detail toggle | AC5 | Done | PL0032 |

## Estimation

**Story Points:** 2

**Complexity:** Low - simple flag with API endpoints

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial story creation (replaces US0029 Auto-Approve Configuration) |
| 2026-01-19 | Claude | Backend API complete (AC1-AC3); Frontend plan created (PL0032) for AC4-AC5 |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
