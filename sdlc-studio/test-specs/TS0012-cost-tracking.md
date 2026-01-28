# TS0012: Cost Tracking Tests

> **Status:** Active
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-20
> **Last Updated:** 2026-01-20

## Overview

Test specification for the Cost Tracking feature, covering electricity rate configuration and cost summary calculation. Includes tests for the settings API and the cost summary API endpoint.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0034](../stories/US0034-electricity-rate-configuration.md) | Electricity Rate Configuration | High |
| [US0035](../stories/US0035-dashboard-cost-display.md) | Dashboard Cost Summary Display | High |
| [US0036](../stories/US0036-cost-breakdown-view.md) | Cost Breakdown View | High |

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | No | No complex business logic |
| Integration | No | Simple CRUD, API tests sufficient |
| API | Yes | Config endpoints validation |
| E2E | No | Backend only, frontend in future story |

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | pytest, pytest-asyncio, FastAPI TestClient |
| External Services | None |
| Test Data | Default rate fixtures |

---

## Test Cases

### TC063: GET cost returns default rate on fresh install

**Type:** API
**Priority:** High
**Story:** US0034 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no cost configuration exists | Fresh database |
| 2 | When GET /api/v1/config/cost is called | API request |
| 3 | Then default rate of £0.24/kWh is returned | Default values |

#### Test Data

```yaml
expected:
  status_code: 200
  body:
    electricity_rate: 0.24
    currency_symbol: "£"
```

#### Assertions

- [ ] Response status is 200
- [ ] electricity_rate is 0.24
- [ ] currency_symbol is "£"

---

### TC064: GET cost returns current rate

**Type:** API
**Priority:** High
**Story:** US0034 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given cost configuration has been set | Rate configured |
| 2 | When GET /api/v1/config/cost is called | API request |
| 3 | Then current rate is returned | Configured values |

#### Test Data

```yaml
setup:
  PUT /api/v1/config/cost:
    electricity_rate: 0.28
    currency_symbol: "$"
expected:
  status_code: 200
  body:
    electricity_rate: 0.28
    currency_symbol: "$"
```

#### Assertions

- [ ] Response status is 200
- [ ] Returns previously set rate
- [ ] Returns previously set currency symbol

---

### TC065: PUT cost updates rate

**Type:** API
**Priority:** High
**Story:** US0034 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with new rate | Update request |
| 3 | Then new rate is saved | Rate persisted |

#### Test Data

```yaml
input:
  request_body:
    electricity_rate: 0.32
expected:
  status_code: 200
  body:
    electricity_rate: 0.32
```

#### Assertions

- [ ] Response status is 200
- [ ] Response contains new rate
- [ ] Subsequent GET returns new rate

---

### TC066: PUT cost updates currency symbol

**Type:** API
**Priority:** High
**Story:** US0034 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with new currency | Update request |
| 3 | Then new currency is saved | Currency persisted |

#### Test Data

```yaml
input:
  request_body:
    currency_symbol: "$"
expected:
  status_code: 200
  body:
    currency_symbol: "$"
```

#### Assertions

- [ ] Response status is 200
- [ ] Response contains new currency symbol
- [ ] Subsequent GET returns new currency symbol

---

### TC067: Rate persists across requests (simulates restart)

**Type:** API
**Priority:** High
**Story:** US0034 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given rate has been configured | Rate set |
| 2 | When making a new GET request | Fresh request |
| 3 | Then previously set rate is returned | Persistence verified |

#### Test Data

```yaml
setup:
  PUT /api/v1/config/cost:
    electricity_rate: 0.35
expected:
  GET /api/v1/config/cost:
    electricity_rate: 0.35
```

#### Assertions

- [ ] Rate persists in database
- [ ] GET returns same value as PUT set

---

### TC068: Rate = 0 is allowed

**Type:** API
**Priority:** Medium
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with rate = 0 | Zero rate |
| 3 | Then request succeeds | 200 OK |

#### Test Data

```yaml
input:
  request_body:
    electricity_rate: 0
expected:
  status_code: 200
  body:
    electricity_rate: 0
```

