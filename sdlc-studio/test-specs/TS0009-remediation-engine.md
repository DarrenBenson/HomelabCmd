# TS0009: Remediation Engine Tests

> **Status:** Complete
> **Epic:** [EP0004: Remediation Engine](../../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Last Updated:** 2026-01-19

## Overview

Test specification for the Remediation Engine functionality including action queue, maintenance mode, heartbeat command channel, agent execution, approval workflow, dashboard panels, and Slack notifications. This spec is in Draft status as EP0004 is not yet implemented.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0023](../../stories/US0023-remediation-action-schema.md) | Extended Remediation Action Schema | Must Have |
| [US0029](../../stories/US0029-server-maintenance-mode.md) | Server Maintenance Mode | Must Have |
| [US0024](../../stories/US0024-action-queue-api.md) | Action Queue API | Must Have |
| [US0025](../../stories/US0025-heartbeat-command-channel.md) | Heartbeat Command Channel | Must Have |
| [US0027](../../stories/US0027-agent-command-execution.md) | Agent Command Execution | Must Have |
| [US0026](../../stories/US0026-maintenance-mode-approval.md) | Maintenance Mode Approval | Should Have |
| [US0030](../../stories/US0030-pending-actions-panel.md) | Pending Actions Panel | Should Have |
| [US0031](../../stories/US0031-action-history-view.md) | Action History View | Should Have |
| [US0032](../../stories/US0032-action-slack-notifications.md) | Action Execution Slack Notifications | Should Have |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Action model, status transitions, command whitelist |
| Integration | Yes | Heartbeat command delivery, result reporting |
| API | Yes | Action queue endpoints, approval workflow |
| E2E | Yes | Pending actions panel, approval UI, history view |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | SQLite test database, pytest fixtures, Vitest + RTL |
| External Services | Slack webhook (mocked) |
| Test Data | Servers (normal + paused), actions in various states |

---

## Test Cases

### TC149: RemediationAction extended schema has all status values

**Type:** Unit
**Priority:** Must Have
**Story:** US0023
**Automated:** Yes
**Test File:** `tests/test_remediation_schema.py::TestActionStatusEnum`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given ActionStatus enum | Extended enum definition |
| 2 | When checking values | All statuses present |
| 3 | Then PENDING, APPROVED, REJECTED, EXECUTING, COMPLETED, FAILED exist | Complete lifecycle |

#### Assertions

- [ ] PENDING status exists
- [ ] APPROVED status exists
- [ ] REJECTED status exists
- [ ] EXECUTING status exists
- [ ] COMPLETED status exists
- [ ] FAILED status exists

---

### TC150: RemediationAction has approval tracking fields

**Type:** Unit
**Priority:** Must Have
**Story:** US0023
**Automated:** Yes
**Test File:** `tests/test_remediation_schema.py::TestRemediationActionApprovalFields`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given RemediationAction model | Extended model |
| 2 | When creating action | All fields accessible |
| 3 | Then approval fields present | approved_by, approved_at, rejected_reason |

#### Assertions

- [ ] approved_by is nullable string
- [ ] approved_at is nullable datetime
- [ ] rejected_reason is nullable string

---

### TC151: RemediationAction has execution result fields

**Type:** Unit
**Priority:** Must Have
**Story:** US0023
**Automated:** Yes
**Test File:** `tests/test_remediation_schema.py::TestRemediationActionExecutionFields`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given RemediationAction model | Extended model |
| 2 | When action completes | Result fields populated |
| 3 | Then execution fields present | started_at, completed_at, output, error |

#### Assertions

- [ ] started_at is nullable datetime
- [ ] completed_at is nullable datetime
- [ ] output is nullable text
- [ ] error is nullable text

---

### TC152: Server model has is_paused flag

**Type:** Unit
**Priority:** Must Have
**Story:** US0029
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestServerIsPausedFlag`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given Server model | Extended model |
| 2 | When creating server | is_paused defaults to False |
| 3 | Then flag can be updated | True/False values work |

#### Assertions

- [ ] is_paused column exists
- [ ] Defaults to False
- [ ] Can be set to True

---

### TC153: PUT /servers/{id}/pause enables maintenance mode

**Type:** API
**Priority:** Must Have
**Story:** US0029
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestPauseServer`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server in normal mode | is_paused=False |
| 2 | When PUT /servers/{id}/pause | Maintenance mode enabled |
| 3 | Then is_paused=True | Response confirms |

