# Story Registry

**Last Updated:** 2026-02-17
**Personas Reference:** [User Personas](../personas.md)

## Summary

| Status | Count | Points |
|--------|-------|--------|
| Draft | 0 | 0 |
| Planned | 0 | 0 |
| Ready | 0 | 0 |
| In Progress | 0 | 0 |
| Review | 0 | 0 |
| Deferred | 0 | 0 |
| Won't Implement | 1 | 5 |
| Done | 157 | 577 |
| **Total** | **158** | **582** |

## Archives

| Archive | Contents | Stories |
|---------|----------|---------|
| [v1.0 Stories](_archive-v1.md) | EP0001-EP0007 (Core, Alerting, Services, Remediation, Cost, Scanning) | 55 |
| [v2.0 Done](_archive-v2-done.md) | Completed v2.0 epics with dependency graphs | 77 |

---

## Current Work

### Recently Completed

**EP0013: Synchronous Command Execution** ✅

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| ~~[US0151](US0151-ssh-executor-service.md)~~ | ~~SSH Executor Service~~ | ~~8~~ | Done |
| ~~[US0152](US0152-remove-async-command-channel.md)~~ | ~~Remove Async Command Channel~~ | ~~3~~ | Done |
| ~~[US0153](US0153-synchronous-command-execution-api.md)~~ | ~~Synchronous Command Execution API~~ | ~~5~~ | Done |
| ~~[US0154](US0154-command-whitelist-enforcement.md)~~ | ~~Command Whitelist Enforcement~~ | ~~4~~ | Done |
| ~~[US0155](US0155-command-execution-audit-trail.md)~~ | ~~Command Execution Audit Trail~~ | ~~3~~ | Done |
| ~~[US0156](US0156-real-time-command-output.md)~~ | ~~Real-Time Command Output~~ | ~~5~~ | Done |
| ~~[US0188](US0188-remote-agent-mode-switch.md)~~ | ~~Remote Agent Mode Switch~~ | ~~3~~ | Done |

**EP0010: Configuration Management** ✅

| Story | Title | Points |
|-------|-------|--------|
| ~~[US0119](US0119-apply-configuration-pack.md)~~ | ~~Apply Configuration Pack~~ | ~~8~~ (Done) |
| ~~[US0120](US0120-compliance-dashboard-widget.md)~~ | ~~Compliance Dashboard Widget~~ | ~~5~~ (Done) |
| ~~[US0121](US0121-pack-assignment-per-machine.md)~~ | ~~Pack Assignment per Machine~~ | ~~3~~ (Done) |
| ~~[US0122](US0122-configuration-drift-detection.md)~~ | ~~Configuration Drift Detection~~ | ~~5~~ (Done) |
| ~~[US0123](US0123-remove-configuration-pack.md)~~ | ~~Remove Configuration Pack~~ | ~~3~~ (Done) |

**EP0005: Cost Tracking** - US0183 ✅

| Story | Title | Points |
|-------|-------|--------|
| ~~[US0183](US0183-historical-cost-tracking.md)~~ | ~~Historical Cost Tracking~~ | ~~8~~ (Done) |

**EP0004: Remediation** - US0186 ✅

| Story | Title | Points |
|-------|-------|--------|
| ~~[US0186](US0186-command-timeout-configuration.md)~~ | ~~Command Timeout Configuration~~ | ~~3~~ (Done) |

**EP0001: Core Monitoring** - US0184, US0198 ✅

| Story | Title | Points |
|-------|-------|--------|
| ~~[US0184](US0184-agent-auto-update.md)~~ | ~~Agent Auto-Update Mechanism~~ | ~~8~~ (Done) |
| ~~[US0198](US0198-package-held-back-detection.md)~~ | ~~Package Held-Back Detection~~ | ~~3~~ (Done) |

**EP0003: Service Monitoring** - US0185 ✅

| Story | Title | Points |
|-------|-------|--------|
| ~~[US0185](US0185-service-restart-grace-period.md)~~ | ~~Service Restart Grace Period~~ | ~~3~~ (Done) |

**EP0014: Docker Container Monitoring** - US0157, US0158, US0159, US0160, US0161, US0162, US0163 ✅

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| ~~[US0157](US0157-docker-detection.md)~~ | ~~Docker Detection~~ | ~~3~~ | Done |
| ~~[US0158](US0158-container-listing.md)~~ | ~~Container Listing~~ | ~~5~~ | Done |
| ~~[US0159](US0159-container-widget.md)~~ | ~~Container Widget~~ | ~~5~~ | Done |
| ~~[US0160](US0160-container-start-action.md)~~ | ~~Container Start Action~~ | ~~3~~ | Done |
| ~~[US0161](US0161-container-stop-action.md)~~ | ~~Container Stop Action~~ | ~~3~~ | Done |
| ~~[US0162](US0162-container-restart-action.md)~~ | ~~Container Restart Action~~ | ~~2~~ | Done |
| ~~[US0163](US0163-container-status-heartbeat.md)~~ | ~~Container Service Status in Heartbeat~~ | ~~3~~ | Done |

### Planned (0 pts)

None - all stories completed or deferred.

### Deferred Stories

None - US0156 was implemented using SSE instead of WebSockets.

