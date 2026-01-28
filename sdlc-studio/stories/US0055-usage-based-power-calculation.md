# US0055: Usage-Based Power Calculation

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-20
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** power estimates based on actual CPU usage patterns
**So that** cost calculations reflect how hard servers are actually working, not just their maximum TDP

## Context

### Persona Reference

**Darren** - Knows some servers idle most of the time while others run heavy workloads. Wants costs to reflect actual usage patterns.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Current cost estimation uses TDP as constant power draw (TDP x 24h). In reality, servers consume much less at idle. A server with 100W TDP might idle at 40W and average 55W. By using the formula `Power = Idle + (Max - Idle) x CPU%`, estimates become more accurate.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Accuracy | Within 10% of actual | Usage-based calculation improves accuracy |
| Scope | No historical tracking | Use 24h rolling average |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Cost accuracy within 10% | Linear interpolation reasonable approximation |
| Data | Metrics already collected | CPU% available in metrics table |
| Architecture | SQLite storage | Query avg CPU from metrics |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Power calculation formula

- **Given** a server with idle_watts=40, max_watts=100, avg_cpu=30%
- **When** calculating estimated power
- **Then** result is 40 + (100-40) x 0.30 = 58W

### AC2: Average CPU from metrics

- **Given** a server with metrics over the last 24 hours
- **When** querying average CPU usage
- **Then** the mean cpu_percent from metrics table is returned

### AC3: Cost API returns estimated power

- **Given** a server with category and metrics
- **When** calling GET `/api/v1/costs/breakdown`
- **Then** response includes estimated_watts and avg_cpu_percent per server

### AC4: Cost summary uses estimated power

- **Given** servers with power configurations
- **When** calling GET `/api/v1/costs/summary`
- **Then** total_estimated_watts reflects usage-based calculation

### AC5: Fallback to TDP-only mode

- **Given** a server with tdp_watts set but no category
- **When** calculating costs
- **Then** legacy TDP x 24h calculation is used

### AC6: Handle missing metrics

- **Given** a server with no recent metrics (new or offline)
- **When** calculating estimated power
- **Then** use 50% CPU as default assumption

## Scope

### In Scope

- `calculate_power_watts(idle, max, cpu_percent)` function
- `get_avg_cpu_24h(session, server_id)` query function
- `get_power_config()` to resolve category defaults vs overrides
- Updated `/api/v1/costs/breakdown` response with new fields
- Updated `/api/v1/costs/summary` response with total_estimated_watts
- Backwards compatibility with TDP-only configuration

### Out of Scope

- Historical cost tracking
- Per-hour cost breakdown
- Cost forecasting
- Memory/disk usage in power calculation

## UI/UX Requirements

Cost Breakdown table shows estimated power (implementation in US0056):

```
| Server         | Category       | Avg CPU | Est. Power | Daily    |
|----------------|----------------|---------|------------|----------|
| omv-mediaserver| Office Desktop | 23%     | 53.8W      | £0.31    |
| pi-homebridge  | SBC (auto)     | 15%     | 2.6W       | £0.02    |
| workstation    | Workstation    | 8%      | 120.0W     | £0.69    |
```

## Technical Notes

### Power Calculation

**Formula:** `Power = Idle + (Max - Idle) x (CPU% / 100)`

**Examples:**
| Server | Category | Idle | Max | Avg CPU | Estimated |
|--------|----------|------|-----|---------|-----------|
| pi-homebridge | SBC | 2W | 6W | 15% | 2.6W |
| nuc-plex | Mini PC | 10W | 25W | 40% | 16W |
| omv-nas | Office Desktop | 40W | 100W | 23% | 53.8W |

### API Contracts

**GET /api/v1/costs/breakdown (updated response)**
```json
{
  "servers": [
    {
      "server_id": "omv-mediaserver",
      "hostname": "omv-mediaserver",
      "machine_category": "office_desktop",
      "machine_category_label": "Office Desktop",
      "machine_category_source": "auto",
      "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
      "idle_watts": 40,
      "tdp_watts": 100,
      "estimated_watts": 53.8,
      "avg_cpu_percent": 23.0,
      "daily_cost": 0.31,
      "monthly_cost": 9.30
    }
  ],
  "totals": {
    "servers_configured": 3,
    "servers_unconfigured": 1,
    "total_estimated_watts": 192.4,
    "daily_cost": 1.11,
    "monthly_cost": 33.30,
    "servers_with_tdp": 3,
    "servers_without_tdp": 1,
    "total_tdp_watts": 225
  },
  "settings": {
    "electricity_rate": 0.24,
    "currency_symbol": "£"
  }
}
```

**GET /api/v1/costs/summary (updated response)**
```json
{
  "daily_cost": 1.11,
  "monthly_cost": 33.30,
  "currency_symbol": "£",
  "servers_included": 3,
  "servers_missing_config": 1,
  "total_estimated_watts": 192.4,
  "electricity_rate": 0.24,
  "servers_missing_tdp": 1,
  "total_tdp_watts": 225
}
```

### Data Requirements

**Metrics query for average CPU:**
```sql
SELECT AVG(cpu_percent)
FROM metrics
WHERE server_id = ?
  AND timestamp >= datetime('now', '-24 hours')
  AND cpu_percent IS NOT NULL
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No metrics in last 24h | Assume 50% CPU, calculate accordingly |
| No category, only tdp_watts | Use tdp_watts x 24h (legacy mode) |
| No category, no tdp_watts | Server unconfigured, excluded from totals |
| Category set, custom idle_watts | Use custom idle with category max |
| Category set, custom tdp_watts | Use category idle with custom max |
| Both custom idle and tdp | Use both custom values |
| CPU% > 100 (unusual) | Clamp to 100% |
| CPU% < 0 (error) | Clamp to 0% |

## Test Scenarios

- [ ] Power calculation formula correct
- [ ] Average CPU query returns correct mean
- [ ] Average CPU handles empty metrics
- [ ] Cost breakdown includes estimated_watts
- [ ] Cost breakdown includes avg_cpu_percent
- [ ] Cost summary includes total_estimated_watts
- [ ] TDP-only server uses legacy calculation
- [ ] Unconfigured server excluded from totals
- [ ] Custom idle_watts overrides category default
- [ ] Custom tdp_watts overrides category max
- [ ] CPU% clamped to 0-100 range

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0055-01 | Power calculation formula | AC1 | Unit | Pending |
| TC-US0055-02 | Calculate power with different values | AC1 | Unit | Pending |
| TC-US0055-03 | Get average CPU from metrics | AC2 | Integration | Pending |
| TC-US0055-04 | Empty metrics returns None | AC2 | Integration | Pending |
| TC-US0055-05 | Cost breakdown response fields | AC3 | API | Pending |
| TC-US0055-06 | Cost summary total_estimated_watts | AC4 | API | Pending |
| TC-US0055-07 | TDP-only fallback calculation | AC5 | API | Pending |
| TC-US0055-08 | Missing metrics uses 50% default | AC6 | API | Pending |
| TC-US0055-09 | Custom idle_watts override | AC1 | Unit | Pending |
| TC-US0055-10 | CPU% clamping | AC1 | Unit | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 11/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0054: Machine Category Power Profiles | Story | Ready |
| US0003: Agent Heartbeat Endpoint | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - metrics aggregation and API changes

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial story creation for enhanced power estimation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