#### Assertions

- [ ] Response 200
- [ ] Server is_paused is True
- [ ] Subsequent GET shows is_paused=True

---

### TC154: PUT /servers/{id}/unpause disables maintenance mode

**Type:** API
**Priority:** Must Have
**Story:** US0029
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestUnpauseServer`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server in maintenance mode | is_paused=True |
| 2 | When PUT /servers/{id}/unpause | Normal mode restored |
| 3 | Then is_paused=False | Response confirms |

#### Assertions

- [ ] Response 200
- [ ] Server is_paused is False

---

### TC155: GET /actions lists all actions

**Type:** API
**Priority:** Must Have
**Story:** US0024
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestListActions`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given actions in various states | Database seeded |
| 2 | When GET /api/v1/actions | List all actions |
| 3 | Then paginated list returned | With status filter support |

#### Assertions

- [ ] Response 200
- [ ] Returns actions array
- [ ] Supports ?status filter
- [ ] Supports ?server_id filter
- [ ] Includes pagination

---

### TC156: GET /actions/{id} returns action details

**Type:** API
**Priority:** Must Have
**Story:** US0024
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestGetAction`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given action exists | Action in database |
| 2 | When GET /api/v1/actions/{id} | Fetch action |
| 3 | Then full action details returned | All fields included |

#### Assertions

- [ ] Response 200
- [ ] All action fields present
- [ ] Execution result fields if completed

---

### TC157: Action on normal server auto-approves

**Type:** Integration
**Priority:** Must Have
**Story:** US0024
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestNormalServerAutoApproval`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with is_paused=False | Normal mode |
| 2 | When action created (e.g., restart service) | POST to action endpoint |
| 3 | Then status=APPROVED, approved_by="auto" | Immediate approval |

#### Assertions

- [ ] Action status is APPROVED
- [ ] approved_by is "auto"
- [ ] approved_at is set

---

### TC158: Action on paused server remains pending

