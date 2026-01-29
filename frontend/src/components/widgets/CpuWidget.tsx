import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Cpu } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import { getSparklineData, type SparklinePeriod } from '../../api/metrics';
import { getMetricsHistory } from '../../api/servers';
import type { WidgetProps } from './types';

/**
 * CPU widget time range options.
 * Maps to either sparkline API (1h, 6h) or metrics history API (24h).
 */
type CpuTimeRange = '1h' | '6h' | '24h';

const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

interface CpuWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
}

/**
 * Get colour based on CPU percentage with CPU-specific thresholds.
 * - < 50%: Green (healthy)
 * - 50-80%: Amber (moderate load)
 * - > 80%: Red (high load)
 */
function getCpuColour(value: number): { text: string; stroke: string } {
  if (value >= 80) {
    return { text: 'text-status-error', stroke: '#F87171' };
  }
  if (value >= 50) {
    return { text: 'text-status-warning', stroke: '#FBBF24' };
  }
  return { text: 'text-status-success', stroke: '#4ADE80' };
}

/**
 * Format timestamp for chart X-axis.
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Time range selector for CPU widget.
 */
function CpuTimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: CpuTimeRange;
  onChange: (range: CpuTimeRange) => void;
  disabled?: boolean;
}) {
  const ranges: { value: CpuTimeRange; label: string }[] = [
    { value: '1h', label: '1h' },
    { value: '6h', label: '6h' },
    { value: '24h', label: '24h' },
  ];

  return (
    <div className="flex gap-1" data-testid="cpu-time-range-selector">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          disabled={disabled}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium transition-colors',
            value === range.value
              ? 'bg-status-info text-white'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          data-testid={`cpu-range-${range.value}`}
          aria-pressed={value === range.value}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

interface ChartDataPoint {
  timestamp: string;
  displayTime: string;
  cpu_percent: number | null;
}

interface TooltipPayloadEntry {
  value: number | null;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function CpuTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const dataPoint = payload[0].payload;
  const date = new Date(dataPoint.timestamp);
  const formattedDate = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded border border-border-default bg-bg-primary p-2 shadow-lg">
      <p className="mb-1 text-xs text-text-secondary">{formattedDate}</p>
      <p className="text-sm font-medium" style={{ color: '#22D3EE' }}>
        CPU: {payload[0].value !== null ? `${payload[0].value}%` : '--'}
      </p>
    </div>
  );
}

/**
 * CPU Usage Widget
 *
 * Displays current CPU percentage with gauge, historical chart, and time range selector.
 * Auto-refreshes every 60 seconds.
 */
export function CpuWidget({ machine, isEditMode = false, onRemove }: CpuWidgetProps) {
  const [timeRange, setTimeRange] = useState<CpuTimeRange>('1h');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metrics = machine.latest_metrics;
  const cpuPercent = metrics?.cpu_percent ?? null;
  const colour = cpuPercent !== null ? getCpuColour(cpuPercent) : null;

  // Fetch historical data
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (timeRange === '24h') {
        // Use metrics history API for 24h
        const response = await getMetricsHistory(machine.id, '24h');
        setChartData(
          response.data_points.map((point) => ({
            timestamp: point.timestamp,
            displayTime: formatTime(point.timestamp),
            cpu_percent: point.cpu_percent,
          }))
        );
      } else {
        // Use sparkline API for 1h/6h
        const period: SparklinePeriod = timeRange as SparklinePeriod;
        const response = await getSparklineData(machine.id, 'cpu_percent', period);
        setChartData(
          response.data.map((point) => ({
            timestamp: point.timestamp,
            displayTime: formatTime(point.timestamp),
            cpu_percent: point.value,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [machine.id, timeRange]);

  // Initial fetch and polling
  useEffect(() => {
    fetchHistory();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHistory, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Gauge dimensions
  const gaugeSize = 100;
  const strokeWidth = 8;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = gaugeSize / 2;
  const normalizedValue = cpuPercent !== null ? Math.min(100, Math.max(0, cpuPercent)) : 0;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  // Stale indicator for offline machines
  const isStale = machine.status === 'offline';

  return (
    <WidgetContainer
      title="CPU Usage"
      icon={<Cpu className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {/* Top section: Gauge and info */}
        <div className="mb-3 flex items-start gap-4">
          {/* CPU Gauge */}
          <div
            className="relative flex-shrink-0"
            style={{ width: gaugeSize, height: gaugeSize }}
            role="meter"
            aria-valuenow={cpuPercent !== null ? normalizedValue : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`CPU: ${cpuPercent !== null ? `${normalizedValue.toFixed(0)}%` : 'No data'}`}
            data-testid="cpu-gauge"
          >
            <svg
              width={gaugeSize}
              height={gaugeSize}
              className="transform -rotate-90"
            >
              {/* Background track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-bg-tertiary"
              />
              {/* Value arc */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={colour?.stroke ?? '#6E7681'}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            {/* Centre value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn('font-mono text-xl font-bold', colour?.text ?? 'text-text-muted')}
                data-testid="cpu-value"
              >
                {cpuPercent !== null ? `${normalizedValue.toFixed(0)}%` : '--'}
              </span>
            </div>
          </div>

          {/* CPU Info */}
          <div className="min-w-0 flex-1">
            <div className="text-sm text-text-secondary" data-testid="cpu-model">
              {machine.cpu_model ?? 'Unknown CPU'}
            </div>
            <div className="text-xs text-text-muted" data-testid="cpu-cores">
              {machine.cpu_cores !== null ? `${machine.cpu_cores} cores` : 'Unknown cores'}
            </div>
            {isStale && (
              <div className="mt-1 text-xs text-status-warning" data-testid="stale-indicator">
                Last known value (offline)
              </div>
            )}
          </div>

          {/* Time range selector */}
          <CpuTimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            disabled={isLoading}
          />
        </div>

        {/* Chart section */}
        <div className="flex-1" style={{ minHeight: 120 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center" data-testid="cpu-chart-loading">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-status-error" data-testid="cpu-chart-error">
              {error}
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary" data-testid="cpu-chart-empty">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#161B22"
                  vertical={false}
                />
                <XAxis
                  dataKey="displayTime"
                  tick={{ fill: '#C9D1D9', fontSize: 10 }}
                  tickLine={{ stroke: '#161B22' }}
                  axisLine={{ stroke: '#161B22' }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#C9D1D9', fontSize: 10 }}
                  tickLine={{ stroke: '#161B22' }}
                  axisLine={{ stroke: '#161B22' }}
                  tickFormatter={(value) => `${value}%`}
                  width={35}
                />
                <Tooltip content={<CpuTooltip />} />
                <Line
                  type="monotone"
                  dataKey="cpu_percent"
                  name="CPU"
                  stroke="#22D3EE"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </WidgetContainer>
  );
}
