# PL0200: Historical Cost Tracking - Implementation Plan

> **Status:** Complete
> **Story:** [US0183: Historical Cost Tracking](../stories/US0183-historical-cost-tracking.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-29
> **Approach:** Test-After

## Overview

Implement historical cost tracking by recording daily cost snapshots for each server and providing API endpoints and frontend visualisations for cost trend analysis.

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0033 (TDP Configuration) | Data | Done |
| US0034 (Electricity Rate) | Data | Done |
| US0055 (Usage-Based Power) | Calculation | Done |
| APScheduler | Service | Available |

---

## Implementation Tasks

### Phase 1: Backend Model & Migration

#### Task 1.1: Create CostSnapshot Model
**File:** `backend/src/homelab_cmd/db/models/cost_snapshot.py`

```python
class CostSnapshot(Base):
    __tablename__ = 'cost_snapshots'

    id: int = Column(Integer, primary_key=True)
    server_id: str = Column(String, ForeignKey('servers.id'), nullable=False)
    date: date = Column(Date, nullable=False, index=True)
    estimated_kwh: float = Column(Float, nullable=False)
    estimated_cost: float = Column(Float, nullable=False)
    electricity_rate: float = Column(Float, nullable=False)
    tdp_watts: int = Column(Integer, nullable=True)
    idle_watts: int = Column(Integer, nullable=True)
    avg_cpu_percent: float = Column(Float, nullable=True)
    machine_type: str = Column(String, nullable=True)  # 'server' or 'workstation'
    hours_used: float = Column(Float, nullable=True)  # For workstations

    __table_args__ = (
        UniqueConstraint('server_id', 'date', name='uq_cost_snapshot'),
    )
```

**AC Mapping:** AC1 (snapshot includes required fields)

#### Task 1.2: Create CostSnapshotMonthly Model
**File:** `backend/src/homelab_cmd/db/models/cost_snapshot.py`

```python
class CostSnapshotMonthly(Base):
    __tablename__ = 'cost_snapshots_monthly'

    id: int = Column(Integer, primary_key=True)
    server_id: str = Column(String, ForeignKey('servers.id'), nullable=True)
    year_month: str = Column(String(7), nullable=False)  # "YYYY-MM"
    total_kwh: float = Column(Float, nullable=False)
    total_cost: float = Column(Float, nullable=False)
    avg_electricity_rate: float = Column(Float, nullable=False)
    snapshot_count: int = Column(Integer, nullable=False)  # Days in aggregate

    __table_args__ = (
        UniqueConstraint('server_id', 'year_month', name='uq_monthly_cost_snapshot'),
    )
```

**AC Mapping:** AC6 (monthly aggregates for retention)

#### Task 1.3: Create Alembic Migration
**File:** `migrations/versions/xxx_add_cost_snapshot_tables.py`

- Create `cost_snapshots` table with indexes
- Create `cost_snapshots_monthly` table
- Add composite index on (server_id, date) for efficient queries

#### Task 1.4: Register Models
**File:** `backend/src/homelab_cmd/db/models/__init__.py`

- Import CostSnapshot and CostSnapshotMonthly
- Add to __all__ list

---

### Phase 2: Backend Service

#### Task 2.1: Create Cost History Service
**File:** `backend/src/homelab_cmd/services/cost_history.py`

```python
class CostHistoryService:
    async def capture_daily_snapshot(self, server_id: str) -> CostSnapshot
    async def capture_all_snapshots(self) -> int
    async def get_history(
        self,
        start_date: date,
        end_date: date,
        server_id: str | None = None,
        aggregation: str = "daily"
    ) -> list[CostHistoryItem]
    async def get_monthly_summary(self, year: int) -> list[MonthlySummaryItem]
    async def get_server_history(
        self,
        server_id: str,
        period: str = "30d"
    ) -> list[CostHistoryItem]
    async def rollup_old_data(self) -> dict[str, int]
```

**Key Logic:**
- `capture_daily_snapshot`: Calculates kWh and cost for a server using existing power.py functions
- `aggregation`: "daily" returns raw, "weekly" groups by ISO week, "monthly" groups by month
- `rollup_old_data`: Daily data older than 2 years → monthly aggregates

**AC Mapping:** AC1, AC2, AC5, AC6

---

### Phase 3: Backend API Endpoints

#### Task 3.1: Add History Schemas
**File:** `backend/src/homelab_cmd/api/schemas/cost_history.py`

```python
class CostHistoryItem(BaseModel):
    date: str  # ISO date or period label
    estimated_kwh: float
    estimated_cost: float
    electricity_rate: float
    server_id: str | None = None
    server_hostname: str | None = None

class CostHistoryResponse(BaseModel):
    items: list[CostHistoryItem]
    aggregation: str
    start_date: str
    end_date: str
    currency_symbol: str

class MonthlySummaryItem(BaseModel):
    year_month: str  # "YYYY-MM"
    total_cost: float
    total_kwh: float
    previous_month_cost: float | None
    change_percent: float | None

class MonthlySummaryResponse(BaseModel):
    months: list[MonthlySummaryItem]
    year: int
    year_to_date_cost: float
    currency_symbol: str

class ServerCostHistoryResponse(BaseModel):
    server_id: str
    hostname: str
    period: str
    items: list[CostHistoryItem]
    currency_symbol: str
```

**AC Mapping:** AC2, AC4, AC5

#### Task 3.2: Add History Endpoints to Costs Router
**File:** `backend/src/homelab_cmd/api/routes/costs.py`

```python
@router.get("/history")
async def get_cost_history(
    start_date: date,
    end_date: date,
    server_id: str | None = None,
    aggregation: str = Query("daily", regex="^(daily|weekly|monthly)$"),
) -> CostHistoryResponse

@router.get("/summary/monthly")
async def get_monthly_summary(
    year: int = Query(default_factory=lambda: date.today().year),
) -> MonthlySummaryResponse
```

**AC Mapping:** AC2, AC5

#### Task 3.3: Add Server Cost History Endpoint
**File:** `backend/src/homelab_cmd/api/routes/servers.py`

```python
@router.get("/{server_id}/costs/history")
async def get_server_cost_history(
    server_id: str,
    period: str = Query("30d", regex="^(7d|30d|90d|12m)$"),
) -> ServerCostHistoryResponse
```

**AC Mapping:** AC4

---

### Phase 4: Scheduled Jobs

#### Task 4.1: Add Daily Snapshot Job
**File:** `backend/src/homelab_cmd/services/scheduler.py`

```python
async def capture_daily_costs() -> int:
    """Capture cost snapshots for all servers at midnight UTC."""
    service = CostHistoryService(session)
    return await service.capture_all_snapshots()
```

Schedule: `0 0 * * *` (midnight UTC)

**AC Mapping:** AC1

#### Task 4.2: Add Monthly Rollup Job
**File:** `backend/src/homelab_cmd/services/scheduler.py`

```python
async def rollup_cost_snapshots() -> dict[str, int]:
    """Roll up daily cost data older than 2 years to monthly aggregates."""
    service = CostHistoryService(session)
    return await service.rollup_old_data()
```

Schedule: `0 2 1 * *` (1st of month, 2am UTC)

**AC Mapping:** AC6

#### Task 4.3: Register Jobs in Application Startup
**File:** `backend/src/homelab_cmd/main.py`

- Add scheduler job registration in lifespan handler
- Jobs: `capture_daily_costs`, `rollup_cost_snapshots`

---

### Phase 5: Frontend Types & API

#### Task 5.1: Add Cost History Types
**File:** `frontend/src/types/cost-history.ts`

```typescript
export interface CostHistoryItem {
  date: string;
  estimated_kwh: number;
  estimated_cost: number;
  electricity_rate: number;
  server_id?: string;
  server_hostname?: string;
}

export interface CostHistoryResponse {
  items: CostHistoryItem[];
  aggregation: 'daily' | 'weekly' | 'monthly';
  start_date: string;
  end_date: string;
  currency_symbol: string;
}

export interface MonthlySummaryItem {
  year_month: string;
  total_cost: number;
  total_kwh: number;
  previous_month_cost: number | null;
  change_percent: number | null;
}

export interface MonthlySummaryResponse {
  months: MonthlySummaryItem[];
  year: number;
  year_to_date_cost: number;
  currency_symbol: string;
}

export interface ServerCostHistoryResponse {
  server_id: string;
  hostname: string;
  period: string;
  items: CostHistoryItem[];
  currency_symbol: string;
}
```

#### Task 5.2: Add Cost History API Client
**File:** `frontend/src/api/cost-history.ts`

```typescript
export async function getCostHistory(params: {
  startDate: string;
  endDate: string;
  serverId?: string;
  aggregation?: 'daily' | 'weekly' | 'monthly';
}): Promise<CostHistoryResponse>

export async function getMonthlySummary(year?: number): Promise<MonthlySummaryResponse>

export async function getServerCostHistory(
  serverId: string,
  period?: '7d' | '30d' | '90d' | '12m'
): Promise<ServerCostHistoryResponse>
```

---

### Phase 6: Frontend Components

#### Task 6.1: Create CostTrendChart Component
**File:** `frontend/src/components/CostTrendChart.tsx`

- Line chart using Recharts
- Props: `data`, `currencySymbol`, `showComparison`
- Period selector: 7d, 30d, 90d, 12m
- Optional: previous period comparison line
- Responsive sizing

**AC Mapping:** AC3

#### Task 6.2: Create MonthlySummaryChart Component
**File:** `frontend/src/components/MonthlySummaryChart.tsx`

- Bar chart showing monthly costs
- Month-over-month change badges
- Year-to-date total display
- Props: `data`, `currencySymbol`

**AC Mapping:** AC5

#### Task 6.3: Create ServerCostHistoryWidget Component
**File:** `frontend/src/components/widgets/ServerCostHistoryWidget.tsx`

- Compact chart for server detail page
- Shows cost trend for selected period
- Period selector: 7d, 30d, 90d
- Optional: show TDP/category change markers

**AC Mapping:** AC4

---

### Phase 7: Frontend Page Integration

#### Task 7.1: Update CostsPage with History Section
**File:** `frontend/src/pages/CostsPage.tsx`

- Add tabs: "Breakdown" (existing) | "Trends" | "Monthly"
- Trends tab: CostTrendChart with period selector
- Monthly tab: MonthlySummaryChart with year selector
- Handle loading states and "No historical data" message

**AC Mapping:** AC3, AC5

#### Task 7.2: Update ServerDetail with Cost History
**File:** `frontend/src/pages/ServerDetail.tsx`

- Add ServerCostHistoryWidget to cost section
- Only show when historical data exists
- Handle period selection

**AC Mapping:** AC4

---

### Phase 8: Testing

#### Task 8.1: Backend Unit Tests
**File:** `tests/test_cost_history.py`

- Test CostHistoryService methods
- Test snapshot capture with various server configurations
- Test aggregation (daily, weekly, monthly)
- Test rollup logic
- Test edge cases (server offline, no data, etc.)

#### Task 8.2: Backend API Tests
**File:** `tests/test_cost_history_api.py`

- Test GET /costs/history with filters
- Test GET /costs/summary/monthly
- Test GET /servers/{id}/costs/history
- Test validation (invalid dates, aggregation values)

#### Task 8.3: Frontend Unit Tests
**File:** `frontend/src/__tests__/components/CostTrendChart.test.tsx`
**File:** `frontend/src/__tests__/components/MonthlySummaryChart.test.tsx`
**File:** `frontend/src/__tests__/pages/CostsPage.test.tsx` (extend)

- Test chart rendering with mock data
- Test period selection
- Test empty state handling
- Test loading states

---

## Task Checklist

| # | Task | Est. | AC |
|---|------|------|-----|
| 1.1 | CostSnapshot model | S | AC1 |
| 1.2 | CostSnapshotMonthly model | S | AC6 |
| 1.3 | Alembic migration | S | - |
| 1.4 | Register models | XS | - |
| 2.1 | Cost history service | M | AC1,2,5,6 |
| 3.1 | History schemas | S | AC2,4,5 |
| 3.2 | History endpoints | S | AC2,5 |
| 3.3 | Server history endpoint | S | AC4 |
| 4.1 | Daily snapshot job | S | AC1 |
| 4.2 | Monthly rollup job | S | AC6 |
| 4.3 | Register scheduler jobs | XS | - |
| 5.1 | Frontend types | S | - |
| 5.2 | API client functions | S | - |
| 6.1 | CostTrendChart | M | AC3 |
| 6.2 | MonthlySummaryChart | M | AC5 |
| 6.3 | ServerCostHistoryWidget | S | AC4 |
| 7.1 | CostsPage with tabs | M | AC3,5 |
| 7.2 | ServerDetail integration | S | AC4 |
| 8.1 | Backend unit tests | M | - |
| 8.2 | Backend API tests | M | - |
| 8.3 | Frontend unit tests | M | - |

**Sizes:** XS (<15min), S (15-30min), M (30-60min), L (1-2hr)

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `backend/src/homelab_cmd/db/models/cost_snapshot.py` | CostSnapshot and CostSnapshotMonthly models |
| `backend/src/homelab_cmd/services/cost_history.py` | Cost history service |
| `backend/src/homelab_cmd/api/schemas/cost_history.py` | API schemas |
| `migrations/versions/xxx_add_cost_snapshot_tables.py` | Database migration |
| `frontend/src/types/cost-history.ts` | TypeScript types |
| `frontend/src/api/cost-history.ts` | API client |
| `frontend/src/components/CostTrendChart.tsx` | Trend line chart |
| `frontend/src/components/MonthlySummaryChart.tsx` | Monthly bar chart |
| `frontend/src/components/widgets/ServerCostHistoryWidget.tsx` | Server detail widget |
| `tests/test_cost_history.py` | Service tests |
| `tests/test_cost_history_api.py` | API tests |
| `frontend/src/__tests__/components/CostTrendChart.test.tsx` | Chart tests |
| `frontend/src/__tests__/components/MonthlySummaryChart.test.tsx` | Chart tests |

### Modified Files

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/db/models/__init__.py` | Import new models |
| `backend/src/homelab_cmd/api/routes/costs.py` | Add history endpoints |
| `backend/src/homelab_cmd/api/routes/servers.py` | Add server history endpoint |
| `backend/src/homelab_cmd/services/scheduler.py` | Add snapshot and rollup jobs |
| `backend/src/homelab_cmd/main.py` | Register scheduler jobs |
| `frontend/src/pages/CostsPage.tsx` | Add tabs with charts |
| `frontend/src/pages/ServerDetail.tsx` | Add cost history widget |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Server added mid-day | First snapshot at next midnight |
| Server deleted | Historical data retained (server_id nullable in monthly) |
| TDP changed during day | Use current TDP for snapshot |
| Rate changed during day | Use current rate for snapshot |
| Missed snapshot (hub down) | No backfill - accept gap in data |
| No data for period | Return empty array, UI shows "No data" |
| Server offline all day | Record $0 cost (kWh=0) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large data volume | Rollup job + 2-year daily retention |
| Scheduler not running | Log job execution, monitor in observability |
| Clock skew | Use UTC consistently |
| Missing historical data | UI gracefully shows "No historical data" |

---

## Notes

- Cost calculation reuses existing `power.py` functions for consistency
- Workstation hours_used captured from uptime service at snapshot time
- Charts use Recharts (already a project dependency)
- Consider adding CSV export in future enhancement

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial plan creation |
