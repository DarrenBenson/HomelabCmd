# PL0021: Service Entity and Expected Services Schema - Implementation Plan

> **Status:** Complete
> **Story:** [US0017: Service Entity and Expected Services Schema](../stories/US0017-service-schema.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Create database schema for service monitoring. This includes the ExpectedService table (which services to monitor per server) and the ServiceStatus table (historical status tracking). Services can be marked as critical to generate higher severity alerts.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | ExpectedService table exists | Table with server_id, service_name, is_critical, enabled |
| AC2 | ServiceStatus table exists | Table for historical status tracking |
| AC3 | Services link to servers | Foreign key relationship accessible |
| AC4 | Critical flag supported | is_critical boolean stored correctly |
| AC5 | Migration applies cleanly | Alembic upgrade succeeds on existing schema |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12
- **Framework:** FastAPI with SQLAlchemy 2.0
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling (not bare except)
- Use pathlib for file paths
- Logging instead of print

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| SQLAlchemy | /sqlalchemy/sqlalchemy | relationship cascade delete | back_populates, cascade="all, delete-orphan" |

### Existing Patterns

From codebase exploration:

1. **Model Location:** `backend/src/homelab_cmd/db/models/`
2. **Base Class:** `DeclarativeBase` from `homelab_cmd.db.base`
3. **Mixins:** `TimestampMixin` for created_at/updated_at
4. **FK Pattern:** `ForeignKey("servers.id", ondelete="CASCADE")` with `index=True`
5. **Relationships:** `relationship()` with `back_populates` and `cascade="all, delete-orphan"`
6. **Indices:** Defined in `__table_args__` tuple
7. **Migrations:** `migrations/versions/` with revision chain

Reference files:
- `backend/src/homelab_cmd/db/models/server.py` - Server model with relationships
- `backend/src/homelab_cmd/db/models/alert.py` - Alert model with indices
- `tests/test_database.py` - Test patterns for models

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Simple schema with no business logic. Create models and migration first, then verify with tests.

### Test Priority

1. Foreign key constraint validation
2. Unique constraint on (server_id, service_name)
3. Cascade delete behaviour

### Documentation Updates Required

- [ ] None required (schema-only story)

## Implementation Steps

### Phase 1: Create Service Models

**Goal:** Define SQLAlchemy models for ExpectedService and ServiceStatus

#### Step 1.1: Create service.py model file

- [ ] Create `backend/src/homelab_cmd/db/models/service.py`
- [ ] Define `ServiceStatusValue` enum (running, stopped, failed, unknown)
- [ ] Define `ExpectedService` model with all columns
- [ ] Define `ServiceStatus` model with all columns
- [ ] Add `__table_args__` for indices and constraints

**Files to modify:**
- `backend/src/homelab_cmd/db/models/service.py` - New file

**Model Structure:**

```python
# ExpectedService
- id: Integer, primary key, autoincrement
- server_id: String(100), FK to servers.id, CASCADE, index
- service_name: String(255), not null
- display_name: String(255), nullable
- is_critical: Boolean, default False
- enabled: Boolean, default True
- created_at: DateTime with timezone

# ServiceStatus
- id: Integer, primary key, autoincrement
- server_id: String(100), FK to servers.id, CASCADE
- service_name: String(255), not null
- status: String(20), not null (running/stopped/failed/unknown)
- pid: Integer, nullable
- memory_mb: Float, nullable
- cpu_percent: Float, nullable
- timestamp: DateTime with timezone, not null
```

#### Step 1.2: Update models registry

- [ ] Import ExpectedService, ServiceStatus, ServiceStatusValue in `__init__.py`
- [ ] Add to `__all__` list

**Files to modify:**
- `backend/src/homelab_cmd/db/models/__init__.py` - Add new exports

### Phase 2: Update Server Model

**Goal:** Add relationships from Server to service models

#### Step 2.1: Add expected_services relationship

- [ ] Add TYPE_CHECKING import for ExpectedService
- [ ] Add `expected_services` relationship to Server model

**Files to modify:**
- `backend/src/homelab_cmd/db/models/server.py` - Add relationship

**Considerations:**
- Use `lazy="select"` for expected_services (small collection per server)
- Include `cascade="all, delete-orphan"` for cleanup

### Phase 3: Create Alembic Migration

**Goal:** Create database migration for new tables

#### Step 3.1: Generate migration file

- [ ] Create `migrations/versions/b2c3d4e5f6g7_add_service_tables.py`
- [ ] Set revision to chain after `a1b2c3d4e5f6` (alerts migration)
- [ ] Create expected_services table with columns
- [ ] Add unique constraint on (server_id, service_name)
- [ ] Add index on server_id
- [ ] Create service_status table with columns
- [ ] Add composite indices

**Files to modify:**
- `migrations/versions/b2c3d4e5f6g7_add_service_tables.py` - New file

**Migration Operations:**
```python
# expected_services table
op.create_table(
    "expected_services",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("server_id", sa.String(100), sa.ForeignKey("servers.id", ondelete="CASCADE"), nullable=False),
    sa.Column("service_name", sa.String(255), nullable=False),
    sa.Column("display_name", sa.String(255), nullable=True),
    sa.Column("is_critical", sa.Boolean(), nullable=False, default=False),
    sa.Column("enabled", sa.Boolean(), nullable=False, default=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
)
op.create_index("idx_expected_services_server", "expected_services", ["server_id"])
op.create_unique_constraint("uq_server_service_name", "expected_services", ["server_id", "service_name"])

# service_status table
op.create_table(
    "service_status",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("server_id", sa.String(100), sa.ForeignKey("servers.id", ondelete="CASCADE"), nullable=False),
    sa.Column("service_name", sa.String(255), nullable=False),
    sa.Column("status", sa.String(20), nullable=False),
    sa.Column("pid", sa.Integer(), nullable=True),
    sa.Column("memory_mb", sa.Float(), nullable=True),
    sa.Column("cpu_percent", sa.Float(), nullable=True),
    sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
)
op.create_index("idx_service_status_server_time", "service_status", ["server_id", "timestamp"])
op.create_index("idx_service_status_service", "service_status", ["server_id", "service_name", "timestamp"])
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Create test file

- [ ] Create `tests/test_service_models.py`

**Files to modify:**
- `tests/test_service_models.py` - New file

#### Step 4.2: Write ExpectedService tests

- [ ] Test ExpectedService creation with all fields
- [ ] Test is_critical flag defaults to False
- [ ] Test enabled flag defaults to True
- [ ] Test server relationship is accessible
- [ ] Test unique constraint on (server_id, service_name)

#### Step 4.3: Write ServiceStatus tests

- [ ] Test ServiceStatus creation with all fields
- [ ] Test status values stored correctly
- [ ] Test pid, memory_mb, cpu_percent nullable fields

#### Step 4.4: Write constraint tests

- [ ] Test FK constraint prevents orphan records
- [ ] Test unique constraint raises IntegrityError on duplicate
- [ ] Test cascade delete removes services when server deleted

#### Step 4.5: Write index tests

- [ ] Test idx_expected_services_server exists
- [ ] Test idx_service_status_server_time exists
- [ ] Test idx_service_status_service exists

#### Step 4.6: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | PRAGMA table_info(expected_services) shows columns | Pending |
| AC2 | PRAGMA table_info(service_status) shows columns | Pending |
| AC3 | Query service.server returns Server object | Pending |
| AC4 | Insert with is_critical=True, retrieve, verify | Pending |
| AC5 | alembic upgrade head succeeds | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Server deleted | Cascade delete removes expected_services and service_status |
| Duplicate service name for server | Unique constraint raises IntegrityError |
| Invalid status value | Application validates before insert (enum in code) |
| Very long service name | String(255) accommodates systemd service names |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite ALTER TABLE limitations | Medium | Use batch mode in migration (already configured) |
| Migration revision conflict | Low | Manually verify revision chain |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001 | Story | Database schema exists - Done |
| a1b2c3d4e5f6 | Migration | Alerts migration must be applied |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration applies cleanly
- [ ] Ready for code review

## Notes

- ServiceStatusValue enum values match what agent will report: running, stopped, failed, unknown
- ExpectedService.display_name is optional (UI can show service_name if not set)
- No API endpoints in this story (covered by US0019)
