/**
 * Tests for ServiceManagementModal component.
 *
 * Tests modal rendering, service discovery, and CRUD operations.
 * Covers full lifecycle from SSH key loading to service management.
 *
 * ACs covered:
 * - SSH key selection dropdown shows all configured keys
 * - Service discovery scans server for systemd services
 * - Discovered services can be selected and added
 * - Services can be manually added with name and criticality
 * - Existing services can be edited or deleted
 * - Empty state shown when no services configured
 *
 * Edge cases from TSD:
 * - SSH key loading failure
 * - Service discovery failure
 * - No SSH keys configured
 * - All discovered services already monitored
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceManagementModal } from './ServiceManagementModal';
import { listSSHKeys } from '../api/scans';
import {
  getServerServices,
  discoverServices,
  createExpectedService,
  deleteExpectedService,
} from '../api/services';
import type { ServerDetail } from '../types/server';

vi.mock('../api/scans', () => ({
  listSSHKeys: vi.fn(),
}));

vi.mock('../api/services', () => ({
  getServerServices: vi.fn(),
  discoverServices: vi.fn(),
  createExpectedService: vi.fn(),
  updateExpectedService: vi.fn(),
  deleteExpectedService: vi.fn(),
}));

const mockListSSHKeys = listSSHKeys as ReturnType<typeof vi.fn>;
const mockGetServerServices = getServerServices as ReturnType<typeof vi.fn>;
const mockDiscoverServices = discoverServices as ReturnType<typeof vi.fn>;
const mockCreateExpectedService = createExpectedService as ReturnType<typeof vi.fn>;
const mockDeleteExpectedService = deleteExpectedService as ReturnType<typeof vi.fn>;

const createMockServer = (): ServerDetail => ({
  id: 'server-1',
  hostname: 'test-server',
  display_name: 'Test Server',
  status: 'online',
  is_paused: false,
  agent_version: '1.0.0',
  agent_mode: 'readonly',
  is_inactive: false,
  inactive_since: null,
  updates_available: 0,
  security_updates: 0,
  latest_metrics: null,
  machine_type: 'server',
  last_seen: '2026-01-29T10:00:00Z',
  active_alert_count: 0,
  active_alert_summaries: [],
  tailscale_hostname: 'test-server.ts.net',
  filesystems: null,
  network_interfaces: null,
  tdp: null,
  os: 'linux',
  kernel: '5.15',
  uptime_seconds: 86400,
  ip_address: '192.168.1.100',
  ssh_host: 'test-server.ts.net',
  ssh_user: 'root',
  has_host_key: true,
  pending_actions: [],
  available_packs: [],
  compliance_results: [],
});

const mockSSHKeys = [
  {
    id: 'key-1',
    name: 'default',
    fingerprint: 'SHA256:abc123def456',
    created_at: '2026-01-01T00:00:00Z',
    is_default: true,
    username: 'root',
  },
  {
    id: 'key-2',
    name: 'secondary',
    fingerprint: 'SHA256:xyz789ghi012',
    created_at: '2026-01-02T00:00:00Z',
    is_default: false,
    username: 'admin',
  },
];

const mockServices = [
  {
    id: 'svc-1',
    server_id: 'server-1',
    service_name: 'nginx',
    display_name: 'Web Server',
    is_critical: true,
    enabled: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'svc-2',
    server_id: 'server-1',
    service_name: 'postgresql',
    display_name: 'Database',
    is_critical: false,
    enabled: true,
    created_at: '2026-01-02T00:00:00Z',
  },
];

function renderModal(
  server = createMockServer(),
  onClose = vi.fn(),
  onServicesChanged = vi.fn()
) {
  return render(
    <ServiceManagementModal
      server={server}
      onClose={onClose}
      onServicesChanged={onServicesChanged}
    />
  );
}

describe('ServiceManagementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSSHKeys.mockResolvedValue({ keys: mockSSHKeys });
    mockGetServerServices.mockResolvedValue({ services: mockServices });
    mockDiscoverServices.mockResolvedValue({
      services: [
        { name: 'docker', status: 'active', description: 'Docker service' },
        { name: 'redis', status: 'active', description: 'Redis cache' },
      ],
    });
    mockCreateExpectedService.mockResolvedValue({
      id: 'svc-3',
      server_id: 'server-1',
      service_name: 'docker',
      display_name: 'Docker',
      is_critical: false,
    });
    mockDeleteExpectedService.mockResolvedValue({});
  });

  describe('initial data loading', () => {
    it('loads both SSH keys and services concurrently on mount', async () => {
      renderModal();

      await waitFor(() => {
        expect(mockListSSHKeys).toHaveBeenCalledTimes(1);
        expect(mockGetServerServices).toHaveBeenCalledWith('server-1');
      });
    });

    it('displays server name in modal header', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/Manage Services - Test Server/)).toBeInTheDocument();
      });
    });

    it('displays all loaded services with their names', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument();
        expect(screen.getByText('postgresql')).toBeInTheDocument();
      });
    });

    it('shows loading spinner while fetching data', async () => {
      // Delay resolution to capture loading state
      mockListSSHKeys.mockReturnValue(new Promise(() => {}));
      mockGetServerServices.mockReturnValue(new Promise(() => {}));

      renderModal();

      // Should show loading indicator
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows error message when SSH key loading fails', async () => {
      mockListSSHKeys.mockRejectedValue(new Error('SSH key fetch failed'));

      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/SSH key fetch failed/i)).toBeInTheDocument();
      });
    });

    it('shows error message when service loading fails', async () => {
      mockGetServerServices.mockRejectedValue(new Error('Service fetch failed'));

      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/Service fetch failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('SSH key selection', () => {
    it('shows all available SSH keys in dropdown', async () => {
      renderModal();

      await waitFor(() => {
        const select = screen.getByTestId('ssh-key-select');
        expect(select).toBeInTheDocument();
      });

      // Check options are present - includes "Attempt all keys" option
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(3); // "Attempt all" + 2 keys
    });

    it('shows "Attempt all keys" as default option', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /Attempt all keys/i })).toBeInTheDocument();
      });
    });

    it('shows key username in dropdown for identification', async () => {
      renderModal();

      await waitFor(() => {
        // Keys show their username in parentheses
        expect(screen.getByText(/\(root\)/)).toBeInTheDocument();
        expect(screen.getByText(/\(admin\)/)).toBeInTheDocument();
      });
    });

    it('marks default key in dropdown', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/Default/)).toBeInTheDocument();
      });
    });

    it('shows message when no SSH keys configured', async () => {
      mockListSSHKeys.mockResolvedValue({ keys: [] });

      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/No SSH keys configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('service discovery', () => {
    it('shows Scan for Services button', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).toBeInTheDocument();
        expect(screen.getByText('Scan for Services')).toBeInTheDocument();
      });
    });

    it('calls discoverServices API when scan button is clicked', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(mockDiscoverServices).toHaveBeenCalled();
      });
    });

    it('uses tailscale_hostname for discovery when available', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(mockDiscoverServices).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'test-server.ts.net',
          })
        );
      });
    });

    it('shows discovered services after scan completes', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(screen.getByText('docker')).toBeInTheDocument();
        expect(screen.getByText('redis')).toBeInTheDocument();
      });
    });

    it('filters out already monitored services from discovery results', async () => {
      // nginx and postgresql are already monitored
      mockDiscoverServices.mockResolvedValue({
        services: [
          { name: 'nginx', status: 'active', description: 'Web server' }, // Already monitored
          { name: 'docker', status: 'active', description: 'Docker service' },
        ],
      });

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        // Should only show docker, not nginx (already monitored)
        expect(screen.getByText('Found 1 services not monitored:')).toBeInTheDocument();
      });
    });

    it('shows message when all discovered services are already monitored', async () => {
      mockDiscoverServices.mockResolvedValue({
        services: [
          { name: 'nginx', status: 'active', description: 'Web server' },
        ],
      });

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(screen.getByText(/All discovered services are already being monitored/i)).toBeInTheDocument();
      });
    });

    it('shows error when discovery fails', async () => {
      mockDiscoverServices.mockRejectedValue(new Error('Discovery failed'));

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(screen.getByText(/Discovery failed/i)).toBeInTheDocument();
      });
    });

    it('disables Scan button during scan', async () => {
      mockDiscoverServices.mockReturnValue(new Promise(() => {}));

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(screen.getByText('Scanning...')).toBeInTheDocument();
      });
    });

    it('disables Scan button when no SSH keys available', async () => {
      mockListSSHKeys.mockResolvedValue({ keys: [] });

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).toBeDisabled();
      });
    });
  });

  describe('adding discovered services', () => {
    it('allows selecting discovered services via checkbox', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(screen.getByTestId('checkbox-docker')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('checkbox-docker'));

      // Button should now show 1 selected
      expect(screen.getByText(/Add Selected Services \(1\)/)).toBeInTheDocument();
    });

    it('calls createExpectedService when adding selected services', async () => {
      const onServicesChanged = vi.fn();
      renderModal(createMockServer(), vi.fn(), onServicesChanged);

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(screen.getByTestId('checkbox-docker')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('checkbox-docker'));
      fireEvent.click(screen.getByTestId('add-selected-button'));

      await waitFor(() => {
        expect(mockCreateExpectedService).toHaveBeenCalledWith(
          'server-1',
          expect.objectContaining({
            service_name: 'docker',
          })
        );
      });
    });
  });

  describe('manual service addition', () => {
    it('shows manual service name input', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('manual-service-name')).toBeInTheDocument();
      });
    });

    it('shows display name input', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('manual-display-name')).toBeInTheDocument();
      });
    });

    it('shows criticality radio buttons', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /Standard/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Core/i })).toBeInTheDocument();
      });
    });

    it('Add button is disabled when service name is empty', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('add-manual-button')).toBeDisabled();
      });
    });

    it('calls createExpectedService when adding manual service', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('manual-service-name')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('manual-service-name'), {
        target: { value: 'custom-service' },
      });

      fireEvent.click(screen.getByTestId('add-manual-button'));

      await waitFor(() => {
        expect(mockCreateExpectedService).toHaveBeenCalledWith(
          'server-1',
          expect.objectContaining({
            service_name: 'custom-service',
          })
        );
      });
    });

    it('converts service name to lowercase', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('manual-service-name')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('manual-service-name'), {
        target: { value: 'UPPERCASE-SERVICE' },
      });

      fireEvent.click(screen.getByTestId('add-manual-button'));

      await waitFor(() => {
        expect(mockCreateExpectedService).toHaveBeenCalledWith(
          'server-1',
          expect.objectContaining({
            service_name: 'uppercase-service',
          })
        );
      });
    });
  });

  describe('current services display', () => {
    it('shows Core badge for critical services', async () => {
      renderModal();

      await waitFor(() => {
        // nginx is critical, should show Core badge
        const coreBadges = screen.getAllByText('Core');
        expect(coreBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows Standard badge for non-critical services', async () => {
      renderModal();

      await waitFor(() => {
        // postgresql is not critical, should show Standard badge
        const standardBadges = screen.getAllByText('Standard');
        expect(standardBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows empty state when no services configured', async () => {
      mockGetServerServices.mockResolvedValue({ services: [] });

      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/No services configured for monitoring/i)).toBeInTheDocument();
      });
    });

    it('shows count of monitored services', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/Currently Monitored \(2\)/)).toBeInTheDocument();
      });
    });
  });

  describe('service deletion', () => {
    it('shows delete button for each service', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('delete-nginx')).toBeInTheDocument();
        expect(screen.getByTestId('delete-postgresql')).toBeInTheDocument();
      });
    });

    it('calls deleteExpectedService when delete button clicked', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('delete-nginx')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-nginx'));

      await waitFor(() => {
        expect(mockDeleteExpectedService).toHaveBeenCalledWith('server-1', 'nginx');
      });
    });
  });

  describe('modal behaviour', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      renderModal(createMockServer(), onClose);

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      renderModal(createMockServer(), onClose);

      await waitFor(() => {
        expect(screen.getByTestId('service-management-modal')).toBeInTheDocument();
      });

      // Click the backdrop (modal container)
      fireEvent.click(screen.getByTestId('service-management-modal'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal content', async () => {
      const onClose = vi.fn();
      renderModal(createMockServer(), onClose);

      await waitFor(() => {
        expect(screen.getByText('Manage Services - Test Server')).toBeInTheDocument();
      });

      // Click on modal content (header text)
      fireEvent.click(screen.getByText('Manage Services - Test Server'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onServicesChanged after successful service creation', async () => {
      const onServicesChanged = vi.fn();
      renderModal(createMockServer(), vi.fn(), onServicesChanged);

      await waitFor(() => {
        expect(screen.getByTestId('manual-service-name')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('manual-service-name'), {
        target: { value: 'new-service' },
      });

      fireEvent.click(screen.getByTestId('add-manual-button'));

      await waitFor(() => {
        expect(onServicesChanged).toHaveBeenCalled();
      });
    });

    it('calls onServicesChanged after successful service deletion', async () => {
      const onServicesChanged = vi.fn();
      renderModal(createMockServer(), vi.fn(), onServicesChanged);

      await waitFor(() => {
        expect(screen.getByTestId('delete-nginx')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-nginx'));

      await waitFor(() => {
        expect(onServicesChanged).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases - SSH connection', () => {
    it('falls back to hostname when tailscale_hostname is not set', async () => {
      const serverWithoutTailscale = {
        ...createMockServer(),
        tailscale_hostname: null,
      };

      renderModal(serverWithoutTailscale);

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(mockDiscoverServices).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'test-server', // Falls back to hostname
          })
        );
      });
    });

    it('passes selected key ID to discovery API', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('ssh-key-select')).toBeInTheDocument();
      });

      // Select a specific key
      fireEvent.change(screen.getByTestId('ssh-key-select'), {
        target: { value: 'key-2' },
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(mockDiscoverServices).toHaveBeenCalledWith(
          expect.objectContaining({
            key_id: 'key-2',
          })
        );
      });
    });

    it('passes null key_id when "Attempt all keys" is selected', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('scan-services-button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('scan-services-button'));

      await waitFor(() => {
        expect(mockDiscoverServices).toHaveBeenCalledWith(
          expect.objectContaining({
            key_id: null,
          })
        );
      });
    });
  });
});
