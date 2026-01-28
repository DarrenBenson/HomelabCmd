# US0001: Database Schema and Migrations

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a persistent database storing server and metrics data
**So that** monitoring data survives container restarts and supports historical analysis

## Context

### Persona Reference

**Darren** - Technical professional operating a homelab with 11+ servers. Needs reliable data persistence for historical trend analysis and capacity planning.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This is the foundational story for EP0001. All subsequent stories depend on having a properly structured database. The schema must support current MVP features while being extensible for future epics (alerting, services, remediation).

## Acceptance Criteria

### AC1: Database file creation

- **Given** the hub container starts with an empty data volume
- **When** the application initialises
- **Then** a SQLite database file is created at `/app/data/homelab.db`

### AC2: Server entity exists

- **Given** the database is initialised
- **When** querying the schema
- **Then** a `servers` table exists with columns: id, hostname, display_name, ip_address, status, os_info, tdp_watts, last_seen, created_at, updated_at

### AC3: Metrics entity exists

- **Given** the database is initialised
- **When** querying the schema
- **Then** a `metrics` table exists with columns: id, server_id, timestamp, cpu_percent, memory_percent, disk_percent, disk_total_gb, disk_used_gb, network_rx_bytes, network_tx_bytes, load_1m, load_5m, load_15m, uptime_seconds

### AC4: Alembic migrations work

- **Given** the database schema needs to change
- **When** running `alembic upgrade head`
- **Then** migrations apply cleanly without data loss

### AC5: Data persists across restarts

- **Given** server and metrics data exists in the database
- **When** the hub container restarts
- **Then** all data is preserved

## Scope

### In Scope

- SQLite database creation and connection
- Alembic migration setup
- Server entity (table + SQLAlchemy model)
- Metrics entity (table + SQLAlchemy model)
- Proper indices for common queries (server_id, timestamp)
- Foreign key relationships

### Out of Scope

- Alert entity (EP0002)
- Service entity (EP0003)
- RemediationAction entity (EP0004)
- Config entity (deferred to settings story)
- Scan entity (EP0006)

## Technical Notes

### API Contracts

N/A - this is a database-only story.

### Data Requirements

**Server Table:**
```sql
CREATE TABLE servers (
    id TEXT PRIMARY KEY,           -- e.g., "omv-mediaserver"
    hostname TEXT NOT NULL,
    display_name TEXT,
    ip_address TEXT,
    status TEXT DEFAULT 'unknown', -- online, offline, unknown
    os_distribution TEXT,
    os_version TEXT,
    kernel_version TEXT,
    architecture TEXT,
    tdp_watts INTEGER,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Metrics Table:**
```sql
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(id),
    timestamp TIMESTAMP NOT NULL,
    cpu_percent REAL,
    memory_percent REAL,
    memory_total_mb INTEGER,
    memory_used_mb INTEGER,
    disk_percent REAL,
    disk_total_gb REAL,
    disk_used_gb REAL,
    network_rx_bytes INTEGER,
    network_tx_bytes INTEGER,
    load_1m REAL,
    load_5m REAL,
    load_15m REAL,
    uptime_seconds INTEGER
);

CREATE INDEX idx_metrics_server_timestamp ON metrics(server_id, timestamp);
```

**TRD Reference:** [§5 Data Architecture](../trd.md#5-data-architecture)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Database file is corrupted | Application logs error and exits; manual recovery required |
| Volume mount missing | Application logs clear error about data directory |
| Migration conflicts | Alembic reports conflict; manual resolution |
| Disk full | Database write fails with clear error logged |

## Test Scenarios

- [ ] Database file created on first startup
- [ ] Server can be inserted and retrieved
- [ ] Metrics can be inserted and queried by server_id
- [ ] Migrations apply to empty database
- [ ] Migrations apply to database with existing data
- [ ] Foreign key constraint prevents orphan metrics
- [ ] Index improves query performance (verify with EXPLAIN)

## Definition of Done


**Story-specific additions:**

- [ ] SQLAlchemy models match TRD schema definitions
- [ ] Alembic initial migration created
- [ ] Database created in correct volume location

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | First story in epic |

## Estimation

**Story Points:** 3

**Complexity:** Low - standard SQLAlchemy/Alembic setup

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-18 | Claude | Status changed to Planned, implementation plan PL0002 created |
| 2026-01-18 | Claude | Status changed to Done, all acceptance criteria met |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
