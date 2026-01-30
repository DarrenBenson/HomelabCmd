# TS0200: Historical Cost Tracking - Test Specification

> **Status:** Complete
> **Story:** [US0183: Historical Cost Tracking](../stories/US0183-historical-cost-tracking.md)
> **Plan:** [PL0200: Historical Cost Tracking](../plans/PL0200-historical-cost-tracking.md)
> **Created:** 2026-01-29

## Overview

Test specification for historical cost tracking functionality including daily snapshots, cost history API, and frontend visualisations.

---

## Test Strategy

| Layer | Approach | Framework |
|-------|----------|-----------|
| Backend Unit | Test service methods with mocked DB | pytest + pytest-asyncio |
| Backend API | Test endpoints with test client | pytest + httpx |
| Frontend Unit | Test components with mock data | Vitest + React Testing Library |
| Frontend Integration | Test page with API mocks | Vitest + MSW |

---

## Backend Tests

### Unit Tests: CostHistoryService

**File:** `tests/test_cost_history.py`

#### TC-B001: Capture daily snapshot for server
```python
async def test_capture_snapshot_creates_record(session, server):
    """AC1: Daily snapshot recorded with required fields."""
    service = CostHistoryService(session)

    snapshot = await service.capture_daily_snapshot(server.id)

    assert snapshot.server_id == server.id
    assert snapshot.date == date.today()
    assert snapshot.estimated_kwh > 0
    assert snapshot.estimated_cost > 0
    assert snapshot.electricity_rate > 0
```

#### TC-B002: Capture snapshot for workstation with hours_used
```python
async def test_capture_snapshot_workstation_hours(session, workstation):
    """AC1: Workstation snapshot includes hours_used."""
    service = CostHistoryService(session)

    snapshot = await service.capture_daily_snapshot(workstation.id)

    assert snapshot.machine_type == "workstation"
    assert snapshot.hours_used is not None
```

#### TC-B003: Capture snapshot uses current TDP
```python
async def test_capture_snapshot_uses_current_tdp(session, server):
    """Edge case: TDP changed during day - use current value."""
    server.tdp_watts = 150
    await session.commit()

    service = CostHistoryService(session)
    snapshot = await service.capture_daily_snapshot(server.id)

    assert snapshot.tdp_watts == 150
```

#### TC-B004: Capture all snapshots
```python
async def test_capture_all_snapshots(session, servers):
    """AC1: Capture snapshots for all servers."""
    service = CostHistoryService(session)

    count = await service.capture_all_snapshots()

    assert count == len(servers)
```

#### TC-B005: Skip offline server
```python
async def test_capture_snapshot_offline_server(session, offline_server):
    """Edge case: Server offline all day - record $0 cost."""
    service = CostHistoryService(session)

    snapshot = await service.capture_daily_snapshot(offline_server.id)

    assert snapshot.estimated_kwh == 0.0
    assert snapshot.estimated_cost == 0.0
```

#### TC-B006: No duplicate snapshots
```python
async def test_no_duplicate_snapshots(session, server):
    """Constraint: Unique (server_id, date) - second capture updates."""
    service = CostHistoryService(session)

    await service.capture_daily_snapshot(server.id)
    await service.capture_daily_snapshot(server.id)

    result = await session.execute(
        select(func.count()).where(CostSnapshot.server_id == server.id)
    )
    assert result.scalar() == 1
```

#### TC-B007: Get history daily aggregation
```python
async def test_get_history_daily(session, cost_snapshots):
    """AC2: Return daily cost history."""
    service = CostHistoryService(session)

    history = await service.get_history(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 7),
        aggregation="daily"
    )

    assert len(history) == 7
    assert all(item.date for item in history)
```

#### TC-B008: Get history weekly aggregation
```python
async def test_get_history_weekly(session, cost_snapshots):
    """AC2: Return weekly aggregated cost history."""
    service = CostHistoryService(session)

    history = await service.get_history(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        aggregation="weekly"
    )

    assert len(history) <= 5  # 4-5 weeks in January
    assert all(item.estimated_cost > 0 for item in history)
```

#### TC-B009: Get history monthly aggregation
```python
async def test_get_history_monthly(session, cost_snapshots):
    """AC2: Return monthly aggregated cost history."""
    service = CostHistoryService(session)

    history = await service.get_history(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        aggregation="monthly"
    )

    assert len(history) == 3
```

