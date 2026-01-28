# US0017: Service Entity and Expected Services Schema

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** expected services stored per server with critical flag
**So that** I can configure which services to monitor and their importance

## Context

### Persona Reference

**Darren** - Runs critical services like Plex, Pi-hole, Nextcloud. Needs to distinguish between critical services (Plex down = family unhappy) and non-critical services.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Each server has a list of expected services to monitor. Services can be marked as critical (alerts are high severity) or non-critical (alerts are medium severity). Service status history is tracked for trend analysis.

## Acceptance Criteria

### AC1: ExpectedService table exists

- **Given** the database is initialised
- **When** querying the schema
- **Then** an `expected_services` table exists with server_id, service_name, is_critical, enabled

### AC2: ServiceStatus table exists

- **Given** the database is initialised
- **When** querying the schema
- **Then** a `service_status` table exists for historical tracking

### AC3: Services link to servers

- **Given** an expected service for "omv-mediaserver"
- **When** querying the service
- **Then** the server relationship is accessible

### AC4: Critical flag supported

- **Given** an expected service is created
- **When** setting is_critical to true
- **Then** the flag is stored correctly

### AC5: Migration applies cleanly

- **Given** the EP0002 schema exists
- **When** running `alembic upgrade head`
- **Then** the service tables are created without errors

## Scope

### In Scope

- ExpectedService table (server_id, service_name, is_critical, enabled)
- ServiceStatus table (server_id, service_name, status, timestamp, pid, memory_mb, cpu_percent)
- SQLAlchemy models
- Alembic migration
- Indices for common queries

### Out of Scope

- Service configuration API (US0019)
- Service status collection by agent (US0018)
- Docker container tracking

## Technical Notes

### Data Requirements

**ExpectedService Table:**
```sql
CREATE TABLE expected_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    display_name TEXT,
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, service_name)
);

CREATE INDEX idx_expected_services_server ON expected_services(server_id);
```

**ServiceStatus Table:**
```sql
CREATE TABLE service_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'running', 'stopped', 'failed', 'unknown'
    pid INTEGER,
    memory_mb REAL,
    cpu_percent REAL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_status_server_time ON service_status(server_id, timestamp);
CREATE INDEX idx_service_status_service ON service_status(server_id, service_name, timestamp);
```

**TRD Reference:** [§5 Data Architecture](../trd.md#5-data-architecture)

### API Contracts

N/A - database-only story.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server deleted | Expected services cascade delete |
| Duplicate service name for server | Unique constraint prevents |
| Invalid status value | Application validates before insert |

## Test Scenarios

- [ ] ExpectedService table created on migration
- [ ] ServiceStatus table created on migration
- [ ] Expected service can be inserted with all fields
- [ ] Service links to server correctly
- [ ] Critical flag works correctly
- [ ] Unique constraint on server_id + service_name
- [ ] Cascade delete works when server removed

## Definition of Done


**Story-specific additions:**

- [ ] Alembic migration created
- [ ] SQLAlchemy models match TRD schema

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0001: Database Schema | Story | Draft |

## Estimation

**Story Points:** 2

**Complexity:** Low - standard table addition

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
