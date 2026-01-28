import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionDetailPanel } from './ActionDetailPanel';
import type { Action } from '../types/action';

function createMockAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    server_id: 'omv-mediaserver',
    action_type: 'restart_service',
    status: 'completed',
    service_name: 'plex',
    command: 'systemctl restart plex',
    alert_id: null,
    created_at: '2026-01-19T10:30:00Z',
    created_by: 'dashboard',
    approved_at: '2026-01-19T10:30:05Z',
    approved_by: 'auto',
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    executed_at: '2026-01-19T10:31:00Z',
    completed_at: '2026-01-19T10:31:02Z',
    exit_code: 0,
    stdout: 'Service restarted successfully',
    stderr: null,
    ...overrides,
  };
}

describe('ActionDetailPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders panel with header', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Action Details')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('close-panel-button')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByTestId('close-panel-button'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop clicked', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByTestId('action-detail-backdrop'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Action title', () => {
    it('shows action type with service name', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-title')).toHaveTextContent('Restart Service: plex');
    });

    it('shows action type without service name when null', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ service_name: null })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-title')).toHaveTextContent('Restart Service');
    });

    it('shows server name', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
          serverName="OMV Media Server"
        />
      );

      expect(screen.getByTestId('action-server')).toHaveTextContent('on OMV Media Server');
    });

    it('falls back to server_id when serverName not provided', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-server')).toHaveTextContent('on omv-mediaserver');
    });
  });

  describe('Status badge', () => {
    it('shows completed status badge', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ status: 'completed' })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-status-badge')).toHaveTextContent('Completed');
    });

    it('shows pending status badge', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ status: 'pending', approved_at: null, approved_by: null, executed_at: null, completed_at: null })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-status-badge')).toHaveTextContent('Pending');
    });

    it('shows failed status badge', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ status: 'failed' })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-status-badge')).toHaveTextContent('Failed');
    });

    it('shows rejected status badge', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ status: 'rejected', rejected_at: '2026-01-19T10:35:00Z', rejected_by: 'user', rejection_reason: 'Test', approved_at: null, approved_by: null, executed_at: null, completed_at: null })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-status-badge')).toHaveTextContent('Rejected');
    });
  });

  describe('Timeline', () => {
    it('shows created entry', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('timeline-created')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-created')).toHaveTextContent('Created');
      expect(screen.getByTestId('timeline-created')).toHaveTextContent('dashboard');
    });

    it('shows approved entry when present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('timeline-approved')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-approved')).toHaveTextContent('Approved');
      expect(screen.getByTestId('timeline-approved')).toHaveTextContent('auto');
    });

    it('does not show approved entry when not approved', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ approved_at: null })}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('timeline-approved')).not.toBeInTheDocument();
    });

    it('shows rejected entry when present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({
            status: 'rejected',
            rejected_at: '2026-01-19T10:35:00Z',
            rejected_by: 'dashboard',
            rejection_reason: 'Service recovered',
            approved_at: null,
            approved_by: null,
            executed_at: null,
            completed_at: null,
          })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('timeline-rejected')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-rejected')).toHaveTextContent('Rejected');
    });

    it('shows executed entry when present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('timeline-executed')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-executed')).toHaveTextContent('Executed');
    });

    it('shows completed entry when present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('timeline-completed')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-completed')).toHaveTextContent('Completed');
    });

    it('shows Failed label for failed actions', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ status: 'failed' })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('timeline-completed')).toHaveTextContent('Failed');
    });
  });

  describe('Rejection reason', () => {
    it('shows rejection reason section when present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({
            status: 'rejected',
            rejection_reason: 'Service recovered automatically',
            rejected_at: '2026-01-19T10:35:00Z',
            rejected_by: 'dashboard',
            approved_at: null,
            approved_by: null,
            executed_at: null,
            completed_at: null,
          })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('rejection-reason')).toHaveTextContent('Service recovered automatically');
    });

    it('does not show rejection reason when not rejected', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('rejection-reason')).not.toBeInTheDocument();
    });
  });

  describe('Command', () => {
    it('shows command', () => {
      render(
        <ActionDetailPanel
          action={createMockAction()}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-command')).toHaveTextContent('systemctl restart plex');
    });
  });

  describe('Execution details', () => {
    it('shows exit code for executed action', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ exit_code: 0 })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('exit-code')).toHaveTextContent('0');
    });

    it('shows non-zero exit code with error styling', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ exit_code: 1, status: 'failed' })}
          onClose={mockOnClose}
        />
      );

      const exitCode = screen.getByTestId('exit-code');
      expect(exitCode).toHaveTextContent('1');
      expect(exitCode).toHaveClass('text-status-error');
    });

    it('shows stdout', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ stdout: 'Service restarted successfully' })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-stdout')).toHaveTextContent('Service restarted successfully');
    });

    it('shows (empty) when stdout is empty', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ stdout: '' })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-stdout')).toHaveTextContent('(empty)');
    });

    it('shows stderr when present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ stderr: 'Error: Service failed to start', status: 'failed', exit_code: 1 })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('action-stderr')).toHaveTextContent('Error: Service failed to start');
    });

    it('does not show stderr section when null', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ stderr: null })}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('action-stderr')).not.toBeInTheDocument();
    });

    it('does not show execution details for non-executed action', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({
            status: 'pending',
            executed_at: null,
            completed_at: null,
            exit_code: null,
            stdout: null,
            stderr: null,
            approved_at: null,
            approved_by: null,
          })}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('exit-code')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-stdout')).not.toBeInTheDocument();
    });
  });

  describe('Alert link', () => {
    it('shows alert reference when alert_id present', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ alert_id: 42 })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Triggered by Alert #42')).toBeInTheDocument();
    });

    it('does not show alert reference when null', () => {
      render(
        <ActionDetailPanel
          action={createMockAction({ alert_id: null })}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/Triggered by Alert/)).not.toBeInTheDocument();
    });
  });
});
