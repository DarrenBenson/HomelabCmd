# Code Plan: US0048 - Metrics Data Export

> **Story:** [US0048: Metrics Data Export](../stories/US0048-metrics-data-export.md)
> **Epic:** [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)
> **Created:** 2026-01-21

## Overview

Add CSV and JSON export functionality for server metrics. Users can export data for any time range directly from the server detail page. The export uses tiered data (raw/hourly/daily) based on the selected time range.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/homelab_cmd/api/routes/metrics.py` | Modify | Add export endpoint |
| `frontend/src/components/ExportButton.tsx` | Create | Export button with dropdown |
| `frontend/src/components/ExportButton.test.tsx` | Create | Export button tests |
| `frontend/src/pages/ServerDetailPage.tsx` | Modify | Add ExportButton to metrics section |
| `frontend/src/services/api.ts` | Modify | Add exportMetrics function |

## Implementation Details

### Phase 1: Backend Export Endpoint

#### 1.1 Add Export Endpoint to metrics.py

```python
from fastapi.responses import StreamingResponse
from io import StringIO
import csv
import json as json_module

class ExportFormat(str, Enum):
    """Supported export formats."""
    CSV = "csv"
    JSON = "json"

@router.get("/{server_id}/metrics/export")
async def export_metrics(
    server_id: str,
    range: TimeRange = Query(..., description="Time range for export"),
    format: ExportFormat = Query(default=ExportFormat.CSV, description="Export format"),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export metrics data as CSV or JSON.

    Uses tiered data based on time range:
    - 24h: Raw data (1-minute resolution)
    - 7d: Aggregated raw data (hourly)
    - 30d: Hourly table
    - 12m: Daily table
    """
    # Verify server exists
    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    # Query data using existing tier logic
    hours, resolution, tier, _ = RANGE_CONFIG[range]
    cutoff = datetime.now(UTC) - timedelta(hours=hours)

    # Build appropriate query based on tier
    if tier == DataTier.RAW:
        # Query raw metrics
        data = await _query_raw_metrics(db, server_id, cutoff)
    elif tier == DataTier.RAW_AGGREGATED:
        # Query raw and aggregate
        data = await _query_aggregated_raw(db, server_id, cutoff)
    elif tier == DataTier.HOURLY:
        # Query hourly table
        data = await _query_hourly_metrics(db, server_id, cutoff)
    else:  # DAILY
        # Query daily table
        data = await _query_daily_metrics(db, server_id, cutoff)

    # Generate filename
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"{server_id}-metrics-{range.value}-{today}.{format.value}"

    # Format output
    if format == ExportFormat.CSV:
        return _export_csv(data, filename, tier)
    else:
        return _export_json(data, filename, server_id, server.display_name, range)
```

#### 1.2 Helper Functions for Export

```python
def _export_csv(data: list, filename: str, tier: DataTier) -> StreamingResponse:
    """Generate CSV response."""
    output = StringIO()
    writer = csv.writer(output)

    if tier in (DataTier.RAW, DataTier.RAW_AGGREGATED):
        # Simple format for raw data
        writer.writerow(["timestamp", "cpu_percent", "memory_percent", "disk_percent"])
        for point in data:
            writer.writerow([
                point["timestamp"],
                point["cpu_percent"],
                point["memory_percent"],
                point["disk_percent"],
            ])
    else:
        # Aggregate format with min/max
        writer.writerow([
            "timestamp",
            "cpu_avg", "cpu_min", "cpu_max",
            "memory_avg", "memory_min", "memory_max",
            "disk_avg", "disk_min", "disk_max",
        ])
        for point in data:
            writer.writerow([
                point["timestamp"],
                point.get("cpu_avg") or point.get("cpu_percent"),
                point.get("cpu_min"),
                point.get("cpu_max"),
                point.get("memory_avg") or point.get("memory_percent"),
                point.get("memory_min"),
                point.get("memory_max"),
                point.get("disk_avg") or point.get("disk_percent"),
                point.get("disk_min"),
                point.get("disk_max"),
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _export_json(
    data: list,
    filename: str,
    server_id: str,
    server_name: str,
    range: TimeRange,
) -> StreamingResponse:
    """Generate JSON response."""
    export_data = {
        "server_id": server_id,
        "server_name": server_name,
        "range": range.value,
        "exported_at": datetime.now(UTC).isoformat(),
        "data_points": data,
    }

    content = json_module.dumps(export_data, indent=2, default=str)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

### Phase 2: Frontend Export Component

#### 2.1 Create ExportButton Component

```typescript
// frontend/src/components/ExportButton.tsx
import { useState, useRef, useEffect } from 'react';
import type { TimeRange } from '../types/server';

interface ExportButtonProps {
  serverId: string;
  timeRange: TimeRange;
  disabled?: boolean;
}

export function ExportButton({ serverId, timeRange, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsOpen(false);
    setIsExporting(true);

    try {
      const response = await fetch(
        `/api/v1/servers/${serverId}/metrics/export?range=${timeRange}&format=${format}`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '')
        || `${serverId}-metrics-${timeRange}.${format}`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      // Toast notification would go here
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} data-testid="export-button-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm font-medium
          bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary
          ${disabled || isExporting ? 'cursor-not-allowed opacity-50' : ''}`}
        data-testid="export-button"
      >
        {isExporting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
            Exporting...
          </>
        ) : (
          <>
            Export
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && !isExporting && (
        <div
          className="absolute right-0 mt-1 w-24 rounded border border-border-default bg-bg-primary shadow-lg z-10"
          data-testid="export-dropdown"
        >
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            data-testid="export-csv"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            data-testid="export-json"
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 2.2 Update ServerDetailPage

Add ExportButton next to TimeRangeSelector:

```typescript
// In the Historical Metrics section header
<div className="flex items-center justify-between">
  <h2>Historical Metrics</h2>
  <div className="flex items-center gap-2">
    <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
    <ExportButton serverId={server.id} timeRange={timeRange} />
  </div>
</div>
```

## Data Flow

```
User clicks Export → Dropdown shows CSV/JSON options
  ↓
User selects format → ExportButton calls /metrics/export
  ↓
Backend queries appropriate tier (raw/hourly/daily)
  ↓
Backend formats as CSV or JSON with proper headers
  ↓
Browser receives blob → triggers file download
```

## Test Strategy

### Backend Tests
1. Export endpoint returns CSV with correct headers
2. Export endpoint returns JSON with correct structure
3. Export respects time range parameter
4. Export for 12m uses daily tier (aggregate columns)
5. Export for 24h uses raw tier (simple columns)
6. Export with no data returns file with headers only
7. Export for non-existent server returns 404
8. Filename format is correct

### Frontend Tests
1. Export button renders
2. Dropdown opens on click
3. Dropdown closes on outside click
4. CSV option triggers export
5. JSON option triggers export
6. Loading state shows during export
7. Button disabled when disabled prop is true

## Edge Cases

| Case | Handling |
|------|----------|
| No data for range | Return CSV with headers only / JSON with empty data_points |
| Large 12m export | Streaming response prevents timeout |
| Special characters in server name | Filename uses server_id (sanitised) |
| Network error | Frontend shows error, user can retry |

## Performance Considerations

- Use streaming responses for all exports
- 12m daily data is ~365 rows (small)
- 24h raw data is ~1440 rows (still manageable)
- No pagination needed for current data volumes

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | Claude | Initial code plan |