#### Assertions

- [ ] Response status is 200
- [ ] Rate 0 is accepted and stored

---

### TC069: Negative rate returns 422

**Type:** API
**Priority:** High
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with negative rate | Invalid rate |
| 3 | Then request rejected with 422 | Validation error |

#### Test Data

```yaml
input:
  request_body:
    electricity_rate: -0.10
expected:
  status_code: 422
```

#### Assertions

- [ ] Response status is 422
- [ ] Error message indicates invalid value

---

### TC070: Very high rate is allowed

**Type:** API
**Priority:** Low
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with high rate | Very high rate |
| 3 | Then request succeeds | 200 OK |

#### Test Data

```yaml
input:
  request_body:
    electricity_rate: 999.99
expected:
  status_code: 200
  body:
    electricity_rate: 999.99
```

#### Assertions

- [ ] Response status is 200
- [ ] No upper limit enforced

---

### TC071: Empty currency symbol is allowed

**Type:** API
**Priority:** Medium
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with empty currency | Empty string |
| 3 | Then request succeeds | 200 OK |

#### Test Data

```yaml
input:
  request_body:
    currency_symbol: ""
expected:
  status_code: 200
  body:
    currency_symbol: ""
```

#### Assertions

- [ ] Response status is 200
- [ ] Empty string accepted

---

### TC072: Multi-character currency allowed (EUR)

**Type:** API
**Priority:** Medium
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with "EUR" | Multi-char currency |
| 3 | Then request succeeds | 200 OK |

#### Test Data

```yaml
input:
  request_body:
    currency_symbol: "EUR"
expected:
  status_code: 200
  body:
    currency_symbol: "EUR"
```

#### Assertions

- [ ] Response status is 200
- [ ] Multi-character currency stored correctly

---

### TC073: Rate with many decimals stored correctly

**Type:** API
**Priority:** Medium
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with many decimals | High precision |
| 3 | Then rate is stored as-is | Float precision |

#### Test Data

```yaml
input:
  request_body:
    electricity_rate: 0.123456789
expected:
  status_code: 200
  body:
    electricity_rate: 0.123456789
```

#### Assertions

- [ ] Response status is 200
- [ ] Rate stored with full precision

---

### TC074: Invalid type for rate returns 422

**Type:** API
**Priority:** High
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the settings API | API available |
| 2 | When PUT /api/v1/config/cost with string rate | Invalid type |
| 3 | Then request rejected with 422 | Type validation |

#### Test Data

```yaml
input:
  request_body:
    electricity_rate: "abc"
expected:
  status_code: 422
```

#### Assertions

- [ ] Response status is 422
- [ ] Error indicates type error

---

### TC075: Partial update preserves existing values

**Type:** API
**Priority:** High
**Story:** US0034 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given rate and currency both configured | Both set |
| 2 | When PUT with only rate (no currency) | Partial update |
| 3 | Then currency is preserved | No data loss |

#### Test Data

```yaml
setup:
  PUT /api/v1/config/cost:
    electricity_rate: 0.24
    currency_symbol: "$"
input:
  request_body:
    electricity_rate: 0.30
expected:
  status_code: 200
  body:
    electricity_rate: 0.30
    currency_symbol: "$"
```

#### Assertions

- [ ] Response status is 200
- [ ] Rate updated to new value
- [ ] Currency preserved from previous value

---

### TC076: GET cost requires authentication

**Type:** API
**Priority:** High
**Story:** US0034 (Security)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no API key provided | Unauthenticated |
| 2 | When GET /api/v1/config/cost | Request without auth |
| 3 | Then 401 Unauthorized returned | Auth required |

#### Test Data

```yaml
input:
  headers: {}  # No X-API-Key
expected:
  status_code: 401
```

#### Assertions

- [ ] Response status is 401

---

### TC077: PUT cost requires authentication

**Type:** API
**Priority:** High
**Story:** US0034 (Security)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no API key provided | Unauthenticated |
| 2 | When PUT /api/v1/config/cost | Request without auth |
| 3 | Then 401 Unauthorized returned | Auth required |

