/**
 * Tests for UnifiedImportModal component.
 *
 * EP0016: Unified Discovery Experience (US0099)
 *
 * ACs covered:
 * - Modal displays device info (hostname, IP, OS)
 * - Display name pre-filled from hostname (capitalised)
 * - Machine type selection (server/workstation)
 * - TDP input with validation
 * - Agent installation checkbox with SSH key selection
 * - Duplicate detection for Tailscale devices
 * - Network device requires agent installation
 *
 * Edge cases from TSD/TRD:
 * - Import Tailscale device with agent installation
 * - Import Tailscale device without agent installation
 * - Network device import requires SSH key
 * - Validation: display name required
 * - Validation: display name max length 100
 * - Validation: TDP must be positive number
 * - Agent installation failure with retry
 * - Form disabled during import process
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedImportModal } from './UnifiedImportModal';
import { importTailscaleDevice, checkTailscaleImport } from '../api/tailscale';
import { installAgent } from '../api/agents';
import type { UnifiedDevice } from '../types/discovery';
import type { SSHKeyMetadata } from '../types/scan';

vi.mock('../api/tailscale', () => ({
  importTailscaleDevice: vi.fn(),
  checkTailscaleImport: vi.fn(),
}));

vi.mock('../api/agents', () => ({
  installAgent: vi.fn(),
}));

const mockImportTailscaleDevice = importTailscaleDevice as ReturnType<typeof vi.fn>;
const mockCheckTailscaleImport = checkTailscaleImport as ReturnType<typeof vi.fn>;
const mockInstallAgent = installAgent as ReturnType<typeof vi.fn>;

const createMockDevice = (overrides: Partial<UnifiedDevice> = {}): UnifiedDevice => ({
  id: 'device-1',
  hostname: 'test-server',
  ip: '192.168.1.100',
  os: 'linux',
  source: 'tailscale',
  availability: 'available',
  isMonitored: false,
  serverId: null,
  sshKeyUsed: null,
  unavailableReason: null,
  responseTimeMs: null,
  lastSeen: '2026-01-29T10:00:00Z',
  tailscaleDeviceId: 'ts-device-1',
  tailscaleHostname: 'test-server.tailnet.ts.net',
  ...overrides,
});

const createMockSSHKey = (overrides: Partial<SSHKeyMetadata> = {}): SSHKeyMetadata => ({
  id: 'key-1',
  name: 'default-key',
  fingerprint: 'SHA256:abcdef123456789',
  created_at: '2026-01-01T00:00:00Z',
  is_default: true,
  username: 'root',
  ...overrides,
});

function renderModal(
  device: UnifiedDevice = createMockDevice(),
  sshKeys: SSHKeyMetadata[] = [createMockSSHKey()],
  onClose = vi.fn(),
  onSuccess = vi.fn()
) {
  return render(
    <MemoryRouter>
      <UnifiedImportModal
        isOpen={true}
        device={device}
        sshKeys={sshKeys}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </MemoryRouter>
  );
}

describe('UnifiedImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckTailscaleImport.mockResolvedValue({ imported: false });
    mockImportTailscaleDevice.mockResolvedValue({
      machine: {
        server_id: 'server-123',
        display_name: 'Test Server',
        tailscale_hostname: 'test-server.tailnet.ts.net',
      },
    });
    mockInstallAgent.mockResolvedValue({ success: true });
  });

  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <MemoryRouter>
          <UnifiedImportModal
            isOpen={false}
            device={createMockDevice()}
            sshKeys={[createMockSSHKey()]}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.queryByRole('heading', { name: /Import Device/i })).not.toBeInTheDocument();
    });

    it('renders modal header', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Import Device/i })).toBeInTheDocument();
      });
    });

    it('shows tailscale hostname for tailscale devices', async () => {
      renderModal(createMockDevice({ source: 'tailscale', tailscaleHostname: 'my-server.ts.net' }));

      await waitFor(() => {
        expect(screen.getByText('my-server.ts.net')).toBeInTheDocument();
      });
    });

    it('shows IP address for network devices', async () => {
      renderModal(createMockDevice({ source: 'network', ip: '10.0.0.50' }));

      await waitFor(() => {
        expect(screen.getByText('10.0.0.50')).toBeInTheDocument();
      });
    });

    it('shows OS type', async () => {
      renderModal(createMockDevice({ os: 'linux' }));

      await waitFor(() => {
        expect(screen.getByText('linux')).toBeInTheDocument();
      });
    });

    it('renders Cancel button', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });
    });

    it('renders Import Device button', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });
    });
  });

  describe('form fields', () => {
    it('pre-fills display name from hostname (capitalised)', async () => {
      renderModal(createMockDevice({ hostname: 'my-server' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Display Name/i);
        expect(input).toHaveValue('My-server');
      });
    });

    it('allows editing display name', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/Display Name/i);
      fireEvent.change(input, { target: { value: 'Custom Name' } });

      expect(input).toHaveValue('Custom Name');
    });

    it('defaults to server machine type', async () => {
      renderModal();

      await waitFor(() => {
        const serverRadio = screen.getByRole('radio', { name: /Server/i });
        expect(serverRadio).toBeChecked();
      });
    });

    it('allows selecting workstation machine type', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /Workstation/i })).toBeInTheDocument();
      });

      const workstationRadio = screen.getByRole('radio', { name: /Workstation/i });
      fireEvent.click(workstationRadio);

      expect(workstationRadio).toBeChecked();
    });

    it('allows entering TDP', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/TDP/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/TDP/i);
      fireEvent.change(input, { target: { value: '65' } });

      expect(input).toHaveValue(65);
    });
  });

  describe('validation', () => {
    it('shows error when display name is empty', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/Display Name/i);
      fireEvent.change(input, { target: { value: '' } });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/Display name is required/i)).toBeInTheDocument();
      });
    });

    it('shows error when display name exceeds 100 characters', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/Display Name/i);
      fireEvent.change(input, { target: { value: 'a'.repeat(101) } });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/Display name must be 100 characters or less/i)).toBeInTheDocument();
      });
    });

    it('allows submitting with optional TDP field empty', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/TDP/i)).toBeInTheDocument();
      });

      // TDP is optional, should submit without it
      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(/Install monitoring agent/i));
      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(mockImportTailscaleDevice).toHaveBeenCalled();
      });
    });

    it('accepts valid positive TDP values', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/TDP/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/TDP/i);
      fireEvent.change(input, { target: { value: '65' } });

      // Should not show validation error
      expect(screen.queryByText(/TDP must be/i)).not.toBeInTheDocument();
    });
  });

  describe('agent installation checkbox', () => {
    it('shows install agent checkbox when SSH keys configured', async () => {
      renderModal(createMockDevice(), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });
    });

    it('is checked by default when SSH configured and device available', async () => {
      renderModal(
        createMockDevice({ availability: 'available' }),
        [createMockSSHKey()]
      );

      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Install monitoring agent/i);
        expect(checkbox).toBeChecked();
      });
    });

    it('shows configure SSH link when no keys', async () => {
      renderModal(createMockDevice(), []);

      await waitFor(() => {
        expect(screen.getByText(/Configure SSH key in Settings/i)).toBeInTheDocument();
      });
    });

    it('shows SSH key selector when multiple keys and checkbox checked', async () => {
      renderModal(createMockDevice({ availability: 'available' }), [
        createMockSSHKey({ id: 'key-1', name: 'Key One' }),
        createMockSSHKey({ id: 'key-2', name: 'Key Two', is_default: false }),
      ]);

      await waitFor(() => {
        expect(screen.getByLabelText(/SSH Key/i)).toBeInTheDocument();
      });
    });

    it('shows single key info when only one key', async () => {
      renderModal(createMockDevice({ availability: 'available' }), [
        createMockSSHKey({ id: 'key-1', name: 'my-key', fingerprint: 'SHA256:xyz123' }),
      ]);

      await waitFor(() => {
        expect(screen.getByText(/Using: my-key/)).toBeInTheDocument();
      });
    });
  });

  describe('duplicate detection (tailscale)', () => {
    it('shows duplicate warning when device already imported', async () => {
      mockCheckTailscaleImport.mockResolvedValue({
        imported: true,
        machine_id: 'existing-123',
        display_name: 'Existing Server',
      });

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('This device is already imported')).toBeInTheDocument();
      });
    });

    it('provides link to view existing machine', async () => {
      mockCheckTailscaleImport.mockResolvedValue({
        imported: true,
        machine_id: 'existing-123',
        display_name: 'Existing Server',
      });

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('View Machine')).toBeInTheDocument();
      });
    });

    it('disables form when duplicate found', async () => {
      mockCheckTailscaleImport.mockResolvedValue({
        imported: true,
        machine_id: 'existing-123',
        display_name: 'Existing Server',
      });

      renderModal();

      await waitFor(() => {
        const input = screen.getByLabelText(/Display Name/i);
        expect(input).toBeDisabled();
      });
    });
  });

  describe('tailscale import flow', () => {
    it('imports tailscale device without agent when unchecked', async () => {
      const onSuccess = vi.fn();
      renderModal(
        createMockDevice({ source: 'tailscale' }),
        [createMockSSHKey()],
        vi.fn(),
        onSuccess
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      // Uncheck agent install
      const checkbox = screen.getByLabelText(/Install monitoring agent/i);
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(mockImportTailscaleDevice).toHaveBeenCalled();
        expect(mockInstallAgent).not.toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('imports tailscale device with agent installation', async () => {
      const onSuccess = vi.fn();
      renderModal(
        createMockDevice({ source: 'tailscale' }),
        [createMockSSHKey()],
        vi.fn(),
        onSuccess
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      // Agent install should be checked by default
      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(mockImportTailscaleDevice).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockInstallAgent).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('shows success message after import', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      // Uncheck agent install for faster test
      fireEvent.click(screen.getByLabelText(/Install monitoring agent/i));

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/Imported.*successfully/i)).toBeInTheDocument();
      });
    });

    it('shows Done button after successful import', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(/Install monitoring agent/i));
      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
      });
    });
  });

  describe('network device import flow', () => {
    it('shows error for network device without SSH keys', async () => {
      renderModal(
        createMockDevice({ source: 'network' }),
        [] // No SSH keys
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /Import Device/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Network devices require agent installation/i)).toBeInTheDocument();
      });
    });

    it('shows "Required for network devices" hint', async () => {
      renderModal(
        createMockDevice({ source: 'network' }),
        [createMockSSHKey()]
      );

      await waitFor(() => {
        expect(screen.getByText(/Required for network devices/i)).toBeInTheDocument();
      });
    });

    it('imports network device with agent installation', async () => {
      const onSuccess = vi.fn();
      renderModal(
        createMockDevice({ source: 'network', tailscaleDeviceId: undefined, tailscaleHostname: undefined }),
        [createMockSSHKey()],
        vi.fn(),
        onSuccess
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(mockInstallAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: '192.168.1.100',
            display_name: 'Test-server',
          })
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('agent installation failure', () => {
    it('shows partial success when agent installation fails', async () => {
      mockInstallAgent.mockResolvedValue({ success: false, error: 'Connection refused' });

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/agent installation failed/i)).toBeInTheDocument();
      });
    });

    it('shows retry button after agent installation failure', async () => {
      mockInstallAgent.mockResolvedValue({ success: false, error: 'Connection refused' });

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry Install/i })).toBeInTheDocument();
      });
    });

    it('calls installAgent again when retry clicked', async () => {
      mockInstallAgent.mockResolvedValueOnce({ success: false, error: 'Connection refused' });
      mockInstallAgent.mockResolvedValueOnce({ success: true });

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry Install/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Retry Install/i }));

      await waitFor(() => {
        expect(mockInstallAgent).toHaveBeenCalledTimes(2);
      });
    });

    it('handles agent installation exception', async () => {
      mockInstallAgent.mockRejectedValue(new Error('Network error'));

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('import error handling', () => {
    it('shows error when tailscale import fails', async () => {
      mockImportTailscaleDevice.mockRejectedValue(new Error('API error'));

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      // Uncheck agent to test import-only flow
      fireEvent.click(screen.getByLabelText(/Install monitoring agent/i));
      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/API error/i)).toBeInTheDocument();
      });
    });

    it('shows error when network install fails', async () => {
      mockInstallAgent.mockResolvedValue({ success: false, error: 'SSH connection failed' });

      renderModal(
        createMockDevice({ source: 'network', tailscaleDeviceId: undefined, tailscaleHostname: undefined }),
        [createMockSSHKey()]
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/SSH connection failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('close behaviour', () => {
    it('calls onClose when Cancel clicked', async () => {
      const onClose = vi.fn();
      renderModal(createMockDevice(), [], onClose);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when X button clicked', async () => {
      const onClose = vi.fn();
      renderModal(createMockDevice(), [], onClose);

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Done clicked after success', async () => {
      const onClose = vi.fn();
      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()], onClose);

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      // Uncheck agent for faster test
      fireEvent.click(screen.getByLabelText(/Install monitoring agent/i));
      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Done/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('form disabled state', () => {
    it('shows loading text while importing', async () => {
      // Make import take time
      mockImportTailscaleDevice.mockReturnValue(new Promise(() => {}));

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByLabelText(/Install monitoring agent/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(/Install monitoring agent/i));
      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText('Importing...')).toBeInTheDocument();
      });
    });

    it('shows installing progress during agent installation', async () => {
      // Make agent install take time
      mockInstallAgent.mockReturnValue(new Promise(() => {}));

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/Installing agent/i)).toBeInTheDocument();
      });
    });

    it('disables Cancel during agent installation', async () => {
      // Make agent install take time
      mockInstallAgent.mockReturnValue(new Promise(() => {}));

      renderModal(createMockDevice({ source: 'tailscale' }), [createMockSSHKey()]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Device/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import Device/i }));

      await waitFor(() => {
        expect(screen.getByText(/Installing agent/i)).toBeInTheDocument();
      });

      // Cancel button should be disabled during installation
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    });
  });

  describe('SSH key pre-selection', () => {
    it('pre-selects default SSH key', async () => {
      const keys = [
        createMockSSHKey({ id: 'key-1', name: 'Key One', is_default: false }),
        createMockSSHKey({ id: 'key-2', name: 'Key Two', is_default: true }),
      ];

      renderModal(createMockDevice({ availability: 'available' }), keys);

      await waitFor(() => {
        const select = screen.getByLabelText(/SSH Key/i) as HTMLSelectElement;
        expect(select.value).toBe('key-2');
      });
    });

    it('pre-selects first key when no default', async () => {
      const keys = [
        createMockSSHKey({ id: 'key-1', name: 'Key One', is_default: false }),
        createMockSSHKey({ id: 'key-2', name: 'Key Two', is_default: false }),
      ];

      renderModal(createMockDevice({ availability: 'available' }), keys);

      await waitFor(() => {
        const select = screen.getByLabelText(/SSH Key/i) as HTMLSelectElement;
        expect(select.value).toBe('key-1');
      });
    });
  });
});
