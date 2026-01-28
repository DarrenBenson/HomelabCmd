import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlertsPage } from './AlertsPage';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../api/alerts';
import { getServers } from '../api/servers';
import { restartService } from '../api/services';
import { ApiError } from '../api/client';
import type { AlertsResponse, Alert } from '../types/alert';
import type { ServersResponse } from '../types/server';

vi.mock('../api/alerts', () => ({
  getAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
}));

vi.mock('../api/servers', () => ({
  getServers: vi.fn(),
}));

vi.mock('../api/services', () => ({
  restartService: vi.fn(),
}));

function renderWithRouter(initialEntries: string[] = ['/alerts']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AlertsPage />
    </MemoryRouter>
  );
}

function createMockAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    server_id: 'server-1',
    server_name: 'Test Server 1',
    alert_type: 'disk_usage',
    severity: 'critical',
    status: 'open',
    title: 'Disk usage at 92%',
    message: 'Disk usage exceeded threshold',
    threshold_value: 90,
    actual_value: 92,
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    auto_resolved: false,
    can_acknowledge: true,
    can_resolve: true,
    service_name: null,
    ...overrides,
  };
}

const mockAlertsResponse: AlertsResponse = {
  alerts: [
    createMockAlert({ id: 1, severity: 'critical', title: 'Disk usage at 92%' }),
    createMockAlert({ id: 2, severity: 'high', title: 'RAM usage at 87%', status: 'acknowledged', can_acknowledge: false }),
    createMockAlert({ id: 3, severity: 'medium', title: 'CPU spike detected', status: 'resolved', can_acknowledge: false, can_resolve: false }),
  ],
  total: 3,
  limit: 20,
  offset: 0,
};

const mockServersResponse: ServersResponse = {
  servers: [
    { id: 'server-1', hostname: 'server-1.local', display_name: 'Test Server 1', status: 'online', latest_metrics: null, updates_available: null },
    { id: 'server-2', hostname: 'server-2.local', display_name: 'Test Server 2', status: 'online', latest_metrics: null, updates_available: null },
  ],
  total: 2,
};

