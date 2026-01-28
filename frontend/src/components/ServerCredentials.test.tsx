/**
 * Tests for ServerCredentials component (US0088).
 *
 * Spec Reference: sdlc-studio/stories/US0088-server-credential-ui.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServerCredentials } from './ServerCredentials';
import {
  getServerCredentials,
  storeServerCredential,
  deleteServerCredential,
  updateServer,
} from '../api/servers';

vi.mock('../api/servers', () => ({
  getServerCredentials: vi.fn(),
  storeServerCredential: vi.fn(),
  deleteServerCredential: vi.fn(),
  updateServer: vi.fn(),
}));

const mockCredentialsResponse = {
  server_id: 'test-server',
  ssh_username: null,
  sudo_mode: 'passwordless' as const,
  credentials: [
    { credential_type: 'ssh_private_key', configured: false, scope: 'none' as const },
    { credential_type: 'sudo_password', configured: false, scope: 'none' as const },
    { credential_type: 'ssh_password', configured: false, scope: 'none' as const },
  ],
};

describe('ServerCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Credentials section rendering', () => {
    it('renders credentials section with title', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('SSH Configuration')).toBeInTheDocument();
      });
      expect(screen.getByText('Sudo Configuration')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      render(<ServerCredentials serverId="test-server" />);

      expect(screen.getByTestId('credentials-loading')).toBeInTheDocument();
    });
  });

  describe('AC2: View credential configuration status', () => {
    it('shows credential status for each type', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        credentials: [
          { credential_type: 'ssh_private_key', configured: true, scope: 'per_server' },
          { credential_type: 'sudo_password', configured: true, scope: 'global' },
          { credential_type: 'ssh_password', configured: false, scope: 'none' },
        ],
      });
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        // Badges appear both inline and in summary section
        expect(screen.getAllByText(/per-server/i).length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getAllByText(/global/i).length).toBeGreaterThanOrEqual(1);
    });

    it('never displays credential values', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        credentials: [
          { credential_type: 'sudo_password', configured: true, scope: 'per_server' },
        ],
      });
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
      });
      // Password and text inputs should not show credential values (only empty or placeholder)
      // Check that no input has actual credential values displayed
      const passwordInputs = screen.queryAllByRole('textbox');
      passwordInputs.forEach((input) => {
        expect((input as HTMLInputElement).value).toBe('');
      });
    });
  });

  describe('AC3: Set/update SSH username', () => {
    it('displays SSH username input field', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/SSH Username/i)).toBeInTheDocument();
      });
    });

    it('updates SSH username on save', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      (updateServer as ReturnType<typeof vi.fn>).mockResolvedValue({});
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/SSH Username/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/SSH Username/i);
      fireEvent.change(input, { target: { value: 'admin' } });
      fireEvent.click(screen.getByTestId('save-ssh-username'));

      await waitFor(() => {
        expect(updateServer).toHaveBeenCalledWith('test-server', { ssh_username: 'admin' });
      });
    });

    it('clears SSH username when empty value saved', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        ssh_username: 'existing-user',
      });
      (updateServer as ReturnType<typeof vi.fn>).mockResolvedValue({});
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/SSH Username/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/SSH Username/i);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(screen.getByTestId('save-ssh-username'));

      await waitFor(() => {
        expect(updateServer).toHaveBeenCalledWith('test-server', { ssh_username: null });
      });
    });
  });

  describe('AC4: Set sudo mode', () => {
    it('displays sudo mode selector', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Passwordless sudo/i)).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/Requires sudo password/i)).toBeInTheDocument();
    });

    it('updates sudo mode on selection', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      (updateServer as ReturnType<typeof vi.fn>).mockResolvedValue({});
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Requires sudo password/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(/Requires sudo password/i));

      await waitFor(() => {
        expect(updateServer).toHaveBeenCalledWith('test-server', { sudo_mode: 'password' });
      });
    });
  });

  describe('AC5: Upload per-server SSH key', () => {
    it('displays SSH key section', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        // "SSH Key" appears in both the form section label and summary - that's expected
        expect(screen.getAllByText(/SSH Key/i).length).toBeGreaterThanOrEqual(1);
      });
      // Also verify the textarea is present
      expect(screen.getByTestId('ssh-key-input')).toBeInTheDocument();
    });

    it('stores SSH key on save', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      (storeServerCredential as ReturnType<typeof vi.fn>).mockResolvedValue({});
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-key-input')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('ssh-key-input');
      fireEvent.change(textarea, { target: { value: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----' } });
      fireEvent.click(screen.getByTestId('save-ssh-key'));

      await waitFor(() => {
        expect(storeServerCredential).toHaveBeenCalledWith(
          'test-server',
          'ssh_private_key',
          expect.stringContaining('-----BEGIN OPENSSH PRIVATE KEY-----')
        );
      });
    });
  });

  describe('AC6: Set per-server sudo password', () => {
    it('displays sudo password input when sudo mode is password', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        sudo_mode: 'password',
      });
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('sudo-password-input')).toBeInTheDocument();
      });
    });

    it('stores sudo password on save', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        sudo_mode: 'password',
      });
      (storeServerCredential as ReturnType<typeof vi.fn>).mockResolvedValue({});
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('sudo-password-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('sudo-password-input');
      fireEvent.change(input, { target: { value: 'mysudopass' } });
      fireEvent.click(screen.getByTestId('save-sudo-password'));

      await waitFor(() => {
        expect(storeServerCredential).toHaveBeenCalledWith(
          'test-server',
          'sudo_password',
          'mysudopass'
        );
      });
    });
  });

  describe('AC7: Remove per-server credentials', () => {
    it('shows remove button for per-server credential', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        sudo_mode: 'password',
        credentials: [
          { credential_type: 'sudo_password', configured: true, scope: 'per_server' },
        ],
      });
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-sudo_password')).toBeInTheDocument();
      });
    });

    it('deletes credential and refreshes on remove', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        sudo_mode: 'password',
        credentials: [
          { credential_type: 'sudo_password', configured: true, scope: 'per_server' },
        ],
      });
      (deleteServerCredential as ReturnType<typeof vi.fn>).mockResolvedValue({});
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-sudo_password')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-sudo_password'));

      await waitFor(() => {
        expect(deleteServerCredential).toHaveBeenCalledWith('test-server', 'sudo_password');
      });
    });
  });

  describe('AC8: Clear indication of scope', () => {
    it('shows per-server badge for per-server credentials', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        credentials: [
          { credential_type: 'ssh_private_key', configured: true, scope: 'per_server' },
        ],
      });
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        // Badge appears both inline and in summary section
        expect(screen.getAllByText(/per-server/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows global badge for global credentials', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredentialsResponse,
        credentials: [
          { credential_type: 'ssh_private_key', configured: true, scope: 'global' },
        ],
      });
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        // Badge appears both inline and in summary section
        expect(screen.getAllByText(/global/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows not configured for none scope', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockResolvedValue(mockCredentialsResponse);
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        // "Not configured" appears for multiple unconfigured credential types
        expect(screen.getAllByText(/not configured/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Error handling', () => {
    it('shows error message when loading fails', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load credentials/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('retries loading on retry click', async () => {
      (getServerCredentials as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockCredentialsResponse);
      render(<ServerCredentials serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/retry/i));

      await waitFor(() => {
        expect(getServerCredentials).toHaveBeenCalledTimes(2);
      });
    });
  });
});
