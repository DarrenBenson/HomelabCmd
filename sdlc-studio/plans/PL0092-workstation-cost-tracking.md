# PL0092: Workstation Cost Tracking - Implementation Plan

> **Status:** Done
> **Story:** [US0092: Workstation Cost Tracking](../stories/US0092-workstation-cost-tracking.md)
> **Epic:** [EP0009: Workstation Management](../epics/EP0009-workstation-management.md)
> **Created:** 2026-01-27
> **Language:** Python (Backend) + TypeScript (Frontend)

## Overview

Implement usage-based cost tracking for workstations. Unlike servers which run 24/7, workstations have intermittent availability. This story tracks actual uptime from heartbeat data and calculates costs based on hours used rather than assuming continuous operation.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Uptime tracking from heartbeats | Track cumulative uptime, reset on boot_time change |
| AC2 | Actual hours in cost calculation | cost = (TDP × actual_hours × rate) / 1000 |
| AC3 | Workstation cost display | Show name, cost, hours used, "based on actual usage" |
| AC4 | Period-based reporting | Day/week/month filters, servers stay 24/7 |
| AC5 | Combined cost summary | "Servers (24/7): XX" and "Workstations (on-demand): YY" |
| AC6 | Workstation without TDP | Show "TDP not set", exclude from total |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, SQLAlchemy 2.0 (async)
- **Frontend:** React 18 with TypeScript, Vite
- **Test Frameworks:** pytest (backend), Vitest + RTL (frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Avoid `any`, use `unknown` with type guards
- Handle `null` and `None` explicitly
- Explicit return types for exported functions

From `~/.claude/best-practices/typescript.md`:
- Use type guards for runtime type checking
- Prefer union types over enums for string literals

### Existing Patterns

1. **Cost Calculation** - `services/power.py` provides `calculate_daily_cost()` assuming 24h operation
2. **Cost API** - `routes/costs.py` has `/summary` and `/breakdown` endpoints
3. **Cost Schemas** - `schemas/costs.py` defines response models
4. **Metrics Model** - `db/models/metrics.py` stores `uptime_seconds` per heartbeat
5. **Server Model** - `db/models/server.py` has `machine_type`, `tdp_watts`, `last_seen`
6. **Heartbeat** - `schemas/heartbeat.py` receives `metrics.uptime_seconds` from agent

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** API story with 8 edge cases, clear contracts, and calculations that require precise testing. Backend-first approach - API changes drive frontend updates.

### Test Priority

1. Workstation cost uses actual hours, not 24h
2. Server cost remains 24/7 calculation
3. Period filtering works correctly (day/week/month)
4. Boot_time change resets session tracking
5. Missing TDP shows message, excluded from total
6. Combined totals accurate (servers + workstations)
7. Zero uptime returns £0.00

### Documentation Updates Required

- [ ] Update story status to Planned
- [ ] Update story status to Done (after implementation)

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Create ServerUptimeDaily model | `db/models/uptime.py` | - | Yes | [ ] |
| 2 | Create Alembic migration | `migrations/versions/xxx_add_uptime_tracking.py` | 1 | No | [ ] |
| 3 | Add uptime update to heartbeat handler | `api/routes/servers.py` | 2 | No | [ ] |
| 4 | Create uptime service | `services/uptime.py` | 1 | Yes | [ ] |
| 5 | Update cost calculation service | `services/power.py` | 4 | No | [ ] |
| 6 | Update cost schemas | `api/schemas/costs.py` | - | Yes | [ ] |
| 7 | Update cost API endpoints | `api/routes/costs.py` | 5, 6 | No | [ ] |
| 8 | Write backend unit tests | `tests/test_workstation_costs.py` | 7 | No | [ ] |
| 9 | Update cost API client | `frontend/src/api/costs.ts` | 7 | No | [ ] |
| 10 | Create WorkstationCostCard component | `frontend/src/components/WorkstationCostCard.tsx` | 9 | No | [ ] |
| 11 | Update CostBreakdown page | `frontend/src/pages/CostBreakdown.tsx` | 10 | No | [ ] |
| 12 | Write frontend unit tests | `frontend/src/components/WorkstationCostCard.test.tsx` | 10 | No | [ ] |

### Task Dependency Graph

```
1 (Uptime model) ──→ 2 (migration) ──→ 3 (heartbeat update)
       │
       └──→ 4 (uptime service) ──→ 5 (power service) ──→ 7 (cost API)
                                                              │
6 (cost schemas) ─────────────────────────────────────────────┘
                                                              │
                                                              ├──→ 8 (backend tests)
                                                              │
                                                              └──→ 9 (API client) ──→ 10 (component) ──→ 11 (page)
                                                                                           │
                                                                                           └──→ 12 (frontend tests)
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 4, 6 | None |
| 2 | 2 | Task 1 |
| 3 | 3, 5 | Task 2, Task 4 |
| 4 | 7 | Tasks 5, 6 |
| 5 | 8, 9 | Task 7 |
| 6 | 10, 12 | Task 9 |
| 7 | 11 | Task 10 |

## Implementation Phases

### Phase 1: Backend - Database Schema

**Goal:** Create uptime tracking table and migration

**Tasks in this phase:** 1, 2

#### Step 1.1: Create ServerUptimeDaily model

- [ ] Create new file `backend/src/homelab_cmd/db/models/uptime.py`
- [ ] Define ServerUptimeDaily model with server_id, date, uptime_hours
- [ ] Add unique constraint on (server_id, date)
- [ ] Import in `db/models/__init__.py`

**Model Structure:**
```python
class ServerUptimeDaily(Base):
    """Daily uptime aggregation for cost calculation.

    Tracks cumulative uptime hours per server per day.
    Used for workstation cost calculation based on actual usage.
    """
    __tablename__ = "server_uptime_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    uptime_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_boot_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint('server_id', 'date', name='uq_server_uptime_daily_server_date'),
    )
