# PL0201: Command Execution Audit Trail - Implementation Plan

> **Status:** Done
> **Story:** [US0155: Command Execution Audit Trail](../stories/US0155-command-execution-audit-trail.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-30
> **Language:** Python

## Overview

Implement a dedicated command audit logging system that captures all command executions with full context for security compliance and incident investigation. This creates an immutable audit trail separate from the existing `remediation_actions` table, optimised for querying and retention.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Audit Log Creation | Every command execution creates an audit log entry |
| AC2 | Audit Log API | GET `/api/v1/audit/commands` with filtering and pagination |
| AC3 | Immutability | Audit log entries cannot be modified or deleted |
| AC4 | Retention Policy | 90-day retention with configurable cleanup |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI
- **Test Framework:** pytest

### Relevant Best Practices
- Use Pydantic v2 models with Field descriptions
- Type hints on all functions
- Async database operations via SQLAlchemy
- Comprehensive error handling with HTTPException

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Query parameters, pagination |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Append-only patterns |
| Alembic | /sqlalchemy/alembic | Migration for new table |

### Existing Patterns

**Current audit data location:** `remediation_actions` table stores command results but is designed for action workflow, not audit querying.

**SSH Executor integration point:** `backend/src/homelab_cmd/api/routes/commands.py:execute_command()` - audit log creation should be called here after successful SSH execution.

**Existing table patterns:** See `backend/src/homelab_cmd/db/models/` for SQLAlchemy model conventions.

---

## Recommended Approach

**Strategy:** TDD
**Rationale:** API story with clear Given/When/Then AC, 7 edge cases, well-defined database schema. Tests can be written first to define expected behaviour.

### Test Priority
1. Audit log creation on command execution (integration)
2. API filtering and pagination (unit + integration)
3. Immutability enforcement (unit)

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create CommandAuditLog SQLAlchemy model | `db/models/audit.py` | - | [ ] |
| 2 | Create Alembic migration for command_audit_log table | `migrations/versions/` | 1 | [ ] |
| 3 | Create audit log service with create function | `services/audit_service.py` | 1 | [ ] |
| 4 | Create Pydantic schemas for audit API | `api/schemas/audit.py` | - | [ ] |
| 5 | Create GET /api/v1/audit/commands endpoint | `api/routes/audit.py` | 3, 4 | [ ] |
| 6 | Add CSV export endpoint | `api/routes/audit.py` | 5 | [ ] |
| 7 | Integrate audit creation into commands.py | `api/routes/commands.py` | 3 | [ ] |
| 8 | Add retention cleanup scheduler job | `services/scheduler.py` | 3 | [ ] |
| 9 | Write unit tests for audit service | `tests/test_audit_service.py` | 3 | [ ] |
| 10 | Write API integration tests | `tests/test_audit_api.py` | 5, 6 | [ ] |
| 11 | Update main.py to include audit router | `main.py` | 5 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 4 | None (can start immediately) |
| B | 2, 3 | Task 1 complete |
| C | 5, 6, 7 | Tasks 3, 4 complete |
| D | 8, 9, 10, 11 | Tasks 5, 7 complete |

---

## Implementation Phases

### Phase 1: Database Schema
**Goal:** Create the command_audit_log table

- [ ] Create `CommandAuditLog` model in `db/models/audit.py`
- [ ] Add model to `db/models/__init__.py` exports
- [ ] Create Alembic migration
- [ ] Run migration to create table

**Files:**
- `backend/src/homelab_cmd/db/models/audit.py` - New file
- `migrations/versions/xxxx_add_command_audit_log.py` - New migration

**Schema:**
```python
class CommandAuditLog(Base):
    __tablename__ = "command_audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID
    server_id: Mapped[str] = mapped_column(String(255), ForeignKey("servers.id"), nullable=False)
    command: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout: Mapped[str | None] = mapped_column(Text, nullable=True)  # Truncated to 10KB
    stderr: Mapped[str | None] = mapped_column(Text, nullable=True)  # Truncated to 10KB
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    executed_by: Mapped[str] = mapped_column(String(255), nullable=False, default="dashboard")

    # Indexes for efficient querying
    __table_args__ = (
        Index("idx_audit_server_date", "server_id", "executed_at"),
        Index("idx_audit_type_date", "action_type", "executed_at"),
        Index("idx_audit_date", "executed_at"),
    )
```

### Phase 2: Audit Service
**Goal:** Create service layer for audit log operations

- [ ] Create `audit_service.py` with `create_audit_log()` function
- [ ] Add output truncation helper (10KB limit)
- [ ] Add list/filter function for API use

**Files:**
- `backend/src/homelab_cmd/services/audit_service.py` - New file

### Phase 3: API Endpoints
**Goal:** Create audit log query API

- [ ] Create Pydantic schemas: `CommandAuditEntry`, `CommandAuditListResponse`
- [ ] Create `GET /api/v1/audit/commands` with filters
- [ ] Create `GET /api/v1/audit/commands/export` for CSV
- [ ] Register router in main.py

**Files:**
- `backend/src/homelab_cmd/api/schemas/audit.py` - New file
- `backend/src/homelab_cmd/api/routes/audit.py` - New file
- `backend/src/homelab_cmd/main.py` - Add router

### Phase 4: Integration
**Goal:** Connect audit logging to command execution

- [ ] Call `create_audit_log()` from `execute_command()` in commands.py
- [ ] Handle audit creation failures gracefully (log error, don't fail command)

**Files:**
- `backend/src/homelab_cmd/api/routes/commands.py` - Modify

### Phase 5: Retention & Testing
**Goal:** Add retention cleanup and comprehensive tests

- [ ] Add scheduler job to prune entries older than 90 days
- [ ] Write unit tests for audit service
- [ ] Write integration tests for API endpoints

**Files:**
- `backend/src/homelab_cmd/services/scheduler.py` - Modify
- `tests/test_audit_service.py` - New file
- `tests/test_audit_api.py` - New file

### Phase 6: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Integration test: execute command, verify audit entry created | `tests/test_audit_api.py` | Pending |
| AC2 | API tests: filter by server_id, action_type, date range, pagination | `tests/test_audit_api.py` | Pending |
| AC3 | Unit test: verify no update/delete methods exposed | `tests/test_audit_service.py` | Pending |
| AC4 | Unit test: verify retention cleanup logic | `tests/test_audit_service.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | stdout > 10KB | Truncate with `... [truncated]` marker in service layer | Phase 2 |
| 2 | stderr > 10KB | Truncate with `... [truncated]` marker in service layer | Phase 2 |
| 3 | Command execution fails | Create audit entry with error exit_code, stderr contains error | Phase 4 |
| 4 | Database write failure | Log error but don't fail command execution (fire-and-forget) | Phase 4 |
| 5 | Invalid date range filter | Return 400 with validation message (Pydantic handles) | Phase 3 |
| 6 | Page beyond results | Return empty results array with correct total count | Phase 3 |
| 7 | No filters applied | Return most recent 100 entries (default page_size) | Phase 3 |

**Coverage:** 7/7 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| High volume of audit entries | Database growth, query performance | Indexes on common query patterns, 90-day retention |
| Audit creation slows command execution | User experience degradation | Fire-and-forget pattern, don't block on audit write |
| Migration on production database | Downtime | Migration only adds table, no schema changes to existing |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration created and tested
- [ ] API documented in OpenAPI

---

## Notes

**Immutability approach:** The service layer will only expose `create_audit_log()` and read functions. No update or delete functions will be implemented. The SQLAlchemy model will not have cascade delete relationships.

**Integration with existing code:** The `execute_command()` function in `commands.py` already has the result data needed. Adding the audit call is a single function call after the SSH execution completes.

**CSV Export:** Use StreamingResponse for efficient export of large datasets without loading all into memory.
