# US0056: Power Configuration UI

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-20
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to view and configure machine categories and power settings in the UI
**So that** I can override auto-detection when needed and see accurate cost breakdowns

## Context

### Persona Reference

**Darren** - Wants to verify auto-detection is correct and override when needed. Wants to see estimated power in cost views.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With machine categories and usage-based power calculation implemented in the backend, the frontend needs updates to display this information and allow user overrides. This includes a refactored power configuration modal, updated cost breakdown table, and enhanced server detail view.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| UX | Easy configuration | Category dropdown with auto-detected indicator |
| Design | Brand guide compliance | Use phosphor colour palette |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Cost accuracy within 10% | Show estimated power, not just TDP |
| UX | Cost awareness goal | Clear daily/monthly estimates with breakdown |
| Design | Brand guide compliance | Modal styling per brand-guide.md |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Cost breakdown shows new columns

- **Given** the Costs page
- **When** viewing the server table
- **Then** columns include: Server, Category, Avg CPU%, Est. Power, Daily, Monthly

### AC2: Category badge shows source

- **Given** a server with auto-detected category
- **When** viewing the category column
- **Then** badge shows "Mini PC (auto)" or "Workstation (user)"

### AC3: Power configuration modal

- **Given** clicking "Edit" on a server in the costs table
- **When** the modal opens
- **Then** it shows: category dropdown, idle watts input, max watts input, detected CPU model

### AC4: Category dropdown options

- **Given** the power configuration modal
- **When** opening the category dropdown
- **Then** all 9 categories are available with labels

### AC5: Override saves with source="user"

- **Given** changing the category in the modal
- **When** clicking Save
- **Then** the server's machine_category_source becomes "user"

### AC6: Server detail shows CPU and category

- **Given** viewing server detail for "omv-mediaserver"
- **When** the System card loads
- **Then** it displays: CPU model, core count, machine category

### AC7: Unconfigured servers section

- **Given** servers without power configuration
- **When** viewing the Costs page
- **Then** they appear in an "Unconfigured Servers" section with "Configure" buttons

### AC8: ServerUpdate schema includes power fields

- **Given** the backend API schema for server updates
- **When** updating a server's power configuration via PUT /api/v1/servers/{server_id}
- **Then** the `ServerUpdate` schema explicitly includes: `machine_category`, `machine_category_source`, `idle_watts`

> **Note:** Added during epic review - schema was missing these fields for API contract clarity.

## Scope

### In Scope

- Update `frontend/src/types/cost.ts` with MachineCategory type
- Refactor `TdpEditModal` → `PowerEditModal` with category dropdown
- Update `CostsPage.tsx` with new table columns
- Update `ServerDetail.tsx` to show CPU info and category
- Category source badge component ("auto" / "user")
- API types update for new response fields

### Out of Scope

- Bulk category assignment
- Category presets per hostname pattern
- Power consumption graphs
- Historical cost tracking UI

## UI/UX Requirements

### Cost Breakdown Table (Updated)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Electricity Costs                                          [Configure Rate]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Rate: £0.24/kWh    Total Est. Power: 192W    Est. Daily: £1.11              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Server          │ Category          │ Avg CPU │ Est. Power │ Daily │ Monthly│
│─────────────────┼───────────────────┼─────────┼────────────┼───────┼────────│
│ omv-mediaserver │ Office Desktop ⚙  │ 23%     │ 53.8W      │ £0.31 │ £9.30  │
│ pi-homebridge   │ SBC (auto)        │ 15%     │ 2.6W       │ £0.02 │ £0.45  │
│ workstation     │ Workstation ⚙     │ 8%      │ 120.0W     │ £0.69 │ £20.70 │
│─────────────────┴───────────────────┴─────────┴────────────┴───────┴────────│
│                                      Total:   │ 176.4W     │ £1.02 │ £30.45 │
└──────────────────────────────────────────────────────────────────────────────┘

⚙ = user-configured    (auto) = auto-detected
```

### Power Configuration Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Power Configuration: omv-mediaserver                    [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Detected CPU: Intel(R) Core(TM) i5-8250U (4 cores)        │
│                                                             │
│  Machine Category:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Office Desktop (auto-detected)                   ▼  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Power Settings:                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Idle: [__40_] W      │  │ Max:  [_100_] W      │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  (Category defaults: 40W idle, 100W max)                    │
│                                                             │
│  Avg CPU (24h): 23%                                         │
│  Estimated Power: 53.8W                                     │
│                                                             │
│                                    [Cancel]  [Save Changes] │
└─────────────────────────────────────────────────────────────┘
```

### Category Dropdown Options

```
▼ Select Category
  ────────────────────────
  Single Board Computer (2-6W)
  Mini PC (10-25W)
  NAS/Home Server (15-35W)
  Office Desktop (40-100W)
  Gaming Desktop (75-300W)
  Workstation (100-350W)
  Office Laptop (10-30W)
  Gaming Laptop (30-100W)
  Rack Server (100-300W)
```

