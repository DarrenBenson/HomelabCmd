import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CpuWidget } from './CpuWidget';
import type { MachineData } from './types';

// Mock the API functions
vi.mock('../../api/metrics', () => ({
  getSparklineData: vi.fn(),
}));

vi.mock('../../api/servers', () => ({
  getMetricsHistory: vi.fn(),
}));

import { getSparklineData } from '../../api/metrics';
import { getMetricsHistory } from '../../api/servers';

const mockMachine: MachineData = {
  id: 'server-1',
  hostname: 'test-server',
  status: 'online',
  cpu_model: 'Intel Core i7-12700',
  cpu_cores: 12,
  latest_metrics: {
    cpu_percent: 45,
    memory_percent: 65,
    disk_percent: 50,
  },
};

const mockSparklineResponse = {
  server_id: 'server-1',
  metric: 'cpu_percent',
  period: '1h',
  data: [
    { timestamp: '2026-01-28T10:00:00Z', value: 40 },
    { timestamp: '2026-01-28T10:30:00Z', value: 45 },
    { timestamp: '2026-01-28T11:00:00Z', value: 42 },
  ],
};

const mockMetricsHistoryResponse = {
  server_id: 'server-1',
  range: '24h',
  resolution: '1m',
  data_points: [
    { timestamp: '2026-01-27T11:00:00Z', cpu_percent: 35, memory_percent: 60, disk_percent: 45 },
    { timestamp: '2026-01-27T12:00:00Z', cpu_percent: 50, memory_percent: 70, disk_percent: 46 },
    { timestamp: '2026-01-28T11:00:00Z', cpu_percent: 45, memory_percent: 65, disk_percent: 50 },
  ],
  total_points: 3,
};

describe('CpuWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSparklineData).mockResolvedValue(mockSparklineResponse);
    vi.mocked(getMetricsHistory).mockResolvedValue(mockMetricsHistoryResponse);
  });

  it('renders current CPU percentage', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-value')).toHaveTextContent('45%');
    });
  });

  it('renders CPU model and core count', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-model')).toHaveTextContent('Intel Core i7-12700');
    });
    expect(screen.getByTestId('cpu-cores')).toHaveTextContent('12 cores');
  });

  it('displays gauge with correct accessibility attributes', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      const gauge = screen.getByTestId('cpu-gauge');
      expect(gauge).toHaveAttribute('role', 'meter');
      expect(gauge).toHaveAttribute('aria-valuenow', '45');
      expect(gauge).toHaveAttribute('aria-valuemin', '0');
      expect(gauge).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('shows loading state initially', () => {
    render(<CpuWidget machine={mockMachine} />);

    expect(screen.getByTestId('cpu-chart-loading')).toBeInTheDocument();
  });

  it('displays chart after loading', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('cpu-chart-loading')).not.toBeInTheDocument();
    });

    // Chart should be rendered (ResponsiveContainer)
    expect(screen.queryByTestId('cpu-chart-empty')).not.toBeInTheDocument();
  });

  it('fetches sparkline data for 1h range by default', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(getSparklineData).toHaveBeenCalledWith('server-1', 'cpu_percent', '1h');
    });
  });

  it('fetches sparkline data when 6h range is selected', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('cpu-chart-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cpu-range-6h'));

    await waitFor(() => {
      expect(getSparklineData).toHaveBeenCalledWith('server-1', 'cpu_percent', '6h');
    });
  });

  it('fetches metrics history when 24h range is selected', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('cpu-chart-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cpu-range-24h'));

    await waitFor(() => {
      expect(getMetricsHistory).toHaveBeenCalledWith('server-1', '24h');
    });
  });

  it('shows stale indicator when machine is offline', async () => {
    const offlineMachine: MachineData = {
      ...mockMachine,
      status: 'offline',
    };

    render(<CpuWidget machine={offlineMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('stale-indicator')).toHaveTextContent('Last known value (offline)');
    });
  });

  it('shows "--" when no CPU data available', async () => {
    const noMetricsMachine: MachineData = {
      ...mockMachine,
      latest_metrics: null,
    };

    render(<CpuWidget machine={noMetricsMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-value')).toHaveTextContent('--');
    });
  });

  it('displays error when API call fails', async () => {
    vi.mocked(getSparklineData).mockRejectedValue(new Error('Network error'));

    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-chart-error')).toHaveTextContent('Network error');
    });
  });

  it('shows "No data available" when chart data is empty', async () => {
    vi.mocked(getSparklineData).mockResolvedValue({
      ...mockSparklineResponse,
      data: [],
    });

    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-chart-empty')).toHaveTextContent('No data available');
    });
  });

  it('applies green colour for CPU under 50%', async () => {
    const lowCpuMachine: MachineData = {
      ...mockMachine,
      latest_metrics: { ...mockMachine.latest_metrics, cpu_percent: 30 },
    };

    render(<CpuWidget machine={lowCpuMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-value')).toHaveClass('text-status-success');
    });
  });

  it('applies amber colour for CPU between 50-80%', async () => {
    const medCpuMachine: MachineData = {
      ...mockMachine,
      latest_metrics: { ...mockMachine.latest_metrics, cpu_percent: 65 },
    };

    render(<CpuWidget machine={medCpuMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-value')).toHaveClass('text-status-warning');
    });
  });

  it('applies red colour for CPU over 80%', async () => {
    const highCpuMachine: MachineData = {
      ...mockMachine,
      latest_metrics: { ...mockMachine.latest_metrics, cpu_percent: 95 },
    };

    render(<CpuWidget machine={highCpuMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('cpu-value')).toHaveClass('text-status-error');
    });
  });

  it('shows time range selector with 3 options', async () => {
    render(<CpuWidget machine={mockMachine} />);

    expect(screen.getByTestId('cpu-range-1h')).toBeInTheDocument();
    expect(screen.getByTestId('cpu-range-6h')).toBeInTheDocument();
    expect(screen.getByTestId('cpu-range-24h')).toBeInTheDocument();
  });

  it('highlights selected time range', async () => {
    render(<CpuWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('cpu-chart-loading')).not.toBeInTheDocument();
    });

    // Default is 1h
    expect(screen.getByTestId('cpu-range-1h')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('cpu-range-6h')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('cpu-range-6h'));

    await waitFor(() => {
      expect(screen.getByTestId('cpu-range-6h')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('shows edit mode indicator when isEditMode is true', async () => {
    render(<CpuWidget machine={mockMachine} isEditMode={true} />);

    // WidgetContainer should show drag text when in edit mode
    await waitFor(() => {
      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });
  });
});
