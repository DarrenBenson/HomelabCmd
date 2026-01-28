# US0092: Workstation Cost Tracking

> **Status:** Done
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** workstation costs calculated based on actual uptime
**So that** I know how much each workstation costs me

## Context

### Persona Reference

**Darren** - Homelab operator who wants visibility into running costs. With workstations now tracked, he wants accurate cost estimates based on actual usage, not 24/7 assumptions.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Servers run 24/7, so cost calculation is straightforward: `TDP * hours_in_period * electricity_rate`. Workstations are intermittent - they might only run 4-6 hours per day. Current cost tracking would overestimate workstation costs if it assumed 24/7 operation.

This story implements usage-based cost tracking:
1. Track actual uptime from heartbeat data
2. Calculate costs based on actual hours, not assumed 24/7
3. Display workstation costs separately with hours breakdown
4. Show combined totals with server vs workstation breakdown

## Inherited Constraints

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | EP0001 (Cost tracking infrastructure) | Builds on existing cost calculation |
| Dependency | US0082 (machine_type field) | Requires type distinction |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Accuracy | Costs within 10% of actual | Need accurate uptime tracking |
| Performance | Dashboard <200ms | Cost calculations must be efficient |

## Acceptance Criteria

### AC1: Uptime tracking from heartbeats

- **Given** a workstation sending heartbeats
- **When** heartbeats are received
- **Then** the system tracks cumulative uptime between boot_time and current time
- **And** uptime resets when boot_time changes (machine rebooted)

### AC2: Actual hours in cost calculation

- **Given** a workstation with TDP and uptime data
- **When** calculating costs for a period
- **Then** cost = `(TDP_watts * actual_hours * electricity_rate) / 1000`
- **And** actual_hours is the cumulative uptime within the period

### AC3: Workstation cost display

- **Given** the cost dashboard
- **When** viewing workstation costs
- **Then** each workstation shows: name, cost, hours used
- **And** costs are marked as "based on actual usage"

### AC4: Period-based reporting

- **Given** the cost dashboard
- **When** selecting a period (day/week/month)
- **Then** workstation costs reflect uptime within that period
- **And** server costs remain calculated as 24/7

### AC5: Combined cost summary

- **Given** the cost dashboard
- **When** viewing the total
- **Then** summary shows "Servers (24/7): XX" and "Workstations (on-demand): YY"
- **And** total combines both accurately

### AC6: Workstation without TDP

- **Given** a workstation without TDP configured
- **When** viewing the cost dashboard
- **Then** that workstation shows "TDP not set" instead of cost
- **And** it's excluded from workstation cost total

## Scope

### In Scope

- Backend uptime tracking from heartbeat data
- Modified cost calculation for workstations
- Cost dashboard UI updates
- Period-based cost aggregation
- Server vs workstation cost breakdown

### Out of Scope

- Real-time power monitoring (hardware integration)
- Automatic TDP detection
- Cost alerts/budgets
- Historical cost trends (beyond current period display)

## UI/UX Requirements

### Cost Dashboard Widget

```
┌────────────────────────────────────────┐
│ Power Costs (This Month)               │
├────────────────────────────────────────┤
│ Servers (24/7):           £85.54       │
│   11 machines @ avg 495W               │
│                                        │
│ Workstations (on-demand): £12.30       │
│   StudyPC: £8.50 (170h)                │
│   LaptopPro: £2.40 (48h)               │
│   GamingPC: £1.40 (28h)                │
│                                        │
│ ────────────────────────────────────── │
│ Total:                    £97.84       │
└────────────────────────────────────────┘
```

### Workstation Cost Row

```
┌──────────────────────────────────────────────┐
│ 💻 StudyPC                                   │
│ TDP: 150W • Hours: 170h • Cost: £8.50       │
│ (based on actual usage)                      │
└──────────────────────────────────────────────┘
```

### Period Selector

```
[Today] [This Week] [This Month] [Custom...]
```

## Technical Notes

### Uptime Tracking

The agent already reports `boot_time` in heartbeats. The hub can calculate uptime:

```python
async def update_server_uptime(server: Server, heartbeat: HeartbeatData) -> None:
    """Update server uptime tracking from heartbeat."""
    current_time = datetime.utcnow()

    if heartbeat.boot_time != server.last_boot_time:
        # Machine rebooted - start fresh uptime tracking
        server.last_boot_time = heartbeat.boot_time
        server.current_session_start = current_time

    # Session duration since boot
    session_hours = (current_time - heartbeat.boot_time).total_seconds() / 3600

    # Update cumulative uptime for the period
    await update_period_uptime(server.id, session_hours, current_time)
```

