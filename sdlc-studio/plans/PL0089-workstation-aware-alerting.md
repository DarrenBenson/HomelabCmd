# PL0089: Workstation-Aware Alerting - Implementation Plan

> **Status:** Complete
> **Story:** [US0089: Workstation-Aware Alerting](../stories/US0089-workstation-aware-alerting.md)
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Created:** 2026-01-27
> **Language:** Python

## Overview

Modify the offline detection scheduler to check the `machine_type` field before generating alerts. Workstations (machine_type='workstation') should be marked offline but NOT generate alerts or Slack notifications. Servers continue to generate alerts as before.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Workstation offline no alert | Workstations marked offline without alert generation |
| AC2 | Server alerts unchanged | Servers continue to generate offline alerts |
| AC3 | Reminders skip workstations | Offline reminder scheduler skips workstations |
| AC4 | Audit logging | Log message when workstation alert is skipped |
| AC5 | Mixed fleet | Correct behaviour with servers and workstations together |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI (backend), APScheduler (scheduling)
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use specific exception handling
- Type hints on function signatures
- Logging with `logger` module, not print
- Use `logger.info()` for audit trail messages

### Library Documentation (Context7)

No external library queries needed - this uses existing SQLAlchemy and APScheduler patterns already established in the codebase.

### Existing Patterns

The scheduler already uses a similar pattern for filtering inactive servers:

```python
# scheduler.py line 66 - query-level filtering
.where(Server.is_inactive.is_(False))

# scheduler.py line 77-95 - loop-level processing
for server in stale_servers:
    server.status = ServerStatus.OFFLINE.value
    # ... alert generation
```

This implementation will follow the loop-level pattern since we need to:
1. Mark ALL stale machines as offline (including workstations)
2. But only generate alerts for servers

## Recommended Approach

**Strategy:** Test-After

**Rationale:**
- Small, well-defined change to existing functions
- Clear acceptance criteria
- Pattern already established in codebase
- Implementation is straightforward; tests verify correctness

### Test Priority

1. Workstation offline - no alert created (AC1)
2. Server offline - alert created (AC2)
3. Mixed fleet - correct alerts generated (AC5)

### Documentation Updates Required

- [ ] Update EP0009 story status to Done after implementation
- [ ] Update PRD EP0009 feature status

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add machine_type check in check_stale_servers() | `scheduler.py` | - | No | [ ] |
| 2 | Add machine_type check in check_offline_reminders() | `scheduler.py` | 1 | No | [ ] |
| 3 | Write unit test for workstation offline | `test_status_detection.py` | 2 | Yes | [ ] |
| 4 | Write unit test for server offline | `test_status_detection.py` | 2 | Yes | [ ] |
| 5 | Write integration test for mixed fleet | `test_status_detection.py` | 3,4 | No | [ ] |
| 6 | Verify all tests pass | - | 5 | No | [ ] |

### Task Dependency Graph

```
Task 1 (check_stale_servers)
    ↓
Task 2 (check_offline_reminders)
    ↓
┌───┴───┐
↓       ↓
Task 3  Task 4  (unit tests - parallel)
└───┬───┘
    ↓
Task 5 (integration test)
    ↓
Task 6 (verify)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 3, 4 | Task 2 complete |

## Implementation Phases

### Phase 1: Scheduler Logic Changes

**Goal:** Modify scheduler to skip alerts for workstations

**Tasks in this phase:** 1, 2

#### Step 1.1: Update check_stale_servers()

- [ ] Add machine_type check after marking server offline
- [ ] Log info message when skipping workstation alert
- [ ] Continue to next server (skip alert generation block)

**Files to modify:**
- `backend/src/homelab_cmd/services/scheduler.py` - Lines 77-95

**Code change:**

```python
# After line 78: server.status = ServerStatus.OFFLINE.value
# Add workstation check before alert generation

for server in stale_servers:
    server.status = ServerStatus.OFFLINE.value
    count += 1

    # Skip offline alerts for workstations (EP0009: US0089)
    if server.machine_type == "workstation":
        logger.info(
            "Workstation %s marked offline (last seen: %s) - no alert generated",
            server.id,
            server.last_seen,
        )
        continue

    logger.info(
        "Server %s marked offline (last seen: %s)",
        server.id,
        server.last_seen,
    )

    # Trigger offline alert (servers only)
    if notifications_config:
        # ... existing alert code
