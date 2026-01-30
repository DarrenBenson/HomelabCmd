/**
 * Tests for ServerCostHistoryWidget component (US0183 AC4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServerCostHistoryWidget } from '../../components/widgets/ServerCostHistoryWidget';
import * as costHistoryApi from '../../api/cost-history';
import type { ServerCostHistoryResponse, CostHistoryItem } from '../../types/cost-history';

// Mock the API module
vi.mock('../../api/cost-history');

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
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('ServerCostHistoryWidget', () => {
  const mockItems: CostHistoryItem[] = [
    {
      date: '2026-01-25',
      estimated_kwh: 1.2,
      estimated_cost: 0.29,
      electricity_rate: 0.24,
    },
    {
      date: '2026-01-26',
      estimated_kwh: 1.3,
      estimated_cost: 0.31,
      electricity_rate: 0.24,
    },
    {
      date: '2026-01-27',
      estimated_kwh: 1.1,
      estimated_cost: 0.26,
      electricity_rate: 0.24,
    },
  ];

  const mockResponse: ServerCostHistoryResponse = {
    server_id: 'test-server-id',
    hostname: 'test-server',
    period: '30d',
    items: mockItems,
    currency_symbol: '£',
  };

  const defaultProps = {
    serverId: 'test-server-id',
    currencySymbol: '£',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(costHistoryApi.getServerCostHistory).mockResolvedValue(mockResponse);
  });

  it('renders loading state initially', async () => {
    // Create a promise that doesn't resolve immediately
    vi.mocked(costHistoryApi.getServerCostHistory).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ServerCostHistoryWidget {...defaultProps} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders the widget with data after loading', async () => {
    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
    });

    expect(screen.getByText('Cost History')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('displays period selector buttons', async () => {
    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('7d')).toBeInTheDocument();
    expect(screen.getByLabelText('30d')).toBeInTheDocument();
    expect(screen.getByLabelText('90d')).toBeInTheDocument();
  });

  it('fetches new data when period is changed', async () => {
    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
    });

    // Click on 7d button
    fireEvent.click(screen.getByLabelText('7d'));

    await waitFor(() => {
      expect(costHistoryApi.getServerCostHistory).toHaveBeenCalledWith(
        'test-server-id',
        '7d'
      );
    });
  });

  it('highlights the active period button', async () => {
    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
    });

    // Default period is 30d
    const activeButton = screen.getByLabelText('30d');
    expect(activeButton).toHaveClass('bg-status-info');
  });

  it('displays period total', async () => {
    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
    });

    // Total should be 0.29 + 0.31 + 0.26 = 0.86
    expect(screen.getByText('Total (30d):')).toBeInTheDocument();
    expect(screen.getByText('£0.86')).toBeInTheDocument();
  });

  it('returns null when no data is available', async () => {
    vi.mocked(costHistoryApi.getServerCostHistory).mockResolvedValue({
      ...mockResponse,
      items: [],
    });

    const { container } = render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(costHistoryApi.getServerCostHistory).toHaveBeenCalled();
    });

    // Widget should not be rendered when there's no data
    expect(container.querySelector('[data-testid="server-cost-history-widget"]')).not.toBeInTheDocument();
  });

  it('displays error message on API failure', async () => {
    vi.mocked(costHistoryApi.getServerCostHistory).mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    });
  });

  it('calls API with correct server ID', async () => {
    render(<ServerCostHistoryWidget {...defaultProps} />);

    await waitFor(() => {
      expect(costHistoryApi.getServerCostHistory).toHaveBeenCalledWith(
        'test-server-id',
        '30d'
      );
    });
  });

  it('uses the provided currency symbol', async () => {
    render(
      <ServerCostHistoryWidget
        serverId="test-server-id"
        currencySymbol="$"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('server-cost-history-widget')).toBeInTheDocument();
    });

    // Should display dollar sign in the total
    expect(screen.getByText('$0.86')).toBeInTheDocument();
  });
});
