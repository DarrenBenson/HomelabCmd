/**
 * Tests for Network Discovery feature.
 *
 * US0041: Network Discovery
 * US0073: Network Discovery Key Selection
 * Test Spec: TS0017
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NetworkDiscovery } from '../components/NetworkDiscovery';
import { startDiscovery, getDiscovery, getDiscoverySettings } from '../api/discovery';
import { listSSHKeys } from '../api/scans';
import type { DiscoveryResponse, DiscoveryDevice, DiscoverySettings } from '../types/discovery';
import type { SSHKeyListResponse } from '../types/scan';

// Mock the discovery API
vi.mock('../api/discovery', () => ({
  startDiscovery: vi.fn(),
  getDiscovery: vi.fn(),
  getDiscoverySettings: vi.fn(),
}));

// Mock the scans API (US0073: for SSH key listing)
vi.mock('../api/scans', () => ({
  listSSHKeys: vi.fn(),
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

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function createMockDevice(overrides: Partial<DiscoveryDevice> = {}): DiscoveryDevice {
  return {
    ip: '192.168.1.1',
    hostname: 'router',
    response_time_ms: 1,
    is_monitored: false,
    ssh_auth_status: 'success',
    ssh_auth_error: null,
    ssh_key_used: 'homelab-key',
    ...overrides,
  };
}

const mockDevices: DiscoveryDevice[] = [
  createMockDevice({
    ip: '192.168.1.1',
    hostname: 'router',
    response_time_ms: 1,
    is_monitored: false,
    ssh_auth_status: 'success',
    ssh_key_used: 'homelab-key',
  }),
  createMockDevice({
    ip: '192.168.1.10',
    hostname: 'omv-mediaserver',
    response_time_ms: 2,
    is_monitored: true,
    ssh_auth_status: 'success',
    ssh_key_used: 'homelab-key',
  }),
  createMockDevice({
    ip: '192.168.1.50',
    hostname: 'pihole-primary',
    response_time_ms: 3,
    is_monitored: true,
    ssh_auth_status: 'success',
    ssh_key_used: 'work-server',
  }),
  createMockDevice({
    ip: '192.168.1.100',
    hostname: null,
    response_time_ms: 5,
    is_monitored: false,
    ssh_auth_status: 'failed',
    ssh_auth_error: 'Permission denied',
    ssh_key_used: null,
  }),
];

const mockRunningDiscovery: DiscoveryResponse = {
  discovery_id: 1,
  status: 'running',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-21T10:00:00Z',
  completed_at: null,
  progress: {
    scanned: 127,
    total: 254,
    percent: 50,
  },
  devices_found: 4,
  devices: null,
  error: null,
};

const mockCompletedDiscovery: DiscoveryResponse = {
  discovery_id: 1,
  status: 'completed',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-21T10:00:00Z',
  completed_at: '2026-01-21T10:01:30Z',
  progress: null,
  devices_found: 4,
  devices: mockDevices,
  error: null,
};

const mockSettings: DiscoverySettings = {
  default_subnet: '192.168.1.0/24',
  timeout_ms: 500,
};

// Mock SSH keys response (US0073)
const mockSSHKeysResponse: SSHKeyListResponse = {
  keys: [
    {
      id: 'homelab-key',
      name: 'homelab-key',
      type: 'ED25519',
      fingerprint: 'SHA256:abc123',
      created_at: '2026-01-01T00:00:00Z',
      username: 'darren',
    },
    {
      id: 'work-server',
      name: 'work-server',
      type: 'RSA-4096',
      fingerprint: 'SHA256:xyz789',
      created_at: '2026-01-02T00:00:00Z',
      username: 'admin',
    },
  ],
};

describe('NetworkDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    (getDiscoverySettings as Mock).mockResolvedValue(mockSettings);
    (startDiscovery as Mock).mockResolvedValue(mockRunningDiscovery);
    (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);
    (listSSHKeys as Mock).mockResolvedValue(mockSSHKeysResponse);
  });

  describe('Initial rendering (AC1)', () => {
    // TC-TS0017-17: NetworkDiscovery renders discovery section
    it('renders discovery section with subnet and button', async () => {
      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-section')).toBeInTheDocument();
      });

      expect(screen.getByText(/192\.168\.1\.0\/24/)).toBeInTheDocument();
      expect(screen.getByTestId('discover-button')).toBeInTheDocument();
    });

    // TC-TS0017-28: Settings link visible
    it('shows settings button', async () => {
      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-settings-button')).toBeInTheDocument();
      });
    });
  });

  describe('Initiate discovery (AC1)', () => {
    // TC-TS0017-18: Clicking Discover Now initiates discovery
    it('calls startDiscovery API when button clicked', async () => {
      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} />);

      await waitFor(() => {
        expect(screen.getByTestId('discover-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('discover-button'));

      await waitFor(() => {
        expect(startDiscovery).toHaveBeenCalled();
      });
    });

    it('disables button during discovery', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockRunningDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('discover-button')).toBeDisabled();
      });
    });
  });

  describe('Discovery progress (AC5)', () => {
    // TC-TS0017-19: Progress bar updates
    it('shows progress bar during discovery', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockRunningDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-progress')).toBeInTheDocument();
      });

      expect(screen.getByTestId('progress-bar')).toHaveStyle({ width: '50%' });
      expect(screen.getByText(/127.*\/.*254.*IPs/i)).toBeInTheDocument();
    });

    // TC-TS0017-34: Polling stops after completion
    it('stops polling when discovery completes', async () => {
      // Start with completed discovery - no polling should occur after initial fetch
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-results')).toBeInTheDocument();
      });

      // Clear the mock to track only calls after completion
      const callsAfterComplete = (getDiscovery as Mock).mock.calls.length;

      // Wait briefly to ensure no additional polls occur
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // No additional calls should have been made since discovery is complete
      expect((getDiscovery as Mock).mock.calls.length).toBe(callsAfterComplete);
    });
  });

  describe('Discovery results (AC3)', () => {
    // TC-TS0017-20: Completed discovery shows device table
    it('displays device table when completed', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-results')).toBeInTheDocument();
      });

      expect(screen.getByTestId('devices-table')).toBeInTheDocument();
      // Check headers
      expect(screen.getByText('IP')).toBeInTheDocument();
      expect(screen.getByText('Hostname')).toBeInTheDocument();
      expect(screen.getByText('Response')).toBeInTheDocument();
    });

    // TC-TS0017-21: Response time displayed
    it('shows response time in milliseconds', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByText('1 ms')).toBeInTheDocument();
      });
    });

    // TC-TS0017-22: Hostname or "--" for null
    it('shows "--" for devices without hostname', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('device-row-192.168.1.100')).toBeInTheDocument();
      });

      const row = screen.getByTestId('device-row-192.168.1.100');
      expect(row).toHaveTextContent('--');
    });

    // TC-TS0017-23: Monitored device shows "View Server" link
    it('shows View Server link for registered servers', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('device-row-192.168.1.10')).toBeInTheDocument();
      });

      expect(screen.getByTestId('view-server-link-192.168.1.10')).toBeInTheDocument();
      expect(screen.getByTestId('view-server-link-192.168.1.10')).toHaveTextContent('View Server');
    });

    // TC-TS0017-24: Non-monitored shows Scan button
    it('shows Scan button for non-monitored devices', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('scan-button-192.168.1.1')).toBeInTheDocument();
      });
    });

    it('does not show Scan button for monitored devices', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('device-row-192.168.1.10')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('scan-button-192.168.1.10')).not.toBeInTheDocument();
    });
  });

  describe('Select device for scan (AC4)', () => {
    // TC-TS0017-25: Clicking Scan button calls onSelectDevice
    it('calls onSelectDevice with IP when Scan clicked', async () => {
      const onSelectDevice = vi.fn();
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={onSelectDevice} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('scan-button-192.168.1.1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('scan-button-192.168.1.1'));

      expect(onSelectDevice).toHaveBeenCalledWith('192.168.1.1');
    });
  });

  describe('Edge cases', () => {
    // TC-TS0017-26: Empty discovery shows message
    it('shows "No devices found" when discovery has no results', async () => {
      const emptyDiscovery: DiscoveryResponse = {
        ...mockCompletedDiscovery,
        devices: [],
        devices_found: 0,
      };
      (getDiscovery as Mock).mockResolvedValue(emptyDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/No devices found/i)).toBeInTheDocument();
      });
    });

    // TC-TS0017-27: Error state shows message
    it('shows error message when discovery fails', async () => {
      const failedDiscovery: DiscoveryResponse = {
        ...mockRunningDiscovery,
        status: 'failed',
        error: 'Network error',
        progress: null,
      };
      (getDiscovery as Mock).mockResolvedValue(failedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('discovery-error')).toBeInTheDocument();
      });

      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    it('shows last discovery timestamp', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('last-discovery-time')).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching settings', async () => {
      let resolveSettings: (value: DiscoverySettings) => void;
      (getDiscoverySettings as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSettings = resolve;
          })
      );

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} />);

      expect(screen.getByTestId('discovery-loading')).toBeInTheDocument();

      await act(async () => {
        resolveSettings!(mockSettings);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('discovery-loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('Refresh functionality', () => {
    it('allows manual refresh of discovery status', async () => {
      (getDiscovery as Mock).mockResolvedValue(mockCompletedDiscovery);

      renderWithRouter(<NetworkDiscovery onSelectDevice={() => {}} activeDiscoveryId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-discovery-button')).toBeInTheDocument();
      });

      (getDiscovery as Mock).mockClear();

      fireEvent.click(screen.getByTestId('refresh-discovery-button'));

      await waitFor(() => {
        expect(getDiscovery).toHaveBeenCalledWith(1);
      });
    });
  });
});
