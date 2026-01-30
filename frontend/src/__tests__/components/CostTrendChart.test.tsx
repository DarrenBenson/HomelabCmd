/**
 * Tests for CostTrendChart component (US0183 AC3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CostTrendChart } from '../../components/CostTrendChart';
import type { CostHistoryItem } from '../../types/cost-history';

// Mock recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('CostTrendChart', () => {
  const mockData: CostHistoryItem[] = [
    {
      date: '2026-01-01',
      estimated_kwh: 1.2,
      estimated_cost: 0.29,
      electricity_rate: 0.24,
    },
    {
      date: '2026-01-02',
      estimated_kwh: 1.3,
      estimated_cost: 0.31,
      electricity_rate: 0.24,
    },
    {
      date: '2026-01-03',
      estimated_kwh: 1.1,
      estimated_cost: 0.26,
      electricity_rate: 0.24,
    },
  ];

  const defaultProps = {
    data: mockData,
    currencySymbol: '£',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the chart with data', () => {
    render(<CostTrendChart {...defaultProps} />);

    expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<CostTrendChart {...defaultProps} loading={true} />);

    expect(screen.getByTestId('cost-trend-chart-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<CostTrendChart {...defaultProps} data={[]} />);

    expect(screen.getByTestId('cost-trend-chart-empty')).toBeInTheDocument();
    expect(screen.getByText('No historical data available')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders period selector when onPeriodChange is provided', () => {
    const onPeriodChange = vi.fn();

    render(
      <CostTrendChart
        {...defaultProps}
        period="30d"
        onPeriodChange={onPeriodChange}
      />
    );

    expect(screen.getByLabelText('7 Days')).toBeInTheDocument();
    expect(screen.getByLabelText('30 Days')).toBeInTheDocument();
    expect(screen.getByLabelText('90 Days')).toBeInTheDocument();
    expect(screen.getByLabelText('12 Months')).toBeInTheDocument();
  });

  it('calls onPeriodChange when period button is clicked', () => {
    const onPeriodChange = vi.fn();

    render(
      <CostTrendChart
        {...defaultProps}
        period="30d"
        onPeriodChange={onPeriodChange}
      />
    );

    fireEvent.click(screen.getByLabelText('7 Days'));

    expect(onPeriodChange).toHaveBeenCalledWith('7d');
  });

  it('highlights the active period button', () => {
    render(
      <CostTrendChart
        {...defaultProps}
        period="90d"
        onPeriodChange={vi.fn()}
      />
    );

    const activeButton = screen.getByLabelText('90 Days');
    expect(activeButton).toHaveClass('bg-status-info');
  });

  it('does not render period selector when onPeriodChange is not provided', () => {
    render(<CostTrendChart {...defaultProps} />);

    expect(screen.queryByLabelText('7 Days')).not.toBeInTheDocument();
  });

  it('renders with comparison data', () => {
    const comparisonData: CostHistoryItem[] = [
      {
        date: '2025-12-25',
        estimated_kwh: 1.0,
        estimated_cost: 0.24,
        electricity_rate: 0.24,
      },
      {
        date: '2025-12-26',
        estimated_kwh: 1.1,
        estimated_cost: 0.26,
        electricity_rate: 0.24,
      },
    ];

    render(
      <CostTrendChart
        {...defaultProps}
        comparisonData={comparisonData}
        showComparison={true}
      />
    );

    expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('renders chart container with proper ARIA label', () => {
    render(<CostTrendChart {...defaultProps} />);

    expect(screen.getByRole('img', { name: 'Cost trend chart' })).toBeInTheDocument();
  });
});
