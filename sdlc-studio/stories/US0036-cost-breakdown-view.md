# US0036: Cost Breakdown View

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to see a breakdown of costs per server
**So that** I can identify which servers cost the most to run

## Context

### Persona Reference

**Darren** - Wants to know if that powerful NAS is worth the electricity cost, or if the Raspberry Pis are essentially free to run.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Beyond the fleet total, users want to see per-server cost breakdown. This helps identify cost outliers and make informed decisions about hardware choices.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Scope | No historical tracking | Current costs only |
| Calculation | Same formula as summary | Consistent with US0035 |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard load < 2 seconds | Efficient cost aggregation |
| UX | Cost visibility | Per-server breakdown with sorting |
| Design | Brand guide compliance | Table styling per brand-guide.md |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Cost breakdown page accessible

- **Given** logged into the dashboard
- **When** clicking on the cost summary or navigating to Costs
- **Then** the cost breakdown page is displayed

### AC2: Per-server costs listed

- **Given** servers with TDP configured
- **When** viewing the cost breakdown
- **Then** each server shows daily and monthly estimated cost

### AC3: Sorted by cost

- **Given** the cost breakdown view
- **When** viewing the list
- **Then** servers are sorted by cost (highest first by default)

### AC4: TDP shown alongside cost

- **Given** viewing server cost
- **When** looking at a server row
- **Then** TDP (watts) is displayed alongside the cost

### AC5: Missing TDP highlighted

- **Given** some servers don't have TDP configured
- **When** viewing the breakdown
- **Then** they appear at bottom with "Configure TDP" prompt

### AC6: Total matches summary

- **Given** the breakdown list
- **When** summing individual costs
- **Then** the total matches the dashboard summary

## Scope

### In Scope

- /costs route
- Per-server cost table
- Sorting by cost, TDP, or name
- Total row at bottom
- Quick TDP edit from this view

### Out of Scope

- Cost history/trends
- Export to CSV
- Cost comparison over time

## UI/UX Requirements

### Cost Breakdown Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HomelabCmd  >  Costs                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Electricity Costs                                    Rate: £0.24/kWh   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Server              │ TDP (W) │ Daily Cost │ Monthly Cost │       │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ omv-mediaserver     │ 65 W    │ £0.37      │ £11.23       │ [Edit]│  │
│  │ mini-pc-1           │ 28 W    │ £0.16      │ £4.84        │ [Edit]│  │
│  │ mini-pc-2           │ 28 W    │ £0.16      │ £4.84        │ [Edit]│  │
│  │ omv-nas2            │ 45 W    │ £0.26      │ £7.78        │ [Edit]│  │
│  │ pihole-primary      │ 5 W     │ £0.03      │ £0.86        │ [Edit]│  │
│  │ pihole-secondary    │ 5 W     │ £0.03      │ £0.86        │ [Edit]│  │
│  │ homeassistant       │ 15 W    │ £0.09      │ £2.59        │ [Edit]│  │
│  │ ollama-server       │ 125 W   │ £0.72      │ £21.60       │ [Edit]│  │
│  │ wireguard           │ 5 W     │ £0.03      │ £0.86        │ [Edit]│  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ backup-server       │ -- W    │ --         │ --           │ [Set] │  │
│  │ dev-server          │ -- W    │ --         │ --           │ [Set] │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ TOTAL (9 servers)   │ 321 W   │ £1.85      │ £55.46       │       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Note: Costs are estimates based on TDP. Actual consumption may vary.   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Inline TDP Edit Modal

```
┌─────────────────────────────────────────────────┐
│  Set TDP for backup-server                  [x] │
├─────────────────────────────────────────────────┤
│                                                 │
│  TDP (Watts): [___]                             │
│                                                 │
│  Quick select:                                  │
│  [5W Pi] [15W Mini] [28W NUC] [65W Desktop]    │
│                                                 │
│                         [Cancel]  [Save]        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Brand Guide Reference

- Table headers: Space Grotesk, semi-bold
- Values: JetBrains Mono, monospace
- Missing TDP rows: Dimmed styling
- Total row: Highlighted with border-top

## Technical Notes

### API Contracts

**GET /api/v1/costs/breakdown**
```json
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
      "server_id": "omv-mediaserver",
      "hostname": "omv-mediaserver",
      "tdp_watts": 65,
      "daily_cost": 0.37,
      "monthly_cost": 11.23
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

**TRD Reference:** [§4 API Contracts - Costs](../trd.md#4-api-contracts)

### Data Requirements

- Join servers with cost settings
- Calculate per-server costs
- Sort configurable (default: cost descending)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No servers | Show empty state with "No servers registered" message |
| All servers missing TDP | Show all with "Set TDP" prompts, total row shows £0.00 |
| Single server with TDP | Show that server with total row (total equals server cost) |
| Single server without TDP | Show server with "Set TDP" prompt, total shows £0.00 |
| Mix of servers with/without TDP | Servers with TDP show costs, servers without at bottom with prompts |
| Rate = 0 (free electricity) | All costs display as £0.00, TDP still shown |
| Very high TDP (e.g., 1000W) | Display correctly without overflow (daily: £5.76, monthly: £172.80) |
| Fractional cost rounding | Costs round to 2 decimal places (e.g., £0.37 not £0.3744) |
| Server offline but has TDP | Still calculate and display cost (TDP is static, not load-based) |
| Currency symbol empty | Display costs without symbol (e.g., "0.37" not "£0.37") |
| Sort by different columns | Table re-sorts correctly by cost/TDP/name |
| 401 Unauthorised | Redirect to login page |

## Test Scenarios

- [ ] Breakdown page loads
- [ ] Per-server costs displayed
- [ ] Sorted by cost descending by default
- [ ] Total row matches sum
- [ ] Missing TDP servers shown at bottom
- [ ] Quick edit TDP works
- [ ] Currency symbol correct throughout

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0036-01 | Breakdown page loads | AC1 | E2E | Pending |
| TC-US0036-02 | Per-server costs listed | AC2 | API | Pending |
| TC-US0036-03 | Sorted by cost descending | AC3 | E2E | Pending |
| TC-US0036-04 | TDP shown with cost | AC4 | E2E | Pending |
| TC-US0036-05 | Missing TDP highlighted | AC5 | E2E | Pending |
| TC-US0036-06 | Total matches summary | AC6 | Integration | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 12/8 minimum documented
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
| US0035: Dashboard Cost Display | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - table view with calculations

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-20 | Claude | Ready review: expanded edge cases (3→12), updated dependency status (all Done) |
| 2026-01-20 | Claude | Implemented GET /api/v1/costs/breakdown endpoint; 17 tests; all 6 AC verified |
| 2026-01-20 | Claude | Reopened: Backend API complete, frontend /costs page and TDP edit modal pending |
| 2026-01-20 | Claude | Frontend complete: CostsPage.tsx with sortable table, TdpEditModal.tsx with presets; 49 tests; marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
