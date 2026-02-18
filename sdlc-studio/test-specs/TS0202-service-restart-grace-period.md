# TS0202: Service Restart Grace Period Tests

> **Story:** [US0185: Service Restart Grace Period](../stories/US0185-service-restart-grace-period.md)
> **Plan:** [PL0202: Service Restart Grace Period](../plans/PL0202-service-restart-grace-period.md)
> **Status:** Done
> **Created:** 2026-01-31

## Test Summary

| Type | Count | Priority |
|------|-------|----------|
| Unit Tests | 15 | P0-P1 |
| Integration Tests | 5 | P0-P1 |
| Frontend Tests | 6 | P0-P1 |
| **Total** | **26** | |

---

## Unit Tests - Backend

### Suite: AlertingService Grace Period

**File:** `backend/tests/test_alerting_grace_period.py`

| ID | Test Case | AC | Priority | Status |
|----|-----------|---|----------|--------|
| TS0202-U01 | Service in grace period - no alert fires | AC2 | P0 | [ ] |
| TS0202-U02 | Grace period expired - alert fires | AC4 | P0 | [ ] |
| TS0202-U03 | Grace period with service running - no alert | AC2 | P1 | [ ] |
| TS0202-U04 | Grace period zero - immediate alerting | Edge 4 | P1 | [ ] |
| TS0202-U05 | Multiple restarts reset grace period | Edge 2 | P1 | [ ] |
| TS0202-U06 | Service starts before grace ends - clear grace | Edge 5 | P1 | [ ] |
| TS0202-U07 | Alert message includes "failed to start after restart" | AC4 | P1 | [ ] |
| TS0202-U08 | Grace period check with no last_restart_at | - | P1 | [ ] |

### Suite: Config Grace Period Setting

**File:** `backend/tests/test_config_grace_period.py`

| ID | Test Case | AC | Priority | Status |
|----|-----------|---|----------|--------|
| TS0202-U09 | Default grace period is 60 seconds | AC1 | P0 | [ ] |
| TS0202-U10 | Grace period setting persists | AC1 | P1 | [ ] |
| TS0202-U11 | Grace period accepts custom value | AC1 | P1 | [ ] |
| TS0202-U12 | Grace period included in config response | AC1 | P1 | [ ] |

### Suite: Service Restart Timestamp

**File:** `backend/tests/test_service_restart_timestamp.py`

| ID | Test Case | AC | Priority | Status |
|----|-----------|---|----------|--------|
| TS0202-U13 | Restart action sets last_restart_at | AC2 | P0 | [ ] |
| TS0202-U14 | Remediation restart sets last_restart_at | AC3 | P0 | [ ] |
| TS0202-U15 | last_restart_at persists in database | Edge 3 | P1 | [ ] |

---

## Integration Tests - Backend

### Suite: Service Restart Flow

**File:** `backend/tests/test_api_service_restart_flow.py`

| ID | Test Case | AC | Priority | Status |
|----|-----------|---|----------|--------|
| TS0202-I01 | Full restart flow with grace period | AC2,AC3 | P0 | [ ] |
| TS0202-I02 | Heartbeat during grace period - service shows stopped but no alert | AC2 | P0 | [ ] |
| TS0202-I03 | Heartbeat after grace period - alert fires | AC4 | P0 | [ ] |
| TS0202-I04 | Service recovers during grace period | Edge 5 | P1 | [ ] |
| TS0202-I05 | Grace period survives hub restart | Edge 3 | P1 | [ ] |

---

## Frontend Tests

### Suite: Service Status Countdown

**File:** `frontend/src/__tests__/components/ServiceStatus.test.tsx`

| ID | Test Case | AC | Priority | Status |
|----|-----------|---|----------|--------|
| TS0202-F01 | Shows "Restarting (Xs remaining)" during grace period | AC5 | P0 | [ ] |
| TS0202-F02 | Countdown updates in real-time | AC5 | P1 | [ ] |
| TS0202-F03 | Status clears when grace period ends | AC5 | P1 | [ ] |
| TS0202-F04 | Status shows "running" when service starts | Edge 5 | P1 | [ ] |
| TS0202-F05 | No countdown when last_restart_at is null | - | P1 | [ ] |
| TS0202-F06 | Countdown handles zero grace period | Edge 4 | P2 | [ ] |

---

## Test Data & Fixtures

### Service Fixtures

```python
# backend/tests/fixtures/service_fixtures.py

EXPECTED_SERVICE_FIXTURE = {
    "server_id": "test-server-1",
    "service_name": "docker.service",
    "display_name": "Docker",
    "is_critical": True,
    "enabled": True,
}

SERVICE_IN_GRACE_PERIOD = {
    **EXPECTED_SERVICE_FIXTURE,
    "last_restart_at": datetime.now(UTC) - timedelta(seconds=30),  # 30s ago
}

SERVICE_GRACE_PERIOD_EXPIRED = {
    **EXPECTED_SERVICE_FIXTURE,
    "last_restart_at": datetime.now(UTC) - timedelta(seconds=120),  # 2min ago
}

SERVICE_NO_RESTART = {
    **EXPECTED_SERVICE_FIXTURE,
    "last_restart_at": None,
}
```

### Config Fixtures

