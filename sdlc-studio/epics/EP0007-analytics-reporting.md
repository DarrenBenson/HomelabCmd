# EP0007: Analytics & Reporting

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 2
> **Story Points:** 10

## Summary

Enhance data management with tiered retention (rollups) and long-term reporting capabilities. Allows viewing trends over 12 months while keeping storage efficient through automatic data aggregation.

## Inherited Constraints

Constraints that flow from PRD and TRD to this Epic.

### From PRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Performance | Dashboard load < 2 seconds | 12-month charts must query efficiently |
| Design | Brand guide compliance | Trend charts follow phosphor colour palette |
| Goal | Minimal maintenance overhead | Rollup jobs must be automatic |

### From TRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Architecture | Monolith deployment | Rollup scheduler in main container |
| Tech Stack | Python/FastAPI | Background tasks for rollup jobs |
| Data Model | SQLite storage | New tables for hourly/daily aggregates |
| Data Model | 30-day raw retention (US0009) | Rollup extends existing prune job |

> **Note:** Inherited constraints MUST propagate to child Stories. Check Story templates include these constraints.

## Business Context

### Problem Statement

The current 30-day raw data retention (US0009) provides good detail for recent troubleshooting but lacks long-term trend visibility. Users cannot answer questions like "Has my server's RAM usage increased over the past year?" Additionally, storing raw 60-second data for extended periods would be wasteful and slow to query.

**PRD Reference:** [§3 Feature Inventory](../prd.md#3-feature-inventory)

### Value Proposition

- View 12-month trends for capacity planning without storing excessive data
- Automatic rollup reduces storage by ~95% for data older than 7 days
- Answer long-term questions: "When should I upgrade this server?"

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Data retention period | 30 days (raw only) | 12 months (tiered) | Database query |
| Storage per server (1 year) | N/A (~5.5M rows) | ~90k rows | Database size |
| 12-month chart load time | N/A | < 3 seconds | Browser DevTools |

## Scope

### In Scope

- Tiered data retention with automatic rollup jobs
- Hourly aggregates retained for 90 days
- Daily aggregates retained for 12 months
- 12-month trend report view in UI
- Data export (CSV/JSON) for offline analysis
- Rollup job scheduling (runs after daily prune)

### Out of Scope

- Real-time alerting on trends (EP0002)
- Predictive analytics / ML-based forecasting
- Cross-server comparison reports (future enhancement)
- Custom retention period configuration (fixed tiers for MVP)

### Affected User Personas

- **Darren (Homelab Operator):** Can plan hardware upgrades based on 12-month usage trends

## Acceptance Criteria (Epic Level)

- [x] Raw metrics automatically rolled up to hourly after 7 days
- [x] Hourly metrics rolled up to daily after 90 days
- [x] Data older than 12 months is deleted
- [x] 12-month chart displays daily averages correctly
- [x] Storage reduction of >90% compared to raw-only retention
- [x] Rollup jobs complete without blocking normal operations
- [x] Export functionality produces valid CSV/JSON files

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| EP0001: Core Monitoring | Epic | Done | Darren | Requires metrics data and existing retention job |
| US0009: Data Retention | Story | Done | Darren | Rollup job extends existing prune job |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | Standalone enhancement |

## Risks & Assumptions

### Assumptions

- Daily/hourly averages provide sufficient granularity for long-term analysis
- Users don't need minute-level detail beyond 7 days
- SQLite can handle aggregate tables efficiently

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rollup job takes too long | Low | Medium | Batch processing; run during low-activity periods |
| Aggregate data loses important spikes | Medium | Low | Keep max/min values alongside averages |
| Complex queries slow down UI | Low | Medium | Pre-aggregate common queries; add indices |

## Technical Considerations

### Architecture Impact

- New database tables: `metrics_hourly`, `metrics_daily`
- Extended scheduler with rollup jobs
- New API endpoints for aggregated data queries
- Frontend chart component updates for 12-month view

### Integration Points

- Scheduler → Database: Rollup jobs write to aggregate tables
- API → Database: Query appropriate table based on time range
- Frontend → API: Request 12-month data, receive daily aggregates

### Data Considerations

**Table structure:**

| Table | Granularity | Retention | Rows/server/year |
|-------|-------------|-----------|------------------|
| metrics | 60 seconds | 7 days | ~10,080 |
| metrics_hourly | 1 hour | 90 days | ~2,160 |
| metrics_daily | 1 day | 12 months | ~365 |

**Rollup fields:** timestamp, server_id, cpu_avg, cpu_max, memory_avg, memory_max, disk_avg, disk_max

**TRD Reference:** [§5 Data Architecture](../trd.md#5-data-architecture)

## Sizing & Effort

**Estimated Story Count:** 3 stories

**Story Points:** 10

**Complexity Factors:**

- Database schema changes (new tables, migrations)
- Scheduler job coordination (prune → rollup ordering)
- API logic to select correct data source based on time range
- Frontend chart updates for variable granularity

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Long-term visibility into fleet health |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

| ID | Title | Points | Status |
|----|-------|--------|--------|
| [US0046](../stories/US0046-tiered-data-retention.md) | Tiered Data Retention and Rollup | 5 | Done |
| [US0047](../stories/US0047-twelve-month-trend-view.md) | 12-Month Trend Report View | 3 | Done |
| [US0048](../stories/US0048-metrics-data-export.md) | Metrics Data Export | 2 | Done |

**Total:** 3 stories, 10 story points

## Test Plan

Test specs to be created when stories move to Ready status.

| Test Spec | Coverage | Status |
|-----------|----------|--------|
| TS00XX | Data rollup, trend charts, data export | Pending |

## Open Questions

- [x] Should rollup include network I/O metrics? - Owner: Darren - **Decision:** Not in MVP (CPU, Memory, Disk only)
- [x] Include min/max values in aggregates or just averages? - Owner: Darren - **Decision:** Include min/max/avg for all metrics

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation |
| 2026-01-20 | Claude | Added Inherited Constraints and Test Plan sections; fixed story IDs |
| 2026-01-21 | Claude | Epic completed - all stories Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