### Server Detail - System Card (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│ System Information                                          │
├─────────────────────────────────────────────────────────────┤
│ OS:           Debian GNU/Linux 12                           │
│ Kernel:       6.1.0-18-amd64                                │
│ Architecture: x86_64                                        │
│ CPU:          Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz     │
│ Cores:        4                                             │
│ Category:     Office Desktop (auto)  [Change]               │
│ TDP:          100W (from category)                          │
│ Est. Cost:    £0.31/day                                     │
└─────────────────────────────────────────────────────────────┘
```

### Brand Guide Reference

See [brand-guide.md](../brand-guide.md) for styling specifications.

## Technical Notes

### TypeScript Types

```typescript
// frontend/src/types/cost.ts

export type MachineCategory =
  | 'sbc'
  | 'mini_pc'
  | 'nas'
  | 'office_desktop'
  | 'gaming_desktop'
  | 'workstation'
  | 'office_laptop'
  | 'gaming_laptop'
  | 'rack_server';

export interface MachineCategoryOption {
  value: MachineCategory;
  label: string;
  idleWatts: number;
  maxWatts: number;
}

export const MACHINE_CATEGORIES: MachineCategoryOption[] = [
  { value: 'sbc', label: 'Single Board Computer', idleWatts: 2, maxWatts: 6 },
  { value: 'mini_pc', label: 'Mini PC', idleWatts: 10, maxWatts: 25 },
  // ... etc
];
```

### API Contracts

**PUT /api/v1/servers/{server_id} (extended)**
```json
Request:
{
  "machine_category": "office_desktop",
  "idle_watts": 45,
  "tdp_watts": 100
}

Response 200:
{
  "id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "machine_category": "office_desktop",
  "machine_category_source": "user",
  "idle_watts": 45,
  "tdp_watts": 100,
  ...
}
```

### Data Requirements

**ServerCostItem type extension:**
- `machine_category: string | null`
- `machine_category_label: string | null`
- `machine_category_source: 'auto' | 'user' | null`
- `cpu_model: string | null`
- `idle_watts: number | null`
- `estimated_watts: number | null`
- `avg_cpu_percent: number | null`

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No category, no TDP | Show "Not configured" with Configure button |
| Category but no metrics | Show estimated power based on 50% CPU |
| Very long CPU model | Truncate with ellipsis in UI |
| User clears category | Reset to auto-detection on next heartbeat |
| Save with invalid watts | Show validation error (min 0, max 2000) |
| Offline server | Show last known values, grey out |
| Zero servers configured | Show helpful empty state message |
| Category dropdown with auto-detected | Show "(auto-detected)" suffix on current |

## Test Scenarios

- [ ] Cost table shows Category column
- [ ] Cost table shows Avg CPU% column
- [ ] Cost table shows Est. Power column
- [ ] Category badge shows source (auto/user)
- [ ] Power modal opens from table
- [ ] Power modal shows CPU model
- [ ] Category dropdown has all options
- [ ] Saving category sets source to "user"
- [ ] Saving idle/max watts persists
- [ ] Server detail shows CPU info
- [ ] Server detail shows category
- [ ] Unconfigured section shows correctly

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0056-01 | Cost table columns rendered | AC1 | E2E | Pending |
| TC-US0056-02 | Category source badge | AC2 | E2E | Pending |
| TC-US0056-03 | Power modal opens | AC3 | E2E | Pending |
| TC-US0056-04 | Modal shows CPU info | AC3 | E2E | Pending |
| TC-US0056-05 | Category dropdown options | AC4 | E2E | Pending |
| TC-US0056-06 | Save sets source to user | AC5 | E2E | Pending |
| TC-US0056-07 | Server detail CPU display | AC6 | E2E | Pending |
| TC-US0056-08 | Server detail category display | AC6 | E2E | Pending |
| TC-US0056-09 | Unconfigured servers section | AC7 | E2E | Pending |
| TC-US0056-10 | Validation on invalid watts | AC3 | E2E | Pending |
| TC-US0056-11 | ServerUpdate schema has power fields | AC8 | Unit | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 8/8 minimum documented
- [x] Test scenarios: 12/10 minimum listed
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
| US0055: Usage-Based Power Calculation | Story | Ready |
| US0036: Cost Breakdown View | Story | Done |
| US0006: Server Detail View | Story | Done |

## Estimation

**Story Points:** 3

**Complexity:** Medium - multiple UI components and API integration

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial story creation for enhanced power estimation |
| 2026-01-21 | Claude | Reopened: Added AC8 for ServerUpdate schema completeness (missing power fields) |
| 2026-01-21 | Claude | AC8 implemented: Added machine_category, machine_category_source, idle_watts to ServerUpdate schema |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