```python
# backend/tests/fixtures/config_fixtures.py

GRACE_PERIOD_CONFIG = {
    "service_restart_grace_seconds": 60,
}

GRACE_PERIOD_ZERO = {
    "service_restart_grace_seconds": 0,
}

GRACE_PERIOD_CUSTOM = {
    "service_restart_grace_seconds": 120,
}
```

### Frontend Test Data

```typescript
// frontend/src/__tests__/fixtures/serviceFixtures.ts

export const serviceInGracePeriod = {
  service_name: 'docker.service',
  display_name: 'Docker',
  is_critical: true,
  enabled: true,
  current_status: {
    status: 'stopped',
    last_seen: new Date().toISOString(),
  },
  last_restart_at: new Date(Date.now() - 30000).toISOString(), // 30s ago
  grace_period_remaining: 30,
};

export const serviceGracePeriodExpired = {
  ...serviceInGracePeriod,
  last_restart_at: new Date(Date.now() - 120000).toISOString(), // 2min ago
  grace_period_remaining: 0,
};
```

---

## Test Implementation Details

### TS0202-U01: Service in grace period - no alert fires

```python
async def test_service_in_grace_period_no_alert(
    session: AsyncSession,
    alerting_service: AlertingService,
):
    """Given a service restarted 30s ago, when heartbeat shows stopped, then no alert fires."""
    # Setup: Service with last_restart_at 30s ago
    expected_service = ExpectedService(
        server_id="test-server",
        service_name="docker.service",
        is_critical=True,
        last_restart_at=datetime.now(UTC) - timedelta(seconds=30),
    )
    session.add(expected_service)
    await session.flush()

    # Set grace period config to 60s
    await set_config_value(session, "notifications", {"service_restart_grace_seconds": 60})

    # Simulate heartbeat with service stopped
    services = [ServiceStatusPayload(name="docker.service", status="stopped")]

    events = await alerting_service.evaluate_services(
        server_id="test-server",
        server_name="Test Server",
        services=services,
        notifications=NotificationsConfig(),
    )

    # Assert: No alert event generated
    assert len(events) == 0
```

### TS0202-U02: Grace period expired - alert fires

```python
async def test_grace_period_expired_alert_fires(
    session: AsyncSession,
    alerting_service: AlertingService,
):
    """Given a service restarted 120s ago (grace 60s), when heartbeat shows stopped, then alert fires."""
    # Setup: Service with last_restart_at 120s ago
    expected_service = ExpectedService(
        server_id="test-server",
        service_name="docker.service",
        is_critical=True,
        last_restart_at=datetime.now(UTC) - timedelta(seconds=120),
    )
    session.add(expected_service)
    await session.flush()

    # Simulate heartbeat with service stopped
    services = [ServiceStatusPayload(name="docker.service", status="stopped")]

    events = await alerting_service.evaluate_services(
        server_id="test-server",
        server_name="Test Server",
        services=services,
        notifications=NotificationsConfig(),
    )

    # Assert: Alert event generated
    assert len(events) == 1
    assert "service:docker.service" in events[0].metric_type
```

### TS0202-F01: Shows "Restarting (Xs remaining)" during grace period

```typescript
describe('ServiceStatus with grace period', () => {
  it('shows restarting countdown when in grace period', () => {
    const service = {
      service_name: 'docker.service',
      display_name: 'Docker',
      current_status: { status: 'stopped' },
      last_restart_at: new Date(Date.now() - 30000).toISOString(),
      grace_period_remaining: 30,
    };

    render(<ServiceStatus service={service} gracePeriodSeconds={60} />);

    expect(screen.getByText(/Restarting/)).toBeInTheDocument();
    expect(screen.getByText(/\d+s remaining/)).toBeInTheDocument();
  });
});
```

---

## Coverage Requirements

| Component | Target | Notes |
|-----------|--------|-------|
| `alerting.py` (grace period) | 90% | New grace period logic |
| `services.py` (restart) | 85% | Timestamp setting |
| `ServiceStatus.tsx` | 80% | Countdown display |
| `serviceUtils.ts` | 90% | Grace period calculation |

---

## Automation Notes

### Backend Tests

```bash
# Run grace period tests only
pytest backend/tests/test_alerting_grace_period.py -v
pytest backend/tests/test_config_grace_period.py -v
pytest backend/tests/test_service_restart_timestamp.py -v

# Run with coverage
coverage run -m pytest backend/tests/test_*grace_period*.py -v
```

### Frontend Tests

```bash
# Run service status tests
cd frontend && npm test -- --grep "ServiceStatus"

# Run with coverage
cd frontend && npm run test:coverage -- --grep "ServiceStatus"
```

---

## Traceability Matrix

| AC | Test IDs |
|----|----------|
| AC1 | TS0202-U09, U10, U11, U12 |
| AC2 | TS0202-U01, U03, U13, I01, I02 |
| AC3 | TS0202-U14, I01 |
| AC4 | TS0202-U02, U07, I03 |
| AC5 | TS0202-F01, F02, F03, F04, F05 |

| Edge Case | Test IDs |
|-----------|----------|
| Edge 1 (stop during grace) | Covered by U01 |
| Edge 2 (multiple restarts) | TS0202-U05 |
| Edge 3 (hub restart) | TS0202-U15, I05 |
| Edge 4 (grace = 0) | TS0202-U04, F06 |
| Edge 5 (service starts early) | TS0202-U06, F04, I04 |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial test specification |
