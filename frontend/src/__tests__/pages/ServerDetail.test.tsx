/**
 * Tests for ServerDetail page component.
 *
 * Tests server details, maintenance mode, SSH connection, power configuration,
 * agent management, view modes, and metrics history.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ServerDetail } from '../../pages/ServerDetail';
import { getServer, getMetricsHistory, pauseServer, unpauseServer } from '../../api/servers';
import { getCostConfig } from '../../api/costs';
import { getAgentVersion, activateServer } from '../../api/agents';
import { testSSHConnection } from '../../api/ssh';
import type { ServerDetail as ServerDetailType, MetricsHistoryResponse } from '../../types/server';
import type { CostConfig } from '../../types/cost';

// Mock the APIs
vi.mock('../../api/servers', () => ({
  getServer: vi.fn(),
  getMetricsHistory: vi.fn(),
  pauseServer: vi.fn(),
  unpauseServer: vi.fn(),
  updateServer: vi.fn(),
}));

vi.mock('../../api/costs', () => ({
  getCostConfig: vi.fn(),
}));

vi.mock('../../api/agents', () => ({
  getAgentVersion: vi.fn(),
  activateServer: vi.fn(),
}));

vi.mock('../../api/ssh', () => ({
  testSSHConnection: vi.fn(),
}));

// Mock useIsMobile hook
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

const mockGetServer = getServer as Mock;
const mockGetMetricsHistory = getMetricsHistory as Mock;
const mockPauseServer = pauseServer as Mock;
const mockUnpauseServer = unpauseServer as Mock;
const mockGetCostConfig = getCostConfig as Mock;
const mockGetAgentVersion = getAgentVersion as Mock;
const mockActivateServer = activateServer as Mock;
const mockTestSSHConnection = testSSHConnection as Mock;

// Factory for mock server data
function createMockServer(overrides: Partial<ServerDetailType> = {}): ServerDetailType {
  return {
    id: 'server-1',
    guid: 'guid-1',
    hostname: 'test-server',
    display_name: 'Test Server',
    status: 'online',
    is_paused: false,
    paused_at: null,
    is_inactive: false,
    inactive_since: null,
    agent_version: '1.0.0',
    agent_mode: 'readonly',
    last_seen: '2026-01-29T10:00:00Z',
    ip_address: '192.168.1.100',
    tailscale_hostname: null,
    os_distribution: 'Ubuntu',
    os_version: '22.04',
    kernel_version: '5.15.0-91-generic',
    architecture: 'x86_64',
    cpu_model: 'Intel Core i7-12700',
    cpu_cores: 8,
    machine_type: 'server',
    machine_category: 'desktop',
    machine_category_source: 'detected',
    tdp_watts: 65,
    idle_watts: 25,
    updates_available: 0,
    security_updates: 0,
    latest_metrics: {
      cpu_percent: 25,
      memory_percent: 50,
      memory_total_mb: 16384,
      memory_used_mb: 8192,
      disk_percent: 40,
      disk_total_gb: 500,
      disk_used_gb: 200,
      network_rx_bytes: 1000000,
      network_tx_bytes: 500000,
      load_1m: 0.5,
      load_5m: 0.4,
      load_15m: 0.3,
      uptime_seconds: 86400,
    },
    ...overrides,
  };
}

const mockCostConfig: CostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  currency_code: 'GBP',
  track_costs: true,
};

const mockMetricsHistory: MetricsHistoryResponse = {
  server_id: 'server-1',
  time_range: '24h',
  data_points: [
    {
      timestamp: '2026-01-29T09:00:00Z',
      cpu_percent: 20,
      memory_percent: 45,
      disk_percent: 40,
    },
    {
      timestamp: '2026-01-29T10:00:00Z',
      cpu_percent: 25,
      memory_percent: 50,
      disk_percent: 40,
    },
  ],
};

function renderServerDetail(serverId = 'server-1') {
  return render(
    <MemoryRouter initialEntries={[`/servers/${serverId}`]}>
      <Routes>
        <Route path="/servers/:serverId" element={<ServerDetail />} />
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ServerDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetServer.mockResolvedValue(createMockServer());
    mockGetMetricsHistory.mockResolvedValue(mockMetricsHistory);
    mockGetCostConfig.mockResolvedValue(mockCostConfig);
    mockGetAgentVersion.mockResolvedValue({ version: '1.0.0' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching server', () => {
      mockGetServer.mockImplementation(() => new Promise(() => {}));

      renderServerDetail();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Not found state', () => {
    it('shows not found message for 404 response', async () => {
      mockGetServer.mockRejectedValue(new Error('404 Not Found'));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('not-found-message')).toBeInTheDocument();
      });
      expect(screen.getByText(/Server not found/i)).toBeInTheDocument();
    });

    it('has back button in not found state', async () => {
      mockGetServer.mockRejectedValue(new Error('404 Not Found'));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });

  describe('Error state', () => {
    it('shows error message when fetch fails', async () => {
      mockGetServer.mockRejectedValue(new Error('Network error'));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      mockGetServer.mockRejectedValue(new Error('Failed to fetch'));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });
    });

    it('refetches when retry is clicked', async () => {
      mockGetServer.mockRejectedValueOnce(new Error('Failed'));
      mockGetServer.mockResolvedValueOnce(createMockServer());

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(mockGetServer).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Server information card', () => {
    it('renders server info card', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('server-info-card')).toBeInTheDocument();
      });
    });

    it('shows hostname', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('hostname')).toHaveTextContent('test-server');
      });
    });

    it('shows IP address when available', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('ip-address')).toHaveTextContent('192.168.1.100');
      });
    });

    it('shows last seen timestamp', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('last-seen')).toBeInTheDocument();
      });
    });
  });

  describe('System information card', () => {
    it('renders system info card', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('system-info-card')).toBeInTheDocument();
      });
    });

    it('shows OS info', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('os-info')).toHaveTextContent('Ubuntu 22.04');
      });
    });

    it('shows kernel version', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('kernel-version')).toHaveTextContent('5.15.0-91-generic');
      });
    });

    it('shows architecture', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('architecture')).toHaveTextContent('x86_64');
      });
    });

    it('shows CPU model', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-model')).toHaveTextContent('Intel Core i7-12700');
      });
    });

    it('shows CPU cores', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-cores')).toHaveTextContent('8');
      });
    });

    it('shows uptime', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('uptime')).toBeInTheDocument();
      });
    });
  });

  describe('Offline server warning', () => {
    it('shows offline warning for offline servers', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ status: 'offline', last_seen: '2026-01-28T10:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('offline-warning')).toBeInTheDocument();
      });
    });

    it('does not show offline warning for online servers', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('server-info-card')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('offline-warning')).not.toBeInTheDocument();
    });
  });

  describe('Maintenance mode (US0029)', () => {
    it('shows maintenance mode status', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Disabled');
      });
    });

    it('shows Enabled when server is paused', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_paused: true, paused_at: '2026-01-29T09:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Enabled');
      });
    });

    it('shows paused_at timestamp when paused', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_paused: true, paused_at: '2026-01-29T09:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('paused-at')).toBeInTheDocument();
      });
    });

    it('toggles maintenance mode on button click', async () => {
      const pausedServer = createMockServer({ is_paused: true });
      mockPauseServer.mockResolvedValue(pausedServer);

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('maintenance-toggle'));

      await waitFor(() => {
        expect(mockPauseServer).toHaveBeenCalledWith('server-1');
      });
    });

    it('calls unpauseServer when disabling maintenance', async () => {
      mockGetServer.mockResolvedValue(createMockServer({ is_paused: true }));
      const unpausedServer = createMockServer({ is_paused: false });
      mockUnpauseServer.mockResolvedValue(unpausedServer);

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-toggle')).toHaveTextContent('Disable');
      });

      fireEvent.click(screen.getByTestId('maintenance-toggle'));

      await waitFor(() => {
        expect(mockUnpauseServer).toHaveBeenCalledWith('server-1');
      });
    });
  });

  describe('Tailscale and SSH connection (US0079)', () => {
    it('shows tailscale hostname when available', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ tailscale_hostname: 'server1.tailnet.ts.net' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('tailscale-hostname')).toHaveTextContent('server1.tailnet.ts.net');
      });
    });

    it('shows Test SSH button when tailscale_hostname is set', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ tailscale_hostname: 'server1.tailnet.ts.net' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });
    });

    it('tests SSH connection on button click', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ tailscale_hostname: 'server1.tailnet.ts.net' })
      );
      mockTestSSHConnection.mockResolvedValue({
        success: true,
        hostname: 'server1.tailnet.ts.net',
        latency_ms: 50,
        host_key_fingerprint: 'SHA256:abc123',
        error: null,
        attempts: 1,
      });

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-ssh-button'));

      await waitFor(() => {
        expect(mockTestSSHConnection).toHaveBeenCalledWith('server-1');
      });
    });

    it('shows SSH test success result', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ tailscale_hostname: 'server1.tailnet.ts.net' })
      );
      mockTestSSHConnection.mockResolvedValue({
        success: true,
        hostname: 'server1.tailnet.ts.net',
        latency_ms: 50,
        host_key_fingerprint: 'SHA256:abc123',
        error: null,
        attempts: 1,
      });

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-ssh-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ssh-test-result')).toBeInTheDocument();
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('shows SSH test failure result', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ tailscale_hostname: 'server1.tailnet.ts.net' })
      );
      mockTestSSHConnection.mockResolvedValue({
        success: false,
        hostname: 'server1.tailnet.ts.net',
        latency_ms: null,
        host_key_fingerprint: null,
        error: 'Connection refused',
        attempts: 3,
      });

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-ssh-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ssh-test-result')).toBeInTheDocument();
        expect(screen.getByText(/Connection refused/i)).toBeInTheDocument();
      });
    });

    it('handles SSH test API error', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ tailscale_hostname: 'server1.tailnet.ts.net' })
      );
      mockTestSSHConnection.mockRejectedValue(new Error('SSH key not configured'));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-ssh-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ssh-test-result')).toBeInTheDocument();
        expect(screen.getByText(/SSH key not configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('Power configuration (US0033, US0056)', () => {
    it('shows power edit button', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('power-edit-button')).toBeInTheDocument();
      });
    });

    it('shows estimated power when TDP is set', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('tdp-display')).toBeInTheDocument();
      });
    });

    it('shows daily cost estimate', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('daily-cost')).toBeInTheDocument();
      });
    });
  });

  describe('Agent management (EP0007)', () => {
    it('shows agent version', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('agent-version')).toHaveTextContent('1.0.0');
      });
    });

    it('shows Unknown when agent_version is null', async () => {
      mockGetServer.mockResolvedValue(createMockServer({ agent_version: null }));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('agent-version')).toHaveTextContent('Unknown');
      });
    });

    it('shows agent mode badge', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('agent-mode')).toBeInTheDocument();
      });
    });

    it('shows readonly notice for readonly agents', async () => {
      mockGetServer.mockResolvedValue(createMockServer({ agent_mode: 'readonly' }));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('readonly-notice')).toBeInTheDocument();
      });
    });

    it('shows upgrade available badge when newer version exists', async () => {
      mockGetAgentVersion.mockResolvedValue({ version: '2.0.0' });

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByText(/Update available/i)).toBeInTheDocument();
      });
    });

    it('shows upgrade button when upgrade is available', async () => {
      mockGetAgentVersion.mockResolvedValue({ version: '2.0.0' });

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('upgrade-agent-button')).toBeInTheDocument();
      });
    });

    it('shows remove agent button', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('remove-agent-button')).toBeInTheDocument();
      });
    });
  });

  describe('Inactive server (BG0012, BG0013)', () => {
    it('shows inactive status badge', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_inactive: true, inactive_since: '2026-01-28T10:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('shows reinstall agent button for inactive server', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_inactive: true, inactive_since: '2026-01-28T10:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('reinstall-agent-button')).toBeInTheDocument();
      });
    });

    it('shows reactivate server button', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_inactive: true, inactive_since: '2026-01-28T10:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('reactivate-server-button')).toBeInTheDocument();
      });
    });

    it('shows delete server button for inactive server', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_inactive: true, inactive_since: '2026-01-28T10:00:00Z' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('delete-server-button')).toBeInTheDocument();
      });
    });

    it('reactivates server on button click', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ is_inactive: true, inactive_since: '2026-01-28T10:00:00Z' })
      );
      mockActivateServer.mockResolvedValue({ success: true });

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('reactivate-server-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('reactivate-server-button'));

      await waitFor(() => {
        expect(mockActivateServer).toHaveBeenCalledWith('server-1');
      });
    });
  });

  describe('Server without agent (Tailscale imports)', () => {
    it('shows install agent button for servers without agent', async () => {
      mockGetServer.mockResolvedValue(
        createMockServer({ agent_version: null, tailscale_hostname: 'server1.ts.net' })
      );

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('install-agent-button')).toBeInTheDocument();
      });
    });
  });

  describe('View mode toggle (EP0012)', () => {
    it('shows classic view by default', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-classic')).toBeInTheDocument();
      });
    });

    it('has widget view button', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toBeInTheDocument();
      });
    });

    it('switches to widget view on click', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('view-mode-widget'));

      // Widget view should now be selected
      await waitFor(() => {
        // The view mode should change
        expect(screen.getByTestId('view-mode-widget')).toHaveClass('bg-bg-tertiary');
      });
    });
  });

  describe('Edit layout mode (US0175)', () => {
    it('shows edit layout button in widget view', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('view-mode-widget'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-layout-button')).toBeInTheDocument();
      });
    });
  });

  describe('Resource utilisation', () => {
    it('shows resource utilisation card', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('resource-utilisation-card')).toBeInTheDocument();
      });
    });
  });

  describe('Network I/O', () => {
    it('shows network I/O card', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('network-io-card')).toBeInTheDocument();
      });
    });

    it('shows network RX bytes', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('network-rx')).toBeInTheDocument();
      });
    });

    it('shows network TX bytes', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('network-tx')).toBeInTheDocument();
      });
    });
  });

  describe('Load average', () => {
    it('shows load average card', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('load-average-card')).toBeInTheDocument();
      });
    });

    it('shows 1 minute load', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('load-1m')).toBeInTheDocument();
      });
    });

    it('shows 5 minute load', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('load-5m')).toBeInTheDocument();
      });
    });

    it('shows 15 minute load', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('load-15m')).toBeInTheDocument();
      });
    });
  });

  describe('Historical metrics', () => {
    it('shows historical metrics card', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('historical-metrics-card')).toBeInTheDocument();
      });
    });

    it('fetches metrics history on load', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(mockGetMetricsHistory).toHaveBeenCalledWith('server-1', '24h');
      });
    });

    it('shows history error message when fetch fails', async () => {
      mockGetMetricsHistory.mockRejectedValue(new Error('Failed to fetch history'));

      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('history-error')).toBeInTheDocument();
      });
    });
  });

  describe('Advanced section', () => {
    it('shows advanced section toggle', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('advanced-toggle')).toBeInTheDocument();
      });
    });

    it('expands advanced section on click', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('advanced-toggle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('advanced-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('agent-security-card')).toBeInTheDocument();
      });
    });
  });

  describe('Back navigation', () => {
    it('has back button', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('navigates to dashboard on back click', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh button', () => {
    it('has refresh button', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });
    });

    it('refetches data on refresh click', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });

      mockGetServer.mockClear();
      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(mockGetServer).toHaveBeenCalledWith('server-1');
      });
    });
  });

  describe('Data fetching', () => {
    it('fetches server data on mount', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(mockGetServer).toHaveBeenCalledWith('server-1');
      });
    });

    it('fetches cost config on mount', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(mockGetCostConfig).toHaveBeenCalled();
      });
    });

    it('fetches agent version on mount', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(mockGetAgentVersion).toHaveBeenCalled();
      });
    });

    it('fetches metrics history when server loads', async () => {
      renderServerDetail();

      await waitFor(() => {
        expect(mockGetMetricsHistory).toHaveBeenCalledWith('server-1', '24h');
      });
    });
  });
});
