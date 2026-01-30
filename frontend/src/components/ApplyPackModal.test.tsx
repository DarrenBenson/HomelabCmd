/**
 * Tests for ApplyPackModal component.
 *
 * Part of EP0010: Configuration Management - US0119 Apply Configuration Pack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplyPackModal } from './ApplyPackModal';
import { getApplyPreview, applyConfigPack, getApplyStatus } from '../api/config-apply';
import type { ApplyPreviewResponse, ApplyStatusResponse } from '../types/config-apply';

vi.mock('../api/config-apply', () => ({
  getApplyPreview: vi.fn(),
  applyConfigPack: vi.fn(),
  getApplyStatus: vi.fn(),
}));

describe('ApplyPackModal', () => {
  const mockPreview: ApplyPreviewResponse = {
    server_id: 'test-server',
    pack_name: 'test-pack',
    dry_run: true,
    files: [
      {
        action: 'create_file',
        path: '~/.bashrc.d/aliases.sh',
        mode: '0644',
        description: 'Create aliases file',
      },
    ],
    packages: [
      {
        action: 'install_package',
        package: 'curl',
        version: '8.0.0',
        description: 'Install curl',
      },
    ],
    settings: [
      {
        action: 'set_env_var',
        key: 'EDITOR',
        value: 'vim',
        description: 'Set EDITOR',
      },
    ],
    total_items: 3,
  };

  const mockCompletedStatus: ApplyStatusResponse = {
    apply_id: 1,
    server_id: 'test-server',
    pack_name: 'test-pack',
    status: 'completed',
    progress: 100,
    current_item: null,
    items_total: 3,
    items_completed: 3,
    items_failed: 0,
    items: [
      { item: '~/.bashrc.d/aliases.sh', action: 'created', success: true, error: null },
      { item: 'curl', action: 'installed', success: true, error: null },
      { item: 'env:EDITOR', action: 'set', success: true, error: null },
    ],
    started_at: '2026-01-29T10:00:00Z',
    completed_at: '2026-01-29T10:01:00Z',
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides: Partial<Parameters<typeof ApplyPackModal>[0]> = {}) {
    return render(
      <ApplyPackModal
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
      <ApplyPackModal
        isOpen={false}
        serverId="test-server"
        serverName="Test Server"
        packName="test-pack"
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId('apply-pack-modal')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (getApplyPreview as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    renderModal();

    // Should show loading spinner (animate-spin class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  describe('Preview state', () => {
    beforeEach(() => {
      (getApplyPreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
    });

    it('shows preview with grouped items', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Apply Configuration Pack')).toBeInTheDocument();
      });

      // Check file items
      expect(screen.getByText('Files to create/update')).toBeInTheDocument();
      expect(screen.getByText('~/.bashrc.d/aliases.sh')).toBeInTheDocument();

      // Check package items
      expect(screen.getByText('Packages to install')).toBeInTheDocument();
      expect(screen.getByText('curl')).toBeInTheDocument();

      // Check setting items
      expect(screen.getByText('Settings to change')).toBeInTheDocument();
      expect(screen.getByText('EDITOR')).toBeInTheDocument();
    });

    it('shows server and pack name in preview', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('test-pack')).toBeInTheDocument();
        expect(screen.getByText('Test Server')).toBeInTheDocument();
      });
    });

    it('shows warning about sudo commands', async () => {
      renderModal();

      await waitFor(() => {
        expect(
          screen.getByText(/will execute commands with sudo/i)
        ).toBeInTheDocument();
      });
    });

    it('has confirm and cancel buttons', async () => {
      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
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

  describe('Applying state', () => {
    beforeEach(() => {
      (getApplyPreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
      (applyConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue({
        apply_id: 1,
        server_id: 'test-server',
        pack_name: 'test-pack',
        status: 'pending',
        started_at: null,
      });
    });

    it('starts apply when confirm clicked', async () => {
      // Mock getApplyStatus to return completed status
      (getApplyStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockCompletedStatus);

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-apply-button'));

      await waitFor(() => {
        expect(applyConfigPack).toHaveBeenCalledWith('test-server', 'test-pack');
      });
    });
  });

  describe('Complete state', () => {
    beforeEach(() => {
      (getApplyPreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
      (applyConfigPack as ReturnType<typeof vi.fn>).mockResolvedValue({
        apply_id: 1,
        server_id: 'test-server',
        pack_name: 'test-pack',
        status: 'pending',
        started_at: null,
      });
    });

    it('shows success message when all items succeed', async () => {
      (getApplyStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockCompletedStatus);

      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-apply-button'));

      await waitFor(() => {
        expect(screen.getByText('Apply completed successfully')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('shows partial success when some items fail', async () => {
      const partialStatus: ApplyStatusResponse = {
        ...mockCompletedStatus,
        status: 'completed',
        items_completed: 2,
        items_failed: 1,
        items: [
          { item: '~/.bashrc.d/aliases.sh', action: 'created', success: true, error: null },
          { item: 'curl', action: 'installed', success: true, error: null },
          { item: 'nodejs', action: 'installed', success: false, error: 'Not found' },
        ],
      };
      (getApplyStatus as ReturnType<typeof vi.fn>).mockResolvedValue(partialStatus);

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-apply-button'));

      await waitFor(() => {
        expect(screen.getByText('Apply completed with errors')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows failure message when apply fails', async () => {
      const failedStatus: ApplyStatusResponse = {
        ...mockCompletedStatus,
        status: 'failed',
        error: 'SSH connection failed',
      };
      (getApplyStatus as ReturnType<typeof vi.fn>).mockResolvedValue(failedStatus);

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-apply-button'));

      await waitFor(() => {
        expect(screen.getByText('Apply failed')).toBeInTheDocument();
        expect(screen.getByText('SSH connection failed')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows results list with success/failure indicators', async () => {
      const mixedStatus: ApplyStatusResponse = {
        ...mockCompletedStatus,
        status: 'completed',
        items_completed: 2,
        items_failed: 1,
        items: [
          { item: '~/.bashrc.d/aliases.sh', action: 'created', success: true, error: null },
          { item: 'curl', action: 'installed', success: false, error: 'Not found' },
          { item: 'env:EDITOR', action: 'set', success: true, error: null },
        ],
      };
      (getApplyStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mixedStatus);

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-apply-button'));

      await waitFor(() => {
        // Check for the items in the results
        expect(screen.getByText('~/.bashrc.d/aliases.sh')).toBeInTheDocument();
        expect(screen.getByText('curl')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Error state', () => {
    it('shows error when preview fails', async () => {
      (getApplyPreview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to load preview')
      );

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load preview')).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      (getApplyPreview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries loading preview when retry clicked', async () => {
      (getApplyPreview as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockPreview);

      renderModal();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Files to create/update')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(getApplyPreview).toHaveBeenCalledTimes(2);
    });
  });

  describe('Modal interactions', () => {
    beforeEach(() => {
      (getApplyPreview as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreview);
    });

    it('calls onClose when backdrop clicked', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-pack-modal'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose when modal content clicked', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      await waitFor(() => {
        expect(screen.getByText('Confirm and Apply')).toBeInTheDocument();
      });

      // Click inside the modal (on the content, not backdrop)
      fireEvent.click(screen.getByText('Apply Configuration Pack'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