```

**Considerations:**
- Keep the count increment BEFORE the workstation check (count includes workstations)
- Log message must include "no alert generated" for audit trail (AC4)
- Use `continue` to skip the rest of the loop iteration

#### Step 1.2: Update check_offline_reminders()

- [ ] Add machine_type check before generating reminder alerts
- [ ] Skip workstations entirely in the reminder loop

**Files to modify:**
- `backend/src/homelab_cmd/services/scheduler.py` - Lines 139-148

**Code change:**

```python
for server in offline_servers:
    # Skip offline reminders for workstations (EP0009: US0089)
    if server.machine_type == "workstation":
        continue

    # Existing reminder logic
    event = await alerting_service.trigger_offline_alert(...)
```

**Considerations:**
- No logging needed here (workstation is already offline, was logged initially)
- Simple `continue` to skip

### Phase 2: Testing

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 3, 4, 5, 6

#### Step 2.1: Unit Tests

- [ ] Write test for workstation offline (no alert)
- [ ] Write test for server offline (alert created)
- [ ] Write test for workstation reminder skip

**Test file:** `tests/test_status_detection.py`

**Test cases:**

```python
@pytest.mark.asyncio
async def test_workstation_offline_no_alert(db_session: AsyncSession) -> None:
    """Workstation should be marked offline but NOT generate alert (AC1)."""
    # Setup: Create workstation with stale last_seen
    stale_time = datetime.now(UTC) - timedelta(seconds=OFFLINE_THRESHOLD_SECONDS + 20)
    workstation = Server(
        id="test-workstation",
        hostname="workstation.local",
        machine_type="workstation",
        status=ServerStatus.ONLINE.value,
        last_seen=stale_time,
    )
    db_session.add(workstation)
    await db_session.commit()

    # Execute: Run stale server check
    count = await check_stale_servers(notifications_config)

    # Assert: Status changed, no alert
    await db_session.refresh(workstation)
    assert workstation.status == ServerStatus.OFFLINE.value

    # Verify no Alert record created
    result = await db_session.execute(
        select(Alert).where(Alert.server_id == "test-workstation")
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_server_offline_creates_alert(db_session: AsyncSession) -> None:
    """Server should generate alert when marked offline (AC2)."""
    # Similar setup with machine_type="server"
    # Assert alert IS created


@pytest.mark.asyncio
async def test_mixed_fleet_correct_alerts(db_session: AsyncSession) -> None:
    """Only servers generate alerts, not workstations (AC5)."""
    # Create both server and workstation, both stale
    # Assert: both offline, only server has alert
```

#### Step 2.2: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: workstation no alert | `test_status_detection.py` | Pending |
| AC2 | Unit test: server creates alert | `test_status_detection.py` | Pending |
| AC3 | Unit test: reminder skip | `test_status_detection.py` | Pending |
| AC4 | Log message assertion | `test_status_detection.py` | Pending |
| AC5 | Integration test: mixed fleet | `test_status_detection.py` | Pending |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Phase | Validated |
|---|------------------------|-------------------|-------|-----------|
| 1 | machine_type is NULL | Treat as 'server' - fail-safe (default behaviour since column defaults to 'server') | Phase 1 | [ ] |
| 2 | machine_type unexpected value | Treat as 'server' - only skip if explicitly 'workstation' | Phase 1 | [ ] |
| 3 | Server→workstation while offline | Reminder check will skip on next cycle | Phase 1 | [ ] |
| 4 | Workstation→server while offline | Reminder check will include on next cycle | Phase 1 | [ ] |
| 5 | Notifications disabled | Mark offline, no alert attempt (existing) | Phase 1 | [ ] |
| 6 | Multiple workstations offline | All marked offline, none alert | Phase 1 | [ ] |
| 7 | Server+workstation offline together | Only server alerts | Phase 1 | [ ] |
| 8 | Database error during alert | Log error, continue (existing) | Phase 1 | [ ] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

### Edge Case Implementation Notes

- Edge cases 1-2: Handled by checking `== "workstation"` specifically rather than `!= "server"`
- Edge cases 3-4: Natural behaviour of the loop-level check
- Edge cases 5-8: Existing error handling and multi-server processing

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Break existing server alerting | High | AC2 test explicitly verifies server alerts still work |
| Performance impact from additional check | Low | Single string comparison per server, negligible |
| Logging verbosity increase | Low | Only logs on workstation state change, not every check |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Server.machine_type field | Schema | Already exists (EP0008) |
| APScheduler | Library | Already configured |
| AlertingService | Service | No changes needed |

## Open Questions

None - all requirements are clear from the story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Story status updated to Done
- [x] EP0009 status updated

## Notes

This is a targeted change to ~20 lines of code in one file, following existing patterns. The implementation is straightforward and the main risk is regression on server alerting, which is covered by explicit tests.
