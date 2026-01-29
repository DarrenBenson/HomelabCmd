import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkIOWidget } from './NetworkIOWidget';
import type { MachineData, NetworkInterfaceMetric } from './types';

// Mock network interfaces data (US0179)
const mockInterfaces: NetworkInterfaceMetric[] = [
  {
    name: 'eth0',
    rx_bytes: 1073741824, // 1 GB
    tx_bytes: 536870912,  // 512 MB
    rx_packets: 1000000,
    tx_packets: 500000,
    is_up: true,
  },
  {
    name: 'tailscale0',
    rx_bytes: 10737418,   // ~10 MB
    tx_bytes: 5368709,    // ~5 MB
    rx_packets: 10000,
    tx_packets: 5000,
    is_up: true,
  },
  {
    name: 'docker0',
    rx_bytes: 0,
    tx_bytes: 0,
    rx_packets: 0,
    tx_packets: 0,
    is_up: false,
  },
];

const mockMachine: MachineData = {
  id: 'server-1',
  hostname: 'test-server',
  status: 'online',
  network_interfaces: mockInterfaces,
  latest_metrics: {
    network_rx_bytes: 1084479242, // Sum of all interfaces
    network_tx_bytes: 542239621,
    cpu_percent: 45,
    memory_percent: 65,
    disk_percent: 50,
  },
};

