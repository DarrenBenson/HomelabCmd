# US0185: Service Restart Grace Period

> **Status:** Draft
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a grace period after restarting a service before it can trigger a new alert
**So that** I don't get alert spam when services take time to fully start

## Context

### Persona Reference

**Darren** - Technical professional managing services across multiple servers. Needs reliable alerting without noise from expected restart behaviour.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

When a service is restarted (either manually or via remediation), it may take several seconds to fully initialise. During this period, the service might briefly appear as "stopped" or "starting", which can trigger false alerts. A grace period after restart would suppress alerts during the expected startup window.

---

## Acceptance Criteria

### AC1: Configurable grace period

- **Given** I am configuring service monitoring settings
- **When** I view service alert settings
- **Then** I can configure a "restart grace period" in seconds
- **And** the default is 60 seconds

### AC2: Grace period after manual restart

- **Given** a service with a 60-second grace period
- **When** I trigger a restart via the UI
- **Then** no "service stopped" alert fires for 60 seconds
- **And** the service shows "restarting" status during grace period

### AC3: Grace period after remediation restart

- **Given** a service restarted via remediation action
- **When** the restart command completes
- **Then** the grace period begins automatically
- **And** no alert fires during the grace period

### AC4: Alert fires after grace period if still down

- **Given** a service was restarted with a 60-second grace period
- **When** 60 seconds pass and the service is still not running
- **Then** a "service stopped" alert fires
- **And** the alert includes "failed to start after restart"

### AC5: Grace period visible in UI

- **Given** a service is in its grace period
- **When** I view the service status
- **Then** I see "Restarting (Xs remaining)" status
- **And** the status clears when grace period ends

---

## Scope

### In Scope

- Global grace period setting (seconds)
- Grace period tracking after restart actions
- Alert suppression during grace period
- "Restarting" status display
- Alert after grace period if still down

### Out of Scope

- Per-service grace period configuration
- Grace period for initial agent startup
- Automatic grace period detection based on service type

---

## Technical Notes

### Implementation Approach

1. **Track restart timestamp:**
   ```python
   class ServiceState(Base):
       # Existing fields...
       last_restart_at: datetime | None = None
   ```

2. **Alert evaluation update:**
   ```python
   def should_alert_service_down(service: Service) -> bool:
       if service.last_restart_at:
           grace_period = get_config('service_restart_grace_seconds', 60)
           if datetime.utcnow() - service.last_restart_at < timedelta(seconds=grace_period):
               return False  # Still in grace period
       return service.status == 'stopped'
   ```

3. **UI status during grace period:**
   ```tsx
   function getServiceStatus(service: Service) {
     if (service.last_restart_at && isInGracePeriod(service.last_restart_at)) {
       const remaining = getGracePeriodRemaining(service.last_restart_at);
       return `Restarting (${remaining}s)`;
     }
     return service.status;
   }
   ```

### Files to Modify

- `backend/src/homelab_cmd/db/models/service.py` - Add last_restart_at
- `backend/src/homelab_cmd/services/alerting.py` - Grace period check
- `backend/src/homelab_cmd/api/routes/services.py` - Set restart timestamp
- `backend/src/homelab_cmd/api/routes/config.py` - Grace period setting
- `frontend/src/components/ServiceStatus.tsx` - Restarting display
- Alembic migration for last_restart_at

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Service stops during grace period (not restart-related) | Grace period still applies |
| 2 | Multiple restarts in quick succession | Reset grace period on each restart |
| 3 | Hub restarts during grace period | Grace period data lost, normal alerting resumes |
| 4 | Grace period set to 0 | Immediate alerting (no grace period) |
| 5 | Service starts before grace period ends | Clear grace period, show "running" |

---

## Test Scenarios

- [ ] No alert during grace period after restart
- [ ] Alert fires after grace period if service still down
- [ ] Grace period resets on subsequent restart
- [ ] UI shows "Restarting" status with countdown
- [ ] Grace period setting persists
- [ ] Service running before grace period ends clears status

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0021 | Service-down alerts | Done |
| US0022 | Service restart action | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium - timestamp tracking, alert logic update

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0003 open question |