**Type:** Integration
**Priority:** Must Have
**Story:** US0024
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestPausedServerPending`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with is_paused=True | Maintenance mode |
| 2 | When action created | POST to action endpoint |
| 3 | Then status=PENDING | Awaits approval |

#### Assertions

- [ ] Action status is PENDING
- [ ] approved_by is null
- [ ] approved_at is null

---

### TC159: Command whitelist enforced

**Type:** API
**Priority:** Must Have
**Story:** US0024
**Automated:** Yes
**Test File:** `tests/test_actions_api.py::TestCommandWhitelist`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given command not in whitelist | e.g., "rm -rf /" |
| 2 | When action created | POST with dangerous command |
| 3 | Then 400 Bad Request | Command rejected |

#### Assertions

- [ ] Response 400 for non-whitelisted commands
- [ ] Error message explains rejection
- [ ] Whitelisted commands (systemctl restart) accepted

---

### TC160: Heartbeat response includes pending commands

**Type:** Integration
**Priority:** Must Have
**Story:** US0025
**Automated:** Yes
**Test File:** `tests/test_heartbeat_commands.py::TestApprovedActionInHeartbeatResponse`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given APPROVED action for server | Action ready for execution |
| 2 | When agent sends heartbeat | POST /agents/heartbeat |
| 3 | Then response includes pending_commands array | Command delivered |

#### Assertions

- [ ] Response includes pending_commands field
- [ ] Command includes action_id, command, action_type
- [ ] Action status updated to EXECUTING
- [ ] started_at timestamp set

---

### TC161: Heartbeat request reports command results

**Type:** Integration
**Priority:** Must Have
**Story:** US0025
**Automated:** Yes
**Test File:** `tests/test_heartbeat_commands.py::TestCommandResultsUpdateStatus`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given EXECUTING action | Command sent to agent |
| 2 | When heartbeat includes command_results | Result reported |
| 3 | Then action status updated | COMPLETED or FAILED |

#### Assertions

- [ ] command_results field processed
- [ ] Status set to COMPLETED on success
- [ ] Status set to FAILED on error
- [ ] completed_at timestamp set
- [ ] output/error captured

---

### TC162: Agent executes whitelisted commands

**Type:** Unit
**Priority:** Must Have
**Story:** US0027
**Automated:** Yes
**Test File:** `tests/test_agent_executor.py::TestCommandExecution`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given pending command from heartbeat | Command received |
| 2 | When agent processes command | Execution triggered |
| 3 | Then command executed and result captured | Output/error recorded |

#### Assertions

- [x] Command executed via subprocess
- [x] Timeout enforced
- [x] Exit code captured
- [x] stdout/stderr captured

---

### TC163: Agent rejects non-whitelisted commands

**Type:** Unit
**Priority:** Must Have
**Story:** US0027
**Automated:** Yes
**Test File:** `tests/test_agent_executor.py::TestRejectsNonWhitelisted`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given command not in agent whitelist | Malicious command |
| 2 | When agent receives command | Command validated |
| 3 | Then command rejected locally | Error reported |

#### Assertions

- [x] Agent validates command against local whitelist
- [x] Rejection reported in next heartbeat
- [x] No execution attempted

---

### TC164: Agent reports results in next heartbeat

**Type:** Integration
**Priority:** Must Have
**Story:** US0027
**Automated:** Yes
**Test File:** `tests/test_agent_executor.py::TestResultsInHeartbeat`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given command executed | Execution complete |
| 2 | When next heartbeat sent | Results included |
| 3 | Then command_results array populated | action_id, success, output, error |

#### Assertions

- [x] command_results included in heartbeat
- [x] action_id matches original command
- [x] success boolean indicates outcome
- [x] output contains stdout
- [x] error contains stderr (if any)

---

### TC165: POST /actions/{id}/approve approves pending action

**Type:** API
**Priority:** Must Have
**Story:** US0026
**Automated:** Yes
**Test File:** `tests/test_action_approval.py::TestApproveAction`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given PENDING action | Action awaiting approval |
| 2 | When PUT /actions/{id}/approve | Approval request |
| 3 | Then status=APPROVED | Ready for execution |

#### Assertions

- [ ] Response 200
- [ ] Status changed to APPROVED
- [ ] approved_by set to user/API
- [ ] approved_at timestamp set

---

### TC166: POST /actions/{id}/reject rejects pending action

**Type:** API
**Priority:** Must Have
**Story:** US0026
**Automated:** Yes
**Test File:** `tests/test_action_approval.py::TestRejectAction`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given PENDING action | Action awaiting approval |
| 2 | When PUT /actions/{id}/reject with reason | Rejection request |
| 3 | Then status=REJECTED | Action cancelled |

#### Assertions

- [ ] Response 200
- [ ] Status changed to REJECTED
- [ ] rejected_reason captured

---

### TC167: Cannot approve non-PENDING action

**Type:** API
**Priority:** Must Have
**Story:** US0026
**Automated:** Yes
**Test File:** `tests/test_action_approval.py::TestCannotApproveNonPending`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given COMPLETED action | Already executed |
| 2 | When POST /actions/{id}/approve | Invalid transition |
| 3 | Then 409 Conflict | Invalid state transition |

#### Assertions

- [x] Response 409
- [x] Error explains invalid state
- [x] Action unchanged

---

### TC168: Pending actions panel shows PENDING actions

**Type:** E2E
**Priority:** Should Have
**Story:** US0030
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given actions with status=PENDING | Multiple pending |
| 2 | When dashboard loaded | Panel mounted |
| 3 | Then pending actions displayed | With approve/reject buttons |

#### Assertions

- [ ] Panel shows only PENDING actions
- [ ] Action details visible (server, command, created_at)
- [ ] Approve button present
- [ ] Reject button present

---

### TC169: Approve button triggers approval

**Type:** E2E
**Priority:** Should Have
**Story:** US0030
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given pending action in panel | UI rendered |
| 2 | When Approve button clicked | API call made |
| 3 | Then action approved and removed from panel | UI updates |

#### Assertions

- [ ] Click calls PUT /actions/{id}/approve
- [ ] Success toast shown
- [ ] Action removed from pending list
- [ ] Action appears in approved/executing section

---

### TC170: Reject button shows reason dialog

**Type:** E2E
**Priority:** Should Have
**Story:** US0030
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given pending action in panel | UI rendered |
| 2 | When Reject button clicked | Dialog shown |
| 3 | Then reason required, action rejected | API call with reason |

#### Assertions

- [ ] Dialog prompts for rejection reason
- [ ] Reason required to submit
- [ ] Calls PUT /actions/{id}/reject with reason
- [ ] Action removed from pending list

---

### TC171: Action history page accessible at /actions route

**Type:** E2E
**Priority:** Must Have
**Story:** US0031 AC1
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given user is on dashboard | Dashboard loaded |
| 2 | When navigating to /actions | Route accessed |
| 3 | Then ActionsPage displayed | With header "Actions" |

#### Test Data

```yaml
input:
  route: "/actions"