#### Test Data

```yaml
input:
  headers: {}  # No X-API-Key
  body:
    electricity_rate: 0.30
expected:
  status_code: 401
```

#### Assertions

- [ ] Response status is 401

---

### TC078: Response includes updated_at timestamp

**Type:** API
**Priority:** Medium
**Story:** US0034 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given cost configuration exists | Rate configured |
| 2 | When GET /api/v1/config/cost | API request |
| 3 | Then response includes updated_at | Timestamp present |

#### Test Data

```yaml
expected:
  body:
    updated_at: "2026-01-20T10:00:00Z"  # ISO 8601 format
```

#### Assertions

- [ ] updated_at field present in response
- [ ] Format is ISO 8601

---

## Cost Summary Tests (US0035)

### TC079: GET cost summary returns zero with no servers

**Type:** API
**Priority:** High
**Story:** US0035 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no servers exist | Empty database |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then daily_cost is 0 and servers_included is 0 | Zero values |

#### Test Data

```yaml
expected:
  status_code: 200
  body:
    daily_cost: 0.0
    monthly_cost: 0.0
    servers_included: 0
    servers_missing_tdp: 0
```

#### Assertions

- [ ] Response status is 200
- [ ] daily_cost is 0.0
- [ ] monthly_cost is 0.0
- [ ] servers_included is 0

---

### TC080: Cost calculation for single server

**Type:** API
**Priority:** High
**Story:** US0035 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP=65W and rate=£0.24/kWh | Server and rate configured |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then daily_cost = (65 × 24 × 0.24) / 1000 = £0.37 | Correct calculation |

#### Test Data

```yaml
setup:
  server:
    id: "test-server"
    hostname: "test"
    tdp_watts: 65
  rate: 0.24
expected:
  status_code: 200
  body:
    daily_cost: 0.37
    monthly_cost: 11.1
    servers_included: 1
    total_tdp_watts: 65
```

#### Assertions

- [ ] Response status is 200
- [ ] daily_cost is 0.37 (rounded to 2 decimals)
- [ ] monthly_cost is 11.1 (daily × 30)
- [ ] servers_included is 1

---

### TC081: Cost calculation for multiple servers

**Type:** API
**Priority:** High
**Story:** US0035 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 3 servers with TDP 65W, 80W, 120W | Multiple servers |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then TDP summed and cost calculated | Total = 265W |

#### Test Data

```yaml
setup:
  servers:
    - {id: "s1", tdp_watts: 65}
    - {id: "s2", tdp_watts: 80}
    - {id: "s3", tdp_watts: 120}
  rate: 0.24
expected:
  status_code: 200
  body:
    daily_cost: 1.53  # (265 × 24 × 0.24) / 1000
    servers_included: 3
    total_tdp_watts: 265
```

#### Assertions

- [ ] Response status is 200
- [ ] total_tdp_watts is 265
- [ ] servers_included is 3

---

### TC082: Servers without TDP excluded from calculation

**Type:** API
**Priority:** High
**Story:** US0035 (AC4)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 3 servers, 2 with TDP, 1 without | Mixed configuration |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then only servers with TDP included | servers_missing_tdp shows count |

#### Test Data

```yaml
setup:
  servers:
    - {id: "s1", tdp_watts: 65}
    - {id: "s2", tdp_watts: null}
    - {id: "s3", tdp_watts: 80}
expected:
  status_code: 200
  body:
    servers_included: 2
    servers_missing_tdp: 1
    total_tdp_watts: 145
```

#### Assertions

- [ ] servers_included is 2
- [ ] servers_missing_tdp is 1
- [ ] total_tdp_watts is 145 (65 + 80)

---

### TC083: Returns configured currency symbol

**Type:** API
**Priority:** High
**Story:** US0035 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given currency configured as "$" | Custom currency |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then response includes currency_symbol "$" | Currency returned |

#### Test Data

```yaml
setup:
  PUT /api/v1/config/cost:
    currency_symbol: "$"
expected:
  body:
    currency_symbol: "$"
```

#### Assertions

- [ ] currency_symbol is "$"