### Won't Implement

| Story | Epic | Title | Points | Reason |
|-------|------|-------|--------|--------|
| [US0187](US0187-slack-thread-reply-alerts.md) | EP0002 | Slack Thread Reply for Alert Notifications | 5 | Complexity vs value |

---

## Recently Completed Epics

| Epic | Title | Total | Done | Status |
|------|-------|-------|------|--------|
| EP0019 | Unified Device Discovery | 5 | 5 | ✅ Complete |
| EP0014 | Docker Container Monitoring | 7 | 7 | ✅ Complete |
| EP0013 | Synchronous Command Execution | 7 | 7 | ✅ Complete |
| EP0010 | Configuration Management | 8 | 8 | ✅ Complete |
| EP0011 | Advanced Dashboard UI | 7 | 7 | ✅ Complete |
| EP0012 | Widget-Based Detail View | 14 | 14 | ✅ Complete |
| EP0007 | Analytics & Reporting | 3 | 3 | ✅ Complete |

---

## Implementation Order

### Complete: EP0013 Synchronous Command Execution ✅

```
US0079 (SSH via Tailscale) ◄── prerequisite (Done)
  │
  └─► US0151 (SSH Executor) ── Done ✓
        │
        ├─► US0153 (Command API) ── Done ✓
        │     ├─► US0154 (Whitelist) ── Done ✓
        │     └─► US0155 (Audit Trail) ── Done ✓
        │
        └─► US0152 (Remove Async) ── Done ✓
```

**Order:**
1. ~~US0151 - SSH Executor Service (8 pts)~~ ✓ Done
2. ~~US0153 - Command Execution API (5 pts)~~ ✓ Done
3. ~~US0154 - Command Whitelist Enforcement (4 pts)~~ ✓ Done
4. ~~US0155 - Command Execution Audit Trail (3 pts)~~ ✓ Done
5. ~~US0152 - Remove Async Command Channel (3 pts)~~ ✓ Done

### Complete: EP0010 Configuration Management ✅

```
US0116 (Pack Definitions) ── Done ✓
  │
  ├─► US0117 (Compliance) ── Done ✓
  │     ├─► US0118 (Diff View) ── Done ✓
  │     │     └─► US0119 (Apply Pack) ── Done ✓
  │     │           └─► US0123 (Remove Pack) ── Done ✓
  │     ├─► US0120 (Dashboard Widget) ── Done ✓
  │     └─► US0122 (Drift Detection) ── Done ✓ ◄── US0121 (Done ✓)
  │
  └─► US0121 (Pack Assignment) ── Done ✓
```

**Order:**
1. ~~US0119 - Apply Configuration Pack (8 pts)~~ ✓ Done
2. ~~US0120 - Compliance Dashboard Widget (5 pts)~~ ✓ Done
3. ~~US0121 - Pack Assignment per Machine (3 pts)~~ ✓ Done
4. ~~US0122 - Configuration Drift Detection (5 pts)~~ ✓ Done
5. ~~US0123 - Remove Configuration Pack (3 pts)~~ ✓ Done

---

## Estimation Summary

| Metric | Value |
|--------|-------|
| Total Story Points | 582 |
| Completed Story Points | 580 |
| Estimated Stories | 158 |
| Average Points/Story | 3.7 |
| Velocity (last sprint) | - |

---

## Notes

- Stories numbered globally (US0001, US0002, etc.)
- Story points based on Fibonacci (1, 2, 3, 5, 8, 13)
- v1.0 completed 2026-01-25
- v2.0 Phase 1 (Alpha) complete
- EP0013 stories generated 2026-01-29, completed 2026-01-30
- EP0010 stories completed 2026-01-30
- EP0018 stories (US0189-US0192) generated 2026-01-30 - Dashboard UX Simplification (retrofitted)
- EP0019 stories (US0193-US0197) generated 2026-01-31 - Unified Device Discovery (Single Pane of Glass) - retrofitted from existing implementation, all Done
- 2026-01-31: US0184 (Agent Auto-Update), US0185 (Service Restart Grace Period), US0186 (Command Timeout Configuration), US0188 (Remote Agent Mode Switch) all completed
- 2026-02-01: US0156 (Real-Time Command Output) discovered as implemented via SSE - moved from Deferred to Done
- 2026-02-01: US0198 (Package Held-Back Detection) created and marked Done - discovered during PRD review
- 2026-02-01: US0157 (Docker Detection) implemented - first story in EP0014
- 2026-02-01: US0158 (Container Listing) implemented - API endpoint for listing containers via SSH
- 2026-02-01: US0159 (Container Widget) implemented - Frontend widget for displaying Docker containers
- 2026-02-01: US0160 (Container Start Action) implemented - Start stopped containers from widget
- 2026-02-01: US0161 (Container Stop Action) implemented - Stop running containers with confirmation dialog
- 2026-02-01: US0162 (Container Restart Action) implemented - Restart containers with single button click
- 2026-02-01: US0163 (Container Service Status in Heartbeat) implemented - docker_status in heartbeat with container count badge
- 2026-02-01: EP0014 (Docker Container Monitoring) epic complete - all 7 stories done
- See archives for historical implementation order and dependency graphs