expected:
  page_title: "Actions"
  back_button: present
  filter_section: present
  table_or_empty_state: present
```

#### Assertions

- [ ] Page loads without error
- [ ] Header shows "Actions" title
- [ ] Back button navigates to dashboard
- [ ] "View All" link from PendingActionsPanel works (/actions?status=pending)

---

### TC172: Actions table displays correct columns and data

**Type:** E2E
**Priority:** Must Have
**Story:** US0031 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given actions exist in database | Various states |
| 2 | When viewing /actions | Table rendered |
| 3 | Then correct columns displayed | Server, Type, Status, Created, Completed |

#### Test Data

```yaml
input:
  actions:
    - server_id: omv-mediaserver
      action_type: restart_service
      service_name: plex
      status: completed
      created_at: "2026-01-19T10:30:00Z"
      completed_at: "2026-01-19T10:31:00Z"
    - server_id: pihole-primary
      action_type: restart_service
      service_name: pihole-FTL
      status: pending
      created_at: "2026-01-19T11:00:00Z"
      completed_at: null
expected:
  columns: ["Server", "Type", "Status", "Created", "Completed"]
  row_count: 2
```

#### Assertions

- [ ] Server column shows server display name or ID
- [ ] Type column shows formatted action type (e.g., "Restart Service (plex)")
- [ ] Status column shows coloured status label
- [ ] Created column shows relative time (e.g., "30m ago")
- [ ] Completed column shows relative time or "-" if null
- [ ] Rows are clickable (cursor pointer)
- [ ] Terminal statuses (completed, failed, rejected) have reduced opacity

---

### TC176: Filter by server works

**Type:** E2E
**Priority:** Must Have
**Story:** US0031 AC3
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given actions for multiple servers | 3 servers with actions |
| 2 | When selecting "omv-mediaserver" in server filter | Dropdown changed |
| 3 | Then only actions for that server shown | Table filtered |

#### Test Data

```yaml
input:
  server_filter: "omv-mediaserver"
  actions:
    - server_id: omv-mediaserver
      status: completed
    - server_id: pihole-primary
      status: pending
    - server_id: mini-pc-1
      status: failed
expected:
  visible_actions: 1
  url_param: "?server=omv-mediaserver"
```

#### Assertions

- [ ] Server dropdown lists all servers
- [ ] Selecting server updates URL with `?server=` param
- [ ] Table shows only matching actions
- [ ] Clear filters button appears when filter active
- [ ] Clearing filter shows all actions again

---

### TC177: Filter by status works

**Type:** E2E
**Priority:** Must Have
**Story:** US0031 AC4
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given actions in various states | Mix of statuses |
| 2 | When selecting "failed" in status filter | Dropdown changed |
| 3 | Then only failed actions shown | Table filtered |

#### Test Data

```yaml
input:
  status_filter: "failed"
  actions:
    - status: completed
    - status: pending
    - status: failed
    - status: rejected
expected:
  visible_actions: 1
  url_param: "?status=failed"
