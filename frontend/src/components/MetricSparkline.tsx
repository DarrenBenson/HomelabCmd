/**
 * US0113: Inline metric sparkline component for server cards.
 *
 * Displays a small sparkline chart showing CPU trend over the last 30 minutes.
 * Colour indicates trend direction: green (down), grey (stable), amber (up).
 */

import { useState, useEffect } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer, YAxis } from 'recharts';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { getSparklineData } from '../api/metrics';
import type { SparklinePoint, SparklineMetric, SparklinePeriod } from '../api/metrics';

interface MetricSparklineProps {
  /** Server ID to fetch sparkline data for */
  serverId: string;
  /** Metric type (default: cpu_percent) */
  metric?: SparklineMetric;
  /** Time period (default: 30m) */
  period?: SparklinePeriod;
  /** Whether the server is offline (greyed styling) */
  isOffline?: boolean;
}

// Trend colours
const COLORS = {
  up: '#F59E0B', // Amber - concerning (usage increasing)
  stable: '#6B7280', // Grey - neutral
  down: '#4ADE80', // Green - good (usage decreasing)
  offline: '#4B5563', // Darker grey for offline servers
};

// Minimum data points needed for a meaningful sparkline
const MIN_DATA_POINTS = 5;

// Trend threshold (percentage difference to consider "stable")
const TREND_THRESHOLD = 5;

/**
 * Calculate the trend direction from data points.
 *
 * Compares average of first half vs second half of data.
 * Returns a percentage change clamped to [-100, 100].
 */
function calculateTrend(data: SparklinePoint[]): number {
  if (data.length < MIN_DATA_POINTS) return 0;

  // Filter out null values
  const validPoints = data.filter((p) => p.value !== null) as Array<{ value: number; timestamp: string }>;
  if (validPoints.length < MIN_DATA_POINTS) return 0;

  const mid = Math.floor(validPoints.length / 2);
  const firstHalf = validPoints.slice(0, mid);
  const secondHalf = validPoints.slice(mid);

  const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

  if (firstAvg === 0) return secondAvg > 0 ? 100 : 0;

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  return Math.max(-100, Math.min(100, change));
}

/**
 * Get trend colour based on calculated trend.
 */
function getTrendColor(trend: number, isOffline: boolean): string {
  if (isOffline) return COLORS.offline;
  if (trend > TREND_THRESHOLD) return COLORS.up;
  if (trend < -TREND_THRESHOLD) return COLORS.down;
  return COLORS.stable;
}

/**
 * Custom tooltip for sparkline hover.
 */
function SparklineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { timestamp: string; value: number | null } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  if (point.value === null) return null;

  const date = new Date(point.timestamp);
  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-bg-primary border border-border-default rounded px-2 py-1 text-xs shadow-lg">
      <span className="font-mono text-text-primary">{point.value.toFixed(1)}%</span>
      <span className="text-text-tertiary ml-1">at {timeStr}</span>
    </div>
  );
}

/**
 * Inline metric sparkline for server cards.
 *
 * Shows a 60x20px chart with CPU trend data and colour-coded trend direction.
 */
export function MetricSparkline({
  serverId,
  metric = 'cpu_percent',
  period = '30m',
  isOffline = false,
}: MetricSparklineProps) {
  const [data, setData] = useState<SparklinePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await getSparklineData(serverId, metric, period);
        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sparkline');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [serverId, metric, period]);

  // Loading state - skeleton
  if (loading) {
    return (
      <div
        className="w-[60px] h-[20px] bg-bg-tertiary rounded animate-pulse"
        data-testid="sparkline-loading"
        aria-label="Loading sparkline"
      />
    );
  }

  // Error state - show dash
  if (error) {
    return (
      <div
        className="w-[60px] h-[20px] flex items-center justify-center text-text-tertiary"
        data-testid="sparkline-error"
        title={error}
      >
        <Minus className="w-4 h-4" aria-label="Sparkline unavailable" />
      </div>
    );
  }

  // Insufficient data - show message
  if (!data || data.length < MIN_DATA_POINTS) {
    return (
      <div
        className="w-[60px] h-[20px] flex items-center justify-center"
        data-testid="sparkline-no-data"
      >
        <span className="text-[9px] text-text-tertiary">No trend</span>
      </div>
    );
  }

  // Calculate trend and colour
  const trend = calculateTrend(data);
  const color = getTrendColor(trend, isOffline);

  // Prepare chart data (convert timestamps to display format)
  const chartData = data.map((point) => ({
    timestamp: point.timestamp,
    value: point.value,
  }));

  return (
    <div
      className="flex items-center gap-1"
      data-testid="sparkline-container"
      aria-label={`CPU trend sparkline: ${trend > TREND_THRESHOLD ? 'increasing' : trend < -TREND_THRESHOLD ? 'decreasing' : 'stable'}`}
    >
      <div className="w-[60px] h-[20px]" data-testid="sparkline-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            {/* Auto-scale Y-axis to show relative changes in the data */}
            <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
            <Tooltip
              content={<SparklineTooltip />}
              cursor={{ stroke: COLORS.stable, strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Trend indicator icon */}
      <div
        className="flex-shrink-0"
        data-testid="sparkline-trend"
        style={{ color }}
      >
        {trend > TREND_THRESHOLD ? (
          <TrendingUp className="w-3 h-3" aria-hidden="true" />
        ) : trend < -TREND_THRESHOLD ? (
          <TrendingDown className="w-3 h-3" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}
