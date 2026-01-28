import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RejectModal } from './RejectModal';
import type { Action } from '../types/action';

const mockAction: Action = {
  id: 1,
  server_id: 'test-server',
  action_type: 'restart_service',
  status: 'pending',
  service_name: 'plex',
  command: 'systemctl restart plex',
  alert_id: null,
  created_at: '2026-01-19T10:00:00Z',
  created_by: 'dashboard',
  approved_at: null,
  approved_by: null,
  rejected_at: null,
  rejected_by: null,
  rejection_reason: null,
  executed_at: null,
  completed_at: null,
  exit_code: null,
  stdout: null,
  stderr: null,
};

/**
 * RejectModal tests (US0030 AC5)
 * Spec Reference: sdlc-studio/stories/US0030-pending-actions-panel.md
 */
describe('RejectModal', () => {
  describe('Rendering', () => {
    it('displays modal with title', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('reject-modal')).toBeInTheDocument();
      // Check title in the header (h2 element)
      expect(screen.getByRole('heading', { name: 'Reject Action' })).toBeInTheDocument();
    });

    it('displays action description for restart_service', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText(/Rejecting:/)).toBeInTheDocument();
      expect(screen.getByText('Restart plex on test-server')).toBeInTheDocument();
    });

    it('displays action description for clear_logs', () => {
      const clearLogsAction: Action = {
        ...mockAction,
        action_type: 'clear_logs',
        service_name: null,
      };
      render(
        <RejectModal
          action={clearLogsAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('clear_logs on test-server')).toBeInTheDocument();
    });

    it('displays reason textarea', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('reject-reason-input')).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('disables submit button when reason is empty', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('reject-modal-submit')).toBeDisabled();
    });

    it('enables submit button when reason is provided', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('reject-reason-input'), {
        target: { value: 'Service recovered' },
      });

      expect(screen.getByTestId('reject-modal-submit')).not.toBeDisabled();
    });

    it('disables submit button when reason is only whitespace', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('reject-reason-input'), {
        target: { value: '   ' },
      });

      expect(screen.getByTestId('reject-modal-submit')).toBeDisabled();
    });
  });

  describe('Cancel functionality', () => {
    it('calls onCancel when Cancel button clicked', () => {
      const onCancel = vi.fn();
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByTestId('reject-modal-cancel'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when close button clicked', () => {
      const onCancel = vi.fn();
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByTestId('reject-modal-close'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when overlay clicked', () => {
      const onCancel = vi.fn();
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByTestId('reject-modal-overlay'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('does not call onCancel when modal content clicked', () => {
      const onCancel = vi.fn();
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByTestId('reject-modal'));

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Submit functionality', () => {
    it('calls onReject with trimmed reason when submitted', () => {
      const onReject = vi.fn();
      render(
        <RejectModal
          action={mockAction}
          onReject={onReject}
          onCancel={vi.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('reject-reason-input'), {
        target: { value: '  Service recovered automatically  ' },
      });
      fireEvent.click(screen.getByTestId('reject-modal-submit'));

      expect(onReject).toHaveBeenCalledWith('Service recovered automatically');
    });
  });

  describe('Loading state', () => {
    it('shows loading text on submit button when loading', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('reject-modal-submit')).toHaveTextContent('Rejecting...');
    });

    it('disables textarea when loading', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('reject-reason-input')).toBeDisabled();
    });

    it('disables Cancel button when loading', () => {
      render(
        <RejectModal
          action={mockAction}
          onReject={vi.fn()}
          onCancel={vi.fn()}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('reject-modal-cancel')).toBeDisabled();
    });
  });
});
