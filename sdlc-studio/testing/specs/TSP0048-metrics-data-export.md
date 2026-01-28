# Test Specification: TSP0048 - Metrics Data Export

> **Story:** [US0048: Metrics Data Export](../../stories/US0048-metrics-data-export.md)
> **Code Plan:** [US0048-metrics-data-export.md](../../code-plans/US0048-metrics-data-export.md)
> **Created:** 2026-01-21

## Overview

Test specification for the metrics data export feature. Covers backend export endpoint and frontend ExportButton component.

## Test Environment

| Component | Configuration |
|-----------|---------------|
| Backend | pytest + pytest-asyncio + httpx |
| Frontend | Vitest + React Testing Library |
| Database | SQLite in-memory |

## Test Cases

### Backend: Export Endpoint

#### TC0048-001: CSV Export Returns Valid Format

**AC Reference:** AC2 (Can export as CSV)

```python
async def test_export_csv_returns_valid_format(
    async_client: AsyncClient,
    test_server: Server,
    sample_metrics: list[Metric],
):
    """CSV export contains proper headers and data."""
    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "24h", "format": "csv"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]

    lines = response.text.strip().split("\n")
    header = lines[0]
    assert "timestamp" in header
    assert "cpu_percent" in header
    assert "memory_percent" in header
    assert "disk_percent" in header
```

#### TC0048-002: JSON Export Returns Valid Format

**AC Reference:** AC3 (Can export as JSON)

```python
async def test_export_json_returns_valid_format(
    async_client: AsyncClient,
    test_server: Server,
    sample_metrics: list[Metric],
):
    """JSON export contains required fields."""
    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "24h", "format": "json"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"

    data = response.json()
    assert data["server_id"] == test_server.id
    assert data["server_name"] == test_server.display_name
    assert data["range"] == "24h"
    assert "exported_at" in data
    assert "data_points" in data
    assert isinstance(data["data_points"], list)
```

#### TC0048-003: Export Respects Time Range

**AC Reference:** AC4 (Export respects current time range)

```python
async def test_export_respects_time_range(
    async_client: AsyncClient,
    test_server: Server,
    db_session: AsyncSession,
):
    """Export returns only data within requested range."""
    now = datetime.now(UTC)

    # Create data: 2 points within 24h, 1 point 2 days ago
    recent_metrics = [
        Metric(server_id=test_server.id, timestamp=now - timedelta(hours=1), ...),
        Metric(server_id=test_server.id, timestamp=now - timedelta(hours=12), ...),
    ]
    old_metric = Metric(server_id=test_server.id, timestamp=now - timedelta(days=2), ...)

    db_session.add_all([*recent_metrics, old_metric])
    await db_session.commit()

    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "24h", "format": "json"},
    )

    data = response.json()
    assert len(data["data_points"]) == 2  # Only recent, not old
```

#### TC0048-004: Export Filename Format

**AC Reference:** AC5 (Export filename is descriptive)

```python
async def test_export_filename_format(
    async_client: AsyncClient,
    test_server: Server,
    sample_metrics: list[Metric],
):
    """Filename follows pattern: {server_id}-metrics-{range}-{date}.{format}"""
    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "30d", "format": "csv"},
    )

    content_disposition = response.headers["content-disposition"]
    # Should match: mediaserver-metrics-30d-2026-01-21.csv
    assert test_server.id in content_disposition
    assert "30d" in content_disposition
    assert ".csv" in content_disposition
    assert re.search(r"\d{4}-\d{2}-\d{2}", content_disposition)
```

#### TC0048-005: Export 12m Uses Daily Tier Format

**AC Reference:** AC6 (Export handles large datasets)

```python
async def test_export_12m_uses_daily_format(
    async_client: AsyncClient,
    test_server: Server,
    daily_metrics: list[MetricsDaily],
):
    """12-month export includes aggregate columns (avg/min/max)."""
    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "12m", "format": "csv"},
    )

    lines = response.text.strip().split("\n")
    header = lines[0]
    assert "cpu_avg" in header
    assert "cpu_min" in header
    assert "cpu_max" in header
```

#### TC0048-006: Export Empty Data Returns Headers

**Edge Case:** No data for range

```python
async def test_export_empty_data_returns_headers(
    async_client: AsyncClient,
    test_server: Server,
):
    """Export with no data returns file with headers only."""
    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "24h", "format": "csv"},
    )

    assert response.status_code == 200
    lines = response.text.strip().split("\n")
    assert len(lines) == 1  # Header only
    assert "timestamp" in lines[0]
```

#### TC0048-007: Export Non-Existent Server Returns 404

**Edge Case:** Server not found

```python
async def test_export_nonexistent_server_returns_404(
    async_client: AsyncClient,
):
    """Export for non-existent server returns 404."""
    response = await async_client.get(
        "/api/v1/servers/nonexistent/metrics/export",
        params={"range": "24h", "format": "csv"},
    )

    assert response.status_code == 404
```

#### TC0048-008: Export JSON Contains Server Name

**AC Reference:** AC3 (JSON format includes server_name)

```python
async def test_export_json_contains_server_name(
    async_client: AsyncClient,
    test_server: Server,
):
    """JSON export includes server display name."""
    response = await async_client.get(
        f"/api/v1/servers/{test_server.id}/metrics/export",
        params={"range": "24h", "format": "json"},
    )

    data = response.json()
    assert data["server_name"] == test_server.display_name
```

### Frontend: ExportButton Component

#### TC0048-101: Export Button Renders

**AC Reference:** AC1 (Export button available)

```typescript
it('renders export button', () => {
  render(<ExportButton serverId="mediaserver" timeRange="24h" />);

  expect(screen.getByTestId('export-button')).toBeInTheDocument();
  expect(screen.getByText('Export')).toBeInTheDocument();
});
```