### Uptime Aggregation Schema

```python
class ServerUptimeAggregate(Base):
    """Track daily uptime for cost calculation."""
    __tablename__ = "server_uptime_aggregate"

    id = Column(UUID, primary_key=True)
    server_id = Column(UUID, ForeignKey("servers.id"))
    date = Column(Date, index=True)
    uptime_hours = Column(Float, default=0.0)
    last_updated = Column(DateTime)

    __table_args__ = (
        UniqueConstraint('server_id', 'date'),
    )
```

### Cost Calculation Service

```python
async def calculate_workstation_cost(
    server_id: str,
    start_date: date,
    end_date: date,
    electricity_rate: float
) -> CostResult:
    """Calculate workstation cost based on actual uptime."""

    server = await get_server(server_id)
    if not server.tdp:
        return CostResult(cost=None, reason="TDP not configured")

    # Get cumulative uptime for period
    uptime = await get_uptime_for_period(server_id, start_date, end_date)

    # Calculate cost
    kwh = (server.tdp * uptime.hours) / 1000
    cost = kwh * electricity_rate

    return CostResult(
        cost=cost,
        hours=uptime.hours,
        tdp=server.tdp,
        calculation_type="actual_usage"
    )
```

### API Response Schema

```python
class WorkstationCostResponse(BaseModel):
    server_id: str
    server_name: str
    machine_type: str
    tdp_watts: int | None
    hours_used: float
    cost: float | None
    cost_formatted: str
    calculation_type: Literal["24x7", "actual_usage"]

class CostSummaryResponse(BaseModel):
    period: str
    server_cost_total: float
    server_count: int
    workstation_cost_total: float
    workstation_count: int
    workstation_details: list[WorkstationCostResponse]
    total_cost: float
    electricity_rate: float
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Workstation with no TDP | Show "TDP not set", exclude from total |
| No heartbeats in period | Show 0 hours, £0.00 cost |
| Workstation online entire period | Calculate full hours (same as server) |
| Gap in heartbeats (network issue) | Use last known uptime, may undercount |
| Boot_time in future (clock skew) | Clamp to current time |
| Very high uptime (>24h/day bug) | Cap at 24 hours per day |
| First heartbeat ever | Start tracking from that moment |
| Electricity rate not configured | Show "Rate not configured" |

## Test Scenarios

- [x] Server cost calculated as 24/7
- [x] Workstation cost calculated from actual uptime
- [x] Uptime resets on reboot (boot_time change)
- [x] Period filter (day/week/month) works correctly
- [x] Combined total accurate
- [x] Workstation without TDP shows message
- [x] Zero uptime shows £0.00
- [x] Hours displayed with cost
- [x] Cost formatted with currency symbol
- [x] Electricity rate applied correctly

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0092-01 | Uptime tracked from heartbeats | AC1 | Integration | Ready |
| TC-US0092-02 | Uptime resets on reboot | AC1 | Unit | Ready |
| TC-US0092-03 | Cost uses actual hours | AC2 | Unit | Ready |
| TC-US0092-04 | Workstation cost display | AC3 | Unit | Ready |
| TC-US0092-05 | Period-based aggregation | AC4 | Integration | Ready |
| TC-US0092-06 | Server vs workstation breakdown | AC5 | Integration | Ready |
| TC-US0092-07 | Missing TDP handling | AC6 | Unit | Ready |
| TC-US0092-08 | Zero uptime handling | Edge case | Unit | Ready |
| TC-US0092-09 | Boot time change detection | AC1 | Unit | Ready |
| TC-US0092-10 | Combined total accuracy | AC5 | Integration | Ready |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| US0082 | Schema | `machine_type` field on Server | Done |
| EP0001 | Epic | Cost tracking infrastructure | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| Server | US0082 | `machine_type`, `tdp` |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| `/api/v1/costs` | EP0001 | Extend with workstation breakdown |

## Estimation

**Story Points:** 5

**Complexity:** Medium-High - Backend uptime tracking, schema changes, cost calculation updates, UI changes

## Open Questions

None - all requirements clear from epic.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 10/10 minimum listed
- [x] API contracts: Response schemas documented
- [x] Error codes: Handling specified

### All Stories

- [x] No ambiguous language
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

- [x] All critical Open Questions resolved
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Story generated from EP0009 epic (was US0087, renumbered to US0092) |
| 2026-01-27 | Claude | Implementation plan PL0092 created, status changed to Planned |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
