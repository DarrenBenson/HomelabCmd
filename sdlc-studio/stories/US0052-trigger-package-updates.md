# US0052: Trigger Package Updates from Dashboard

> **Status:** Done
> **Plan:** [PL0037: Trigger Package Updates](../plans/PL0037-trigger-package-updates.md)
> **Test Spec:** [TS0011: Trigger Package Updates Tests](../test-specs/TS0011-trigger-package-updates.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-20
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to trigger package updates on servers from the dashboard
**So that** I can keep servers patched without SSH-ing into each one manually

## Context

### Persona Reference

**Darren** - Wants to maintain 5+ servers with minimal manual intervention. Currently must SSH into each server to run apt upgrade.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

EP0004 (Remediation Engine) implemented a command execution framework where actions can be queued, approved, and executed by agents. This story extends that capability to allow triggering `apt update` and `apt upgrade` operations from the server detail view, using the existing action queue infrastructure.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Scope | Core monitoring with remediation | Extends monitoring to action execution |
| Architecture | Agent-based execution | Commands run via agent, not direct SSH |
| Platform | Debian-based servers | apt command dependency |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | Approval workflow required | AC4 requires manual approval |
| Performance | Actions complete within timeout | 10 minute timeout for upgrades |
| UX | Clear feedback on actions | AC6 shows success/failure with output |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Refresh package list button

- **Given** viewing the server detail page
- **When** clicking "Run apt update"
- **Then** an action is queued to run `apt update` on the server and refresh the package list

### AC2: Apply all updates button

- **Given** viewing the server detail page with pending updates
- **When** clicking "Apply All Updates"
- **Then** an action is queued to run `apt upgrade -y` (or specified packages) on the server

### AC3: Apply security updates only option

- **Given** viewing the server detail page with security updates pending
- **When** clicking "Apply Security Updates"
- **Then** only packages from security repositories are upgraded

### AC4: Action requires approval

- **Given** a package update action is queued
- **When** the server is not in maintenance mode
- **Then** the action requires manual approval before execution

### AC5: Action executes via remediation engine

- **Given** a package update action is approved
- **When** the agent polls for pending actions
- **Then** the agent executes the apt command and reports results

### AC6: Success/failure feedback

- **Given** a package update action completes
- **When** viewing the action history
- **Then** the result shows success/failure and any error output

## Scope

### In Scope

- "Run apt update" button on server detail
- "Apply All Updates" button
- "Apply Security Updates" button
- Integration with EP0004 action queue
- Approval workflow for update actions
- Agent execution of apt commands
- Result capture and display

### Out of Scope

- Selective package updates (individual packages)
- Scheduled/automatic updates
- Rollback capability
- Non-Debian package managers

## UI/UX Requirements

### Server Detail Updates Section

```
┌─────────────────────────────────────────────────────────────────────────┐
│ System Updates                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Available Updates:     12                                               │
│  Security Updates:      3  ⚠️                                            │
│  Last Checked:          2026-01-20 10:30 UTC                            │
│                                                                          │
│  [🔄 Refresh List]  [Apply Security (3)]  [Apply All (12)]              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Action States

| Button State | Condition |
|--------------|-----------|
| Enabled | Server online, no pending apt action |
| Disabled + spinner | Action in progress |
| Disabled + "Pending approval" | Action queued, awaiting approval |

### Confirmation Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Apply Package Updates                                            [X]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Server: omv-mediaserver                                                │
│  Action: apt upgrade -y                                                 │
│  Packages: 12 updates (3 security)                                      │
│                                                                          │
│  ⚠️ This will modify system packages. The action will be queued for     │
│  approval unless the server is in maintenance mode.                      │
│                                                                          │
│                                    [Cancel]  [Queue Action]             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technical Notes

### Action Types

Extend the remediation action types to include:

| Action Type | Command | Description |
|-------------|---------|-------------|
| `apt_update` | `apt update` | Refresh package lists |
| `apt_upgrade_all` | `apt upgrade -y` | Apply all pending updates |
| `apt_upgrade_security` | `apt upgrade -y <security-pkgs>` | Apply security updates only |

### API Contracts

**POST /api/v1/servers/{server_id}/actions**

Request (apt update):
```json
{
  "action_type": "apt_update",
  "requires_approval": true
}
```

Request (apt upgrade):
```json
{
  "action_type": "apt_upgrade_all",
  "requires_approval": true,
  "parameters": {
    "security_only": false
  }
}
```

Response:
```json
{
  "action_id": "uuid",
  "status": "pending_approval",
  "created_at": "2026-01-20T10:30:00Z"
}
```

### Agent Command Execution

Extend agent executor to handle apt actions:

```python
def execute_apt_update(self) -> dict:
    """Run apt update to refresh package lists."""
    result = subprocess.run(
        ['sudo', 'apt', 'update'],
        capture_output=True,
        text=True,
        timeout=120
    )
    return {
        'success': result.returncode == 0,
        'output': result.stdout,
        'error': result.stderr
    }

def execute_apt_upgrade(self, security_only: bool = False) -> dict:
    """Run apt upgrade to apply pending updates."""
    cmd = ['sudo', 'apt', 'upgrade', '-y']
    if security_only:
        # Get list of security packages and upgrade only those
        security_pkgs = self._get_security_packages()
        cmd = ['sudo', 'apt', 'install', '-y'] + security_pkgs

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600  # 10 minutes for large upgrades
    )
    return {
        'success': result.returncode == 0,
        'output': result.stdout,
        'error': result.stderr,
        'packages_upgraded': self._count_upgraded(result.stdout)
    }
