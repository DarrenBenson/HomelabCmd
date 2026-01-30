/**
 * Monthly cost summary bar chart component (US0183).
 *
 * AC5: Monthly cost summary with month-over-month change and YTD.
 *
 * EP0005: Cost Tracking - Historical Cost Tracking
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MonthlySummaryItem } from '../types/cost-history';

interface MonthlySummaryChartProps {
  /** Monthly summary data */
  data: MonthlySummaryItem[];
  /** Currency symbol for formatting */
  currencySymbol: string;
  /** Year-to-date total cost */
  yearToDate?: number;
  /** Current year */
  year?: number;
  /** Callback when year changes */
  onYearChange?: (year: number) => void;
  /** Loading state */
  loading?: boolean;
}

// Chart colours
const COLORS = {
  bar: '#22D3EE', // Terminal Cyan
  barHover: '#67E8F9', // Lighter cyan
  increase: '#F87171', // Red for cost increase
  decrease: '#4ADE80', // Green for cost decrease
  neutral: '#9CA3AF', // Grey
  grid: '#161B22', // Console Grey
  axis: '#C9D1D9', // Soft White
};

/** Format cost value */
function formatCost(value: number, symbol: string): string {
  return `${symbol}${value.toFixed(2)}`;
}

/** Format month for display */
function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-GB', { month: 'short' });
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  payload: { year_month: string; total_cost: number; total_kwh: number; change_percent: number | null };
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
  const [year, month] = data.year_month.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-md border border-border-default bg-bg-secondary p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-text-primary">{monthName}</p>
      <div className="space-y-1 text-sm">
        <p className="text-text-secondary">
          Cost: <span className="text-text-primary">{formatCost(data.total_cost, currencySymbol)}</span>
        </p>
        <p className="text-text-secondary">
          Usage: <span className="text-text-primary">{data.total_kwh.toFixed(1)} kWh</span>
        </p>
        {data.change_percent !== null && (
          <p
            className={
              data.change_percent > 0
                ? 'text-status-error'
                : data.change_percent < 0
                  ? 'text-status-success'
                  : 'text-text-tertiary'
            }
          >
            {data.change_percent > 0 ? '+' : ''}
            {data.change_percent.toFixed(1)}% vs prev month
          </p>
        )}
      </div>
    </div>
  );
}

interface ChangeBadgeProps {
  changePercent: number | null;
}

function ChangeBadge({ changePercent }: ChangeBadgeProps) {
  if (changePercent === null) {
    return null;
  }

  const isIncrease = changePercent > 0;
  const isDecrease = changePercent < 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
        isIncrease
          ? 'bg-status-error/10 text-status-error'
          : isDecrease
            ? 'bg-status-success/10 text-status-success'
            : 'bg-text-tertiary/10 text-text-tertiary'
      }`}
    >
      {isIncrease ? (
        <TrendingUp className="h-3 w-3" />
      ) : isDecrease ? (
        <TrendingDown className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      {isIncrease ? '+' : ''}
      {changePercent.toFixed(1)}%
    </span>
  );
}

export function MonthlySummaryChart({
  data,
  currencySymbol,
  yearToDate,
  year,
  onYearChange,
  loading = false,
}: MonthlySummaryChartProps) {
  const currentYear = new Date().getFullYear();

  // Loading state
  if (loading) {
    return (
      <div
        className="flex h-80 items-center justify-center rounded-lg border border-border-default bg-bg-secondary"
        data-testid="monthly-summary-chart-loading"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div
        className="flex h-80 flex-col items-center justify-center rounded-lg border border-border-default bg-bg-secondary"
        data-testid="monthly-summary-chart-empty"
      >
        <Calendar className="mb-2 h-8 w-8 text-text-tertiary" />
        <p className="text-text-secondary">No monthly data available</p>
        <p className="text-sm text-text-tertiary">Data will accumulate over time</p>
      </div>
    );
  }

  return (
    <div data-testid="monthly-summary-chart">
      {/* Header with year selector and YTD */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onYearChange && year && (
            <>
              <Calendar className="h-4 w-4 text-text-tertiary" />
              <div className="flex gap-1">
                {[currentYear - 1, currentYear].map((y) => (
                  <button
                    key={y}
                    onClick={() => onYearChange(y)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      year === y
                        ? 'bg-status-info text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary hover:text-text-primary'
                    }`}
                    aria-label={`Year ${y}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {yearToDate !== undefined && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">Year to Date</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatCost(yearToDate, currencySymbol)}
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-56 w-full" role="img" aria-label="Monthly summary chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis
              dataKey="year_month"
              tickFormatter={formatMonth}
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
            <Bar dataKey="total_cost" radius={[4, 4, 0, 0]}>
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS.bar} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Change badges below chart */}
      <div className="mt-4 flex flex-wrap gap-2">
        {data.slice(-6).map((item) => (
          <div key={item.year_month} className="flex items-center gap-2 text-xs">
            <span className="text-text-tertiary">{formatMonth(item.year_month)}:</span>
            <ChangeBadge changePercent={item.change_percent} />
          </div>
        ))}
      </div>
    </div>
  );
}
