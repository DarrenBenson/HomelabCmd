# US0054: Machine Category Power Profiles

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-20
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** the system to auto-detect machine categories from CPU information
**So that** appropriate idle/max power profiles are applied for accurate cost estimation

## Context

### Persona Reference

**Darren** - Has diverse hardware (Raspberry Pis, mini PCs, workstations). Wants accurate estimates without researching power specs for each.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Different machine types have vastly different power profiles. A Raspberry Pi idles at 2W while a workstation idles at 100W. By categorising machines based on CPU model and architecture, the system can apply realistic idle/max power values instead of using a single TDP value as if it were constant.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Scope | Estimates only | Categories based on common hardware specs |
| Accuracy | Within 10% of actual | Use conservative estimates per category |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Cost accuracy within 10% | Power profiles based on real-world measurements |
| UX | Easy configuration | Auto-detection with manual override |
| Architecture | SQLite storage | Category stored in Server table |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Machine category enum defined

- **Given** the power service module
- **When** defining machine categories
- **Then** the following categories are available: `sbc`, `mini_pc`, `nas`, `office_desktop`, `gaming_desktop`, `workstation`, `office_laptop`, `gaming_laptop`, `rack_server`

### AC2: Power profiles defined

- **Given** each machine category
- **When** looking up power profile
- **Then** idle_watts and max_watts values are defined per the specification

### AC3: Category inference from CPU model

- **Given** a CPU model string and architecture
- **When** calling `infer_category_from_cpu()`
- **Then** the appropriate category is returned based on pattern matching

### AC4: Auto-detection on heartbeat

- **Given** a server with cpu_info in heartbeat
- **When** processing the heartbeat
- **Then** machine_category is auto-detected and stored with source="auto"

### AC5: User category preserved

- **Given** a server with machine_category_source="user"
- **When** receiving a heartbeat with new cpu_info
- **Then** the user's category is NOT overwritten by auto-detection

### AC6: Category stored in database

- **Given** a machine category detection
- **When** storing the result
- **Then** server record has machine_category, machine_category_source, and idle_watts fields

## Scope

### In Scope

- MachineCategory enum with 9 categories
- POWER_PROFILES dict with idle/max watts per category
- `infer_category_from_cpu()` pattern matching function
- Detection patterns for: ARM SBCs, Xeon/EPYC servers, mobile CPUs, mini PC CPUs, desktop tiers
- Database columns: machine_category, machine_category_source, idle_watts
- Migration for new columns
- Auto-detection triggered by heartbeat

### Out of Scope

- GPU power estimation
- External drive power estimation
- Network equipment power
- UPS efficiency factors

## UI/UX Requirements

Category display in Server Detail (implementation in US0056):

```
Power Configuration
  Category: Mini PC (auto-detected) [Change]
  Idle: 10W | Max: 25W
  Avg CPU: 23% | Est. Power: 13.5W
```

## Technical Notes

### Machine Categories and Power Profiles

| Category | Label | Idle (W) | Max (W) | Detection Hints |
|----------|-------|----------|---------|-----------------|
| `sbc` | Single Board Computer | 2 | 6 | ARM arch, "Raspberry", "BCM" |
| `mini_pc` | Mini PC | 10 | 25 | Atom, Celeron, Pentium, N100 |
| `nas` | NAS/Home Server | 15 | 35 | (manual selection) |
| `office_desktop` | Office Desktop | 40 | 100 | Core i3/i5, Ryzen 3/5 |
| `gaming_desktop` | Gaming Desktop | 75 | 300 | (manual selection) |
| `workstation` | Workstation | 100 | 350 | Core i7/i9, Ryzen 7/9, Threadripper |
| `office_laptop` | Office Laptop | 10 | 30 | Mobile CPUs: Intel U/P series, AMD Mobile/U |
| `gaming_laptop` | Gaming Laptop | 30 | 100 | (manual selection) |
| `rack_server` | Rack Server | 100 | 300 | Xeon, EPYC |

### CPU Pattern Matching Priority

1. **Architecture check:** ARM → SBC
2. **Server CPUs:** Xeon, EPYC → Rack Server
3. **Workstation CPUs:** Threadripper, i7/i9, Ryzen 7/9 → Workstation
4. **Mobile CPUs:** U/P suffix, "Mobile" → Office Laptop
5. **Low-power CPUs:** Atom, Celeron, Pentium, N-series → Mini PC
6. **Desktop CPUs:** i3/i5, Ryzen 3/5 → Office Desktop
7. **Fallback:** Unknown → None (requires manual config)

### API Contracts

**Server Response (extended)**
```json
{
  "id": "omv-mediaserver",
  "hostname": "omv-mediaserver",
  "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
  "cpu_cores": 4,
  "machine_category": "office_laptop",
  "machine_category_source": "auto",
  "idle_watts": null,
  "tdp_watts": null
}
```

### Data Requirements

**New Server columns:**
- `machine_category`: VARCHAR(50), nullable
- `machine_category_source`: VARCHAR(10), nullable ("auto" | "user")
- `idle_watts`: INTEGER, nullable (user override)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Unknown CPU model | Return None; server requires manual category |
| No cpu_model in heartbeat | Skip auto-detection; preserve existing category |
| User-set category | Never overwrite; machine_category_source="user" protects |
| CPU matches multiple patterns | First match wins (priority order above) |
| Very long CPU model | Truncate patterns still match substrings |
| Mixed architecture (e.g., M1 Mac) | "m1"/"m2" patterns → Office Laptop |
| Old agent without cpu_info | Skip detection; backwards compatible |
| Category set, idle_watts null | Use category default |

## Test Scenarios

- [ ] MachineCategory enum has all 9 values
- [ ] POWER_PROFILES has entry for each category
- [ ] ARM architecture detected as SBC
- [ ] Xeon detected as Rack Server
- [ ] EPYC detected as Rack Server
- [ ] Core i5-8250U detected as Office Laptop (mobile U-series)
- [ ] Core i5-12400 detected as Office Desktop
- [ ] Core i9-13900K detected as Workstation
- [ ] N100 detected as Mini PC
- [ ] Celeron detected as Mini PC
- [ ] User category not overwritten by auto-detection
- [ ] Unknown CPU returns None

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0054-01 | All category enum values defined | AC1 | Unit | Pending |
| TC-US0054-02 | Power profiles complete | AC2 | Unit | Pending |
| TC-US0054-03 | ARM SBC detection | AC3 | Unit | Pending |
| TC-US0054-04 | Server CPU detection | AC3 | Unit | Pending |
| TC-US0054-05 | Mobile CPU detection | AC3 | Unit | Pending |
| TC-US0054-06 | Mini PC CPU detection | AC3 | Unit | Pending |
| TC-US0054-07 | Desktop tier detection | AC3 | Unit | Pending |
| TC-US0054-08 | Auto-detection on heartbeat | AC4 | Integration | Pending |
| TC-US0054-09 | User category preserved | AC5 | Integration | Pending |
| TC-US0054-10 | Database columns populated | AC6 | Integration | Pending |

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
| US0053: Agent CPU Details Collection | Story | Ready |

## Estimation

**Story Points:** 3

**Complexity:** Medium - pattern matching logic and schema changes

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial story creation for enhanced power estimation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