#### TC0048-102: Dropdown Opens on Click

**AC Reference:** AC1 (Export button available with dropdown)

```typescript
it('opens dropdown when clicked', async () => {
  render(<ExportButton serverId="mediaserver" timeRange="24h" />);

  await userEvent.click(screen.getByTestId('export-button'));

  expect(screen.getByTestId('export-dropdown')).toBeInTheDocument();
  expect(screen.getByTestId('export-csv')).toBeInTheDocument();
  expect(screen.getByTestId('export-json')).toBeInTheDocument();
});
```

#### TC0048-103: Dropdown Closes on Outside Click

```typescript
it('closes dropdown when clicking outside', async () => {
  render(
    <div>
      <div data-testid="outside">Outside</div>
      <ExportButton serverId="mediaserver" timeRange="24h" />
    </div>
  );

  await userEvent.click(screen.getByTestId('export-button'));
  expect(screen.getByTestId('export-dropdown')).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('outside'));
  expect(screen.queryByTestId('export-dropdown')).not.toBeInTheDocument();
});
```

#### TC0048-104: CSV Export Triggers Download

**AC Reference:** AC2 (CSV file downloads)

```typescript
it('triggers CSV download when selected', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['csv,data'])),
    headers: new Headers({ 'Content-Disposition': 'attachment; filename="test.csv"' }),
  });
  global.fetch = mockFetch;

  render(<ExportButton serverId="mediaserver" timeRange="24h" />);

  await userEvent.click(screen.getByTestId('export-button'));
  await userEvent.click(screen.getByTestId('export-csv'));

  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('/metrics/export?range=24h&format=csv')
  );
});
```

#### TC0048-105: JSON Export Triggers Download

**AC Reference:** AC3 (JSON file downloads)

```typescript
it('triggers JSON download when selected', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['{"data": []}'])),
    headers: new Headers({ 'Content-Disposition': 'attachment; filename="test.json"' }),
  });
  global.fetch = mockFetch;

  render(<ExportButton serverId="mediaserver" timeRange="24h" />);

  await userEvent.click(screen.getByTestId('export-button'));
  await userEvent.click(screen.getByTestId('export-json'));

  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('/metrics/export?range=24h&format=json')
  );
});
```

#### TC0048-106: Loading State During Export

```typescript
it('shows loading state during export', async () => {
  let resolvePromise: (value: unknown) => void;
  const mockFetch = vi.fn().mockImplementation(() => new Promise((resolve) => {
    resolvePromise = resolve;
  }));
  global.fetch = mockFetch;

  render(<ExportButton serverId="mediaserver" timeRange="24h" />);

  await userEvent.click(screen.getByTestId('export-button'));
  await userEvent.click(screen.getByTestId('export-csv'));

  expect(screen.getByText('Exporting...')).toBeInTheDocument();
  expect(screen.getByTestId('export-button')).toBeDisabled();

  // Resolve the fetch
  resolvePromise!({
    ok: true,
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
  });
});
```

#### TC0048-107: Button Disabled When Prop Set

```typescript
it('disables button when disabled prop is true', () => {
  render(<ExportButton serverId="mediaserver" timeRange="24h" disabled />);

  expect(screen.getByTestId('export-button')).toBeDisabled();
  expect(screen.getByTestId('export-button')).toHaveClass('opacity-50');
});
```

#### TC0048-108: Export Uses Current Time Range

**AC Reference:** AC4 (Export respects current time range)

```typescript
it('uses current time range in export request', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
  });
  global.fetch = mockFetch;

  render(<ExportButton serverId="mediaserver" timeRange="30d" />);

  await userEvent.click(screen.getByTestId('export-button'));
  await userEvent.click(screen.getByTestId('export-csv'));

  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('range=30d')
  );
});
```

## Test Data Requirements

### Backend Fixtures

```python
@pytest_asyncio.fixture
async def test_server(db_session: AsyncSession) -> Server:
    """Create test server for export tests."""
    server = Server(
        id="mediaserver",
        display_name="Media Server",
        hostname="192.168.1.100",
        status=ServerStatus.ONLINE,
    )
    db_session.add(server)
    await db_session.commit()
    return server

@pytest_asyncio.fixture
async def sample_metrics(
    db_session: AsyncSession,
    test_server: Server,
) -> list[Metric]:
    """Create sample raw metrics for 24h export."""
    now = datetime.now(UTC)
    metrics = [
        Metric(
            server_id=test_server.id,
            timestamp=now - timedelta(hours=i),
            cpu_percent=40 + i,
            memory_percent=60 + i,
            disk_percent=30,
        )
        for i in range(24)
    ]
    db_session.add_all(metrics)
    await db_session.commit()
    return metrics

@pytest_asyncio.fixture
async def daily_metrics(
    db_session: AsyncSession,
    test_server: Server,
) -> list[MetricsDaily]:
    """Create daily aggregate metrics for 12m export."""
    now = datetime.now(UTC)
    metrics = [
        MetricsDaily(
            server_id=test_server.id,
            timestamp=(now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0),
            cpu_avg=45.0,
            cpu_min=20.0,
            cpu_max=80.0,
            memory_avg=65.0,
            memory_min=50.0,
            memory_max=75.0,
            disk_avg=35.0,
            disk_min=34.0,
            disk_max=36.0,
            sample_count=24,
        )
        for i in range(30)
    ]
    db_session.add_all(metrics)
    await db_session.commit()
    return metrics
```

## Coverage Requirements

| Component | Target | Metric |
|-----------|--------|--------|
| Export endpoint | 90% | Line coverage |
| ExportButton | 90% | Line coverage |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial test specification |
