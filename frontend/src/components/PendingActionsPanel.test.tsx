import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PendingActionsPanel } from './PendingActionsPanel';
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

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/**
 * PendingActionsPanel tests (US0030 AC1, AC2)
 * Spec Reference: sdlc-studio/stories/US0030-pending-actions-panel.md
 */
describe('PendingActionsPanel', () => {
  describe('Visibility (AC1, AC2)', () => {
    it('renders panel when actions exist (AC1)', () => {
      renderWithRouter(
        <PendingActionsPanel
          actions={[mockAction]}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
        />
      );

      expect(screen.getByTestId('pending-actions-panel')).toBeInTheDocument();
    });

    it('does not render panel when no actions (AC2)', () => {
      renderWithRouter(
        <PendingActionsPanel
          actions={[]}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
        />
      );

      expect(screen.queryByTestId('pending-actions-panel')).not.toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays action count', () => {
      const actions = [mockAction, { ...mockAction, id: 2 }];
      renderWithRouter(
        <PendingActionsPanel
          actions={actions}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
        />
      );

      expect(screen.getByTestId('pending-actions-count')).toHaveTextContent('Pending Actions (2)');
    });

    it('displays View All link', () => {
      renderWithRouter(
        <PendingActionsPanel
          actions={[mockAction]}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
        />
      );

      const link = screen.getByTestId('view-all-actions-link');
      expect(link).toHaveTextContent('View All');
      expect(link).toHaveAttribute('href', '/actions?status=pending');
    });
  });

  describe('Action list', () => {
    it('renders action cards', () => {
      const actions = [mockAction, { ...mockAction, id: 2, server_id: 'other-server' }];
      renderWithRouter(
        <PendingActionsPanel
          actions={actions}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
        />
      );

      expect(screen.getByTestId('pending-action-1')).toBeInTheDocument();
      expect(screen.getByTestId('pending-action-2')).toBeInTheDocument();
    });

    it('limits displayed actions to maxDisplay', () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        ...mockAction,
        id: i + 1,
      }));
      renderWithRouter(
        <PendingActionsPanel
          actions={actions}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
          maxDisplay={3}
        />
      );

      expect(screen.getByTestId('pending-action-1')).toBeInTheDocument();
      expect(screen.getByTestId('pending-action-2')).toBeInTheDocument();
      expect(screen.getByTestId('pending-action-3')).toBeInTheDocument();
      expect(screen.queryByTestId('pending-action-4')).not.toBeInTheDocument();
    });

    it('shows +N more indicator when actions exceed maxDisplay', () => {
      const actions = Array.from({ length: 8 }, (_, i) => ({
        ...mockAction,
        id: i + 1,
      }));
      renderWithRouter(
        <PendingActionsPanel
          actions={actions}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
          maxDisplay={5}
        />
      );

      expect(screen.getByText('+3 more actions')).toBeInTheDocument();
    });

    it('does not show +N more when actions fit in maxDisplay', () => {
      const actions = [mockAction, { ...mockAction, id: 2 }];
      renderWithRouter(
        <PendingActionsPanel
          actions={actions}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          approvingIds={new Set()}
          maxDisplay={5}
        />
      );

      expect(screen.queryByText(/more action/)).not.toBeInTheDocument();
    });
  });
});
