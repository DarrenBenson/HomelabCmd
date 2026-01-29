import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiskWidget } from './DiskWidget';
import type { MachineData, FilesystemMetric } from './types';

// Mock filesystems data (US0178)
const mockFilesystems: FilesystemMetric[] = [
  {
    mount_point: '/',
    device: '/dev/sda1',
    fs_type: 'ext4',
    total_bytes: 107374182400, // 100 GB
    used_bytes: 53687091200, // 50 GB
    available_bytes: 53687091200,
    percent: 50,
  },
  {
    mount_point: '/data',
    device: '/dev/sdb1',
    fs_type: 'xfs',
    total_bytes: 4000000000000, // ~4 TB
    used_bytes: 3200000000000, // ~3.2 TB (80%)
    available_bytes: 800000000000,
    percent: 80,
  },
  {
    mount_point: '/home',
    device: '/dev/sda3',
    fs_type: 'ext4',
    total_bytes: 536870912000, // 500 GB
    used_bytes: 510027366400, // 475 GB (95%)
    available_bytes: 26843545600,
    percent: 95,
  },
];

const mockMachine: MachineData = {
  id: 'server-1',
  hostname: 'test-server',
  status: 'online',
  filesystems: mockFilesystems,
  latest_metrics: {
    disk_percent: 55,
    disk_used_gb: 220,
    disk_total_gb: 400,
    cpu_percent: 45,
    memory_percent: 65,
  },
};

