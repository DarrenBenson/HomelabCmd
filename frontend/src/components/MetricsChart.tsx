import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MetricPoint, TimeRange } from '../types/server';

interface MetricsChartProps {
  data: MetricPoint[];
  timeRange: TimeRange;
  loading?: boolean;
}

// Time range to hours for comparison
const RANGE_HOURS: Record<TimeRange, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
  '12m': 365 * 24,
};

// Format duration in human-readable form
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months > 0) {
    const remainingDays = days % 30;
    if (remainingDays > 7) {
      return `${months} month${months !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

// Brand colours
const COLORS = {
  cpu: '#22D3EE', // Terminal Cyan
  memory: '#4ADE80', // Green
  disk: '#FBBF24', // Amber
  grid: '#161B22', // Console Grey
  axis: '#C9D1D9', // Soft White
};

function formatTimestamp(timestamp: string, resolution: string): string {
  const date = new Date(timestamp);

  // For 24h view (1m resolution), show time only
  if (resolution === '1m' || resolution === '24h') {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // For 12m view (1d resolution), show day and month only
  if (resolution === '1d' || resolution === '12m') {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  }

  // For 7d and 30d views, show day and time
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DataPoint {
  timestamp: string;
  displayTime: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
}

interface PayloadEntry {
  dataKey: string;
  name: string;
  value: number | null;
  color: string;
  payload: DataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: PayloadEntry[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Access the original timestamp from the data point
  const dataPoint = payload[0].payload as DataPoint;
  const date = new Date(dataPoint.timestamp);
  const formattedDate = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="rounded border border-border-default bg-bg-primary p-3 shadow-lg"
      data-testid="chart-tooltip"
    >
      <p className="mb-2 text-sm text-text-secondary">{formattedDate}</p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="text-sm"
          style={{ color: entry.color }}
        >
          {entry.name}: {entry.value !== null ? `${entry.value}%` : '--'}
        </p>
      ))}
    </div>
  );
}

export function MetricsChart({ data, timeRange, loading = false }: MetricsChartProps) {
  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center"
        data-testid="chart-loading"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="flex h-64 items-center justify-center text-text-secondary"
        data-testid="chart-empty"
      >
        No data available for this period
      </div>
    );
  }

  // Calculate actual data span
  const firstTs = new Date(data[0].timestamp).getTime();
  const lastTs = new Date(data[data.length - 1].timestamp).getTime();
  const dataSpanMs = lastTs - firstTs;
  const dataSpanHours = dataSpanMs / (1000 * 60 * 60);
  const requestedHours = RANGE_HOURS[timeRange];

  // Show message if data span is less than requested range
  const isPartialData = dataSpanHours < requestedHours * 0.9; // 90% threshold
  const dataMessage = isPartialData
    ? timeRange === '24h'
      ? `${formatDuration(dataSpanMs)} of data collected`
      : `Building history... ${formatDuration(dataSpanMs)} collected`
    : null;

  // Determine resolution for tick formatting based on time range
  // 24h -> 1m (raw data), 7d -> 1h (hourly), 30d -> 1h (hourly table), 12m -> 1d (daily table)
  const resolution =
    timeRange === '24h' ? '1m' : timeRange === '7d' ? '1h' : timeRange === '30d' ? '1h' : '1d';

  // Format data with display timestamps for X axis (auto-scales to fit data)
  const chartData = data.map((point) => ({
    ...point,
    displayTime: formatTimestamp(point.timestamp, resolution),
  }));

  return (
    <div data-testid="metrics-chart">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLORS.grid}
              vertical={false}
            />
            <XAxis
              dataKey="displayTime"
              tick={{ fill: COLORS.axis, fontSize: 11 }}
              tickLine={{ stroke: COLORS.grid }}
              axisLine={{ stroke: COLORS.grid }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: COLORS.axis, fontSize: 11 }}
              tickLine={{ stroke: COLORS.grid }}
              axisLine={{ stroke: COLORS.grid }}
              tickFormatter={(value) => `${value}%`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="cpu_percent"
              name="CPU"
              stroke={COLORS.cpu}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="memory_percent"
              name="Memory"
              stroke={COLORS.memory}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="disk_percent"
              name="Disk"
              stroke={COLORS.disk}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {dataMessage && (
        <p className="mt-2 text-center text-sm text-text-muted" data-testid="data-coverage-message">
          {dataMessage}
        </p>
      )}
    </div>
  );
}