#### TC-B010: Get history filtered by server
```python
async def test_get_history_filtered_by_server(session, cost_snapshots):
    """AC2: Filter history by server_id."""
    service = CostHistoryService(session)

    history = await service.get_history(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        server_id="server-1"
    )

    assert all(item.server_id == "server-1" for item in history)
```

#### TC-B011: Get monthly summary
```python
async def test_get_monthly_summary(session, cost_snapshots):
    """AC5: Return monthly summary with YTD."""
    service = CostHistoryService(session)

    summary = await service.get_monthly_summary(year=2026)

    assert summary.year == 2026
    assert summary.year_to_date_cost > 0
    assert len(summary.months) > 0
```

#### TC-B012: Monthly summary change percentage
```python
async def test_monthly_summary_change_percent(session, cost_snapshots):
    """AC5: Month-over-month change percentage."""
    service = CostHistoryService(session)

    summary = await service.get_monthly_summary(year=2026)

    # First month should have no previous month comparison
    assert summary.months[0].previous_month_cost is None
    # Second month should have change
    if len(summary.months) > 1:
        assert summary.months[1].change_percent is not None
```

#### TC-B013: Get server history
```python
async def test_get_server_history(session, cost_snapshots, server):
    """AC4: Return per-server cost history."""
    service = CostHistoryService(session)

    history = await service.get_server_history(
        server_id=server.id,
        period="30d"
    )

    assert len(history.items) <= 30
    assert all(item.server_id == server.id for item in history.items)
```

#### TC-B014: Rollup old data to monthly
```python
async def test_rollup_old_data(session, old_cost_snapshots):
    """AC6: Daily data older than 2 years rolled up to monthly."""
    service = CostHistoryService(session)

    result = await service.rollup_old_data()

    assert result["daily_deleted"] > 0
    assert result["monthly_created"] > 0
```

#### TC-B015: Rollup preserves totals
```python
async def test_rollup_preserves_totals(session, old_cost_snapshots):
    """AC6: Monthly aggregates preserve cost totals."""
    service = CostHistoryService(session)

    # Get total before rollup
    total_before = sum(s.estimated_cost for s in old_cost_snapshots)

    await service.rollup_old_data()

    # Get monthly total after rollup
    monthly = await session.execute(select(CostSnapshotMonthly))
    total_after = sum(m.total_cost for m in monthly.scalars().all())

    assert abs(total_after - total_before) < 0.01  # Allow rounding
```

### API Tests

**File:** `tests/test_cost_history_api.py`

#### TC-A001: GET /costs/history returns history
```python
async def test_get_cost_history(client, auth_headers, cost_snapshots):
    """AC2: API returns cost history."""
    response = client.get(
        "/api/v1/costs/history",
        params={"start_date": "2026-01-01", "end_date": "2026-01-31"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "aggregation" in data
    assert data["aggregation"] == "daily"
```

#### TC-A002: GET /costs/history with aggregation
```python
async def test_get_cost_history_weekly_aggregation(client, auth_headers, cost_snapshots):
    """AC2: API supports aggregation parameter."""
    response = client.get(
        "/api/v1/costs/history",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "aggregation": "weekly"
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["aggregation"] == "weekly"
```

#### TC-A003: GET /costs/history with server filter
```python
async def test_get_cost_history_server_filter(client, auth_headers, cost_snapshots):
    """AC2: API filters by server_id."""
    response = client.get(
        "/api/v1/costs/history",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "server_id": "server-1"
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert all(item["server_id"] == "server-1" for item in data["items"])
```

#### TC-A004: GET /costs/history invalid date range
```python
async def test_get_cost_history_invalid_dates(client, auth_headers):
    """Validation: end_date before start_date."""
    response = client.get(
        "/api/v1/costs/history",
        params={"start_date": "2026-01-31", "end_date": "2026-01-01"},
        headers=auth_headers
    )

    assert response.status_code == 422
```

#### TC-A005: GET /costs/history invalid aggregation
```python
async def test_get_cost_history_invalid_aggregation(client, auth_headers):
    """Validation: invalid aggregation value."""
    response = client.get(
        "/api/v1/costs/history",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "aggregation": "yearly"
        },
        headers=auth_headers
    )

    assert response.status_code == 422
```