```

### Data Requirements

Extend `remediation_actions` table action_type enum:

- `apt_update`
- `apt_upgrade_all`
- `apt_upgrade_security`

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| apt update already in progress | Disable button, show "In progress" |
| apt upgrade fails mid-way | Capture partial output, mark as failed |
| Agent loses connection during upgrade | Action times out, status unknown |
| Permission denied (no sudo) | Capture error, mark as failed with "sudo required" message |
| Disk full during upgrade | Capture error, mark as failed with disk space warning |
| Server offline when action queued | Action remains pending, executes when agent reconnects |
| No packages to upgrade | apt upgrade completes immediately, success with 0 packages |
| dpkg lock held by another process | Retry after delay, fail after 3 attempts with lock error |
| Security-only upgrade with no security packages | Success with 0 packages, UI shows "No security updates available" |
| apt update returns new packages mid-upgrade | Current action completes, new packages shown on next heartbeat |

## Test Scenarios

- [x] Refresh list button queues apt_update action (PackageList.test.tsx)
- [x] Apply all button queues apt_upgrade_all action (PackageList.test.tsx)
- [x] Apply security button queues apt_upgrade_security action (PackageList.test.tsx)
- [x] Actions require approval when not in maintenance mode (test_apt_actions.py)
- [x] Approved actions executed by agent (test_apt_actions.py)
- [x] Success result captured and displayed (PackageList.test.tsx)
- [x] Failure result shows error message (PackageList.test.tsx)
- [ ] Package list refreshed after successful upgrade (requires integration test)

## Test Cases

| ID | AC | Test Description | Expected Result |
|----|----|--------------------|-----------------|
| TC1 | AC1 | Click "Run apt update" button | apt_update action queued |
| TC2 | AC1 | apt update completes | Package list refreshed in UI |
| TC3 | AC2 | Click "Apply All Updates" button | apt_upgrade_all action queued |
| TC4 | AC2 | Upgrade completes successfully | All packages applied, counts reset |
| TC5 | AC3 | Click "Apply Security Updates" | apt_upgrade_security action queued |
| TC6 | AC3 | Security upgrade completes | Only security packages updated |
| TC7 | AC4 | Queue action on non-maintenance server | Action status is pending_approval |
| TC8 | AC4 | Queue action on maintenance mode server | Action executes without approval |
| TC9 | AC5 | Agent polls for pending actions | Approved apt action retrieved |
| TC10 | AC5 | Agent executes apt command | Command runs with correct parameters |
| TC11 | AC6 | Upgrade succeeds | Action history shows success with output |
| TC12 | AC6 | Upgrade fails | Action history shows failure with error message |

## Quality Checklist

- [ ] All acceptance criteria have corresponding test cases
- [ ] Edge cases documented and tested
- [ ] API contracts validated with integration tests
- [ ] Agent tested with actual apt operations on test server
- [ ] Timeout handling verified for large upgrades
- [ ] Slack notification sent on upgrade completion
- [ ] Approval workflow integration tested
- [ ] Error handling covers all failure modes

## Ready Status Gate

| Gate | Status | Notes |
|------|--------|-------|
| AC coverage | Pass | All 6 ACs mapped to test cases (TC1-TC12) |
| Edge cases | Pass | 10 edge cases documented (exceeds API story minimum of 8) |
| Dependencies met | Pass | US0044 Done, US0051 backend complete, EP0004 Done |
| Technical design | Pass | API, agent code, action types defined |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0044: Package Update Display | Story | Done |
| US0051: Package Update List View | Story | In Progress (backend complete) |
| EP0004: Remediation Engine | Epic | Done |
| US0024: Action Queue API | Story | Done |
| US0027: Agent Command Execution | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - extends existing remediation infrastructure

## Implementation Notes

### Backend Implementation Complete

1. **Action Type Enum** (`backend/src/homelab_cmd/api/schemas/actions.py:14-16`)
   - Added `APT_UPDATE`, `APT_UPGRADE_ALL`, `APT_UPGRADE_SECURITY` to ActionType enum

2. **Command Builders** (`backend/src/homelab_cmd/api/routes/actions.py:29-87`)
   - `apt_update` builds to `"apt update"`
   - `apt_upgrade_all` builds to `"apt upgrade -y"`
   - `apt_upgrade_security` queries pending_packages for is_security=True, builds to `"apt install -y <pkgs>"` or `"echo 'No security packages to upgrade'"`

3. **Duplicate Detection** (`backend/src/homelab_cmd/api/routes/actions.py:252-273`)
   - APT actions conflict with each other (prevents concurrent apt operations)
   - Returns 409 if pending/approved/executing apt action exists for server

4. **Agent Whitelist** (`agent/executor.py:32-36`)
   - Added patterns: `apt_update`, `apt_upgrade`, `apt_install`, `echo_no_security`
   - Regex validates package names contain only safe characters

### Frontend Implementation Complete

1. **Action Buttons** (`frontend/src/components/PackageList.tsx:290-368`)
   - "Refresh List" button triggers `apt_update` action
   - "Apply Security (N)" button triggers `apt_upgrade_security` action
   - "Apply All (N)" button triggers `apt_upgrade_all` action
   - Buttons disabled during action execution
   - Success/error feedback messages displayed

2. **Type Definitions** (`frontend/src/types/action.ts:13-18, 53-58`)
   - Extended `ActionType` union with apt action types
   - Added `CreateActionRequest` interface

3. **API Client** (`frontend/src/api/actions.ts:45-50`)
   - `createAction(request)` posts to `/api/v1/actions`
   - Returns created Action with status

4. **State Management** (`frontend/src/components/PackageList.tsx:36-104`)
   - `actionLoading` tracks which button is loading
   - `actionError` and `actionSuccess` for feedback
   - 409 conflict handling for duplicate apt actions

## Open Questions

- [x] Should apt upgrade use `apt upgrade` or `apt full-upgrade`? - **Decision: `apt upgrade`** - safer as it never removes packages. Users can SSH if they need full-upgrade.
- [x] Should automatic reboots be supported for kernel updates? - **Decision: No** - out of scope for safety. Users should manually reboot after kernel updates.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-20 | Claude | Expanded edge cases to 10 (API minimum 8), resolved open questions, marked Ready |
| 2026-01-20 | Claude | Backend implementation complete: action types, command builders, duplicate detection, whitelist patterns (19 tests passing) |
| 2026-01-20 | Claude | Frontend implementation complete: action buttons, API client, success/error feedback, duplicate action handling |
| 2026-01-20 | Claude | Frontend tests added: PackageList.test.tsx includes action button tests (AC1-AC3, AC6) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
