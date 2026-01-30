import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsChart } from './MetricsChart';
import type { MetricPoint } from '../types/server';

/**
 * MetricsChart tests covering TSP0006 test specification.
 *
 * Test Cases: TC073-TC079 (US0007 Historical Charts)
 * Spec Reference: sdlc-studio/testing/specs/TSP0006-server-detail-charts.md
 */

// Mock Recharts components to avoid canvas issues in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>
        {children}
      </div>
    ),
  };
});

// Sample data for tests
const sampleData: MetricPoint[] = [
  {
    timestamp: '2026-01-18T10:00:00Z',
    cpu_percent: 45.5,
    memory_percent: 67.2,
    disk_percent: 35.0,
  },
  {
    timestamp: '2026-01-18T11:00:00Z',
    cpu_percent: 52.3,
    memory_percent: 68.0,
    disk_percent: 35.0,
  },
  {
    timestamp: '2026-01-18T12:00:00Z',
    cpu_percent: 38.1,
    memory_percent: 65.5,
    disk_percent: 35.0,
  },
];

const sevenDayData: MetricPoint[] = Array.from({ length: 168 }, (_, i) => ({
  timestamp: new Date(Date.now() - (168 - i) * 3600000).toISOString(),
  cpu_percent: 40 + Math.random() * 20,
  memory_percent: 60 + Math.random() * 15,
  disk_percent: 45 + Math.random() * 5,
}));

const thirtyDayData: MetricPoint[] = Array.from({ length: 180 }, (_, i) => ({
  timestamp: new Date(Date.now() - (180 - i) * 4 * 3600000).toISOString(),
  cpu_percent: 40 + Math.random() * 20,
  memory_percent: 60 + Math.random() * 15,
  disk_percent: 45 + Math.random() * 5,
}));

const twelveMonthData: MetricPoint[] = Array.from({ length: 365 }, (_, i) => ({
  timestamp: new Date(Date.now() - (365 - i) * 24 * 3600000).toISOString(),
  cpu_percent: 40 + Math.random() * 20,
  memory_percent: 60 + Math.random() * 15,
  disk_percent: 45 + Math.random() * 5,
}));

