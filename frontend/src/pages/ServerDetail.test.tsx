import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServerDetail } from './ServerDetail';
import * as serversApi from '../api/servers';
import type { ServerDetail as ServerDetailType } from '../types/server';

// Mock the API
vi.mock('../api/servers');

const mockServer: ServerDetailType = {
  id: 'test-server',
  hostname: 'test-server.local',
  display_name: 'Test Server',
  ip_address: '192.168.1.100',
  status: 'online',
  is_paused: false,
  paused_at: null,
  last_seen: new Date().toISOString(),
  os_distribution: 'Ubuntu',
  os_version: '22.04',
  kernel_version: '5.15.0-generic',
  architecture: 'x86_64',
  cpu_model: 'Intel Core i5-8250U',
  cpu_cores: 4,
  machine_category: 'office_desktop',
  machine_category_source: 'auto',
  idle_watts: 40,
  tdp_watts: 65,
  updates_available: null,
  security_updates: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-18T12:00:00Z',
  latest_metrics: {
    cpu_percent: 45.5,
    memory_percent: 67.2,
    disk_percent: 35.0,
    uptime_seconds: 1234567,
    memory_total_mb: null,
    memory_used_mb: null,
    disk_total_gb: null,
    disk_used_gb: null,
    network_rx_bytes: null,
    network_tx_bytes: null,
    load_1m: null,
    load_5m: null,
    load_15m: null,
  },
};

