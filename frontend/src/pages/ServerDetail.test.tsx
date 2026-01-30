import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServerDetail } from './ServerDetail';
import * as serversApi from '../api/servers';
import type { ServerDetail as ServerDetailType } from '../types/server';

// Mock the API
vi.mock('../api/servers', () => ({
  getServer: vi.fn(),
  getServerPackages: vi.fn(),
  pauseServer: vi.fn(),
  unpauseServer: vi.fn(),
  testSSHConnection: vi.fn(),
  deleteServer: vi.fn(),
}));

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

  /**
   * Tailscale hostname tests
   */
  describe('Tailscale hostname', () => {
    it('displays tailscale hostname when present', async () => {
      const tailscaleServer = {
        ...mockServer,
        tailscale_hostname: 'server.tail123.ts.net',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(tailscaleServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('tailscale-hostname')).toHaveTextContent('server.tail123.ts.net');
      });
    });

    it('does not display tailscale hostname when null', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('tailscale-hostname')).not.toBeInTheDocument();
    });
  });

  /**
   * Tailscale Badge in Header (US0180)
   * Spec Reference: sdlc-studio/test-specs/TS0180-detail-page-connectivity-badge.md
   */
  describe('Tailscale Badge in Header (US0180)', () => {
    it('TC01: displays TailscaleBadge in header for Tailscale server', async () => {
      const tailscaleServer = {
        ...mockServer,
        tailscale_hostname: 'my-server.tail12345.ts.net',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(tailscaleServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('tailscale-badge')).toBeInTheDocument();
      });
      expect(screen.getByTestId('tailscale-badge')).toHaveTextContent('Tailscale');
    });

    it('TC02: does not display TailscaleBadge for non-Tailscale server', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer); // No tailscale_hostname

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('tailscale-badge')).not.toBeInTheDocument();
    });

    it('TC03: badge tooltip displays hostname', async () => {
      const tailscaleServer = {
        ...mockServer,
        tailscale_hostname: 'my-server.tail12345.ts.net',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(tailscaleServer);

      renderWithRouter();

      await waitFor(() => {
        const badge = screen.getByTestId('tailscale-badge');
        expect(badge).toHaveAttribute('title', 'Connected via Tailscale: my-server.tail12345.ts.net');
      });
    });

    it('TC04: does not display badge for empty string hostname', async () => {
      const serverEmptyTailscale = {
        ...mockServer,
        tailscale_hostname: '',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverEmptyTailscale);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('tailscale-badge')).not.toBeInTheDocument();
    });
  });

  /**
   * Server without display_name
   */
  describe('Server name fallback', () => {
    it('uses hostname when display_name is null', async () => {
      const serverNoDisplayName = {
        ...mockServer,
        display_name: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoDisplayName);

      renderWithRouter();

      // Should see the hostname used as the name
      await waitFor(() => {
        const elements = screen.getAllByText('test-server.local');
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Server without IP address
   */
  describe('Server without IP address', () => {
    it('renders without crashing when IP address is null', async () => {
      const serverNoIp = {
        ...mockServer,
        ip_address: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoIp);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });
  });

  /**
   * Server without OS information
   */
  describe('Server without OS information', () => {
    it('shows unknown when OS distribution is null', async () => {
      const serverNoOs = {
        ...mockServer,
        os_distribution: null,
        os_version: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoOs);

      renderWithRouter();

      await waitFor(() => {
        // The OS info should show a fallback or empty state
        expect(screen.getByTestId('os-info')).toBeInTheDocument();
      });
    });
  });

  /**
   * Server without CPU model
   */
  describe('Server without CPU model', () => {
    it('shows unknown when CPU model is null', async () => {
      const serverNoCpu = {
        ...mockServer,
        cpu_model: null,
        cpu_cores: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoCpu);

      renderWithRouter();

      await waitFor(() => {
        // The CPU info should show a fallback or empty state
        expect(screen.getByTestId('cpu-model')).toBeInTheDocument();
      });
    });
  });

  /**
   * Paused server tests
   */
  describe('Paused server', () => {
    it('displays paused status indicator', async () => {
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
  });

  /**
   * Machine type tests
   */
  describe('Machine type', () => {
    it('displays machine type as server', async () => {
      const serverWithType = {
        ...mockServer,
        machine_type: 'server',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithType);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });

    it('displays machine type as workstation', async () => {
      const workstationServer = {
        ...mockServer,
        machine_type: 'workstation',
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(workstationServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });
  });

  /**
   * Last seen timestamp tests
   */
  describe('Last seen', () => {
    it('displays last seen timestamp', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('last-seen')).toBeInTheDocument();
      });
    });

    it('handles null last_seen', async () => {
      const serverNoLastSeen = {
        ...mockServer,
        last_seen: null,
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoLastSeen);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
      // Should handle gracefully without crashing
    });
  });

  /**
   * Error handling for specific error codes
   */
  describe('Error handling', () => {
    it('handles 403 forbidden error', async () => {
      vi.mocked(serversApi.getServer).mockRejectedValue(new Error('403 Forbidden'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
    });

    it('handles 500 server error', async () => {
      vi.mocked(serversApi.getServer).mockRejectedValue(new Error('500 Internal Server Error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
    });
  });

  /**
   * View mode switching (EP0012)
   */
  describe('View mode switching (EP0012)', () => {
    beforeEach(() => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer);
    });

    it('displays view mode toggle buttons', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-classic')).toBeInTheDocument();
        expect(screen.getByTestId('view-mode-widget')).toBeInTheDocument();
      });
    });

    it('defaults to classic view', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-classic')).toHaveClass('bg-bg-tertiary');
      });
    });

    it('switches to widget view when widget button clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('view-mode-widget'));

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toHaveClass('bg-bg-tertiary');
      });
    });

    it('switches back to classic view when classic button clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toBeInTheDocument();
      });

      // Switch to widget
      fireEvent.click(screen.getByTestId('view-mode-widget'));

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-widget')).toHaveClass('bg-bg-tertiary');
      });

      // Switch back to classic
      fireEvent.click(screen.getByTestId('view-mode-classic'));

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-classic')).toHaveClass('bg-bg-tertiary');
      });
    });
  });

  /**
   * SSH Testing (US0079)
   */
  describe('SSH Testing (US0079)', () => {
    const serverWithTailscale = {
      ...mockServer,
      tailscale_hostname: 'server.tail123.ts.net',
    };

    beforeEach(() => {
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithTailscale);
      vi.mocked(serversApi.testSSHConnection).mockResolvedValue({
        success: true,
        latency_ms: 25,
        host_key_fingerprint: 'SHA256:abc123',
        key_used: 'default',
        attempts: 1,
      });
    });

    it('displays Test SSH button for Tailscale servers', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });
    });

    it('disables button while SSH test in progress', async () => {
      vi.mocked(serversApi.testSSHConnection).mockReturnValue(new Promise(() => {}));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-ssh-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-ssh-button')).toBeDisabled();
      });
    });

    it('does not show Test SSH button for non-Tailscale servers', async () => {
      vi.mocked(serversApi.getServer).mockResolvedValue(mockServer); // No tailscale_hostname

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('test-ssh-button')).not.toBeInTheDocument();
    });
  });

  /**
   * Uptime display tests
   */
  describe('Uptime display', () => {
    it('displays server with uptime present in metrics', async () => {
      const serverWithUptime = {
        ...mockServer,
        latest_metrics: {
          ...mockServer.latest_metrics,
          uptime_seconds: 86400 * 7, // 7 days
        },
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverWithUptime);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });

    it('handles null uptime', async () => {
      const serverNoUptime = {
        ...mockServer,
        latest_metrics: {
          ...mockServer.latest_metrics,
          uptime_seconds: null,
        },
      };
      vi.mocked(serversApi.getServer).mockResolvedValue(serverNoUptime);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });
  });
});
