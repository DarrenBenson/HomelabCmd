/**
 * Tests for ImportDeviceModal component.
 *
 * US0082: Tailscale Import with Agent Installation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ImportDeviceModal } from './ImportDeviceModal';
import { importTailscaleDevice, checkTailscaleImport } from '../api/tailscale';
import { getSSHStatus } from '../api/ssh';
import { installAgent } from '../api/agents';
import type { TailscaleDevice } from '../types/tailscale';

vi.mock('../api/tailscale', () => ({
  importTailscaleDevice: vi.fn(),
  checkTailscaleImport: vi.fn(),
}));

vi.mock('../api/ssh', () => ({
  getSSHStatus: vi.fn(),
}));

vi.mock('../api/agents', () => ({
  installAgent: vi.fn(),
}));

const mockDevice: TailscaleDevice = {
  id: 'device-123',
  hostname: 'test-server.tailnet.ts.net',
  tailscale_ip: '100.64.1.1',
  os: 'linux',
  online: true,
  last_seen: '2026-01-27T10:00:00Z',
  already_imported: false,
};

function renderModal(
  overrides: Partial<Parameters<typeof ImportDeviceModal>[0]> = {}
) {
  return render(
    <BrowserRouter>
      <ImportDeviceModal
        device={mockDevice}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        {...overrides}
      />
    </BrowserRouter>
  );
}

describe('ImportDeviceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no duplicate, SSH not configured
    (checkTailscaleImport as ReturnType<typeof vi.fn>).mockResolvedValue({
      imported: false,
    });
    (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: false,
      key_type: null,
      fingerprint: null,
      uploaded_at: null,
      username: 'homelabcmd',
    });
  });

  describe('existing functionality', () => {
    it('renders device information correctly', () => {
      renderModal();

      expect(
        screen.getByText('test-server.tailnet.ts.net')
      ).toBeInTheDocument();
      expect(screen.getByText('100.64.1.1')).toBeInTheDocument();
      expect(screen.getByText('linux')).toBeInTheDocument();
    });

    it('imports device without agent when checkbox unchecked', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
        },
        message: 'Imported successfully',
      });

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      // Wait for SSH status check to complete
      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      // Submit the form
      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      // Agent install should NOT have been called
      expect(installAgent).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // US0082: AC1 - Install Agent checkbox in import modal
  // ==========================================================================
  describe('AC1: Install Agent checkbox appears in import modal', () => {
    it('shows "Install monitoring agent after import" checkbox', async () => {
      renderModal();

      // Wait for SSH status check
      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      expect(
        screen.getByLabelText(/install monitoring agent after import/i)
      ).toBeInTheDocument();
    });

    it('checkbox is disabled when SSH is not configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: false,
        key_type: null,
        fingerprint: null,
        uploaded_at: null,
        username: 'homelabcmd',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      expect(checkbox).toBeDisabled();
    });

    it('shows tooltip when SSH is not configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: false,
        key_type: null,
        fingerprint: null,
        uploaded_at: null,
        username: 'homelabcmd',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      expect(
        screen.getByText(/configure ssh key in settings to enable/i)
      ).toBeInTheDocument();
    });

    it('checkbox is enabled when SSH is configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:abc123',
        uploaded_at: '2026-01-27T09:00:00Z',
        username: 'homelabcmd',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      expect(checkbox).toBeEnabled();
    });
  });

  // ==========================================================================
  // US0082: AC2 - Checkbox defaults based on SSH configuration
  // ==========================================================================
  describe('AC2: Checkbox defaults based on SSH configuration', () => {
    it('checkbox is checked by default when SSH is configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:abc123',
        uploaded_at: '2026-01-27T09:00:00Z',
        username: 'homelabcmd',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      expect(checkbox).toBeChecked();
    });

    it('checkbox is unchecked and disabled when SSH is not configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: false,
        key_type: null,
        fingerprint: null,
        uploaded_at: null,
        username: 'homelabcmd',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeDisabled();
    });
  });

  // ==========================================================================
  // US0082: AC3 - Import with agent installation
  // ==========================================================================
  describe('AC3: Import with agent installation', () => {
    beforeEach(() => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:abc123',
        uploaded_at: '2026-01-27T09:00:00Z',
        username: 'homelabcmd',
      });
    });

    it('creates server record first, then installs agent', async () => {
      const callOrder: string[] = [];

      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push('import');
          return {
            success: true,
            machine: {
              id: 'test-server',
              server_id: 'test-server',
              display_name: 'TEST-SERVER',
              tailscale_hostname: 'test-server.tailnet.ts.net',
            },
            message: 'Imported successfully',
          };
        }
      );

      (installAgent as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push('install');
          return {
            success: true,
            server_id: 'test-server',
            message: 'Agent installed',
            error: null,
            agent_version: '1.0.0',
          };
        }
      );

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      // Checkbox should be checked by default
      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      expect(checkbox).toBeChecked();

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
        expect(installAgent).toHaveBeenCalled();
      });

      // Verify order: import first, then install
      expect(callOrder).toEqual(['import', 'install']);
    });

    it('calls installAgent with tailscale_hostname', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        server_id: 'test-server',
        message: 'Agent installed',
        error: null,
        agent_version: '1.0.0',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(installAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'test-server.tailnet.ts.net',
          })
        );
      });
    });

    it('shows success message with display_name after import and install', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        server_id: 'test-server',
        message: 'Agent installed',
        error: null,
        agent_version: '1.0.0',
      });

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      // Success message should mention both import and agent
      expect(
        screen.getByText(/imported and installed agent/i)
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // US0082: AC4 - Import without agent installation
  // ==========================================================================
  describe('AC4: Import without agent installation', () => {
    beforeEach(() => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:abc123',
        uploaded_at: '2026-01-27T09:00:00Z',
        username: 'homelabcmd',
      });
    });

    it('does not install agent when checkbox is unchecked', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
        },
        message: 'Imported successfully',
      });

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      // Uncheck the checkbox
      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      });

      // Agent install should NOT have been called
      expect(installAgent).not.toHaveBeenCalled();
    });

    it('shows simple success message when importing without agent', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
        },
        message: 'Imported TEST-SERVER successfully',
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      // Uncheck the checkbox
      const checkbox = screen.getByLabelText(
        /install monitoring agent after import/i
      );
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // US0082: AC5 - Handle agent installation failure
  // ==========================================================================
  describe('AC5: Handle agent installation failure', () => {
    beforeEach(() => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:abc123',
        uploaded_at: '2026-01-27T09:00:00Z',
        username: 'homelabcmd',
      });
    });

    it('server record is still created when agent install fails', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        server_id: null,
        message: 'Installation failed',
        error: 'SSH connection refused',
        agent_version: null,
      });

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
        expect(installAgent).toHaveBeenCalled();
      });

      // onSuccess should still be called (server was created)
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('shows error message with reason when agent install fails', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        server_id: null,
        message: 'Installation failed',
        error: 'SSH connection refused',
        agent_version: null,
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/imported.*but agent installation failed/i)
        ).toBeInTheDocument();
      });

      expect(screen.getByText(/ssh connection refused/i)).toBeInTheDocument();
    });

    it('shows Retry Install button on agent failure', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      (installAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        server_id: null,
        message: 'Installation failed',
        error: 'SSH connection refused',
        agent_version: null,
      });

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry install/i })
        ).toBeInTheDocument();
      });
    });

    it('retries agent install when Retry Install clicked', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      let installCallCount = 0;
      (installAgent as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          installCallCount++;
          if (installCallCount === 1) {
            return {
              success: false,
              server_id: null,
              message: 'Installation failed',
              error: 'SSH connection refused',
              agent_version: null,
            };
          }
          return {
            success: true,
            server_id: 'test-server',
            message: 'Agent installed',
            error: null,
            agent_version: '1.0.0',
          };
        }
      );

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      // First attempt
      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry install/i })
        ).toBeInTheDocument();
      });

      // Retry
      fireEvent.click(screen.getByRole('button', { name: /retry install/i }));

      await waitFor(() => {
        expect(installCallCount).toBe(2);
      });
    });
  });

  // ==========================================================================
  // US0082: AC6 - Progress feedback during installation
  // ==========================================================================
  describe('AC6: Progress feedback during installation', () => {
    beforeEach(() => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        configured: true,
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:abc123',
        uploaded_at: '2026-01-27T09:00:00Z',
        username: 'homelabcmd',
      });
    });

    it('shows progress indicator during agent installation', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      // Make install hang so we can check loading state
      let resolveInstall: (value: unknown) => void;
      (installAgent as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInstall = resolve;
          })
      );

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      // Wait for import to complete and install to start
      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
      });

      // Should show installing message
      await waitFor(() => {
        expect(screen.getByText(/installing agent/i)).toBeInTheDocument();
      });

      // Resolve the install
      resolveInstall!({
        success: true,
        server_id: 'test-server',
        message: 'Agent installed',
        error: null,
        agent_version: '1.0.0',
      });

      await waitFor(() => {
        expect(
          screen.queryByText(/installing agent/i)
        ).not.toBeInTheDocument();
      });
    });

    it('disables Cancel button during installation', async () => {
      (importTailscaleDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        machine: {
          id: 'test-server',
          server_id: 'test-server',
          display_name: 'TEST-SERVER',
          tailscale_hostname: 'test-server.tailnet.ts.net',
        },
        message: 'Imported successfully',
      });

      let resolveInstall: (value: unknown) => void;
      (installAgent as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInstall = resolve;
          })
      );

      renderModal();

      await waitFor(() => {
        expect(getSSHStatus).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /import machine/i }));

      await waitFor(() => {
        expect(importTailscaleDevice).toHaveBeenCalled();
      });

      // Cancel button should be disabled during install
      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        expect(cancelButton).toBeDisabled();
      });

      resolveInstall!({
        success: true,
        server_id: 'test-server',
        message: 'Agent installed',
        error: null,
        agent_version: '1.0.0',
      });
    });
  });
});
