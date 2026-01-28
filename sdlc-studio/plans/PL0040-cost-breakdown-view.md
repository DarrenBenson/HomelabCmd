# PL0040: Cost Breakdown View - Implementation Plan

> **Status:** In Progress
> **Story:** [US0036: Cost Breakdown View](../stories/US0036-cost-breakdown-view.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Language:** Python (Backend)

## Overview

Implement the cost breakdown API endpoint that returns per-server electricity cost estimates, sorted by cost (highest first), with servers missing TDP listed separately. This builds on the existing cost summary endpoint (US0035) and uses the same calculation formula.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Cost breakdown page accessible | GET /api/v1/costs/breakdown returns data |
| AC2 | Per-server costs listed | Each server shows daily and monthly cost |
| AC3 | Sorted by cost | Servers sorted by cost (highest first) |
| AC4 | TDP shown alongside cost | Response includes tdp_watts per server |
| AC5 | Missing TDP highlighted | Servers without TDP have null costs, listed last |
| AC6 | Total matches summary | Totals match /api/v1/costs/summary values |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, SQLAlchemy 2.0 (async)
- **Test Framework:** pytest

### Relevant Best Practices

- Type hints for function signatures
- Docstrings for public functions
- Ruff formatting
- pytest conventions with descriptive test names

### Existing Patterns

**From costs.py (US0035):**
- `calculate_daily_cost()` helper function - reuse for per-server calculation
- Router pattern with `/costs` prefix
- `CostSummaryResponse` schema pattern
- `get_config_value()` for reading cost config
- `DEFAULT_COST` for fallback values

**Server Model (from server.py):**
- `id: str` - Server slug ID
- `hostname: str` - Server hostname
- `tdp_watts: int | None` - TDP value (nullable)

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** API story with 12 edge cases, clear API contract, well-defined response structure. Tests will drive implementation and ensure all edge cases are covered.

### Test Priority

1. Returns 200 with correct response structure (AC1)
2. Returns per-server costs with correct calculation (AC2)
3. Servers sorted by monthly_cost descending (AC3)
4. Servers without TDP have null costs and appear last (AC5)
5. Totals match summary endpoint values (AC6)
6. Edge cases: no servers, all missing TDP, single server, rate=0

### Documentation Updates Required

- [x] Update TS0012 test spec with new test cases
- [x] Update plan index with PL0040

## Implementation Steps

### Phase 1: Backend - Schemas

**Goal:** Create response schemas for cost breakdown endpoint

#### Step 1.1: Create ServerCostItem schema

- [ ] Add `ServerCostItem` class to `schemas/costs.py`
- [ ] Fields: server_id, hostname, tdp_watts (nullable), daily_cost (nullable), monthly_cost (nullable)

**Schema Structure:**
```python
class ServerCostItem(BaseModel):
    """Per-server cost information."""
    server_id: str
    hostname: str
    tdp_watts: int | None
    daily_cost: float | None
    monthly_cost: float | None
```

#### Step 1.2: Create CostTotals schema

- [ ] Add `CostTotals` class to `schemas/costs.py`
- [ ] Fields: servers_with_tdp, servers_without_tdp, total_tdp_watts, daily_cost, monthly_cost

**Schema Structure:**
```python
class CostTotals(BaseModel):
    """Aggregate cost totals."""
    servers_with_tdp: int
    servers_without_tdp: int
    total_tdp_watts: int
    daily_cost: float
    monthly_cost: float
```

#### Step 1.3: Create CostSettings schema

- [ ] Add `CostSettings` class to `schemas/costs.py`
- [ ] Fields: electricity_rate, currency_symbol

**Schema Structure:**
```python
class CostSettings(BaseModel):
    """Cost configuration settings."""
    electricity_rate: float
    currency_symbol: str
```

#### Step 1.4: Create CostBreakdownResponse schema

- [ ] Add `CostBreakdownResponse` class to `schemas/costs.py`
- [ ] Fields: servers (list), totals, settings

**Schema Structure:**
```python
class CostBreakdownResponse(BaseModel):
    """Response for cost breakdown endpoint."""
    servers: list[ServerCostItem]
    totals: CostTotals
    settings: CostSettings
```

### Phase 2: Backend - API Endpoint

**Goal:** Implement GET /api/v1/costs/breakdown endpoint

#### Step 2.1: Add breakdown endpoint to routes/costs.py

- [ ] Create `get_cost_breakdown()` async function
- [ ] Query all servers
- [ ] Calculate per-server costs using existing `calculate_daily_cost()` helper
- [ ] Sort servers: with TDP by monthly_cost desc, then without TDP
- [ ] Build totals (reuse logic from summary endpoint)
- [ ] Return CostBreakdownResponse

**API Contract:**
```
GET /api/v1/costs/breakdown
Response 200:
{
  "servers": [
    {
      "server_id": "ollama-server",
      "hostname": "ollama-server",
      "tdp_watts": 125,
      "daily_cost": 0.72,
      "monthly_cost": 21.60
    },
    {
      "server_id": "backup-server",
      "hostname": "backup-server",
      "tdp_watts": null,
      "daily_cost": null,
      "monthly_cost": null
    }
  ],
  "totals": {
    "servers_with_tdp": 9,
    "servers_without_tdp": 2,
    "total_tdp_watts": 321,
    "daily_cost": 1.85,
    "monthly_cost": 55.46
  },
  "settings": {
    "electricity_rate": 0.24,
    "currency_symbol": "£"
  }
}
```

### Phase 3: Testing

**Goal:** Comprehensive test coverage for all edge cases

#### Step 3.1: Create test_cost_breakdown.py

- [ ] Test returns 200 with correct structure
- [ ] Test per-server costs calculated correctly
- [ ] Test servers sorted by cost descending
- [ ] Test servers without TDP appear last with null costs
- [ ] Test totals match summary endpoint
- [ ] Test no servers returns empty list with zero totals
- [ ] Test all servers missing TDP
- [ ] Test single server with TDP
- [ ] Test single server without TDP
- [ ] Test rate=0 returns all costs as 0.00
- [ ] Test very high TDP (1000W)
- [ ] Test requires authentication (401)

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | No servers | Return empty servers list, totals all zero | Phase 2 | [ ] |
| 2 | All servers missing TDP | Return all servers with null costs, totals zero | Phase 2 | [ ] |
| 3 | Single server with TDP | Return that server, total equals server cost | Phase 2 | [ ] |
| 4 | Single server without TDP | Return server with null costs, totals zero | Phase 2 | [ ] |
| 5 | Mix of servers with/without TDP | Sort: with TDP (by cost desc), then without TDP | Phase 2 | [ ] |
| 6 | Rate = 0 (free electricity) | All costs = 0.00, TDP still shown | Phase 2 | [ ] |
| 7 | Very high TDP (e.g., 1000W) | Calculate correctly: daily=5.76, monthly=172.80 | Phase 2 | [ ] |
| 8 | Fractional cost rounding | Round to 2 decimal places | Phase 2 | [ ] |
| 9 | Server offline but has TDP | Still calculate cost (TDP is static) | Phase 2 | [ ] |
| 10 | Currency symbol empty | Return empty string in settings.currency_symbol | Phase 2 | [ ] |
| 11 | Sort by different columns | API returns sorted by cost; frontend handles column sort | N/A (Frontend) | [ ] |
| 12 | 401 Unauthorised | Return 401 when no API key | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 12
- Handled in plan: 12
- Unhandled: 0

### Edge Case Implementation Notes

- Edge case #11 (sort by different columns) is frontend responsibility; API returns default sort by cost
- Rounding handled by `round(value, 2)` in calculation
- Server status is not considered for cost calculation (TDP-based estimate only)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Float precision issues | Display shows unexpected decimals | Round to 2 decimal places in calculation |
| Large number of servers | Slow query | Single query with in-memory processing; future: pagination |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0035: Dashboard Cost Summary Display | Story | Done - provides calculate_daily_cost() helper |
| US0034: Electricity Rate Configuration | Story | Done - provides cost config API |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [ ] Schemas added to schemas/costs.py
- [ ] GET /api/v1/costs/breakdown endpoint implemented
- [ ] All 12 edge cases tested
- [ ] All 6 acceptance criteria verified
- [ ] Tests passing
- [ ] No linting errors (ruff)

## Notes

**File Count:** 2 modified files (schemas/costs.py, routes/costs.py), 1 new file (tests/test_cost_breakdown.py)

**Backend Implementation Order (TDD):**
1. Write tests first
2. Verify tests fail (404)
3. Add schemas
4. Implement endpoint
5. Verify tests pass
6. Run ruff for formatting

---

## Phase 4: Frontend - Costs Page (Added 2026-01-20)

**Goal:** Create /costs page with full cost breakdown

### Step 4.1: Create CostsPage Component
- [x] Create `frontend/src/pages/CostsPage.tsx`
- [x] Table: Server, TDP, Daily Cost, Monthly Cost, Edit button
- [x] Sortable columns (default: cost descending)
- [x] Servers without TDP listed separately with "Set TDP" buttons
- [x] Total row at bottom
- [x] Rate display in header

### Step 4.2: Create TdpEditModal Component
- [x] Create `frontend/src/components/TdpEditModal.tsx`
- [x] TDP input with preset buttons
- [x] Presets: Raspberry Pi 4 (5W), Mini PC (15W), NAS (25W), Desktop (65W)
- [x] Save/Cancel buttons

### Step 4.3: Add Cost Breakdown API
- [x] Add getCostBreakdown to `frontend/src/api/costs.ts`

### Step 4.4: Update App.tsx Routing
- [x] Add /costs route

### Step 4.5: Frontend Tests
- [x] Add CostsPage.test.tsx
- [x] Add TdpEditModal.test.tsx
