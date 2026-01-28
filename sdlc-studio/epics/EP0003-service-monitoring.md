# EP0003: Service Monitoring

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 3
> **Story Points:** 19

## Summary

Monitor systemd service status on each server, configure expected services per server, alert when critical services stop, and provide ability to queue service restarts from the dashboard.

## Business Context

### Problem Statement

Services like Plex, Pi-hole, and Nextcloud occasionally stop without warning. Currently, these failures are discovered when users (often family) notice the service isn't working. Manual SSH and `systemctl restart` is required for every incident.

**PRD Reference:** [§3 Feature Details - FR3](../prd.md#feature-details)

### Value Proposition

Immediate awareness when critical services stop. Ability to restart services from dashboard without SSH. Reduces service downtime and eliminates tedious manual intervention for common restarts.

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Service failure detection time | Hours (user report) | < 2 minutes | Alert timestamp |
| Manual SSH for service restart | Every incident | < 20% of incidents | Remediation log |
| Service visibility | None | 100% critical services | Dashboard audit |

## Scope

### In Scope

- Agent collects systemd service status (name, status, PID, memory, CPU)
- Expected services configuration per server
- Critical service flag (determines alert severity)
- Service status display in server detail view
- Service-down alerts (critical service = high severity alert)
- Service restart action (queued, requires approval in EP0004)
- Service status history

### Out of Scope

- Docker container monitoring (open question - future)
- Service auto-restart without approval (EP0004 handles approval workflow)
- Service configuration management
- Service logs viewing
- Service dependency mapping

### Affected User Personas

- **Darren (Homelab Operator):** Configures expected services, receives alerts, initiates restarts
- **Sarah (Family Member):** Indirect benefit - faster Plex/media service recovery

## Acceptance Criteria (Epic Level)

- [ ] Agent reports status of configured services in heartbeat
- [ ] Can configure expected services for each server
- [ ] Can mark services as critical or non-critical
- [ ] Service status visible in server detail view
- [ ] Alert generated when critical service stops (high severity)
- [ ] Alert generated when non-critical service stops (medium severity)
- [ ] Can queue service restart action from dashboard
- [ ] Service restart action integrates with remediation queue (EP0004)

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| EP0001: Core Monitoring | Epic | Draft | Darren | Agent infrastructure |
| EP0002: Alerting | Epic | Draft | Darren | Alert infrastructure |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| EP0004: Remediation | Epic | Service restart is first remediation action |

## Risks & Assumptions

### Assumptions

- All monitored services are systemd services
- Service names are consistent (e.g., `plex` not `plexmediaserver`)
- Agent has permission to query systemctl status
- Service restart command is consistent (`systemctl restart <service>`)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Service name variations across servers | Medium | Low | Document naming conventions; allow aliases |
| Docker services not visible via systemd | High | Medium | Document limitation; plan Docker support |
| False service-down alerts (transient restarts) | Low | Medium | Brief grace period before alerting |
| Agent lacks permission to query services | Low | Medium | Document agent requirements |

## Technical Considerations

### Architecture Impact

- ExpectedService entity in database
- ServiceStatus entity for history
- Agent service check integration
- Service-related API endpoints

### Integration Points

- Agent → systemctl status → Heartbeat payload
- Heartbeat → Service status evaluation → Alert creation
- Dashboard → Service status display
- Dashboard → Restart action → Remediation queue

### Data Considerations

- ServiceStatus table for historical tracking
- Expected services stored per server
- Consider retention policy for service status history

**TRD Reference:** [§4 API Contracts - Services](../trd.md#4-api-contracts)

## Sizing & Effort

**Story Count:** 6 stories, 19 story points

**Complexity Factors:**

- Agent enhancement for service monitoring
- Expected services configuration UI
- Integration with alerting system
- Service restart action (bridges to EP0004)

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Service uptime for family |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

| ID | Title | Status | Points |
|----|-------|--------|--------|
| [US0017](../stories/US0017-service-schema.md) | Service Schema and Database Tables | Done | 2 |
| [US0018](../stories/US0018-agent-service-collection.md) | Agent Service Status Collection | Done | 5 |
| [US0019](../stories/US0019-expected-services-api.md) | Expected Services Configuration API | Done | 3 |
| [US0020](../stories/US0020-service-status-display.md) | Service Status Display in Server Detail | Done | 3 |
| [US0021](../stories/US0021-service-alerts.md) | Service-Down Alert Generation | Done | 3 |
| [US0022](../stories/US0022-service-restart-action.md) | Service Restart Action | Done | 3 |

**Total:** 6 stories, 19 story points

### Story Dependency Graph

```
US0017 (Service Schema)
  └─► US0018 (Agent Collection)
        └─► US0021 (Service Alerts)
  └─► US0019 (Expected Services API)
        └─► US0020 (Status Display)
              └─► US0022 (Restart Action)
```

### Implementation Order

1. **US0017** - Service Schema (foundation)
2. **US0018** - Agent Service Collection
3. **US0019** - Expected Services API
4. **US0020** - Service Status Display
5. **US0021** - Service-Down Alerts
6. **US0022** - Restart Action (bridges to EP0004)

## Open Questions

- [ ] Docker container monitoring approach - Owner: Darren
- [ ] Service restart grace period before re-alerting - Owner: Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation from PRD |
| 2026-01-20 | Claude | Updated story statuses to Done; epic complete |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
