import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryWidget } from './MemoryWidget';
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
  latest_metrics: {
    memory_percent: 65,
    memory_used_mb: 10547,
    memory_total_mb: 16384,
    cpu_percent: 45,
    disk_percent: 50,
  },
};

const mockSparklineResponse = {
  server_id: 'server-1',
  metric: 'memory_percent',
  period: '1h',
  data: [
    { timestamp: '2026-01-28T10:00:00Z', value: 60 },
    { timestamp: '2026-01-28T10:30:00Z', value: 65 },
    { timestamp: '2026-01-28T11:00:00Z', value: 62 },
  ],
};

const mockMetricsHistoryResponse = {
  server_id: 'server-1',
  range: '24h',
  resolution: '1m',
  data_points: [
    { timestamp: '2026-01-27T11:00:00Z', cpu_percent: 35, memory_percent: 55, disk_percent: 45 },
    { timestamp: '2026-01-27T12:00:00Z', cpu_percent: 50, memory_percent: 70, disk_percent: 46 },
    { timestamp: '2026-01-28T11:00:00Z', cpu_percent: 45, memory_percent: 65, disk_percent: 50 },
  ],
  total_points: 3,
};

describe('MemoryWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSparklineData).mockResolvedValue(mockSparklineResponse);
    vi.mocked(getMetricsHistory).mockResolvedValue(mockMetricsHistoryResponse);
  });

  it('renders current memory percentage', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-value')).toHaveTextContent('65%');
    });
  });

  it('renders used/total memory in GB', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-used-total')).toHaveTextContent('10.3 GB / 16.0 GB');
    });
  });

  it('displays gauge with correct accessibility attributes', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      const gauge = screen.getByTestId('memory-gauge');
      expect(gauge).toHaveAttribute('role', 'meter');
      expect(gauge).toHaveAttribute('aria-valuenow', '65');
      expect(gauge).toHaveAttribute('aria-valuemin', '0');
      expect(gauge).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('shows loading state initially', () => {
    render(<MemoryWidget machine={mockMachine} />);

    expect(screen.getByTestId('memory-chart-loading')).toBeInTheDocument();
  });

  it('fetches sparkline data for 1h range by default', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(getSparklineData).toHaveBeenCalledWith('server-1', 'memory_percent', '1h');
    });
  });

  it('fetches sparkline data when 6h range is selected', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('memory-chart-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-range-6h'));

    await waitFor(() => {
      expect(getSparklineData).toHaveBeenCalledWith('server-1', 'memory_percent', '6h');
    });
  });

  it('fetches metrics history when 24h range is selected', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('memory-chart-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-range-24h'));

    await waitFor(() => {
      expect(getMetricsHistory).toHaveBeenCalledWith('server-1', '24h');
    });
  });

  it('shows stale indicator when machine is offline', async () => {
    const offlineMachine: MachineData = {
      ...mockMachine,
      status: 'offline',
    };

    render(<MemoryWidget machine={offlineMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('stale-indicator')).toHaveTextContent('Last known value (offline)');
    });
  });

  it('shows "--" when no memory data available', async () => {
    const noMetricsMachine: MachineData = {
      ...mockMachine,
      latest_metrics: null,
    };

    render(<MemoryWidget machine={noMetricsMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-value')).toHaveTextContent('--');
    });
  });

  it('displays error when API call fails', async () => {
    vi.mocked(getSparklineData).mockRejectedValue(new Error('Network error'));

    render(<MemoryWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-chart-error')).toHaveTextContent('Network error');
    });
  });

  it('applies green colour for memory under 70%', async () => {
    const lowMemoryMachine: MachineData = {
      ...mockMachine,
      latest_metrics: { ...mockMachine.latest_metrics, memory_percent: 50 },
    };

    render(<MemoryWidget machine={lowMemoryMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-value')).toHaveClass('text-status-success');
    });
  });

  it('applies amber colour for memory between 70-85%', async () => {
    const medMemoryMachine: MachineData = {
      ...mockMachine,
      latest_metrics: { ...mockMachine.latest_metrics, memory_percent: 75 },
    };

    render(<MemoryWidget machine={medMemoryMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-value')).toHaveClass('text-status-warning');
    });
  });

  it('applies red colour for memory over 85%', async () => {
    const highMemoryMachine: MachineData = {
      ...mockMachine,
      latest_metrics: { ...mockMachine.latest_metrics, memory_percent: 92 },
    };

    render(<MemoryWidget machine={highMemoryMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-value')).toHaveClass('text-status-error');
    });
  });

  it('shows time range selector with 3 options', async () => {
    render(<MemoryWidget machine={mockMachine} />);

    expect(screen.getByTestId('memory-range-1h')).toBeInTheDocument();
    expect(screen.getByTestId('memory-range-6h')).toBeInTheDocument();
    expect(screen.getByTestId('memory-range-24h')).toBeInTheDocument();
  });

  it('formats memory in MB when under 1 GB', async () => {
    const smallMemoryMachine: MachineData = {
      ...mockMachine,
      latest_metrics: {
        ...mockMachine.latest_metrics,
        memory_used_mb: 512,
        memory_total_mb: 1024,
      },
    };

    render(<MemoryWidget machine={smallMemoryMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-used-total')).toHaveTextContent('512 MB / 1.0 GB');
    });
  });

  it('shows edit mode indicator when isEditMode is true', async () => {
    render(<MemoryWidget machine={mockMachine} isEditMode={true} />);

    await waitFor(() => {
      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });
  });
});
