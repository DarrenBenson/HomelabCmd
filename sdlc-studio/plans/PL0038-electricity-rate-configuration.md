# PL0038: Electricity Rate Configuration - Implementation Plan

> **Status:** In Progress
> **Story:** [US0034: Electricity Rate Configuration](../stories/US0034-electricity-rate-configuration.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Language:** Python (Backend)

## Overview

Implement electricity rate configuration endpoints and Settings UI allowing users to set their electricity rate (per kWh) and currency symbol.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | View current electricity rate | GET /api/v1/settings/cost returns current rate |
| AC2 | Update electricity rate | PUT /api/v1/settings/cost saves new rate |
| AC3 | Default rate provided | Fresh install uses £0.24/kWh |
| AC4 | Currency configurable | Can change currency symbol |
| AC5 | Rate persists across restarts | Rate stored in Config table |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, SQLAlchemy 2.0 (async)
- **Test Framework:** pytest

### Relevant Best Practices

- Follow existing config route patterns (get_config_value, set_config_value helpers)
- Use Pydantic v2 for request/response validation with Field constraints
- Support partial updates using model_dump(exclude_unset=True)
- FastAPI dependency injection for auth and db session

### Existing Patterns

**Config Pattern (from config.py):**
- Config model uses key-value storage with JSON value
- DEFAULT_* constants for fallback values
- get_config_value() / set_config_value() helpers for DB access
- Partial updates with deep merging for nested configs
- Flat fields updated directly when present in update dict

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** API story with 8 edge cases, clear API contracts, straightforward implementation. Tests first will ensure all edge cases are covered.

### Test Priority

1. Default rate returned on fresh install (AC3)
2. Rate can be viewed via GET (AC1)
3. Rate can be updated via PUT (AC2)
4. Currency symbol can be changed (AC4)
5. Edge cases: rate=0, negative rate (422), very high rate, empty currency, multi-char currency, many decimals, invalid type, missing field

## Implementation Steps

### Phase 1: Backend - Schemas

**Goal:** Create CostConfig Pydantic schemas

#### Step 1.1: Add Cost Schemas to config.py

- [ ] Add CostConfig schema with electricity_rate (float, ge=0) and currency_symbol (str)
- [ ] Add CostConfigUpdate schema with Optional fields for partial updates
- [ ] Add CostConfigResponse schema including updated_at

**Schema Structure:**
```python
class CostConfig(BaseModel):
    """Cost tracking configuration.

    Default values:
    - electricity_rate: £0.24/kWh (UK average)
    - currency_symbol: £
    """
    electricity_rate: float = Field(default=0.24, ge=0)
    currency_symbol: str = Field(default="£", min_length=0, max_length=10)


class CostConfigUpdate(BaseModel):
    """Schema for updating cost config (all fields optional)."""
    electricity_rate: float | None = Field(default=None, ge=0)
    currency_symbol: str | None = Field(default=None, max_length=10)


class CostConfigResponse(BaseModel):
    """Response for cost settings endpoint."""
    electricity_rate: float
    currency_symbol: str
    updated_at: datetime | None = None
```

### Phase 2: Backend - API Endpoints

**Goal:** Implement cost settings endpoints

#### Step 2.1: Add Cost Endpoints to config.py

- [ ] Add DEFAULT_COST constant
- [ ] Implement GET /api/v1/config/cost endpoint
- [ ] Implement PUT /api/v1/config/cost endpoint with partial update support
- [ ] Return 422 for invalid values (Pydantic handles this automatically)

**API Contract:**

```
GET /api/v1/config/cost
Response 200:
{
  "electricity_rate": 0.24,
  "currency_symbol": "£",
  "updated_at": "2026-01-18T10:00:00Z"
}

PUT /api/v1/config/cost
Request:
{
  "electricity_rate": 0.28,
  "currency_symbol": "£"
}
Response 200:
{
  "electricity_rate": 0.28,
  "currency_symbol": "£",
  "updated_at": "2026-01-20T10:30:00Z"
}
```

**Note:** Story specifies `/api/v1/settings/cost` but existing config endpoints use `/api/v1/config/*`. Will use `/api/v1/config/cost` for consistency with existing patterns.

### Phase 3: Testing

**Goal:** Comprehensive test coverage for all edge cases

#### Step 3.1: Create test_cost_config.py

- [ ] Test GET returns default on fresh install (AC3)
- [ ] Test GET returns current rate (AC1)
- [ ] Test PUT updates rate (AC2)
- [ ] Test currency symbol change (AC4)
- [ ] Test rate persists (AC5 - implicit in DB storage)
- [ ] Test rate = 0 allowed
- [ ] Test negative rate returns 422
- [ ] Test very high rate allowed
- [ ] Test empty currency defaults to £
- [ ] Test multi-character currency (EUR) allowed
- [ ] Test many decimals stored correctly
- [ ] Test invalid type (string for rate) returns 422
- [ ] Test missing electricity_rate uses existing/default (partial update)

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Rate = 0 | Allow (free electricity scenario) |
| Negative rate | Pydantic ge=0 constraint returns 422 |
| Very high rate | No upper limit enforced |
| Empty currency symbol | Allow empty string (will display nothing) |
| Multi-character currency (e.g., "EUR") | Allow, max_length=10 |
| Rate with many decimals (0.123456789) | Store as-is (float precision) |
| Invalid type (string "abc" for rate) | Pydantic type validation returns 422 |
| Missing electricity_rate field | Use existing value (partial update) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Float precision issues | Display shows unexpected decimals | Frontend will handle display rounding |
| Currency symbol injection | XSS | No frontend in this story; frontend will sanitise |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0001: Database Schema | Story | Done - provides Config model |
| US0043: System Settings | Story | Done - provides config route patterns |

## Open Questions

None - requirements are clear from story.

## Definition of Done Checklist

- [ ] CostConfig and CostConfigUpdate schemas created
- [ ] GET /api/v1/config/cost endpoint implemented
- [ ] PUT /api/v1/config/cost endpoint implemented
- [ ] All 8 edge cases tested
- [ ] All 5 acceptance criteria verified
- [ ] Tests passing
- [ ] No linting errors (ruff)

## Notes

**File Count:** 2 modified files (schemas/config.py, routes/config.py), 1 new test file

**Backend Implementation Order:**
1. Write tests first (TDD approach)
2. Add schemas to config.py
3. Add endpoints to routes/config.py
4. Verify tests pass

---

## Phase 4: Frontend - Settings UI (Added 2026-01-20)

**Goal:** Add Cost Tracking section to Settings page

### Step 4.1: Create Cost Types
- [x] Create `frontend/src/types/cost.ts` with CostConfig types
- [x] Add getCostConfig/updateCostConfig to `frontend/src/api/config.ts`

### Step 4.2: Update Settings.tsx
- [x] Add Cost Tracking section with electricity rate input
- [x] Add currency symbol input
- [x] Add save button with loading state
- [x] Add common rates reference (UK £0.24, US $0.12)

### Step 4.3: Frontend Tests
- [x] Add Settings.test.tsx cases for cost config section