```

#### Step 1.2: Create Alembic migration

- [ ] Run `alembic revision --autogenerate -m "Add server_uptime_daily table"`
- [ ] Review generated migration
- [ ] Apply migration with `alembic upgrade head`

### Phase 2: Backend - Uptime Tracking Service

**Goal:** Implement uptime tracking from heartbeats

**Tasks in this phase:** 3, 4

#### Step 2.1: Create uptime service

- [ ] Create `backend/src/homelab_cmd/services/uptime.py`
- [ ] Implement `update_server_uptime(server_id, uptime_seconds, boot_time)` function
- [ ] Calculate hours from uptime_seconds
- [ ] Detect boot_time changes (reboot)
- [ ] Upsert daily uptime record
- [ ] Cap at 24 hours per day

**Service Logic:**
```python
async def update_server_uptime(
    session: AsyncSession,
    server_id: str,
    uptime_seconds: int,
    current_time: datetime,
) -> None:
    """Update daily uptime tracking from heartbeat."""
    today = current_time.date()
    uptime_hours = uptime_seconds / 3600

    # Cap at 24 hours per day
    uptime_hours = min(uptime_hours, 24.0)

    # Upsert daily record
    await upsert_daily_uptime(session, server_id, today, uptime_hours, current_time)


async def get_uptime_for_period(
    session: AsyncSession,
    server_id: str,
    start_date: date,
    end_date: date,
) -> float:
    """Get total uptime hours for a server within a date range."""
    result = await session.execute(
        select(func.sum(ServerUptimeDaily.uptime_hours))
        .where(ServerUptimeDaily.server_id == server_id)
        .where(ServerUptimeDaily.date >= start_date)
        .where(ServerUptimeDaily.date <= end_date)
    )
    total = result.scalar_one_or_none()
    return total or 0.0
