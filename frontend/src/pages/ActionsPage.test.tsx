import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActionsPage } from './ActionsPage';
import { getActions } from '../api/actions';
import { getServers } from '../api/servers';
import type { ActionsResponse, Action } from '../types/action';
import type { ServersResponse } from '../types/server';

vi.mock('../api/actions', () => ({
  getActions: vi.fn(),
}));

vi.mock('../api/servers', () => ({
  getServers: vi.fn(),
}));

function renderWithRouter(initialEntries: string[] = ['/actions']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ActionsPage />
    </MemoryRouter>
  );
}

function createMockAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    server_id: 'omv-mediaserver',
    action_type: 'restart_service',
    status: 'completed',
    service_name: 'plex',
    command: 'systemctl restart plex',
    alert_id: null,
    created_at: '2026-01-19T10:30:00Z',
    created_by: 'dashboard',
    approved_at: '2026-01-19T10:30:05Z',
    approved_by: 'auto',
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    executed_at: '2026-01-19T10:31:00Z',
    completed_at: '2026-01-19T10:31:02Z',
    exit_code: 0,
    stdout: '',
    stderr: null,
    ...overrides,
  };
}

const mockActionsResponse: ActionsResponse = {
  actions: [
    createMockAction({ id: 1, status: 'completed', service_name: 'plex' }),
    createMockAction({ id: 2, status: 'pending', service_name: 'nginx', approved_at: null, approved_by: null, executed_at: null, completed_at: null }),
    createMockAction({ id: 3, status: 'failed', service_name: 'docker', exit_code: 1, stderr: 'Service failed to start' }),
    createMockAction({ id: 4, status: 'rejected', service_name: 'redis', rejected_at: '2026-01-19T10:35:00Z', rejected_by: 'dashboard', rejection_reason: 'Service recovered automatically', approved_at: null, approved_by: null, executed_at: null, completed_at: null }),
  ],
  total: 4,
  limit: 20,
  offset: 0,
};

const mockServersResponse: ServersResponse = {
  servers: [
    { id: 'omv-mediaserver', hostname: 'omv-mediaserver.local', display_name: 'OMV Media Server', status: 'online', latest_metrics: null, updates_available: null },
    { id: 'pihole-primary', hostname: 'pihole-primary.local', display_name: 'PiHole Primary', status: 'online', latest_metrics: null, updates_available: null },
  ],
  total: 2,
};

const emptyActionsResponse: ActionsResponse = {
  actions: [],
  total: 0,
  limit: 20,
  offset: 0,
};

