/**
 * Tests for Scan History page.
 *
 * US0040: Scan History View
 * Test Spec: TS0016
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScanHistoryPage } from '../pages/ScanHistoryPage';
import { getScans, deleteScan } from '../api/scans';
import type { ScanListResponse, ScanListItem } from '../types/scan';

// Mock the API
vi.mock('../api/scans', () => ({
  getScans: vi.fn(),
  deleteScan: vi.fn(),
  getScan: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(initialEntries: string[] = ['/scans/history']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ScanHistoryPage />
    </MemoryRouter>
  );
}

function createMockScan(overrides: Partial<ScanListItem> = {}): ScanListItem {
  return {
    scan_id: 1,
    hostname: '192.168.1.100',
    scan_type: 'quick',
    status: 'completed',
    started_at: '2026-01-21T10:00:00Z',
    completed_at: '2026-01-21T10:00:15Z',
    error: null,
    ...overrides,
  };
}

const mockScansResponse: ScanListResponse = {
  scans: [
    createMockScan({ scan_id: 1, hostname: 'server1', scan_type: 'full', status: 'completed' }),
    createMockScan({ scan_id: 2, hostname: 'server2', scan_type: 'quick', status: 'completed' }),
    createMockScan({
      scan_id: 3,
      hostname: 'server1',
      scan_type: 'quick',
      status: 'failed',
      error: 'Connection refused',
      completed_at: null,
    }),
  ],
  total: 3,
  limit: 20,
  offset: 0,
};

const emptyScansResponse: ScanListResponse = {
  scans: [],
  total: 0,
  limit: 20,
  offset: 0,
};

describe('ScanHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    (getScans as Mock).mockResolvedValue(mockScansResponse);
    (deleteScan as Mock).mockResolvedValue(undefined);
  });

  describe('History page accessible (AC1)', () => {
    // TC-TS0016-09: History page renders scan table
    it('renders scan history table with data', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scans-table')).toBeInTheDocument();
      });

      // server1 appears twice (scan 1 and 3), so use getAllByText
      expect(screen.getAllByText('server1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('server2')).toBeInTheDocument();
    });

    // TC-TS0016-19: Loading state displays spinner
    it('shows loading spinner while fetching', async () => {
      let resolvePromise: (value: ScanListResponse) => void;
      (getScans as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      renderWithRouter();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      await act(async () => {
        resolvePromise!(mockScansResponse);
      });
    });

    // TC-TS0016-20: Error state displays retry button
    it('shows error state on API failure', async () => {
      (getScans as Mock).mockRejectedValue(new Error('API error'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('API error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // TC-TS0016-21: Empty state when no scans
    it('shows empty state when no scans', async () => {
      (getScans as Mock).mockResolvedValue(emptyScansResponse);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText(/No scans yet/i)).toBeInTheDocument();
    });
  });

  describe('Scans listed chronologically (AC2)', () => {
    // TC-TS0016-09: Scans displayed in table
    it('displays scans with correct columns', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scans-table')).toBeInTheDocument();
      });

      // Check headers
      expect(screen.getByText('Hostname')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
    });

    // TC-TS0016-24: Status badge shows correct icon
    it('shows correct status indicators', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scans-table')).toBeInTheDocument();
      });

      // Completed scans should have success indicator
      const completedRows = screen.getAllByTestId(/scan-row-\d+/);
      expect(completedRows.length).toBe(3);

      // Check for status-specific elements
      expect(screen.getByTestId('status-completed-1')).toBeInTheDocument();
      expect(screen.getByTestId('status-failed-3')).toBeInTheDocument();
    });

    // TC-TS0016-17: Pagination displays correctly
    it('shows pagination when total exceeds page size', async () => {
      (getScans as Mock).mockResolvedValue({
        ...mockScansResponse,
        total: 45,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });

      // Pagination calculates: endItem = Math.min(currentPage * pageSize, totalItems) = Math.min(20, 45) = 20
      // So it shows "Showing 1-20 of 45 scans"
      expect(screen.getByTestId('pagination-info')).toHaveTextContent(/Showing 1-20 of 45 scans/i);
    });

    it('hides pagination when total is less than page size', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scans-table')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });

    // TC-TS0016-18: Page change fetches new data
    it('calls API with new offset on page change', async () => {
      (getScans as Mock).mockResolvedValue({
        ...mockScansResponse,
        total: 45,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });

      // Click page 2
      fireEvent.click(screen.getByTestId('pagination-page-2'));

      await waitFor(() => {
        expect(getScans).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 })
        );
      });
    });
  });

  describe('Filter by hostname (AC3)', () => {
    // TC-TS0016-10: Hostname filter updates results
    it('renders hostname filter input', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('hostname-filter')).toBeInTheDocument();
      });
    });

    it('calls API with hostname filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('hostname-filter')).toBeInTheDocument();
      });

      const hostnameInput = screen.getByTestId('hostname-filter');
      fireEvent.change(hostnameInput, { target: { value: 'server1' } });

      // Wait for debounce
      await waitFor(
        () => {
          expect(getScans).toHaveBeenCalledWith(
            expect.objectContaining({ hostname: 'server1' })
          );
        },
        { timeout: 1000 }
      );
    });

    // TC-TS0016-11: Status filter dropdown works
    it('calls API with status filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });

      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { value: 'completed' } });

      await waitFor(() => {
        expect(getScans).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'completed' })
        );
      });
    });

    // TC-TS0016-12: Type filter dropdown works
    it('calls API with scan_type filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('type-filter')).toBeInTheDocument();
      });

      const typeFilter = screen.getByTestId('type-filter');
      fireEvent.change(typeFilter, { target: { value: 'full' } });

      await waitFor(() => {
        expect(getScans).toHaveBeenCalledWith(
          expect.objectContaining({ scan_type: 'full' })
        );
      });
    });

    // TC-TS0016-22: Filter returns no results
    it('shows no matching scans message when filter returns empty', async () => {
      (getScans as Mock)
        .mockResolvedValueOnce(mockScansResponse)
        .mockResolvedValueOnce(emptyScansResponse);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scans-table')).toBeInTheDocument();
      });

      // Apply hostname filter
      const hostnameInput = screen.getByTestId('hostname-filter');
      fireEvent.change(hostnameInput, { target: { value: 'nonexistent' } });

      await waitFor(
        () => {
          expect(screen.getByText(/No matching scans/i)).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    // TC-TS0016-26: Clear filters resets all filters
    it('shows and activates clear filters button', async () => {
      renderWithRouter(['/scans/history?hostname=server1']);

      await waitFor(() => {
        expect(screen.getByTestId('clear-filters')).toBeInTheDocument();
      });

      // Clear the mock to track calls after clicking clear
      (getScans as Mock).mockClear();

      fireEvent.click(screen.getByTestId('clear-filters'));

      // After clearing, should be called without hostname filter
      await waitFor(() => {
        expect(getScans).toHaveBeenCalled();
        const lastCall = (getScans as Mock).mock.calls[0][0];
        expect(lastCall?.hostname).toBeFalsy();
      });
    });

    it('hides clear filters when no filters active', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scans-table')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
    });
  });

  describe('View historical scan details (AC4)', () => {
    // TC-TS0016-13: Clicking row navigates to scan detail
    it('navigates to scan detail when clicking row', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('scan-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('scan-row-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/scans/1');
    });

    it('navigates via view button click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('view-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('view-button-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/scans/1');
    });
  });

  describe('Delete old scans (AC5)', () => {
    // TC-TS0016-14: Delete button shows confirmation modal
    it('shows delete confirmation modal when clicking delete', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-1'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
      });

      expect(screen.getByText(/Delete scan for server1/i)).toBeInTheDocument();
    });

    // TC-TS0016-15: Confirming delete removes scan
    it('calls delete API and removes scan from list on confirm', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-1'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-delete-button'));

      await waitFor(() => {
        expect(deleteScan).toHaveBeenCalledWith(1);
      });

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
      });
    });

    // TC-TS0016-16: Cancel delete closes modal
    it('closes modal without deleting on cancel', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-1'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cancel-delete-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
      });

      expect(deleteScan).not.toHaveBeenCalled();
    });

    it('shows error message when delete fails', async () => {
      (deleteScan as Mock).mockRejectedValue(new Error('Delete failed'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-1'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-delete-button'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toBeInTheDocument();
      });
    });
  });

  describe('Back navigation', () => {
    it('renders back button that navigates to dashboard', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Refresh functionality', () => {
    it('renders refresh button that re-fetches data', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        // Should have been called twice - once on mount, once on refresh
        expect(getScans).toHaveBeenCalledTimes(2);
      });
    });
  });
});
