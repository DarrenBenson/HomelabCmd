# PL0039: Dashboard Cost Summary Display - Implementation Plan

> **Status:** In Progress
> **Story:** [US0035: Dashboard Cost Summary Display](../stories/US0035-dashboard-cost-display.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Language:** Python (Backend)

## Overview

Implement the cost summary API endpoint and Dashboard cost badge that shows estimated daily and monthly electricity costs based on server TDP values and the configured electricity rate.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Daily cost in summary bar | GET /api/v1/costs/summary returns daily cost |
| AC2 | Monthly cost available | Response includes monthly_cost (daily × 30) |
| AC3 | Cost calculation correct | Formula: (TDP × 24 × rate) / 1000 |
| AC4 | Missing TDP handled | Servers without TDP excluded from calculation |
| AC5 | Currency symbol used | Response includes configured currency_symbol |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, SQLAlchemy 2.0 (async)
- **Test Framework:** pytest

### Relevant Best Practices

- New route file for costs (following existing patterns from servers.py, config.py)
- Use Pydantic v2 for response validation
- FastAPI dependency injection for auth and db session
- Aggregate TDP from Server model where tdp_watts IS NOT NULL

### Existing Patterns

**Server Model (from server.py):**
- `tdp_watts: Mapped[int | None]` - Integer field, nullable

**Config Route (from config.py):**
- `get_config_value()` helper for reading cost config
- `CostConfig` schema with electricity_rate and currency_symbol

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** API story with 8 edge cases, clear API contract, straightforward implementation.

### Test Priority

1. Returns default values with no servers (AC4 edge case)
2. Calculates cost correctly for single server (AC3)
3. Calculates cost correctly for multiple servers
4. Excludes servers without TDP (AC4)
5. Returns configured currency symbol (AC5)
6. Daily × 30 = monthly cost (AC2)
7. Edge cases: rate=0, single server, fractional TDP

## Implementation Steps

### Phase 1: Backend - Schemas

**Goal:** Create CostSummary Pydantic schema

#### Step 1.1: Create schemas/costs.py

- [ ] Create CostSummaryResponse schema matching API contract
- [ ] All fields with appropriate types and defaults

**Schema Structure:**
```python
class CostSummaryResponse(BaseModel):
    """Response for cost summary endpoint."""
    daily_cost: float
    monthly_cost: float
    currency_symbol: str
    servers_included: int
    servers_missing_tdp: int
    total_tdp_watts: int
    electricity_rate: float
```

### Phase 2: Backend - API Endpoint

**Goal:** Implement cost summary endpoint

#### Step 2.1: Create routes/costs.py

- [ ] Create new router with prefix="/costs"
- [ ] Implement GET /api/v1/costs/summary endpoint
- [ ] Query all servers and aggregate TDP
- [ ] Read electricity rate from config (or use default)
- [ ] Calculate daily cost: (total_tdp × 24 × rate) / 1000
- [ ] Calculate monthly cost: daily × 30
- [ ] Count servers with/without TDP

**API Contract:**

```
GET /api/v1/costs/summary
Response 200:
{
  "daily_cost": 3.20,
  "monthly_cost": 96.00,
  "currency_symbol": "£",
  "servers_included": 9,
  "servers_missing_tdp": 2,
  "total_tdp_watts": 555,
  "electricity_rate": 0.24
}
```

#### Step 2.2: Register router in main.py

- [ ] Import costs router
- [ ] Add app.include_router(costs.router, prefix="/api/v1")

### Phase 3: Testing

**Goal:** Comprehensive test coverage for all edge cases

#### Step 3.1: Create test_cost_summary.py

- [ ] Test returns default values with no servers
- [ ] Test single server calculation (AC3)
- [ ] Test multiple servers sum TDP correctly
- [ ] Test servers without TDP excluded (AC4)
- [ ] Test configured currency symbol returned (AC5)
- [ ] Test monthly = daily × 30 (AC2)
- [ ] Test rate = 0 returns £0.00
- [ ] Test fractional TDP handled
- [ ] Test requires authentication

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| No servers | Return daily_cost=0, servers_included=0 |
| No TDP configured | Return daily_cost=0, servers_missing_tdp=total servers |
| All servers offline | Still calculate (TDP doesn't depend on status) |
| Very high cost (>£100/day) | Display normally, no upper limit |
| Rate = 0 (free electricity) | Return daily_cost=0 |
| Currency symbol empty | Return empty string |
| Single server | Calculate for 1 server correctly |
| Fractional TDP (e.g., 65.5W) | Use full precision, round to 2 decimals |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Float precision issues | Display shows unexpected decimals | Round to 2 decimal places |
| Large number of servers | Slow query | Single aggregation query, no joins needed |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0033: TDP Configuration | Story | Done - provides tdp_watts field |
| US0034: Electricity Rate Configuration | Story | Done - provides rate config |

## Open Questions

None - requirements are clear from story.

## Definition of Done Checklist

- [ ] CostSummaryResponse schema created
- [ ] GET /api/v1/costs/summary endpoint implemented
- [ ] Router registered in main.py
- [ ] All 8 edge cases tested
- [ ] All 5 acceptance criteria verified
- [ ] Tests passing
- [ ] No linting errors (ruff)

## Notes

**File Count:** 3 new files (schemas/costs.py, routes/costs.py, tests/test_cost_summary.py), 1 modified (main.py)

**Backend Implementation Order:**
1. Write tests first (TDD approach)
2. Add schema to schemas/costs.py
3. Add endpoint to routes/costs.py
4. Register router in main.py
5. Verify tests pass

---

## Phase 4: Frontend - Dashboard Cost Badge (Added 2026-01-20)

**Goal:** Add cost badge to Dashboard header

### Step 4.1: Create CostBadge Component
- [x] Create `frontend/src/components/CostBadge.tsx`
- [x] Display format: "£3.20/day"
- [x] Tooltip showing daily/monthly breakdown
- [x] Click navigates to /costs page

### Step 4.2: Create Cost API Client
- [x] Create `frontend/src/api/costs.ts` with getCostSummary

### Step 4.3: Update Dashboard.tsx
- [x] Import CostBadge component
- [x] Fetch cost summary on load
- [x] Display cost badge in header

### Step 4.4: Frontend Tests
- [x] Add CostBadge.test.tsx
- [x] Add Dashboard.test.tsx cases for cost badge
