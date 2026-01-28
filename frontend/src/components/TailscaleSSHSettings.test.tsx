/**
 * Tests for TailscaleSSHSettings component.
 *
 * Part of EP0008: Tailscale Integration (US0079).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TailscaleSSHSettings } from './TailscaleSSHSettings';
import { getSSHStatus, uploadSSHKey, removeSSHKey, updateSSHUsername } from '../api/ssh';
import type { SSHKeyStatusResponse } from '../types/ssh';

vi.mock('../api/ssh', () => ({
  getSSHStatus: vi.fn(),
  uploadSSHKey: vi.fn(),
  removeSSHKey: vi.fn(),
  updateSSHUsername: vi.fn(),
}));

const mockStatusConfigured: SSHKeyStatusResponse = {
  configured: true,
  key_type: 'ssh-ed25519',
  fingerprint: 'SHA256:abc123def456ghi789jkl012mno345pqr678stu901',
  uploaded_at: '2024-01-15T10:30:00Z',
  username: 'homelabcmd',
};

const mockStatusUnconfigured: SSHKeyStatusResponse = {
  configured: false,
  key_type: null,
  fingerprint: null,
  uploaded_at: null,
  username: 'homelabcmd',
};

describe('TailscaleSSHSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching status', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(<TailscaleSSHSettings />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Unconfigured State', () => {
    it('shows unconfigured message when no key', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('No SSH key configured')).toBeInTheDocument();
      });
    });

    it('shows upload guidance when unconfigured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText(/Upload an SSH private key to enable SSH connections/)).toBeInTheDocument();
      });
    });

    it('shows upload button text for unconfigured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Upload key file')).toBeInTheDocument();
      });
    });

    it('does not show remove button when unconfigured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Upload key file')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('remove-ssh-key-button')).not.toBeInTheDocument();
    });
  });

  describe('Configured State', () => {
    it('shows key type when configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Key configured: ssh-ed25519')).toBeInTheDocument();
      });
    });

    it('shows key details section', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Key Type')).toBeInTheDocument();
      });
      expect(screen.getByText('ssh-ed25519')).toBeInTheDocument();
      expect(screen.getByText('Fingerprint')).toBeInTheDocument();
    });

    it('shows truncated fingerprint', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      // Fingerprint truncated: first 6 chars + ... + last 4 chars
      await waitFor(() => {
        expect(screen.getByText('SHA256:abc123...u901')).toBeInTheDocument();
      });
    });

    it('shows uploaded date', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Uploaded')).toBeInTheDocument();
      });
      // Date formatted by locale
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });

    it('shows replace key button when configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Replace key')).toBeInTheDocument();
      });
    });

    it('shows remove button when configured', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-ssh-key-button')).toBeInTheDocument();
      });
    });
  });

  describe('Username Configuration', () => {
    it('displays current username', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-username-input')).toHaveValue('homelabcmd');
      });
    });

    it('disables save button when username unchanged', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('save-ssh-username-button')).toBeDisabled();
      });
    });

    it('enables save button when username changed', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-username-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('ssh-username-input'), {
        target: { value: 'newuser' },
      });

      expect(screen.getByTestId('save-ssh-username-button')).not.toBeDisabled();
    });

    it('updates username successfully', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (updateSSHUsername as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        message: 'Username updated',
      });

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-username-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('ssh-username-input'), {
        target: { value: 'newuser' },
      });

      fireEvent.click(screen.getByTestId('save-ssh-username-button'));

      await waitFor(() => {
        expect(updateSSHUsername).toHaveBeenCalledWith('newuser');
      });

      await waitFor(() => {
        expect(screen.getByTestId('ssh-success-message')).toBeInTheDocument();
      });
    });

    it('shows error when username update fails', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (updateSSHUsername as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Invalid username')
      );

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-username-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('ssh-username-input'), {
        target: { value: 'invalid!' },
      });

      fireEvent.click(screen.getByTestId('save-ssh-username-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ssh-error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Invalid username')).toBeInTheDocument();
    });
  });

  describe('Key Upload', () => {
    it('shows file input', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-key-file-input')).toBeInTheDocument();
      });
    });

    it('shows success message after upload', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockStatusUnconfigured)
        .mockResolvedValueOnce(mockStatusConfigured);
      (uploadSSHKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        message: 'Key uploaded',
        key_type: 'ssh-ed25519',
        fingerprint: 'SHA256:test123',
      });

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-key-file-input')).toBeInTheDocument();
      });

      const file = new File(['test key'], 'id_ed25519', { type: 'text/plain' });
      fireEvent.change(screen.getByTestId('ssh-key-file-input'), {
        target: { files: [file] },
      });

      await waitFor(() => {
        expect(uploadSSHKey).toHaveBeenCalledWith(file);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ssh-success-message')).toBeInTheDocument();
      });
      expect(screen.getByText(/SSH key uploaded: ssh-ed25519/)).toBeInTheDocument();
    });

    it('shows error message when upload fails', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusUnconfigured);
      (uploadSSHKey as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Invalid key format')
      );

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-key-file-input')).toBeInTheDocument();
      });

      const file = new File(['invalid'], 'bad_key', { type: 'text/plain' });
      fireEvent.change(screen.getByTestId('ssh-key-file-input'), {
        target: { files: [file] },
      });

      await waitFor(() => {
        expect(screen.getByTestId('ssh-error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Invalid key format')).toBeInTheDocument();
    });
  });

  describe('Key Removal', () => {
    it('opens remove confirmation modal', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-ssh-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-ssh-key-button'));

      expect(screen.getByText('Remove SSH Key')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove the SSH private key/)).toBeInTheDocument();
    });

    it('closes modal when clicking Cancel', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-ssh-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-ssh-key-button'));
      expect(screen.getByText('Remove SSH Key')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Remove SSH Key')).not.toBeInTheDocument();
      });
    });

    it('removes key successfully', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockStatusConfigured)
        .mockResolvedValueOnce(mockStatusUnconfigured);
      (removeSSHKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        message: 'Key removed',
      });

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-ssh-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-ssh-key-button'));
      fireEvent.click(screen.getByTestId('confirm-remove-ssh-key-button'));

      await waitFor(() => {
        expect(removeSSHKey).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('ssh-success-message')).toBeInTheDocument();
      });
      expect(screen.getByText('SSH key removed')).toBeInTheDocument();
    });

    it('shows error when removal fails', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatusConfigured);
      (removeSSHKey as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Permission denied')
      );

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('remove-ssh-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-ssh-key-button'));
      fireEvent.click(screen.getByTestId('confirm-remove-ssh-key-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ssh-error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error when status fetch fails', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByTestId('ssh-error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('handles non-Error exceptions gracefully', async () => {
      (getSSHStatus as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      render(<TailscaleSSHSettings />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load SSH status')).toBeInTheDocument();
      });
    });
  });
});
