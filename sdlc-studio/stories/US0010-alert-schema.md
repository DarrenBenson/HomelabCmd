# US0010: Alert Entity and Database Schema

> **Status:** Done
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** alerts to be stored persistently in the database
**So that** I can view alert history and track patterns over time

## Context

### Persona Reference

**Darren** - Needs historical alert data for weekly reviews and understanding recurring issues. Wants to correlate alerts with incidents.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This foundational story adds the Alert entity to the database. Alerts track threshold breaches and server offline events. Each alert has a lifecycle (open → acknowledged → resolved) and links to the triggering server.

## Acceptance Criteria

### AC1: Alert table exists

- **Given** the database is initialised
- **When** querying the schema
- **Then** an `alerts` table exists with all required columns

### AC2: Alert severity levels supported

- **Given** an alert is created
- **When** setting the severity
- **Then** values can be: critical, high, medium, low

### AC3: Alert status lifecycle supported

- **Given** an alert is created
- **When** updating status
- **Then** values can be: open, acknowledged, resolved

### AC4: Alerts link to servers

- **Given** an alert exists for server "omv-mediaserver"
- **When** querying the alert
- **Then** the server relationship is accessible

### AC5: Migration applies cleanly

- **Given** the EP0001 schema exists
- **When** running `alembic upgrade head`
- **Then** the alerts table is created without errors

## Scope

### In Scope

- Alert table creation
- Alert SQLAlchemy model
- Alembic migration
- Foreign key to servers table
- Indices for common queries

### Out of Scope

- Alert creation logic (US0011)
- Alert API endpoints (US0014)
- Alert configuration/thresholds table

## Technical Notes

### Data Requirements

**Alert Table:**
```sql
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL REFERENCES servers(id),
    alert_type TEXT NOT NULL,          -- 'disk', 'memory', 'cpu', 'offline'
    severity TEXT NOT NULL,            -- 'critical', 'high', 'medium', 'low'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'acknowledged', 'resolved'
    title TEXT NOT NULL,
    message TEXT,
    threshold_value REAL,              -- The threshold that was breached
    actual_value REAL,                 -- The value that triggered the alert
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    auto_resolved BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_server_status ON alerts(server_id, status);
CREATE INDEX idx_alerts_severity ON alerts(severity, status);
CREATE INDEX idx_alerts_created ON alerts(created_at);
```

**TRD Reference:** [§5 Data Architecture](../trd.md#5-data-architecture)

### API Contracts

N/A - database-only story.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server deleted with active alerts | Alerts cascade delete (foreign key) |
| Invalid severity value | Database constraint rejects |
| Invalid status value | Database constraint rejects |

## Test Scenarios

- [ ] Alert table created on migration
- [ ] Alert can be inserted with all required fields
- [ ] Alert links to server correctly
- [ ] Severity enum constraint works
- [ ] Status enum constraint works
- [ ] Index improves query performance
- [ ] Cascade delete works when server removed

## Definition of Done


**Story-specific additions:**

- [ ] Alembic migration created
- [ ] SQLAlchemy model matches TRD schema

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