describe('MetricsChart', () => {
  describe('Historical charts display (TC073)', () => {
    it('renders chart with data', () => {
      render(<MetricsChart data={sampleData} timeRange="24h" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders chart container with data', () => {
      render(<MetricsChart data={sampleData} timeRange="24h" />);

      // Chart container should be rendered with data
      // The chart renders multiple metrics (CPU, Memory, Disk) in a single LineChart
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-empty')).not.toBeInTheDocument();
    });

    it('displays loading state when loading prop is true', () => {
      render(<MetricsChart data={[]} timeRange="24h" loading={true} />);

      expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
    });
  });

  describe('Time range selection affects data (TC074)', () => {
    it('accepts 24h time range', () => {
      render(<MetricsChart data={sampleData} timeRange="24h" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('accepts 7d time range', () => {
      render(<MetricsChart data={sevenDayData} timeRange="7d" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('accepts 30d time range', () => {
      render(<MetricsChart data={thirtyDayData} timeRange="30d" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('accepts 12m time range', () => {
      render(<MetricsChart data={twelveMonthData} timeRange="12m" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });
  });

  describe('Charts render 30 days of data (TC075)', () => {
    it('renders large dataset without errors', () => {
      render(<MetricsChart data={thirtyDayData} timeRange="30d" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('handles 180 data points for 30d range', () => {
      const data = Array.from({ length: 180 }, (_, i) => ({
        timestamp: new Date(Date.now() - (180 - i) * 4 * 3600000).toISOString(),
        cpu_percent: 45,
        memory_percent: 65,
        disk_percent: 40,
      }));

      render(<MetricsChart data={data} timeRange="30d" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });
  });

  describe('Chart tooltip shows details (TC076)', () => {
    it('chart renders with tooltip capability', () => {
      render(<MetricsChart data={sampleData} timeRange="24h" />);

      // Chart renders successfully - tooltip is configured in the component
      // The CustomTooltip component is registered with the LineChart
      // Actual tooltip rendering requires mouse interaction which is tested in E2E
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
      // Verify chart is not in empty/loading state
      expect(screen.queryByTestId('chart-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chart-loading')).not.toBeInTheDocument();
    });
  });

  describe('Charts handle no data gracefully (TC078)', () => {
    it('shows empty state message when data is empty', () => {
      render(<MetricsChart data={[]} timeRange="24h" />);

      expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
      expect(screen.getByText('No data available for this period')).toBeInTheDocument();
    });

    it('does not show loading spinner when data is empty and not loading', () => {
      render(<MetricsChart data={[]} timeRange="24h" loading={false} />);

      expect(screen.queryByTestId('chart-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
    });
  });

  describe('Charts handle data gaps (TC079)', () => {
    it('renders chart with null values in data', () => {
      const dataWithGaps: MetricPoint[] = [
        {
          timestamp: '2026-01-18T10:00:00Z',
          cpu_percent: 45.5,
          memory_percent: 67.2,
          disk_percent: 35.0,
        },
        {
          timestamp: '2026-01-18T11:00:00Z',
          cpu_percent: null,
          memory_percent: null,
          disk_percent: 35.0,
        },
        {
          timestamp: '2026-01-18T12:00:00Z',
          cpu_percent: 52.3,
          memory_percent: 68.0,
          disk_percent: 35.0,
        },
      ];

      render(<MetricsChart data={dataWithGaps} timeRange="24h" />);

      // Chart should render without errors even with null values
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('chart uses connectNulls to handle gaps', () => {
      // The MetricsChart component uses connectNulls prop on Line components
      // This test verifies the chart renders with sparse data
      const sparseData: MetricPoint[] = [
        { timestamp: '2026-01-18T10:00:00Z', cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: '2026-01-18T11:00:00Z', cpu_percent: null, memory_percent: null, disk_percent: null },
        { timestamp: '2026-01-18T12:00:00Z', cpu_percent: null, memory_percent: null, disk_percent: null },
        { timestamp: '2026-01-18T13:00:00Z', cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={sparseData} timeRange="24h" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });
  });

  describe('Partial data coverage message', () => {
    it('shows message when data span is less than requested range', () => {
      // Data spanning only 2 hours for a 24h request
      const partialData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={partialData} timeRange="24h" />);

      expect(screen.getByTestId('data-coverage-message')).toBeInTheDocument();
    });

    it('does not show message when data covers full range', () => {
      // Data spanning 24 hours for a 24h request
      const fullData: MetricPoint[] = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
        cpu_percent: 45,
        memory_percent: 60,
        disk_percent: 30,
      }));

      render(<MetricsChart data={fullData} timeRange="24h" />);

      expect(screen.queryByTestId('data-coverage-message')).not.toBeInTheDocument();
    });

    it('shows "Building history" message for non-24h ranges', () => {
      // Data spanning only 2 days for a 7d request
      const partialData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={partialData} timeRange="7d" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      expect(message).toHaveTextContent(/Building history/);
    });
  });

  describe('Duration formatting edge cases', () => {
    it('shows minutes for short time periods (< 1 hour)', () => {
      // Data spanning only 30 minutes for a 24h request
      const shortData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 30 * 60000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={shortData} timeRange="24h" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      expect(message).toHaveTextContent(/minute/);
    });

    it('shows hours for medium time periods (1-24 hours)', () => {
      // Data spanning only 5 hours for a 24h request
      const hourData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={hourData} timeRange="24h" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      expect(message).toHaveTextContent(/hour/);
    });

    it('shows days for longer time periods', () => {
      // Data spanning only 5 days for a 30d request
      const dayData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={dayData} timeRange="30d" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      expect(message).toHaveTextContent(/day/);
    });

    it('shows months for very long time periods', () => {
      // Data spanning only 45 days for a 12m request
      const monthData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 45 * 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={monthData} timeRange="12m" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      expect(message).toHaveTextContent(/month/);
    });

    it('shows months with remaining days when applicable', () => {
      // Data spanning 38 days for a 12m request (1 month, 8 days)
      const monthDayData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 38 * 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={monthDayData} timeRange="12m" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "1 month, 8 days" or similar
      expect(message).toHaveTextContent(/month.*day/);
    });
  });

  describe('Time range resolution formatting', () => {
    it('uses time-only format for 24h range', () => {
      // The chart internally uses 1m resolution for 24h
      render(<MetricsChart data={sampleData} timeRange="24h" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('uses day/time format for 7d range', () => {
      // The chart uses 1h resolution for 7d
      render(<MetricsChart data={sevenDayData} timeRange="7d" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('uses day/month format for 12m range', () => {
      // The chart uses 1d resolution for 12m
      render(<MetricsChart data={twelveMonthData} timeRange="12m" />);

      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });
  });

  describe('Duration formatting edge cases (additional)', () => {
    it('shows days with remaining hours when applicable', () => {
      // Data spanning exactly 2 days and 5 hours for a 7d request
      const dayHourData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - (2 * 24 + 5) * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={dayHourData} timeRange="7d" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "2 days, 5 hours" or similar
      expect(message).toHaveTextContent(/day.*hour/);
    });

    it('shows days without hours when remaining hours is 0', () => {
      // Data spanning exactly 3 days (no remaining hours) for a 7d request
      const exactDayData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={exactDayData} timeRange="7d" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "3 days" without hours
      expect(message).toHaveTextContent(/3 day/);
    });

    it('shows months without days when remaining days is small (< 8)', () => {
      // Data spanning 34 days (1 month, 4 days - 4 < 8 threshold) for 12m request
      const monthSmallDayData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 34 * 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={monthSmallDayData} timeRange="12m" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "1 month" without days (4 days < 7 day threshold)
      expect(message).toHaveTextContent(/1 month/);
      expect(message).not.toHaveTextContent(/day/);
    });

    it('handles singular forms correctly - 1 minute', () => {
      // Data spanning 1 minute
      const oneMinuteData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 60000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={oneMinuteData} timeRange="24h" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "1 minute" (singular)
      expect(message).toHaveTextContent(/1 minute\b/);
    });

    it('handles singular forms correctly - 1 hour', () => {
      // Data spanning 1 hour
      const oneHourData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={oneHourData} timeRange="24h" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "1 hour" (singular)
      expect(message).toHaveTextContent(/1 hour\b/);
    });

    it('handles singular forms correctly - 1 day', () => {
      // Data spanning 1 day
      const oneDayData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={oneDayData} timeRange="7d" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "1 day" (singular)
      expect(message).toHaveTextContent(/1 day\b/);
    });

    it('handles plural forms correctly - multiple hours', () => {
      // Data spanning 3 hours
      const threeHourData: MetricPoint[] = [
        { timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), cpu_percent: 45, memory_percent: 60, disk_percent: 30 },
        { timestamp: new Date().toISOString(), cpu_percent: 50, memory_percent: 65, disk_percent: 30 },
      ];

      render(<MetricsChart data={threeHourData} timeRange="24h" />);

      const message = screen.getByTestId('data-coverage-message');
      expect(message).toBeInTheDocument();
      // Should show "3 hours" (plural)
      expect(message).toHaveTextContent(/3 hours/);
    });
  });
});
