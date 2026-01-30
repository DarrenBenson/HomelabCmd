# EP0005: Cost Tracking

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 5
> **Story Points:** 21

## Summary

Calculate and display estimated electricity costs for running the homelab based on configured TDP (Thermal Design Power) values and electricity rates. Provides per-server and fleet-wide cost visibility.

## Inherited Constraints

Constraints that flow from PRD and TRD to this Epic.

### From PRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Performance | Cost accuracy within 10% of actual | Document TDP as estimate; recommend smart plug validation |
| Design | Brand guide compliance | Cost displays use phosphor colour palette |
| UX | Cost awareness goal | Clear daily/monthly estimates; per-server breakdown |

### From TRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Architecture | Monolith deployment | Cost service integrated into main FastAPI app |
| Tech Stack | Python/FastAPI | Cost calculation as service module |
| Data Model | SQLite storage | TDP in Server entity; rate in Config table |
| Data Model | Server entity has TDP field | Extend existing schema |

> **Note:** Inherited constraints MUST propagate to child Stories. Check Story templates include these constraints.

## Business Context

### Problem Statement

There's currently no visibility into how much the homelab costs to run. With 11 servers running 24/7, electricity costs are significant but unknown. This makes it difficult to justify expenses or make informed decisions about adding/removing servers.