---

### TC084: Monthly cost equals daily × 30

**Type:** API
**Priority:** High
**Story:** US0035 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP configured | Server exists |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then monthly_cost = daily_cost × 30 | Correct multiplication |

#### Test Data

```yaml
setup:
  server:
    tdp_watts: 100
  rate: 0.24
expected:
  body:
    daily_cost: 0.58  # (100 × 24 × 0.24) / 1000 = 0.576, rounded
    monthly_cost: 17.4  # 0.58 × 30
```

#### Assertions

- [ ] monthly_cost equals daily_cost × 30

---

### TC085: Rate = 0 returns zero cost

**Type:** API
**Priority:** Medium
**Story:** US0035 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP and rate = 0 | Free electricity |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then daily_cost is 0 | Zero cost |

#### Test Data

```yaml
setup:
  server:
    tdp_watts: 100
  PUT /api/v1/config/cost:
    electricity_rate: 0
expected:
  body:
    daily_cost: 0.0
    monthly_cost: 0.0
```

#### Assertions

- [ ] daily_cost is 0.0
- [ ] monthly_cost is 0.0

---

### TC086: Fractional TDP handled correctly

**Type:** API
**Priority:** Medium
**Story:** US0035 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP stored as integer | TDP is integer in model |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then calculation uses integer correctly | Correct result |

#### Test Data

```yaml
setup:
  server:
    tdp_watts: 65
  rate: 0.24
expected:
  body:
    daily_cost: 0.37
    total_tdp_watts: 65
```

#### Assertions

- [ ] daily_cost calculated correctly
- [ ] total_tdp_watts is integer

---

### TC087: GET cost summary requires authentication

**Type:** API
**Priority:** High
**Story:** US0035 (Security)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no API key provided | Unauthenticated |
| 2 | When GET /api/v1/costs/summary | Request without auth |
| 3 | Then 401 Unauthorized returned | Auth required |

#### Test Data

```yaml
input:
  headers: {}  # No X-API-Key
expected:
  status_code: 401
```

#### Assertions

- [ ] Response status is 401

---

### TC088: Returns electricity_rate in response

**Type:** API
**Priority:** Medium
**Story:** US0035 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given electricity rate configured | Rate set |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then response includes electricity_rate | Rate in response |

#### Test Data

```yaml
setup:
  PUT /api/v1/config/cost:
    electricity_rate: 0.28
expected:
  body:
    electricity_rate: 0.28
```

#### Assertions

- [ ] electricity_rate field present
- [ ] electricity_rate matches configured value

---

### TC089: All servers without TDP returns zero cost

**Type:** API
**Priority:** Medium
**Story:** US0035 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 2 servers, none with TDP configured | No TDP data |
| 2 | When GET /api/v1/costs/summary is called | API request |
| 3 | Then daily_cost is 0 with servers_missing_tdp=2 | Zero with count |

#### Test Data

```yaml
setup:
  servers:
    - {id: "s1", tdp_watts: null}
    - {id: "s2", tdp_watts: null}
expected:
  body:
    daily_cost: 0.0
    servers_included: 0
    servers_missing_tdp: 2
```

#### Assertions

- [ ] daily_cost is 0.0
- [ ] servers_included is 0
- [ ] servers_missing_tdp is 2

---

## Cost Breakdown Tests (US0036)

### TC090: GET cost breakdown returns 200 with correct structure

**Type:** API
**Priority:** High
**Story:** US0036 (AC1)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given the costs API | API available |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then response has servers, totals, settings | Correct structure |

#### Test Data

```yaml
expected:
  status_code: 200
  body:
    servers: []
    totals:
      servers_with_tdp: 0
      servers_without_tdp: 0
      total_tdp_watts: 0
      daily_cost: 0.0
      monthly_cost: 0.0
    settings:
      electricity_rate: 0.24
      currency_symbol: "£"
```

#### Assertions

- [ ] Response status is 200
- [ ] Response contains servers list
- [ ] Response contains totals object
- [ ] Response contains settings object

---

### TC091: Per-server costs calculated correctly