describe('DiskWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Per-filesystem display (US0168 AC1, AC2)', () => {
    it('lists all mounted filesystems', () => {
      render(<DiskWidget machine={mockMachine} />);

      expect(screen.getByTestId('filesystem-/')).toBeInTheDocument();
      expect(screen.getByTestId('filesystem-/data')).toBeInTheDocument();
      expect(screen.getByTestId('filesystem-/home')).toBeInTheDocument();
    });

    it('shows filesystem count in summary', () => {
      render(<DiskWidget machine={mockMachine} />);

      expect(screen.getByText('3 filesystems')).toBeInTheDocument();
    });

    it('displays aggregate total in summary', () => {
      render(<DiskWidget machine={mockMachine} />);

      // Total: ~3.7 TB used / ~4.6 TB total
      expect(screen.getByText(/Total:/)).toBeInTheDocument();
    });

    it('shows progress bar with correct percentage', () => {
      render(<DiskWidget machine={mockMachine} />);

      const rootFs = screen.getByTestId('filesystem-/');
      const progressBar = rootFs.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('Colour-coded thresholds (US0168 AC3)', () => {
    it('applies green colour for disk under 70%', () => {
      render(<DiskWidget machine={mockMachine} />);

      // Root is at 50% - should be green
      const rootFs = screen.getByTestId('filesystem-/');
      const progressBar = rootFs.querySelector('[role="progressbar"] > div');
      expect(progressBar).toHaveClass('bg-status-success');
    });

    it('applies amber colour for disk between 70-90%', () => {
      render(<DiskWidget machine={mockMachine} />);

      // /data is at 80% - should be amber
      const dataFs = screen.getByTestId('filesystem-/data');
      const progressBar = dataFs.querySelector('[role="progressbar"] > div');
      expect(progressBar).toHaveClass('bg-status-warning');
    });

    it('applies red colour for disk over 90%', () => {
      render(<DiskWidget machine={mockMachine} />);

      // /home is at 95% - should be red
      const homeFs = screen.getByTestId('filesystem-/home');
      const progressBar = homeFs.querySelector('[role="progressbar"] > div');
      expect(progressBar).toHaveClass('bg-status-error');
    });

    it('highlights critical filesystems with background', () => {
      render(<DiskWidget machine={mockMachine} />);

      // /home at 95% should have error background
      const homeFs = screen.getByTestId('filesystem-/home');
      expect(homeFs).toHaveClass('bg-status-error/5');
    });
  });

  describe('Sorting (US0168 AC4)', () => {
    it('sorts by mount point by default', () => {
      render(<DiskWidget machine={mockMachine} />);

      const list = screen.getByTestId('filesystem-list');
      const items = list.querySelectorAll('[data-testid^="filesystem-"]');

      // Should be in alphabetical order: /, /data, /home
      expect(items[0]).toHaveAttribute('data-testid', 'filesystem-/');
      expect(items[1]).toHaveAttribute('data-testid', 'filesystem-/data');
      expect(items[2]).toHaveAttribute('data-testid', 'filesystem-/home');
    });

    it('toggles sort direction when clicking mount header', () => {
      render(<DiskWidget machine={mockMachine} />);

      // Click mount column header to reverse
      fireEvent.click(screen.getByTestId('sort-mount_point'));

      const list = screen.getByTestId('filesystem-list');
      const items = list.querySelectorAll('[data-testid^="filesystem-"]');

      // Should be in reverse order: /home, /data, /
      expect(items[0]).toHaveAttribute('data-testid', 'filesystem-/home');
      expect(items[2]).toHaveAttribute('data-testid', 'filesystem-/');
    });

    it('sorts by usage percentage when clicking usage header', () => {
      render(<DiskWidget machine={mockMachine} />);

      // Click usage column header
      fireEvent.click(screen.getByTestId('sort-percent'));

      const list = screen.getByTestId('filesystem-list');
      const items = list.querySelectorAll('[data-testid^="filesystem-"]');

      // Should be sorted by percent descending (95, 80, 50)
      expect(items[0]).toHaveAttribute('data-testid', 'filesystem-/home');
      expect(items[1]).toHaveAttribute('data-testid', 'filesystem-/data');
      expect(items[2]).toHaveAttribute('data-testid', 'filesystem-/');
    });
  });

  describe('Expandable details (US0168 AC5)', () => {
    it('shows expand button for each filesystem', () => {
      render(<DiskWidget machine={mockMachine} />);

      expect(screen.getByTestId('expand-/')).toBeInTheDocument();
      expect(screen.getByTestId('expand-/data')).toBeInTheDocument();
    });

    it('expands filesystem to show details on click', () => {
      render(<DiskWidget machine={mockMachine} />);

      // Initially details hidden
      expect(screen.queryByTestId('details-/')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByTestId('expand-/'));

      // Now details visible
      const details = screen.getByTestId('details-/');
      expect(details).toBeInTheDocument();
      expect(details).toHaveTextContent('/dev/sda1');
      expect(details).toHaveTextContent('ext4');
    });

    it('shows device, filesystem type, and available space in details', () => {
      render(<DiskWidget machine={mockMachine} />);

      fireEvent.click(screen.getByTestId('expand-/data'));

      const details = screen.getByTestId('details-/data');
      expect(details).toHaveTextContent('Device:');
      expect(details).toHaveTextContent('/dev/sdb1');
      expect(details).toHaveTextContent('Filesystem:');
      expect(details).toHaveTextContent('xfs');
      expect(details).toHaveTextContent('Available:');
    });

    it('collapses details when clicked again', () => {
      render(<DiskWidget machine={mockMachine} />);

      // Expand
      fireEvent.click(screen.getByTestId('expand-/'));
      expect(screen.getByTestId('details-/')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByTestId('expand-/'));
      expect(screen.queryByTestId('details-/')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('shows "No disk data available" when no filesystem data and no metrics', () => {
      const noDataMachine: MachineData = {
        ...mockMachine,
        filesystems: null,
        latest_metrics: null,
      };

      render(<DiskWidget machine={noDataMachine} />);

      expect(screen.getByTestId('no-data')).toHaveTextContent('No disk data available');
    });

    it('falls back to aggregate metrics when no filesystem data', () => {
      const aggregateOnlyMachine: MachineData = {
        ...mockMachine,
        filesystems: null,
      };

      render(<DiskWidget machine={aggregateOnlyMachine} />);

      // Should show aggregate progress bar
      expect(screen.getByTestId('disk-progress')).toBeInTheDocument();
      expect(screen.getByTestId('disk-value')).toHaveTextContent('55%');
      expect(screen.getByTestId('disk-used-total')).toHaveTextContent('220.0 GB / 400.0 GB');
    });

    it('shows stale indicator when machine is offline', () => {
      const offlineMachine: MachineData = {
        ...mockMachine,
        status: 'offline',
      };

      render(<DiskWidget machine={offlineMachine} />);

      expect(screen.getByTestId('stale-indicator')).toHaveTextContent('Last known value (offline)');
    });

    it('handles single filesystem correctly', () => {
      const singleFsMachine: MachineData = {
        ...mockMachine,
        filesystems: [mockFilesystems[0]],
      };

      render(<DiskWidget machine={singleFsMachine} />);

      expect(screen.getByText('1 filesystem')).toBeInTheDocument();
    });

    it('shows empty list when filesystems array is empty', () => {
      const emptyFsMachine: MachineData = {
        ...mockMachine,
        filesystems: [],
        latest_metrics: null,
      };

      render(<DiskWidget machine={emptyFsMachine} />);

      expect(screen.getByTestId('no-data')).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    it('shows edit mode indicator when isEditMode is true', () => {
      render(<DiskWidget machine={mockMachine} isEditMode={true} />);

      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });

    it('shows remove button in edit mode', () => {
      const onRemove = vi.fn();
      render(<DiskWidget machine={mockMachine} isEditMode={true} onRemove={onRemove} />);

      const removeButton = screen.getByTitle('Remove widget');
      expect(removeButton).toBeInTheDocument();
    });
  });
});