#### TC-A006: GET /costs/history no data
```python
async def test_get_cost_history_no_data(client, auth_headers):
    """Edge case: No data for period."""
    response = client.get(
        "/api/v1/costs/history",
        params={"start_date": "2020-01-01", "end_date": "2020-01-31"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
```

#### TC-A007: GET /costs/summary/monthly returns summary
```python
async def test_get_monthly_summary(client, auth_headers, cost_snapshots):
    """AC5: API returns monthly summary."""
    response = client.get(
        "/api/v1/costs/summary/monthly",
        params={"year": 2026},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "months" in data
    assert "year_to_date_cost" in data
    assert data["year"] == 2026
```

#### TC-A008: GET /costs/summary/monthly defaults to current year
```python
async def test_get_monthly_summary_default_year(client, auth_headers, cost_snapshots):
    """AC5: Default to current year."""
    response = client.get(
        "/api/v1/costs/summary/monthly",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["year"] == date.today().year
```

#### TC-A009: GET /servers/{id}/costs/history returns server history
```python
async def test_get_server_cost_history(client, auth_headers, cost_snapshots, server):
    """AC4: API returns per-server cost history."""
    response = client.get(
        f"/api/v1/servers/{server.id}/costs/history",
        params={"period": "30d"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["server_id"] == server.id
    assert "items" in data
    assert data["period"] == "30d"
```

#### TC-A010: GET /servers/{id}/costs/history invalid period
```python
async def test_get_server_cost_history_invalid_period(client, auth_headers, server):
    """Validation: invalid period value."""
    response = client.get(
        f"/api/v1/servers/{server.id}/costs/history",
        params={"period": "1y"},
        headers=auth_headers
    )

    assert response.status_code == 422
```

#### TC-A011: GET /servers/{id}/costs/history server not found
```python
async def test_get_server_cost_history_not_found(client, auth_headers):
    """Error: Server not found."""
    response = client.get(
        "/api/v1/servers/nonexistent/costs/history",
        headers=auth_headers
    )

    assert response.status_code == 404
```

#### TC-A012: Authentication required
```python
async def test_cost_history_requires_auth(client):
    """All cost history endpoints require authentication."""
    response = client.get(
        "/api/v1/costs/history",
        params={"start_date": "2026-01-01", "end_date": "2026-01-31"}
    )

    assert response.status_code == 401
```

---

## Frontend Tests

### Component Tests: CostTrendChart

**File:** `frontend/src/__tests__/components/CostTrendChart.test.tsx`

#### TC-F001: Renders chart with data
```typescript
it('renders line chart with cost data', () => {
  render(
    <CostTrendChart
      data={mockCostHistory}
      currencySymbol="$"
    />
  );

  expect(screen.getByRole('img', { name: /chart/i })).toBeInTheDocument();
  // Recharts renders an SVG
});
```

#### TC-F002: Shows period selector
```typescript
it('shows period selection buttons', () => {
  render(<CostTrendChart data={mockCostHistory} currencySymbol="$" />);

  expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /90 days/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /12 months/i })).toBeInTheDocument();
});
```

#### TC-F003: Period selection callback
```typescript
it('calls onPeriodChange when period selected', async () => {
  const onPeriodChange = vi.fn();
  render(
    <CostTrendChart
      data={mockCostHistory}
      currencySymbol="$"
      onPeriodChange={onPeriodChange}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /90 days/i }));

  expect(onPeriodChange).toHaveBeenCalledWith('90d');
});
```

#### TC-F004: Shows empty state
```typescript
it('shows empty state when no data', () => {
  render(<CostTrendChart data={[]} currencySymbol="$" />);

  expect(screen.getByText(/no historical data/i)).toBeInTheDocument();
});
```

#### TC-F005: Shows comparison line when enabled
```typescript
it('renders comparison line when showComparison is true', () => {
  render(
    <CostTrendChart
      data={mockCostHistory}
      comparisonData={mockComparisonHistory}
      currencySymbol="$"
      showComparison={true}
    />
  );

  // Should have two lines (current and previous period)
  const lines = document.querySelectorAll('.recharts-line');
  expect(lines).toHaveLength(2);
});
```

### Component Tests: MonthlySummaryChart