**Type:** API
**Priority:** High
**Story:** US0036 (AC2)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP=65W and rate=£0.24/kWh | Server configured |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then server shows daily_cost=0.37, monthly_cost=11.23 | Correct calculation |

#### Test Data

```yaml
setup:
  server:
    id: "test-server"
    hostname: "test"
    tdp_watts: 65
  rate: 0.24
expected:
  body:
    servers:
      - server_id: "test-server"
        hostname: "test"
        tdp_watts: 65
        daily_cost: 0.37
        monthly_cost: 11.1
```

#### Assertions

- [ ] Server appears in servers list
- [ ] daily_cost calculated correctly
- [ ] monthly_cost = daily × 30

---

### TC092: Servers sorted by cost descending

**Type:** API
**Priority:** High
**Story:** US0036 (AC3)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 3 servers with different TDP values | Multiple servers |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then servers sorted by monthly_cost descending | Highest cost first |

#### Test Data

```yaml
setup:
  servers:
    - {id: "low", hostname: "low", tdp_watts: 10}
    - {id: "high", hostname: "high", tdp_watts: 100}
    - {id: "mid", hostname: "mid", tdp_watts: 50}
expected:
  body:
    servers:
      - server_id: "high"  # 100W first
      - server_id: "mid"   # 50W second
      - server_id: "low"   # 10W third
```

#### Assertions

- [ ] First server has highest cost
- [ ] Last server has lowest cost
- [ ] Order is strictly descending

---

### TC093: Servers without TDP have null costs

**Type:** API
**Priority:** High
**Story:** US0036 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server without TDP configured | No TDP |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then server has tdp_watts=null, costs=null | Null values |

#### Test Data

```yaml
setup:
  server:
    id: "no-tdp"
    hostname: "notdp"
    tdp_watts: null
expected:
  body:
    servers:
      - server_id: "no-tdp"
        tdp_watts: null
        daily_cost: null
        monthly_cost: null
```

#### Assertions

- [ ] tdp_watts is null
- [ ] daily_cost is null
- [ ] monthly_cost is null

---

### TC094: Servers without TDP appear last

**Type:** API
**Priority:** High
**Story:** US0036 (AC5)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given mix of servers with and without TDP | Mixed servers |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then servers without TDP appear after servers with TDP | Correct order |

#### Test Data

```yaml
setup:
  servers:
    - {id: "with-tdp-1", tdp_watts: 50}
    - {id: "no-tdp-1", tdp_watts: null}
    - {id: "with-tdp-2", tdp_watts: 100}
expected:
  body:
    servers:
      - server_id: "with-tdp-2"  # 100W first (highest)
      - server_id: "with-tdp-1"  # 50W second
      - server_id: "no-tdp-1"    # null last
```

#### Assertions

- [ ] Servers with TDP appear first (sorted by cost)
- [ ] Servers without TDP appear last

---

### TC095: Totals match summary endpoint

**Type:** API
**Priority:** High
**Story:** US0036 (AC6)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given servers with TDP configured | Servers exist |
| 2 | When GET breakdown and summary both called | Two requests |
| 3 | Then breakdown.totals matches summary values | Consistency |

#### Test Data

```yaml
setup:
  servers:
    - {id: "s1", tdp_watts: 65}
    - {id: "s2", tdp_watts: 80}
expected:
  breakdown.totals.daily_cost == summary.daily_cost
  breakdown.totals.monthly_cost == summary.monthly_cost
  breakdown.totals.total_tdp_watts == summary.total_tdp_watts
```

#### Assertions

- [ ] daily_cost matches
- [ ] monthly_cost matches
- [ ] total_tdp_watts matches
- [ ] servers_with_tdp matches servers_included

---

### TC096: No servers returns empty list

**Type:** API
**Priority:** Medium
**Story:** US0036 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no servers exist | Empty database |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then servers list is empty, totals are zero | Empty state |

#### Test Data

```yaml
expected:
  body:
    servers: []
    totals:
      servers_with_tdp: 0
      servers_without_tdp: 0
      total_tdp_watts: 0
      daily_cost: 0.0
      monthly_cost: 0.0
```

