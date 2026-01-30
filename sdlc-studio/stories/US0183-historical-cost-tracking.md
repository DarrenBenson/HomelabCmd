# US0183: Historical Cost Tracking

> **Status:** Done
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 8

## User Story

**As a** Darren (Homelab Operator)
**I want** to track electricity costs over time
**So that** I can analyse trends, compare months, and budget for my homelab

## Context

### Persona Reference

**Darren** - Technical professional managing a homelab. Wants to understand long-term cost patterns and justify expenses.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, cost estimates are calculated on-the-fly based on current TDP and uptime assumptions. There's no historical record of costs over time. This makes it impossible to:
- Compare costs month-over-month
- See impact of adding/removing servers
- Correlate costs with electricity bills
- Identify cost trends

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| EP0005 | Accuracy | Within 10% of actual | Historical data inherits same accuracy caveat |
| TRD | Data | SQLite storage | Store daily cost snapshots |
| PRD | Performance | Dashboard < 3s | Historical queries must be efficient |

---

## Acceptance Criteria

### AC1: Daily cost snapshot

- **Given** the system is running
- **When** midnight UTC occurs (or configurable time)
- **Then** a daily cost snapshot is recorded for each server
- **And** the snapshot includes: server_id, date, estimated_cost_kwh, electricity_rate

### AC2: Historical cost API

- **Given** historical cost data exists
- **When** I request cost history via API
- **Then** I can filter by date range, server, or aggregate (fleet)
- **And** the API returns daily, weekly, or monthly aggregations

### AC3: Cost trend visualisation

- **Given** I view the cost breakdown page
- **When** historical data is available
- **Then** I see a line chart showing cost over time
- **And** I can select time range: 7 days, 30 days, 90 days, 12 months
- **And** I can compare current period to previous period

### AC4: Per-server cost history

- **Given** I view a server's detail page
- **When** I view the cost section
- **Then** I see the server's cost history chart
- **And** I can see when TDP/category changes affected cost

### AC5: Monthly cost summary

- **Given** I view the costs page
- **When** I select monthly view
- **Then** I see a bar chart of monthly costs
- **And** I can see month-over-month change percentage
- **And** I can see year-to-date total

### AC6: Data retention

- **Given** cost data is being stored
- **When** data is older than 2 years
- **Then** daily data is rolled up to monthly aggregates
- **And** monthly data is retained indefinitely

---

## Scope

### In Scope

- Daily cost snapshot job
- Historical cost database table
- Cost history API (daily/weekly/monthly aggregation)
- Cost trend chart on breakdown page
- Per-server cost history on detail page
- Monthly summary view
- Data retention/rollup (2 years daily, then monthly)

### Out of Scope

- Real-time cost tracking (use daily snapshots)
- Cost predictions/forecasting
- Budget alerts ("cost exceeds X")
- Cost comparison across users/installations
- Export to CSV/spreadsheet (future enhancement)

---

## Technical Notes

### Implementation Approach

1. **Schema:**
   ```python
   class CostSnapshot(Base):
       __tablename__ = 'cost_snapshots'

       id: int = Column(Integer, primary_key=True)
       server_id: str = Column(String, ForeignKey('servers.id'))
       date: date = Column(Date, index=True)
       estimated_kwh: float = Column(Float)  # kWh consumed that day
       estimated_cost: float = Column(Float)  # Cost in configured currency
       electricity_rate: float = Column(Float)  # Rate at time of snapshot
       tdp_watts: int = Column(Integer)  # TDP at time of snapshot

       __table_args__ = (
           UniqueConstraint('server_id', 'date', name='uq_cost_snapshot'),
       )
   ```

2. **Daily snapshot job:**
   ```python
   @scheduler.cron('0 0 * * *')  # Midnight UTC
   async def capture_daily_costs():
       servers = await get_all_servers()
       rate = await get_electricity_rate()

       for server in servers:
           kwh = calculate_daily_kwh(server)
           cost = kwh * rate
           await create_cost_snapshot(server.id, date.today(), kwh, cost, rate, server.tdp)
   ```

3. **API endpoints:**
   ```
   GET /api/v1/costs/history
       ?start_date=2026-01-01
       &end_date=2026-01-31
       &server_id=optional
       &aggregation=daily|weekly|monthly

   GET /api/v1/costs/summary/monthly
       ?year=2026

   GET /api/v1/servers/{id}/costs/history
       ?period=30d|90d|12m
   ```

4. **Data rollup job (monthly):**
   ```python
   @scheduler.cron('0 1 1 * *')  # 1st of each month
   async def rollup_old_cost_data():
       cutoff = date.today() - timedelta(days=730)  # 2 years
       # Aggregate daily to monthly, delete daily records
   ```

### Files to Create/Modify

- `backend/src/homelab_cmd/db/models/cost_snapshot.py` - New model
- `backend/src/homelab_cmd/services/cost_history.py` - New service
- `backend/src/homelab_cmd/api/routes/costs.py` - Add history endpoints
- `backend/src/homelab_cmd/services/scheduler.py` - Add daily job
- `frontend/src/pages/CostsPage.tsx` - Add trend chart
- `frontend/src/pages/ServerDetail.tsx` - Add cost history widget
- `frontend/src/components/CostTrendChart.tsx` - New component
- Alembic migration for cost_snapshots table

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Server added mid-day | First snapshot next midnight |
| 2 | Server deleted | Historical data retained (orphaned) |
| 3 | TDP changed during day | Use current TDP for daily snapshot |
| 4 | Rate changed during day | Use current rate for daily snapshot |
| 5 | Missed snapshot (hub down) | Backfill on next run if possible |
| 6 | No data for requested period | Return empty array, UI shows "No data" |
| 7 | Server offline all day | Record $0 cost (or skip?) |

---

## Test Scenarios

- [ ] Daily snapshot created at midnight
- [ ] Snapshot captures correct server data
- [ ] API returns history filtered by date range
- [ ] API supports daily/weekly/monthly aggregation
- [ ] Trend chart displays correctly
- [ ] Monthly summary calculates correctly
- [ ] Data rollup preserves monthly aggregates
- [ ] Per-server history shows on detail page

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0033 | TDP configuration | Done |
| US0034 | Electricity rate | Done |
| US0055 | Usage-based power calculation | Done |

---

## Estimation

**Story Points:** 8
**Complexity:** Medium-High - new data model, scheduled jobs, charts, multiple API endpoints

---

## Open Questions

None.

---

## Implementation Artefacts

| Artefact | Link | Status |
|----------|------|--------|
| Plan | [PL0200](../plans/PL0200-historical-cost-tracking.md) | Complete |
| Test Spec | [TS0200](../test-specs/TS0200-historical-cost-tracking.md) | Complete |
| Workflow | [WF0200](../workflows/WF0200-historical-cost-tracking.md) | Complete |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0005 open question |
| 2026-01-29 | Claude | Status: Draft → Planned. Plan PL0200 and Test Spec TS0200 created |
| 2026-01-29 | Claude | Status: Planned → Done. Full implementation complete |