```

#### Assertions

- [ ] Status dropdown lists all statuses (pending, approved, executing, completed, failed, rejected)
- [ ] Selecting status updates URL with `?status=` param
- [ ] Table shows only matching actions
- [ ] Filters can be combined (server + status)
- [ ] Page resets to 1 when filter changes

---

### TC178: Action detail panel shows full audit trail

**Type:** E2E
**Priority:** Must Have
**Story:** US0031 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given COMPLETED action with execution output | Full lifecycle |
| 2 | When clicking action row | Detail panel opens |
| 3 | Then full audit trail displayed | Timeline, command, output |

#### Test Data

```yaml
input:
  action:
    id: 42
    server_id: omv-mediaserver
    action_type: restart_service
    service_name: plex
    status: completed
    command: "systemctl restart plex"
    created_at: "2026-01-19T10:30:00Z"
    created_by: dashboard
    approved_at: "2026-01-19T10:30:05Z"
    approved_by: auto
    executed_at: "2026-01-19T10:31:00Z"
    completed_at: "2026-01-19T10:31:02Z"
    exit_code: 0
    stdout: ""
    stderr: null
expected:
  panel_title: "Action Details"
  action_title: "Restart Service: plex"
  status_badge: "Completed" (green)
  timeline_entries: 4
```

#### Assertions

- [ ] Panel slides in from right
- [ ] Backdrop closes panel on click
- [ ] Close button works
- [ ] Title shows action type and service name
- [ ] Status badge shows coloured status with icon
- [ ] Timeline shows Created, Approved, Executed, Completed entries
- [ ] Command displayed in monospace
- [ ] Exit code shown (green for 0, red otherwise)
- [ ] stdout displayed in scrollable block
- [ ] stderr displayed in red block (if present)

---

### TC179: Action detail panel shows rejection reason

**Type:** E2E
**Priority:** Should Have
**Story:** US0031 AC5
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given REJECTED action | With rejection reason |
| 2 | When clicking action row | Detail panel opens |
| 3 | Then rejection details displayed | Reason visible |

#### Test Data

```yaml
input:
  action:
    status: rejected
    rejected_at: "2026-01-19T10:35:00Z"
    rejected_by: dashboard
    rejection_reason: "Service recovered automatically"
expected:
  timeline_entry: "Rejected: 2026-01-19 10:35:00 by dashboard"
  rejection_reason_section: visible
```

#### Assertions

- [ ] Status badge shows "Rejected" (grey)
- [ ] Timeline shows Rejected entry
- [ ] Rejection reason section visible
- [ ] Reason text displayed
- [ ] No execution details shown (executed_at is null)

---

### TC180: Pagination works with 20 items per page

**Type:** E2E
**Priority:** Must Have
**Story:** US0031 AC6
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 50 actions | More than page size |
| 2 | When viewing /actions | First page shown |
| 3 | Then pagination controls visible | Navigate pages |

#### Test Data

```yaml
input:
  total_actions: 50
  page_size: 20
expected:
  total_pages: 3
  page_1_count: 20
  page_3_count: 10
```

#### Assertions

- [ ] "Showing 1-20 of 50 actions" displayed
- [ ] Page 1, 2, 3 buttons visible
- [ ] Next/Previous arrows work
- [ ] Page 2 shows items 21-40
- [ ] URL updates with `?page=2` param
- [ ] Filter + pagination work together

---

### TC181: Empty state shown when no actions match

**Type:** E2E
**Priority:** Should Have
**Story:** US0031 AC2
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no actions exist | Empty database |
| 2 | When viewing /actions | Page loads |
| 3 | Then empty state displayed | Helpful message |

#### Test Data

```yaml
input:
  actions: []
expected:
  message: "No actions found"
  subtext: "No remediation actions have been created yet."
