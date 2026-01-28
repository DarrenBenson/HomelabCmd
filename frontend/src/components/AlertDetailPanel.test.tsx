import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertDetailPanel } from './AlertDetailPanel';
import type { Alert } from '../types/alert';

function createMockAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    server_id: 'server-1',
    server_name: 'Test Server 1',
    alert_type: 'disk_usage',
    severity: 'critical',
    status: 'open',
    title: 'Disk usage at 92%',
    message: 'Disk usage exceeded threshold',
    threshold_value: 90,
    actual_value: 92,
    created_at: '2026-01-19T10:00:00Z',
    acknowledged_at: null,
    resolved_at: null,
    auto_resolved: false,
    can_acknowledge: true,
    can_resolve: true,
    service_name: null,
    ...overrides,
  };
}

describe('AlertDetailPanel', () => {
  const defaultProps = {
    alert: createMockAlert(),
    onClose: vi.fn(),
    onAcknowledge: vi.fn(),
    onResolve: vi.fn(),
    isActionInProgress: false,
  };

  describe('Display', () => {
    it('renders alert title', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-title')).toHaveTextContent('Disk usage at 92%');
    });

    it('renders server name', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-server')).toHaveTextContent('Test Server 1');
    });

    it('renders alert type', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-type')).toHaveTextContent('disk_usage');
    });

    it('renders status', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-status')).toHaveTextContent('Open');
    });

    it('renders threshold value', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-threshold')).toHaveTextContent('90%');
    });

    it('renders actual value', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-actual')).toHaveTextContent('92%');
    });

    it('renders created timestamp', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-created')).toBeInTheDocument();
    });

    it('renders acknowledged timestamp when present', () => {
      const alert = createMockAlert({
        status: 'acknowledged',
        acknowledged_at: '2026-01-19T11:00:00Z',
      });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.getByTestId('detail-acknowledged')).toBeInTheDocument();
    });

    it('renders resolved timestamp when present', () => {
      const alert = createMockAlert({
        status: 'resolved',
        resolved_at: '2026-01-19T12:00:00Z',
      });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.getByTestId('detail-resolved')).toBeInTheDocument();
    });

    it('shows auto-resolved indicator when applicable', () => {
      const alert = createMockAlert({
        status: 'resolved',
        resolved_at: '2026-01-19T12:00:00Z',
        auto_resolved: true,
      });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.getByText('(auto)')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders acknowledge button for open alerts', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-acknowledge-button')).toBeInTheDocument();
    });

    it('renders resolve button for non-resolved alerts', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByTestId('detail-resolve-button')).toBeInTheDocument();
    });

    it('does not render acknowledge button for acknowledged alerts', () => {
      const alert = createMockAlert({ status: 'acknowledged', can_acknowledge: false });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.queryByTestId('detail-acknowledge-button')).not.toBeInTheDocument();
    });

    it('does not render resolve button for resolved alerts', () => {
      const alert = createMockAlert({ status: 'resolved', can_resolve: false });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.queryByTestId('detail-resolve-button')).not.toBeInTheDocument();
    });

    it('calls onAcknowledge when acknowledge button clicked', () => {
      const onAcknowledge = vi.fn();

      render(<AlertDetailPanel {...defaultProps} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByTestId('detail-acknowledge-button'));

      expect(onAcknowledge).toHaveBeenCalledWith(1);
    });

    it('calls onResolve when resolve button clicked', () => {
      const onResolve = vi.fn();

      render(<AlertDetailPanel {...defaultProps} onResolve={onResolve} />);

      fireEvent.click(screen.getByTestId('detail-resolve-button'));

      expect(onResolve).toHaveBeenCalledWith(1);
    });

    it('disables buttons when action in progress', () => {
      render(<AlertDetailPanel {...defaultProps} isActionInProgress={true} />);

      expect(screen.getByTestId('detail-acknowledge-button')).toBeDisabled();
      expect(screen.getByTestId('detail-resolve-button')).toBeDisabled();
    });
  });

  describe('Close', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();

      render(<AlertDetailPanel {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('close-panel-button'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop clicked', () => {
      const onClose = vi.fn();

      render(<AlertDetailPanel {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('detail-panel-backdrop'));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Severity styling', () => {
    it('applies critical styling for critical alerts', () => {
      render(<AlertDetailPanel {...defaultProps} />);

      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('applies high styling for high severity alerts', () => {
      const alert = createMockAlert({ severity: 'high' });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('applies medium styling for medium severity alerts', () => {
      const alert = createMockAlert({ severity: 'medium' });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('applies low styling for low severity alerts', () => {
      const alert = createMockAlert({ severity: 'low' });

      render(<AlertDetailPanel {...defaultProps} alert={alert} />);

      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });
});