**PRD Reference:** [§3 Feature Inventory - Cost Tracking](../prd.md#5-feature-inventory)

### Value Proposition

Clear visibility into running costs enables informed decisions about homelab investments. Monthly cost estimate helps with budgeting. Per-server breakdown identifies cost outliers.

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Cost visibility | None | Daily/Monthly estimates | Dashboard display |
| Cost accuracy | Unknown | Within 10% of actual | Compare to electricity bill |
| Per-server cost awareness | None | All servers | Dashboard breakdown |

## Scope

### In Scope

- TDP (watts) configuration per server
- Electricity rate configuration (£/kWh, configurable currency)
- Cost calculation: (TDP × hours × rate)
- Per-server daily/monthly cost estimate
- Fleet total daily/monthly cost estimate
- Cost display on dashboard summary bar
- Cost breakdown view
- Cost configuration UI
- **Enhanced Power Estimation (Phase 2):**
  - Agent CPU model and core count collection
  - Machine category auto-detection (SBC, mini PC, workstation, etc.)
  - Usage-based power calculation: Power = Idle + (Max - Idle) × CPU%
  - Power profile defaults per machine category
  - User override of category and wattage values

### Out of Scope

- Actual power measurement (would require smart plugs)
- Time-of-use electricity rates
- Historical cost tracking
- Cost alerts (e.g., "spending more than usual")
- Multi-currency support (single currency config)
- GPU power estimation
- External drive power estimation

### Affected User Personas

- **Darren (Homelab Operator):** Wants to understand running costs

## Acceptance Criteria (Epic Level)

- [x] Can configure TDP (watts) for each server
- [x] Can configure electricity rate (default £0.24/kWh)
- [x] Dashboard shows fleet daily cost estimate
- [x] Server detail shows per-server cost estimate
- [x] Cost breakdown view shows all servers ranked by cost
- [x] Costs update when TDP or rate changes
- [x] Initial server inventory has pre-populated TDP values

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| EP0001: Core Monitoring | Epic | Done | Darren | Server registration with TDP field |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | Standalone feature |

## Risks & Assumptions

### Assumptions

- TDP is a reasonable proxy for actual power consumption
- Servers run 24/7 (no power state tracking)
- Single electricity rate applies to all usage
- User knows approximate TDP for their hardware

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TDP estimates inaccurate | High | Low | Document as estimates; encourage smart plug validation |
| Electricity rates vary | Medium | Low | Make rate easily configurable |
| Users confused by estimates | Low | Low | Clear labeling as "estimated" |

## Technical Considerations

### Architecture Impact

- TDP field already in Server entity
- Config entity for electricity rate
- Cost calculation service (simple math)
- Cost API endpoints

### Integration Points

- Server registration → TDP configuration
- Dashboard → Cost summary API
- Settings → Rate configuration

### Data Considerations

- TDP stored per server (already in schema)
- Electricity rate in Config table
- Calculations done on-the-fly (no historical tracking)

**TRD Reference:** [§4 API Contracts - Costs](../trd.md#4-api-contracts)

## Sizing & Effort

**Story Count:** 8 stories, 21 story points

**Complexity Factors:**

- Relatively simple feature
- Mostly UI and configuration
- No complex business logic

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Budget awareness |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

### Phase 1: Basic Cost Tracking (Complete)

| ID | Title | Status | Points |
|----|-------|--------|--------|
| [US0033](../stories/US0033-tdp-configuration.md) | TDP Configuration per Server | Done | 2 |
| [US0034](../stories/US0034-electricity-rate-configuration.md) | Electricity Rate Configuration | Done | 2 |
| [US0035](../stories/US0035-dashboard-cost-display.md) | Dashboard Cost Summary Display | Done | 3 |
| [US0036](../stories/US0036-cost-breakdown-view.md) | Cost Breakdown View | Done | 3 |

### Phase 2: Enhanced Power Estimation

| ID | Title | Status | Points |
|----|-------|--------|--------|
| [US0053](../stories/US0053-agent-cpu-details.md) | Agent CPU Details Collection | Done | 2 |
| [US0054](../stories/US0054-machine-category-profiles.md) | Machine Category Power Profiles | Done | 3 |
| [US0055](../stories/US0055-usage-based-power-calculation.md) | Usage-Based Power Calculation | Done | 3 |
| [US0056](../stories/US0056-power-configuration-ui.md) | Power Configuration UI | Done | 3 |

**Phase 1 & 2 Total:** 8 stories, 21 story points (8 Done)

### Phase 3: Historical Cost Tracking

| ID | Title | Status | Points |
|----|-------|--------|--------|
| [US0183](../stories/US0183-historical-cost-tracking.md) | Historical Cost Tracking | Draft | 8 |

**Phase 3 Total:** 1 story, 8 story points (Draft)

### Story Dependency Graph

```
Phase 1:
US0033 (TDP Config)
  └─► US0035 (Dashboard Cost)
        └─► US0036 (Cost Breakdown)
US0034 (Electricity Rate)
  └─► US0035 (Dashboard Cost)

Phase 2:
US0053 (Agent CPU Details)
  └─► US0054 (Machine Category Profiles)
        └─► US0055 (Usage-Based Power Calculation)
              └─► US0056 (Power Configuration UI)
```

### Implementation Order

**Phase 1 (Complete):**
1. **US0033** - TDP Configuration per Server
2. **US0034** - Electricity Rate Configuration
3. **US0035** - Dashboard Cost Summary Display
4. **US0036** - Cost Breakdown View

**Phase 2 (Complete):**
5. **US0053** - Agent CPU Details Collection
6. **US0054** - Machine Category Power Profiles
7. **US0055** - Usage-Based Power Calculation
8. **US0056** - Power Configuration UI

## Test Plan

| Test Spec | Coverage | Status |
|-----------|----------|--------|
| [TS0012](../test-specs/TS0012-cost-tracking.md) | Cost config, electricity rate settings | Active |

## Open Questions

None - all questions resolved.

### Resolved Questions

- [x] Should we track costs over time for trend analysis? - **Yes** - Created US0183. Historical cost tracking enables trend analysis, month-over-month comparison, and budget planning.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation from PRD |
| 2026-01-20 | Claude | Added Inherited Constraints and Test Plan sections |
| 2026-01-20 | Claude | US0033 verified implemented and marked Done |
| 2026-01-20 | Claude | Epic review: 1/4 stories Done, AC1 checked, EP0001 dependency resolved |
| 2026-01-20 | Claude | US0034 edge cases added (8/8); marked Ready for implementation |
| 2026-01-20 | Claude | US0034 implemented (GET/PUT /api/v1/config/cost); 19 tests; AC2 checked |
| 2026-01-20 | Claude | US0035 implemented (GET /api/v1/costs/summary); 16 tests; AC3 checked |
| 2026-01-20 | Claude | US0036 reviewed: edge cases expanded (3→12), dependencies updated, marked Ready |
| 2026-01-20 | Claude | US0036 implemented (GET /api/v1/costs/breakdown); 17 tests; all AC checked; Epic complete |
| 2026-01-20 | Claude | Reopened: Backend complete but frontend implementation missing for all UI ACs |
| 2026-01-20 | Claude | Frontend complete: All 4 stories implemented with 63 new tests; Epic Done |
| 2026-01-20 | Claude | Added Phase 2: Enhanced Power Estimation with 4 new stories (US0053-US0056); Epic reopened as In Progress |
| 2026-01-20 | Claude | Epic review: US0053, US0054, US0055 backend implementation verified Done; US0056 frontend pending; 7/8 stories Done |
| 2026-01-21 | Claude | Epic review: US0056 (Power Configuration UI) verified complete; all 8/8 stories Done; Epic marked Done |
| 2026-01-21 | Claude | Reopened: US0056 missing ServerUpdate schema fields (AC8 added); 7/8 Done, 1 In Progress |
| 2026-01-21 | Claude | US0056 AC8 implemented; all 8/8 stories Done; Epic marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-29 | Claude | Resolved open question: Added US0183 (Historical Cost Tracking) as Phase 3 enhancement |