**File:** `frontend/src/__tests__/components/MonthlySummaryChart.test.tsx`

#### TC-F006: Renders monthly bar chart
```typescript
it('renders bar chart with monthly data', () => {
  render(
    <MonthlySummaryChart
      data={mockMonthlySummary}
      currencySymbol="$"
    />
  );

  expect(screen.getByRole('img', { name: /chart/i })).toBeInTheDocument();
});
```

#### TC-F007: Shows year-to-date total
```typescript
it('displays year-to-date cost total', () => {
  render(
    <MonthlySummaryChart
      data={mockMonthlySummary}
      yearToDate={1250.50}
      currencySymbol="$"
    />
  );

  expect(screen.getByText(/year to date/i)).toBeInTheDocument();
  expect(screen.getByText(/\$1,250\.50/i)).toBeInTheDocument();
});
```

#### TC-F008: Shows change percentage badges
```typescript
it('shows month-over-month change badges', () => {
  render(
    <MonthlySummaryChart
      data={mockMonthlySummaryWithChanges}
      currencySymbol="$"
    />
  );

  // Should show +5.2% or similar
  expect(screen.getByText(/\+\d+\.\d+%/)).toBeInTheDocument();
});
```

#### TC-F009: Year selector
```typescript
it('calls onYearChange when year selected', async () => {
  const onYearChange = vi.fn();
  render(
    <MonthlySummaryChart
      data={mockMonthlySummary}
      currencySymbol="$"
      year={2026}
      onYearChange={onYearChange}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /2025/i }));

  expect(onYearChange).toHaveBeenCalledWith(2025);
});
```

### Component Tests: ServerCostHistoryWidget

**File:** `frontend/src/__tests__/widgets/ServerCostHistoryWidget.test.tsx`

#### TC-F010: Renders compact chart
```typescript
it('renders compact cost history chart', () => {
  render(
    <ServerCostHistoryWidget
      serverId="server-1"
      data={mockServerHistory}
      currencySymbol="$"
    />
  );

  expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
});
```

#### TC-F011: Shows loading state
```typescript
it('shows loading spinner while fetching', () => {
  render(
    <ServerCostHistoryWidget
      serverId="server-1"
      data={null}
      loading={true}
      currencySymbol="$"
    />
  );

  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});
```

#### TC-F012: Period selection
```typescript
it('supports period selection', async () => {
  const onPeriodChange = vi.fn();
  render(
    <ServerCostHistoryWidget
      serverId="server-1"
      data={mockServerHistory}
      currencySymbol="$"
      period="30d"
      onPeriodChange={onPeriodChange}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /7d/i }));

  expect(onPeriodChange).toHaveBeenCalledWith('7d');
});
```

### Page Tests: CostsPage

**File:** `frontend/src/__tests__/pages/CostsPage.test.tsx` (extend)

#### TC-F013: Shows tabs for breakdown and trends
```typescript
it('shows Breakdown and Trends tabs', async () => {
  render(<CostsPage />);
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: /breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /trends/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /monthly/i })).toBeInTheDocument();
  });
});
```

#### TC-F014: Trends tab shows chart
```typescript
it('shows trend chart when Trends tab selected', async () => {
  render(<CostsPage />);
  await waitFor(() => screen.getByRole('tab', { name: /trends/i }));

  await userEvent.click(screen.getByRole('tab', { name: /trends/i }));

  expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument();
});
```

#### TC-F015: Monthly tab shows summary
```typescript
it('shows monthly summary when Monthly tab selected', async () => {
  render(<CostsPage />);
  await waitFor(() => screen.getByRole('tab', { name: /monthly/i }));

  await userEvent.click(screen.getByRole('tab', { name: /monthly/i }));

  expect(screen.getByTestId('monthly-summary-chart')).toBeInTheDocument();
  expect(screen.getByText(/year to date/i)).toBeInTheDocument();
});
```

#### TC-F016: Shows no historical data message
```typescript
it('shows message when no historical data available', async () => {
  server.use(
    rest.get('/api/v1/costs/history', (req, res, ctx) => {
      return res(ctx.json({ items: [], aggregation: 'daily' }));
    })
  );

  render(<CostsPage />);
  await userEvent.click(screen.getByRole('tab', { name: /trends/i }));

  expect(screen.getByText(/no historical data/i)).toBeInTheDocument();
});
```

