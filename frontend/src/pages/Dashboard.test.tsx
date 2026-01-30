import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { getServers } from '../api/servers';
import { getAlerts, acknowledgeAlert, resolveAlert, getPendingBreaches } from '../api/alerts';
import { getActions, approveAction, rejectAction } from '../api/actions';
import { restartService } from '../api/services';
import { ApiError } from '../api/client';
import type { ServersResponse } from '../types/server';
import type { AlertsResponse, Alert } from '../types/alert';
import type { ActionsResponse, Action } from '../types/action';

vi.mock('../api/servers', () => ({
  getServers: vi.fn(),
}));

vi.mock('../api/alerts', () => ({
  getAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  getPendingBreaches: vi.fn(),
}));

vi.mock('../api/services', () => ({
  restartService: vi.fn(),
}));

vi.mock('../api/actions', () => ({
  getActions: vi.fn(),
  approveAction: vi.fn(),
  rejectAction: vi.fn(),
}));

vi.mock('../api/costs', () => ({
  getCostSummary: vi.fn().mockResolvedValue({
    daily_cost: 0.50,
    monthly_cost: 15.00,
    yearly_cost: 180.00,
    currency: 'GBP',
    last_updated: new Date().toISOString(),
  }),
}));

// US0136: Mock the useDashboardPreferences hook
vi.mock('../hooks/useDashboardPreferences', () => ({
  useDashboardPreferences: vi.fn().mockReturnValue({
    preferences: {
      card_order: { servers: [], workstations: [] },
      collapsed_sections: [],
      view_mode: 'grid',
      updated_at: null,
    },
    isLoading: false,
    loadError: null,
    isSaving: false,
    showSavedIndicator: false,
    saveError: null,
    updateCardOrder: vi.fn(),
    updateCollapsedSections: vi.fn(),
    retrySave: vi.fn(),
    dismissSaveError: vi.fn(),
  }),
}));

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

const mockServersResponse: ServersResponse = {
  servers: [
    {
      id: 'server-1',
      hostname: 'server-1.local',
      display_name: 'Test Server 1',
      status: 'online',
      is_paused: false,
      is_inactive: false,
      inactive_since: null,
      agent_version: '1.0.0',
      agent_mode: 'readwrite',
      updates_available: null,
      security_updates: null,
      last_seen: new Date().toISOString(),
      active_alert_count: 0,
      machine_type: 'server',
      latest_metrics: {
        cpu_percent: 45.5,
        memory_percent: 67.2,
        disk_percent: 35.0,
        memory_total_mb: null,
        memory_used_mb: null,
        disk_total_gb: null,
        disk_used_gb: null,
        network_rx_bytes: null,
        network_tx_bytes: null,
        load_1m: null,
        load_5m: null,
        load_15m: null,
        uptime_seconds: 86400 * 5 + 3600 * 2,
      },
    },
    {
      id: 'server-2',
      hostname: 'server-2.local',
      display_name: 'Test Server 2',
      status: 'offline',
      is_paused: false,
      is_inactive: false,
      inactive_since: null,
      agent_version: '1.0.0',
      agent_mode: 'readwrite',
      updates_available: null,
      security_updates: null,
      last_seen: null,
      active_alert_count: 0,
      machine_type: 'server',
      latest_metrics: {
        cpu_percent: 0,
        memory_percent: 0,
        disk_percent: 50.0,
        memory_total_mb: null,
        memory_used_mb: null,
        disk_total_gb: null,
        disk_used_gb: null,
        network_rx_bytes: null,
        network_tx_bytes: null,
        load_1m: null,
        load_5m: null,
        load_15m: null,
        uptime_seconds: 0,
      },
    },
    {
      id: 'server-3',
      hostname: 'server-3.local',
      display_name: null,
      status: 'unknown',
      is_paused: false,
      is_inactive: false,
      inactive_since: null,
      agent_version: null,
      agent_mode: null,
      updates_available: null,
      security_updates: null,
      last_seen: null,
      active_alert_count: 0,
      machine_type: 'workstation',
      latest_metrics: null,
    },
  ],
  total: 3,
};

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
    createMockAlert({ id: 2, severity: 'high', title: 'RAM usage at 87%' }),
    createMockAlert({ id: 3, severity: 'medium', title: 'CPU spike detected' }),
  ],
  total: 3,
  limit: 50,
  offset: 0,
};

