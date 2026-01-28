# US0019: Expected Services Configuration API

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to configure expected services for each server via API
**So that** the hub knows which services to monitor and alert on

## Context

### Persona Reference

**Darren** - Needs to specify which services each server should run. Media server has Plex/Sonarr/Radarr; Pi-hole servers have pihole-FTL.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Expected services define what the hub should monitor per server. When a heartbeat reports a service as stopped, the hub compares against expected services to determine if an alert should be generated. Services can be marked as critical (high severity alert) or non-critical (medium severity).

## Acceptance Criteria

### AC1: List expected services

- **Given** services are configured for "omv-mediaserver"
- **When** GET `/api/v1/servers/omv-mediaserver/services` is called
- **Then** response contains array of expected services

### AC2: Add expected service

- **Given** a server exists
- **When** POST `/api/v1/servers/{server_id}/services` with service data
- **Then** the expected service is created

### AC3: Update expected service

- **Given** an expected service exists
- **When** PUT `/api/v1/servers/{server_id}/services/{service_name}` with updated data
- **Then** the service configuration is updated

### AC4: Delete expected service

- **Given** an expected service exists
- **When** DELETE `/api/v1/servers/{server_id}/services/{service_name}`
- **Then** the expected service is removed

### AC5: Critical flag configurable

- **Given** adding a service
- **When** setting is_critical to true
- **Then** the service is stored as critical

## Scope

### In Scope

- GET /api/v1/servers/{server_id}/services (list)
- POST /api/v1/servers/{server_id}/services (create)
- PUT /api/v1/servers/{server_id}/services/{service_name} (update)
- DELETE /api/v1/servers/{server_id}/services/{service_name} (delete)
- Include current status in list response (if available)

### Out of Scope

- Bulk service configuration
- Service templates per server type
- Auto-discovery of services
- UI for service configuration (future story)

## Technical Notes

### API Contracts

**GET /api/v1/servers/{server_id}/services**
```json
Response 200:
{
  "services": [
    {
      "service_name": "plex",
      "display_name": "Plex Media Server",
      "is_critical": true,
      "enabled": true,
      "current_status": {
        "status": "running",
        "pid": 12345,
        "memory_mb": 512.5,
        "last_seen": "2026-01-18T10:30:00Z"
      }
    },
    {
      "service_name": "sonarr",
      "display_name": "Sonarr",
      "is_critical": false,
      "enabled": true,
      "current_status": {
        "status": "stopped",
        "pid": null,
        "memory_mb": null,
        "last_seen": "2026-01-18T10:30:00Z"
      }
    }
  ],
  "total": 2
}
```

**POST /api/v1/servers/{server_id}/services**
```json
Request:
{
  "service_name": "jellyfin",
  "display_name": "Jellyfin Media Server",
  "is_critical": true
}

Response 201:
{
  "service_name": "jellyfin",
  "display_name": "Jellyfin Media Server",
  "is_critical": true,
  "enabled": true
}
```

**PUT /api/v1/servers/{server_id}/services/{service_name}**
```json
Request:
{
  "is_critical": false,
  "enabled": false
}

Response 200:
{
  "service_name": "jellyfin",
  "display_name": "Jellyfin Media Server",
  "is_critical": false,
  "enabled": false
}
```

**TRD Reference:** [§4 API Contracts - Services](../trd.md#4-api-contracts)

### Data Requirements

- service_name must be valid systemd service name
- display_name is optional, defaults to service_name
- is_critical defaults to false
- enabled defaults to true

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | 404 Not Found |
| Service already exists | 409 Conflict |
| Service not found (update/delete) | 404 Not Found |
| Invalid service name | 422 Unprocessable Entity |
| Disable service | Enabled = false, alerts suppressed |

## Test Scenarios

- [x] List services returns all expected services
- [x] List includes current status if available
- [x] Create service works with minimal fields
- [x] Create service works with all fields
- [x] Duplicate service name returns 409
- [x] Update changes only specified fields
- [x] Update critical flag works
- [x] Delete removes service
- [x] 404 for non-existent server
- [x] 404 for non-existent service

## Definition of Done


**Story-specific additions:**

- [x] OpenAPI spec includes service endpoints

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0002: Server Registration API | Story | Draft |
| US0017: Service Schema | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - standard CRUD

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-19 | Claude | Implemented per PL0023. 25 tests passing. |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
