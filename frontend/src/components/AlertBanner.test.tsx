import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlertBanner } from './AlertBanner';
import type { Alert } from '../types/alert';

function createMockAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    server_id: 'server-123',
    server_name: 'test-server',
    alert_type: 'disk_usage',
    severity: 'critical',
    status: 'open',
    title: 'Test alert',
    message: 'Test message',
    threshold_value: 90,
    actual_value: 92,
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    auto_resolved: false,
    can_acknowledge: true,
    can_resolve: false,
    service_name: null,
    ...overrides,
  };
}

describe('AlertBanner', () => {
  it('shows empty state when no alerts', () => {
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={[]}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('alert-banner-empty')).toBeInTheDocument();
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
  });

  it('shows correct alert count', () => {
    const alerts = [
      createMockAlert({ id: 1 }),
      createMockAlert({ id: 2 }),
      createMockAlert({ id: 3 }),
    ];
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('alert-count')).toHaveTextContent('3 Active Alerts');
  });

  it('shows singular alert count for one alert', () => {
    const alerts = [createMockAlert({ id: 1 })];
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('alert-count')).toHaveTextContent('1 Active Alert');
  });

  it('displays max 5 alerts by default', () => {
    const alerts = Array.from({ length: 7 }, (_, i) =>
      createMockAlert({ id: i + 1, title: `Alert ${i + 1}` })
    );
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    const alertCards = screen.getAllByTestId('alert-card');
    expect(alertCards).toHaveLength(5);
  });

  it('shows +X more alerts indicator when alerts exceed maxDisplay', () => {
    const alerts = Array.from({ length: 7 }, (_, i) =>
      createMockAlert({ id: i + 1 })
    );
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('+2 more alerts')).toBeInTheDocument();
  });

  it('respects custom maxDisplay prop', () => {
    const alerts = Array.from({ length: 5 }, (_, i) =>
      createMockAlert({ id: i + 1 })
    );
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
          maxDisplay={3}
        />
      </MemoryRouter>
    );

    const alertCards = screen.getAllByTestId('alert-card');
    expect(alertCards).toHaveLength(3);
    expect(screen.getByText('+2 more alerts')).toBeInTheDocument();
  });

  it('shows View All link when alerts exist', () => {
    const alerts = [createMockAlert()];
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('view-all-link')).toBeInTheDocument();
  });

  it('shows View History link in empty state', () => {
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={[]}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('view-history-link')).toBeInTheDocument();
  });

  it('passes acknowledgingIds to AlertCards', () => {
    const alerts = [createMockAlert({ id: 1 }), createMockAlert({ id: 2 })];
    const onAcknowledge = vi.fn();
    render(
      <MemoryRouter>
        <AlertBanner
          alerts={alerts}
          onAcknowledge={onAcknowledge}
          acknowledgingIds={new Set([1])}
        />
      </MemoryRouter>
    );

    const buttons = screen.getAllByTestId('alert-acknowledge-button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });
});
