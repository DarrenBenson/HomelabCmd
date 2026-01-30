/**
 * Tests for MonthlySummaryChart component (US0183 AC5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthlySummaryChart } from '../../components/MonthlySummaryChart';
import type { MonthlySummaryItem } from '../../types/cost-history';

// Mock recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
}));

describe('MonthlySummaryChart', () => {
  const mockData: MonthlySummaryItem[] = [
    {
      year_month: '2026-01',
      total_cost: 35.50,
      total_kwh: 147.9,
      previous_month_cost: 36.20,
      change_percent: -1.9,
    },
    {
      year_month: '2025-12',
      total_cost: 36.20,
      total_kwh: 150.8,
      previous_month_cost: 34.80,
      change_percent: 4.0,
    },
    {
      year_month: '2025-11',
      total_cost: 34.80,
      total_kwh: 145.0,
      previous_month_cost: null,
      change_percent: null,
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
    render(<MonthlySummaryChart {...defaultProps} />);

    expect(screen.getByTestId('monthly-summary-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<MonthlySummaryChart {...defaultProps} loading={true} />);

    expect(screen.getByTestId('monthly-summary-chart-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<MonthlySummaryChart {...defaultProps} data={[]} />);

    expect(screen.getByTestId('monthly-summary-chart-empty')).toBeInTheDocument();
    expect(screen.getByText('No monthly data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('displays year-to-date total when provided', () => {
    render(
      <MonthlySummaryChart
        {...defaultProps}
        yearToDate={425.50}
      />
    );

    expect(screen.getByText('Year to Date')).toBeInTheDocument();
    expect(screen.getByText('£425.50')).toBeInTheDocument();
  });

  it('renders year selector when onYearChange is provided', () => {
    const onYearChange = vi.fn();
    const currentYear = new Date().getFullYear();

    render(
      <MonthlySummaryChart
        {...defaultProps}
        year={currentYear}
        onYearChange={onYearChange}
      />
    );

    expect(screen.getByLabelText(`Year ${currentYear}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`Year ${currentYear - 1}`)).toBeInTheDocument();
  });

  it('calls onYearChange when year button is clicked', () => {
    const onYearChange = vi.fn();
    const currentYear = new Date().getFullYear();

    render(
      <MonthlySummaryChart
        {...defaultProps}
        year={currentYear}
        onYearChange={onYearChange}
      />
    );

    fireEvent.click(screen.getByLabelText(`Year ${currentYear - 1}`));

    expect(onYearChange).toHaveBeenCalledWith(currentYear - 1);
  });

  it('highlights the active year button', () => {
    const currentYear = new Date().getFullYear();

    render(
      <MonthlySummaryChart
        {...defaultProps}
        year={currentYear}
        onYearChange={vi.fn()}
      />
    );

    const activeButton = screen.getByLabelText(`Year ${currentYear}`);
    expect(activeButton).toHaveClass('bg-status-info');
  });

  it('displays change badges for recent months', () => {
    render(<MonthlySummaryChart {...defaultProps} />);

    // Should show badges for the last 6 months
    // Check for Jan which has -1.9% change (decrease - green)
    expect(screen.getByText('-1.9%')).toBeInTheDocument();

    // Check for Dec which has +4.0% change (increase - red)
    expect(screen.getByText('+4.0%')).toBeInTheDocument();
  });

  it('renders chart container with proper ARIA label', () => {
    render(<MonthlySummaryChart {...defaultProps} />);

    expect(screen.getByRole('img', { name: 'Monthly summary chart' })).toBeInTheDocument();
  });

  it('does not render year selector when onYearChange is not provided', () => {
    const currentYear = new Date().getFullYear();

    render(<MonthlySummaryChart {...defaultProps} />);

    expect(screen.queryByLabelText(`Year ${currentYear}`)).not.toBeInTheDocument();
  });
});
