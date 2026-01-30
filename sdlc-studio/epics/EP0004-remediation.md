# EP0004: Remediation Engine

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 4
> **Story Points:** 27

## Summary

Implement an action queue system where remediation actions (service restart, log clearing) can be queued and executed on target servers. Uses a simplified operational model based on server maintenance mode.

## Operational Model

| Server State | User Action | System Auto-Action |
|--------------|-------------|-------------------|
| Normal (`is_paused=false`) | Execute immediately | Execute immediately |
| Maintenance (`is_paused=true`) | Requires approval | Requires approval |

**Normal mode (default):** Actions execute immediately without approval. Actions are created with `status=APPROVED` and `approved_by="auto"`.

**Maintenance mode:** Server flagged with `is_paused=true`. All actions require manual approval before execution.

## Business Context

### Problem Statement

Every issue currently requires SSH access, manual diagnosis, and manual remediation. Even simple service restarts require opening a terminal, connecting to the right server, and running commands. This is tedious and time-consuming.

**PRD Reference:** [§3 Feature Details - FR6 Remediation Engine](../prd.md#remediation-engine-fr6)

### Value Proposition

One-click remediation for common issues. Servers in normal mode get immediate action; servers in maintenance mode require approval for safety. Reduces mean time to remediation from 10+ minutes to under 1 minute. Complete audit trail of all actions taken.

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Time to remediate common issues | 10+ minutes | < 1 minute | Action timestamps |
| SSH sessions for remediation | All issues | < 20% of issues | Remediation log |
| Remediation success rate | N/A | > 95% | Action outcomes |
| Actions with audit trail | 0% | 100% | Database records |

## Scope

### In Scope

- Action types: restart_service, clear_logs, custom
- Action queue with status lifecycle: pending → approved → executing → completed/failed
- Server maintenance mode flag (`is_paused`)
- Immediate execution for normal servers
- Approval workflow for paused servers
- Action delivery via heartbeat response (pending commands)
- Result reporting via heartbeat request
- Agent command execution
- Complete audit log (who, what, when, result)
- Command whitelist for security
- Pending actions display on dashboard
- Action history view
- Approve/reject UI for maintenance mode actions

### Out of Scope

- Package update management (separate feature)
- Custom script management
- Rollback capability
- Scheduled actions
- Bulk actions across multiple servers
- Action dependencies
- Per-action-type auto-approve configuration

### Affected User Personas

- **Darren (Homelab Operator):** Triggers actions, manages maintenance mode, approves actions when required

## Acceptance Criteria (Epic Level)

- [ ] Actions can be queued from dashboard (e.g., restart service)
- [ ] Normal servers: actions execute immediately
- [ ] Paused servers: actions require approval
- [ ] Pending actions displayed with approve/reject buttons
- [ ] Approved actions delivered to agents via heartbeat response
- [ ] Agent executes approved commands and reports results
- [ ] Completed/failed status visible in dashboard
- [ ] Complete audit trail for all actions
- [ ] Slack notification on action failure
- [ ] Only whitelisted commands can be executed

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| EP0001: Core Monitoring | Epic | Draft | Darren | Agent command channel |
| EP0002: Alerting | Epic | Draft | Darren | Actions linked to alerts |
| EP0003: Service Monitoring | Epic | Draft | Darren | Service restart is primary action |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | Terminal epic in current roadmap |

## Risks & Assumptions

### Assumptions

- Agents have permission to execute remediation commands
- Command whitelist is sufficient for common operations
- 60-second heartbeat interval is acceptable for command delivery
- Single command execution at a time is adequate

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Command execution fails | Medium | Medium | Comprehensive error handling and reporting |
| Unintended action on normal server | Low | Medium | Clear UI indication of server mode; audit logging |
| Agent unavailable when command queued | Medium | Low | Commands persist until agent reconnects |
| Security vulnerability via command injection | Low | Critical | Strict whitelist; parameterised commands |

## Technical Considerations

### Architecture Impact

- Server model extended with `is_paused` flag
- RemediationAction entity in database
- Heartbeat request includes command results
- Heartbeat response includes pending commands
- Agent command execution module

### Integration Points

- Alert → Suggested remediation → Action queue
- Dashboard → Trigger action → Immediate or pending based on server mode
- Heartbeat response → Pending commands
- Heartbeat request → Command results
- Failure → Slack notification

### Data Considerations

- RemediationAction table with full audit trail
- Link to triggering alert (optional)
- Execution output and error capture
- Long-term audit log retention

### Key Schema Changes

**Server Model:**
```python
is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

**New Endpoints:**
- `PUT /api/v1/servers/{id}/pause` - Enable maintenance mode
- `PUT /api/v1/servers/{id}/unpause` - Disable maintenance mode

**TRD Reference:** [§4 API Contracts - Actions](../trd.md#4-api-contracts)

## Sizing & Effort

**Story Count:** 9 stories, 27 story points

**Complexity Factors:**

- Bidirectional agent communication via heartbeat
- Security considerations (command whitelist)
- State machine for action lifecycle
- Maintenance mode logic
- Audit logging

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Reduce manual remediation effort |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

| ID | Title | Status | Points |
|----|-------|--------|--------|
| [US0023](../stories/US0023-remediation-action-schema.md) | Extended Remediation Action Schema | Draft | 2 |
| [US0029](../stories/US0029-server-maintenance-mode.md) | Server Maintenance Mode | Draft | 2 |
| [US0024](../stories/US0024-action-queue-api.md) | Action Queue API | Draft | 3 |
| [US0025](../stories/US0025-heartbeat-command-channel.md) | Heartbeat Command Channel | Draft | 5 |
| [US0027](../stories/US0027-agent-command-execution.md) | Agent Command Execution | Draft | 5 |
| [US0026](../stories/US0026-maintenance-mode-approval.md) | Maintenance Mode Approval | Draft | 2 |
| [US0030](../stories/US0030-pending-actions-panel.md) | Pending Actions Panel | Draft | 3 |
| [US0031](../stories/US0031-action-history-view.md) | Action History View | Draft | 3 |
| [US0032](../stories/US0032-action-slack-notifications.md) | Action Execution Slack Notifications | Draft | 2 |

**Total:** 9 stories, 27 story points

### Story Dependency Graph

```
US0023 (Action Schema) → US0029 (Maintenance Mode) → US0024 (API)
                                                          │
                    ┌─────────────────────────────────────┼───────────────────┐
                    ↓                                     ↓                   ↓
              US0025 (Heartbeat)                    US0026 (Approval)    US0031 (History)
                    ↓                                     ↓
              US0027 (Agent)                        US0030 (Panel)
                    ↓
              US0032 (Slack)
```

### Implementation Order

1. **US0023** - Extended Remediation Action Schema (foundation)
2. **US0029** - Server Maintenance Mode
3. **US0024** - Action Queue API
4. **US0025** - Heartbeat Command Channel (delivery + result reporting)
5. **US0027** - Agent Command Execution
6. **US0026** - Maintenance Mode Approval
7. **US0030** - Pending Actions Panel
8. **US0031** - Action History View
9. **US0032** - Action Execution Slack Notifications

## Action Flows

### Normal Mode (Happy Path)

```
User clicks Restart → Action created (status=APPROVED, approved_by="auto")
→ Next heartbeat delivers command → Agent executes
→ Next heartbeat reports result → Status=COMPLETED/FAILED
→ Slack notification (if failure)
```

### Maintenance Mode

```
User pauses server → is_paused=true
User clicks Restart → Action created (status=PENDING)
→ Appears in Pending Actions Panel
User clicks Approve → status=APPROVED
→ [Normal execution flow continues]
```

## Open Questions

None - all questions resolved.

### Resolved Questions

- [x] Command timeout configuration - **Yes, needed** - Created US0186. Configurable timeouts per command type with override capability.
- [x] How to handle commands that require sudo - **Resolved:** EP0015 (Per-Host Credential Management) implements sudo password storage and support in SSH executor.

### Future Enhancements

| ID | Title | Points | Status |
|----|-------|--------|--------|
| [US0186](../stories/US0186-command-timeout-configuration.md) | Command Timeout Configuration | 3 | Draft |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation from PRD |
| 2026-01-19 | Claude | Simplified to maintenance mode model (removed auto-approve config, merged US0028 into US0025) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-29 | Claude | Resolved open questions: Timeout → US0186 created, Sudo → EP0015 |
