# Story Registry

**Last Updated:** 2026-01-29
**Personas Reference:** [User Personas](../personas.md)

## Summary

| Status | Count | Points |
|--------|-------|--------|
| Draft | 4 | 18 |
| Planned | 1 | 8 |
| Ready | 0 | 0 |
| In Progress | 0 | 0 |
| Review | 0 | 0 |
| Deferred | 1 | 5 |
| Done | 137 | 498 |
| **Total** | **143** | **529** |

## Archives

| Archive | Contents | Stories |
|---------|----------|---------|
| [v1.0 Stories](_archive-v1.md) | EP0001-EP0007 (Core, Alerting, Services, Remediation, Cost, Scanning) | 55 |
| [v2.0 Done](_archive-v2-done.md) | Completed v2.0 epics with dependency graphs | 73 |

---

## Current Work

### Draft Stories

**EP0013: Synchronous Command Execution** (3 pts remaining)

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| ~~[US0151](US0151-ssh-executor-service.md)~~ | ~~SSH Executor Service~~ | ~~8~~ | Done |
| ~~[US0152](US0152-remove-async-command-channel.md)~~ | ~~Remove Async Command Channel~~ | ~~3~~ | Done |
| ~~[US0153](US0153-synchronous-command-execution-api.md)~~ | ~~Synchronous Command Execution API~~ | ~~5~~ | Done |
| ~~[US0154](US0154-command-whitelist-enforcement.md)~~ | ~~Command Whitelist Enforcement~~ | ~~4~~ | Done |
| [US0155](US0155-command-execution-audit-trail.md) | Command Execution Audit Trail | 3 | Draft |

**EP0010: Configuration Management** (0 pts remaining) ✅

| Story | Title | Points |
|-------|-------|--------|
| ~~[US0119](US0119-apply-configuration-pack.md)~~ | ~~Apply Configuration Pack~~ | ~~8~~ (Done) |
| ~~[US0120](US0120-compliance-dashboard-widget.md)~~ | ~~Compliance Dashboard Widget~~ | ~~5~~ (Done) |
| ~~[US0121](US0121-pack-assignment-per-machine.md)~~ | ~~Pack Assignment per Machine~~ | ~~3~~ (Done) |
| ~~[US0122](US0122-configuration-drift-detection.md)~~ | ~~Configuration Drift Detection~~ | ~~5~~ (Done) |
| ~~[US0123](US0123-remove-configuration-pack.md)~~ | ~~Remove Configuration Pack~~ | ~~3~~ (Done) |

**Planned Stories**

| Story | Epic | Title | Points | Status |
|-------|------|-------|--------|--------|
| [US0183](US0183-historical-cost-tracking.md) | EP0005 | Historical Cost Tracking | 8 | Planned |

**Backlog** (17 pts)

| Story | Epic | Title | Points |
|-------|------|-------|--------|
| [US0188](US0188-remote-agent-mode-switch.md) | EP0013 | Remote Agent Mode Switch | 3 |
| [US0184](US0184-agent-auto-update.md) | EP0001 | Agent Auto-Update Mechanism | 8 |
| [US0185](US0185-service-restart-grace-period.md) | EP0003 | Service Restart Grace Period | 3 |
| [US0186](US0186-command-timeout-configuration.md) | EP0004 | Command Timeout Configuration | 3 |

### Deferred Stories

| Story | Epic | Title | Points | Reason |
|-------|------|-------|--------|--------|
| [US0156](US0156-real-time-command-output.md) | EP0013 | Real-Time Command Output | 5 | v2.1 - WebSocket complexity |

---

## Active Epic Summary

| Epic | Title | Total | Done | Remaining |
|------|-------|-------|------|-----------|
| EP0013 | Synchronous Command Execution | 6 | 4 | 2 (3 pts) |
| EP0010 | Configuration Management | 8 | 8 | 0 (0 pts) ✅ |

---

## Implementation Order

### Next: EP0013 Synchronous Command Execution

```
US0079 (SSH via Tailscale) ◄── prerequisite (Done)
  │
  └─► US0151 (SSH Executor) ── Done ✓
        │
        ├─► US0153 (Command API) ── Done ✓
        │     ├─► US0154 (Whitelist) ── Done ✓
        │     └─► US0155 (Audit Trail)
        │
        └─► US0152 (Remove Async) ── Done ✓
```

**Order:**
1. ~~US0151 - SSH Executor Service (8 pts)~~ ✓ Done
2. ~~US0153 - Command Execution API (5 pts)~~ ✓ Done
3. ~~US0154 - Command Whitelist Enforcement (4 pts)~~ ✓ Done
4. US0155 - Command Execution Audit Trail (3 pts)
5. US0152 - Remove Async Command Channel (3 pts)

### Then: EP0010 Configuration Management

```
US0116 (Pack Definitions) ── Done
  │
  ├─► US0117 (Compliance) ── Done
  │     ├─► US0118 (Diff View) ── Done
  │     │     └─► US0119 (Apply Pack)
  │     │           └─► US0123 (Remove Pack)
  │     ├─► US0120 (Dashboard Widget) ── Done
  │     └─► US0122 (Drift Detection) ── Done ◄── US0121 (Done)
  │
  └─► US0121 (Pack Assignment) ── Done
```

**Order:**
1. US0119 - Apply Configuration Pack (8 pts)
2. US0120 - Compliance Dashboard Widget (5 pts)
3. US0121 - Pack Assignment per Machine (3 pts)
4. US0122 - Configuration Drift Detection (5 pts)
5. US0123 - Remove Configuration Pack (3 pts)

---

## Estimation Summary

| Metric | Value |
|--------|-------|
| Total Story Points | 529 |
| Estimated Stories | 143 |
| Average Points/Story | 3.7 |
| Velocity (last sprint) | - |

---

## Notes

- Stories numbered globally (US0001, US0002, etc.)
- Story points based on Fibonacci (1, 2, 3, 5, 8, 13)
- v1.0 completed 2026-01-25
- v2.0 Phase 1 (Alpha) in progress
- EP0013 stories generated 2026-01-29
- See archives for historical implementation order and dependency graphs