```

#### Assertions

- [ ] Green checkmark icon shown
- [ ] "No actions found" heading
- [ ] Descriptive message shown
- [ ] When filters active, shows "Clear filters" link
- [ ] Clear filters link resets to show all

---

### TC173: Slack notification sent on action failure

**Type:** Integration
**Priority:** Should Have
**Story:** US0032
**Automated:** Yes
**Test File:** `tests/test_action_notifications.py::TestSendActionNotification::test_failure_sent_when_enabled`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given action execution fails | FAILED status |
| 2 | When failure recorded | Result processed |
| 3 | Then Slack webhook called | Failure notification sent |

#### Assertions

- [x] Slack webhook called
- [x] Message includes server name
- [x] Message includes action type
- [x] Message includes error output

---

### TC174: Success notification sent when enabled

**Type:** Integration
**Priority:** Should Have
**Story:** US0032
**Automated:** Yes
**Test File:** `tests/test_action_notifications.py::TestSendActionNotification::test_success_sent_when_enabled`

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given action execution succeeds | COMPLETED status |
| 2 | When success recorded with notify_on_action_success=True | Result processed |
| 3 | Then Slack notification sent | Success notification |

#### Assertions

- [x] Slack webhook called when notify_on_action_success=True
- [x] Slack webhook NOT called when notify_on_action_success=False (default)

---

### TC175: Action audit trail complete

**Type:** Integration
**Priority:** Must Have
**Story:** US0024
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given action through full lifecycle | Created → Approved → Completed |
| 2 | When querying action | Full record retrieved |
| 3 | Then all timestamps and actors captured | Complete audit |

#### Assertions

- [ ] created_at and created_by captured
- [ ] approved_at and approved_by captured
- [ ] started_at captured
- [ ] completed_at captured
- [ ] All state transitions traceable

---

## Fixtures

```yaml
# Shared test data for this spec
servers:
  - id: normal-server
    hostname: normal-server.local
    is_paused: false
  - id: paused-server
    hostname: paused-server.local
    is_paused: true

actions:
  pending:
    server_id: paused-server
    action_type: restart_service
    service_name: plex
    command: "systemctl restart plex"
    status: pending
  approved:
    server_id: normal-server
    action_type: restart_service
    service_name: nginx
    command: "systemctl restart nginx"
    status: approved
    approved_by: auto
  completed:
    server_id: normal-server
    action_type: restart_service
    service_name: docker
    command: "systemctl restart docker"
    status: completed
    output: "Service restarted successfully"

command_whitelist:
  - "systemctl restart *"
  - "systemctl stop *"
  - "systemctl start *"
  - "journalctl --vacuum-time=7d"