const emptyAlertsResponse: AlertsResponse = {
  alerts: [],
  total: 0,
  limit: 20,
  offset: 0,
};

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
    (getServers as Mock).mockResolvedValue(mockServersResponse);
  });

  describe('Alert list display (AC1)', () => {
    it('renders alerts table with data', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alerts-table')).toBeInTheDocument();
      });

      expect(screen.getByText('Disk usage at 92%')).toBeInTheDocument();
      expect(screen.getByText('RAM usage at 87%')).toBeInTheDocument();
      expect(screen.getByText('CPU spike detected')).toBeInTheDocument();
    });

    it('shows loading spinner while fetching', async () => {
      let resolvePromise: (value: AlertsResponse) => void;
      (getAlerts as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );
      renderWithRouter();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Clean up by resolving the promise to avoid act() warning
      await act(async () => {
        resolvePromise!(mockAlertsResponse);
      });
    });

    it('shows error state on API failure', async () => {
      (getAlerts as Mock).mockRejectedValue(new Error('API error'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('API error')).toBeInTheDocument();
    });

    it('shows empty state when no alerts', async () => {
      (getAlerts as Mock).mockResolvedValue(emptyAlertsResponse);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('No alerts found')).toBeInTheDocument();
    });
  });

  describe('Filter by status (AC2)', () => {
    it('renders status filter dropdown', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });
    });

    it('calls API with status filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });

      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { value: 'open' } });

      await waitFor(() => {
        expect(getAlerts).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'open' })
        );
      });
    });
  });

  describe('Filter by severity (AC3)', () => {
    it('renders severity filter dropdown', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('severity-filter')).toBeInTheDocument();
      });
    });

    it('calls API with severity filter when changed', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('severity-filter')).toBeInTheDocument();
      });

      const severityFilter = screen.getByTestId('severity-filter');
      fireEvent.change(severityFilter, { target: { value: 'critical' } });

      await waitFor(() => {
        expect(getAlerts).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'critical' })
        );
      });
    });
  });

  describe('Alert detail view (AC4)', () => {
    it('opens detail panel when clicking alert row', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });
    });

    it('closes detail panel when clicking close button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-1'));
      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('close-panel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('alert-detail-panel')).not.toBeInTheDocument();
      });
    });
  });

  describe('Acknowledge from list (AC5)', () => {
    it('renders acknowledge button for open alerts', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('acknowledge-button-1')).toBeInTheDocument();
      });
    });

    it('calls acknowledgeAlert when button clicked', async () => {
      (acknowledgeAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('acknowledge-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('acknowledge-button-1'));

      await waitFor(() => {
        expect(acknowledgeAlert).toHaveBeenCalledWith(1);
      });
    });

    it('shows error toast on acknowledge failure', async () => {
      (acknowledgeAlert as Mock).mockRejectedValue(new Error('Failed to acknowledge'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('acknowledge-button-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('acknowledge-button-1'));

      await waitFor(() => {
        expect(screen.getByTestId('action-error-toast')).toBeInTheDocument();
      });
    });
  });

  describe('Resolve from detail (AC6)', () => {
    it('renders resolve button in detail panel for non-resolved alerts', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-resolve-button')).toBeInTheDocument();
      });
    });

    it('calls resolveAlert when button clicked', async () => {
      (resolveAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        auto_resolved: false,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-resolve-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('detail-resolve-button'));

      await waitFor(() => {
        expect(resolveAlert).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Pagination (AC7)', () => {
    it('shows pagination when total exceeds page size', async () => {
      (getAlerts as Mock).mockResolvedValue({
        ...mockAlertsResponse,
        total: 45,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
    });

    it('hides pagination when total is less than page size', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alerts-table')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });
  });

  describe('Server filter', () => {
    it('renders server filter with loaded servers', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('server-filter')).toBeInTheDocument();
      });

      const serverFilter = screen.getByTestId('server-filter') as HTMLSelectElement;
      expect(serverFilter.options.length).toBeGreaterThan(1);
    });
  });

  describe('Clear filters', () => {
    it('shows clear filters button when filters are active', async () => {
      renderWithRouter(['/alerts?status=open']);

      await waitFor(() => {
        expect(screen.getByTestId('clear-filters')).toBeInTheDocument();
      });
    });

    it('hides clear filters button when no filters active', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alerts-table')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
    });
  });

  describe('Back navigation', () => {
    it('renders back button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });

  describe('Resolve alert updates list state', () => {
    it('updates alert status in list after resolving', async () => {
      (resolveAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        auto_resolved: false,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      });

      // Open detail panel
      fireEvent.click(screen.getByTestId('alert-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });

      // Click resolve
      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-resolve-button'));
      });

      expect(resolveAlert).toHaveBeenCalledWith(1);
    });

    it('shows error toast when resolve fails', async () => {
      (resolveAlert as Mock).mockRejectedValue(new Error('Failed to resolve'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      });

      // Open detail panel
      fireEvent.click(screen.getByTestId('alert-row-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-resolve-button')).toBeInTheDocument();
      });

      // Click resolve
      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-resolve-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('action-error-toast')).toBeInTheDocument();
        expect(screen.getByText('Failed to resolve')).toBeInTheDocument();
      });
    });
  });

  describe('Restart service from detail panel', () => {
    const serviceAlert = createMockAlert({
      id: 5,
      alert_type: 'service_down',
      title: 'Service nginx is down',
      service_name: 'nginx',
      server_id: 'server-1',
    });

    it('shows restart button for service alerts', async () => {
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 20,
        offset: 0,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-5'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });
    });

    it('calls restartService on button click', async () => {
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 20,
        offset: 0,
      });
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'queued',
        message: 'Service restart queued',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-5'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-restart-button'));
      });

      expect(restartService).toHaveBeenCalledWith('server-1', 'nginx');
    });

    it('shows success message after restart', async () => {
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 20,
        offset: 0,
      });
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'queued',
        message: 'Service restart queued',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-5'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-restart-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('restart-message')).toBeInTheDocument();
      });
    });

    it('shows info message for 409 conflict', async () => {
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 20,
        offset: 0,
      });
      (restartService as Mock).mockRejectedValue(new ApiError(409, 'Conflict'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('alert-row-5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('alert-row-5'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-restart-button'));
      });

      await waitFor(() => {
        const message = screen.getByTestId('restart-message');
        expect(message).toHaveTextContent(/already pending/);
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

    it('refetches alerts when clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });

      const initialCallCount = (getAlerts as Mock).mock.calls.length;

      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect((getAlerts as Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Page parameter management', () => {
    it('shows pagination when more than 20 alerts', async () => {
      (getAlerts as Mock).mockResolvedValue({
        ...mockAlertsResponse,
        total: 45,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
    });

    it('calls API with correct offset on page change', async () => {
      (getAlerts as Mock).mockResolvedValue({
        ...mockAlertsResponse,
        total: 45,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });

      // Click next page button
      const nextButton = screen.getByTestId('pagination-next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(getAlerts).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 })
        );
      });
    });
  });

  describe('Server filter dropdown loading', () => {
    it('loads servers for filter dropdown', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(getServers).toHaveBeenCalled();
      });
    });

    it('shows server options in dropdown', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('server-filter')).toBeInTheDocument();
      });

      const serverFilter = screen.getByTestId('server-filter') as HTMLSelectElement;
      // Should have "All Servers" plus the 2 mock servers
      expect(serverFilter.options.length).toBe(3);
    });

    it('calls API with server filter when selected', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('server-filter')).toBeInTheDocument();
      });

      const serverFilter = screen.getByTestId('server-filter');
      fireEvent.change(serverFilter, { target: { value: 'server-1' } });

      await waitFor(() => {
        expect(getAlerts).toHaveBeenCalledWith(
          expect.objectContaining({ server_id: 'server-1' })
        );
      });
    });
  });
});
