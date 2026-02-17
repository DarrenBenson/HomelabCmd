/**
 * Tests for DiscoveryPage component.
 *
 * EP0016: Unified Discovery Experience (US0094)
 * EP0019: Single Pane of Glass - Merged network and Tailscale discovery
 *
 * Tests cover unified discovery, device merging, filtering,
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

vi.mock('../../components/discovery/DiscoverySourcePanel', () => ({
  DiscoverySourcePanel: ({
    networkSettings,
    isDiscovering,
    onDiscoverAll,
    onOpenSettings,
  }: {
    networkSettings: { default_subnet: string } | null;
    isDiscovering: boolean;
    onDiscoverAll: (keyId?: string) => void;
    onOpenSettings: () => void;
  }) => (
    <div data-testid="discovery-source-panel">
      {networkSettings && <span data-testid="subnet">{networkSettings.default_subnet}</span>}
      <button
        data-testid="discover-all-button"
        onClick={() => onDiscoverAll()}
        disabled={isDiscovering}
      >
        {isDiscovering ? 'Discovering...' : 'Discover All'}
      </button>
      <button data-testid="settings-button" onClick={onOpenSettings} aria-label="Network discovery settings">
        Settings
      </button>
    </div>
  ),
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
    it('renders page header', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });
    });

    it('shows subtitle description', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/Find and import devices from your network and Tailscale/)).toBeInTheDocument();
      });
    });

    it('renders discovery source panel', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('discovery-source-panel')).toBeInTheDocument();
      });
    });
  });

  describe('unified discovery', () => {
    it('shows Discover All button', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('discover-all-button')).toBeInTheDocument();
        expect(screen.getByTestId('discover-all-button')).toHaveTextContent('Discover All');
      });
    });

    it('starts discovery when clicking Discover All', async () => {
      mockStartDiscovery.mockResolvedValue(mockDiscoveryResponsePending);
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseRunning);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('discover-all-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('discover-all-button'));

      await waitFor(() => {
        expect(mockStartDiscovery).toHaveBeenCalled();
      });
    });

    it('fetches discovery settings on mount', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetDiscoverySettings).toHaveBeenCalled();
      });
    });

    it('shows subnet from settings', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('subnet')).toHaveTextContent('192.168.1.0/24');
      });
    });

    it('shows device cards when discovery completes', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        // Device IDs now have "network-" prefix
        expect(screen.getByTestId('device-card-network-192.168.1.100')).toBeInTheDocument();
      });
    });

    it('shows empty state when no devices found after discovery', async () => {
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

    it('shows ready to discover state when no scan started', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText(/Ready to discover/i)).toBeInTheDocument();
      });
    });
  });

  describe('tailscale integration', () => {
    beforeEach(() => {
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);
    });

    it('fetches tailscale devices on mount when configured', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetTailscaleDevices).toHaveBeenCalled();
      });
    });

    it('shows tailscale device cards in unified view', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        // Device IDs now have "tailscale-" prefix
        expect(screen.getByTestId('device-card-tailscale-node-1')).toBeInTheDocument();
      });
    });

    it('handles tailscale not configured gracefully', async () => {
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusNotConfigured);
      mockGetTailscaleDevices.mockResolvedValue({ devices: [], total: 0, cache_hit: false, cached_at: null });

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      });
    });
  });

  describe('device merging', () => {
    it('merges devices from both sources into unified list', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetConnectivityStatus.mockResolvedValue(mockConnectivityResponse);
      mockGetTailscaleStatus.mockResolvedValue(mockTailscaleStatusConfigured);
      // Use different hostnames so devices don't get merged
      mockGetDiscovery.mockResolvedValue({
        ...mockDiscoveryResponseCompleted,
        devices: [
          {
            ip: '192.168.1.100',
            hostname: 'nas.local', // Different hostname, won't merge
            response_time_ms: 5,
            is_monitored: false,
            ssh_auth_status: 'success',
            ssh_auth_error: null,
            ssh_key_used: 'default',
          },
        ],
      });
      mockGetTailscaleDevices.mockResolvedValue(mockTailscaleDevicesResponse);

      renderDiscoveryPage();

      await waitFor(() => {
        // Should see devices from both sources (unmerged because different hostnames)
        expect(screen.getByTestId('device-card-network-192.168.1.100')).toBeInTheDocument();
        expect(screen.getByTestId('device-card-tailscale-node-1')).toBeInTheDocument();
      });
    });
  });

  describe('settings modal', () => {
    it('opens settings modal when clicking settings button', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('settings-button'));

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });

    it('closes settings modal', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('settings-button'));
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('settings-close'));
      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    });
  });

  describe('device import flow', () => {
    it('opens import modal when clicking device card', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-network-192.168.1.100')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('device-card-network-192.168.1.100'));

      expect(screen.getByTestId('import-modal')).toBeInTheDocument();
    });

    it('closes import modal on close button', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-network-192.168.1.100')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('device-card-network-192.168.1.100'));
      expect(screen.getByTestId('import-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('import-close'));
      expect(screen.queryByTestId('import-modal')).not.toBeInTheDocument();
    });

    it('refreshes devices after successful import', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-network-192.168.1.100')).toBeInTheDocument();
      });

      // Open modal
      fireEvent.click(screen.getByTestId('device-card-network-192.168.1.100'));

      // Clear calls to track refresh
      mockStartDiscovery.mockClear();

      // Confirm import
      fireEvent.click(screen.getByTestId('import-confirm'));

      // Should trigger rediscovery
      await waitFor(() => {
        expect(mockStartDiscovery).toHaveBeenCalled();
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

    it('fetches SSH keys on mount', async () => {
      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockListSSHKeys).toHaveBeenCalled();
      });
    });

    it('handles connectivity status error gracefully', async () => {
      mockGetConnectivityStatus.mockRejectedValue(new Error('Network error'));

      renderDiscoveryPage();

      // Should still show page
      await waitFor(() => {
        expect(screen.getByText('Device Discovery')).toBeInTheDocument();
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

    it('fetches discovery with valid discovery ID', async () => {
      localStorage.setItem('activeDiscoveryId', '1');
      mockGetDiscovery.mockResolvedValue(mockDiscoveryResponseCompleted);

      renderDiscoveryPage();

      await waitFor(() => {
        expect(mockGetDiscovery).toHaveBeenCalled();
      });
    });
  });
});