describe('ActionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getActions as Mock).mockResolvedValue(mockActionsResponse);
    (getServers as Mock).mockResolvedValue(mockServersResponse);
  });

  // TC171: Action history page accessible at /actions route
  describe('Page accessibility (TC171)', () => {
    it('renders page with Actions header', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
      });
    });

    it('renders back button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('renders filter section', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
        expect(screen.getByTestId('server-filter')).toBeInTheDocument();
      });
    });

    it('shows loading spinner while fetching', async () => {
      let resolvePromise: (value: ActionsResponse) => void;
      (getActions as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );
      renderWithRouter();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      await act(async () => {
        resolvePromise!(mockActionsResponse);
      });
    });
  });

  // TC172: Actions table displays correct columns and data
  describe('Actions table display (TC172)', () => {
    it('renders actions table with data', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('actions-table')).toBeInTheDocument();
      });

      // Check column headers exist within thead
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(5);
      expect(headers[0]).toHaveTextContent('Server');
      expect(headers[1]).toHaveTextContent('Type');
      expect(headers[2]).toHaveTextContent('Status');
      expect(headers[3]).toHaveTextContent('Created');
      expect(headers[4]).toHaveTextContent('Completed');
    });

    it('displays action type with service name', async () => {
      renderWithRouter();

      await waitFor(() => {
        // Check for action row containing service info
        const actionRow = screen.getByTestId('action-row-1');
        expect(actionRow).toHaveTextContent('Restart Service');
        expect(actionRow).toHaveTextContent('plex');
      });
    });

    it('displays status with correct styling', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Rejected')).toBeInTheDocument();
      });
    });

    it('shows rows as clickable', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      const row = screen.getByTestId('action-row-1');
      expect(row).toHaveClass('cursor-pointer');
    });

    it('applies reduced opacity to terminal statuses', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      // Completed action should have opacity
      const completedRow = screen.getByTestId('action-row-1');
      expect(completedRow).toHaveClass('opacity-70');

      // Pending action should not have opacity
      const pendingRow = screen.getByTestId('action-row-2');
      expect(pendingRow).not.toHaveClass('opacity-70');
    });
  });

  // TC176: Filter by server works
  describe('Filter by server (TC176)', () => {
    it('renders server filter with loaded servers', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('server-filter')).toBeInTheDocument();
      });

      const serverFilter = screen.getByTestId('server-filter') as HTMLSelectElement;
      expect(serverFilter.options.length).toBe(3); // All + 2 servers
    });

    it('calls API with server_id filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('server-filter')).toBeInTheDocument();
      });

      const serverFilter = screen.getByTestId('server-filter');
      fireEvent.change(serverFilter, { target: { value: 'omv-mediaserver' } });

      await waitFor(() => {
        expect(getActions).toHaveBeenCalledWith(
          expect.objectContaining({ server_id: 'omv-mediaserver' })
        );
      });
    });

    it('shows clear filters button when server filter active', async () => {
      renderWithRouter(['/actions?server=omv-mediaserver']);

      await waitFor(() => {
        expect(screen.getByTestId('clear-filters')).toBeInTheDocument();
      });
    });
  });

  // TC177: Filter by status works
  describe('Filter by status (TC177)', () => {
    it('renders status filter with all statuses', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });

      const statusFilter = screen.getByTestId('status-filter') as HTMLSelectElement;
      // All + 6 statuses (pending, approved, executing, completed, failed, rejected)
      expect(statusFilter.options.length).toBe(7);
    });

    it('calls API with status filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });

      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { value: 'failed' } });

      await waitFor(() => {
        expect(getActions).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'failed' })
        );
      });
    });

    it('respects status filter from URL', async () => {
      renderWithRouter(['/actions?status=pending']);

      await waitFor(() => {
        expect(getActions).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'pending' })
        );
      });
    });

    it('combines server and status filters', async () => {
      renderWithRouter(['/actions?status=completed&server=omv-mediaserver']);

      await waitFor(() => {
        expect(getActions).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed',
            server_id: 'omv-mediaserver',
          })
        );
      });
    });
  });

  // TC178: Action detail panel shows full audit trail
  describe('Action detail panel (TC178)', () => {
    it('opens detail panel when clicking action row', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('action-detail-panel')).toBeInTheDocument();
      });
    });

    it('closes detail panel when clicking backdrop', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));
      await waitFor(() => {
        expect(screen.getByTestId('action-detail-panel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-detail-backdrop'));

      await waitFor(() => {
        expect(screen.queryByTestId('action-detail-panel')).not.toBeInTheDocument();
      });
    });

    it('closes detail panel when clicking close button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));
      await waitFor(() => {
        expect(screen.getByTestId('action-detail-panel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('close-panel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('action-detail-panel')).not.toBeInTheDocument();
      });
    });

    it('shows action title with service name', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('action-title')).toHaveTextContent('Restart Service: plex');
      });
    });

    it('shows timeline with all entries', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('timeline-created')).toBeInTheDocument();
        expect(screen.getByTestId('timeline-approved')).toBeInTheDocument();
        expect(screen.getByTestId('timeline-executed')).toBeInTheDocument();
        expect(screen.getByTestId('timeline-completed')).toBeInTheDocument();
      });
    });

    it('shows command in monospace', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('action-command')).toHaveTextContent('systemctl restart plex');
      });
    });

    it('shows exit code for completed action', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('exit-code')).toHaveTextContent('0');
      });
    });

    it('shows stdout block', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('action-stdout')).toBeInTheDocument();
      });
    });
  });

  // TC179: Action detail panel shows rejection reason
  describe('Rejection details (TC179)', () => {
    it('shows rejection reason for rejected action', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-4')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-4'));

      await waitFor(() => {
        expect(screen.getByTestId('rejection-reason')).toHaveTextContent('Service recovered automatically');
      });
    });

    it('shows rejected timeline entry', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('action-row-4')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('action-row-4'));

      await waitFor(() => {
        expect(screen.getByTestId('timeline-rejected')).toBeInTheDocument();
      });
    });
  });

  // TC180: Pagination works with 20 items per page
  describe('Pagination (TC180)', () => {
    it('shows pagination when total exceeds page size', async () => {
      (getActions as Mock).mockResolvedValue({
        ...mockActionsResponse,
        total: 50,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
    });

    it('hides pagination when total is less than page size', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('actions-table')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });

    it('displays correct item count', async () => {
      // Mock 50 total with 20 actions on first page
      const manyActions = Array.from({ length: 20 }, (_, i) =>
        createMockAction({ id: i + 1, service_name: `service-${i + 1}` })
      );
      (getActions as Mock).mockResolvedValue({
        actions: manyActions,
        total: 50,
        limit: 20,
        offset: 0,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1-20 of 50 actions');
      });
    });

    it('calls API with offset when page changes', async () => {
      (getActions as Mock).mockResolvedValue({
        ...mockActionsResponse,
        total: 50,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });

      // Click page 2
      fireEvent.click(screen.getByTestId('pagination-page-2'));

      await waitFor(() => {
        expect(getActions).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 })
        );
      });
    });
  });

  // TC181: Empty state shown when no actions match
  describe('Empty state (TC181)', () => {
    it('shows empty state when no actions', async () => {
      (getActions as Mock).mockResolvedValue(emptyActionsResponse);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('No actions found')).toBeInTheDocument();
    });

    it('shows appropriate message when no filters', async () => {
      (getActions as Mock).mockResolvedValue(emptyActionsResponse);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('No remediation actions have been created yet.')).toBeInTheDocument();
      });
    });

    it('shows clear filters link when filters active', async () => {
      (getActions as Mock).mockResolvedValue(emptyActionsResponse);
      renderWithRouter(['/actions?status=failed']);

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('shows error state on API failure', async () => {
      (getActions as Mock).mockRejectedValue(new Error('API error'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('API error')).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      (getActions as Mock).mockRejectedValue(new Error('API error'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
    });
  });

  describe('Refresh button', () => {
    it('renders refresh button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });
    });

    it('calls API when refresh clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });

      vi.clearAllMocks();
      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(getActions).toHaveBeenCalled();
      });
    });
  });
});