describe('NetworkIOWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Per-interface display (US0171 AC3)', () => {
    it('lists all network interfaces', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      expect(screen.getByTestId('interface-eth0')).toBeInTheDocument();
      expect(screen.getByTestId('interface-tailscale0')).toBeInTheDocument();
      expect(screen.getByTestId('interface-docker0')).toBeInTheDocument();
    });

    it('shows interface count and up status in summary', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      expect(screen.getByText('2/3 interfaces up')).toBeInTheDocument();
    });

    it('shows aggregate totals in summary', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      expect(screen.getByText(/Total:/)).toBeInTheDocument();
    });
  });

  describe('Interface status indicators (edge case #2)', () => {
    it('shows up icon for active interfaces', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      const eth0 = screen.getByTestId('interface-eth0');
      expect(eth0.querySelector('svg.text-status-success')).toBeInTheDocument();
    });

    it('shows down icon and styling for inactive interfaces', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      const docker0 = screen.getByTestId('interface-docker0');
      expect(docker0.querySelector('svg.text-status-warning')).toBeInTheDocument();
      expect(docker0).toHaveClass('bg-status-warning/5');
    });
  });

  describe('Sorting (AC3 extension)', () => {
    it('sorts by interface name by default', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      const list = screen.getByTestId('interface-list');
      const items = list.querySelectorAll('[data-testid^="interface-"]');

      // Should be in alphabetical order: docker0, eth0, tailscale0
      expect(items[0]).toHaveAttribute('data-testid', 'interface-docker0');
      expect(items[1]).toHaveAttribute('data-testid', 'interface-eth0');
      expect(items[2]).toHaveAttribute('data-testid', 'interface-tailscale0');
    });

    it('toggles sort direction when clicking name header', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      fireEvent.click(screen.getByTestId('sort-name'));

      const list = screen.getByTestId('interface-list');
      const items = list.querySelectorAll('[data-testid^="interface-"]');

      // Should be in reverse order: tailscale0, eth0, docker0
      expect(items[0]).toHaveAttribute('data-testid', 'interface-tailscale0');
      expect(items[2]).toHaveAttribute('data-testid', 'interface-docker0');
    });

    it('sorts by RX bytes when clicking RX header', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      fireEvent.click(screen.getByTestId('sort-rx_bytes'));

      const list = screen.getByTestId('interface-list');
      const items = list.querySelectorAll('[data-testid^="interface-"]');

      // Should be sorted by rx_bytes descending (eth0 highest)
      expect(items[0]).toHaveAttribute('data-testid', 'interface-eth0');
      expect(items[1]).toHaveAttribute('data-testid', 'interface-tailscale0');
      expect(items[2]).toHaveAttribute('data-testid', 'interface-docker0');
    });

    it('sorts by TX bytes when clicking TX header', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      fireEvent.click(screen.getByTestId('sort-tx_bytes'));

      const list = screen.getByTestId('interface-list');
      const items = list.querySelectorAll('[data-testid^="interface-"]');

      // Should be sorted by tx_bytes descending
      expect(items[0]).toHaveAttribute('data-testid', 'interface-eth0');
    });
  });

  describe('Expandable details (US0171 AC4)', () => {
    it('shows expand button for each interface', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      expect(screen.getByTestId('expand-eth0')).toBeInTheDocument();
      expect(screen.getByTestId('expand-tailscale0')).toBeInTheDocument();
    });

    it('expands interface to show details on click', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      // Initially details hidden
      expect(screen.queryByTestId('details-eth0')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByTestId('expand-eth0'));

      // Now details visible
      const details = screen.getByTestId('details-eth0');
      expect(details).toBeInTheDocument();
      expect(details).toHaveTextContent('Status:');
      expect(details).toHaveTextContent('Up');
      expect(details).toHaveTextContent('RX Packets:');
      expect(details).toHaveTextContent('1,000,000');
      expect(details).toHaveTextContent('TX Packets:');
      expect(details).toHaveTextContent('500,000');
    });

    it('shows down status in expanded details for inactive interface', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      fireEvent.click(screen.getByTestId('expand-docker0'));

      const details = screen.getByTestId('details-docker0');
      expect(details).toHaveTextContent('Down');
    });

    it('collapses details when clicked again', () => {
      render(<NetworkIOWidget machine={mockMachine} />);

      // Expand
      fireEvent.click(screen.getByTestId('expand-eth0'));
      expect(screen.getByTestId('details-eth0')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByTestId('expand-eth0'));
      expect(screen.queryByTestId('details-eth0')).not.toBeInTheDocument();
    });
  });

  describe('Fallback to aggregate metrics', () => {
    it('shows aggregate RX/TX when no interface data', () => {
      const aggregateOnlyMachine: MachineData = {
        ...mockMachine,
        network_interfaces: null,
      };

      render(<NetworkIOWidget machine={aggregateOnlyMachine} />);

      expect(screen.getByTestId('network-rx')).toHaveTextContent('1.01 GB');
      expect(screen.getByTestId('network-tx')).toHaveTextContent('517 MB');
    });

    it('shows "No network data available" when no data at all', () => {
      const noDataMachine: MachineData = {
        ...mockMachine,
        network_interfaces: null,
        latest_metrics: null,
      };

      render(<NetworkIOWidget machine={noDataMachine} />);

      expect(screen.getByTestId('no-data')).toHaveTextContent('No network data available');
    });
  });

  describe('Edge cases', () => {
    it('shows stale indicator when machine is offline', () => {
      const offlineMachine: MachineData = {
        ...mockMachine,
        status: 'offline',
      };

      render(<NetworkIOWidget machine={offlineMachine} />);

      expect(screen.getByTestId('stale-indicator')).toHaveTextContent('Last known value (offline)');
    });

    it('handles single interface correctly', () => {
      const singleIfaceMachine: MachineData = {
        ...mockMachine,
        network_interfaces: [mockInterfaces[0]],
      };

      render(<NetworkIOWidget machine={singleIfaceMachine} />);

      expect(screen.getByText('1/1 interface up')).toBeInTheDocument();
    });

    it('shows empty list when interfaces array is empty', () => {
      const emptyIfaceMachine: MachineData = {
        ...mockMachine,
        network_interfaces: [],
        latest_metrics: null,
      };

      render(<NetworkIOWidget machine={emptyIfaceMachine} />);

      expect(screen.getByTestId('no-data')).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    it('shows edit mode indicator when isEditMode is true', () => {
      render(<NetworkIOWidget machine={mockMachine} isEditMode={true} />);

      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });

    it('shows remove button in edit mode', () => {
      const onRemove = vi.fn();
      render(<NetworkIOWidget machine={mockMachine} isEditMode={true} onRemove={onRemove} />);

      const removeButton = screen.getByTitle('Remove widget');
      expect(removeButton).toBeInTheDocument();
    });
  });
});
