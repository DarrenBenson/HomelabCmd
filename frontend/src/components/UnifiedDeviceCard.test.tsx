/**
 * Tests for UnifiedDeviceCard component.
 *
 * EP0016: Unified Discovery Experience (US0095)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedDeviceCard } from './UnifiedDeviceCard';
import type { UnifiedDevice } from '../types/discovery';

const createMockDevice = (overrides: Partial<UnifiedDevice> = {}): UnifiedDevice => ({
  id: 'device-1',
  hostname: 'test-server.local',
  ip: '192.168.1.100',
  os: 'linux',
  source: 'network',
  availability: 'available',
  isMonitored: false,
  serverId: null,
  sshKeyUsed: null,
  unavailableReason: null,
  responseTimeMs: 25,
  lastSeen: null,
  ...overrides,
});

function renderCard(device: UnifiedDevice, onImport = vi.fn()) {
  return render(
    <MemoryRouter>
      <UnifiedDeviceCard device={device} onImport={onImport} />
    </MemoryRouter>
  );
}

describe('UnifiedDeviceCard', () => {
  describe('basic rendering', () => {
    it('renders device hostname', () => {
      renderCard(createMockDevice());

      expect(screen.getByText('test-server.local')).toBeInTheDocument();
    });

    it('renders device IP address', () => {
      renderCard(createMockDevice());

      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    });

    it('renders OS type', () => {
      renderCard(createMockDevice({ os: 'linux' }));

      expect(screen.getByText('linux')).toBeInTheDocument();
    });

    it('has correct testid', () => {
      renderCard(createMockDevice({ id: 'test-device' }));

      expect(screen.getByTestId('device-card-test-device')).toBeInTheDocument();
    });
  });

  describe('availability states', () => {
    it('shows green indicator for available devices', () => {
      renderCard(createMockDevice({ availability: 'available' }));

      const indicator = screen.getByTitle('Available');
      expect(indicator).toBeInTheDocument();
    });

    it('shows grey indicator for unavailable devices', () => {
      renderCard(
        createMockDevice({
          availability: 'unavailable',
          unavailableReason: 'SSH connection failed',
        })
      );

      // There may be multiple elements with this title (indicator + card + reason text)
      const indicators = screen.getAllByTitle('SSH connection failed');
      expect(indicators.length).toBeGreaterThan(0);
    });

    it('shows unavailable reason when device is unavailable', () => {
      renderCard(
        createMockDevice({
          availability: 'unavailable',
          unavailableReason: 'No SSH access',
        })
      );

      expect(screen.getByText('No SSH access')).toBeInTheDocument();
    });

    it('applies opacity styling for unavailable devices', () => {
      renderCard(
        createMockDevice({
          availability: 'unavailable',
          unavailableReason: 'Offline',
        })
      );

      const card = screen.getByTestId('device-card-device-1');
      expect(card.className).toContain('opacity-50');
    });
  });

  describe('OS icons', () => {
    it('renders Server icon for linux', () => {
      renderCard(createMockDevice({ os: 'linux' }));
      expect(screen.getByText('linux')).toBeInTheDocument();
    });

    it('renders Monitor icon for windows', () => {
      renderCard(createMockDevice({ os: 'windows' }));
      expect(screen.getByText('windows')).toBeInTheDocument();
    });

    it('renders Monitor icon for macos', () => {
      renderCard(createMockDevice({ os: 'macos' }));
      expect(screen.getByText('macos')).toBeInTheDocument();
    });

    it('renders Smartphone icon for ios', () => {
      renderCard(createMockDevice({ os: 'ios' }));
      expect(screen.getByText('ios')).toBeInTheDocument();
    });

    it('renders Smartphone icon for android', () => {
      renderCard(createMockDevice({ os: 'android' }));
      expect(screen.getByText('android')).toBeInTheDocument();
    });

    it('renders Server icon for unknown OS', () => {
      renderCard(createMockDevice({ os: 'freebsd' }));
      expect(screen.getByText('freebsd')).toBeInTheDocument();
    });
  });

  describe('source indicators', () => {
    it('shows network source indicator', () => {
      renderCard(createMockDevice({ source: 'network' }));

      expect(screen.getByTitle('Network discovery')).toBeInTheDocument();
    });

    it('shows tailscale source indicator', () => {
      renderCard(createMockDevice({ source: 'tailscale' }));

      expect(screen.getByTitle('Tailscale')).toBeInTheDocument();
    });
  });

  describe('network device specific', () => {
    it('shows response time for network devices', () => {
      renderCard(createMockDevice({ source: 'network', responseTimeMs: 15 }));

      expect(screen.getByText('15ms')).toBeInTheDocument();
    });

    it('does not show response time when null', () => {
      renderCard(createMockDevice({ source: 'network', responseTimeMs: null }));

      expect(screen.queryByText(/ms$/)).not.toBeInTheDocument();
    });
  });

  describe('tailscale device specific', () => {
    it('shows last seen for tailscale devices', () => {
      const lastSeen = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      renderCard(createMockDevice({ source: 'tailscale', lastSeen }));

      // formatRelativeTime should show something like "5 minutes ago"
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it('does not show last seen when null', () => {
      renderCard(createMockDevice({ source: 'tailscale', lastSeen: null }));

      // Should not show the clock icon container with "ago" text
      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });
  });

  describe('SSH key indicator', () => {
    it('shows SSH key used when available', () => {
      renderCard(
        createMockDevice({
          availability: 'available',
          sshKeyUsed: 'default-key',
        })
      );

      expect(screen.getByText('default-key')).toBeInTheDocument();
    });

    it('does not show SSH key for unavailable devices', () => {
      renderCard(
        createMockDevice({
          availability: 'unavailable',
          sshKeyUsed: 'default-key',
        })
      );

      expect(screen.queryByText('default-key')).not.toBeInTheDocument();
    });
  });

  describe('monitored devices', () => {
    it('shows shield icon for monitored devices', () => {
      renderCard(createMockDevice({ isMonitored: true }));

      expect(screen.getByTitle('Already monitored')).toBeInTheDocument();
    });

    it('shows View button for monitored devices with serverId', () => {
      renderCard(createMockDevice({ isMonitored: true, serverId: 'server-123' }));

      expect(screen.getByText('View')).toBeInTheDocument();
    });

    it('View button links to server page', () => {
      renderCard(createMockDevice({ isMonitored: true, serverId: 'server-123' }));

      const viewLink = screen.getByText('View').closest('a');
      expect(viewLink).toHaveAttribute('href', '/servers/server-123');
    });
  });

  describe('import functionality', () => {
    it('shows Import button for available unmonitored devices', () => {
      renderCard(createMockDevice({ availability: 'available', isMonitored: false }));

      expect(screen.getByText('Import')).toBeInTheDocument();
    });

    it('calls onImport when Import button is clicked', () => {
      const onImport = vi.fn();
      const device = createMockDevice({ availability: 'available', isMonitored: false });
      renderCard(device, onImport);

      fireEvent.click(screen.getByText('Import'));

      expect(onImport).toHaveBeenCalledWith(device);
    });

    it('does not show Import button for unavailable devices', () => {
      renderCard(createMockDevice({ availability: 'unavailable' }));

      expect(screen.queryByText('Import')).not.toBeInTheDocument();
    });

    it('does not show Import button for monitored devices', () => {
      renderCard(createMockDevice({ availability: 'available', isMonitored: true }));

      expect(screen.queryByText('Import')).not.toBeInTheDocument();
    });
  });
});
