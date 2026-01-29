import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Activity } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import { getSparklineData, type SparklinePeriod } from '../../api/metrics';
import type { WidgetProps } from './types';

interface LoadAverageWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
}

/**
 * Get colour based on load relative to core count.
 * - < 1x cores: Green (healthy)
 * - 1x-2x cores: Amber (moderate load)
 * - > 2x cores: Red (overloaded)
 */
function getLoadColour(load: number, cores: number): string {
  const ratio = load / cores;
  if (ratio >= 2) {
    return 'text-status-error';
  }
  if (ratio >= 1) {
    return 'text-status-warning';
  }
  return 'text-status-success';
}

/**
 * Format load value with consistent precision.
 */
function formatLoad(value: number | null): string {
  if (value === null) return '--';
  return value.toFixed(2);
}

/**
 * Format load as percentage of core count.
 */
function formatLoadPercent(load: number | null, cores: number | null): string {
  if (load === null || cores === null || cores === 0) return '';
  const percent = (load / cores) * 100;
  return `${percent.toFixed(0)}%`;
}

interface ChartDataPoint {
  timestamp: string;
  displayTime: string;
  load: number | null;
}

/**
 * Load Average Widget
 *
 * Displays 1, 5, and 15 minute load averages with percentage relative to core count.
 * Includes colour-coded overload indication and a trend line.
 */
export function LoadAverageWidget({
  machine,
  isEditMode = false,
  onRemove,
}: LoadAverageWidgetProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const metrics = machine.latest_metrics;
  const cores = machine.cpu_cores ?? null;

  // Fetch 30-minute trend for 1-minute load
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      // Note: We don't have a load sparkline API, so we'll just show the current values
      // In a real implementation, you'd fetch load_1m sparkline data
      // For now, simulate with empty data to show the chart structure
      const period: SparklinePeriod = '30m';
      const response = await getSparklineData(machine.id, 'cpu_percent', period);
      // Since we don't have load sparkline, we'll approximate from CPU data
      // In reality, you'd want a dedicated load_average sparkline endpoint
      setChartData(
        response.data.map((point) => ({
          timestamp: point.timestamp,
          displayTime: new Date(point.timestamp).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          // Approximate load from CPU percent (this is just for visual representation)
          load: point.value !== null && cores ? (point.value / 100) * cores : null,
        }))
      );
    } catch {
      // Silent fail for trend line - not critical
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [machine.id, cores]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const loadValues = [
    { label: '1 min', value: metrics?.load_1m ?? null, testId: 'load-1m' },
    { label: '5 min', value: metrics?.load_5m ?? null, testId: 'load-5m' },
    { label: '15 min', value: metrics?.load_15m ?? null, testId: 'load-15m' },
  ];

  return (
    <WidgetContainer
      title="Load Average"
      icon={<Activity className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {/* Load values */}
        <div className="mb-2 flex justify-around">
          {loadValues.map(({ label, value, testId }) => {
            const colour = value !== null && cores !== null
              ? getLoadColour(value, cores)
              : 'text-text-primary';

            return (
              <div key={testId} className="text-center">
                <div
                  className={cn('font-mono text-xl font-bold', colour)}
                  data-testid={testId}
                >
                  {formatLoad(value)}
                </div>
                <div className="text-xs text-text-secondary">{label}</div>
                {cores !== null && value !== null && (
                  <div
                    className={cn('text-xs font-medium', colour)}
                    data-testid={`${testId}-percent`}
                  >
                    {formatLoadPercent(value, cores)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Core count reference */}
        {cores !== null && (
          <div className="mb-2 text-center text-xs text-text-muted" data-testid="core-count">
            {cores} CPU cores
          </div>
        )}

        {/* Trend chart */}
        <div className="flex-1" style={{ minHeight: 60 }}>
          {!isLoading && chartData.length > 0 && cores !== null && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
              >
                <XAxis dataKey="displayTime" hide />
                <YAxis
                  domain={[0, 'auto']}
                  hide
                />
                {/* Reference line at core count */}
                <ReferenceLine
                  y={cores}
                  stroke="#6E7681"
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotone"
                  dataKey="load"
                  stroke="#22D3EE"
                  strokeWidth={1.5}
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
