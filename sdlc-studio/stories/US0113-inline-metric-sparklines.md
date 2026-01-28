# US0113: Inline Metric Sparklines

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Completed:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to see CPU usage trends as sparklines on server cards
**So that** I can identify if a server's load is increasing or decreasing at a glance

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Wants to see trends without clicking into detail pages for every server.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, server cards show only the current metric value (e.g., "CPU: 45%"). This doesn't indicate if the value is trending up (potential problem) or down (recovering). Market leaders like Netdata and Grafana show mini sparkline charts on summary cards. This story adds CPU trend sparklines to server cards.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Performance | Dashboard load <3s | Sparkline data must be efficiently fetched |
| PRD | Performance | Minimal polling overhead | Use dedicated lightweight endpoint |
| TRD | Architecture | Recharts already in stack | Use existing charting library |

---

## Acceptance Criteria

### AC1: Backend sparkline endpoint

- **Given** a server has metric history
- **When** I call `GET /api/v1/servers/{id}/metrics/sparkline?metric=cpu&period=30m`
- **Then** the response returns an array of {timestamp, value} pairs
- **And** the data covers the last 30 minutes
- **And** the data is sampled to ~30 points (1 per minute)

### AC2: CPU sparkline on server card

- **Given** a server card is rendered
- **When** the dashboard loads
- **Then** a small sparkline chart (60px wide x 20px tall) appears on the card
- **And** the sparkline shows CPU usage trend for the last 30 minutes
- **And** the sparkline uses a subtle colour (grey or blue)

### AC3: Sparkline tooltip

- **Given** a sparkline is displayed on a card
- **When** the user hovers over the sparkline
- **Then** a tooltip shows the value at that point (e.g., "45% at 10:23")
- **And** the tooltip follows the cursor along the sparkline

### AC4: Sparkline colour indicates trend

- **Given** the CPU trend over 30 minutes
- **When** the sparkline renders
- **Then** the sparkline colour reflects the trend:
  - Green: trending down (good)
  - Grey: stable (within 5% variance)
  - Red/amber: trending up (concerning)

### AC5: Handle missing data

- **Given** a server has insufficient metric history (<5 minutes)
- **When** the sparkline attempts to render
- **Then** a placeholder shows "No trend data" or a flat line
- **And** no error is thrown

### AC6: Batch fetch for dashboard

- **Given** the dashboard displays 10+ servers
- **When** the dashboard loads
- **Then** sparkline data is fetched efficiently (batch request or parallel)
- **And** sparklines render progressively (don't block card display)

---

## Scope

### In Scope

- Backend endpoint for sparkline data
- CPU, RAM, and Disk sparklines on server cards
- Trend-based colour coding
- Hover tooltip with value/time
- Efficient data fetching for multiple servers
- Graceful handling of missing data

### Out of Scope

- Sparkline on detail page (already has full charts)
- Configurable time period (default 30m)
- Sparkline click to expand
- Historical trend comparison

---

## Technical Notes

### Implementation Approach

1. **Backend endpoint (metrics.py):**
   ```python
   @router.get("/servers/{server_id}/metrics/sparkline")
   async def get_sparkline(
       server_id: UUID,
       metric: str = "cpu_usage",
       period: str = "30m",
       db: Session = Depends(get_db)
   ):
       # Parse period (30m, 1h, etc.)
       since = datetime.utcnow() - timedelta(minutes=30)

       # Query metrics, sample to ~30 points
       metrics = db.query(Metric).filter(
           Metric.server_id == server_id,
           Metric.metric_type == metric,
           Metric.timestamp >= since
       ).order_by(Metric.timestamp).all()

       # Downsample if needed
       sampled = downsample(metrics, target_points=30)

       return {
           "server_id": server_id,
           "metric": metric,
           "period": period,
           "data": [{"timestamp": m.timestamp, "value": m.value} for m in sampled]
       }
   ```

2. **Frontend MetricSparkline component:**
   ```tsx
   function MetricSparkline({ serverId, metric = "cpu_usage" }) {
     const { data, isLoading } = useSparklineData(serverId, metric);

     if (isLoading) return <SparklineSkeleton />;
     if (!data?.length || data.length < 5) return <span className="text-xs text-gray-400">No trend</span>;

     const trend = calculateTrend(data);
     const color = trend > 5 ? "red" : trend < -5 ? "green" : "gray";

     return (
       <ResponsiveContainer width={60} height={20}>
         <LineChart data={data}>
           <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1} />
           <Tooltip content={<SparklineTooltip />} />
         </LineChart>
       </ResponsiveContainer>
     );
   }
   ```

3. **Batch fetching strategy:**
   - Option A: Single endpoint with multiple server IDs
   - Option B: Parallel requests with rate limiting
   - Recommend Option B for simplicity (fetch in useEffect per card)

### API Contracts

**Request:** `GET /api/v1/servers/{server_id}/metrics/sparkline?metric=cpu_usage&period=30m`

**Response:**
```json
{
  "server_id": "uuid",
  "metric": "cpu_usage",
  "period": "30m",
  "data": [
    { "timestamp": "2026-01-28T10:00:00Z", "value": 42.5 },
    { "timestamp": "2026-01-28T10:01:00Z", "value": 43.2 }
  ]
}
```

### Files to Modify

- `backend/src/homelab_cmd/api/routes/metrics.py` - Add sparkline endpoint
- `backend/src/homelab_cmd/api/schemas/metrics.py` - Add sparkline schema
- `frontend/src/components/MetricSparkline.tsx` - New component
- `frontend/src/components/ServerCard.tsx` - Add sparkline
- `frontend/src/api/metrics.ts` - Add sparkline API call
- `frontend/src/hooks/useSparklineData.ts` - Custom hook

### Data Requirements

- Metric model with server_id, metric_type, value, timestamp
- Sufficient metric history (heartbeats with CPU data)
- Metrics stored at reasonable frequency (every 30s-1m)

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Server has no metrics | Show "No trend data" text |
| 2 | Server has <5 data points | Show flat line or "Insufficient data" |
| 3 | Metric values are all identical | Show flat grey line (stable) |
| 4 | API request fails | Show error icon, don't break card |
| 5 | Server offline (no recent metrics) | Show last known trend, greyed out |
| 6 | Very high variance (0-100% swings) | Cap sparkline scale to 0-100 |
| 7 | 50+ servers on dashboard | Rate limit requests, lazy load below fold |
| 8 | Negative trend calculation | Clamp to -100% to +100% |

---

## Test Scenarios

- [x] API returns sparkline data for valid server
- [x] API returns 404 for unknown server
- [x] API handles missing metric type
- [x] Sparkline renders on server card
- [x] Sparkline shows tooltip on hover
- [x] Green sparkline for downward trend
- [x] Red sparkline for upward trend
- [x] Grey sparkline for stable trend
- [x] "No trend data" for insufficient points
- [x] Multiple sparklines load efficiently
- [x] Dark mode renders correctly

---

## Dependencies

### Story Dependencies

None - independent implementation.

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Recharts | Library | Available |
| Metric history data | Data | Available (via heartbeats) |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - new API endpoint + chart component

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0017 |