function renderWithRouter(serverId: string = 'test-server') {
  return render(
    <MemoryRouter initialEntries={[`/servers/${serverId}`]}>
      <Routes>
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        <Route path="/servers/:serverId" element={<ServerDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ServerDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading state', () => {
    it('displays loading spinner initially', () => {
      vi.mocked(serversApi.getServer).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithRouter();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('displays error message on fetch failure', async () => {
      vi.mocked(serversApi.getServer).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('displays retry button on error', async () => {
      vi.mocked(serversApi.getServer).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button is clicked', async () => {
      vi.mocked(serversApi.getServer)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });
  });

  describe('Not found state', () => {
    it('displays not found message for 404', async () => {
      vi.mocked(serversApi.getServer).mockRejectedValue(new Error('404 Not Found'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('not-found-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Server not found')).toBeInTheDocument();
    });
  });

  describe('Success state', () => {
    beforeEach(() => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
    });

    it('displays server name in header', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });

    it('displays server information card', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('server-info-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('hostname')).toHaveTextContent('test-server.local');
      expect(screen.getByTestId('ip-address')).toHaveTextContent('192.168.1.100');
    });

    it('displays system information card', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('system-info-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('os-info')).toHaveTextContent('Ubuntu 22.04');
      expect(screen.getByTestId('kernel-version')).toHaveTextContent('5.15.0-generic');
      expect(screen.getByTestId('architecture')).toHaveTextContent('x86_64');
    });

    it('displays resource utilisation gauges', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('resource-utilisation-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('gauge-cpu')).toBeInTheDocument();
      expect(screen.getByTestId('gauge-ram')).toBeInTheDocument();
      expect(screen.getByTestId('gauge-disk')).toBeInTheDocument();
    });

  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
    });

    it('navigates back when back button is clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh', () => {
    beforeEach(() => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
    });

    it('refetches data when refresh button is clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });

      expect(serversApi.getServer).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(serversApi.getServer).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Offline server', () => {
    it('displays offline warning when server is offline', async () => {
      const offlineServer = {
        ...mockServer,
        status: 'offline' as const,
        last_seen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(offlineServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('offline-warning')).toBeInTheDocument();
      });
    });
  });

  describe('Null metrics', () => {
    it('handles server with no metrics', async () => {
      const serverNoMetrics = {
        ...mockServer,
        latest_metrics: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoMetrics);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('gauge-cpu-value')).toHaveTextContent('--');
      });
      expect(screen.getByTestId('gauge-ram-value')).toHaveTextContent('--');
      expect(screen.getByTestId('gauge-disk-value')).toHaveTextContent('--');
    });
  });

  describe('Polling', () => {
    it('polls for updates every 30 seconds', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });

      expect(serversApi.getServer).toHaveBeenCalledTimes(1);

      // Advance time by 30 seconds - wrap in act() to handle state updates
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(serversApi.getServer).toHaveBeenCalledTimes(2);
      });
    });
  });

  /**
   * Package update panel in server detail view (TC083)
   * Spec Reference: sdlc-studio/testing/specs/TSP0006-server-detail-charts.md
   * Note: System updates are now displayed via PackageList component.
   * Full package list testing is in PackageList.test.tsx.
   */
  describe('System Updates card (TC083)', () => {
    it('displays package list panel', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
      vi.mocked(serversApi.getServerPackages).mockResolvedValue({
        server_id: 'test-server',
        last_checked: new Date().toISOString(),
        total_count: 12,
        security_count: 3,
        packages: [],
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('package-list-panel')).toBeInTheDocument();
      });
    });

    it('displays package list toggle button', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
      vi.mocked(serversApi.getServerPackages).mockResolvedValue({
        server_id: 'test-server',
        last_checked: new Date().toISOString(),
        total_count: 12,
        security_count: 3,
        packages: [],
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('package-list-toggle')).toBeInTheDocument();
      });
    });

    it('shows empty message when no packages available', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
      vi.mocked(serversApi.getServerPackages).mockResolvedValue({
        server_id: 'test-server',
        last_checked: new Date().toISOString(),
        total_count: 0,
        security_count: 0,
        packages: [],
      });

      renderWithRouter();

      // Panel is expanded by default, so we should see the empty state
      await waitFor(() => {
        expect(screen.getByTestId('package-list-empty')).toBeInTheDocument();
      });
    });

    it('shows error message on fetch failure', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
      vi.mocked(serversApi.getServerPackages).mockRejectedValue(new Error('Failed to fetch'));

      renderWithRouter();

      // Panel is expanded by default, so we should see the error state
      await waitFor(() => {
        expect(screen.getByTestId('package-list-error')).toBeInTheDocument();
      });
    });

    it('does not display system updates card when data is null', async () => {
      const serverNoUpdateData = {
        ...mockServer,
        updates_available: null,
        security_updates: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoUpdateData);
      vi.mocked(serversApi.getServerPackages).mockResolvedValue({
        server_id: 'test-server',
        last_checked: null,
        total_count: 0,
        security_count: 0,
        packages: [],
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
      // Package list panel should still be present
      expect(screen.getByTestId('package-list-panel')).toBeInTheDocument();
    });
  });

  /**
   * Maintenance mode tests (US0029 AC5)
   * Spec Reference: sdlc-studio/stories/US0029-server-maintenance-mode.md
   */
  describe('Maintenance mode (US0029 AC5)', () => {
    it('displays maintenance mode status as Disabled when not paused', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Disabled');
      });
    });

    it('displays maintenance mode status as Enabled when paused', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(pausedServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Enabled');
      });
    });

    it('displays Enable button when server is not paused', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-toggle')).toHaveTextContent('Enable');
      });
    });

    it('displays Disable button when server is paused', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(pausedServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-toggle')).toHaveTextContent('Disable');
      });
    });

    it('shows paused_at timestamp when server is paused', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(pausedServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('paused-at')).toBeInTheDocument();
      });
    });

    it('does not show paused_at timestamp when server is not paused', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('paused-at')).not.toBeInTheDocument();
    });

    it('calls pauseServer when Enable button is clicked', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
      vi.mocked(serversApi.pauseServer).mockResolvedValue(pausedServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-toggle')).toHaveTextContent('Enable');
      });

      fireEvent.click(screen.getByTestId('maintenance-toggle'));

      await waitFor(() => {
        expect(serversApi.pauseServer).toHaveBeenCalledWith('test-server');
      });
    });

    it('calls unpauseServer when Disable button is clicked', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(pausedServer);
      vi.mocked(serversApi.unpauseServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-toggle')).toHaveTextContent('Disable');
      });

      fireEvent.click(screen.getByTestId('maintenance-toggle'));

      await waitFor(() => {
        expect(serversApi.unpauseServer).toHaveBeenCalledWith('test-server');
      });
    });

    it('updates UI after toggling maintenance mode', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
      vi.mocked(serversApi.pauseServer).mockResolvedValue(pausedServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Disabled');
      });

      fireEvent.click(screen.getByTestId('maintenance-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Enabled');
      });
    });

    it('applies warning colour to Enabled status', async () => {
      const pausedServer = {
        ...mockServer,
        is_paused: true,
        paused_at: '2026-01-19T10:00:00Z',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(pausedServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('maintenance-status')).toHaveClass('text-status-warning');
      });
    });
  });

  /**
   * Agent information tests
   */
  describe('Agent information', () => {
    it('displays agent version when present', async () => {
      const serverWithAgent = {
        ...mockServer,
        agent_version: '1.2.3',
        agent_mode: 'readwrite' as const,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithAgent);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('agent-version')).toHaveTextContent('1.2.3');
      });
    });

    it('displays agent mode as Read/Write', async () => {
      const serverWithAgent = {
        ...mockServer,
        agent_version: '1.2.3',
        agent_mode: 'readwrite' as const,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithAgent);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('agent-mode')).toHaveTextContent('Read/Write');
      });
    });

    it('displays agent mode as Read Only with notice', async () => {
      const serverWithAgent = {
        ...mockServer,
        agent_version: '1.2.3',
        agent_mode: 'readonly' as const,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithAgent);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('agent-mode')).toHaveTextContent('Read Only');
      });
      expect(screen.getByTestId('readonly-notice')).toBeInTheDocument();
    });

    it('shows install agent button for Tailscale imports', async () => {
      const tailscaleServer = {
        ...mockServer,
        agent_version: null,
        tailscale_hostname: 'server.tail123.ts.net',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(tailscaleServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('install-agent-button')).toBeInTheDocument();
      });
    });
  });

  /**
   * Inactive server tests (BG0012, BG0013)
   */
  describe('Inactive server', () => {
    const inactiveServer = {
      ...mockServer,
      is_inactive: true,
      ip_address: '192.168.1.100',
    };

    it('displays inactive status', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(inactiveServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('shows reactivate button for inactive server', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(inactiveServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('reactivate-server-button')).toBeInTheDocument();
      });
    });

    it('shows reinstall agent button for inactive server with IP', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(inactiveServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('reinstall-agent-button')).toBeInTheDocument();
      });
    });

    it('shows delete server button for inactive server', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(inactiveServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('delete-server-button')).toBeInTheDocument();
      });
    });
  });

  /**
   * Network I/O card tests
   */
  describe('Network I/O', () => {
    it('displays network I/O card', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('network-io-card')).toBeInTheDocument();
      });
    });

    it('displays network RX and TX values', async () => {
      const serverWithNetworkMetrics = {
        ...mockServer,
        latest_metrics: {
          ...mockServer.latest_metrics,
          network_rx_bytes: 1024 * 1024 * 500, // 500 MB
          network_tx_bytes: 1024 * 1024 * 100, // 100 MB
        },
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithNetworkMetrics);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('network-rx')).toBeInTheDocument();
        expect(screen.getByTestId('network-tx')).toBeInTheDocument();
      });
    });
  });

  /**
   * Load average card tests
   */
  describe('Load average', () => {
    it('displays load average card', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('load-average-card')).toBeInTheDocument();
      });
    });

    it('displays load average values when present', async () => {
      const serverWithLoadMetrics = {
        ...mockServer,
        latest_metrics: {
          ...mockServer.latest_metrics,
          load_1m: 0.5,
          load_5m: 0.7,
          load_15m: 0.9,
        },
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithLoadMetrics);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('load-1m')).toHaveTextContent('0.50');
        expect(screen.getByTestId('load-5m')).toHaveTextContent('0.70');
        expect(screen.getByTestId('load-15m')).toHaveTextContent('0.90');
      });
    });
  });

  /**
   * Historical metrics tests
   */
  describe('Historical metrics', () => {
    it('displays historical metrics card', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('historical-metrics-card')).toBeInTheDocument();
      });
    });
  });

  /**
   * Power configuration tests (US0033, US0056)
   */
  describe('Power configuration', () => {
    it('displays power edit button', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('power-edit-button')).toBeInTheDocument();
      });
    });

    it('displays TDP when configured', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('tdp-display')).toBeInTheDocument();
      });
    });

    it('displays daily cost when TDP configured', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('daily-cost')).toBeInTheDocument();
      });
    });
  });

  /**
   * CPU information tests (US0056)
   */
  describe('CPU information', () => {
    it('displays CPU model', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-model')).toHaveTextContent('Intel Core i5-8250U');
      });
    });

    it('displays CPU cores when present', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-cores')).toHaveTextContent('4');
      });
    });
  });
});
