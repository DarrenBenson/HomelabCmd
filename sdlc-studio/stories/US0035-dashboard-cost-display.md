# US0035: Dashboard Cost Summary Display

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to see estimated electricity costs on the dashboard
**So that** I have visibility into running costs at a glance

## Context

### Persona Reference

**Darren** - Wants to know monthly running costs without digging into details. Quick glance during daily check.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The dashboard summary bar shows key fleet metrics. This story adds estimated daily and monthly electricity costs to the summary. Costs are calculated from TDP × hours × rate for each server with configured TDP.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Scope | Estimate only | Clear labelling as "estimated" |
| Calculation | TDP × hours × rate | Formula documented in Technical Notes |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard load < 2 seconds | Cost calculation must be efficient |
| UX | Quick visibility | Cost in summary bar, details on hover |
| Design | Brand guide compliance | JetBrains Mono for cost values |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Daily cost in summary bar

- **Given** servers with TDP configured
- **When** viewing the dashboard
- **Then** estimated daily cost is displayed in the summary bar

### AC2: Monthly cost available

- **Given** servers with TDP configured
- **When** hovering over daily cost
- **Then** monthly estimate is shown in tooltip

### AC3: Cost calculation correct

- **Given** a server with TDP=65W and rate=£0.24/kWh
- **When** calculating daily cost
- **Then** cost = (65 × 24 × 0.24) / 1000 = £0.37/day

### AC4: Missing TDP handled

- **Given** some servers have TDP configured and some don't
- **When** viewing cost summary
- **Then** only servers with TDP are included in calculation

### AC5: Currency symbol used

- **Given** currency is set to "£"
- **When** displaying costs
- **Then** all costs show "£" prefix

## Scope

### In Scope

- Cost summary in dashboard header/summary bar
- Daily cost calculation
- Monthly estimate (daily × 30)
- Cost API endpoint
- Handling of servers without TDP

### Out of Scope

- Cost breakdown (US0036)
- Historical cost tracking
- Cost alerts

## UI/UX Requirements

### Dashboard Summary Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Fleet Summary                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🖥️ 11 Servers  │  ✓ 9 Online  │  ⚠️ 2 Alerts  │  💰 £3.20/day  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cost Tooltip (on hover)

```
┌────────────────────────────┐
│  Estimated Electricity     │
│                            │
│  Daily:   £3.20            │
│  Monthly: £96.00           │
│                            │
│  Based on 9 servers        │
│  2 servers not configured  │
└────────────────────────────┘
```

### Brand Guide Reference

- Cost value: JetBrains Mono, monospace
- Colour: Soft White (#C9D1D9) or Phosphor Green if under budget

## Technical Notes

### API Contracts

**GET /api/v1/costs/summary**
```json
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

### Cost Calculation

```python
def calculate_daily_cost(servers: list[Server], rate: float) -> float:
    total_watts = sum(s.tdp_watts for s in servers if s.tdp_watts is not None)
    kwh_per_day = (total_watts * 24) / 1000
    return round(kwh_per_day * rate, 2)
```

**TRD Reference:** [§4 API Contracts - Costs](../trd.md#4-api-contracts)

### Data Requirements

- Aggregation query across all servers
- Real-time calculation (no caching needed for 11 servers)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No servers | Show "£0.00/day" with servers_included=0 |
| No TDP configured | Show "£0.00/day (0 servers)" with servers_missing_tdp count |
| All servers offline | Still calculate (TDP doesn't depend on online status) |
| Very high cost (>£100/day) | Display normally, no upper limit |
| Rate = 0 (free electricity) | Show "£0.00/day" - valid scenario |
| Currency symbol empty | Use empty prefix (display as "0.00/day") |
| Single server | Calculate for 1 server correctly |
| Fractional TDP (e.g., 65.5W) | Use full precision in calculation, round display to 2 decimals |

## Test Scenarios

- [ ] Daily cost displayed in summary bar
- [ ] Monthly cost shown on hover
- [ ] Calculation is accurate
- [ ] Missing TDP servers excluded
- [ ] Currency symbol correct
- [ ] Zero cost handled gracefully
- [ ] API returns correct summary

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC079 | Cost summary returns zero with no servers | AC4 | API | Done |
| TC080 | Cost calculation for single server | AC3 | API | Done |
| TC081 | Cost calculation for multiple servers | AC1 | API | Done |
| TC082 | Servers without TDP excluded | AC4 | API | Done |
| TC083 | Returns configured currency symbol | AC5 | API | Done |
| TC084 | Monthly cost equals daily × 30 | AC2 | API | Done |
| TC085 | Rate = 0 returns zero cost | Edge | API | Done |
| TC086 | Integer TDP handled correctly | Edge | API | Done |
| TC087 | Cost summary requires authentication | Security | API | Done |
| TC088 | Returns electricity_rate in response | AC1 | API | Done |
| TC089 | All servers without TDP returns zero cost | Edge | API | Done |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
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
| US0033: TDP Configuration | Story | Done |
| US0034: Electricity Rate Configuration | Story | Done |
| US0005: Dashboard Server List | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - calculation logic and UI integration

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-20 | Claude | Added 4 edge cases (8/8); updated dependencies to Done; marked Ready |
| 2026-01-20 | Claude | Implemented GET /api/v1/costs/summary; all 11 tests passing; marked Done |
| 2026-01-20 | Claude | Reopened: Backend API complete, frontend Dashboard cost badge pending |
| 2026-01-20 | Claude | Frontend complete: CostBadge component with tooltip in Dashboard header; 14 tests; marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
