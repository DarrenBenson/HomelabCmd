import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoadAverageWidget } from './LoadAverageWidget';
import type { MachineData } from './types';

// Mock the API functions
vi.mock('../../api/metrics', () => ({
  getSparklineData: vi.fn(),
}));

import { getSparklineData } from '../../api/metrics';

const mockMachine: MachineData = {
  id: 'server-1',
  hostname: 'test-server',
  status: 'online',
  cpu_cores: 4,
  latest_metrics: {
    load_1m: 1.5,
    load_5m: 1.2,
    load_15m: 0.8,
    cpu_percent: 45,
    memory_percent: 65,
    disk_percent: 50,
  },
};

const mockSparklineResponse = {
  server_id: 'server-1',
  metric: 'cpu_percent',
  period: '30m',
  data: [
    { timestamp: '2026-01-28T10:00:00Z', value: 40 },
    { timestamp: '2026-01-28T10:30:00Z', value: 45 },
    { timestamp: '2026-01-28T11:00:00Z', value: 42 },
  ],
};

describe('LoadAverageWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSparklineData).mockResolvedValue(mockSparklineResponse);
  });

  it('displays 1min, 5min, and 15min load values', async () => {
    render(<LoadAverageWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('load-1m')).toHaveTextContent('1.50');
      expect(screen.getByTestId('load-5m')).toHaveTextContent('1.20');
      expect(screen.getByTestId('load-15m')).toHaveTextContent('0.80');
    });
  });

  it('displays percentage relative to core count', async () => {
    render(<LoadAverageWidget machine={mockMachine} />);

    await waitFor(() => {
      // 1.5 / 4 cores = 37.5% -> 38%
      expect(screen.getByTestId('load-1m-percent')).toHaveTextContent('38%');
      // 1.2 / 4 cores = 30%
      expect(screen.getByTestId('load-5m-percent')).toHaveTextContent('30%');
      // 0.8 / 4 cores = 20%
      expect(screen.getByTestId('load-15m-percent')).toHaveTextContent('20%');
    });
  });

  it('shows core count', async () => {
    render(<LoadAverageWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('core-count')).toHaveTextContent('4 CPU cores');
    });
  });

  it('applies green colour for load under core count', async () => {
    render(<LoadAverageWidget machine={mockMachine} />);

    await waitFor(() => {
      // load_15m = 0.8 with 4 cores = 0.2 ratio (green)
      expect(screen.getByTestId('load-15m')).toHaveClass('text-status-success');
    });
  });

  it('applies amber colour for load between 1x-2x core count', async () => {
    const highLoadMachine: MachineData = {
      ...mockMachine,
      latest_metrics: {
        ...mockMachine.latest_metrics,
        load_1m: 5.0, // 5.0 / 4 cores = 1.25 ratio (amber)
        load_5m: 4.0,
        load_15m: 3.0,
      },
    };

    render(<LoadAverageWidget machine={highLoadMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('load-1m')).toHaveClass('text-status-warning');
    });
  });

  it('applies red colour for load exceeding 2x core count', async () => {
    const overloadedMachine: MachineData = {
      ...mockMachine,
      latest_metrics: {
        ...mockMachine.latest_metrics,
        load_1m: 10.0, // 10.0 / 4 cores = 2.5 ratio (red)
        load_5m: 8.0,
        load_15m: 6.0,
      },
    };

    render(<LoadAverageWidget machine={overloadedMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('load-1m')).toHaveClass('text-status-error');
    });
  });

  it('shows "--" when no load data available', async () => {
    const noMetricsMachine: MachineData = {
      ...mockMachine,
      latest_metrics: null,
    };

    render(<LoadAverageWidget machine={noMetricsMachine} />);

    await waitFor(() => {
      expect(screen.getByTestId('load-1m')).toHaveTextContent('--');
      expect(screen.getByTestId('load-5m')).toHaveTextContent('--');
      expect(screen.getByTestId('load-15m')).toHaveTextContent('--');
    });
  });

  it('hides percentage when core count is unknown', async () => {
    const noCoresMachine: MachineData = {
      ...mockMachine,
      cpu_cores: null,
    };

    render(<LoadAverageWidget machine={noCoresMachine} />);

    await waitFor(() => {
      expect(screen.queryByTestId('load-1m-percent')).not.toBeInTheDocument();
      expect(screen.queryByTestId('core-count')).not.toBeInTheDocument();
    });
  });

  it('shows edit mode indicator when isEditMode is true', async () => {
    render(<LoadAverageWidget machine={mockMachine} isEditMode={true} />);

    await waitFor(() => {
      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });
  });

  it('fetches sparkline data for trend', async () => {
    render(<LoadAverageWidget machine={mockMachine} />);

    await waitFor(() => {
      expect(getSparklineData).toHaveBeenCalledWith('server-1', 'cpu_percent', '30m');
    });
  });
});
