/**
 * Tests for DiscoveryPage component.
 *
 * EP0016: Unified Discovery Experience (US0094)
 * Tests cover network discovery, Tailscale integration, filtering,
 * device import, and various edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiscoveryPage } from '../../pages/DiscoveryPage';
import { getConnectivityStatus } from '../../api/connectivity';
import { getTailscaleStatus, getTailscaleDevices } from '../../api/tailscale';
import {
  startDiscovery,
  getDiscovery,
  getDiscoverySettings,
} from '../../api/discovery';
import { listSSHKeys } from '../../api/scans';
import type { ConnectivityStatusResponse } from '../../types/connectivity';
import type {
  TailscaleStatusResponse,
  TailscaleDeviceListResponse,
} from '../../types/tailscale';
import type { DiscoveryResponse, DiscoverySettings } from '../../types/discovery';
import type { SSHKeyListResponse } from '../../types/scan';

// Mock all API modules
vi.mock('../../api/connectivity', () => ({
  getConnectivityStatus: vi.fn(),
}));

vi.mock('../../api/tailscale', () => ({
  getTailscaleStatus: vi.fn(),
  getTailscaleDevices: vi.fn(),
}));

vi.mock('../../api/discovery', () => ({
  startDiscovery: vi.fn(),
  getDiscovery: vi.fn(),
  getDiscoverySettings: vi.fn(),
}));

vi.mock('../../api/scans', () => ({
  listSSHKeys: vi.fn(),
}));

// Mock child components to isolate DiscoveryPage logic
vi.mock('../../components/UnifiedDeviceCard', () => ({
  UnifiedDeviceCard: ({ device, onImport }: { device: { hostname: string; id: string }; onImport: (d: unknown) => void }) => (
    <div data-testid={`device-card-${device.id}`} onClick={() => onImport(device)}>
      {device.hostname}
    </div>
  ),
}));

vi.mock('../../components/DiscoveryFilters', () => ({
  DiscoveryFilters: ({ totalCount, filteredCount }: { totalCount: number; filteredCount: number }) => (
    <div data-testid="discovery-filters">
      {totalCount} total, {filteredCount} filtered
    </div>
  ),
}));

vi.mock('../../components/UnifiedImportModal', () => ({
  UnifiedImportModal: ({ isOpen, device, onClose, onSuccess }: {
    isOpen: boolean;
    device: { hostname: string } | null;
    onClose: () => void;
    onSuccess: () => void;
  }) =>
    isOpen ? (
      <div data-testid="import-modal">
        Importing {device?.hostname}
        <button data-testid="import-close" onClick={onClose}>Close</button>
        <button data-testid="import-confirm" onClick={onSuccess}>Confirm</button>
      </div>
    ) : null,
}));

vi.mock('../../components/DiscoverySettingsModal', () => ({
  DiscoverySettingsModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="settings-modal">
        Settings
        <button data-testid="settings-close" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const mockGetConnectivityStatus = getConnectivityStatus as Mock;
const mockGetTailscaleStatus = getTailscaleStatus as Mock;
const mockGetTailscaleDevices = getTailscaleDevices as Mock;
const mockStartDiscovery = startDiscovery as Mock;
const mockGetDiscovery = getDiscovery as Mock;
const mockGetDiscoverySettings = getDiscoverySettings as Mock;
const mockListSSHKeys = listSSHKeys as Mock;

// Mock response data
const mockConnectivityResponse: ConnectivityStatusResponse = {
  mode: 'tailscale',
  tailscale: {
    configured: true,
    connected: true,
    tailnet: 'example.ts.net',
  },
  ssh: {
    configured: true,
    username: 'root',
  },
};

const mockConnectivityResponseNetwork: ConnectivityStatusResponse = {
  mode: 'direct_ssh',
  tailscale: {
    configured: false,
    connected: false,
    tailnet: null,
  },
  ssh: {
    configured: true,
    username: 'root',
  },
};

const mockTailscaleStatusConfigured: TailscaleStatusResponse = {
  configured: true,
  masked_token: 'tskey-****-****',
};

const mockTailscaleStatusNotConfigured: TailscaleStatusResponse = {
  configured: false,
  masked_token: null,
};

const mockTailscaleDevicesResponse: TailscaleDeviceListResponse = {
  devices: [
    {
      id: 'node-1',
      name: 'server1',
      hostname: 'server1.tailnet.ts.net',
      tailscale_ip: '100.64.0.1',
      os: 'linux',
      online: true,
      last_seen: '2026-01-29T10:00:00Z',
      already_imported: false,
      ssh_status: 'available',
      ssh_error: null,
      ssh_key_used: 'default',
    },
    {
      id: 'node-2',
      name: 'workstation1',
      hostname: 'workstation1.tailnet.ts.net',
      tailscale_ip: '100.64.0.2',
      os: 'linux',
      online: false,
      last_seen: '2026-01-28T10:00:00Z',
      already_imported: true,
      ssh_status: 'unavailable',
      ssh_error: 'Offline',
      ssh_key_used: null,
    },
  ],
  total: 2,
  cache_hit: false,
  cached_at: null,
};

const mockDiscoverySettings: DiscoverySettings = {
  default_subnet: '192.168.1.0/24',
  timeout_ms: 1000,
};

const mockDiscoveryResponsePending: DiscoveryResponse = {
  discovery_id: 1,
  status: 'pending',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: null,
  progress: null,
  devices_found: 0,
  devices: null,
  error: null,
};

const mockDiscoveryResponseRunning: DiscoveryResponse = {
  discovery_id: 1,
  status: 'running',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: null,
  progress: {
    scanned: 128,
    total: 254,
    percent: 50,
  },
  devices_found: 5,
  devices: null,
  error: null,
};

const mockDiscoveryResponseCompleted: DiscoveryResponse = {
  discovery_id: 1,
  status: 'completed',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: '2026-01-29T10:01:30Z',
  progress: null,
  devices_found: 2,
  devices: [
    {
      ip: '192.168.1.100',
      hostname: 'server1.local',
      response_time_ms: 5,
      is_monitored: false,
      ssh_auth_status: 'success',
      ssh_auth_error: null,
      ssh_key_used: 'default',
    },
    {
      ip: '192.168.1.101',
      hostname: null,
      response_time_ms: 10,
      is_monitored: true,
      ssh_auth_status: 'failed',
      ssh_auth_error: 'Connection refused',
      ssh_key_used: null,
    },
  ],
  error: null,
};

const mockDiscoveryResponseFailed: DiscoveryResponse = {
  discovery_id: 1,
  status: 'failed',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: '2026-01-29T10:00:05Z',
  progress: null,
  devices_found: 0,
  devices: null,
  error: 'Network scan failed: permission denied',
};

const mockSSHKeysResponse: SSHKeyListResponse = {
  keys: [
    {
      id: 'default',
      name: 'default',
      fingerprint: 'SHA256:abc123',
      created_at: '2026-01-01T00:00:00Z',
      is_default: true,
    },
  ],
};

function renderDiscoveryPage(initialRoute = '/discovery') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <DiscoveryPage />
    </MemoryRouter>
  );
}

describe('DiscoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mocks - network mode, Tailscale not configured
    mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponseNetwork);
    mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusNotConfigured);
    mockGetDiscoverySettings.mockResolvedValue(mockDiscoverySettings);
    mockListSSHKeys.mockResolvedValue(mockSSHKeysResponse);
    mockGetTailscaleDevices.mockResolvedValue({ devices: [], total: 0, cache_hit: false, cached_at: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('initial loading', () => {
    it('shows loading spinner during initial load', () => {
      // Make the promise never resolve to see loading state
      mockGetConnectivityStatus.mockReturnValue(new Promise(() => {}));
      mockGetTailscaleStatus.mockReturnValue(new Promise(() => {}));

      renderDiscoveryPage();

      // Should show loading spinner (Loader2 icon)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('renders page header after loading', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });
    });

    it('shows subtitle description', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/Find and import devices/)).toBeInTheDocument();
      });
    });
  });

  describe('tab navigation', () => {
    it('shows Network Scan tab button', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Network Scan/i })).toBeInTheDocument();
      });
    });

    it('shows Tailscale tab when configured', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Tailscale/i })).toBeInTheDocument();
      });
    });

    it('hides Tailscale tab when not configured', async () => {
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusNotConfigured);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Tailscale/i })).not.toBeInTheDocument();
    });

    it('defaults to Tailscale tab when mode is tailscale and configured', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);

      renderDiscoveryPage();

      await waitFor(() => {
        // Tailscale devices should be fetched
        expect(mockGetTailscaleDevices).toHaveBeenCalled();
      });
    });

    it('defaults to Network tab when mode is direct_ssh', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponseNetwork);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });

      // Network tab should be active, showing Discover Now button
      expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
    });

    it('respects tab URL parameter', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(mockGetTailscaleDevices).toHaveBeenCalled();
      });
    });

    it('switches to network tab on click', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Network Scan/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Network Scan/i }));

      expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
    });

    it('switches to tailscale tab on click', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);

      renderDiscoveryPage('/discovery?tab=network');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Tailscale/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Tailscale/i }));

      await waitFor(() => {
        expect(mockGetTailscaleDevices).toHaveBeenCalled();
      });
    });
  });

  describe('network discovery', () => {
    it('shows subnet from settings', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
      });
    });

    it('shows Discover Now button', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
      });
    });

    it('starts discovery when clicking Discover Now', async () => {
      mockStartDiscovery.mockResolvedValue(mockDiscoveryResponsePending);
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseRunning);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Discover Now/i }));

      expect(mockStartDiscovery).toHaveBeenCalled();
    });

    it('shows scanning state during discovery', async () => {
      mockStartDiscovery.mockResolvedValue(mockDiscoveryResponseRunning);
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseRunning);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Discover Now/i }));

      await waitFor(() => {
        expect(screen.getByText(/Scanning/i)).toBeInTheDocument();
      });
    });

    it('shows progress during running discovery', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseRunning);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/128/)).toBeInTheDocument();
        expect(screen.getByText(/254/)).toBeInTheDocument();
      });
    });

    it('shows device cards when discovery completes', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-192.168.1.100')).toBeInTheDocument();
      });
    });

    it('shows empty state when no devices found', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue({
        ...mockDiscoveryResponseCompleted,
        devices_found: 0,
        devices: [],
      });

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/No devices found/i)).toBeInTheDocument();
      });
    });

    it('shows error state when discovery fails', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseFailed);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      });
    });

    it('shows ready to discover state when no scan started', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/Ready to discover/i)).toBeInTheDocument();
      });
    });

    it('shows settings error when settings fail to load', async () => {
      mockGetDiscoverySettings.mockRejectedValue(new Error('Settings failed'));

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/Settings failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('settings modal', () => {
    it('opens settings modal when clicking settings button', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/Discovery settings/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(/Discovery settings/i));

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });

    it('closes settings modal', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/Discovery settings/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(/Discovery settings/i));
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('settings-close'));
      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    });
  });

  describe('tailscale discovery', () => {
    beforeEach(() => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);
    });

    it('fetches tailscale devices when tab is active', async () => {
      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(mockGetTailscaleDevices).toHaveBeenCalled();
      });
    });

    it('shows tailscale device cards', async () => {
      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByTestId('device-card-node-1')).toBeInTheDocument();
      });
    });

    it('shows refresh button for tailscale', async () => {
      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
      });
    });

    it('refreshes tailscale devices on button click', async () => {
      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

      // Should call with refresh=true
      expect(mockGetTailscaleDevices).toHaveBeenCalledWith(
        expect.objectContaining({ refresh: true })
      );
    });

    it('shows cache hit info', async () => {
      mockGetTailscaleDevices.mockResolvedValue({
        ...mockTailscaleDevicesResponse,
        cache_hit: true,
        cached_at: '2026-01-29T09:55:00Z',
      });

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByText(/Cached/i)).toBeInTheDocument();
      });
    });

    it('shows fresh data indicator when not cached', async () => {
      mockGetTailscaleDevices.mockResolvedValue({
        ...mockTailscaleDevicesResponse,
        cache_hit: false,
        cached_at: null,
      });

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByText(/Fresh data/i)).toBeInTheDocument();
      });
    });

    it('shows error state when tailscale fetch fails', async () => {
      mockGetTailscaleDevices.mockRejectedValue(new Error('Tailscale API error'));

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByText(/Tailscale API error/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockGetTailscaleDevices.mockRejectedValue(new Error('Tailscale API error'));

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });

    it('handles empty tailscale device list', async () => {
      mockGetTailscaleDevices.mockResolvedValue({
        devices: [],
        total: 0,
        cache_hit: false,
        cached_at: null,
      });

      renderDiscoveryPage('/discovery?tab=tailscale');

      // Wait for page to load - it may show empty state or no devices message
      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });
    });
  });

  describe('device import flow', () => {
    it('opens import modal when clicking device card', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-192.168.1.100')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('device-card-192.168.1.100'));

      expect(screen.getByTestId('import-modal')).toBeInTheDocument();
    });

    it('closes import modal on close button', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-192.168.1.100')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('device-card-192.168.1.100'));
      expect(screen.getByTestId('import-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('import-close'));
      expect(screen.queryByTestId('import-modal')).not.toBeInTheDocument();
    });

    it('refreshes devices after successful network import', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-192.168.1.100')).toBeInTheDocument();
      });

      // Open modal
      fireEvent.click(screen.getByTestId('device-card-192.168.1.100'));

      // Clear calls to track refresh
      mockGetDiscovery.mockClear();

      // Confirm import
      fireEvent.click(screen.getByTestId('import-confirm'));

      // Should refresh discovery
      await waitFor(() => {
        expect(mockGetDiscovery).toHaveBeenCalled();
      });
    });

    it('refreshes tailscale devices after successful tailscale import', async () => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);

      renderDiscoveryPage('/discovery?tab=tailscale');

      await waitFor(() => {
        expect(screen.getByTestId('device-card-node-1')).toBeInTheDocument();
      });

      // Open modal
      fireEvent.click(screen.getByTestId('device-card-node-1'));

      // Clear calls to track refresh
      mockGetTailscaleDevices.mockClear();

      // Confirm import
      fireEvent.click(screen.getByTestId('import-confirm'));

      // Should refresh Tailscale devices
      await waitFor(() => {
        expect(mockGetTailscaleDevices).toHaveBeenCalledWith(
          expect.objectContaining({ refresh: true })
        );
      });
    });
  });

  describe('device filtering', () => {
    it('shows filters when devices exist', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('discovery-filters')).toBeInTheDocument();
      });
    });

    it('hides filters when no devices', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/Ready to discover/i)).toBeInTheDocument();
      });

      expect(screen.queryByTestId('discovery-filters')).not.toBeInTheDocument();
    });

    it('shows device count in filters', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/2 total/i)).toBeInTheDocument();
      });
    });
  });

  describe('API interactions', () => {
    it('fetches connectivity status on mount', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetConnectivityStatus).toHaveBeenCalled();
      });
    });

    it('fetches tailscale status on mount', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetTailscaleStatus).toHaveBeenCalled();
      });
    });

    it('fetches discovery settings on mount', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetDiscoverySettings).toHaveBeenCalled();
      });
    });

    it('fetches SSH keys on mount', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockListSSHKeys).toHaveBeenCalled();
      });
    });

    it('handles connectivity status error gracefully', async () => {
      mockGetConnectivityStatus.mockRejectedValue(new Error('Network error'));

      renderDiscoveryPage();

      // Should default to network tab
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
      });
    });
  });

  describe('back navigation', () => {
    it('has back button linking to dashboard', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        const backLink = screen.getByLabelText(/Back to dashboard/i);
        expect(backLink).toBeInTheDocument();
        expect(backLink).toHaveAttribute('href', '/');
      });
    });
  });

  describe('edge cases', () => {
    it('handles localStorage activeDiscoveryId with invalid value', async () => {
      localStorage.setItem('activeDiscoveryId', 'invalid');

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });
    });

    it('fetches discovery on network tab with valid discovery ID', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetDiscovery).toHaveBeenCalled();
      });
    });

    it('starts discovery and updates state', async () => {
      mockStartDiscovery.mockResolvedValue(mockDiscoveryResponsePending);
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseRunning);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Discover Now/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Discover Now/i }));

      // Verify startDiscovery was called
      await waitFor(() => {
        expect(mockStartDiscovery).toHaveBeenCalled();
      });
    });
  });
});
