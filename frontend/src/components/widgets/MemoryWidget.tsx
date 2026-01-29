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
import { MemoryStick } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import { getSparklineData, type SparklinePeriod } from '../../api/metrics';
import { getMetricsHistory } from '../../api/servers';
import type { WidgetProps } from './types';

/**
 * Memory widget time range options.
 */
type MemoryTimeRange = '1h' | '6h' | '24h';

const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

interface MemoryWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
}

/**
 * Get colour based on memory percentage with thresholds.
 * - < 70%: Green (healthy)
 * - 70-85%: Amber (warning)
 * - > 85%: Red (critical)
 */
function getMemoryColour(value: number): { text: string; stroke: string } {
  if (value >= 85) {
    return { text: 'text-status-error', stroke: '#F87171' };
  }
  if (value >= 70) {
    return { text: 'text-status-warning', stroke: '#FBBF24' };
  }
  return { text: 'text-status-success', stroke: '#4ADE80' };
}

/**
 * Format memory in human-readable form.
 */
function formatMemory(mb: number | null): string {
  if (mb === null) return '--';
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

/**
 * Format timestamp for chart X-axis.
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Time range selector for Memory widget.
 */
function MemoryTimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: MemoryTimeRange;
  onChange: (range: MemoryTimeRange) => void;
  disabled?: boolean;
}) {
  const ranges: { value: MemoryTimeRange; label: string }[] = [
    { value: '1h', label: '1h' },
    { value: '6h', label: '6h' },
    { value: '24h', label: '24h' },
  ];

  return (
    <div className="flex gap-1" data-testid="memory-time-range-selector">
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
          data-testid={`memory-range-${range.value}`}
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
  memory_percent: number | null;
}

interface TooltipPayloadEntry {
  value: number | null;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function MemoryTooltip({ active, payload }: CustomTooltipProps) {
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
      <p className="text-sm font-medium" style={{ color: '#4ADE80' }}>
        Memory: {payload[0].value !== null ? `${payload[0].value}%` : '--'}
      </p>
    </div>
  );
}

/**
 * Memory Usage Widget
 *
 * Displays current memory usage with gauge, historical chart, and time range selector.
 * Auto-refreshes every 60 seconds.
 */
export function MemoryWidget({ machine, isEditMode = false, onRemove }: MemoryWidgetProps) {
  const [timeRange, setTimeRange] = useState<MemoryTimeRange>('1h');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metrics = machine.latest_metrics;
  const memoryPercent = metrics?.memory_percent ?? null;
  const memoryUsedMb = metrics?.memory_used_mb ?? null;
  const memoryTotalMb = metrics?.memory_total_mb ?? null;
  const colour = memoryPercent !== null ? getMemoryColour(memoryPercent) : null;

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
            memory_percent: point.memory_percent,
          }))
        );
      } else {
        // Use sparkline API for 1h/6h
        const period: SparklinePeriod = timeRange as SparklinePeriod;
        const response = await getSparklineData(machine.id, 'memory_percent', period);
        setChartData(
          response.data.map((point) => ({
            timestamp: point.timestamp,
            displayTime: formatTime(point.timestamp),
            memory_percent: point.value,
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
  const normalizedValue = memoryPercent !== null ? Math.min(100, Math.max(0, memoryPercent)) : 0;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  // Stale indicator for offline machines
  const isStale = machine.status === 'offline';

  return (
    <WidgetContainer
      title="Memory Usage"
      icon={<MemoryStick className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {/* Top section: Gauge and info */}
        <div className="mb-3 flex items-start gap-4">
          {/* Memory Gauge */}
          <div
            className="relative flex-shrink-0"
            style={{ width: gaugeSize, height: gaugeSize }}
            role="meter"
            aria-valuenow={memoryPercent !== null ? normalizedValue : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Memory: ${memoryPercent !== null ? `${normalizedValue.toFixed(0)}%` : 'No data'}`}
            data-testid="memory-gauge"
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
                data-testid="memory-value"
              >
                {memoryPercent !== null ? `${normalizedValue.toFixed(0)}%` : '--'}
              </span>
            </div>
          </div>

          {/* Memory Info */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-text-primary" data-testid="memory-used-total">
              {formatMemory(memoryUsedMb)} / {formatMemory(memoryTotalMb)}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Used / Total
            </div>
            {isStale && (
              <div className="mt-1 text-xs text-status-warning" data-testid="stale-indicator">
                Last known value (offline)
              </div>
            )}
          </div>

          {/* Time range selector */}
          <MemoryTimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            disabled={isLoading}
          />
        </div>

        {/* Chart section */}
        <div className="flex-1" style={{ minHeight: 120 }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center" data-testid="memory-chart-loading">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-status-error" data-testid="memory-chart-error">
              {error}
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary" data-testid="memory-chart-empty">
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
                <Tooltip content={<MemoryTooltip />} />
                <Line
                  type="monotone"
                  dataKey="memory_percent"
                  name="Memory"
                  stroke="#4ADE80"
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
