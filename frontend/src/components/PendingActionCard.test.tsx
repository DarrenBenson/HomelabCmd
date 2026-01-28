import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingActionCard } from './PendingActionCard';
import type { Action } from '../types/action';

const mockAction: Action = {
  id: 1,
  server_id: 'test-server',
  action_type: 'restart_service',
  status: 'pending',
  service_name: 'plex',
  command: 'systemctl restart plex',
  alert_id: null,
  created_at: new Date().toISOString(),
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
 * PendingActionCard tests (US0030 AC3, AC4, AC5, AC6)
 * Spec Reference: sdlc-studio/stories/US0030-pending-actions-panel.md
 */
describe('PendingActionCard', () => {
  describe('Action details (AC3)', () => {
    it('displays server name', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('action-server-name')).toHaveTextContent('test-server');
    });

    it('displays action description for restart_service', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('action-description')).toHaveTextContent('Restart Service: plex');
    });

    it('displays action description for clear_logs', () => {
      const clearLogsAction: Action = {
        ...mockAction,
        action_type: 'clear_logs',
        service_name: null,
      };
      render(
        <PendingActionCard
          action={clearLogsAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('action-description')).toHaveTextContent('Clear Logs');
    });

    it('displays created time', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('action-created-at')).toBeInTheDocument();
      expect(screen.getByTestId('action-created-at').textContent).toContain('Created:');
    });
  });

  describe('Maintenance mode indicator (AC6)', () => {
    it('displays maintenance mode badge', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('maintenance-mode-badge')).toBeInTheDocument();
      expect(screen.getByTestId('maintenance-mode-badge')).toHaveTextContent('Maintenance Mode');
    });
  });

  describe('Approve button (AC4)', () => {
    it('displays approve button', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('approve-button')).toBeInTheDocument();
      expect(screen.getByTestId('approve-button')).toHaveTextContent('Approve');
    });

    it('calls onApprove with action ID when clicked', () => {
      const onApprove = vi.fn();
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={onApprove}
          onReject={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('approve-button'));

      expect(onApprove).toHaveBeenCalledWith(1);
    });

    it('shows loading state when approving', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          isApproving={true}
        />
      );

      expect(screen.getByTestId('approve-button')).toHaveTextContent('Approving...');
      expect(screen.getByTestId('approve-button')).toBeDisabled();
    });
  });

  describe('Reject button (AC5)', () => {
    it('displays reject button', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getByTestId('reject-button')).toBeInTheDocument();
      expect(screen.getByTestId('reject-button')).toHaveTextContent('Reject');
    });

    it('calls onReject with action when clicked', () => {
      const onReject = vi.fn();
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={onReject}
        />
      );

      fireEvent.click(screen.getByTestId('reject-button'));

      expect(onReject).toHaveBeenCalledWith(mockAction);
    });

    it('disables reject button when approving', () => {
      render(
        <PendingActionCard
          action={mockAction}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          isApproving={true}
        />
      );

      expect(screen.getByTestId('reject-button')).toBeDisabled();
    });
  });
});
