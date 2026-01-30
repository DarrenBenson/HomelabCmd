# EP0002: Alerting & Notifications

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 2
> **Story Points:** 28

## Summary

Implement proactive alerting when metrics exceed thresholds or servers go offline, with Slack notifications for immediate awareness. Includes alert lifecycle management (acknowledge, resolve) and alert history.

## Inherited Constraints

Constraints that flow from PRD and TRD to this Epic.

### From PRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Performance | Alert-to-notification < 2 minutes | Threshold checks must run frequently; Slack calls async |
| Performance | False positive rate < 5% | Consider sustained thresholds; tune defaults carefully |
| Design | Brand guide compliance | Alert UI follows phosphor colour scheme (red/amber/green) |
| Integration | Slack webhooks (existing UptimeKuma setup) | Match existing notification channel |

### From TRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Architecture | Background scheduler for checks | Use FastAPI background tasks or APScheduler |
| Tech Stack | Python/FastAPI | Alert service as FastAPI background task |
| Data Model | SQLite storage | Index alert table for status/severity queries |
| Protocol | Push model - alerts evaluated on heartbeat | Threshold check triggered by heartbeat receipt |

> **Note:** Inherited constraints MUST propagate to child Stories. Check Story templates include these constraints.

## Business Context

### Problem Statement

Currently, problems are discovered only when services fail noticeably (Plex stops working, Pi-hole stops resolving). There's no proactive alerting - issues are found reactively, often by family members complaining.