### Page Tests: ServerDetail

**File:** `frontend/src/__tests__/pages/ServerDetail.test.tsx` (extend)

#### TC-F017: Shows cost history widget
```typescript
it('shows cost history widget on server detail page', async () => {
  render(<ServerDetail />);
  await waitFor(() => {
    expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
  });
});
```

#### TC-F018: Hides widget when no history
```typescript
it('hides cost history widget when no data', async () => {
  server.use(
    rest.get('/api/v1/servers/:id/costs/history', (req, res, ctx) => {
      return res(ctx.json({ items: [], period: '30d' }));
    })
  );

  render(<ServerDetail />);
  await waitFor(() => {
    expect(screen.queryByTestId('server-cost-history-widget')).not.toBeInTheDocument();
  });
});
```

---

## Test Data Fixtures

### Backend Fixtures

```python
@pytest.fixture
def cost_snapshots(session):
    """Create 30 days of cost snapshots."""
    snapshots = []
    for i in range(30):
        snapshot = CostSnapshot(
            server_id="server-1",
            date=date.today() - timedelta(days=i),
            estimated_kwh=2.4,
            estimated_cost=0.48,
            electricity_rate=0.20,
            tdp_watts=100,
        )
        session.add(snapshot)
        snapshots.append(snapshot)
    session.commit()
    return snapshots

@pytest.fixture
def old_cost_snapshots(session):
    """Create cost snapshots older than 2 years."""
    snapshots = []
    old_date = date.today() - timedelta(days=800)
    for i in range(60):
        snapshot = CostSnapshot(
            server_id="server-1",
            date=old_date - timedelta(days=i),
            estimated_kwh=2.4,
            estimated_cost=0.48,
            electricity_rate=0.20,
            tdp_watts=100,
        )
        session.add(snapshot)
        snapshots.append(snapshot)
    session.commit()
    return snapshots
```

### Frontend Mock Data

```typescript
export const mockCostHistory: CostHistoryItem[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  estimated_kwh: 2.4 + Math.random() * 0.5,
  estimated_cost: 0.48 + Math.random() * 0.1,
  electricity_rate: 0.20,
}));

export const mockMonthlySummary: MonthlySummaryItem[] = [
  { year_month: '2026-01', total_cost: 14.40, total_kwh: 72, previous_month_cost: null, change_percent: null },
  { year_month: '2026-02', total_cost: 15.12, total_kwh: 75.6, previous_month_cost: 14.40, change_percent: 5.0 },
];
```

---

## Coverage Requirements

| Area | Target | Critical Paths |
|------|--------|----------------|
| CostHistoryService | 90% | capture_daily_snapshot, get_history, rollup |
| API Endpoints | 90% | All /costs/* and /servers/{id}/costs/* |
| CostTrendChart | 85% | Rendering, period selection |
| MonthlySummaryChart | 85% | Rendering, year selection |
| CostsPage tabs | 80% | Tab switching, data loading |

---

## Test Execution Order

1. **Backend Unit Tests** - CostHistoryService
2. **Backend API Tests** - /costs/history, /costs/summary/monthly, /servers/{id}/costs/history
3. **Frontend Component Tests** - CostTrendChart, MonthlySummaryChart, ServerCostHistoryWidget
4. **Frontend Page Tests** - CostsPage tabs, ServerDetail integration

---

## Acceptance Criteria Coverage

| AC | Test Cases |
|----|------------|
| AC1 | TC-B001, TC-B002, TC-B003, TC-B004, TC-B005, TC-B006 |
| AC2 | TC-B007, TC-B008, TC-B009, TC-B010, TC-A001, TC-A002, TC-A003, TC-A006 |
| AC3 | TC-F001, TC-F002, TC-F003, TC-F004, TC-F005, TC-F014, TC-F016 |
| AC4 | TC-B013, TC-A009, TC-A010, TC-A011, TC-F010, TC-F011, TC-F012, TC-F017, TC-F018 |
| AC5 | TC-B011, TC-B012, TC-A007, TC-A008, TC-F006, TC-F007, TC-F008, TC-F009, TC-F015 |
| AC6 | TC-B014, TC-B015 |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial test specification |
