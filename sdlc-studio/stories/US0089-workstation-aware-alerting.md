# US0089: Workstation-Aware Alerting

> **Status:** Done
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** workstations to NOT generate offline alerts
**So that** I'm not spammed when they're normally shut down

## Context

### Persona Reference

**Darren** - Manages a homelab with both 24/7 servers and intermittent workstations. Receives alerts when critical infrastructure goes offline, but workstations shutting down is normal behaviour.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current alerting system treats all machines identically - when any machine misses 3 heartbeats (180 seconds), it's marked offline and generates a CRITICAL alert with Slack notification. This causes false alerts for workstations that are intentionally powered off.

The `machine_type` field already exists in the Server model (added in EP0008), but the offline detection logic in `scheduler.py` does not check this field before generating alerts.

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Risk | False positive alert noise | Must eliminate workstation offline alerts completely |
| Success Metric | Zero offline alerts for workstations | Test must verify no alerts created |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Stale check runs every 60s | Changes must not impact scheduler performance |
| Alert | False positive rate < 2% | Workstation alerts are major false positive source |

## Acceptance Criteria

### AC1: Offline detection checks machine_type

- **Given** a workstation (machine_type='workstation') that has missed 3+ heartbeats
- **When** the `check_stale_servers()` scheduler runs
- **Then** the workstation is marked with status='offline'
- **And** NO alert is generated (no Alert record created)
- **And** NO Slack notification is sent

### AC2: Server offline alerts unchanged

- **Given** a server (machine_type='server') that has missed 3+ heartbeats
- **When** the `check_stale_servers()` scheduler runs
- **Then** the server is marked with status='offline'
- **And** a CRITICAL alert is generated
- **And** Slack notification is sent (if configured)

### AC3: Offline reminders skip workstations

- **Given** a workstation that is already offline
- **When** the `check_offline_reminders()` scheduler runs
- **Then** NO reminder alert is generated
- **And** NO re-notification Slack message is sent

### AC4: Alert skip logged for audit

- **Given** a workstation going offline
- **When** the alert is skipped
- **Then** an INFO log message records: "Workstation {id} marked offline (last seen: {time}) - no alert generated"

### AC5: Mixed fleet handled correctly

- **Given** multiple servers and workstations, some stale
- **When** the scheduler runs
- **Then** only servers generate offline alerts
- **And** all stale machines are marked offline regardless of type

## Scope

### In Scope

- Modify `check_stale_servers()` to check `machine_type` before alert generation
- Modify `check_offline_reminders()` to skip workstations
- Add logging for skipped alerts (audit trail)
- Unit tests for all scenarios
- Integration test for mixed server/workstation fleet

### Out of Scope

- UI changes (covered by US0085 - Last Seen UI)
- Visual distinction (covered by US0086)
- Cost tracking changes (covered by US0087)
- Manual override to force alerts for specific workstations (future enhancement)

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `backend/src/homelab_cmd/services/scheduler.py` | Add machine_type checks in `check_stale_servers()` and `check_offline_reminders()` |
| `tests/test_status_detection.py` | Add test cases for workstation alert suppression |

### Implementation Pattern

Follow existing pattern for `is_inactive` filtering in scheduler.py:

```python
# Current pattern (line 66)
.where(Server.is_inactive.is_(False))

# New pattern: in the processing loop
for server in stale_servers:
    server.status = ServerStatus.OFFLINE.value

    if server.machine_type == "workstation":
        logger.info(
            "Workstation %s marked offline (last seen: %s) - no alert generated",
            server.id,
            server.last_seen,
        )
        continue  # Skip alert generation

    # Existing alert logic for servers
```

### API Contracts

No API changes required. This is internal scheduler behaviour.

### Data Requirements

- `Server.machine_type` field must be populated (defaults to 'server')
- Valid values: 'server', 'workstation'

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| machine_type is NULL | Treat as 'server' (generate alert) - defensive coding |
| machine_type has unexpected value | Treat as 'server' (generate alert) - fail-safe |
| Server changed to workstation while offline | Continue to skip alerts on future reminder cycles |
| Workstation changed to server while offline | Begin generating alerts on next reminder cycle |
| Notifications disabled (no webhook) | Mark offline, skip alert silently (existing behaviour) |
| Multiple workstations go offline simultaneously | All marked offline, none generate alerts |
| Server and workstation go offline together | Only server generates alert |
| Database error during alert creation | Log error, continue to next server (existing behaviour) |

## Test Scenarios

- [x] Workstation offline - no alert created
- [x] Server offline - alert created
- [x] Mixed fleet - only servers generate alerts
- [x] Workstation offline reminder - no reminder sent
- [x] Server offline reminder - reminder sent
- [x] NULL machine_type treated as server
- [x] Workstation status still changes to offline
- [x] Logging includes workstation skip reason

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0089-01 | Workstation offline skips alert | AC1 | Unit | Ready |
| TC-US0089-02 | Server offline creates alert | AC2 | Unit | Ready |
| TC-US0089-03 | Workstation reminder skipped | AC3 | Unit | Ready |
| TC-US0089-04 | Alert skip logged | AC4 | Unit | Ready |
| TC-US0089-05 | Mixed fleet correct alerts | AC5 | Integration | Ready |
| TC-US0089-06 | NULL machine_type creates alert | AC1 | Unit | Ready |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| US0082 | Schema | machine_type field in Server model | Done (EP0008) |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| APScheduler | Library | Installed |
| SQLAlchemy | Library | Installed |

## Estimation

**Story Points:** 5

**Complexity:** Low - Small change to existing functions following established patterns

## Open Questions

None - all requirements are clear.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 8/10 minimum listed
- [x] API contracts: N/A (internal scheduler change)
- [x] Error codes: N/A (no API)

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation from EP0009 specification |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
