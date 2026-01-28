/**
 * Tests for ConnectivitySettings component.
 *
 * Part of EP0008: Tailscale Integration (US0080).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectivitySettings } from './ConnectivitySettings';
import {
  getConnectivityStatus,
  updateConnectivityMode,
} from '../api/connectivity';
import type { ConnectivityStatusResponse } from '../types/connectivity';

vi.mock('../api/connectivity', () => ({
  getConnectivityStatus: vi.fn(),
  updateConnectivityMode: vi.fn(),
}));

const mockStatusTailscale: ConnectivityStatusResponse = {
  mode: 'tailscale',
  mode_auto_detected: false,
  tailscale: {
    configured: true,
    connected: true,
    tailnet: 'example.ts.net',
    device_count: 5,
  },
  ssh: {
    username: 'homelabcmd',
    key_configured: true,
    key_uploaded_at: '2024-01-15T10:30:00Z',
  },
};

const mockStatusDirectSSH: ConnectivityStatusResponse = {
  mode: 'direct_ssh',
  mode_auto_detected: false,
  tailscale: {
    configured: false,
    connected: false,
    tailnet: null,
    device_count: 0,
  },
  ssh: {
    username: 'admin',
    key_configured: false,
    key_uploaded_at: null,
  },
};

const mockStatusAutoDetected: ConnectivityStatusResponse = {
  mode: 'tailscale',
  mode_auto_detected: true,
  tailscale: {
    configured: true,
    connected: true,
    tailnet: 'my.ts.net',
    device_count: 3,
  },
  ssh: {
    username: 'homelabcmd',
    key_configured: true,
    key_uploaded_at: '2024-01-10T08:00:00Z',
  },
};

const mockStatusTailscaleDisconnected: ConnectivityStatusResponse = {
  mode: 'tailscale',
  mode_auto_detected: false,
  tailscale: {
    configured: true,
    connected: false,
    tailnet: null,
    device_count: 0,
  },
  ssh: {
    username: 'homelabcmd',
    key_configured: false,
    key_uploaded_at: null,
  },
};

describe('ConnectivitySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching status', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(<ConnectivitySettings />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(screen.getByText('Loading connectivity settings...')).toBeInTheDocument();
    });
  });

  describe('Tailscale Mode Active', () => {
    it('displays current mode as Tailscale', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusTailscale);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Current mode: Tailscale')).toBeInTheDocument();
      });
    });

    it('shows Active badge on Tailscale option', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusTailscale);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        const tailscaleOption = screen.getByTestId('tailscale-mode-option');
        expect(tailscaleOption).toHaveTextContent('Active');
      });
    });

    it('shows connected tailnet information', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusTailscale);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Connected to tailnet: example.ts.net')).toBeInTheDocument();
      });
      expect(screen.getByText('5 devices discovered')).toBeInTheDocument();
    });

    it('selects Tailscale radio button', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusTailscale);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        const tailscaleRadio = screen.getAllByRole('radio')[0];
        expect(tailscaleRadio).toBeChecked();
      });
    });
  });

  describe('Direct SSH Mode Active', () => {
    it('displays current mode as Direct SSH', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Current mode: Direct SSH')).toBeInTheDocument();
      });
    });

    it('shows Active badge on Direct SSH option', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        const directSSHOption = screen.getByTestId('direct-ssh-mode-option');
        expect(directSSHOption).toHaveTextContent('Active');
      });
    });

    it('selects Direct SSH radio button', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        const directSSHRadio = screen.getAllByRole('radio')[1];
        expect(directSSHRadio).toBeChecked();
      });
    });
  });

  describe('Auto-detected Mode', () => {
    it('shows auto-detected message', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusAutoDetected);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Mode auto-detected based on configuration')).toBeInTheDocument();
      });
    });
  });

  describe('Mode Selection', () => {
    it('shows save button when mode is changed', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByTestId('direct-ssh-mode-option')).toBeInTheDocument();
      });

      // Save button should not be visible initially
      expect(screen.queryByTestId('save-mode-button')).not.toBeInTheDocument();

      // Click Tailscale option to change mode
      fireEvent.click(screen.getByTestId('tailscale-mode-option'));

      // Save button should appear
      expect(screen.getByTestId('save-mode-button')).toBeInTheDocument();
    });

    it('changes selection when clicking option', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getAllByRole('radio')[1]).toBeChecked();
      });

      fireEvent.click(screen.getByTestId('tailscale-mode-option'));

      expect(screen.getAllByRole('radio')[0]).toBeChecked();
      expect(screen.getAllByRole('radio')[1]).not.toBeChecked();
    });

    it('saves mode successfully', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockStatusDirectSSH)
        .mockResolvedValueOnce(mockStatusTailscale);
      (updateConnectivityMode as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        mode: 'tailscale',
        message: 'Connectivity mode updated to Tailscale',
      });

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByTestId('direct-ssh-mode-option')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tailscale-mode-option'));
      fireEvent.click(screen.getByTestId('save-mode-button'));

      await waitFor(() => {
        expect(updateConnectivityMode).toHaveBeenCalledWith({
          mode: 'tailscale',
          ssh_username: 'admin',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Connectivity mode updated to Tailscale')).toBeInTheDocument();
      });
    });

    it('shows error when save fails', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);
      (updateConnectivityMode as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Tailscale not configured')
      );

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByTestId('direct-ssh-mode-option')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tailscale-mode-option'));
      fireEvent.click(screen.getByTestId('save-mode-button'));

      await waitFor(() => {
        expect(screen.getByText('Tailscale not configured')).toBeInTheDocument();
      });
    });

    it('hides save button when mode is reverted', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByTestId('direct-ssh-mode-option')).toBeInTheDocument();
      });

      // Change to Tailscale
      fireEvent.click(screen.getByTestId('tailscale-mode-option'));
      expect(screen.getByTestId('save-mode-button')).toBeInTheDocument();

      // Revert to Direct SSH
      fireEvent.click(screen.getByTestId('direct-ssh-mode-option'));
      expect(screen.queryByTestId('save-mode-button')).not.toBeInTheDocument();
    });
  });

  describe('Tailscale Disconnected State', () => {
    it('shows warning when token configured but not connected', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusTailscaleDisconnected);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Token configured but not connected')).toBeInTheDocument();
      });
    });
  });

  describe('Tailscale Unconfigured Warning', () => {
    it('shows warning when selecting tailscale without token', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByTestId('tailscale-mode-option')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tailscale-mode-option'));

      expect(screen.getByText('Configure Tailscale API token below to enable this mode')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error when status fetch fails', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles non-Error exceptions gracefully', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load connectivity status')).toBeInTheDocument();
      });
    });
  });

  describe('Mode Options Content', () => {
    it('shows Tailscale Mode description', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Tailscale Mode')).toBeInTheDocument();
      });
      expect(screen.getByText(/Use Tailscale mesh network/)).toBeInTheDocument();
    });

    it('shows Direct SSH Mode description', async () => {
      (getConnectivityStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusDirectSSH);

      render(<ConnectivitySettings />);

      await waitFor(() => {
        expect(screen.getByText('Direct SSH Mode')).toBeInTheDocument();
      });
      expect(screen.getByText(/Connect directly via IP address/)).toBeInTheDocument();
    });
  });
});