**PRD Reference:** [§2 Problem Statement](../prd.md#2-problem-statement)

### Value Proposition

Proactive alerts catch 90% of issues before they cause service outages. Slack notifications ensure awareness even when not looking at the dashboard. Reduces mean time to detection from hours to minutes.

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Issues detected before user report | 0% | 90% | Alert vs complaint correlation |
| Alert-to-notification latency | N/A | < 2 minutes | Timestamp comparison |
| False positive rate | N/A | < 5% | Alerts closed without action |
| Mean time to awareness | Hours | Minutes | Alert creation to ack time |

## Scope

### In Scope

- Threshold configuration (disk 80%/90%, RAM 85%, CPU 90%)
- Alert generation on threshold breach
- Alert on server offline (no heartbeat for 180s)
- Alert severity levels: critical, high, medium, low
- Alert status lifecycle: open → acknowledged → resolved
- Auto-resolve when condition clears
- Alert deduplication (one active alert per condition per server)
- Slack webhook integration
- Slack message formatting (severity colours, server info, suggestions)
- Recent alerts display on dashboard
- Alert list view with filtering
- Alert detail view
- Alert acknowledge and resolve actions
- Alert history

### Out of Scope

- Service-specific alerts (EP0003)
- Remediation suggestions (EP0004)
- Email notifications
- Discord/Telegram notifications
- Alert escalation
- On-call scheduling

### Affected User Personas

- **Darren (Homelab Operator):** Receives alerts, manages alert lifecycle
- **Sarah (Family Member):** Indirect benefit - fewer surprise outages

## Acceptance Criteria (Epic Level)

- [ ] Alerts generated when disk exceeds 80% (warning) and 90% (critical)
- [ ] Alerts generated when RAM exceeds 85%
- [ ] Alerts generated when CPU sustained above 90%
- [ ] Alerts generated when server offline for 180 seconds
- [ ] Slack notifications sent for critical and high severity alerts
- [ ] Alerts can be acknowledged from dashboard
- [ ] Alerts auto-resolve when condition clears
- [ ] No duplicate alerts for ongoing conditions
- [ ] Alert history viewable and filterable
- [ ] Slack message format matches brand guide examples

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| EP0001: Core Monitoring | Epic | Draft | Darren | Requires metrics data to evaluate thresholds |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| EP0003: Service Monitoring | Epic | Service alerts use same alert infrastructure |
| EP0004: Remediation | Epic | Remediation triggered by alerts |

## Risks & Assumptions

### Assumptions

- Slack webhook URL will be configured
- Default thresholds are appropriate (can be adjusted)
- Single Slack channel is sufficient
- Critical alerts warrant immediate notification

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Alert fatigue from too many notifications | Medium | High | Configurable thresholds; severity filtering |
| False positives (transient spikes) | Medium | Medium | Consider sustained threshold (e.g., 5 min) |
| Slack webhook rate limiting | Low | Medium | Queue notifications; batch if needed |
| Missing alerts due to hub downtime | Low | High | Document hub availability requirements |

## Technical Considerations

### Architecture Impact

- Alert entity in database
- Background scheduler for threshold checks
- Slack integration service
- WebSocket consideration for real-time alert updates (future)

### Integration Points

- Heartbeat → Threshold evaluation → Alert creation
- Alert creation → Slack notification
- Dashboard → Alert API
- Alert resolve → Slack update (optional)

### Data Considerations

- Alert table with history retention
- Index on server_id, status, severity, created_at
- Consider alert archival strategy for long-term history

**TRD Reference:** [§4 API Contracts - Alerts](../trd.md#4-api-contracts)

## Sizing & Effort

**Actual Story Count:** 7 stories (28 story points)

**Complexity Factors:**

- Threshold evaluation logic
- Alert deduplication
- Slack webhook integration
- Auto-resolve mechanism
- UI for alert management

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Primary alert recipient |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

| ID | Title | Points | Status |
|----|-------|--------|--------|
| [US0010](../stories/US0010-alert-schema.md) | Alert Entity and Database Schema | 2 | Done |
| [US0011](../stories/US0011-threshold-evaluation.md) | Threshold Evaluation and Alert Generation | 5 | Done |
| [US0012](../stories/US0012-alert-deduplication.md) | Alert Deduplication and Auto-Resolve | 3 | Done |
| [US0013](../stories/US0013-slack-integration.md) | Slack Webhook Integration | 3 | Done |
| [US0014](../stories/US0014-alert-api.md) | Alert API Endpoints | 5 | Done |
| [US0015](../stories/US0015-dashboard-alerts.md) | Dashboard Alert Display | 5 | Done |
| [US0016](../stories/US0016-alert-list-view.md) | Alert List and Detail Views | 5 | Done |

**Phase 1 Total:** 7 stories, 28 story points (all Done)

### Future Enhancements

| ID | Title | Points | Status |
|----|-------|--------|--------|
| [US0181](../stories/US0181-alert-sustained-duration.md) | Alert Sustained Duration Configuration | 5 | Done |
| [US0182](../stories/US0182-alert-auto-resolve-notifications.md) | Alert Auto-Resolve Notifications | 3 | Done |

**Enhancement Total:** 2 stories, 8 story points (2 Done)

### Won't Implement

| ID | Title | Reason |
|----|-------|--------|
| [US0187](../stories/US0187-slack-thread-reply-alerts.md) | Slack Thread Reply for Alert Notifications | Slack webhooks don't return message ID needed for threading; would require Web API |

## Test Plan

**Test Spec:** [TS0007: Alerting](../test-specs/TS0007-alerting.md)

| Test Spec | Coverage | Status |
|-----------|----------|--------|
| [TS0007](../test-specs/TS0007-alerting.md) | Alert schema, thresholds, Slack integration | Active |

## Open Questions

None - all questions resolved.

### Resolved Questions

- [x] Should alerts have configurable sustained duration before firing? - **Yes** - Created US0181. Sustained duration reduces false positives from transient spikes.
- [x] Notify on alert auto-resolve? - **Yes** - Created US0182. Users want closure when issues clear automatically.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation from PRD |
| 2026-01-18 | Claude | Added 7 user stories (US0010-US0016) |
| 2026-01-20 | Claude | Added Inherited Constraints and Test Plan sections; updated status to Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-29 | Claude | Resolved open questions: Added US0181 (sustained duration) and US0182 (auto-resolve notifications) as future enhancements |
