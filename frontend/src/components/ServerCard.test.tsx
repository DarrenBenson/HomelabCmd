import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ServerCard } from './ServerCard';
import { pauseServer, unpauseServer } from '../api/servers';
import type { Server } from '../types/server';

// Mock the API
vi.mock('../api/servers', () => ({
  pauseServer: vi.fn(),
  unpauseServer: vi.fn(),
}));

const mockPauseServer = pauseServer as Mock;
const mockUnpauseServer = unpauseServer as Mock;

const mockServer: Server = {
  id: 'test-server',
  hostname: 'test-server.local',
  display_name: 'Test Server',
  status: 'online',
  is_paused: false,
  agent_version: null,
  agent_mode: null,
  is_inactive: false,
  inactive_since: null,
  updates_available: null,
  security_updates: null,
  // US0090: Default to server type with no last_seen
  machine_type: 'server',
  last_seen: null,
  latest_metrics: {
    cpu_percent: 45.5,
    memory_percent: 67.2,
    disk_percent: 35.0,
    uptime_seconds: 86400 * 5 + 3600 * 2, // 5 days 2 hours
    memory_total_mb: null,
    memory_used_mb: null,
    disk_total_gb: null,
    disk_used_gb: null,
    network_rx_bytes: null,
    network_tx_bytes: null,
    load_1m: null,
    load_5m: null,
    load_15m: null,
  },
};

