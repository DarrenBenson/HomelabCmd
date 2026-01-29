/**
 * SummaryBar component tests for US0134: Dashboard Summary Bar
 *
 * Verifies:
 * - AC1: Summary bar position (renders with data-testid)
 * - AC2: Total machines count
 * - AC3: Online count with green styling
 * - AC4: Offline servers count (red, only when > 0)
 * - AC5: Workstation status (X/Y format, blue)
 * - AC6: Click to filter
 * - AC7: Refresh button with spinner
 * - AC8: All healthy state indicator
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryBar } from './SummaryBar';
import type { Server } from '../types/server';

// Helper to create mock server data
function createMockServer(
  id: string,
  status: 'online' | 'offline',
  machineType: 'server' | 'workstation'
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

// Test fixtures
const mixedFleet: Server[] = [
  createMockServer('server-1', 'online', 'server'),
  createMockServer('server-2', 'online', 'server'),
  createMockServer('server-3', 'offline', 'server'),
  createMockServer('ws-1', 'online', 'workstation'),
  createMockServer('ws-2', 'offline', 'workstation'),
];

const allHealthy: Server[] = [
  createMockServer('server-1', 'online', 'server'),
  createMockServer('server-2', 'online', 'server'),
  createMockServer('ws-1', 'online', 'workstation'),
];

const serversOnly: Server[] = [
  createMockServer('server-1', 'online', 'server'),
  createMockServer('server-2', 'online', 'server'),
];

const emptyFleet: Server[] = [];

describe('SummaryBar', () => {
  const defaultProps = {
    machines: mixedFleet,
    onFilter: vi.fn(),
    onRefresh: vi.fn(),
    isRefreshing: false,
  };

  /**
   * AC1: Summary bar position and styling
   */
  describe('Summary bar rendering (AC1)', () => {
    it('renders with data-testid (TC01)', () => {
      render(<SummaryBar {...defaultProps} />);

      expect(screen.getByTestId('summary-bar')).toBeInTheDocument();
    });

    it('has subtle background styling (TC02)', () => {
      render(<SummaryBar {...defaultProps} />);

      const summaryBar = screen.getByTestId('summary-bar');
      expect(summaryBar).toHaveClass('bg-bg-secondary/50');
      expect(summaryBar).toHaveClass('rounded-lg');
    });

    it('uses flex layout for responsive wrapping (TC19)', () => {
      render(<SummaryBar {...defaultProps} />);

      const summaryBar = screen.getByTestId('summary-bar');
      expect(summaryBar).toHaveClass('flex');
      expect(summaryBar).toHaveClass('flex-wrap');
    });
  });

  /**
   * AC2: Total machines count
   */
  describe('Total machines count (AC2)', () => {
    it('displays correct total count (TC03)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const machinesStat = screen.getByTestId('stat-machines');
      expect(machinesStat).toBeInTheDocument();
      expect(machinesStat).toHaveTextContent('5');
      expect(machinesStat).toHaveTextContent('Machines');
    });

    it('shows 0 when no machines (TC17)', () => {
      render(<SummaryBar {...defaultProps} machines={emptyFleet} />);

      const machinesStat = screen.getByTestId('stat-machines');
      expect(machinesStat).toHaveTextContent('0');
    });
  });

  /**
   * AC3: Online count with green styling
   */
  describe('Online count (AC3)', () => {
    it('displays correct online count (TC04)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const onlineStat = screen.getByTestId('stat-online');
      expect(onlineStat).toBeInTheDocument();
      expect(onlineStat).toHaveTextContent('3'); // 2 servers + 1 workstation online
      expect(onlineStat).toHaveTextContent('Online');
    });

    it('has green styling for online count (TC04)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const onlineStat = screen.getByTestId('stat-online');
      // Check the value span has green class
      const valueSpan = onlineStat.querySelector('.text-status-success');
      expect(valueSpan).toBeInTheDocument();
    });

    it('counts both servers and workstations in online (TC05)', () => {
      const allOnline: Server[] = [
        createMockServer('server-1', 'online', 'server'),
        createMockServer('server-2', 'online', 'server'),
        createMockServer('ws-1', 'online', 'workstation'),
        createMockServer('ws-2', 'online', 'workstation'),
      ];
      render(<SummaryBar {...defaultProps} machines={allOnline} />);

      const onlineStat = screen.getByTestId('stat-online');
      expect(onlineStat).toHaveTextContent('4');
    });
  });

  /**
   * AC4: Offline servers count
   */
  describe('Offline servers count (AC4)', () => {
    it('displays offline servers when > 0 (TC06)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const offlineStat = screen.getByTestId('stat-servers-offline');
      expect(offlineStat).toBeInTheDocument();
      expect(offlineStat).toHaveTextContent('1');
      expect(offlineStat).toHaveTextContent('Servers Offline');
    });

    it('has red styling for offline servers (TC06)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const offlineStat = screen.getByTestId('stat-servers-offline');
      const valueSpan = offlineStat.querySelector('.text-status-error');
      expect(valueSpan).toBeInTheDocument();
    });

    it('hides offline servers stat when 0 (TC07)', () => {
      render(<SummaryBar {...defaultProps} machines={allHealthy} />);

      expect(screen.queryByTestId('stat-servers-offline')).not.toBeInTheDocument();
    });

    it('does not count offline workstations as servers offline', () => {
      const workstationOffline: Server[] = [
        createMockServer('server-1', 'online', 'server'),
        createMockServer('ws-1', 'offline', 'workstation'),
        createMockServer('ws-2', 'offline', 'workstation'),
      ];
      render(<SummaryBar {...defaultProps} machines={workstationOffline} />);

      expect(screen.queryByTestId('stat-servers-offline')).not.toBeInTheDocument();
    });
  });

  /**
   * AC5: Workstation status
   */
  describe('Workstation status (AC5)', () => {
    it('displays X/Y format for workstations (TC08)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const workstationStat = screen.getByTestId('stat-workstations');
      expect(workstationStat).toBeInTheDocument();
      expect(workstationStat).toHaveTextContent('1/2'); // 1 online, 2 total
      expect(workstationStat).toHaveTextContent('Workstations');
    });

    it('has blue styling for workstations (TC08)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      const workstationStat = screen.getByTestId('stat-workstations');
      const valueSpan = workstationStat.querySelector('.text-status-info');
      expect(valueSpan).toBeInTheDocument();
    });

    it('hides workstation stat when no workstations (TC09)', () => {
      render(<SummaryBar {...defaultProps} machines={serversOnly} />);

      expect(screen.queryByTestId('stat-workstations')).not.toBeInTheDocument();
    });

    it('shows 0/N when all workstations offline (TC18)', () => {
      const allWsOffline: Server[] = [
        createMockServer('server-1', 'online', 'server'),
        createMockServer('ws-1', 'offline', 'workstation'),
        createMockServer('ws-2', 'offline', 'workstation'),
      ];
      render(<SummaryBar {...defaultProps} machines={allWsOffline} />);

      const workstationStat = screen.getByTestId('stat-workstations');
      expect(workstationStat).toHaveTextContent('0/2');
      // Should NOT have red styling (workstations offline is normal)
      const errorSpan = workstationStat.querySelector('.text-status-error');
      expect(errorSpan).not.toBeInTheDocument();
    });
  });

  /**
   * AC6: Click to filter
   */
  describe('Click to filter (AC6)', () => {
    it('calls onFilter when clicking online stat (TC10)', () => {
      const onFilter = vi.fn();
      render(<SummaryBar {...defaultProps} onFilter={onFilter} />);

      const onlineStat = screen.getByTestId('stat-online');
      fireEvent.click(onlineStat);

      expect(onFilter).toHaveBeenCalledTimes(1);
      expect(onFilter).toHaveBeenCalledWith('online', 'all');
    });

    it('calls onFilter when clicking offline servers stat (TC10)', () => {
      const onFilter = vi.fn();
      render(<SummaryBar {...defaultProps} onFilter={onFilter} />);

      const offlineStat = screen.getByTestId('stat-servers-offline');
      fireEvent.click(offlineStat);

      expect(onFilter).toHaveBeenCalledTimes(1);
      expect(onFilter).toHaveBeenCalledWith('offline', 'server');
    });

    it('calls onFilter when clicking workstations stat (TC10)', () => {
      const onFilter = vi.fn();
      render(<SummaryBar {...defaultProps} onFilter={onFilter} />);

      const workstationStat = screen.getByTestId('stat-workstations');
      fireEvent.click(workstationStat);

      expect(onFilter).toHaveBeenCalledTimes(1);
      expect(onFilter).toHaveBeenCalledWith('all', 'workstation');
    });

    it('total machines stat is not clickable', () => {
      const onFilter = vi.fn();
      render(<SummaryBar {...defaultProps} onFilter={onFilter} />);

      const machinesStat = screen.getByTestId('stat-machines');
      fireEvent.click(machinesStat);

      // onFilter should not be called for total machines
      expect(onFilter).not.toHaveBeenCalled();
    });

    it('clickable stats have hover styling', () => {
      render(<SummaryBar {...defaultProps} />);

      const onlineStat = screen.getByTestId('stat-online');
      expect(onlineStat).toHaveClass('hover:bg-bg-tertiary');
      expect(onlineStat).toHaveClass('cursor-pointer');
    });
  });

  /**
   * AC7: Refresh button
   */
  describe('Refresh button (AC7)', () => {
    it('renders refresh button (TC13)', () => {
      render(<SummaryBar {...defaultProps} />);

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toBeInTheDocument();
    });

    it('calls onRefresh when clicked (TC13)', () => {
      const onRefresh = vi.fn();
      render(<SummaryBar {...defaultProps} onRefresh={onRefresh} />);

      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows spinner when refreshing (TC14)', () => {
      render(<SummaryBar {...defaultProps} isRefreshing={true} />);

      const refreshButton = screen.getByTestId('refresh-button');
      const icon = refreshButton.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');
    });

    it('does not show spinner when not refreshing (TC14)', () => {
      render(<SummaryBar {...defaultProps} isRefreshing={false} />);

      const refreshButton = screen.getByTestId('refresh-button');
      const icon = refreshButton.querySelector('svg');
      expect(icon).not.toHaveClass('animate-spin');
    });

    it('is disabled while refreshing (TC14)', () => {
      render(<SummaryBar {...defaultProps} isRefreshing={true} />);

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toBeDisabled();
    });
  });

  /**
   * AC8: All healthy state
   */
  describe('All healthy state (AC8)', () => {
    it('shows healthy indicator when no offline servers (TC15)', () => {
      render(<SummaryBar {...defaultProps} machines={allHealthy} />);

      const healthyIndicator = screen.getByTestId('all-healthy-indicator');
      expect(healthyIndicator).toBeInTheDocument();
      expect(healthyIndicator).toHaveTextContent('All systems operational');
    });

    it('healthy indicator has green styling (TC15)', () => {
      render(<SummaryBar {...defaultProps} machines={allHealthy} />);

      const healthyIndicator = screen.getByTestId('all-healthy-indicator');
      expect(healthyIndicator).toHaveClass('text-status-success');
    });

    it('hides healthy indicator when servers offline (TC16)', () => {
      render(<SummaryBar {...defaultProps} machines={mixedFleet} />);

      expect(screen.queryByTestId('all-healthy-indicator')).not.toBeInTheDocument();
    });

    it('hides healthy indicator when no machines (empty fleet)', () => {
      render(<SummaryBar {...defaultProps} machines={emptyFleet} />);

      expect(screen.queryByTestId('all-healthy-indicator')).not.toBeInTheDocument();
    });
  });

  /**
   * Accessibility
   */
  describe('Accessibility', () => {
    it('refresh button has aria-label', () => {
      render(<SummaryBar {...defaultProps} />);

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh data');
    });

    it('refresh button has loading aria-label when refreshing', () => {
      render(<SummaryBar {...defaultProps} isRefreshing={true} />);

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toHaveAttribute('aria-label', 'Refreshing...');
    });

    it('icons have aria-hidden', () => {
      render(<SummaryBar {...defaultProps} />);

      const summaryBar = screen.getByTestId('summary-bar');
      const icons = summaryBar.querySelectorAll('svg');
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});