```

#### Step 2.2: Update heartbeat handler

- [ ] Import uptime service in `api/routes/servers.py`
- [ ] After processing metrics, call `update_server_uptime()`
- [ ] Pass `metrics.uptime_seconds` to service
- [ ] Only update for servers with `machine_type == 'workstation'`

### Phase 3: Backend - Cost Calculation Updates

**Goal:** Update cost calculation to use actual hours for workstations

**Tasks in this phase:** 5, 6, 7

#### Step 3.1: Update cost schemas

- [ ] Add `machine_type` field to ServerCostItem
- [ ] Add `hours_used` field to ServerCostItem
- [ ] Add `calculation_type` field ("24x7" or "actual_usage")
- [ ] Add workstation breakdown to CostSummaryResponse
- [ ] Add period parameter support

**Updated Schemas:**
```python
class ServerCostItem(BaseModel):
    # ... existing fields ...
    machine_type: str = Field("server", description="'server' or 'workstation'")
    hours_used: float | None = Field(None, description="Hours used in period (workstations)")
    calculation_type: str = Field("24x7", description="'24x7' or 'actual_usage'")


class CostSummaryResponse(BaseModel):
    # ... existing fields ...
    server_cost_total: float = Field(description="Total server cost (24/7)")
    server_count: int
    workstation_cost_total: float = Field(description="Total workstation cost (actual usage)")
    workstation_count: int
    period: str = Field("month", description="Cost period: 'day', 'week', 'month'")
```

#### Step 3.2: Update power service

- [ ] Add `calculate_workstation_cost()` function
- [ ] Accept hours_used parameter
- [ ] Formula: `(tdp_watts * hours_used * rate) / 1000`

**New Function:**
```python
def calculate_workstation_cost(
    tdp_watts: int,
    hours_used: float,
    rate_per_kwh: float,
) -> float:
    """Calculate workstation cost based on actual usage.

    Args:
        tdp_watts: Power consumption in watts
        hours_used: Actual hours of operation
        rate_per_kwh: Electricity rate per kWh

    Returns:
        Cost rounded to 2 decimal places.
    """
    kwh = (tdp_watts * hours_used) / 1000
    return round(kwh * rate_per_kwh, 2)
```

#### Step 3.3: Update cost API endpoints

- [ ] Add period query parameter (day/week/month, default month)
- [ ] For workstations: query uptime_daily, use actual hours
- [ ] For servers: use 24h × days in period
- [ ] Separate server/workstation totals in response
- [ ] Handle workstations without TDP

### Phase 4: Frontend Updates

**Goal:** Update cost UI to show workstation breakdown

**Tasks in this phase:** 9, 10, 11

#### Step 4.1: Update cost API client

- [ ] Update `CostSummaryResponse` type to include workstation fields
- [ ] Update `ServerCostItem` type with `hours_used`, `calculation_type`
- [ ] Add period parameter to API calls

#### Step 4.2: Create WorkstationCostCard component

- [ ] Display workstation name, TDP, hours, cost
- [ ] Show "based on actual usage" label
- [ ] Handle missing TDP case ("TDP not set")
- [ ] Use purple accent colour (consistent with US0091)

**Component Structure:**
```tsx
interface WorkstationCostCardProps {
  server: ServerCostItem;
  currencySymbol: string;
}

export function WorkstationCostCard({ server, currencySymbol }: WorkstationCostCardProps) {
  if (!server.tdp_watts) {
    return (
      <div className="...">
        <span>{server.hostname}</span>
        <span className="text-text-muted">TDP not set</span>
      </div>
    );
  }

  return (
    <div className="border-l-4 border-l-purple-500 ...">
      <span>{server.hostname}</span>
      <span>{server.tdp_watts}W • {server.hours_used}h • {currencySymbol}{server.monthly_cost}</span>
      <span className="text-xs text-text-muted">(based on actual usage)</span>
    </div>
  );
}
```

#### Step 4.3: Update CostBreakdown page

- [ ] Add period selector (Today/Week/Month)
- [ ] Group servers and workstations separately
- [ ] Show section headers with totals
- [ ] Display combined total at bottom

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 8, 12

#### Step 5.1: Backend Tests

- [ ] Test uptime tracking from heartbeat
- [ ] Test boot_time change resets session
- [ ] Test workstation cost uses actual hours
- [ ] Test server cost remains 24/7
- [ ] Test period filtering (day/week/month)
- [ ] Test missing TDP handling
- [ ] Test combined totals

**Test Cases:**
```python
async def test_workstation_cost_uses_actual_hours():
    """AC2: Workstation cost based on actual uptime."""
    # Create workstation with 100W TDP
    # Record 10 hours of uptime
    # Expect cost = (100 * 10 * 0.24) / 1000 = 0.24