```

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC149 | Extended schema has all status values | Automated | `tests/test_remediation_schema.py::TestActionStatusEnum` |
| TC150 | RemediationAction has approval fields | Automated | `tests/test_remediation_schema.py::TestRemediationActionApprovalFields` |
| TC151 | RemediationAction has execution fields | Automated | `tests/test_remediation_schema.py::TestRemediationActionExecutionFields` |
| TC152 | Server model has is_paused flag | Automated | `tests/test_actions_api.py::TestServerIsPausedFlag` |
| TC153 | PUT pause enables maintenance mode | Automated | `tests/test_actions_api.py::TestPauseServer` |
| TC154 | PUT unpause disables maintenance mode | Automated | `tests/test_actions_api.py::TestUnpauseServer` |
| TC155 | GET /actions lists all actions | Automated | `tests/test_actions_api.py::TestListActions` |
| TC156 | GET /actions/{id} returns details | Automated | `tests/test_actions_api.py::TestGetAction` |
| TC157 | Action on normal server auto-approves | Automated | `tests/test_actions_api.py::TestNormalServerAutoApproval` |
| TC158 | Action on paused server remains pending | Automated | `tests/test_actions_api.py::TestPausedServerPending` |
| TC159 | Command whitelist enforced | Automated | `tests/test_actions_api.py::TestCommandWhitelist` |
| TC160 | Heartbeat response includes commands | Automated | `tests/test_heartbeat_commands.py::TestApprovedActionInHeartbeatResponse` |
| TC161 | Heartbeat reports command results | Automated | `tests/test_heartbeat_commands.py::TestCommandResultsUpdateStatus` |
| TC162 | Agent executes whitelisted commands | Automated | `tests/test_agent_executor.py::TestCommandExecution` |
| TC163 | Agent rejects non-whitelisted commands | Automated | `tests/test_agent_executor.py::TestRejectsNonWhitelisted` |
| TC164 | Agent reports results in heartbeat | Automated | `tests/test_agent_executor.py::TestResultsInHeartbeat` |
| TC165 | POST approve approves action | Automated | `tests/test_action_approval.py::TestApproveAction` |
| TC166 | POST reject rejects action | Automated | `tests/test_action_approval.py::TestRejectAction` |
| TC167 | Cannot approve non-PENDING action | Automated | `tests/test_action_approval.py::TestCannotApproveNonPending` |
| TC168 | Pending panel shows PENDING actions | Automated | `PendingActionsPanel.test.tsx`, `PendingActionCard.test.tsx` |
| TC169 | Approve button triggers approval | Automated | `PendingActionCard.test.tsx::Approve button (AC4)` |
| TC170 | Reject button shows reason dialog | Automated | `PendingActionCard.test.tsx::Reject button (AC5)`, `RejectModal.test.tsx` |
| TC171 | Action history page accessible | Automated | `ActionsPage.test.tsx::Page accessibility (TC171)` |
| TC172 | Actions table displays correctly | Automated | `ActionsPage.test.tsx::Actions table display (TC172)` |
| TC176 | Filter by server works | Automated | `ActionsPage.test.tsx::Filter by server (TC176)` |
| TC177 | Filter by status works | Automated | `ActionsPage.test.tsx::Filter by status (TC177)` |
| TC178 | Action detail panel shows audit trail | Automated | `ActionsPage.test.tsx::Action detail panel (TC178)`, `ActionDetailPanel.test.tsx` |
| TC179 | Action detail shows rejection reason | Automated | `ActionsPage.test.tsx::Rejection details (TC179)`, `ActionDetailPanel.test.tsx` |
| TC180 | Pagination works | Automated | `ActionsPage.test.tsx::Pagination (TC180)` |
| TC181 | Empty state shown | Automated | `ActionsPage.test.tsx::Empty state (TC181)` |
| TC173 | Slack notification on failure | Automated | `tests/test_action_notifications.py::TestSendActionNotification::test_failure_sent_when_enabled` |
| TC174 | Success notification when enabled | Automated | `tests/test_action_notifications.py::TestSendActionNotification::test_success_sent_when_enabled` |
| TC175 | Action audit trail complete | Automated | `tests/test_actions_api.py::TestActionAuditTrail` |

## Test Counts by Story

| Story | Test Cases | Status |
|-------|------------|--------|
| US0023 | 3 (TC149-TC151) | Automated |
| US0029 | 3 (TC152-TC154) | Automated |
| US0024 | 6 (TC155-TC159, TC175) | Automated |
| US0025 | 2 (TC160-TC161) | Automated |
| US0027 | 3 (TC162-TC164) | Automated |
| US0026 | 3 (TC165-TC167) | Automated |
| US0030 | 3 (TC168-TC170) | Automated |
| US0031 | 8 (TC171-TC172, TC176-TC181) | Automated |
| US0032 | 2 (TC173-TC174) | Automated |
| **Total** | **33** | **33 Automated** |

## Test Type Distribution

| Test Type | Count | Percentage |
|-----------|-------|------------|
| Unit | 7 | 21% |
| Integration | 9 | 27% |
| API | 6 | 18% |
| E2E | 11 | 34% |
| **Total** | **33** | **100%** |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../../prd.md) |
| Epic | [EP0004](../../epics/EP0004-remediation.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Implementation Notes

EP0004 (Remediation Engine) is now **Complete**. All 33 test cases are automated with comprehensive coverage of the action queue, maintenance mode, heartbeat command channel, agent execution, approval workflow, dashboard panels, and Slack notifications.

### Key Implementation Dependencies

1. **US0023** must extend ActionStatus enum and add fields to RemediationAction
2. **US0029** must add is_paused to Server model
3. **US0024** depends on both US0023 and US0029
4. **US0025** modifies heartbeat request/response schemas
5. **US0027** adds command execution to agent

### Security Considerations

- Command whitelist is critical for preventing arbitrary code execution
- Agent must validate commands independently (defence in depth)
- Audit trail required for all actions

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-19 | Claude | Initial spec creation (Draft - EP0004 not implemented) |
| 2026-01-19 | Claude | Marked TC173, TC174 as automated; spec Complete (33/33 automated) |