describe('ServerCard', () => {
  it('renders server display name', () => {
    render(<ServerCard server={mockServer} />);
    expect(screen.getByText('Test Server')).toBeInTheDocument();
  });

  it('renders hostname when display_name is null', () => {
    const serverWithoutDisplayName: Server = {
      ...mockServer,
      display_name: null,
    };
    render(<ServerCard server={serverWithoutDisplayName} />);
    expect(screen.getByText('test-server.local')).toBeInTheDocument();
  });

  it('renders CPU percentage', () => {
    render(<ServerCard server={mockServer} />);
    expect(screen.getByText('46%')).toBeInTheDocument(); // Rounded
    expect(screen.getByText('CPU')).toBeInTheDocument();
  });

  it('renders RAM percentage', () => {
    render(<ServerCard server={mockServer} />);
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('RAM')).toBeInTheDocument();
  });

  it('renders Disk percentage', () => {
    render(<ServerCard server={mockServer} />);
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('Disk')).toBeInTheDocument();
  });

  it('renders formatted uptime', () => {
    render(<ServerCard server={mockServer} />);
    expect(screen.getByText('↑ 5d 2h')).toBeInTheDocument();
  });

  it('renders "--" for null metrics', () => {
    const serverWithoutMetrics: Server = {
      ...mockServer,
      latest_metrics: null,
    };
    render(<ServerCard server={serverWithoutMetrics} />);
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(3); // CPU, RAM, Disk, uptime
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ServerCard server={mockServer} onClick={handleClick} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Enter key press', () => {
    const handleClick = vi.fn();
    render(<ServerCard server={mockServer} onClick={handleClick} />);

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // US0114: Status indicators use shape+colour+icon
  it('has correct status LED for online server', () => {
    render(<ServerCard server={mockServer} />);
    const statusLed = screen.getByRole('status');
    expect(statusLed).toHaveClass('bg-green-500');
  });

  it('has correct status LED for offline server', () => {
    const offlineServer: Server = {
      ...mockServer,
      status: 'offline',
    };
    render(<ServerCard server={offlineServer} />);
    const statusLed = screen.getByRole('status');
    expect(statusLed).toHaveClass('bg-red-500');
  });

  /**
   * Package update display tests (TC080-TC083)
   * Spec Reference: sdlc-studio/testing/specs/TSP0006-server-detail-charts.md
   */
  describe('Package update count on card (TC080)', () => {
    it('displays update count when updates available', () => {
      const serverWithUpdates: Server = {
        ...mockServer,
        updates_available: 12,
        security_updates: 3,
      };
      render(<ServerCard server={serverWithUpdates} />);

      const indicator = screen.getByTestId('update-indicator');
      expect(indicator).toHaveTextContent('12 updates');
    });

    it('displays security count in parentheses', () => {
      const serverWithUpdates: Server = {
        ...mockServer,
        updates_available: 12,
        security_updates: 3,
      };
      render(<ServerCard server={serverWithUpdates} />);

      const indicator = screen.getByTestId('update-indicator');
      expect(indicator).toHaveTextContent('(3 security)');
    });
  });

  describe('Security updates highlighted (TC081)', () => {
    it('displays security count with warning colour', () => {
      const serverWithSecurityUpdates: Server = {
        ...mockServer,
        updates_available: 5,
        security_updates: 2,
      };
      render(<ServerCard server={serverWithSecurityUpdates} />);

      const indicator = screen.getByTestId('update-indicator');
      const securitySpan = indicator.querySelector('.text-status-warning');
      expect(securitySpan).toBeInTheDocument();
      expect(securitySpan).toHaveTextContent('2 security');
    });

    it('does not show security count when security_updates is 0', () => {
      const serverWithNoSecurityUpdates: Server = {
        ...mockServer,
        updates_available: 5,
        security_updates: 0,
      };
      render(<ServerCard server={serverWithNoSecurityUpdates} />);

      const indicator = screen.getByTestId('update-indicator');
      expect(indicator).toHaveTextContent('5 updates');
      expect(indicator).not.toHaveTextContent('security');
    });
  });

  describe('Zero updates shows clean state (TC082)', () => {
    it('displays "Up to date" when updates_available is 0', () => {
      const serverUpToDate: Server = {
        ...mockServer,
        updates_available: 0,
        security_updates: 0,
      };
      render(<ServerCard server={serverUpToDate} />);

      const indicator = screen.getByTestId('update-indicator');
      expect(indicator).toHaveTextContent('Up to date');
    });

    it('applies success colour to "Up to date" text', () => {
      const serverUpToDate: Server = {
        ...mockServer,
        updates_available: 0,
        security_updates: 0,
      };
      render(<ServerCard server={serverUpToDate} />);

      const indicator = screen.getByTestId('update-indicator');
      expect(indicator).toHaveClass('text-status-success');
    });
  });

  describe('Update indicator visibility', () => {
    it('does not show update indicator when updates_available is null', () => {
      const serverNoUpdateData: Server = {
        ...mockServer,
        updates_available: null,
        security_updates: null,
      };
      render(<ServerCard server={serverNoUpdateData} />);

      expect(screen.queryByTestId('update-indicator')).not.toBeInTheDocument();
    });

    it('shows update indicator for single update', () => {
      const serverWithOneUpdate: Server = {
        ...mockServer,
        updates_available: 1,
        security_updates: 0,
      };
      render(<ServerCard server={serverWithOneUpdate} />);

      const indicator = screen.getByTestId('update-indicator');
      expect(indicator).toHaveTextContent('1 updates');
    });
  });

  /**
   * Maintenance mode badge tests (US0029 AC4)
   * Spec Reference: sdlc-studio/stories/US0029-server-maintenance-mode.md
   */
  describe('Maintenance mode badge (US0029 AC4)', () => {
    it('displays maintenance badge when server is paused', () => {
      const pausedServer: Server = {
        ...mockServer,
        is_paused: true,
      };
      render(<ServerCard server={pausedServer} />);

      const badge = screen.getByTestId('maintenance-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Maintenance');
    });

    it('does not display maintenance badge when server is not paused', () => {
      const normalServer: Server = {
        ...mockServer,
        is_paused: false,
      };
      render(<ServerCard server={normalServer} />);

      expect(screen.queryByTestId('maintenance-badge')).not.toBeInTheDocument();
    });

    it('maintenance badge has warning colour styling', () => {
      const pausedServer: Server = {
        ...mockServer,
        is_paused: true,
      };
      render(<ServerCard server={pausedServer} />);

      const badge = screen.getByTestId('maintenance-badge');
      expect(badge).toHaveClass('text-status-warning');
    });
  });

  /**
   * Workstation offline display tests (US0090)
   * Spec Reference: sdlc-studio/stories/US0090-last-seen-ui-workstations.md
   *
   * AC1: Workstation offline shows "Last seen: X ago" with grey indicator
   * AC2: Server offline shows "OFFLINE" with red indicator (unchanged)
   * AC3: Relative time formatting and dynamic updates
   * AC4: Status indicator colours (green/red/grey)
   * AC5: Tooltip explanation for workstation
   */
  describe('Workstation offline display (US0090)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-27T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // AC1: Workstation "Last Seen" display
    describe('AC1: Workstation "Last seen" display', () => {
      it('shows "Last seen: X ago" for offline workstation (TC-US0090-01)', () => {
        const offlineWorkstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-27T09:00:00Z', // 3 hours ago
        };
        render(<ServerCard server={offlineWorkstation} />);

        expect(screen.getByText(/Last seen:/)).toBeInTheDocument();
        expect(screen.getByText(/3 hours ago/)).toBeInTheDocument();
      });

      it('shows "Last seen: Unknown" when last_seen is null (TC-US0090-07)', () => {
        const offlineWorkstationNoLastSeen: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: null,
        };
        render(<ServerCard server={offlineWorkstationNoLastSeen} />);

        expect(screen.getByText(/Last seen: Unknown/)).toBeInTheDocument();
      });

      // US0114: Offline workstation shows hollow grey circle
      it('shows hollow grey circle for offline workstation (TC-US0090-04)', () => {
        const offlineWorkstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-27T09:00:00Z',
        };
        render(<ServerCard server={offlineWorkstation} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('border-gray-400');
        expect(statusLed).not.toHaveClass('bg-red-500');
      });
    });

    // AC2: Server OFFLINE display unchanged
    describe('AC2: Server OFFLINE display unchanged', () => {
      it('shows "OFFLINE" for offline server (TC-US0090-02)', () => {
        const offlineServer: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'server',
          last_seen: '2026-01-27T09:00:00Z',
        };
        render(<ServerCard server={offlineServer} />);

        // Server should NOT show "Last seen" text
        expect(screen.queryByText(/Last seen:/)).not.toBeInTheDocument();
      });

      // US0114: Offline server shows filled red circle with X
      it('shows red circle with X for offline server (TC-US0090-04)', () => {
        const offlineServer: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'server',
          last_seen: '2026-01-27T09:00:00Z',
        };
        render(<ServerCard server={offlineServer} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('bg-red-500');
        expect(statusLed).not.toHaveClass('border-gray-400');
      });

      it('treats undefined machine_type as server (default behaviour)', () => {
        const offlineServerNoType: Server = {
          ...mockServer,
          status: 'offline',
          // machine_type not set
          last_seen: '2026-01-27T09:00:00Z',
        };
        render(<ServerCard server={offlineServerNoType} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('bg-red-500');
      });
    });

    // AC3: Relative time formatting
    describe('AC3: Relative time formatting', () => {
      it('formats time as "5 minutes ago" (TC-US0090-03)', () => {
        const workstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-27T11:55:00Z', // 5 minutes ago
        };
        render(<ServerCard server={workstation} />);

        expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
      });

      it('formats time as "about 3 hours ago" (TC-US0090-03)', () => {
        const workstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-27T09:00:00Z', // 3 hours ago
        };
        render(<ServerCard server={workstation} />);

        expect(screen.getByText(/3 hours ago/)).toBeInTheDocument();
      });

      it('formats time as "2 days ago" (TC-US0090-03)', () => {
        const workstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-25T12:00:00Z', // 2 days ago
        };
        render(<ServerCard server={workstation} />);

        expect(screen.getByText(/2 days ago/)).toBeInTheDocument();
      });

      it('updates time dynamically every 60 seconds (TC-US0090-06)', () => {
        const workstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-27T11:59:00Z', // 1 minute ago
        };
        render(<ServerCard server={workstation} />);

        // Initial render
        expect(screen.getByText(/1 minute ago/)).toBeInTheDocument();

        // Advance time by 60 seconds
        act(() => {
          vi.advanceTimersByTime(60000);
        });

        // Should now show 2 minutes ago
        expect(screen.getByText(/2 minutes ago/)).toBeInTheDocument();
      });
    });

    // AC4: Status indicator colours (US0114: uses shape+colour+icon)
    describe('AC4: Status indicator colours', () => {
      it('shows green circle with checkmark for online server', () => {
        const onlineServer: Server = {
          ...mockServer,
          status: 'online',
          machine_type: 'server',
        };
        render(<ServerCard server={onlineServer} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('bg-green-500');
      });

      it('shows green circle with checkmark for online workstation', () => {
        const onlineWorkstation: Server = {
          ...mockServer,
          status: 'online',
          machine_type: 'workstation',
        };
        render(<ServerCard server={onlineWorkstation} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('bg-green-500');
      });
    });

    // AC5: Tooltip explanation
    describe('AC5: Tooltip explanation', () => {
      it('shows tooltip for offline workstation status (TC-US0090-05)', () => {
        const offlineWorkstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
          last_seen: '2026-01-27T09:00:00Z',
        };
        render(<ServerCard server={offlineWorkstation} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveAttribute(
          'title',
          'Workstation - intermittent availability expected'
        );
      });

      it('does not show workstation tooltip for offline server', () => {
        const offlineServer: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'server',
          last_seen: '2026-01-27T09:00:00Z',
        };
        render(<ServerCard server={offlineServer} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).not.toHaveAttribute(
          'title',
          'Workstation - intermittent availability expected'
        );
      });
    });
  });

  /**
   * Visual distinction tests (US0091)
   * Spec Reference: sdlc-studio/stories/US0091-visual-distinction-workstations.md
   *
   * AC1: Machine type icons - Server icon for servers, Monitor icon for workstations
   * AC2: Type badges - "Server" or "Workstation" badge on each card
   * AC3: Colour accents - Blue left border for servers, purple for workstations
   * AC4: Offline workstation border style - Dashed border for offline workstations
   * AC5: Hover tooltip - Full machine type description on hover
   */
  describe('Visual distinction (US0091)', () => {
    // AC1: Machine type icons
    describe('AC1: Machine type icons', () => {
      it('shows Server icon for servers (TC-US0091-01)', () => {
        const server: Server = {
          ...mockServer,
          machine_type: 'server',
        };
        render(<ServerCard server={server} />);

        const icon = screen.getByTestId('machine-type-icon');
        expect(icon).toBeInTheDocument();
        expect(icon.querySelector('.lucide-server')).toBeInTheDocument();
      });

      it('shows Monitor icon for workstations (TC-US0091-02)', () => {
        const workstation: Server = {
          ...mockServer,
          machine_type: 'workstation',
        };
        render(<ServerCard server={workstation} />);

        const icon = screen.getByTestId('machine-type-icon');
        expect(icon).toBeInTheDocument();
        expect(icon.querySelector('.lucide-monitor')).toBeInTheDocument();
      });

      it('defaults to Server icon when machine_type is undefined (TC-US0091-10)', () => {
        const serverNoType: Server = {
          ...mockServer,
          machine_type: undefined,
        };
        render(<ServerCard server={serverNoType} />);

        const icon = screen.getByTestId('machine-type-icon');
        expect(icon.querySelector('.lucide-server')).toBeInTheDocument();
      });
    });

    // AC2: Type badges
    describe('AC2: Type badges', () => {
      it('shows "Server" badge for servers (TC-US0091-03)', () => {
        const server: Server = {
          ...mockServer,
          machine_type: 'server',
        };
        render(<ServerCard server={server} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveTextContent('Server');
      });

      it('shows "Workstation" badge for workstations (TC-US0091-04)', () => {
        const workstation: Server = {
          ...mockServer,
          machine_type: 'workstation',
        };
        render(<ServerCard server={workstation} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveTextContent('Workstation');
      });

      it('shows blue badge styling for servers', () => {
        const server: Server = {
          ...mockServer,
          machine_type: 'server',
        };
        render(<ServerCard server={server} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveClass('bg-blue-100');
        expect(badge).toHaveClass('text-blue-800');
      });

      it('shows purple badge styling for workstations', () => {
        const workstation: Server = {
          ...mockServer,
          machine_type: 'workstation',
        };
        render(<ServerCard server={workstation} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveClass('bg-purple-100');
        expect(badge).toHaveClass('text-purple-800');
      });

      it('defaults to "Server" badge when machine_type is undefined', () => {
        const serverNoType: Server = {
          ...mockServer,
          machine_type: undefined,
        };
        render(<ServerCard server={serverNoType} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveTextContent('Server');
        expect(badge).toHaveClass('bg-blue-100');
      });
    });

    // AC3: Colour accents (left border)
    describe('AC3: Colour accents (left border)', () => {
      it('shows blue left border for servers (TC-US0091-05)', () => {
        const server: Server = {
          ...mockServer,
          machine_type: 'server',
        };
        render(<ServerCard server={server} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('border-l-blue-500');
        expect(card).toHaveClass('border-l-4');
      });

      it('shows purple left border for workstations (TC-US0091-06)', () => {
        const workstation: Server = {
          ...mockServer,
          machine_type: 'workstation',
        };
        render(<ServerCard server={workstation} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('border-l-purple-500');
        expect(card).toHaveClass('border-l-4');
      });

      it('defaults to blue border when machine_type is undefined', () => {
        const serverNoType: Server = {
          ...mockServer,
          machine_type: undefined,
        };
        render(<ServerCard server={serverNoType} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('border-l-blue-500');
      });
    });

    // AC4: Offline workstation border style
    describe('AC4: Offline workstation border style', () => {
      it('shows dashed border for offline workstations (TC-US0091-07)', () => {
        const offlineWorkstation: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'workstation',
        };
        render(<ServerCard server={offlineWorkstation} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('border-dashed');
      });

      it('shows solid border for online workstations', () => {
        const onlineWorkstation: Server = {
          ...mockServer,
          status: 'online',
          machine_type: 'workstation',
        };
        render(<ServerCard server={onlineWorkstation} />);

        const card = screen.getByTestId('server-card');
        expect(card).not.toHaveClass('border-dashed');
      });

      it('shows solid border for offline servers', () => {
        const offlineServer: Server = {
          ...mockServer,
          status: 'offline',
          machine_type: 'server',
        };
        render(<ServerCard server={offlineServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).not.toHaveClass('border-dashed');
      });

      it('shows solid border for online servers', () => {
        const onlineServer: Server = {
          ...mockServer,
          status: 'online',
          machine_type: 'server',
        };
        render(<ServerCard server={onlineServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).not.toHaveClass('border-dashed');
      });
    });

    // AC5: Hover tooltip on badge and icon
    describe('AC5: Hover tooltip on badge and icon', () => {
      it('badge shows "Server - 24/7 uptime expected" tooltip for servers (TC-US0091-08)', () => {
        const server: Server = {
          ...mockServer,
          machine_type: 'server',
        };
        render(<ServerCard server={server} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveAttribute('title', 'Server - 24/7 uptime expected');
      });

      it('badge shows "Workstation - intermittent availability expected" tooltip for workstations (TC-US0091-08)', () => {
        const workstation: Server = {
          ...mockServer,
          machine_type: 'workstation',
        };
        render(<ServerCard server={workstation} />);

        const badge = screen.getByTestId('machine-type-badge');
        expect(badge).toHaveAttribute(
          'title',
          'Workstation - intermittent availability expected'
        );
      });

      it('icon shows tooltip for servers', () => {
        const server: Server = {
          ...mockServer,
          machine_type: 'server',
        };
        render(<ServerCard server={server} />);

        const icon = screen.getByTestId('machine-type-icon');
        expect(icon).toHaveAttribute('title', 'Server - 24/7 uptime expected');
      });

      it('icon shows tooltip for workstations', () => {
        const workstation: Server = {
          ...mockServer,
          machine_type: 'workstation',
        };
        render(<ServerCard server={workstation} />);

        const icon = screen.getByTestId('machine-type-icon');
        expect(icon).toHaveAttribute(
          'title',
          'Workstation - intermittent availability expected'
        );
      });
    });
  });

  /**
   * Enhanced Maintenance Mode Indicator tests (US0109)
   * Spec Reference: sdlc-studio/stories/US0109-maintenance-mode-indicator.md
   *
   * AC1: Amber/orange glow border when is_paused: true
   * AC2: Wrench icon next to server name when paused
   * AC3: Tooltip on wrench icon
   * AC4: Status LED shows neutral colour when paused
   */
  describe('Enhanced Maintenance Mode Indicator (US0109)', () => {
    // AC1: Border glow when paused
    describe('AC1: Border glow when paused', () => {
      it('shows amber ring border when server is paused (TC01)', () => {
        const pausedServer: Server = {
          ...mockServer,
          is_paused: true,
        };
        render(<ServerCard server={pausedServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('ring-2');
        expect(card).toHaveClass('ring-amber-500/50');
        expect(card).toHaveClass('border-amber-500');
      });

      it('does not show amber ring when server is not paused (TC02)', () => {
        const normalServer: Server = {
          ...mockServer,
          is_paused: false,
        };
        render(<ServerCard server={normalServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).not.toHaveClass('ring-amber-500/50');
        expect(card).not.toHaveClass('border-amber-500');
      });

      it('does not show amber ring when server is inactive (even if paused)', () => {
        const inactiveServer: Server = {
          ...mockServer,
          is_paused: true,
          is_inactive: true,
        };
        render(<ServerCard server={inactiveServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).not.toHaveClass('ring-amber-500/50');
      });
    });

    // AC2: Wrench icon when paused
    describe('AC2: Wrench icon when paused', () => {
      it('shows Wrench icon when server is paused (TC03)', () => {
        const pausedServer: Server = {
          ...mockServer,
          is_paused: true,
        };
        render(<ServerCard server={pausedServer} />);

        const wrenchIconWrapper = screen.getByTestId('maintenance-wrench-icon');
        expect(wrenchIconWrapper).toBeInTheDocument();
        // The SVG inside has the amber colour class
        const wrenchSvg = wrenchIconWrapper.querySelector('svg');
        expect(wrenchSvg).toHaveClass('text-amber-500');
      });

      it('does not show Wrench icon when server is not paused (TC04)', () => {
        const normalServer: Server = {
          ...mockServer,
          is_paused: false,
        };
        render(<ServerCard server={normalServer} />);

        expect(screen.queryByTestId('maintenance-wrench-icon')).not.toBeInTheDocument();
      });

      it('does not show Wrench icon when server is inactive (even if paused)', () => {
        const inactiveServer: Server = {
          ...mockServer,
          is_paused: true,
          is_inactive: true,
        };
        render(<ServerCard server={inactiveServer} />);

        expect(screen.queryByTestId('maintenance-wrench-icon')).not.toBeInTheDocument();
      });
    });

    // AC3: Tooltip on wrench icon
    describe('AC3: Tooltip on wrench icon', () => {
      it('Wrench icon has correct tooltip text (TC05)', () => {
        const pausedServer: Server = {
          ...mockServer,
          is_paused: true,
        };
        render(<ServerCard server={pausedServer} />);

        const wrenchIcon = screen.getByTestId('maintenance-wrench-icon');
        expect(wrenchIcon).toHaveAttribute('title', 'Maintenance mode - monitoring paused');
      });
    });

    // AC4: Status LED shows neutral colour when paused (US0114: hollow circle)
    describe('AC4: Status LED shows neutral colour when paused', () => {
      it('StatusLED shows hollow amber circle when server is paused (TC06)', () => {
        const pausedServer: Server = {
          ...mockServer,
          is_paused: true,
        };
        render(<ServerCard server={pausedServer} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('border-amber-500');
        expect(statusLed).toHaveClass('bg-transparent');
        expect(statusLed).not.toHaveClass('bg-green-500');
      });

      it('StatusLED shows "Paused" tooltip when server is paused (TC07)', () => {
        const pausedServer: Server = {
          ...mockServer,
          is_paused: true,
        };
        render(<ServerCard server={pausedServer} />);

        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveAttribute('title', 'Paused');
      });
    });

    // Edge cases
    describe('Edge cases', () => {
      it('paused and offline shows maintenance styling, not offline (Edge Case 1/TC08)', () => {
        const pausedOfflineServer: Server = {
          ...mockServer,
          status: 'offline',
          is_paused: true,
        };
        render(<ServerCard server={pausedOfflineServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('ring-amber-500/50');

        const wrenchIcon = screen.getByTestId('maintenance-wrench-icon');
        expect(wrenchIcon).toBeInTheDocument();

        // US0114: Paused shows hollow amber circle
        const statusLed = screen.getByRole('status');
        expect(statusLed).toHaveClass('border-amber-500');
        expect(statusLed).not.toHaveClass('bg-red-500');
      });

      it('paused and inactive shows inactive styling only (TC09)', () => {
        const inactivePausedServer: Server = {
          ...mockServer,
          is_paused: true,
          is_inactive: true,
        };
        render(<ServerCard server={inactivePausedServer} />);

        const card = screen.getByTestId('server-card');
        expect(card).toHaveClass('opacity-50');
        expect(card).toHaveClass('grayscale');
        expect(card).not.toHaveClass('ring-amber-500/50');

        expect(screen.queryByTestId('maintenance-wrench-icon')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Pause/Unpause toggle functionality tests (US0115)
   * Tests the handleTogglePause callback on the ServerCard
   */
  describe('Pause/Unpause toggle (US0115)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('calls pauseServer when toggle is clicked on non-paused server', async () => {
      mockPauseServer.mockResolvedValue({});
      const onPauseToggle = vi.fn();
      const onMessage = vi.fn();
      const normalServer: Server = {
        ...mockServer,
        is_paused: false,
      };
      render(
        <ServerCard
          server={normalServer}
          onPauseToggle={onPauseToggle}
          onMessage={onMessage}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(mockPauseServer).toHaveBeenCalledWith('test-server');
      });

      await waitFor(() => {
        expect(onPauseToggle).toHaveBeenCalled();
      });

      expect(onMessage).toHaveBeenCalledWith({
        type: 'success',
        text: 'Test Server paused',
      });
    });

    it('calls unpauseServer when toggle is clicked on paused server', async () => {
      mockUnpauseServer.mockResolvedValue({});
      const onPauseToggle = vi.fn();
      const onMessage = vi.fn();
      const pausedServer: Server = {
        ...mockServer,
        is_paused: true,
      };
      render(
        <ServerCard
          server={pausedServer}
          onPauseToggle={onPauseToggle}
          onMessage={onMessage}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(mockUnpauseServer).toHaveBeenCalledWith('test-server');
      });

      await waitFor(() => {
        expect(onPauseToggle).toHaveBeenCalled();
      });

      expect(onMessage).toHaveBeenCalledWith({
        type: 'success',
        text: 'Test Server resumed',
      });
    });

    it('uses hostname when display_name is null', async () => {
      mockPauseServer.mockResolvedValue({});
      const onPauseToggle = vi.fn();
      const onMessage = vi.fn();
      const serverWithoutDisplayName: Server = {
        ...mockServer,
        display_name: null,
        is_paused: false,
      };
      render(
        <ServerCard
          server={serverWithoutDisplayName}
          onPauseToggle={onPauseToggle}
          onMessage={onMessage}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith({
          type: 'success',
          text: 'test-server.local paused',
        });
      });
    });

    it('shows error message when pause fails', async () => {
      mockPauseServer.mockRejectedValue(new Error('Network error'));
      const onPauseToggle = vi.fn();
      const onMessage = vi.fn();
      const normalServer: Server = {
        ...mockServer,
        is_paused: false,
      };
      render(
        <ServerCard
          server={normalServer}
          onPauseToggle={onPauseToggle}
          onMessage={onMessage}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith({
          type: 'error',
          text: 'Network error',
        });
      });
    });

    it('shows default error message for non-Error exceptions', async () => {
      mockPauseServer.mockRejectedValue('Unknown failure');
      const onPauseToggle = vi.fn();
      const onMessage = vi.fn();
      const normalServer: Server = {
        ...mockServer,
        is_paused: false,
      };
      render(
        <ServerCard
          server={normalServer}
          onPauseToggle={onPauseToggle}
          onMessage={onMessage}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith({
          type: 'error',
          text: 'Failed to toggle pause state',
        });
      });
    });

    it('does not render toggle button when server is inactive', async () => {
      const onPauseToggle = vi.fn();
      const inactiveServer: Server = {
        ...mockServer,
        is_inactive: true,
        is_paused: false,
      };
      render(
        <ServerCard
          server={inactiveServer}
          onPauseToggle={onPauseToggle}
        />
      );

      // Toggle button should NOT render for inactive servers
      const toggleButton = screen.queryByTestId('toggle-pause-button');
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('prevents duplicate clicks while toggling', async () => {
      let resolvePromise: () => void;
      mockPauseServer.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );
      const onPauseToggle = vi.fn();

      const normalServer: Server = {
        ...mockServer,
        is_paused: false,
      };
      render(
        <ServerCard
          server={normalServer}
          onPauseToggle={onPauseToggle}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');

      // Click once
      fireEvent.click(toggleButton);

      // Try clicking again while first request is pending
      fireEvent.click(toggleButton);

      // Should only have called pauseServer once
      expect(mockPauseServer).toHaveBeenCalledTimes(1);

      // Resolve the promise to clean up
      resolvePromise!();
    });

    it('stops click propagation to prevent card navigation', async () => {
      mockPauseServer.mockResolvedValue({});
      const onClick = vi.fn();
      const onPauseToggle = vi.fn();
      const normalServer: Server = {
        ...mockServer,
        is_paused: false,
      };
      render(
        <ServerCard
          server={normalServer}
          onClick={onClick}
          onPauseToggle={onPauseToggle}
        />
      );

      const toggleButton = screen.getByTestId('toggle-pause-button');
      fireEvent.click(toggleButton);

      // The card onClick should NOT be called because stopPropagation is used
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  /**
   * Warning state tests (US0110)
   * Tests for servers with active alerts showing warning state
   */
  describe('Warning state (US0110)', () => {
    it('shows warning ring for server with active alerts', () => {
      const warningServer: Server = {
        ...mockServer,
        status: 'online',
        active_alert_count: 2,
        active_alert_summaries: ['High CPU', 'Low disk'],
      };
      render(<ServerCard server={warningServer} />);

      const card = screen.getByTestId('server-card');
      expect(card).toHaveClass('ring-2');
      expect(card).toHaveClass('ring-yellow-500/30');
    });

    it('does not show warning ring for server without alerts', () => {
      const normalServer: Server = {
        ...mockServer,
        status: 'online',
        active_alert_count: 0,
        active_alert_summaries: [],
      };
      render(<ServerCard server={normalServer} />);

      const card = screen.getByTestId('server-card');
      expect(card).not.toHaveClass('ring-yellow-500/30');
    });

    it('shows warning status tooltip with alert count', () => {
      const warningServer: Server = {
        ...mockServer,
        status: 'online',
        active_alert_count: 3,
        active_alert_summaries: ['Alert 1', 'Alert 2', 'Alert 3'],
      };
      render(<ServerCard server={warningServer} />);

      const statusLed = screen.getByRole('status');
      expect(statusLed).toHaveAttribute('title', 'Warning - 3 active alerts');
    });

    it('uses singular "alert" for one active alert', () => {
      const warningServer: Server = {
        ...mockServer,
        status: 'online',
        active_alert_count: 1,
        active_alert_summaries: ['High CPU'],
      };
      render(<ServerCard server={warningServer} />);

      const statusLed = screen.getByRole('status');
      expect(statusLed).toHaveAttribute('title', 'Warning - 1 active alert');
    });
  });
});