#### Assertions

- [ ] servers is empty list
- [ ] All totals are zero

---

### TC097: All servers missing TDP

**Type:** API
**Priority:** Medium
**Story:** US0036 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given 2 servers, none with TDP | No TDP configured |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then all servers have null costs, totals zero | Zero costs |

#### Test Data

```yaml
setup:
  servers:
    - {id: "s1", tdp_watts: null}
    - {id: "s2", tdp_watts: null}
expected:
  body:
    servers:
      - {server_id: "s1", daily_cost: null}
      - {server_id: "s2", daily_cost: null}
    totals:
      servers_with_tdp: 0
      servers_without_tdp: 2
      daily_cost: 0.0
```

#### Assertions

- [ ] Both servers have null costs
- [ ] servers_without_tdp is 2
- [ ] totals.daily_cost is 0.0

---

### TC098: Single server with TDP

**Type:** API
**Priority:** Medium
**Story:** US0036 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given single server with TDP | One server |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then total equals server cost | Single server totals |

#### Test Data

```yaml
setup:
  server:
    id: "single"
    tdp_watts: 65
expected:
  body:
    servers:
      - server_id: "single"
        daily_cost: 0.37
    totals:
      servers_with_tdp: 1
      daily_cost: 0.37
```

#### Assertions

- [ ] servers list has 1 item
- [ ] totals.daily_cost equals server daily_cost

---

### TC099: Rate zero returns zero costs

**Type:** API
**Priority:** Medium
**Story:** US0036 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP and rate = 0 | Free electricity |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then all costs are £0.00 | Zero costs |

#### Test Data

```yaml
setup:
  server:
    id: "free"
    tdp_watts: 100
  PUT /api/v1/config/cost:
    electricity_rate: 0
expected:
  body:
    servers:
      - server_id: "free"
        daily_cost: 0.0
        monthly_cost: 0.0
    totals:
      daily_cost: 0.0
```

#### Assertions

- [ ] Server daily_cost is 0.0
- [ ] totals.daily_cost is 0.0

---

### TC100: Very high TDP calculated correctly

**Type:** API
**Priority:** Medium
**Story:** US0036 (Edge Case)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given server with TDP = 1000W | Very high TDP |
| 2 | When GET /api/v1/costs/breakdown is called | API request |
| 3 | Then cost calculated correctly without overflow | Correct result |

#### Test Data

```yaml
setup:
  server:
    id: "high-tdp"
    tdp_watts: 1000
  rate: 0.24
expected:
  body:
    servers:
      - server_id: "high-tdp"
        daily_cost: 5.76  # (1000 × 24 × 0.24) / 1000
        monthly_cost: 172.8
```

#### Assertions

- [ ] daily_cost is 5.76
- [ ] monthly_cost is 172.8
- [ ] No overflow or error

---

### TC101: GET cost breakdown requires authentication

**Type:** API
**Priority:** High
**Story:** US0036 (Security)
**Automated:** No

#### Scenario

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Given no API key provided | Unauthenticated |
| 2 | When GET /api/v1/costs/breakdown | Request without auth |
| 3 | Then 401 Unauthorized returned | Auth required |

#### Test Data

```yaml
input:
  headers: {}  # No X-API-Key
expected:
  status_code: 401
```

#### Assertions

- [ ] Response status is 401

---

## Fixtures

```yaml
# Shared test data for this spec
cost_config:
  default_rate: 0.24
  default_currency: "£"

api_key: "test-api-key-12345"
```

## Automation Status