async def test_server_cost_uses_24x7():
    """AC4: Server costs remain 24/7 calculation."""
    # Create server with 100W TDP
    # Expect daily cost = (100 * 24 * 0.24) / 1000 = 0.576

async def test_workstation_without_tdp():
    """AC6: Missing TDP shows message, excluded from total."""
    # Create workstation without TDP
    # Expect cost = None, excluded from workstation_cost_total
```

#### Step 5.2: Frontend Tests

- [ ] WorkstationCostCard renders hours and cost
- [ ] WorkstationCostCard shows "TDP not set" when missing
- [ ] Period selector changes displayed costs
- [ ] Server/workstation sections display correctly

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test: uptime tracked, resets on boot | Pending |
| AC2 | Unit test: cost = TDP × hours × rate / 1000 | Pending |
| AC3 | Component test: shows name, cost, hours | Pending |
| AC4 | Integration test: period filter works | Pending |
| AC5 | Integration test: combined summary correct | Pending |
| AC6 | Unit test: missing TDP handling | Pending |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Workstation with no TDP | Return cost=None, show "TDP not set", exclude from total | Phase 3 | [ ] |
| 2 | No heartbeats in period | Return 0 hours, £0.00 cost | Phase 3 | [ ] |
| 3 | Workstation online entire period | Calculate full hours (same as server) | Phase 3 | [ ] |
| 4 | Gap in heartbeats (network issue) | Use last known uptime_seconds from heartbeat | Phase 2 | [ ] |
| 5 | Boot_time in future (clock skew) | Clamp uptime to 0, log warning | Phase 2 | [ ] |
| 6 | Very high uptime (>24h/day bug) | Cap at 24 hours per day | Phase 2 | [ ] |
| 7 | First heartbeat ever | Start tracking from that moment | Phase 2 | [ ] |
| 8 | Electricity rate not configured | Use default rate (0.24), show in response | Phase 3 | [ ] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Float precision issues | Display shows unexpected decimals | Round all costs to 2 decimal places |
| Large uptime records | Slow queries | Index on (server_id, date), use date range queries |
| Timezone handling | Incorrect daily aggregation | Use UTC consistently, convert on display |
| Missing uptime data for existing servers | Zero costs initially | Document that tracking starts from first heartbeat after deployment |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0082 (Machine Type Field) | Schema | Done |
| EP0005 (Cost Tracking Infrastructure) | Epic | Done |
| Alembic | Package | Installed |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [ ] ServerUptimeDaily model created and migrated
- [ ] Uptime tracking service implemented
- [ ] Heartbeat handler updated to track workstation uptime
- [ ] Cost calculation updated for workstations
- [ ] Cost API returns server/workstation breakdown
- [ ] Period filtering works (day/week/month)
- [ ] Frontend displays workstation costs with hours
- [ ] All 8 edge cases handled
- [ ] Unit tests written and passing
- [ ] No linting errors (ruff, eslint)
- [ ] Ready for code review

## Notes

**Backend-First Approach:** The API changes drive the frontend. Complete backend implementation and tests before starting frontend work.

**Uptime Tracking Strategy:** Rather than calculating uptime from boot_time diffs, we use the `uptime_seconds` field already reported in heartbeats. This is more reliable and accounts for the actual running time as reported by the OS.

**Period Calculation:**
- Day: Today's date only
- Week: Last 7 days
- Month: Last 30 days

For servers, multiply TDP × 24 × days_in_period × rate.
For workstations, sum actual hours from uptime_daily table × TDP × rate.

**File Count:**
- Backend: 4 new files (uptime model, service, migration, tests), 4 modified (server.py, costs.py schema, costs.py route, power.py)
- Frontend: 2 new files (WorkstationCostCard, tests), 3 modified (costs.ts API, CostBreakdown page, types)