const emptyAlertsResponse: AlertsResponse = {
  alerts: [],
  total: 0,
  limit: 50,
  offset: 0,
};

function createMockAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    server_id: 'server-1',
    action_type: 'restart_service',
    status: 'pending',
    service_name: 'plex',
    command: 'systemctl restart plex',
    alert_id: null,
    created_at: new Date().toISOString(),
    created_by: 'dashboard',
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    executed_at: null,
    completed_at: null,
    exit_code: null,
    stdout: null,
    stderr: null,
    ...overrides,
  };
}

const emptyActionsResponse: ActionsResponse = {
  actions: [],
  total: 0,
  limit: 50,
  offset: 0,
};

const mockActionsResponse: ActionsResponse = {
  actions: [
    createMockAction({ id: 1, server_id: 'server-1', service_name: 'plex' }),
    createMockAction({ id: 2, server_id: 'server-2', service_name: 'nginx' }),
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAlerts as Mock).mockResolvedValue(emptyAlertsResponse);
    (getPendingBreaches as Mock).mockResolvedValue({ pending: [], total: 0 });
    (getActions as Mock).mockResolvedValue(emptyActionsResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading state', () => {
    it('renders loading spinner on initial load', async () => {
      // Create a promise that never resolves to keep loading state
      let resolvePromise: (value: ServersResponse) => void;
      (getServers as Mock).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      renderWithRouter();

      // Find the container with the spinner
      const container = document.querySelector('.flex.items-center.justify-center.min-h-screen');
      expect(container).toBeInTheDocument();

      // Clean up by resolving the promise
      await act(async () => {
        resolvePromise!(mockServersResponse);
      });
    });

    it('displays loading spinner with correct styling', async () => {
      let resolvePromise: (value: ServersResponse) => void;
      (getServers as Mock).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      renderWithRouter();

      // Find the spinner (Loader2 has animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();

      await act(async () => {
        resolvePromise!(mockServersResponse);
      });
    });
  });

  describe('Error state', () => {
    it('renders error state when API fails with no cached data', async () => {
      (getServers as Mock).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      expect(await screen.findByText('Network error')).toBeInTheDocument();
    });

    it('renders retry button on error', async () => {
      (getServers as Mock).mockRejectedValue(new Error('API failed'));

      renderWithRouter();

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('renders error icon when API fails', async () => {
      (getServers as Mock).mockRejectedValue(new Error('Server error'));

      renderWithRouter();

      // Wait for error state to appear
      await screen.findByText('Server error');

      // AlertCircle icon should be present (check for the error styling)
      const errorIcon = document.querySelector('.text-status-error');
      expect(errorIcon).toBeInTheDocument();
    });

    it('shows generic error message for non-Error exceptions', async () => {
      (getServers as Mock).mockRejectedValue('String error');

      renderWithRouter();

      expect(await screen.findByText('Failed to fetch data')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('renders empty state with guidance text when no servers', async () => {
      (getServers as Mock).mockResolvedValue({ servers: [], total: 0 });

      renderWithRouter();

      expect(
        await screen.findByText(/Deploy the agent to your first server/)
      ).toBeInTheDocument();
    });

    it('renders "No servers registered" heading in empty state', async () => {
      (getServers as Mock).mockResolvedValue({ servers: [], total: 0 });

      renderWithRouter();

      expect(await screen.findByText('No servers registered')).toBeInTheDocument();
    });

    it('renders ServerOff icon in empty state', async () => {
      (getServers as Mock).mockResolvedValue({ servers: [], total: 0 });

      renderWithRouter();

      await screen.findByText('No servers registered');

      // ServerOff icon should be visible with tertiary color
      const icon = document.querySelector('.text-text-tertiary');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Server grid (AC1)', () => {
    it('renders server cards in grid layout', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      // Wait for cards to render
      const cards = await screen.findAllByTestId('server-card');
      expect(cards).toHaveLength(3);
    });

    it('renders correct number of servers', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Each server should have its name displayed
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
      expect(screen.getByText('Test Server 2')).toBeInTheDocument();
      // Server 3 has null display_name, should show hostname
      expect(screen.getByText('server-3.local')).toBeInTheDocument();
    });

    it('applies CSS grid classes to main container', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const gridContainer = document.querySelector('.grid.grid-cols-1');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer).toHaveClass('sm:grid-cols-2');
      expect(gridContainer).toHaveClass('lg:grid-cols-3');
      expect(gridContainer).toHaveClass('xl:grid-cols-4');
    });
  });

  describe('Header', () => {
    it('displays app name in header', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByText('HomelabCmd')).toBeInTheDocument();
    });

    it('displays server count in header', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByText('3 servers')).toBeInTheDocument();
    });

    it('displays singular "server" for single server', async () => {
      (getServers as Mock).mockResolvedValue({
        servers: [mockServersResponse.servers[0]],
        total: 1,
      });

      renderWithRouter();

      await screen.findByTestId('server-card');

      expect(screen.getByText('1 server')).toBeInTheDocument();
    });
  });

  describe('Polling interval', () => {
    it('calls API on initial mount', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // API should have been called at least once
      expect(getServers).toHaveBeenCalled();
    });

    it('continues calling API over time', async () => {
      vi.useFakeTimers();
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      const callsAfterMount = (getServers as Mock).mock.calls.length;

      // Advance by 60 seconds (2 polling intervals)
      await act(async () => {
        vi.advanceTimersByTime(60000);
        await vi.runOnlyPendingTimersAsync();
      });

      // Should have more calls after time passes
      expect((getServers as Mock).mock.calls.length).toBeGreaterThan(callsAfterMount);
    });

    it('clears interval on unmount', async () => {
      vi.useFakeTimers();
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderWithRouter();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Error toast with cached data', () => {
    it('shows error toast when refresh fails but cached data exists', async () => {
      vi.useFakeTimers();
      // First call succeeds (use mockImplementation for consistent behaviour)
      let callCount = 0;
      (getServers as Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(mockServersResponse);
        }
        return Promise.reject(new Error('Refresh failed'));
      });

      renderWithRouter();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Verify cards are showing
      expect(screen.getAllByTestId('server-card')).toHaveLength(3);

      // Advance timer to trigger refresh (which will fail)
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      // Error toast should appear
      expect(screen.getByText(/Unable to refresh/)).toBeInTheDocument();
    });

    it('keeps showing server cards when refresh fails', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      (getServers as Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(mockServersResponse);
        }
        return Promise.reject(new Error('Refresh failed'));
      });

      renderWithRouter();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      // Error toast should appear
      expect(screen.getByText(/Unable to refresh/)).toBeInTheDocument();

      // Cards should still be visible
      const cards = screen.getAllByTestId('server-card');
      expect(cards).toHaveLength(3);
    });
  });

  describe('Alert Banner (US0015)', () => {
    it('shows empty state when no alerts (AC5)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(emptyAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('alert-banner-empty')).toBeInTheDocument();
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    it('shows correct alert count (AC1)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('alert-count')).toHaveTextContent('3 Active Alerts');
    });

    it('displays critical alerts with red styling (AC2)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      // First alert should be critical (sorted by severity)
      expect(alertCards[0]).toHaveAttribute('data-severity', 'critical');
    });

    it('shows alert info on cards (AC3)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByText('Disk usage at 92%')).toBeInTheDocument();
      expect(screen.getAllByText('Test Server 1')[0]).toBeInTheDocument();
    });

    it('acknowledges alert on button click (AC4)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (acknowledgeAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const acknowledgeButtons = screen.getAllByTestId('alert-acknowledge-button');
      await act(async () => {
        fireEvent.click(acknowledgeButtons[0]);
      });

      expect(acknowledgeAlert).toHaveBeenCalledWith(1);
    });

    it('removes alert from list after acknowledge', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      // Mock getAlerts to return fewer alerts on subsequent calls (acknowledged alert not in 'open' results)
      (getAlerts as Mock)
        .mockResolvedValueOnce(mockAlertsResponse)
        .mockResolvedValue({
          ...mockAlertsResponse,
          alerts: mockAlertsResponse.alerts.slice(1), // Remove first alert
          total: 2,
        });
      (acknowledgeAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Initially 3 alerts
      expect(screen.getAllByTestId('alert-card')).toHaveLength(3);

      const acknowledgeButtons = screen.getAllByTestId('alert-acknowledge-button');
      await act(async () => {
        fireEvent.click(acknowledgeButtons[0]);
      });

      // Wait for async acknowledge to complete and alert to be removed
      await waitFor(() => {
        expect(screen.getAllByTestId('alert-card')).toHaveLength(2);
      });
    });

    it('sorts alerts by severity (critical first)', async () => {
      const mixedAlerts: AlertsResponse = {
        alerts: [
          createMockAlert({ id: 1, severity: 'low', title: 'Low alert' }),
          createMockAlert({ id: 2, severity: 'critical', title: 'Critical alert' }),
          createMockAlert({ id: 3, severity: 'high', title: 'High alert' }),
        ],
        total: 3,
        limit: 50,
        offset: 0,
      };

      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mixedAlerts);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      expect(alertCards[0]).toHaveAttribute('data-severity', 'critical');
      expect(alertCards[1]).toHaveAttribute('data-severity', 'high');
      expect(alertCards[2]).toHaveAttribute('data-severity', 'low');
    });

    it('fetches alerts with open status', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(emptyAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(getAlerts).toHaveBeenCalledWith({ status: 'open' });
    });

    it('shows error toast when acknowledge fails', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (acknowledgeAlert as Mock).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const acknowledgeButtons = screen.getAllByTestId('alert-acknowledge-button');
      await act(async () => {
        fireEvent.click(acknowledgeButtons[0]);
      });

      expect(screen.getByTestId('acknowledge-error-toast')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('keeps alert in list when acknowledge fails', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (acknowledgeAlert as Mock).mockRejectedValue(new Error('Failed'));

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Initially 3 alerts
      expect(screen.getAllByTestId('alert-card')).toHaveLength(3);

      const acknowledgeButtons = screen.getAllByTestId('alert-acknowledge-button');
      await act(async () => {
        fireEvent.click(acknowledgeButtons[0]);
      });

      // Still 3 alerts (not removed on failure)
      expect(screen.getAllByTestId('alert-card')).toHaveLength(3);
    });

    it('dismisses error toast on button click', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (acknowledgeAlert as Mock).mockRejectedValue(new Error('Failed'));

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const acknowledgeButtons = screen.getAllByTestId('alert-acknowledge-button');
      await act(async () => {
        fireEvent.click(acknowledgeButtons[0]);
      });

      expect(screen.getByTestId('acknowledge-error-toast')).toBeInTheDocument();

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(screen.queryByTestId('acknowledge-error-toast')).not.toBeInTheDocument();
    });

    it('auto-dismisses error toast after 5 seconds', async () => {
      vi.useFakeTimers();
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (acknowledgeAlert as Mock).mockRejectedValue(new Error('Failed'));

      renderWithRouter();

      // Wait for initial data fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      const acknowledgeButtons = screen.getAllByTestId('alert-acknowledge-button');

      // Click acknowledge - this triggers the async handler
      fireEvent.click(acknowledgeButtons[0]);

      // Flush microtasks to allow the async handler and promise rejection
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('acknowledge-error-toast')).toBeInTheDocument();

      // Advance past 5 second timeout
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.queryByTestId('acknowledge-error-toast')).not.toBeInTheDocument();
    });
  });

  /**
   * Pending Actions Panel tests (US0030)
   * Spec Reference: sdlc-studio/stories/US0030-pending-actions-panel.md
   */
  describe('Pending Actions Panel (US0030)', () => {
    it('does not show panel when no pending actions (AC2)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(emptyActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.queryByTestId('pending-actions-panel')).not.toBeInTheDocument();
    });

    it('shows panel when pending actions exist (AC1)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('pending-actions-panel')).toBeInTheDocument();
    });

    it('displays correct action count', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('pending-actions-count')).toHaveTextContent('Pending Actions (2)');
    });

    it('fetches actions on load', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(emptyActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Dashboard fetches all actions and filters client-side
      expect(getActions).toHaveBeenCalled();
    });

    it('removes action from list after approve (AC4)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      // Mock getActions to return approved action on subsequent calls
      (getActions as Mock)
        .mockResolvedValueOnce(mockActionsResponse)
        .mockResolvedValue({
          ...mockActionsResponse,
          actions: [
            { ...mockActionsResponse.actions[0], status: 'approved' },
            mockActionsResponse.actions[1],
          ],
        });
      (approveAction as Mock).mockResolvedValue({
        ...mockActionsResponse.actions[0],
        status: 'approved',
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Initially 2 actions
      expect(screen.getByTestId('pending-action-1')).toBeInTheDocument();
      expect(screen.getByTestId('pending-action-2')).toBeInTheDocument();

      const approveButtons = screen.getAllByTestId('approve-button');
      await act(async () => {
        fireEvent.click(approveButtons[0]);
      });

      // Wait for async approve to complete and action to be removed
      await waitFor(() => {
        expect(screen.queryByTestId('pending-action-1')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('pending-action-2')).toBeInTheDocument();
    });

    it('calls approveAction API on approve button click', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);
      (approveAction as Mock).mockResolvedValue({
        ...mockActionsResponse.actions[0],
        status: 'approved',
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const approveButtons = screen.getAllByTestId('approve-button');
      await act(async () => {
        fireEvent.click(approveButtons[0]);
      });

      expect(approveAction).toHaveBeenCalledWith(1);
    });

    it('shows reject modal when reject button clicked (AC5)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const rejectButtons = screen.getAllByTestId('reject-button');
      fireEvent.click(rejectButtons[0]);

      expect(screen.getByTestId('reject-modal')).toBeInTheDocument();
    });

    it('closes reject modal on cancel', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const rejectButtons = screen.getAllByTestId('reject-button');
      fireEvent.click(rejectButtons[0]);

      expect(screen.getByTestId('reject-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('reject-modal-cancel'));

      expect(screen.queryByTestId('reject-modal')).not.toBeInTheDocument();
    });

    it('removes action and closes modal after reject submitted', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);
      (rejectAction as Mock).mockResolvedValue({
        ...mockActionsResponse.actions[0],
        status: 'rejected',
        rejection_reason: 'Not needed',
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Verify both actions are present initially
      expect(screen.getByTestId('pending-action-1')).toBeInTheDocument();
      expect(screen.getByTestId('pending-action-2')).toBeInTheDocument();

      const rejectButtons = screen.getAllByTestId('reject-button');
      await act(async () => {
        fireEvent.click(rejectButtons[0]);
      });

      // Enter reason and submit
      fireEvent.change(screen.getByTestId('reject-reason-input'), {
        target: { value: 'Not needed' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('reject-modal-submit'));
      });

      // Wait for async reject to complete - both modal closes and action removed
      await waitFor(() => {
        expect(screen.queryByTestId('reject-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pending-action-1')).not.toBeInTheDocument();
      });
      // Second action should still be present
      expect(screen.getByTestId('pending-action-2')).toBeInTheDocument();
    });

    it('calls rejectAction API with reason', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);
      (rejectAction as Mock).mockResolvedValue({
        ...mockActionsResponse.actions[0],
        status: 'rejected',
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const rejectButtons = screen.getAllByTestId('reject-button');
      fireEvent.click(rejectButtons[0]);

      fireEvent.change(screen.getByTestId('reject-reason-input'), {
        target: { value: 'Service recovered' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('reject-modal-submit'));
      });

      expect(rejectAction).toHaveBeenCalledWith(1, 'Service recovered');
    });

    it('shows error toast when approve fails', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);
      (approveAction as Mock).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const approveButtons = screen.getAllByTestId('approve-button');
      await act(async () => {
        fireEvent.click(approveButtons[0]);
      });

      expect(screen.getByTestId('action-error-toast')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('restores action to list when approve fails', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getActions as Mock).mockResolvedValue(mockActionsResponse);
      (approveAction as Mock).mockRejectedValue(new Error('Failed'));

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Initially 2 actions
      expect(screen.getByTestId('pending-action-1')).toBeInTheDocument();

      const approveButtons = screen.getAllByTestId('approve-button');
      await act(async () => {
        fireEvent.click(approveButtons[0]);
      });

      // Action should be restored after failure
      expect(screen.getByTestId('pending-action-1')).toBeInTheDocument();
    });
  });

  describe('Alert Detail Panel', () => {
    it('opens alert detail panel when alert card is clicked', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });
    });

    it('closes alert detail panel when close button is clicked', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId('close-panel-button');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('alert-detail-panel')).not.toBeInTheDocument();
      });
    });

    it('resolves alert from detail panel', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (resolveAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        auto_resolved: false,
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });

      const resolveButton = screen.getByTestId('detail-resolve-button');
      await act(async () => {
        fireEvent.click(resolveButton);
      });

      expect(resolveAlert).toHaveBeenCalledWith(1);
    });

    it('removes alert from list after resolving', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue(mockAlertsResponse);
      (resolveAlert as Mock).mockResolvedValue({
        id: 1,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        auto_resolved: false,
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Initially 3 alerts
      expect(screen.getAllByTestId('alert-card')).toHaveLength(3);

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });

      const resolveButton = screen.getByTestId('detail-resolve-button');
      await act(async () => {
        fireEvent.click(resolveButton);
      });

      // Now 2 alerts
      await waitFor(() => {
        expect(screen.getAllByTestId('alert-card')).toHaveLength(2);
      });
    });
  });

  describe('Service restart from alert panel', () => {
    const serviceAlert = createMockAlert({
      id: 4,
      alert_type: 'service_down',
      title: 'Service nginx is down',
      service_name: 'nginx',
      server_id: 'server-1',
    });

    it('shows restart button for service alerts', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 50,
        offset: 0,
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });

      expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
    });

    it('calls restartService API when restart button clicked', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 50,
        offset: 0,
      });
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'queued',
        message: 'Service restart queued',
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-restart-button'));
      });

      expect(restartService).toHaveBeenCalledWith('server-1', 'nginx');
    });

    it('shows success message after restart', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 50,
        offset: 0,
      });
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'queued',
        message: 'Service restart queued',
      });

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

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

    it('shows pending message when server is in maintenance mode', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 50,
        offset: 0,
      });
      (restartService as Mock).mockResolvedValue({
        action_id: 'action-123',
        status: 'pending',
        message: 'Service restart pending approval',
      });
      // Mock getActions for refresh
      (getActions as Mock).mockResolvedValue(emptyActionsResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-restart-button'));
      });

      await waitFor(() => {
        const message = screen.getByTestId('restart-message');
        expect(message).toHaveTextContent(/pending approval/);
      });
    });

    it('shows info message for 409 conflict (already pending)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 50,
        offset: 0,
      });
      const conflictError = new ApiError(409, 'Conflict');
      (restartService as Mock).mockRejectedValue(conflictError);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

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

    it('shows error message on restart failure', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);
      (getAlerts as Mock).mockResolvedValue({
        alerts: [serviceAlert],
        total: 1,
        limit: 50,
        offset: 0,
      });
      (restartService as Mock).mockRejectedValue(new Error('Connection failed'));

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const alertCards = screen.getAllByTestId('alert-card');
      fireEvent.click(alertCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('detail-restart-button')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('detail-restart-button'));
      });

      await waitFor(() => {
        const message = screen.getByTestId('restart-message');
        expect(message).toHaveTextContent(/Connection failed/);
      });
    });
  });

  describe('Navigation', () => {
    it('renders settings button', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });

    it('renders scans link', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('scans-link')).toBeInTheDocument();
    });
  });

  /**
   * Dashboard Filters tests (US0112)
   * Spec Reference: sdlc-studio/stories/US0112-dashboard-search-filter.md
   */
  describe('Dashboard Filters (US0112)', () => {
    it('renders search box and filter chips (AC1, AC3)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      expect(screen.getByTestId('dashboard-filters')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-online')).toBeInTheDocument();
    });

    it('filters servers by search text (AC2)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Initially shows all 3 servers
      expect(screen.getAllByTestId('server-card')).toHaveLength(3);

      // Type in search
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'server-1' } });

      // Should filter to 1 server
      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
    });

    it('search is case-insensitive (AC2)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'SERVER-1' } });

      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
    });

    it('filters by hostname', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: '.local' } });

      // All servers have .local in hostname
      expect(screen.getAllByTestId('server-card')).toHaveLength(3);
    });

    it('filters by display name', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'Test Server 2' } });

      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 2')).toBeInTheDocument();
    });

    it('filters by status (AC3)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Click online filter
      fireEvent.click(screen.getByTestId('status-filter-online'));

      // Only server-1 is online
      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
    });

    it('filters by offline status', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      fireEvent.click(screen.getByTestId('status-filter-offline'));

      // Only server-2 is offline
      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 2')).toBeInTheDocument();
    });

    it('filters by machine type (AC4)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Click workstation filter
      fireEvent.click(screen.getByTestId('type-filter-workstation'));

      // Only server-3 is a workstation
      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('server-3.local')).toBeInTheDocument();
    });

    it('combines search and status filters', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Search for "server" (matches all) and filter to offline
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'server' } });
      fireEvent.click(screen.getByTestId('status-filter-offline'));

      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 2')).toBeInTheDocument();
    });

    it('shows empty state when filters match no servers (AC7)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Search for something that doesn't exist
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.queryByTestId('server-card')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-matches-message')).toBeInTheDocument();
      expect(screen.getByText('No servers match your filters')).toBeInTheDocument();
    });

    it('shows clear filters link in empty state (AC7)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByTestId('clear-filters-link')).toBeInTheDocument();
    });

    it('clear filters link resets filters (AC6)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Apply filter that results in no matches
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.queryByTestId('server-card')).not.toBeInTheDocument();

      // Click clear filters link
      fireEvent.click(screen.getByTestId('clear-filters-link'));

      // Should show all servers again
      expect(screen.getAllByTestId('server-card')).toHaveLength(3);
    });

    it('clear filters button resets all filters (AC6)', async () => {
      (getServers as Mock).mockResolvedValue(mockServersResponse);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      // Apply multiple filters
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'server-1' } });
      fireEvent.click(screen.getByTestId('status-filter-online'));

      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();

      // Clear filters
      fireEvent.click(screen.getByTestId('clear-filters-button'));

      // Should show all servers again
      expect(screen.getAllByTestId('server-card')).toHaveLength(3);
    });

    it('filters by paused status', async () => {
      const serversWithPaused = {
        servers: [
          { ...mockServersResponse.servers[0], is_paused: true },
          ...mockServersResponse.servers.slice(1),
        ],
        total: 3,
      };
      (getServers as Mock).mockResolvedValue(serversWithPaused);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      fireEvent.click(screen.getByTestId('status-filter-paused'));

      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
    });

    it('filters by warning status (online with alerts)', async () => {
      const serversWithWarning = {
        servers: [
          { ...mockServersResponse.servers[0], active_alert_count: 2 },
          ...mockServersResponse.servers.slice(1),
        ],
        total: 3,
      };
      (getServers as Mock).mockResolvedValue(serversWithWarning);

      renderWithRouter();

      await screen.findAllByTestId('server-card');

      fireEvent.click(screen.getByTestId('status-filter-warning'));

      expect(screen.getAllByTestId('server-card')).toHaveLength(1);
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
    });
  });
});
