/**
 * Tests for RecentScans component.
 *
 * US0042: Scan Dashboard Integration (AC4)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentScans } from '../../components/RecentScans';
import { getScans } from '../../api/scans';
import type { ScanListItem } from '../../types/scan';

// Mock the API
vi.mock('../../api/scans', () => ({
  getScans: vi.fn(),
}));

const mockGetScans = getScans as Mock;

function createMockScan(overrides: Partial<ScanListItem> = {}): ScanListItem {
  return {
    scan_id: 'scan-1',
    hostname: '192.168.1.1',
    scan_type: 'quick',
    status: 'completed',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    results: null,
    error: null,
    ...overrides,
  };
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <RecentScans />
    </MemoryRouter>
  );
}

describe('RecentScans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching', () => {
      mockGetScans.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows error message when fetch fails', async () => {
      mockGetScans.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('shows default error message for non-Error rejection', async () => {
      mockGetScans.mockRejectedValue('Unknown failure');

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load recent scans')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty message when no scans exist', async () => {
      mockGetScans.mockResolvedValue({ scans: [], total: 0 });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('recent-scans-empty')).toBeInTheDocument();
      });
      expect(screen.getByText(/No scans yet/)).toBeInTheDocument();
    });
  });

  describe('Scans list', () => {
    it('renders list of scans', async () => {
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({ scan_id: 'scan-1', hostname: '192.168.1.1' }),
          createMockScan({ scan_id: 'scan-2', hostname: '192.168.1.2' }),
        ],
        total: 2,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.2')).toBeInTheDocument();
      });
    });

    it('renders scan with resolved hostname', async () => {
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({
            scan_id: 'scan-1',
            hostname: '192.168.1.1',
            results: { hostname: 'web-server.local' } as ScanListItem['results'],
          }),
        ],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('web-server.local')).toBeInTheDocument();
      });
      // Should show IP when hostname is different
      expect(screen.getByText(/192\.168\.1\.1/)).toBeInTheDocument();
    });

    it('links to scan details page', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ scan_id: 'scan-123', hostname: '192.168.1.1' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
      });

      const link = screen.getByText('192.168.1.1').closest('a');
      expect(link).toHaveAttribute('href', '/scans/scan-123');
    });
  });

  describe('Scan status icons', () => {
    it('shows completed icon for completed scans', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ status: 'completed' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('scan-status-completed')).toBeInTheDocument();
      });
    });

    it('shows failed icon for failed scans', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ status: 'failed' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('scan-status-failed')).toBeInTheDocument();
      });
    });

    it('shows running icon for running scans', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ status: 'running' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('scan-status-running')).toBeInTheDocument();
      });
    });

    it('shows running icon for pending scans', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ status: 'pending' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('scan-status-running')).toBeInTheDocument();
      });
    });

    it('shows unknown icon for unknown status', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ status: 'unknown' as 'completed' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('scan-status-unknown')).toBeInTheDocument();
      });
    });
  });

  describe('Scan type display', () => {
    it('shows Full Scan for full scan type', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ scan_type: 'full' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Full Scan')).toBeInTheDocument();
      });
    });

    it('shows Quick Scan for quick scan type', async () => {
      mockGetScans.mockResolvedValue({
        scans: [createMockScan({ scan_type: 'quick' })],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Quick Scan')).toBeInTheDocument();
      });
    });
  });

  describe('Time formatting', () => {
    it('shows "Just now" for very recent scans', async () => {
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({
            started_at: new Date().toISOString(),
          }),
        ],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });

    it('shows minutes ago for scans within the hour', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({
            started_at: fiveMinutesAgo.toISOString(),
          }),
        ],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/5m ago/)).toBeInTheDocument();
      });
    });

    it('shows hours ago for scans within the day', async () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({
            started_at: threeHoursAgo.toISOString(),
          }),
        ],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/3h ago/)).toBeInTheDocument();
      });
    });

    it('shows days ago for older scans', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({
            started_at: twoDaysAgo.toISOString(),
          }),
        ],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/2d ago/)).toBeInTheDocument();
      });
    });

    it('shows Unknown for null started_at', async () => {
      mockGetScans.mockResolvedValue({
        scans: [
          createMockScan({
            started_at: null as unknown as string,
          }),
        ],
        total: 1,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeInTheDocument();
      });
    });
  });

  describe('API call', () => {
    it('requests only 5 scans', async () => {
      mockGetScans.mockResolvedValue({ scans: [], total: 0 });

      renderComponent();

      await waitFor(() => {
        expect(mockGetScans).toHaveBeenCalledWith({ limit: 5 });
      });
    });
  });

  describe('View All link', () => {
    it('has link to scans history', async () => {
      mockGetScans.mockResolvedValue({ scans: [], total: 0 });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('View All')).toBeInTheDocument();
      });

      const link = screen.getByText('View All');
      expect(link).toHaveAttribute('href', '/scans/history');
    });
  });

  describe('Component structure', () => {
    it('has Recent Scans heading', async () => {
      mockGetScans.mockResolvedValue({ scans: [], total: 0 });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Recent Scans')).toBeInTheDocument();
      });
    });

    it('has testid for container', async () => {
      mockGetScans.mockResolvedValue({ scans: [], total: 0 });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('recent-scans')).toBeInTheDocument();
      });
    });
  });
});
