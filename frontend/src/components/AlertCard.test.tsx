import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertCard } from './AlertCard';
import type { Alert } from '../types/alert';

const mockAlert: Alert = {
  id: 1,
  server_id: 'server-123',
  server_name: 'omv-mediaserver',
  alert_type: 'disk_usage',
  severity: 'critical',
  status: 'open',
  title: 'Disk usage at 92%',
  message: 'Disk usage has exceeded the critical threshold',
  threshold_value: 90,
  actual_value: 92,
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
  acknowledged_at: null,
  resolved_at: null,
  auto_resolved: false,
  can_acknowledge: true,
  can_resolve: false,
  service_name: null,
};

describe('AlertCard', () => {
  it('renders alert info correctly', () => {
    const onAcknowledge = vi.fn();
    render(<AlertCard alert={mockAlert} onAcknowledge={onAcknowledge} />);

    expect(screen.getByTestId('alert-title')).toHaveTextContent('Disk usage at 92%');
    expect(screen.getByTestId('alert-server')).toHaveTextContent('omv-mediaserver');
    expect(screen.getByTestId('alert-severity')).toHaveTextContent('CRITICAL');
  });

  it('displays severity badge with correct styling', () => {
    const onAcknowledge = vi.fn();
    render(<AlertCard alert={mockAlert} onAcknowledge={onAcknowledge} />);

    const card = screen.getByTestId('alert-card');
    expect(card).toHaveAttribute('data-severity', 'critical');
  });

  it('shows acknowledge button for open alerts', () => {
    const onAcknowledge = vi.fn();
    render(<AlertCard alert={mockAlert} onAcknowledge={onAcknowledge} />);

    expect(screen.getByTestId('alert-acknowledge-button')).toBeInTheDocument();
  });

  it('calls onAcknowledge when button clicked', () => {
    const onAcknowledge = vi.fn();
    render(<AlertCard alert={mockAlert} onAcknowledge={onAcknowledge} />);

    fireEvent.click(screen.getByTestId('alert-acknowledge-button'));
    expect(onAcknowledge).toHaveBeenCalledWith(1);
  });

  it('disables button when isAcknowledging is true', () => {
    const onAcknowledge = vi.fn();
    render(
      <AlertCard alert={mockAlert} onAcknowledge={onAcknowledge} isAcknowledging={true} />
    );

    expect(screen.getByTestId('alert-acknowledge-button')).toBeDisabled();
  });

  it('hides acknowledge button for acknowledged alerts', () => {
    const acknowledgedAlert: Alert = { ...mockAlert, status: 'acknowledged', can_acknowledge: false };
    const onAcknowledge = vi.fn();
    render(<AlertCard alert={acknowledgedAlert} onAcknowledge={onAcknowledge} />);

    expect(screen.queryByTestId('alert-acknowledge-button')).not.toBeInTheDocument();
  });

  it('falls back to server_id when server_name is null', () => {
    const alertWithoutName: Alert = { ...mockAlert, server_name: null };
    const onAcknowledge = vi.fn();
    render(<AlertCard alert={alertWithoutName} onAcknowledge={onAcknowledge} />);

    expect(screen.getByTestId('alert-server')).toHaveTextContent('server-123');
  });

  it('renders different severity levels correctly', () => {
    const onAcknowledge = vi.fn();

    const { rerender } = render(
      <AlertCard alert={{ ...mockAlert, severity: 'high' }} onAcknowledge={onAcknowledge} />
    );
    expect(screen.getByTestId('alert-severity')).toHaveTextContent('HIGH');

    rerender(
      <AlertCard alert={{ ...mockAlert, severity: 'medium' }} onAcknowledge={onAcknowledge} />
    );
    expect(screen.getByTestId('alert-severity')).toHaveTextContent('MEDIUM');

    rerender(
      <AlertCard alert={{ ...mockAlert, severity: 'low' }} onAcknowledge={onAcknowledge} />
    );
    expect(screen.getByTestId('alert-severity')).toHaveTextContent('LOW');
  });
});
