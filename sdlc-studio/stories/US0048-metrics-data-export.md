# US0048: Metrics Data Export

> **Status:** Done
> **Epic:** [EP0007: Analytics & Reporting](../epics/EP0007-analytics-reporting.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 2
> **Completed:** 2026-01-21

## User Story

**As a** Darren (Homelab Operator)
**I want** to export metrics data as CSV or JSON
**So that** I can analyse it in spreadsheets or other tools

## Context

### Persona Reference

**Darren** - Occasionally wants to do deeper analysis in Excel/Google Sheets or share data with others.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

While the dashboard provides good visualisation, sometimes users want to export raw data for custom analysis, backup, or sharing. This story adds export functionality for any time range.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Dependency | Requires US0046 | Export uses tiered data |
| Scope | All time ranges | 24h, 7d, 30d, 12m exports |
| Format | Standard formats | CSV and JSON support |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Large exports without timeout | Streaming response for 12m data (AC6) |
| UX | Minimal friction | Single-click export with dropdown (AC1) |
| Compatibility | External tool support | CSV opens in Excel/Sheets (AC2) |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Export button available on server detail page

- **Given** I am on a server detail page
- **When** I view the Historical Metrics section
- **Then** I see an export button/dropdown

### AC2: Can export as CSV

- **Given** I click the export button
- **When** I select "CSV"
- **Then** a CSV file downloads with metrics for the selected time range

### AC3: Can export as JSON

- **Given** I click the export button
- **When** I select "JSON"
- **Then** a JSON file downloads with metrics for the selected time range

### AC4: Export respects current time range

- **Given** I have selected "30d" time range
- **When** I export data
- **Then** the export contains 30 days of data

### AC5: Export filename is descriptive

- **Given** I export data for server "mediaserver" for "30d"
- **When** the file downloads
- **Then** filename is like `mediaserver-metrics-30d-2026-01-18.csv`

### AC6: Export handles large datasets

- **Given** I export 12 months of raw data
- **When** the export runs
- **Then** it completes without timeout or browser freeze

## Scope

### In Scope

- Export button in Historical Metrics section
- CSV export format
- JSON export format
- Export for current time range selection
- Descriptive filenames
- Loading indicator during export

### Out of Scope

- Scheduled/automated exports
- Export all servers at once
- Custom date range picker
- Email delivery of exports
- Export to cloud storage (Google Drive, etc.)

## UI/UX Requirements

### Export Button

Located near the time range selector:

```
[ 24h ] [ 7d ] [ 30d ] [ 12m ]    [ Export v ]
                                      CSV
                                      JSON
```

### Export States

- **Idle:** "Export" button with dropdown arrow
- **Exporting:** "Exporting..." with spinner
- **Complete:** File downloads automatically

### CSV Format

```csv
timestamp,cpu_percent,memory_percent,disk_percent
2026-01-18T10:00:00Z,45.2,72.1,34.5
2026-01-18T10:01:00Z,46.1,72.3,34.5
```

For aggregate data (hourly/daily), include min/max:

```csv
timestamp,cpu_avg,cpu_min,cpu_max,memory_avg,memory_min,memory_max,disk_avg,disk_min,disk_max
2026-01-18T00:00:00Z,45.2,12.1,89.4,72.1,68.3,78.9,34.5,34.0,35.1
```

### JSON Format

```json
{
  "server_id": "mediaserver",
  "server_name": "Media Server",
  "range": "30d",
  "exported_at": "2026-01-18T15:30:00Z",
  "data_points": [
    {
      "timestamp": "2026-01-18T10:00:00Z",
      "cpu_percent": 45.2,
      "memory_percent": 72.1,
      "disk_percent": 34.5
    }
  ]
}
```

## Technical Notes

### Backend Endpoint

```python
@router.get("/{server_id}/metrics/export")
async def export_metrics(
    server_id: str,
    range: TimeRange = Query(...),
    format: Literal["csv", "json"] = Query(default="csv"),
) -> Response:
    # Query appropriate tier based on range
    # Format as CSV or JSON
    # Return with appropriate Content-Type and Content-Disposition
```

### Frontend Implementation

```typescript
async function exportMetrics(serverId: string, range: TimeRange, format: 'csv' | 'json') {
  const response = await fetch(
    `/api/v1/servers/${serverId}/metrics/export?range=${range}&format=${format}`
  );
  const blob = await response.blob();
  const filename = response.headers.get('Content-Disposition')?.split('filename=')[1];

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `metrics-${range}.${format}`;
  a.click();
}
```

**TRD Reference:** [SS4 API Design](../trd.md#4-api-design)

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No data for range | Export empty file with headers only |
| Very large export (12m raw) | Stream response; show progress |
| Network error during export | Show error toast with retry option |
| Server not found | Return 404 |

## Test Cases

| ID | AC | Test Description | Expected Result |
|----|----|--------------------|-----------------|
| TC1 | AC1 | Navigate to server detail page | Export button visible with dropdown |
| TC2 | AC2 | Select CSV export | Valid CSV file downloads |
| TC3 | AC3 | Select JSON export | Valid JSON file downloads |
| TC4 | AC4 | Set 30d range, then export | Export contains exactly 30 days of data |
| TC5 | AC5 | Export mediaserver for 30d | Filename matches `mediaserver-metrics-30d-YYYY-MM-DD.csv` |
| TC6 | AC6 | Export 12 months of data | Completes without timeout; file size reasonable |
| TC7 | Edge | Export with no data | Downloads file with headers only |
| TC8 | Edge | Network error during export | Error toast appears with retry option |

## Quality Checklist

### Code Quality

- [ ] Export endpoint handles all time ranges
- [ ] CSV format uses proper escaping
- [ ] JSON validates against schema
- [ ] Streaming enabled for large exports

### Testing

- [ ] Unit tests for CSV/JSON generation
- [ ] Integration test for export endpoint
- [ ] Performance test with 12-month data
- [ ] CSV tested in Excel and Google Sheets

### Documentation

- [ ] API endpoint documented
- [ ] Export format specification added

## Ready Status Gate

| Gate | Criteria | Status |
|------|----------|--------|
| AC Coverage | All ACs have test cases | Pending |
| Constraints | Inherited constraints addressed | Pending |
| Dependencies | US0046 complete | Pending |
| Technical | Endpoint and UI defined | Done |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0046: Tiered Data Retention | Story | Draft |
| US0007: Historical Metrics Charts | Story | Done |

## Estimation

**Story Points:** 2

**Complexity:** Low - Standard export functionality

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
