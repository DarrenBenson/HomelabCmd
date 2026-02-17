/**
 * FleetStatus component tests
 *
 * Verifies:
 * - Healthy state display (no alerts)
 * - Alert state display (with alerts)
 * - Stats calculation (total, online, offline)
 * - Refresh button functionality
 * - Alert list rendering
 * - View History / View All links
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FleetStatus } from './FleetStatus';
import type { Alert } from '../types/alert';
import type { Server } from '../types/server';

// Helper to create mock server data
function createMockServer(
  id: string,
  status: 'online' | 'offline',
  machineType: 'server' | 'workstation' = 'server'
): Server {
  return {
    id,
    hostname: `${id}.local`,
    display_name: id,
    status,
    is_paused: false,
    agent_version: null,
    agent_mode: null,
    is_inactive: false,
    inactive_since: null,
    updates_available: null,
    security_updates: null,
    machine_type: machineType,
    last_seen: null,
    latest_metrics: null,
    active_alert_count: 0,
  };
}

// Helper to create mock alert data
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

// Test fixtures
const healthyFleet: Server[] = [
  createMockServer('server-1', 'online'),
  createMockServer('server-2', 'online'),
  createMockServer('ws-1', 'online', 'workstation'),
];

const mixedFleet: Server[] = [
  createMockServer('server-1', 'online'),
  createMockServer('server-2', 'offline'),
  createMockServer('ws-1', 'online', 'workstation'),
];

const emptyFleet: Server[] = [];

describe('FleetStatus', () => {
  const defaultProps = {
    machines: healthyFleet,
    alerts: [],
    onAcknowledge: vi.fn(),
    onAlertSelect: vi.fn(),
    acknowledgingIds: new Set<number>(),
    onRefresh: vi.fn(),
    isRefreshing: false,
  };

  const renderWithRouter = (props = {}) => {
    return render(
      <MemoryRouter>
        <FleetStatus {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  describe('Healthy state (no alerts)', () => {
    it('renders with data-testid', () => {
      renderWithRouter();

      expect(screen.getByTestId('fleet-status')).toBeInTheDocument();
    });

    it('shows "All Systems Operational" when no alerts', () => {
      renderWithRouter();

      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });

    it('shows checkmark icon in healthy state', () => {
      renderWithRouter();

      const container = screen.getByTestId('fleet-status');
      const svg = container.querySelector('.text-status-success');
      expect(svg).toBeInTheDocument();
    });

    it('shows View History link when no alerts', () => {
      renderWithRouter();

      expect(screen.getByTestId('view-history-link')).toBeInTheDocument();
      expect(screen.getByText('View History')).toBeInTheDocument();
    });

    it('does not render alert list when no alerts', () => {
      renderWithRouter();

      expect(screen.queryByTestId('alert-list')).not.toBeInTheDocument();
    });
  });

  describe('Alert state (with alerts)', () => {
    it('shows alert count when alerts exist', () => {
      const alerts = [createMockAlert({ id: 1 }), createMockAlert({ id: 2 })];
      renderWithRouter({ alerts });

      expect(screen.getByTestId('alert-count')).toHaveTextContent('2 Active Alerts');
    });

    it('shows singular form for single alert', () => {
      const alerts = [createMockAlert({ id: 1 })];
      renderWithRouter({ alerts });

      expect(screen.getByTestId('alert-count')).toHaveTextContent('1 Active Alert');
    });

    it('shows warning icon when alerts exist', () => {
      const alerts = [createMockAlert({ id: 1 })];
      renderWithRouter({ alerts });

      const container = screen.getByTestId('fleet-status');
      const svg = container.querySelector('.text-status-warning');
      expect(svg).toBeInTheDocument();
    });

    it('shows View All link when alerts exist', () => {
      const alerts = [createMockAlert({ id: 1 })];
      renderWithRouter({ alerts });

      expect(screen.getByTestId('view-all-link')).toBeInTheDocument();
      expect(screen.getByText('View All')).toBeInTheDocument();
    });

    it('renders alert list when alerts exist', () => {
      const alerts = [createMockAlert({ id: 1 })];
      renderWithRouter({ alerts });

      expect(screen.getByTestId('alert-list')).toBeInTheDocument();
    });

    it('renders alert cards', () => {
      const alerts = [
        createMockAlert({ id: 1, title: 'Alert One' }),
        createMockAlert({ id: 2, title: 'Alert Two' }),
      ];
      renderWithRouter({ alerts });

      const alertCards = screen.getAllByTestId('alert-card');
      expect(alertCards).toHaveLength(2);
    });

    it('limits displayed alerts to maxAlertDisplay', () => {
      const alerts = Array.from({ length: 5 }, (_, i) =>
        createMockAlert({ id: i + 1, title: `Alert ${i + 1}` })
      );
      renderWithRouter({ alerts, maxAlertDisplay: 3 });

      const alertCards = screen.getAllByTestId('alert-card');
      expect(alertCards).toHaveLength(3);
    });

    it('shows "View All X Alerts" when alerts exceed maxAlertDisplay', () => {
      const alerts = Array.from({ length: 5 }, (_, i) =>
        createMockAlert({ id: i + 1 })
      );
      renderWithRouter({ alerts, maxAlertDisplay: 3 });

      expect(screen.getByTestId('view-more-link')).toBeInTheDocument();
      expect(screen.getByText('View All 5 Alerts')).toBeInTheDocument();
    });

    it('does not show view more when alerts equal maxAlertDisplay', () => {
      const alerts = Array.from({ length: 3 }, (_, i) =>
        createMockAlert({ id: i + 1 })
      );
      renderWithRouter({ alerts, maxAlertDisplay: 3 });

      expect(screen.queryByTestId('view-more-link')).not.toBeInTheDocument();
    });
  });

  describe('Stats display', () => {
    it('shows total machine count', () => {
      renderWithRouter({ machines: mixedFleet });

      expect(screen.getByTestId('stat-machines')).toHaveTextContent('3 Machines');
    });

    it('shows singular machine for 1 machine', () => {
      renderWithRouter({ machines: [createMockServer('s1', 'online')] });

      expect(screen.getByTestId('stat-machines')).toHaveTextContent('1 Machine');
    });

    it('shows online count', () => {
      renderWithRouter({ machines: mixedFleet });

      expect(screen.getByTestId('stat-online')).toHaveTextContent('2 Online');
    });

    it('shows offline count when > 0', () => {
      renderWithRouter({ machines: mixedFleet });

      expect(screen.getByTestId('stat-offline')).toHaveTextContent('1 Offline');
    });

    it('hides offline count when 0', () => {
      renderWithRouter({ machines: healthyFleet });

      expect(screen.queryByTestId('stat-offline')).not.toBeInTheDocument();
    });

    it('shows 0 machines for empty fleet', () => {
      renderWithRouter({ machines: emptyFleet });

      expect(screen.getByTestId('stat-machines')).toHaveTextContent('0 Machines');
    });
  });

  describe('Refresh button', () => {
    it('renders refresh button', () => {
      renderWithRouter();

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      renderWithRouter({ onRefresh });

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows spinner when refreshing', () => {
      renderWithRouter({ isRefreshing: true });

      const refreshButton = screen.getByTestId('refresh-button');
      const icon = refreshButton.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');
    });

    it('is disabled when refreshing', () => {
      renderWithRouter({ isRefreshing: true });

      expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });

    it('has correct aria-label when not refreshing', () => {
      renderWithRouter({ isRefreshing: false });

      expect(screen.getByTestId('refresh-button')).toHaveAttribute(
        'aria-label',
        'Refresh data'
      );
    });

    it('has correct aria-label when refreshing', () => {
      renderWithRouter({ isRefreshing: true });

      expect(screen.getByTestId('refresh-button')).toHaveAttribute(
        'aria-label',
        'Refreshing...'
      );
    });
  });

  describe('Alert interactions', () => {
    it('passes acknowledgingIds to AlertCards', () => {
      const alerts = [createMockAlert({ id: 1 }), createMockAlert({ id: 2 })];
      renderWithRouter({
        alerts,
        acknowledgingIds: new Set([1]),
      });

      const buttons = screen.getAllByTestId('alert-acknowledge-button');
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).not.toBeDisabled();
    });

    it('calls onAcknowledge when alert acknowledge clicked', () => {
      const onAcknowledge = vi.fn();
      const alerts = [createMockAlert({ id: 42 })];
      renderWithRouter({ alerts, onAcknowledge });

      fireEvent.click(screen.getByTestId('alert-acknowledge-button'));

      expect(onAcknowledge).toHaveBeenCalledWith(42);
    });

    it('calls onAlertSelect when alert card clicked', () => {
      const onAlertSelect = vi.fn();
      const alert = createMockAlert({ id: 1 });
      renderWithRouter({ alerts: [alert], onAlertSelect });

      fireEvent.click(screen.getByTestId('alert-card'));

      expect(onAlertSelect).toHaveBeenCalledWith(alert);
    });
  });

  describe('Accessibility', () => {
    it('icons have aria-hidden', () => {
      renderWithRouter();

      const container = screen.getByTestId('fleet-status');
      const icons = container.querySelectorAll('svg');
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('refresh button has aria-label', () => {
      renderWithRouter();

      expect(screen.getByTestId('refresh-button')).toHaveAccessibleName();
    });
  });

  describe('Filter panel', () => {
    const filterProps = {
      searchQuery: '',
      onSearchChange: vi.fn(),
      statusFilter: 'all' as const,
      onStatusChange: vi.fn(),
      onClearFilters: vi.fn(),
      hasActiveFilters: false,
    };

    it('shows filter toggle button when filter props provided', () => {
      renderWithRouter({ ...filterProps });

      expect(screen.getByTestId('filter-toggle-button')).toBeInTheDocument();
    });

    it('hides filter toggle button when no filter props', () => {
      renderWithRouter();

      expect(screen.queryByTestId('filter-toggle-button')).not.toBeInTheDocument();
    });

    it('filter panel is hidden by default', () => {
      renderWithRouter({ ...filterProps });

      expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();
    });

    it('opens filter panel when toggle clicked', () => {
      renderWithRouter({ ...filterProps });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    it('closes filter panel when toggle clicked again', () => {
      renderWithRouter({ ...filterProps });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('filter-toggle-button'));
      expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();
    });

    it('shows search input in filter panel', () => {
      renderWithRouter({ ...filterProps });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('shows status filter chips in filter panel', () => {
      renderWithRouter({ ...filterProps });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));

      expect(screen.getByTestId('status-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-online')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-offline')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-warning')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter-paused')).toBeInTheDocument();
    });

    it('calls onSearchChange when typing in search', () => {
      const onSearchChange = vi.fn();
      renderWithRouter({ ...filterProps, onSearchChange });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'test' },
      });

      expect(onSearchChange).toHaveBeenCalledWith('test');
    });

    it('calls onStatusChange when filter chip clicked', () => {
      const onStatusChange = vi.fn();
      renderWithRouter({ ...filterProps, onStatusChange });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));
      fireEvent.click(screen.getByTestId('status-filter-online'));

      expect(onStatusChange).toHaveBeenCalledWith('online');
    });

    it('shows clear button when filters active', () => {
      renderWithRouter({ ...filterProps, hasActiveFilters: true });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));

      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
    });

    it('calls onClearFilters when clear button clicked', () => {
      const onClearFilters = vi.fn();
      renderWithRouter({ ...filterProps, hasActiveFilters: true, onClearFilters });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));
      fireEvent.click(screen.getByTestId('clear-filters-button'));

      expect(onClearFilters).toHaveBeenCalled();
    });

    it('shows active filter indicator when panel closed and filters active', () => {
      renderWithRouter({ ...filterProps, hasActiveFilters: true });

      expect(screen.getByTestId('filter-active-indicator')).toBeInTheDocument();
    });

    it('hides active filter indicator when panel open', () => {
      renderWithRouter({ ...filterProps, hasActiveFilters: true });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));

      expect(screen.queryByTestId('filter-active-indicator')).not.toBeInTheDocument();
    });

    it('clears search on Escape key', () => {
      const onSearchChange = vi.fn();
      renderWithRouter({ ...filterProps, searchQuery: 'test', onSearchChange });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));
      fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Escape' });

      expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('shows clear search button when search has text', () => {
      renderWithRouter({ ...filterProps, searchQuery: 'test' });

      fireEvent.click(screen.getByTestId('filter-toggle-button'));

      expect(screen.getByTestId('clear-search-button')).toBeInTheDocument();
    });
  });
});
