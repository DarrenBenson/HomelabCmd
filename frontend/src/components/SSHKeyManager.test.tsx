/**
 * Tests for SSHKeyManager component.
 * US0071: SSH Key Manager UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SSHKeyManager } from './SSHKeyManager';
import { listSSHKeys, uploadSSHKey, deleteSSHKey } from '../api/scans';
import type { SSHKeyMetadata } from '../types/scan';

vi.mock('../api/scans', () => ({
  listSSHKeys: vi.fn(),
  uploadSSHKey: vi.fn(),
  deleteSSHKey: vi.fn(),
}));

const mockKeys: SSHKeyMetadata[] = [
  {
    id: 'key1',
    name: 'homelab',
    type: 'ED25519',
    fingerprint: 'SHA256:abc123def456ghi789jkl012mno345pqr678stu901',
    created_at: '2024-01-15T10:30:00Z',
    username: 'darren',
  },
  {
    id: 'key2',
    name: 'work_key',
    type: 'RSA-4096',
    fingerprint: 'SHA256:xyz789abc123def456ghi789jkl012mno345pqr678',
    created_at: '2024-01-10T08:00:00Z',
    username: null,
  },
];

describe('SSHKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching keys', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(<SSHKeyManager />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no keys configured', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: [] });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('No SSH keys configured')).toBeInTheDocument();
      });
      expect(screen.getByText(/Add SSH keys to enable scanning/)).toBeInTheDocument();
      expect(screen.getByTestId('empty-state-add-button')).toBeInTheDocument();
    });

    it('opens add modal from empty state button', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: [] });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-add-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('empty-state-add-button'));

      expect(screen.getByText('Add SSH Key')).toBeInTheDocument();
    });
  });

  describe('Key List Display', () => {
    it('displays list of configured keys', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('homelab')).toBeInTheDocument();
      });
      expect(screen.getByText('work_key')).toBeInTheDocument();
      expect(screen.getByText('ED25519')).toBeInTheDocument();
      expect(screen.getByText('RSA-4096')).toBeInTheDocument();
    });

    it('shows key count in header', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('2 keys configured')).toBeInTheDocument();
      });
    });

    it('shows singular key count when one key', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
        keys: [mockKeys[0]]
      });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('1 key configured')).toBeInTheDocument();
      });
    });

    it('displays username for keys with username set', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('darren')).toBeInTheDocument();
      });
    });

    it('shows Default username for keys without username', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      // US0093 change: Now displays "Default username" instead of "Default"
      await waitFor(() => {
        expect(screen.getByText('Default username')).toBeInTheDocument();
      });
    });

    it('displays truncated fingerprint', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      // Fingerprint is truncated: first 6 chars + ... + last 4 chars
      // SHA256:abc123def456ghi789jkl012mno345pqr678stu901 -> SHA256:abc123...u901
      await waitFor(() => {
        expect(screen.getByText('SHA256:abc123...u901')).toBeInTheDocument();
      });
    });

    it('displays formatted creation date', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText(/Added Jan 15, 2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Add Key Modal', () => {
    it('opens add modal when clicking Add Key button', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('add-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-key-button'));

      expect(screen.getByText('Add SSH Key')).toBeInTheDocument();
      expect(screen.getByTestId('key-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('key-username-input')).toBeInTheDocument();
      expect(screen.getByTestId('key-content-input')).toBeInTheDocument();
    });

    it('closes add modal when clicking Cancel', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('add-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-key-button'));
      expect(screen.getByText('Add SSH Key')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Add SSH Key')).not.toBeInTheDocument();
      });
    });

    it('submits new key successfully', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: [] });
      (uploadSSHKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new_key',
        name: 'new_key',
        type: 'ED25519',
        fingerprint: 'SHA256:newkey123',
        created_at: '2024-01-20T12:00:00Z',
      });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-add-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('empty-state-add-button'));

      fireEvent.change(screen.getByTestId('key-name-input'), {
        target: { value: 'new_key' },
      });
      fireEvent.change(screen.getByTestId('key-content-input'), {
        target: { value: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----' },
      });
      fireEvent.change(screen.getByTestId('key-username-input'), {
        target: { value: 'testuser' },
      });

      // Update mock to return the new key after upload
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
        keys: [{
          id: 'new_key',
          name: 'new_key',
          type: 'ED25519',
          fingerprint: 'SHA256:newkey123',
          created_at: '2024-01-20T12:00:00Z',
          username: 'testuser',
        }],
      });

      fireEvent.click(screen.getByTestId('submit-key-button'));

      await waitFor(() => {
        expect(uploadSSHKey).toHaveBeenCalledWith({
          name: 'new_key',
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
          username: 'testuser',
        });
      });

      await waitFor(() => {
        expect(screen.queryByText('Add SSH Key')).not.toBeInTheDocument();
      });
    });

    it('shows error when upload fails', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: [] });
      (uploadSSHKey as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Invalid key format')
      );

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-add-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('empty-state-add-button'));

      fireEvent.change(screen.getByTestId('key-name-input'), {
        target: { value: 'bad_key' },
      });
      fireEvent.change(screen.getByTestId('key-content-input'), {
        target: { value: 'invalid key content' },
      });

      fireEvent.click(screen.getByTestId('submit-key-button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid key format')).toBeInTheDocument();
      });
    });

    it('disables submit button when fields are empty', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('add-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-key-button'));

      const submitButton = screen.getByTestId('submit-key-button');
      expect(submitButton).toBeDisabled();
    });

    it('uploads key without username when field is empty', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: [] });
      (uploadSSHKey as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new_key',
        name: 'new_key',
        type: 'ED25519',
        fingerprint: 'SHA256:newkey123',
        created_at: '2024-01-20T12:00:00Z',
      });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-add-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('empty-state-add-button'));

      fireEvent.change(screen.getByTestId('key-name-input'), {
        target: { value: 'new_key' },
      });
      fireEvent.change(screen.getByTestId('key-content-input'), {
        target: { value: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----' },
      });

      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: [] });

      fireEvent.click(screen.getByTestId('submit-key-button'));

      await waitFor(() => {
        expect(uploadSSHKey).toHaveBeenCalledWith({
          name: 'new_key',
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
          username: undefined,
        });
      });
    });
  });

  describe('Delete Key Modal', () => {
    it('opens delete confirmation when clicking delete button', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('delete-key-key1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-key-key1'));

      expect(screen.getByText('Delete SSH Key')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
      expect(screen.getByTestId('confirm-delete-button')).toBeInTheDocument();
    });

    it('closes delete modal when clicking Cancel', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('delete-key-key1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-key-key1'));
      expect(screen.getByText('Delete SSH Key')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Delete SSH Key')).not.toBeInTheDocument();
      });
    });

    it('deletes key successfully', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });
      (deleteSSHKey as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('delete-key-key1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-key-key1'));

      // Update mock to return remaining keys after delete
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
        keys: [mockKeys[1]],
      });

      fireEvent.click(screen.getByTestId('confirm-delete-button'));

      await waitFor(() => {
        expect(deleteSSHKey).toHaveBeenCalledWith('key1');
      });

      await waitFor(() => {
        expect(screen.queryByText('Delete SSH Key')).not.toBeInTheDocument();
      });
    });

    it('shows error when delete fails', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });
      (deleteSSHKey as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Key is in use')
      );

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('delete-key-key1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-key-key1'));
      fireEvent.click(screen.getByTestId('confirm-delete-button'));

      await waitFor(() => {
        expect(screen.getByText('Key is in use')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when fetching keys fails', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles non-Error exceptions gracefully', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load SSH keys')).toBeInTheDocument();
      });
    });
  });

  describe('File Upload', () => {
    it('shows file upload button in modal', async () => {
      (listSSHKeys as ReturnType<typeof vi.fn>).mockResolvedValue({ keys: mockKeys });

      render(<SSHKeyManager />);

      await waitFor(() => {
        expect(screen.getByTestId('add-key-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-key-button'));

      expect(screen.getByText('Upload key file')).toBeInTheDocument();
      expect(screen.getByTestId('key-file-input')).toBeInTheDocument();
    });
  });
});
