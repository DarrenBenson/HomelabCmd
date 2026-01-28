# US0113: Inline Metric Sparklines

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** to see metric trends at a glance on server cards
**So that** I can identify servers with increasing resource usage without opening detail pages

## Context

### Persona Reference
**System Administrator** - Monitors homelab infrastructure, needs to spot trends quickly
[Full persona details](../personas.md#system-administrator)

### Background

The current ServerCard displays point-in-time CPU, RAM, and Disk percentages. This tells you the current state but not whether the value is trending up, down, or stable. A server at 70% CPU might be fine (steady state) or concerning (rapidly increasing).

Sparklines are miniature inline charts that show trend direction at a glance. Market leaders like Grafana, Datadog, and Netdata all use sparklines or mini-charts to provide trend context. Adding a small 7-point sparkline for CPU usage will help administrators quickly identify servers that need attention.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| PRD | Performance | Dashboard <3s load | Sparkline data must be efficient (<50 bytes per server) |
| TRD | Architecture | Recharts already installed | Use existing charting library |
| Epic | Accessibility | WCAG 2.1 AA | Screen reader must announce trend direction |

---

## Acceptance Criteria

### AC1: CPU Sparkline Display
- **Given** a server with metric history
- **When** the ServerCard is rendered
- **Then** a 7-point sparkline appears next to the CPU percentage showing the last 30 minutes (5-minute intervals)

### AC2: Trend Colour Coding
- **Given** a CPU sparkline
- **When** the trend is stable or decreasing
- **Then** the sparkline is green
- **When** the trend is rising (>10% increase over period)
- **Then** the sparkline is yellow
- **When** the value is high (>80%) AND rising
- **Then** the sparkline is red

### AC3: Hover Tooltip
- **Given** a CPU sparkline
- **When** I hover over a data point
- **Then** a tooltip shows the actual value and timestamp (e.g., "75% at 14:25")

### AC4: Graceful Degradation
- **Given** a server with insufficient history (<7 data points)
- **When** the sparkline is rendered
- **Then** it shows available points (partial line) or falls back to just the percentage

### AC5: Sparkline Size
- **Given** the ServerCard layout
- **When** the sparkline is displayed
- **Then** it measures approximately 50x16 pixels (compact, inline with percentage)

### AC6: Backend Sparkline Endpoint
- **Given** `GET /api/v1/servers/{id}/metrics/sparkline?metric=cpu`
- **When** called
- **Then** returns an array of 7 values representing 5-minute aggregates over 30 minutes
- **And** response is under 100 bytes per server

---

## Scope

### In Scope
- CPU sparkline on ServerCard (one metric to start)
- Colour-coded trend indication
- Hover tooltips with values
- Backend endpoint for sparkline data
- Graceful handling of missing data

### Out of Scope
- RAM and Disk sparklines (future story)
- Customisable time ranges
- Sparkline click-to-expand
- Historical sparkline view (scrollable)

---

## Technical Notes

### Backend Implementation

Create sparkline endpoint in `backend/src/homelab_cmd/api/routes/metrics.py`:

```python
@router.get("/servers/{server_id}/metrics/sparkline")
async def get_sparkline(
    server_id: UUID,
    metric: str = Query(default="cpu", enum=["cpu", "memory", "disk"]),
    db: Session = Depends(get_db),
    _: str = Depends(require_api_key),
) -> SparklineResponse:
    """Get 7-point sparkline data for last 30 minutes (5-minute intervals)."""
    now = datetime.utcnow()
    thirty_mins_ago = now - timedelta(minutes=30)

    # Get metrics, aggregate by 5-minute buckets
    metrics = db.query(Metric).filter(
        Metric.server_id == server_id,
        Metric.metric_type == f"{metric}_usage",
        Metric.timestamp >= thirty_mins_ago,
    ).order_by(Metric.timestamp).all()

    # Bucket into 5-minute intervals
    buckets = aggregate_to_buckets(metrics, interval_minutes=5, num_buckets=7)

    return SparklineResponse(
        server_id=server_id,
        metric=metric,
        values=buckets,  # [72.5, 74.1, 73.8, 75.2, 78.4, 82.1, 85.3]
        interval_minutes=5,
    )
```

### Schema

```python
class SparklineResponse(BaseModel):
    server_id: UUID
    metric: str
    values: list[float | None]  # None for missing data points
    interval_minutes: int = 5
```

### Frontend Implementation

Use Recharts (already installed) for sparklines:

```tsx
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines';
// OR use Recharts directly:
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricSparklineProps {
  values: (number | null)[];
  current: number;
}

function MetricSparkline({ values, current }: MetricSparklineProps) {
  // Calculate trend
  const first = values.find(v => v !== null) ?? current;
  const last = current;
  const change = last - first;
  const isRising = change > 10;
  const isHigh = current > 80;

  const colour = isHigh && isRising ? '#ef4444' // red
    : isRising ? '#eab308' // yellow
    : '#22c55e'; // green

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-sm font-mono">{current}%</span>
      <div className="w-[50px] h-[16px]">
        <ResponsiveContainer>
          <LineChart data={values.map((v, i) => ({ value: v }))}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={colour}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### Data Fetching Strategy

**Option A: Batch with server list** (preferred for performance)
- Add `sparkline` field to server list response
- Single API call, slightly larger payload

**Option B: Individual requests**
- Fetch sparklines separately per server
- More API calls, but simpler caching

Recommended: Option A - batch with server list to minimise round trips.

### Caching

Cache sparkline data for 5 minutes (matches aggregation interval):

```python
# In-memory cache or Redis
@cache(ttl=300)  # 5 minutes
def get_sparkline_data(server_id: UUID, metric: str) -> list[float]:
    ...
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server with no metrics yet | Show percentage only, no sparkline |
| Server with <7 data points | Show partial sparkline with available points |
| Metrics gap (server was offline) | Show null points as gaps in line |
| All 7 values are identical | Show flat green line (stable) |
| Rapid spike (0% to 100%) | Show red line with steep slope |
| API error fetching sparkline | Fall back to percentage only, log error |
| Sparkline data stale (>5 min old) | Fetch fresh on next poll |

---

## Test Scenarios

- [ ] Verify sparkline appears for server with metric history
- [ ] Verify green colour for stable/decreasing trend
- [ ] Verify yellow colour for rising trend (<80%)
- [ ] Verify red colour for high + rising trend
- [ ] Verify hover tooltip shows value and time
- [ ] Verify graceful handling of missing data points
- [ ] Verify partial sparkline with <7 points
- [ ] Verify no sparkline for server with no history
- [ ] Verify sparkline endpoint returns 7 values
- [ ] Verify sparkline data is cached (5-min TTL)
- [ ] Verify accessibility: trend direction announced

---

## Dependencies

### Story Dependencies

None - uses existing metrics data

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Recharts | Library | Available |
| Metrics table with CPU data | Data | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium (backend endpoint, frontend visualisation, caching)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
