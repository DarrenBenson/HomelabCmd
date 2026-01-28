# US0002: Server Registration API

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to register servers via API and manage their configuration
**So that** the hub knows which servers to expect and can display meaningful information about each

## Context

### Persona Reference

**Darren** - Operates 11 servers with specific names and configurations. Wants to pre-register servers with TDP values for cost tracking and meaningful display names.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Servers can be registered in two ways: (1) pre-registered via API/UI before agent deployment, or (2) auto-registered when agent sends first heartbeat. This story covers the API endpoints for server CRUD operations.

## Acceptance Criteria

### AC1: List all servers

- **Given** servers exist in the database
- **When** GET `/api/v1/servers` is called
- **Then** response contains array of all servers with current status

### AC2: Register new server

- **Given** valid server data (hostname, optional: display_name, ip_address, tdp_watts)
- **When** POST `/api/v1/servers` is called
- **Then** server is created with status "unknown" and server data returned

### AC3: Get server details

- **Given** a server exists with id "omv-mediaserver"
- **When** GET `/api/v1/servers/omv-mediaserver` is called
- **Then** full server details returned including latest metrics and OS info

### AC4: Update server configuration

- **Given** a server exists with id "omv-mediaserver"
- **When** PUT `/api/v1/servers/omv-mediaserver` is called with updated fields
- **Then** server record updated and new values returned

### AC5: Delete server

- **Given** a server exists with id "omv-testserver"
- **When** DELETE `/api/v1/servers/omv-testserver` is called
- **Then** server and associated metrics are removed

### AC6: API authentication required

- **Given** no API key header is provided
- **When** any server endpoint is called
- **Then** 401 Unauthorized response returned

## Scope

### In Scope

- GET /api/v1/servers (list)
- GET /api/v1/servers/{server_id} (detail)
- POST /api/v1/servers (create)
- PUT /api/v1/servers/{server_id} (update)
- DELETE /api/v1/servers/{server_id} (delete)
- API key authentication middleware
- Request/response validation via Pydantic
- OpenAPI documentation

### Out of Scope

- Server registration UI (separate story)
- Auto-registration via heartbeat (US0003)
- Service configuration (EP0003)
- Bulk operations

## UI/UX Requirements

N/A - API-only story.

## Technical Notes

### API Contracts

**GET /api/v1/servers**
```json
Response 200:
{
  "servers": [
    {
      "id": "omv-mediaserver",
      "hostname": "omv-mediaserver",
      "display_name": "Media Server",
      "ip_address": "192.168.1.10",
      "status": "online",
      "tdp_watts": 65,
      "last_seen": "2026-01-18T10:30:00Z",
      "latest_metrics": {
        "cpu_percent": 23.5,
        "memory_percent": 67.2,
        "disk_percent": 45.0
      }
    }
  ],
  "total": 11
}
```

**POST /api/v1/servers**
```json
Request:
{
  "id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "display_name": "Media Server",
  "ip_address": "192.168.1.10",
  "tdp_watts": 65
}

Response 201:
{
  "id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "display_name": "Media Server",
  "ip_address": "192.168.1.10",
  "status": "unknown",
  "tdp_watts": 65,
  "created_at": "2026-01-18T10:00:00Z"
}
```

**Error Response Format:**
```json
{
  "detail": "Server 'omv-mediaserver' already exists",
  "error_code": "SERVER_EXISTS"
}
```

**TRD Reference:** [§4 API Contracts - Server Management](../trd.md#4-api-contracts)

### Data Requirements

- Server ID must be unique, URL-safe (alphanumeric + hyphens)
- Hostname required; display_name optional (defaults to hostname)
- TDP watts optional (for cost tracking in EP0005)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Duplicate server ID | 409 Conflict with error message |
| Invalid server ID format | 422 Unprocessable Entity |
| Server not found | 404 Not Found |
| Invalid API key | 401 Unauthorized |
| Missing required field | 422 with field-specific error |

## Test Scenarios

- [ ] List servers returns empty array when none exist
- [ ] List servers returns all servers with latest metrics
- [ ] Create server with minimal fields succeeds
- [ ] Create server with all fields succeeds
- [ ] Create duplicate server returns 409
- [ ] Get existing server returns full details
- [ ] Get non-existent server returns 404
- [ ] Update server modifies only specified fields
- [ ] Delete server removes server and cascades to metrics
- [ ] All endpoints reject requests without valid API key

## Definition of Done


**Story-specific additions:**

- [ ] OpenAPI spec auto-generated and accurate
- [ ] Swagger UI accessible at /api/docs
- [ ] All endpoints documented in TRD

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - standard CRUD but with auth and validation

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | Status changed to Planned, implementation plan PL0003 created |
| 2026-01-18 | Claude | Status changed to Done, all acceptance criteria met |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
