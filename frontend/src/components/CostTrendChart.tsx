/**
 * Cost trend line chart component (US0183).
 *
 * AC3: Cost trend visualisation with period selection.
 *
 * EP0005: Cost Tracking - Historical Cost Tracking
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import type { CostHistoryItem, CostHistoryPeriod } from '../types/cost-history';

interface CostTrendChartProps {
  /** Cost history data points */
  data: CostHistoryItem[];
  /** Currency symbol for formatting */
  currencySymbol: string;
  /** Optional comparison data (previous period) */
  comparisonData?: CostHistoryItem[];
  /** Show comparison line */
  showComparison?: boolean;
  /** Current selected period */
  period?: CostHistoryPeriod;
  /** Callback when period changes */
  onPeriodChange?: (period: CostHistoryPeriod) => void;
  /** Loading state */
  loading?: boolean;
}

// Period options with labels
const PERIOD_OPTIONS: { value: CostHistoryPeriod; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '12m', label: '12 Months' },
];

// Chart colours
const COLORS = {
  primary: '#22D3EE', // Terminal Cyan
  comparison: '#6366F1', // Indigo
  grid: '#161B22', // Console Grey
  axis: '#C9D1D9', // Soft White
  tooltip: '#0D1117', // Deep Black
};

/** Format cost value */
function formatCost(value: number, symbol: string): string {
  return `${symbol}${value.toFixed(2)}`;
}

/** Format date for display */
function formatDate(dateStr: string): string {
  // Handle different date formats
  if (dateStr.includes('-W')) {
    // Weekly format: "2026-W05"
    return dateStr.replace('-W', ' W');
  }
  if (dateStr.length === 7) {
    // Monthly format: "2026-01"
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  }
  // Daily format: "2026-01-15"
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface TooltipPayload {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: { date: string; cost: number; comparison?: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  currencySymbol: string;
}

function CustomTooltip({ active, payload, currencySymbol }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-md border border-border-default bg-bg-secondary p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-text-primary">{formatDate(data.date)}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCost(entry.value, currencySymbol)}
          </p>
        ))}
      </div>
    </div>
  );
}

export function CostTrendChart({
  data,
  currencySymbol,
  comparisonData,
  showComparison = false,
  period = '30d',
  onPeriodChange,
  loading = false,
}: CostTrendChartProps) {
  // Transform data for chart
  const chartData = data.map((item, index) => ({
    date: item.date,
    cost: item.estimated_cost,
    comparison: showComparison && comparisonData?.[index]?.estimated_cost,
  }));

  // Loading state
  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-lg border border-border-default bg-bg-secondary"
        data-testid="cost-trend-chart-loading"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div
        className="flex h-64 flex-col items-center justify-center rounded-lg border border-border-default bg-bg-secondary"
        data-testid="cost-trend-chart-empty"
      >
        <TrendingUp className="mb-2 h-8 w-8 text-text-tertiary" />
        <p className="text-text-secondary">No historical data available</p>
        <p className="text-sm text-text-tertiary">Cost snapshots will appear here after midnight</p>
      </div>
    );
  }

  return (
    <div data-testid="cost-trend-chart">
      {/* Period selector */}
      {onPeriodChange && (
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-tertiary" />
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onPeriodChange(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === option.value
                    ? 'bg-status-info text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary hover:text-text-primary'
                }`}
                aria-label={option.label}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64 w-full" role="img" aria-label="Cost trend chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke={COLORS.axis}
              tick={{ fill: COLORS.axis, fontSize: 12 }}
              tickLine={{ stroke: COLORS.axis }}
            />
            <YAxis
              tickFormatter={(value) => formatCost(value, currencySymbol)}
              stroke={COLORS.axis}
              tick={{ fill: COLORS.axis, fontSize: 12 }}
              tickLine={{ stroke: COLORS.axis }}
              width={80}
            />
            <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
            {showComparison && comparisonData && comparisonData.length > 0 && (
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => (
                  <span className="text-sm text-text-secondary">{value}</span>
                )}
              />
            )}
            <Line
              type="monotone"
              dataKey="cost"
              name="Current Period"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLORS.primary }}
            />
            {showComparison && comparisonData && comparisonData.length > 0 && (
              <Line
                type="monotone"
                dataKey="comparison"
                name="Previous Period"
                stroke={COLORS.comparison}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, fill: COLORS.comparison }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
