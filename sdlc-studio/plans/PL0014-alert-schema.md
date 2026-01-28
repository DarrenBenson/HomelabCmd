# PL0014: Alert Entity and Database Schema - Implementation Plan

> **Status:** Complete
> **Story:** [US0010: Alert Entity and Database Schema](../stories/US0010-alert-schema.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Add the `alerts` table to store persistent alert history. This is distinct from the existing `alert_states` table which tracks deduplication/cooldown state. The `alerts` table stores the full alert lifecycle (open → acknowledged → resolved) for historical review and pattern analysis.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Alert table exists | Database has `alerts` table with all required columns |
| AC2 | Severity levels | Supports critical, high, medium, low severity values |
| AC3 | Status lifecycle | Supports open, acknowledged, resolved status values |
| AC4 | Server relationship | Alerts link to servers via foreign key with cascade delete |
| AC5 | Migration applies | Alembic migration runs cleanly on existing EP0001 schema |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with SQLAlchemy 2.0+
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use type hints throughout
- Use dataclasses/Pydantic for data structures
- Use enums for fixed values (severity, status)
- British English in comments/strings

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| SQLAlchemy | `/sqlalchemy/sqlalchemy` | "SQLAlchemy 2.0 model definition with enum columns" | Mapped, mapped_column, String for enum storage |
| Alembic | `/sqlalchemy/alembic` | "Creating migration with foreign key and indices" | op.create_table, op.create_index, batch_alter_table |

### Existing Patterns

**Model Pattern** (from `server.py`, `metrics.py`):
- Extend `Base` from `homelab_cmd.db.base`
- Use `TimestampMixin` for created_at/updated_at
- Use `Mapped[type]` with `mapped_column()` for columns
- String enums stored as `String(20)` columns (not SQLAlchemy Enum type)
- Foreign keys use `ForeignKey("table.column", ondelete="CASCADE")`
- Relationships defined with `relationship()` and `back_populates`

**Migration Pattern** (from `2e6e20f4bc94_initial_schema`):
- Use `op.create_table()` with `sa.Column()`
- Create indices with `batch_alter_table` for SQLite compatibility
- Include both `upgrade()` and `downgrade()` functions

**Existing AlertState Table** (for reference - different purpose):
- `alert_states` tracks current state for deduplication/cooldown
- New `alerts` table stores historical alert records
- Both tables coexist - AlertState is internal machinery, Alerts is user-facing history

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Database schema story with straightforward model definition. Write model and migration first, then validate with tests.

### Test Priority

1. Alert table creation via migration
2. Alert CRUD operations (insert, read, update)
3. Foreign key constraint validation (cascade delete)
4. Enum constraint validation (severity, status values)

### Documentation Updates Required

- [ ] Update `db/models/__init__.py` to export new Alert model
- [ ] TRD already documents Alert schema (§5 Data Architecture)

## Implementation Steps

### Phase 1: Create Alert Model

**Goal:** Define SQLAlchemy model for alerts table

#### Step 1.1: Create Alert enum types

- [ ] Define `AlertStatus` enum (open, acknowledged, resolved)
- [ ] Reuse existing `AlertSeverity` enum from alert_state.py
- [ ] Define `AlertType` enum (disk, memory, cpu, offline, service_down)

**Files to modify:**
- `backend/src/homelab_cmd/db/models/alert.py` - New file for Alert model

**Considerations:**
- AlertSeverity already exists in alert_state.py - import and reuse
- AlertStatus is new - define in alert.py
- AlertType maps to metric types but is stored as string for flexibility

#### Step 1.2: Define Alert model class

- [ ] Create Alert class extending TimestampMixin, Base
- [ ] Add all columns matching TRD schema:
  - `id` - Integer primary key (autoincrement)
  - `server_id` - String FK to servers.id
  - `alert_type` - String (disk, memory, cpu, offline)
  - `severity` - String (critical, high, medium, low)
  - `status` - String (open, acknowledged, resolved)
  - `title` - String
  - `message` - Text (nullable)
  - `threshold_value` - Float (nullable)
  - `actual_value` - Float (nullable)
  - `created_at` - DateTime (from mixin)
  - `acknowledged_at` - DateTime (nullable)
  - `resolved_at` - DateTime (nullable)
  - `auto_resolved` - Boolean (default False)
- [ ] Add relationship to Server model
- [ ] Add indices for common queries

**Files to modify:**
- `backend/src/homelab_cmd/db/models/alert.py` - New file

**Considerations:**
- Use Integer PK (not UUID) to match story schema and existing patterns
- Store enums as Strings for SQLite compatibility (matches existing pattern)
- Add indices on (server_id, status) and (severity, status) per story requirements

### Phase 2: Update Model Registry

**Goal:** Register Alert model with SQLAlchemy metadata

#### Step 2.1: Update models __init__.py

- [ ] Import Alert, AlertStatus, AlertType from alert.py
- [ ] Add to __all__ exports
- [ ] Update Server model to add alerts relationship (back_populates)

**Files to modify:**
- `backend/src/homelab_cmd/db/models/__init__.py` - Add imports/exports
- `backend/src/homelab_cmd/db/models/server.py` - Add alerts relationship

### Phase 3: Create Alembic Migration

**Goal:** Create migration script for alerts table

#### Step 3.1: Generate migration

- [ ] Create new migration file in `migrations/versions/`
- [ ] Define `upgrade()` with create_table and indices
- [ ] Define `downgrade()` with drop_table
- [ ] Set dependency on initial migration (`2e6e20f4bc94`)

**Files to modify:**
- `migrations/versions/xxxx_add_alerts_table.py` - New file

**Migration details:**
```python
# Table creation
op.create_table(
    "alerts",
    sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
    sa.Column("server_id", sa.String(100), nullable=False),
    sa.Column("alert_type", sa.String(20), nullable=False),
    sa.Column("severity", sa.String(20), nullable=False),
    sa.Column("status", sa.String(20), nullable=False, server_default="open"),
    sa.Column("title", sa.String(255), nullable=False),
    sa.Column("message", sa.Text(), nullable=True),
    sa.Column("threshold_value", sa.Float(), nullable=True),
    sa.Column("actual_value", sa.Float(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("auto_resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["server_id"], ["servers.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
)

# Indices
op.create_index("idx_alerts_server_status", "alerts", ["server_id", "status"])
op.create_index("idx_alerts_severity_status", "alerts", ["severity", "status"])
op.create_index("idx_alerts_created_at", "alerts", ["created_at"])
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Unit Tests

- [ ] Test Alert model can be instantiated with valid data
- [ ] Test severity enum constraint (invalid value rejected)
- [ ] Test status enum constraint (invalid value rejected)
- [ ] Test foreign key constraint (invalid server_id rejected)
- [ ] Test cascade delete (server deletion removes alerts)

**Files to modify:**
- `tests/test_alert_model.py` - New test file

#### Step 4.2: Migration Tests

- [ ] Test migration applies cleanly to fresh database
- [ ] Test migration applies to existing EP0001 schema
- [ ] Test downgrade removes table cleanly

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Query schema shows alerts table with all columns | Pending |
| AC2 | Insert alerts with all severity values | Pending |
| AC3 | Update alert status through lifecycle | Pending |
| AC4 | Query alert.server relationship | Pending |
| AC5 | Run alembic upgrade head on test DB | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Server deleted with active alerts | CASCADE delete removes alerts (FK constraint) |
| Invalid severity value | Database/model rejects (validation in model) |
| Invalid status value | Database/model rejects (validation in model) |
| Null server_id | Database rejects (NOT NULL constraint) |
| Very long title | Truncate or reject at API layer (255 char limit) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration fails on production DB | Blocks deployment | Test on copy of prod data first |
| AlertState naming confusion | Developer confusion | Clear docstrings explaining both models' purposes |
| Index performance | Slow queries | Indices defined per story requirements |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001: Database Schema | Story | Done - servers table exists |
| Alembic | Library | Already configured in project |
| SQLAlchemy 2.0+ | Library | Already installed |

## Open Questions

None - story requirements are clear.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices (type hints, British English)
- [ ] No linting errors
- [ ] Model registered in __init__.py
- [ ] Migration created and tested
- [ ] Ready for code review

## Notes

**Clarification on AlertState vs Alert:**
- `alert_states` (existing): Internal machinery for deduplication, cooldown tracking, consecutive breach counting. One row per server per metric type.
- `alerts` (new): User-facing alert history. Multiple rows per server tracking full alert lifecycle for historical analysis.

Both tables are needed and serve different purposes. The AlertingService will be updated in US0011 to create Alert records when new alerts are generated.
