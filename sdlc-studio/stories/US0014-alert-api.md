# US0014: Alert API Endpoints

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** API endpoints to list, view, acknowledge, and resolve alerts
**So that** the dashboard can display and manage alerts

## Context

### Persona Reference

**Darren** - Needs to acknowledge alerts to indicate he's aware, and resolve them when addressed.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The Alert API provides CRUD-like operations for the dashboard. Users can list alerts with filters, view details, acknowledge alerts, and manually resolve them. Alert creation happens internally (via threshold evaluation), not via API.

## Acceptance Criteria

### AC1: List alerts

- **Given** multiple alerts exist
- **When** GET `/api/v1/alerts` is called
- **Then** response contains array of alerts

### AC2: Filter alerts by status

- **Given** open and resolved alerts exist
- **When** GET `/api/v1/alerts?status=open` is called
- **Then** only open alerts are returned

### AC3: Filter alerts by severity

- **Given** alerts of various severities exist
- **When** GET `/api/v1/alerts?severity=critical` is called
- **Then** only critical alerts are returned

### AC4: Acknowledge alert

- **Given** an open alert exists
- **When** POST `/api/v1/alerts/{id}/acknowledge` is called
- **Then** alert status changes to "acknowledged"

### AC5: Resolve alert manually

- **Given** an acknowledged alert exists
- **When** POST `/api/v1/alerts/{id}/resolve` is called
- **Then** alert status changes to "resolved"

### AC6: Get alert details

- **Given** an alert with id 42 exists
- **When** GET `/api/v1/alerts/42` is called
- **Then** full alert details are returned

## Scope

### In Scope

- GET /api/v1/alerts (list with filters)
- GET /api/v1/alerts/{alert_id} (detail)
- POST /api/v1/alerts/{alert_id}/acknowledge
- POST /api/v1/alerts/{alert_id}/resolve
- Filtering by status, severity, server_id
- Pagination (limit/offset)
- API authentication

### Out of Scope

- POST /api/v1/alerts (create - done internally)
- DELETE /api/v1/alerts (alerts are never deleted, only resolved)
- Bulk operations
- Alert configuration API (thresholds)

## Technical Notes

### API Contracts

**GET /api/v1/alerts**

Query parameters:
- `status`: open, acknowledged, resolved (optional)
- `severity`: critical, high, medium, low (optional)
- `server_id`: filter by server (optional)
- `limit`: max results (default 50)
- `offset`: pagination offset (default 0)

```json
Response 200:
{
  "alerts": [
    {
      "id": 42,
      "server_id": "omv-mediaserver",
      "server_name": "Media Server",
      "alert_type": "disk",
      "severity": "critical",
      "status": "open",
      "title": "Critical: Disk usage at 92%",
      "message": null,
      "threshold_value": 90,
      "actual_value": 92,
      "created_at": "2026-01-18T10:30:00Z",
      "acknowledged_at": null,
      "resolved_at": null,
      "auto_resolved": false
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

**GET /api/v1/alerts/{alert_id}**

```json
Response 200:
{
  "id": 42,
  "server_id": "omv-mediaserver",
  "server_name": "Media Server",
  "alert_type": "disk",
  "severity": "critical",
  "status": "open",
  "title": "Critical: Disk usage at 92%",
  "message": null,
  "threshold_value": 90,
  "actual_value": 92,
  "created_at": "2026-01-18T10:30:00Z",
  "acknowledged_at": null,
  "resolved_at": null,
  "auto_resolved": false
}
```

**POST /api/v1/alerts/{alert_id}/acknowledge**

```json
Response 200:
{
  "id": 42,
  "status": "acknowledged",
  "acknowledged_at": "2026-01-18T10:35:00Z"
}
```

**POST /api/v1/alerts/{alert_id}/resolve**

```json
Response 200:
{
  "id": 42,
  "status": "resolved",
  "resolved_at": "2026-01-18T11:00:00Z",
  "auto_resolved": false
}
```

**Error Response:**
```json
Response 404:
{
  "detail": "Alert not found",
  "error_code": "ALERT_NOT_FOUND"
}
```

**TRD Reference:** [§4 API Contracts - Alerts & Notifications](../trd.md#4-api-contracts)

### Data Requirements

- Include server display_name for convenience
- Sort by created_at descending (newest first)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Alert not found | 404 Not Found |
| Acknowledge already acknowledged | 200 OK (idempotent) |
| Acknowledge resolved alert | 400 Bad Request |
| Resolve already resolved | 200 OK (idempotent) |
| Resolve open alert (skip ack) | 200 OK (allowed) |
| Invalid filter value | 422 Unprocessable Entity |

## Test Scenarios

- [ ] List alerts returns all alerts
- [ ] Filter by status works
- [ ] Filter by severity works
- [ ] Filter by server_id works
- [ ] Combined filters work
- [ ] Pagination works correctly
- [ ] Get alert detail returns full info
- [ ] Acknowledge changes status
- [ ] Acknowledge sets acknowledged_at
- [ ] Resolve changes status
- [ ] Resolve sets resolved_at
- [ ] 404 for non-existent alert
- [ ] Authentication required

## Definition of Done


**Story-specific additions:**

- [ ] OpenAPI spec includes all alert endpoints
- [ ] Swagger UI shows alert operations

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0010: Alert Schema | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - standard CRUD with filters

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
