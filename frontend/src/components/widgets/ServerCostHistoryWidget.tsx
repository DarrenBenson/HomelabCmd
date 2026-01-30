/**
 * Compact server cost history widget for server detail page (US0183).
 *
 * AC4: Per-server cost history visualisation.
 *
 * EP0005: Cost Tracking - Historical Cost Tracking
 */

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';
import { getServerCostHistory } from '../../api/cost-history';
import type { CostHistoryItem, CostHistoryPeriod } from '../../types/cost-history';

interface ServerCostHistoryWidgetProps {
  /** Server identifier */
  serverId: string;
  /** Currency symbol for formatting */
  currencySymbol: string;
}

// Period options
const PERIOD_OPTIONS: { value: CostHistoryPeriod; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

// Chart colours
const COLORS = {
  line: '#22D3EE', // Terminal Cyan
  grid: '#161B22', // Console Grey
  axis: '#6B7280', // Muted grey
};

/** Format cost value */
function formatCost(value: number, symbol: string): string {
  return `${symbol}${value.toFixed(2)}`;
}

/** Format date for display */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface TooltipPayload {
  value: number;
  payload: { date: string; cost: number };
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
    <div className="rounded-md border border-border-default bg-bg-secondary px-2 py-1 shadow-lg">
      <p className="text-xs text-text-tertiary">{formatDate(data.date)}</p>
      <p className="text-sm font-medium text-text-primary">
        {formatCost(data.cost, currencySymbol)}
      </p>
    </div>
  );
}

export function ServerCostHistoryWidget({
  serverId,
  currencySymbol,
}: ServerCostHistoryWidgetProps) {
  const [period, setPeriod] = useState<CostHistoryPeriod>('30d');
  const [data, setData] = useState<CostHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await getServerCostHistory(serverId, period);
        if (!cancelled) {
          setData(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load cost history');
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
  }, [serverId, period]);

  // Don't render if no data and not loading
  if (!loading && (!data || data.length === 0)) {
    return null;
  }

  // Transform data for chart
  const chartData = data?.map((item) => ({
    date: item.date,
    cost: item.estimated_cost,
  })) ?? [];

  // Calculate total for period
  const periodTotal = chartData.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div
      className="rounded-lg border border-border-default bg-bg-secondary p-4"
      data-testid="server-cost-history-widget"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-medium text-text-primary">Cost History</h3>
        </div>

        {/* Period selector */}
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
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

      {/* Loading state */}
      {loading && (
        <div className="flex h-24 items-center justify-center" data-testid="loading-spinner">
          <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex h-24 items-center justify-center text-sm text-status-error">
          {error}
        </div>
      )}

      {/* Chart */}
      {!loading && !error && chartData.length > 0 && (
        <>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke={COLORS.axis}
                  tick={{ fill: COLORS.axis, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke={COLORS.line}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: COLORS.line }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Period total */}
          <div className="mt-2 flex items-baseline justify-between text-xs">
            <span className="text-text-tertiary">Total ({period}):</span>
            <span className="font-medium text-text-primary">
              {formatCost(periodTotal, currencySymbol)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
