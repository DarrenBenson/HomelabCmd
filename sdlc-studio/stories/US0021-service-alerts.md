# US0021: Service-Down Alert Generation

> **Status:** Done
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3
> **Plan:** [PL0025: Service-Down Alert Generation](../plans/PL0025-service-alerts.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** alerts generated when monitored services stop
**So that** I'm immediately aware when Plex or other critical services go down

## Context

### Persona Reference

**Darren** - Family complains when Plex is down. Needs proactive notification before users notice.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When a heartbeat reports a service as stopped or failed, and that service is in the expected services list (enabled), an alert is generated. Critical services generate high severity alerts; non-critical services generate medium severity alerts. Alerts use the existing alert infrastructure from EP0002.

## Acceptance Criteria

### AC1: Alert on critical service stopped

- **Given** "plex" is configured as critical for "omv-mediaserver"
- **When** heartbeat reports plex status as "stopped"
- **Then** a high severity "service" alert is created

### AC2: Alert on non-critical service stopped

- **Given** "sonarr" is configured as non-critical for "omv-mediaserver"
- **When** heartbeat reports sonarr status as "stopped"
- **Then** a medium severity "service" alert is created

### AC3: No alert for unconfigured services

- **Given** "unknown-service" is not in expected services
- **When** heartbeat reports any status for it
- **Then** no alert is generated

### AC4: No alert for disabled services

- **Given** "sonarr" is configured but enabled=false
- **When** heartbeat reports sonarr as "stopped"
- **Then** no alert is generated

### AC5: Alert includes service name

- **Given** a service alert is created
- **When** viewing the alert
- **Then** the alert title includes the service name

### AC6: Slack notification for critical service

- **Given** a critical service stops
- **When** the alert is created
- **Then** a Slack notification is sent (via US0013)

## Scope

### In Scope

- Service status evaluation on heartbeat
- Alert creation for stopped/failed services
- Severity based on is_critical flag
- Integration with existing alert system (EP0002)
- Alert deduplication (one alert per service per server)
- Auto-resolve when service comes back up

### Out of Scope

- Remediation suggestions (EP0004)
- Service restart from alert
- Alert for service "unknown" status (too noisy)

## Technical Notes

### Service Alert Evaluation

```python
async def evaluate_service_status(server_id: str, services: list[ServiceStatus]):
    expected = await get_expected_services(server_id)

    for service in services:
        expected_service = expected.get(service.name)
        if not expected_service or not expected_service.enabled:
            continue

        if service.status in ['stopped', 'failed']:
            severity = 'high' if expected_service.is_critical else 'medium'
            await create_alert_if_not_exists(
                server_id=server_id,
                alert_type='service',
                severity=severity,
                title=f"Service {service.name} is {service.status}",
                message=f"Expected service {service.name} on {server_id} is {service.status}",
                service_name=service.name
            )
        elif service.status == 'running':
            # Auto-resolve any existing service alert
            await auto_resolve_service_alert(server_id, service.name)
```

### API Contracts

Uses existing alert endpoints from US0014. Alert type is 'service' instead of 'disk', 'memory', etc.

**Alert payload addition:**
```json
{
  "id": 99,
  "server_id": "omv-mediaserver",
  "alert_type": "service",
  "severity": "high",
  "title": "Service plex is stopped",
  "service_name": "plex",
  ...
}
```

**TRD Reference:** [§4 API Contracts - Alerts](../trd.md#4-api-contracts)

### Data Requirements

- Alert includes service_name field for service alerts
- Deduplication key: server_id + alert_type + service_name

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Service flaps (stop→start quickly) | Alert created, then auto-resolved |
| Multiple services down | One alert per service |
| Service was never running | Alert on first "stopped" status |
| Service status "unknown" | No alert (might be config error) |
| Expected service deleted | Existing alert remains, no new alerts |

## Test Scenarios

- [ ] Critical service stopped creates high severity alert
- [ ] Non-critical service stopped creates medium severity alert
- [ ] Unconfigured service stopped creates no alert
- [ ] Disabled service stopped creates no alert
- [ ] Alert title includes service name
- [ ] Slack notification sent for critical service
- [ ] No duplicate alerts for same service
- [ ] Alert auto-resolves when service starts

## Definition of Done


**Story-specific additions:**

- [ ] All service status scenarios tested
- [ ] Slack message format includes service name

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0010: Alert Schema | Story | Draft |
| US0011: Threshold Evaluation | Story | Draft |
| US0012: Alert Deduplication | Story | Draft |
| US0018: Agent Service Collection | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Medium - integration with existing alert system

## Open Questions

- [ ] Grace period before alerting (service might restart quickly) - Owner: Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
