/**
 * Tests for TailscaleDevices page.
 *
 * Part of EP0008: Tailscale Integration (US0077, US0078).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TailscaleDevices } from './TailscaleDevices';
import { getTailscaleDevices, getTailscaleStatus } from '../api/tailscale';
import type { TailscaleDevice, TailscaleDeviceListResponse, TailscaleStatusResponse } from '../types/tailscale';

vi.mock('../api/tailscale', () => ({
  getTailscaleDevices: vi.fn(),
  getTailscaleStatus: vi.fn(),
}));

// Mock ImportDeviceModal to avoid complexity
vi.mock('../components/ImportDeviceModal', () => ({
  ImportDeviceModal: vi.fn(({ device, onClose, onSuccess }) => (
    <div data-testid="import-modal">
      <span data-testid="modal-device">{device.hostname}</span>
      <button data-testid="modal-close" onClick={onClose}>Close</button>
      <button data-testid="modal-success" onClick={onSuccess}>Success</button>
    </div>
  )),
}));

const mockDevices: TailscaleDevice[] = [
  {
    id: 'device-1',
    name: 'homeserver',
    hostname: 'homeserver.tailnet.ts.net',
    tailscale_ip: '100.64.1.1',
    os: 'linux',
    os_version: 'Ubuntu 22.04',
    last_seen: new Date().toISOString(),
    online: true,
    authorized: true,
    already_imported: false,
  },
  {
    id: 'device-2',
    name: 'workstation',
    hostname: 'workstation.tailnet.ts.net',
    tailscale_ip: '100.64.1.2',
    os: 'windows',
    os_version: 'Windows 11',
    last_seen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    online: false,
    authorized: true,
    already_imported: false,
  },
  {
    id: 'device-3',
    name: 'macbook',
    hostname: 'macbook.tailnet.ts.net',
    tailscale_ip: '100.64.1.3',
    os: 'macos',
    os_version: 'macOS 14',
    last_seen: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    online: true,
    authorized: true,
    already_imported: true,
  },
  {
    id: 'device-4',
    name: 'iphone',
    hostname: 'iphone.tailnet.ts.net',
    tailscale_ip: '100.64.1.4',
    os: 'ios',
    os_version: 'iOS 17',
    last_seen: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    online: true,
    authorized: true,
    already_imported: false,
  },
];

const mockDeviceListResponse: TailscaleDeviceListResponse = {
  devices: mockDevices,
  count: mockDevices.length,
  cache_hit: false,
  cached_at: null,
};

const mockCachedResponse: TailscaleDeviceListResponse = {
  devices: mockDevices,
  count: mockDevices.length,
  cache_hit: true,
  cached_at: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
};

function renderPage() {
  return render(
    <BrowserRouter>
      <TailscaleDevices />
    </BrowserRouter>
  );
}

describe('TailscaleDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial loading state', () => {
    it('shows loading spinner while checking status', async () => {
      // Never resolve to keep loading state
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = renderPage();

      // Should show loading spinner (div with animate-spin class)
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('not configured state', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: false,
      } as TailscaleStatusResponse);
    });

    it('shows configuration prompt when not configured', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Configure Tailscale API Token')).toBeInTheDocument();
      });

      expect(screen.getByText(/Configure your Tailscale API token/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go to Settings' })).toHaveAttribute('href', '/settings');
    });

    it('does not fetch devices when not configured', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Configure Tailscale API Token')).toBeInTheDocument();
      });

      expect(getTailscaleDevices).not.toHaveBeenCalled();
    });
  });

  describe('configured state - device list', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        masked_token: 'tskey-ap...',
      } as TailscaleStatusResponse);
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceListResponse);
    });

    it('renders device list when configured', async () => {
      renderPage();

      // Wait for devices to load (not just the page title)
      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      // Check all devices are rendered
      expect(screen.getByText('workstation.tailnet.ts.net')).toBeInTheDocument();
      expect(screen.getByText('macbook.tailnet.ts.net')).toBeInTheDocument();
      expect(screen.getByText('iphone.tailnet.ts.net')).toBeInTheDocument();
    });

    it('shows device count', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Found 4 devices')).toBeInTheDocument();
      });
    });

    it('shows singular device count for one device', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue({
        devices: [mockDevices[0]],
        count: 1,
        cache_hit: false,
        cached_at: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Found 1 device')).toBeInTheDocument();
      });
    });

    it('displays IP addresses', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('100.64.1.1')).toBeInTheDocument();
        expect(screen.getByText('100.64.1.2')).toBeInTheDocument();
      });
    });

    it('displays OS information', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('linux')).toBeInTheDocument();
        expect(screen.getByText('windows')).toBeInTheDocument();
        expect(screen.getByText('macos')).toBeInTheDocument();
        expect(screen.getByText('ios')).toBeInTheDocument();
      });
    });

    it('displays online/offline status in device cards', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      // Count status indicators within device cards (excluding filter dropdown options)
      const deviceCards = screen.getAllByTestId(/^device-card-/);
      expect(deviceCards.length).toBe(4);

      // Check that device cards contain status text
      const homeserverCard = screen.getByTestId('device-card-device-1');
      expect(within(homeserverCard).getByText('Online')).toBeInTheDocument();

      const workstationCard = screen.getByTestId('device-card-device-2');
      expect(within(workstationCard).getByText('Offline')).toBeInTheDocument();
    });

    it('shows last seen time in device cards', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      // Look for "Last seen:" text within device cards
      const homeserverCard = screen.getByTestId('device-card-device-1');
      expect(within(homeserverCard).getByText(/Last seen:/)).toBeInTheDocument();
    });
  });

  describe('device cards', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceListResponse);
    });

    it('shows Import button for non-imported devices', async () => {
      renderPage();

      await waitFor(() => {
        const importButtons = screen.getAllByRole('button', { name: /Import/i });
        expect(importButtons.length).toBe(3); // homeserver, workstation, iphone
      });
    });

    it('shows View Machine link for already imported devices', async () => {
      renderPage();

      await waitFor(() => {
        const viewMachineLink = screen.getByRole('link', { name: /View Machine/i });
        expect(viewMachineLink).toBeInTheDocument();
        expect(viewMachineLink).toHaveAttribute('href', '/servers/macbook');
      });
    });

    it('renders device card with test id', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('device-card-device-1')).toBeInTheDocument();
        expect(screen.getByTestId('device-card-device-2')).toBeInTheDocument();
      });
    });
  });

  describe('filters', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceListResponse);
    });

    it('renders status filter dropdown', async () => {
      renderPage();

      await waitFor(() => {
        const statusFilter = screen.getByLabelText('Status:');
        expect(statusFilter).toBeInTheDocument();
      });
    });

    it('renders OS filter dropdown', async () => {
      renderPage();

      await waitFor(() => {
        const osFilter = screen.getByLabelText('OS:');
        expect(osFilter).toBeInTheDocument();
      });
    });

    it('filters by online status', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText('Status:');
      fireEvent.change(statusFilter, { target: { value: 'online' } });

      await waitFor(() => {
        expect(getTailscaleDevices).toHaveBeenCalledWith(
          expect.objectContaining({ online: true })
        );
      });
    });

    it('filters by offline status', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText('Status:');
      fireEvent.change(statusFilter, { target: { value: 'offline' } });

      await waitFor(() => {
        expect(getTailscaleDevices).toHaveBeenCalledWith(
          expect.objectContaining({ online: false })
        );
      });
    });

    it('filters by OS type', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      const osFilter = screen.getByLabelText('OS:');
      fireEvent.change(osFilter, { target: { value: 'linux' } });

      await waitFor(() => {
        expect(getTailscaleDevices).toHaveBeenCalledWith(
          expect.objectContaining({ os: 'linux' })
        );
      });
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
    });

    it('shows empty state when no devices found', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue({
        devices: [],
        count: 0,
        cache_hit: false,
        cached_at: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No devices found')).toBeInTheDocument();
      });

      expect(screen.getByText('No devices found in your tailnet.')).toBeInTheDocument();
    });

    it('shows filter hint in empty state when filters applied', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue({
        devices: [],
        count: 0,
        cache_hit: false,
        cached_at: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Status:')).toBeInTheDocument();
      });

      // Apply a filter
      const statusFilter = screen.getByLabelText('Status:');
      fireEvent.change(statusFilter, { target: { value: 'online' } });

      await waitFor(() => {
        expect(screen.getByText(/No devices match your filters/)).toBeInTheDocument();
      });
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
    });

    it('shows error message on API failure', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to connect to Tailscale API')
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to connect to Tailscale API')).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button clicked', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockDeviceListResponse);

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });
    });

    it('uses generic error message for non-Error exceptions', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockRejectedValue('Unknown error');

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch devices')).toBeInTheDocument();
      });
    });
  });

  describe('refresh functionality', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceListResponse);
    });

    it('renders refresh button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });
    });

    it('calls API with refresh=true when refresh clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(getTailscaleDevices).toHaveBeenCalledWith(
          expect.objectContaining({ refresh: true })
        );
      });
    });

    it('disables refresh button while loading', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDeviceListResponse), 1000))
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });
  });

  describe('cache indicator', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
    });

    it('shows "Fresh data" when cache not hit', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceListResponse);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Fresh data')).toBeInTheDocument();
      });
    });

    it('shows cached time when cache hit', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockCachedResponse);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Cached 3m ago/)).toBeInTheDocument();
      });
    });
  });

  describe('import modal', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceListResponse);
    });

    it('opens import modal when Import button clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      const deviceCard = screen.getByTestId('device-card-device-1');
      const importButton = within(deviceCard).getByRole('button', { name: /Import/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByTestId('import-modal')).toBeInTheDocument();
        expect(screen.getByTestId('modal-device')).toHaveTextContent('homeserver.tailnet.ts.net');
      });
    });

    it('closes modal when close callback invoked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      const deviceCard = screen.getByTestId('device-card-device-1');
      const importButton = within(deviceCard).getByRole('button', { name: /Import/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByTestId('import-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('import-modal')).not.toBeInTheDocument();
      });
    });

    it('refreshes device list on import success', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('homeserver.tailnet.ts.net')).toBeInTheDocument();
      });

      // Clear mock to track new calls
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockClear();

      const deviceCard = screen.getByTestId('device-card-device-1');
      const importButton = within(deviceCard).getByRole('button', { name: /Import/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByTestId('import-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-success'));

      await waitFor(() => {
        expect(getTailscaleDevices).toHaveBeenCalledWith(
          expect.objectContaining({ refresh: true })
        );
      });
    });
  });

  describe('loading state during fetch', () => {
    beforeEach(() => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
      } as TailscaleStatusResponse);
    });

    it('shows loading indicator while fetching devices', async () => {
      (getTailscaleDevices as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolve
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Discovering devices...')).toBeInTheDocument();
      });
    });
  });

  describe('status check error', () => {
    it('treats status check error as not configured', async () => {
      (getTailscaleStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Configure Tailscale API Token')).toBeInTheDocument();
      });
    });
  });
});
