# US0155: Command Execution Audit Trail

> **Status:** Draft
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Story Points:** 3

## User Story

**As a** security auditor
**I want** complete audit trail of all command executions
**So that** I can review what was executed and when

## Context

### Background

For security compliance and incident investigation, all command executions must be logged immutably with full context including who executed what, when, where, and what the result was.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Security | Complete audit trail | AC1: every execution logged |
| PRD | Compliance | Data retention | AC4: 90-day retention |
| US0153 | Dependency | Command execution API | Integrates with |

---

## Acceptance Criteria

### AC1: Audit Log Creation
- **Given** any command execution (success or failure)
- **When** the command completes
- **Then** an audit log entry is created with machine_id, command, action_type, exit_code, stdout (truncated), stderr (truncated), duration, executed_at, executed_by

### AC2: Audit Log API
- **Given** an audit log query
- **When** GET `/api/v1/audit/commands` is called
- **Then** filtered, paginated results are returned

### AC3: Immutability
- **Given** the audit log table
- **When** any modification is attempted
- **Then** updates and deletes are prevented (append-only)

### AC4: Retention Policy
- **Given** audit log entries older than 90 days
- **When** the retention cleanup runs
- **Then** old entries are archived or purged (configurable)

---

## Scope

### In Scope
- `command_audit_log` database table
- Audit log creation function
- `GET /api/v1/audit/commands` endpoint with filtering
- Filter by: machine_id, action_type, date range, exit_code (success/failure)
- Pagination (100 entries per page)
- CSV export endpoint
- 90-day retention policy (configurable)

### Out of Scope
- Real-time audit log streaming
- Audit log archival to external storage
- Audit log encryption at rest

---

## Technical Notes

### Database Table

```sql
CREATE TABLE command_audit_log (
    id UUID PRIMARY KEY,
    machine_id UUID NOT NULL REFERENCES machine(id),
    command TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    exit_code INTEGER,
    stdout TEXT,  -- Truncated to 10KB
    stderr TEXT,  -- Truncated to 10KB
    duration_ms INTEGER,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    executed_by VARCHAR(255) DEFAULT 'dashboard'
);

CREATE INDEX idx_command_audit_machine ON command_audit_log(machine_id, executed_at DESC);
CREATE INDEX idx_command_audit_type ON command_audit_log(action_type, executed_at DESC);
CREATE INDEX idx_command_audit_date ON command_audit_log(executed_at DESC);
```

### Audit Log Creation

```python
def create_audit_log(
    machine_id: UUID,
    command: str,
    action_type: str,
    result: CommandResult,
    executed_by: str = "dashboard"
) -> None:
    """Create immutable audit log entry."""
    entry = CommandAuditLog(
        id=uuid4(),
        machine_id=machine_id,
        command=command,
        action_type=action_type,
        exit_code=result.exit_code,
        stdout=truncate_output(result.stdout, max_size=10240),
        stderr=truncate_output(result.stderr, max_size=10240),
        duration_ms=result.duration_ms,
        executed_at=datetime.utcnow(),
        executed_by=executed_by
    )
    db.add(entry)
    db.commit()
```

### API Endpoint

```python
@router.get("/audit/commands")
async def list_command_audit(
    machine_id: Optional[UUID] = None,
    action_type: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    success_only: Optional[bool] = None,
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db),
    _: str = Depends(get_api_key)
) -> CommandAuditListResponse:
    query = db.query(CommandAuditLog)

    if machine_id:
        query = query.filter(CommandAuditLog.machine_id == machine_id)
    if action_type:
        query = query.filter(CommandAuditLog.action_type == action_type)
    if from_date:
        query = query.filter(CommandAuditLog.executed_at >= from_date)
    if to_date:
        query = query.filter(CommandAuditLog.executed_at <= to_date)
    if success_only is True:
        query = query.filter(CommandAuditLog.exit_code == 0)
    elif success_only is False:
        query = query.filter(CommandAuditLog.exit_code != 0)

    total = query.count()
    entries = query.order_by(CommandAuditLog.executed_at.desc()) \
                   .offset((page - 1) * page_size) \
                   .limit(page_size) \
                   .all()

    return CommandAuditListResponse(
        entries=entries,
        total=total,
        page=page,
        page_size=page_size
    )
```

### Audit Log UI (Reference)

```
┌────────────────────────────────────────────────────────┐
│ Command Audit Log                  [Export CSV]        │
├────────────────────────────────────────────────────────┤
│ Filters:                                               │
│ Machine: [All ▼]  Type: [All ▼]  Status: [All ▼]      │
│                                                        │
│ Time           Machine      Command           Result  │
│ ──────────────────────────────────────────────────────│
│ 2026-01-25     HOMESERVER   systemctl restart   ✓ 0   │
│ 20:15:32                    nginx                      │
│                                                        │
│ 2026-01-25     MEDIASERVER  apt-get upgrade -y   ✓ 0   │
│ 19:45:10                                               │
│                                                        │
│ 2026-01-25     BACKUPSERVER systemctl restart   ✗ 1   │
│ 18:30:22                    mysql                      │
│                                                        │
│                       Page 1 of 45        [Next →]    │
└────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| stdout > 10KB | Truncated with `... [truncated]` marker |
| stderr > 10KB | Truncated with `... [truncated]` marker |
| Command execution fails | Audit entry created with error exit_code |
| Database write failure | Log error, but don't fail command execution |
| Invalid date range filter | 400 error with validation message |
| Page beyond results | Empty results array |
| No filters applied | Return most recent 100 entries |

---

## Test Scenarios

- [ ] Audit entry created for successful command
- [ ] Audit entry created for failed command
- [ ] stdout/stderr truncated at 10KB
- [ ] Filter by machine_id returns correct entries
- [ ] Filter by action_type returns correct entries
- [ ] Filter by date range returns correct entries
- [ ] Filter by success/failure works
- [ ] Pagination returns correct page
- [ ] CSV export includes all filtered entries
- [ ] Audit entries are immutable (no update/delete)

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0153](US0153-synchronous-command-execution-api.md) | Integrates | Called from API endpoint | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Alembic migration | Database | Required |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - Standard CRUD with filtering

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from EP0013 |
