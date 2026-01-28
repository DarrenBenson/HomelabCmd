# PL0027: Extended Remediation Action Schema - Implementation Plan

> **Status:** Complete
> **Story:** [US0023: Extended Remediation Action Schema](../stories/US0023-remediation-action-schema.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** Python

## Overview

Extend the existing `RemediationAction` model and `ActionStatus` enum to support the full action lifecycle with approval workflow and execution tracking. This is a schema-only story - no new API endpoints.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Status lifecycle | Actions transition: pending → approved → executing → completed/failed |
| AC2 | Auto-approval | Normal servers (`is_paused=false`) auto-approve with `approved_by='auto'` |
| AC3 | Pending for maintenance | Maintenance servers (`is_paused=true`) start as pending |
| AC4 | Rejection terminal | Rejected actions cannot transition further |
| AC5 | Audit fields | approved_at/approved_by populated on approval |
| AC6 | Execution result | executed_at, completed_at, exit_code, stdout, stderr captured |
| AC7 | Alert link | Optional alert_id foreign key to alerts table |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** SQLAlchemy 2.0 with async
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

- Use `Mapped` type annotations for SQLAlchemy columns
- Use `str, Enum` base class for string enums
- Keep nullable fields optional with `Mapped[X | None]`
- Add indices for frequently queried columns

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| SQLAlchemy | `/sqlalchemy/sqlalchemy` | column addition with Alembic | `mapped_column`, `ForeignKey` |
| Alembic | `/sqlalchemy/alembic` | adding columns to existing table | `op.add_column`, `batch_alter_table` |

### Existing Patterns

From `backend/src/homelab_cmd/db/models/remediation.py`:
- `ActionStatus` enum currently only has `PENDING`
- `RemediationAction` model has basic fields from US0022
- Uses `DateTime(timezone=True)` for timestamp fields
- Uses `Text` for long string fields
- Foreign key with `ondelete='CASCADE'`

## Recommended Approach

**Strategy:** TDD
**Rationale:** Test cases TC149-TC151 already defined in TS0009. Schema extension is straightforward with clear acceptance criteria.

### Test Priority

1. ActionStatus enum contains all required values
2. RemediationAction model has all new fields
3. Migration applies cleanly with existing data

### Documentation Updates Required

- [ ] Update TS0009 automation status after tests pass
- [ ] Update US0023 status to Done

## Implementation Steps

### Phase 1: Extend ActionStatus Enum

**Goal:** Add all status values for the action lifecycle

#### Step 1.1: Add enum values

- [ ] Add `APPROVED = "approved"`
- [ ] Add `REJECTED = "rejected"`
- [ ] Add `EXECUTING = "executing"`
- [ ] Add `COMPLETED = "completed"`
- [ ] Add `FAILED = "failed"`
- [ ] Update docstring to remove "Note" about EP0004

**Files to modify:**
- `backend/src/homelab_cmd/db/models/remediation.py` - Extend ActionStatus enum

**Considerations:**
The status column is VARCHAR(20), which accommodates all values (longest is "completed" at 9 chars).

### Phase 2: Extend RemediationAction Model

**Goal:** Add approval, rejection, execution, and alert link fields

#### Step 2.1: Add alert link

- [ ] Add `alert_id` foreign key (nullable, references alerts.id)
- [ ] Add relationship to Alert model if needed

**Files to modify:**
- `backend/src/homelab_cmd/db/models/remediation.py` - Add alert_id column

#### Step 2.2: Add approval fields

- [ ] Add `approved_at: Mapped[datetime | None]`
- [ ] Add `approved_by: Mapped[str | None]` (String(50))
- [ ] Add `rejected_at: Mapped[datetime | None]`
- [ ] Add `rejected_by: Mapped[str | None]` (String(50))
- [ ] Add `rejection_reason: Mapped[str | None]` (Text)

**Files to modify:**
- `backend/src/homelab_cmd/db/models/remediation.py` - Add approval/rejection fields

#### Step 2.3: Add execution fields

- [ ] Add `executed_at: Mapped[datetime | None]`
- [ ] Add `completed_at: Mapped[datetime | None]`
- [ ] Add `exit_code: Mapped[int | None]`
- [ ] Add `stdout: Mapped[str | None]` (Text)
- [ ] Add `stderr: Mapped[str | None]` (Text)

**Files to modify:**
- `backend/src/homelab_cmd/db/models/remediation.py` - Add execution tracking fields

### Phase 3: Database Migration

**Goal:** Create Alembic migration to add columns to existing table

#### Step 3.1: Generate migration

- [ ] Run `alembic revision --autogenerate -m "extend_remediation_actions_schema"`
- [ ] Review generated migration
- [ ] Ensure all new columns are nullable (no default required for existing rows)
- [ ] Add alert_id foreign key constraint

**Files to create:**
- `migrations/versions/XXX_extend_remediation_actions_schema.py`

#### Step 3.2: Test migration

- [ ] Run `alembic upgrade head`
- [ ] Verify columns added
- [ ] Run `alembic downgrade -1` and `alembic upgrade head` to test rollback

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Unit Tests

- [ ] Test ActionStatus enum has all 6 values (TC149)
- [ ] Test RemediationAction model has all new fields (TC150)
- [ ] Test nullable fields accept None
- [ ] Test alert_id foreign key relationship (TC151)

**Files to create:**
- `tests/test_remediation_schema.py` - TC149, TC150, TC151 tests

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Test ActionStatus enum values | Pending |
| AC2 | Test default approved_by='auto' in US0024 | N/A (US0024 scope) |
| AC3 | Test default status='pending' in US0024 | N/A (US0024 scope) |
| AC4 | Test status field accepts 'rejected' | Pending |
| AC5 | Test approved_at/approved_by fields exist | Pending |
| AC6 | Test execution fields exist | Pending |
| AC7 | Test alert_id FK exists | Pending |

Note: AC2 and AC3 test the *business logic* of when to set values, which is US0024 scope. US0023 only ensures the *schema* supports these values.

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Existing pending actions in database | Migration adds nullable columns, existing data unaffected |
| alert_id references non-existent alert | FK constraint prevents invalid references |
| Very long stdout/stderr | Use Text type (unlimited length in SQLite) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration fails on existing data | Medium | All new columns nullable |
| Alert FK constraint issues | Low | FK is nullable, ondelete=SET NULL |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0022: Service Restart Action | Story | Done - created base table |
| US0010: Alert Schema | Story | Done - alerts table exists |
| Migration 0ff25fb760c4 | Schema | Current head revision |

## Open Questions

None - schema requirements are clear.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Migration tested with existing data
- [ ] Ready for code review

## Notes

This is a schema-only story. The business logic for when to set values (auto-approval, status transitions) is implemented in subsequent stories:
- US0024: Action Queue API - creates actions with appropriate initial status
- US0026: Maintenance Mode Approval - approval workflow
- US0027: Agent Command Execution - execution tracking