### US0034: Electricity Rate Configuration

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC063 | GET cost returns default rate on fresh install | Automated | `tests/test_cost_config.py` |
| TC064 | GET cost returns current rate | Automated | `tests/test_cost_config.py` |
| TC065 | PUT cost updates rate | Automated | `tests/test_cost_config.py` |
| TC066 | PUT cost updates currency symbol | Automated | `tests/test_cost_config.py` |
| TC067 | Rate persists across requests | Automated | `tests/test_cost_config.py` |
| TC068 | Rate = 0 is allowed | Automated | `tests/test_cost_config.py` |
| TC069 | Negative rate returns 422 | Automated | `tests/test_cost_config.py` |
| TC070 | Very high rate is allowed | Automated | `tests/test_cost_config.py` |
| TC071 | Empty currency symbol is allowed | Automated | `tests/test_cost_config.py` |
| TC072 | Multi-character currency allowed | Automated | `tests/test_cost_config.py` |
| TC073 | Rate with many decimals stored correctly | Automated | `tests/test_cost_config.py` |
| TC074 | Invalid type for rate returns 422 | Automated | `tests/test_cost_config.py` |
| TC075 | Partial update preserves existing values | Automated | `tests/test_cost_config.py` |
| TC076 | GET cost requires authentication | Automated | `tests/test_cost_config.py` |
| TC077 | PUT cost requires authentication | Automated | `tests/test_cost_config.py` |
| TC078 | Response includes updated_at timestamp | Automated | `tests/test_cost_config.py` |

### US0035: Dashboard Cost Summary Display

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC079 | GET cost summary returns zero with no servers | Automated | `tests/test_cost_summary.py` |
| TC080 | Cost calculation for single server | Automated | `tests/test_cost_summary.py` |
| TC081 | Cost calculation for multiple servers | Automated | `tests/test_cost_summary.py` |
| TC082 | Servers without TDP excluded from calculation | Automated | `tests/test_cost_summary.py` |
| TC083 | Returns configured currency symbol | Automated | `tests/test_cost_summary.py` |
| TC084 | Monthly cost equals daily × 30 | Automated | `tests/test_cost_summary.py` |
| TC085 | Rate = 0 returns zero cost | Automated | `tests/test_cost_summary.py` |
| TC086 | Fractional TDP handled correctly | Automated | `tests/test_cost_summary.py` |
| TC087 | GET cost summary requires authentication | Automated | `tests/test_cost_summary.py` |
| TC088 | Returns electricity_rate in response | Automated | `tests/test_cost_summary.py` |
| TC089 | All servers without TDP returns zero cost | Automated | `tests/test_cost_summary.py` |

### US0036: Cost Breakdown View

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC090 | GET cost breakdown returns 200 with correct structure | Automated | `tests/test_cost_breakdown.py` |
| TC091 | Per-server costs calculated correctly | Automated | `tests/test_cost_breakdown.py` |
| TC092 | Servers sorted by cost descending | Automated | `tests/test_cost_breakdown.py` |
| TC093 | Servers without TDP have null costs | Automated | `tests/test_cost_breakdown.py` |
| TC094 | Servers without TDP appear last | Automated | `tests/test_cost_breakdown.py` |
| TC095 | Totals match summary endpoint | Automated | `tests/test_cost_breakdown.py` |
| TC096 | No servers returns empty list | Automated | `tests/test_cost_breakdown.py` |
| TC097 | All servers missing TDP | Automated | `tests/test_cost_breakdown.py` |
| TC098 | Single server with TDP | Automated | `tests/test_cost_breakdown.py` |
| TC099 | Rate zero returns zero costs | Automated | `tests/test_cost_breakdown.py` |
| TC100 | Very high TDP calculated correctly | Automated | `tests/test_cost_breakdown.py` |
| TC101 | GET cost breakdown requires authentication | Automated | `tests/test_cost_breakdown.py` |

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| TRD | [sdlc-studio/trd.md](../trd.md) |
| Epic | [EP0005](../epics/EP0005-cost-tracking.md) |
| Strategy | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial spec generation for cost tracking tests |
| 2026-01-20 | Claude | All 16 test cases automated in tests/test_cost_config.py |
| 2026-01-20 | Claude | Added US0035 cost summary tests (TC079-TC089) |
| 2026-01-20 | Claude | All 11 US0035 tests automated in tests/test_cost_summary.py |
| 2026-01-20 | Claude | Added US0036 cost breakdown tests (TC090-TC101) |
| 2026-01-20 | Claude | All 12 US0036 tests automated in tests/test_cost_breakdown.py |
