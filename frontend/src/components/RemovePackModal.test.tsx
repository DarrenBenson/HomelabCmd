/**
 * Tests for RemovePackModal component.
 *
 * Part of EP0010: Configuration Management - US0123 Remove Configuration Pack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RemovePackModal } from './RemovePackModal';
import { getRemovePreview, removeConfigPack } from '../api/config-apply';
import type { RemovePreviewResponse, RemoveResponse } from '../types/config-apply';

vi.mock('../api/config-apply', () => ({
  getRemovePreview: vi.fn(),
  removeConfigPack: vi.fn(),
}));

describe('RemovePackModal', () => {
  const mockPreview: RemovePreviewResponse = {
    server_id: 'test-server',
    pack_name: 'test-pack',
    preview: true,
    files: [
      {
        action: 'delete',
        path: '~/.bashrc.d/aliases.sh',
        backup_path: '~/.bashrc.d/aliases.sh.homelabcmd.bak',
        note: 'Will be backed up before deletion',
      },
    ],
    packages: [
      {
        action: 'skip',
        package: 'curl',
        note: 'Packages are not uninstalled to avoid breaking dependencies',
      },
    ],
    settings: [
      {
        action: 'remove',
        key: 'EDITOR',
        note: 'Will be removed from shell configuration',
      },
    ],
    total_items: 3,
    warning: 'Files will be deleted. Packages will remain installed.',
  };

  const mockRemoveResult: RemoveResponse = {
    server_id: 'test-server',
    pack_name: 'test-pack',
    success: true,
    items: [
      {
        item: '~/.bashrc.d/aliases.sh',
        item_type: 'file',
        action: 'deleted',
        success: true,
        backup_path: '~/.bashrc.d/aliases.sh.homelabcmd.bak',
        note: null,
        error: null,
      },
      {
        item: 'curl',
        item_type: 'package',
        action: 'skipped',
        success: true,
        backup_path: null,
        note: 'Package not removed to avoid dependency issues',
        error: null,
      },
      {
        item: 'EDITOR',
        item_type: 'setting',
        action: 'removed',
        success: true,
        backup_path: null,
        note: null,
        error: null,
      },
    ],
    items_deleted: 1,
    items_skipped: 1,
    items_removed: 1,
    items_failed: 0,
    removed_at: '2026-01-29T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides: Partial<Parameters<typeof RemovePackModal>[0]> = {}) {
    return render(
      <RemovePackModal
        isOpen={true}
        serverId="test-server"
        serverName="Test Server"
        packName="test-pack"
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it('does not render when closed', () => {
    const { queryByTestId } = render(
      <RemovePackModal
        isOpen={false}
        serverId="test-server"
        serverName="Test Server"
        packName="test-pack"
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId('remove-pack-modal')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (getRemovePreview as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    renderModal();

    // Should show loading spinner (animate-spin class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  describe('Preview state (US0123: AC5)', () => {
    beforeEach(() => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
    });

    it('shows preview with grouped items', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Remove Configuration Pack')).toBeInTheDocument();
      });

      // Check file items
      expect(screen.getByText('Files to delete (backups will be created)')).toBeInTheDocument();
      expect(screen.getByText('~/.bashrc.d/aliases.sh')).toBeInTheDocument();

      // Check package items
      expect(screen.getByText('Packages (will NOT be removed)')).toBeInTheDocument();
      expect(screen.getByText('curl')).toBeInTheDocument();

      // Check setting items
      expect(screen.getByText('Settings to remove')).toBeInTheDocument();
      expect(screen.getByText('EDITOR')).toBeInTheDocument();
    });

    it('shows server and pack name in preview', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('test-pack')).toBeInTheDocument();
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });

    it('shows warning banner (US0123: AC6)', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('remove-warning-banner')).toBeInTheDocument();
        expect(screen.getByText('Warning')).toBeInTheDocument();
        expect(
          screen.getByText('Files will be deleted. Packages will remain installed.')
        ).toBeInTheDocument();
      });
    });

    it('shows backup paths for files (US0123: AC2)', async () => {
      renderModal();

      await waitFor(() => {
        expect(
          screen.getByText('Backup: ~/.bashrc.d/aliases.sh.homelabcmd.bak')
        ).toBeInTheDocument();
      });
    });

    it('has confirm and cancel buttons', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('calls onClose when cancel clicked', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Removing state', () => {
    beforeEach(() => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
    });

    it('starts removal when confirm clicked', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue(mockRemoveResult);

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(removeConfigPack).toHaveBeenCalledWith('test-server', 'test-pack');
      });
    });

    it('shows removing state while in progress', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(screen.getByText('Removing configuration...')).toBeInTheDocument();
      });
    });
  });

  describe('Complete state (US0123: AC4)', () => {
    beforeEach(() => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
    });

    it('shows success message when all items succeed', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue(mockRemoveResult);

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(screen.getByText('Removal completed successfully')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('shows item counts in success message', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue(mockRemoveResult);

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        // "1 file deleted, 1 setting removed, 1 package preserved"
        expect(screen.getByText(/1 file.* deleted/)).toBeInTheDocument();
        expect(screen.getByText(/1 setting.* removed/)).toBeInTheDocument();
        expect(screen.getByText(/1 package.* preserved/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows partial failure when some items fail', async () => {
      const partialResult: RemoveResponse = {
        ...mockRemoveResult,
        success: true,
        items_deleted: 0,
        items_failed: 1,
        items: [
          {
            item: '~/.bashrc.d/aliases.sh',
            item_type: 'file',
            action: 'failed',
            success: false,
            backup_path: null,
            note: null,
            error: 'Permission denied',
          },
        ],
      };
      (removeConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue(partialResult);

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(screen.getByText('Removal completed with errors')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows backup path tip', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue(mockRemoveResult);

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(screen.getByText(/\.homelabcmd\.bak backups/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows results list with per-item details', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue(mockRemoveResult);

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        // Check items are displayed in results
        expect(screen.getByText('~/.bashrc.d/aliases.sh')).toBeInTheDocument();
        expect(screen.getByText('curl')).toBeInTheDocument();
        expect(screen.getByText('EDITOR')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Error state', () => {
    it('shows error when preview fails', async () => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to load preview')
      );

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load preview')).toBeInTheDocument();
      });
    });

    it('shows error when removal fails', async () => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
      (removeConfigPack as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('SSH connection failed')
      );

      renderModal();

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('SSH connection failed')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows retry button on error', async () => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries loading preview when retry clicked', async () => {
      (getRemovePreview as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockPreview);

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Files to delete (backups will be created)')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(getRemovePreview).toHaveBeenCalledTimes(2);
    });
  });

  describe('Modal interactions', () => {
    beforeEach(() => {
      (getRemovePreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
    });

    it('calls onClose when backdrop clicked', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-pack-modal'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose when modal content clicked', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      // Click inside the modal (on the content, not backdrop)
      fireEvent.click(screen.getByText('Remove Configuration Pack'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('prevents close while removing', async () => {
      (removeConfigPack as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      const onClose = vi.fn();
      renderModal({ onClose });

      await waitFor(() => {
        expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-remove-button'));

      await waitFor(() => {
        expect(screen.getByText('Removing configuration...')).toBeInTheDocument();
      });

      // Try to close via backdrop
      fireEvent.click(screen.getByTestId('remove-pack-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
