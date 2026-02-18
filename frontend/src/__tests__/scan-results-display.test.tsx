/**
 * TS0015: Scan Results Display Tests
 *
 * Comprehensive test coverage for the scan results display feature.
 * Covers TC301 through TC320 with edge cases and boundary conditions.
 *
 * US0039: Scan Results Display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type {
  ScanStatusResponse,
  ScanResults,
  ProcessInfo,
  NetworkInterface,
  PackageInfo,
} from '../types/scan';

// Components under test
import { UsageBar } from '../components/UsageBar';
import { ScanSystemInfo } from '../components/ScanSystemInfo';
import { ScanDiskUsage } from '../components/ScanDiskUsage';
import { ScanMemoryUsage } from '../components/ScanMemoryUsage';
import { ScanProcessList } from '../components/ScanProcessList';
import { ScanNetworkInterfaces } from '../components/ScanNetworkInterfaces';
import { ScanPackageList } from '../components/ScanPackageList';
import { ScanResultsPage } from '../pages/ScanResultsPage';

// Mock the API module before importing
vi.mock('../api/scans', () => ({
  getScan: vi.fn(),
}));

import { getScan } from '../api/scans';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockQuickScanResults: ScanResults = {
  os: {
    name: 'Ubuntu',
    version: '22.04',
    kernel: '5.15.0-91-generic',
    pretty_name: 'Ubuntu 22.04.3 LTS',
    id: 'ubuntu',
  },
  hostname: 'testserver',
  uptime_seconds: 345600, // 4 days
  disk: [
    { mount: '/', total_gb: 500, used_gb: 120, percent: 24 },
    { mount: '/home', total_gb: 500, used_gb: 180, percent: 36 },
  ],
  memory: { total_mb: 16384, used_mb: 8192, percent: 50 },
  packages: null,
  processes: [],
  network_interfaces: [],
  errors: null,
};

const mockFullScanResults: ScanResults = {
  ...mockQuickScanResults,
  packages: {
    count: 1234,
    recent: ['python3', 'nodejs', 'docker-ce', 'vim', 'git'],
  },
  processes: [
    { user: 'root', pid: 12345, cpu_percent: 5.2, mem_percent: 15.6, command: 'chrome' },
    { user: 'user', pid: 23456, cpu_percent: 3.1, mem_percent: 11.2, command: 'code' },
    { user: 'root', pid: 34567, cpu_percent: 8.0, mem_percent: 5.0, command: 'dockerd' },
  ],
  network_interfaces: [
    {
      name: 'eth0',
      state: 'up',
      addresses: [{ type: 'ipv4', address: '192.168.1.100/24' }],
    },
    {
      name: 'lo',
      state: 'up',
      addresses: [{ type: 'ipv4', address: '127.0.0.1/8' }],
    },
  ],
};

const mockCompletedQuickScan: ScanStatusResponse = {
  scan_id: 1,
  status: 'completed',
  hostname: '192.168.1.100',
  scan_type: 'quick',
  progress: 100,
  current_step: null,
  started_at: '2026-01-21T10:00:00Z',
  completed_at: '2026-01-21T10:00:15Z',
  results: mockQuickScanResults,
  error: null,
};

const mockCompletedFullScan: ScanStatusResponse = {
  ...mockCompletedQuickScan,
  scan_id: 2,
  scan_type: 'full',
  completed_at: '2026-01-21T10:00:45Z',
  results: mockFullScanResults,
};

const mockFailedScan: ScanStatusResponse = {
  scan_id: 3,
  status: 'failed',
  hostname: '192.168.1.200',
  scan_type: 'quick',
  progress: 10,
  current_step: null,
  started_at: '2026-01-21T10:00:00Z',
  completed_at: null,
  results: null,
  error: 'SSH connection refused',
};

const mockRunningScan: ScanStatusResponse = {
  scan_id: 4,
  status: 'running',
  hostname: '192.168.1.100',
  scan_type: 'full',
  progress: 45,
  current_step: 'Collecting disk info',
  started_at: '2026-01-21T10:00:00Z',
  completed_at: null,
  results: null,
  error: null,
};

const mockPendingScan: ScanStatusResponse = {
  scan_id: 5,
  status: 'pending',
  hostname: '192.168.1.100',
  scan_type: 'quick',
  progress: 0,
  current_step: null,
  started_at: '2026-01-21T10:00:00Z',
  completed_at: null,
  results: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage(scanId: string) {
  return render(
    <MemoryRouter initialEntries={[`/scans/${scanId}`]}>
      <Routes>
        <Route path="/scans" element={<div data-testid="scans-page">Scans Page</div>} />
        <Route path="/scans/:scanId" element={<ScanResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ===========================================================================
// TC308-TC310: Usage Bar Colour Thresholds
// ===========================================================================

describe('UsageBar Component (TC308-TC310)', () => {
  // TC308: Usage bar green below 80%
  describe('TC308: Green colour below 80%', () => {
    it('renders green at 0%', () => {
      render(<UsageBar value={0} label="Disk" />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-valuenow', '0');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-green-400');
    });

    it('renders green at 50%', () => {
      render(<UsageBar value={50} label="Disk" />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-valuenow', '50');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-green-400');
    });

    it('renders green at 79%', () => {
      render(<UsageBar value={79} />);
      const bar = screen.getByRole('meter');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-green-400');
    });
  });

  // TC309: Usage bar amber between 80-90%
  describe('TC309: Amber colour between 80-90%', () => {
    it('renders amber at exactly 80%', () => {
      render(<UsageBar value={80} />);
      const bar = screen.getByRole('meter');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-amber-400');
    });

    it('renders amber at 85%', () => {
      render(<UsageBar value={85} label="Memory" />);
      const bar = screen.getByRole('meter');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-amber-400');
    });

    it('renders amber at 89%', () => {
      render(<UsageBar value={89} />);
      const bar = screen.getByRole('meter');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-amber-400');
    });
  });

  // TC310: Usage bar red above 90%
  describe('TC310: Red colour above 90%', () => {
    it('renders red at exactly 90%', () => {
      render(<UsageBar value={90} />);
      const bar = screen.getByRole('meter');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-red-400');
    });

    it('renders red at 95%', () => {
      render(<UsageBar value={95} label="Disk" />);
      const bar = screen.getByRole('meter');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-red-400');
    });

    it('renders red at 100%', () => {
      render(<UsageBar value={100} />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-valuenow', '100');
      const innerBar = bar.querySelector('div');
      expect(innerBar).toHaveClass('bg-red-400');
    });
  });

  describe('Edge cases', () => {
    it('clamps values above 100 to 100', () => {
      render(<UsageBar value={150} />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-valuenow', '100');
    });

    it('clamps negative values to 0', () => {
      render(<UsageBar value={-10} />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-valuenow', '0');
    });

    it('displays label text', () => {
      render(<UsageBar value={50} label="Root Partition" />);
      expect(screen.getByText('Root Partition')).toBeInTheDocument();
    });

    it('displays formatted value with percentage', () => {
      render(<UsageBar value={50} label="Memory" displayValue="8 / 16 GB" />);
      expect(screen.getByText('8 / 16 GB (50%)')).toBeInTheDocument();
    });

    it('sets correct aria-label with label prop', () => {
      render(<UsageBar value={50} label="Disk" />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-label', 'Disk usage');
    });

    it('sets fallback aria-label without label prop', () => {
      render(<UsageBar value={50} />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-label', 'Usage');
    });

    it('sets aria-valuemin and aria-valuemax', () => {
      render(<UsageBar value={50} />);
      const bar = screen.getByRole('meter');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });
});

// ===========================================================================
// TC301: Quick Scan - System Info Displayed
// ===========================================================================

describe('ScanSystemInfo Component (TC301)', () => {
  it('displays hostname from scan results', () => {
    render(
      <ScanSystemInfo
        hostname="testserver"
        os={mockQuickScanResults.os}
        uptimeSeconds={345600}
      />
    );
    expect(screen.getByText('testserver')).toBeInTheDocument();
  });

  it('displays OS pretty_name', () => {
    render(
      <ScanSystemInfo
        hostname="testserver"
        os={mockQuickScanResults.os}
        uptimeSeconds={345600}
      />
    );
    expect(screen.getByText('Ubuntu 22.04.3 LTS')).toBeInTheDocument();
  });

  it('displays kernel version', () => {
    render(
      <ScanSystemInfo
        hostname="testserver"
        os={mockQuickScanResults.os}
        uptimeSeconds={345600}
      />
    );
    expect(screen.getByText('5.15.0-91-generic')).toBeInTheDocument();
  });

  it('displays formatted uptime', () => {
    render(
      <ScanSystemInfo
        hostname="testserver"
        os={mockQuickScanResults.os}
        uptimeSeconds={345600}
      />
    );
    // 345600 seconds = 4 days 0 hours
    expect(screen.getByText('4d 0h')).toBeInTheDocument();
  });

  it('shows dashes for null hostname', () => {
    render(<ScanSystemInfo hostname={null} os={mockQuickScanResults.os} uptimeSeconds={345600} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('shows dashes for null OS', () => {
    render(<ScanSystemInfo hostname="testserver" os={null} uptimeSeconds={345600} />);
    // OS field should show '--'
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows dashes for null uptime', () => {
    render(<ScanSystemInfo hostname="testserver" os={mockQuickScanResults.os} uptimeSeconds={null} />);
    // formatUptime(null) returns '--'
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to os.name when pretty_name is null', () => {
    const osWithoutPrettyName = { ...mockQuickScanResults.os!, pretty_name: null };
    render(
      <ScanSystemInfo hostname="testserver" os={osWithoutPrettyName} uptimeSeconds={345600} />
    );
    expect(screen.getByText('Ubuntu')).toBeInTheDocument();
  });

  it('hides kernel row when kernel is null', () => {
    const osWithoutKernel = { ...mockQuickScanResults.os!, kernel: null };
    render(
      <ScanSystemInfo hostname="testserver" os={osWithoutKernel} uptimeSeconds={345600} />
    );
    expect(screen.queryByText('Kernel')).not.toBeInTheDocument();
  });

  it('handles all null values gracefully', () => {
    render(<ScanSystemInfo hostname={null} os={null} uptimeSeconds={null} />);
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders System Information heading', () => {
    render(
      <ScanSystemInfo
        hostname="testserver"
        os={mockQuickScanResults.os}
        uptimeSeconds={345600}
      />
    );
    expect(screen.getByText('System Information')).toBeInTheDocument();
  });
});

// ===========================================================================
// TC302: Quick Scan - Disk Usage Displayed
// ===========================================================================

describe('ScanDiskUsage Component (TC302)', () => {
  it('displays all mount points', () => {
    render(<ScanDiskUsage disks={mockQuickScanResults.disk} />);
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('/home')).toBeInTheDocument();
  });

  it('renders a UsageBar (meter) for each disk', () => {
    render(<ScanDiskUsage disks={mockQuickScanResults.disk} />);
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(2);
  });

  it('displays formatted disk usage values', () => {
    render(<ScanDiskUsage disks={mockQuickScanResults.disk} />);
    // formatDiskCompact(120, 500) = "120/500 GB"
    expect(screen.getByText(/120\/500 GB/)).toBeInTheDocument();
    // formatDiskCompact(180, 500) = "180/500 GB"
    expect(screen.getByText(/180\/500 GB/)).toBeInTheDocument();
  });

  it('shows correct usage percentage on bars', () => {
    render(<ScanDiskUsage disks={mockQuickScanResults.disk} />);
    const meters = screen.getAllByRole('meter');
    expect(meters[0]).toHaveAttribute('aria-valuenow', '24');
    expect(meters[1]).toHaveAttribute('aria-valuenow', '36');
  });

  it('displays empty message for no disks', () => {
    render(<ScanDiskUsage disks={[]} />);
    expect(screen.getByText('No disk information available')).toBeInTheDocument();
  });

  it('renders Disk Usage heading', () => {
    render(<ScanDiskUsage disks={mockQuickScanResults.disk} />);
    expect(screen.getByText('Disk Usage')).toBeInTheDocument();
  });

  it('applies correct colour for high-usage disk', () => {
    const highUsageDisk = [{ mount: '/data', total_gb: 100, used_gb: 95, percent: 95 }];
    render(<ScanDiskUsage disks={highUsageDisk} />);
    const meter = screen.getByRole('meter');
    const innerBar = meter.querySelector('div');
    expect(innerBar).toHaveClass('bg-red-400');
  });
});

// ===========================================================================
// TC303: Quick Scan - Memory Usage Displayed
// ===========================================================================

describe('ScanMemoryUsage Component (TC303)', () => {
  it('displays RAM label', () => {
    render(<ScanMemoryUsage memory={mockQuickScanResults.memory} />);
    expect(screen.getByText('RAM')).toBeInTheDocument();
  });

  it('displays formatted memory usage', () => {
    render(<ScanMemoryUsage memory={mockQuickScanResults.memory} />);
    // formatMemoryCompact(8192, 16384) = "8/16 GB"
    expect(screen.getByText(/8\/16 GB/)).toBeInTheDocument();
  });

  it('renders meter with correct percentage', () => {
    render(<ScanMemoryUsage memory={mockQuickScanResults.memory} />);
    const bar = screen.getByRole('meter');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('displays green bar for 50% usage', () => {
    render(<ScanMemoryUsage memory={mockQuickScanResults.memory} />);
    const bar = screen.getByRole('meter');
    const innerBar = bar.querySelector('div');
    expect(innerBar).toHaveClass('bg-green-400');
  });

  it('displays amber bar for high memory usage', () => {
    const highMemory = { total_mb: 16384, used_mb: 14000, percent: 85 };
    render(<ScanMemoryUsage memory={highMemory} />);
    const bar = screen.getByRole('meter');
    const innerBar = bar.querySelector('div');
    expect(innerBar).toHaveClass('bg-amber-400');
  });

  it('shows not available message when memory is null', () => {
    render(<ScanMemoryUsage memory={null} />);
    expect(screen.getByText('No memory information available')).toBeInTheDocument();
  });

  it('renders Memory heading', () => {
    render(<ScanMemoryUsage memory={mockQuickScanResults.memory} />);
    expect(screen.getByText('Memory')).toBeInTheDocument();
  });
});

// ===========================================================================
// TC304: Full Scan - Packages Section Displayed
// TC318: No Packages - Message Displayed
// ===========================================================================

describe('ScanPackageList Component (TC304, TC318)', () => {
  const packages: PackageInfo = {
    count: 1234,
    recent: ['python3', 'nodejs', 'docker-ce', 'vim', 'git'],
  };

  // TC304: Full scan displays packages
  describe('TC304: Package list displayed', () => {
    it('displays package count in header', () => {
      render(<ScanPackageList packages={packages} defaultCollapsed={false} />);
      // count.toLocaleString() = "1,234"
      expect(screen.getByText(/Installed Packages.*1,234/)).toBeInTheDocument();
    });

    it('displays all recent package names', () => {
      render(<ScanPackageList packages={packages} defaultCollapsed={false} />);
      expect(screen.getByText('python3')).toBeInTheDocument();
      expect(screen.getByText('nodejs')).toBeInTheDocument();
      expect(screen.getByText('docker-ce')).toBeInTheDocument();
      expect(screen.getByText('vim')).toBeInTheDocument();
      expect(screen.getByText('git')).toBeInTheDocument();
    });

    it('provides a search input for filtering packages', () => {
      render(<ScanPackageList packages={packages} defaultCollapsed={false} />);
      expect(screen.getByPlaceholderText('Search packages...')).toBeInTheDocument();
    });

    it('filters packages by search query', () => {
      render(<ScanPackageList packages={packages} defaultCollapsed={false} />);
      const searchInput = screen.getByPlaceholderText('Search packages...');
      fireEvent.change(searchInput, { target: { value: 'python' } });

      expect(screen.getByText('python3')).toBeInTheDocument();
      expect(screen.queryByText('nodejs')).not.toBeInTheDocument();
      expect(screen.queryByText('docker-ce')).not.toBeInTheDocument();
    });

    it('shows no matching message when search has no results', () => {
      render(<ScanPackageList packages={packages} defaultCollapsed={false} />);
      const searchInput = screen.getByPlaceholderText('Search packages...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-package' } });

      expect(screen.getByText('No matching packages')).toBeInTheDocument();
    });

    it('is case-insensitive when filtering', () => {
      render(<ScanPackageList packages={packages} defaultCollapsed={false} />);
      const searchInput = screen.getByPlaceholderText('Search packages...');
      fireEvent.change(searchInput, { target: { value: 'PYTHON' } });

      expect(screen.getByText('python3')).toBeInTheDocument();
    });
  });

  // TC318: No packages - message displayed
  describe('TC318: Null packages message', () => {
    it('shows not available message when packages is null and expanded', () => {
      render(<ScanPackageList packages={null} defaultCollapsed={false} />);
      expect(screen.getByText('Package list not available')).toBeInTheDocument();
    });

    it('hides not available message when packages is null and collapsed', () => {
      render(<ScanPackageList packages={null} defaultCollapsed={true} />);
      expect(screen.queryByText('Package list not available')).not.toBeInTheDocument();
    });

    it('shows header even when packages is null', () => {
      render(<ScanPackageList packages={null} defaultCollapsed={false} />);
      expect(screen.getByText('Installed Packages')).toBeInTheDocument();
    });
  });

  describe('Empty recent packages', () => {
    it('shows no packages found when recent list is empty', () => {
      const emptyPackages: PackageInfo = { count: 0, recent: [] };
      render(<ScanPackageList packages={emptyPackages} defaultCollapsed={false} />);
      expect(screen.getByText('No packages found')).toBeInTheDocument();
    });
  });

  describe('Collapsible behaviour', () => {
    it('starts collapsed by default', () => {
      render(<ScanPackageList packages={packages} />);
      // Search input should not be visible when collapsed
      expect(screen.queryByPlaceholderText('Search packages...')).not.toBeInTheDocument();
    });

    it('expands when header button is clicked', () => {
      render(<ScanPackageList packages={packages} />);
      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByPlaceholderText('Search packages...')).toBeInTheDocument();
      expect(screen.getByText('python3')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// TC305: Full Scan - Process List Displayed
// TC307: Full Scan - Sections Are Collapsible
// TC311: Process List - Sort By Memory (default)
// TC312: Process List - Sort By CPU
// TC317: Long Process List - Limited to 50
// ===========================================================================

describe('ScanProcessList Component (TC305, TC307, TC311, TC312, TC317)', () => {
  const processes: ProcessInfo[] = [
    { user: 'root', pid: 12345, cpu_percent: 5.2, mem_percent: 15.6, command: 'chrome' },
    { user: 'user', pid: 23456, cpu_percent: 3.1, mem_percent: 11.2, command: 'code' },
    { user: 'root', pid: 34567, cpu_percent: 8.0, mem_percent: 5.0, command: 'dockerd' },
  ];

  // TC305: Full scan displays process list
  describe('TC305: Process list displayed', () => {
    it('displays column headers', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      expect(screen.getByText('PID')).toBeInTheDocument();
      expect(screen.getByText('Command')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('CPU')).toBeInTheDocument();
    });

    it('displays process count in header', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      expect(screen.getByText('Running Processes (3)')).toBeInTheDocument();
    });

    it('displays all process commands', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      expect(screen.getByText('chrome')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
      expect(screen.getByText('dockerd')).toBeInTheDocument();
    });

    it('displays process PIDs', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('23456')).toBeInTheDocument();
      expect(screen.getByText('34567')).toBeInTheDocument();
    });

    it('displays formatted percentage values', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      // mem_percent and cpu_percent formatted with toFixed(1)
      expect(screen.getByText('15.6%')).toBeInTheDocument();
      expect(screen.getByText('5.2%')).toBeInTheDocument();
    });

    it('shows empty message when no processes', () => {
      render(<ScanProcessList processes={[]} defaultCollapsed={false} />);
      expect(screen.getByText('No process information available')).toBeInTheDocument();
    });
  });

  // TC311: Process list sorted by memory (default)
  describe('TC311: Sort by memory descending by default', () => {
    it('places highest memory process first', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      const rows = screen.getAllByRole('row');
      // Row 0 is header, row 1 should be chrome (15.6%), row 2 code (11.2%), row 3 dockerd (5.0%)
      expect(rows[1]).toHaveTextContent('chrome');
      expect(rows[1]).toHaveTextContent('15.6%');
      expect(rows[2]).toHaveTextContent('code');
      expect(rows[3]).toHaveTextContent('dockerd');
    });
  });

  // TC312: Process list sorted by CPU
  describe('TC312: Sort by CPU on header click', () => {
    it('sorts by CPU descending when CPU header clicked', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);

      const cpuHeader = screen.getByText('CPU');
      fireEvent.click(cpuHeader);

      const rows = screen.getAllByRole('row');
      // Highest CPU is dockerd (8.0%), then chrome (5.2%), then code (3.1%)
      expect(rows[1]).toHaveTextContent('dockerd');
      expect(rows[1]).toHaveTextContent('8.0%');
      expect(rows[2]).toHaveTextContent('chrome');
      expect(rows[3]).toHaveTextContent('code');
    });

    it('toggles sort direction when clicking same header twice', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);

      // Default is memory desc. Click Memory to toggle to ascending.
      const memoryHeader = screen.getByText('Memory');
      fireEvent.click(memoryHeader);

      const rows = screen.getAllByRole('row');
      // Ascending: dockerd (5.0%), code (11.2%), chrome (15.6%)
      expect(rows[1]).toHaveTextContent('dockerd');
      expect(rows[2]).toHaveTextContent('code');
      expect(rows[3]).toHaveTextContent('chrome');
    });
  });

  // TC307: Sections are collapsible
  describe('TC307: Collapsible sections', () => {
    it('starts collapsed when defaultCollapsed is true', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={true} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('expands when collapse button is clicked', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={true} />);
      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('chrome')).toBeInTheDocument();
    });

    it('collapses when expanded section button is clicked', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      expect(screen.getByRole('table')).toBeInTheDocument();

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('sets aria-expanded attribute correctly', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // TC317: Long process list limited to 50
  describe('TC317: Process list limited to 50 entries', () => {
    it('limits display to 50 processes when more than 50 provided', () => {
      const manyProcesses: ProcessInfo[] = Array.from({ length: 100 }, (_, i) => ({
        user: 'user',
        pid: i + 1,
        cpu_percent: Math.random() * 10,
        mem_percent: Math.random() * 20,
        command: `process-${i}`,
      }));

      render(<ScanProcessList processes={manyProcesses} defaultCollapsed={false} />);

      const rows = screen.getAllByRole('row');
      // 1 header row + 50 data rows = 51
      expect(rows).toHaveLength(51);
    });

    it('shows "Showing top 50" indicator when processes exceed limit', () => {
      const manyProcesses: ProcessInfo[] = Array.from({ length: 100 }, (_, i) => ({
        user: 'user',
        pid: i + 1,
        cpu_percent: i * 0.1,
        mem_percent: i * 0.2,
        command: `process-${i}`,
      }));

      render(<ScanProcessList processes={manyProcesses} defaultCollapsed={false} />);
      expect(screen.getByText('Showing top 50')).toBeInTheDocument();
    });

    it('does not show limit indicator when processes are under 50', () => {
      render(<ScanProcessList processes={processes} defaultCollapsed={false} />);
      expect(screen.queryByText(/Showing top/)).not.toBeInTheDocument();
    });

    it('shows total process count in header regardless of limit', () => {
      const manyProcesses: ProcessInfo[] = Array.from({ length: 75 }, (_, i) => ({
        user: 'user',
        pid: i + 1,
        cpu_percent: i * 0.1,
        mem_percent: i * 0.2,
        command: `process-${i}`,
      }));

      render(<ScanProcessList processes={manyProcesses} defaultCollapsed={false} />);
      expect(screen.getByText('Running Processes (75)')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// TC306: Full Scan - Network Interfaces Displayed
// ===========================================================================

describe('ScanNetworkInterfaces Component (TC306)', () => {
  const interfaces: NetworkInterface[] = [
    {
      name: 'eth0',
      state: 'up',
      addresses: [
        { type: 'ipv4', address: '192.168.1.100/24' },
        { type: 'ipv6', address: 'fe80::1/64' },
      ],
    },
    {
      name: 'lo',
      state: 'up',
      addresses: [{ type: 'ipv4', address: '127.0.0.1/8' }],
    },
    {
      name: 'wlan0',
      state: 'down',
      addresses: [],
    },
  ];

  it('displays interface names', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={false} />);
    expect(screen.getByText('eth0')).toBeInTheDocument();
    expect(screen.getByText('lo')).toBeInTheDocument();
    expect(screen.getByText('wlan0')).toBeInTheDocument();
  });

  it('displays IP addresses', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={false} />);
    expect(screen.getByText('192.168.1.100/24')).toBeInTheDocument();
    expect(screen.getByText('fe80::1/64')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1/8')).toBeInTheDocument();
  });

  it('shows interface state in uppercase', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={false} />);
    const upStates = screen.getAllByText('UP');
    expect(upStates).toHaveLength(2); // eth0 and lo
    expect(screen.getByText('DOWN')).toBeInTheDocument();
  });

  it('displays interface count in header', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={false} />);
    expect(screen.getByText('Network Interfaces (3)')).toBeInTheDocument();
  });

  it('shows no addresses message for interface without addresses', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={false} />);
    expect(screen.getByText('No addresses assigned')).toBeInTheDocument();
  });

  it('shows empty message when interfaces array is empty', () => {
    render(<ScanNetworkInterfaces interfaces={[]} defaultCollapsed={false} />);
    expect(screen.getByText('No network interface information available')).toBeInTheDocument();
  });

  it('starts collapsed by default', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={true} />);
    expect(screen.queryByText('eth0')).not.toBeInTheDocument();
  });

  it('expands when button is clicked', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={true} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('eth0')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100/24')).toBeInTheDocument();
  });

  it('displays address types', () => {
    render(<ScanNetworkInterfaces interfaces={interfaces} defaultCollapsed={false} />);
    const ipv4Labels = screen.getAllByText('ipv4:');
    expect(ipv4Labels.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('ipv6:')).toBeInTheDocument();
  });
});

// ===========================================================================
// TC313-TC320: ScanResultsPage Integration Tests
// ===========================================================================

describe('ScanResultsPage (TC313-TC320)', () => {
  const mockGetScan = getScan as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TC313: Navigation - Results persist via URL
  describe('TC313: Navigation persistence via URL', () => {
    it('fetches scan by ID parsed from URL params', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(mockGetScan).toHaveBeenCalledWith(1);
      });
    });

    it('displays scan hostname in heading', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      const heading = await screen.findByRole('heading', { name: /192\.168\.1\.100/ });
      expect(heading).toBeInTheDocument();
    });

    it('shows scan type badge', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toHaveTextContent('Quick Scan');
      });
    });

    it('shows Completed status text', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('displays Back to Scans link with correct href', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toBeInTheDocument();
      });

      const backLink = screen.getByRole('link', { name: /Back to Scans/i });
      expect(backLink).toHaveAttribute('href', '/scans');
    });

    it('navigates to scans page when back link is clicked', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toBeInTheDocument();
      });

      const backLink = screen.getByRole('link', { name: /Back to Scans/i });
      fireEvent.click(backLink);

      await waitFor(() => {
        expect(screen.getByTestId('scans-page')).toBeInTheDocument();
      });
    });
  });

  // TC314: Navigation - Invalid scan ID shows error
  describe('TC314: Invalid scan ID error', () => {
    it('shows not found for 404 API response', async () => {
      const { ApiError } = await import('../api/client');
      mockGetScan.mockRejectedValue(new ApiError(404, 'Scan not found'));

      renderPage('999');

      expect(await screen.findByText('Scan Not Found')).toBeInTheDocument();
    });

    it('shows not found for non-numeric scan ID', async () => {
      renderPage('abc');

      expect(await screen.findByText('Scan Not Found')).toBeInTheDocument();
      // Should not call the API for non-numeric IDs
      expect(mockGetScan).not.toHaveBeenCalled();
    });

    it('not found page contains back link to scans', async () => {
      const { ApiError } = await import('../api/client');
      mockGetScan.mockRejectedValue(new ApiError(404, 'Scan not found'));

      renderPage('999');

      await waitFor(() => {
        expect(screen.getByText('Scan Not Found')).toBeInTheDocument();
      });

      const backLink = screen.getByRole('link', { name: /Back to Scans/i });
      expect(backLink).toHaveAttribute('href', '/scans');
    });
  });

  // TC315: Failed scan - Error message displayed
  describe('TC315: Failed scan error display', () => {
    it('displays Scan Failed heading', async () => {
      mockGetScan.mockResolvedValue(mockFailedScan);

      renderPage('3');

      expect(await screen.findByText('Scan Failed')).toBeInTheDocument();
    });

    it('displays the specific error message', async () => {
      mockGetScan.mockResolvedValue(mockFailedScan);

      renderPage('3');

      expect(await screen.findByText('SSH connection refused')).toBeInTheDocument();
    });

    it('shows scan hostname in heading for failed scans', async () => {
      mockGetScan.mockResolvedValue(mockFailedScan);

      renderPage('3');

      const heading = await screen.findByRole('heading', { name: /192\.168\.1\.200/ });
      expect(heading).toBeInTheDocument();
    });

    it('shows scan type for failed scans', async () => {
      mockGetScan.mockResolvedValue(mockFailedScan);

      renderPage('3');

      expect(await screen.findByText(/Quick Scan.*Failed/)).toBeInTheDocument();
    });
  });

  // TC316: Partial results - Warning displayed
  describe('TC316: Partial results warning', () => {
    it('shows warning banner when results contain errors', async () => {
      const scanWithErrors: ScanStatusResponse = {
        ...mockCompletedQuickScan,
        results: {
          ...mockQuickScanResults,
          errors: ['Failed to collect package list'],
        },
      };
      mockGetScan.mockResolvedValue(scanWithErrors);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByText('Some data unavailable')).toBeInTheDocument();
      });
    });

    it('lists each error message individually', async () => {
      const scanWithErrors: ScanStatusResponse = {
        ...mockCompletedQuickScan,
        results: {
          ...mockQuickScanResults,
          errors: [
            'Failed to collect package list',
            'Timeout collecting network info',
          ],
        },
      };
      mockGetScan.mockResolvedValue(scanWithErrors);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByText('Failed to collect package list')).toBeInTheDocument();
        expect(screen.getByText('Timeout collecting network info')).toBeInTheDocument();
      });
    });

    it('does not show warning when errors is null', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toBeInTheDocument();
      });

      expect(screen.queryByText('Some data unavailable')).not.toBeInTheDocument();
    });

    it('does not show warning when errors array is empty', async () => {
      const scanNoErrors: ScanStatusResponse = {
        ...mockCompletedQuickScan,
        results: {
          ...mockQuickScanResults,
          errors: [],
        },
      };
      mockGetScan.mockResolvedValue(scanNoErrors);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toBeInTheDocument();
      });

      expect(screen.queryByText('Some data unavailable')).not.toBeInTheDocument();
    });
  });

  // TC319: Loading state - Spinner displayed
  describe('TC319: Loading state', () => {
    it('shows loading text initially', () => {
      mockGetScan.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderPage('1');

      expect(screen.getByText('Loading scan...')).toBeInTheDocument();
    });

    it('shows spinner animation while loading', () => {
      mockGetScan.mockImplementation(() => new Promise(() => {}));

      const { container } = renderPage('1');

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('loading state disappears after data loads', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.queryByText('Loading scan...')).not.toBeInTheDocument();
      });
    });
  });

  // TC320: Pending scan - Progress displayed
  describe('TC320: Pending/running scan progress', () => {
    it('displays progress percentage for running scan', async () => {
      mockGetScan.mockResolvedValue(mockRunningScan);

      renderPage('4');

      expect(await screen.findByText('45%')).toBeInTheDocument();
    });

    it('displays current step description', async () => {
      mockGetScan.mockResolvedValue(mockRunningScan);

      renderPage('4');

      expect(await screen.findByText('Collecting disk info')).toBeInTheDocument();
    });

    it('shows In Progress status text', async () => {
      mockGetScan.mockResolvedValue(mockRunningScan);

      renderPage('4');

      expect(await screen.findByText(/In Progress/)).toBeInTheDocument();
    });

    it('displays scan hostname for running scan', async () => {
      mockGetScan.mockResolvedValue(mockRunningScan);

      renderPage('4');

      const heading = await screen.findByRole('heading', { name: /192\.168\.1\.100/ });
      expect(heading).toBeInTheDocument();
    });

    it('handles pending scan with 0% progress', async () => {
      mockGetScan.mockResolvedValue(mockPendingScan);

      renderPage('5');

      expect(await screen.findByText('0%')).toBeInTheDocument();
    });

    it('does not show current step when null', async () => {
      mockGetScan.mockResolvedValue(mockPendingScan);

      renderPage('5');

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });

      // current_step is null for pending scan, so no step description
      expect(screen.queryByText('Collecting')).not.toBeInTheDocument();
    });
  });

  // Quick vs Full scan display differences
  describe('Quick scan vs Full scan display', () => {
    it('shows quick scan info banner for quick scans', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('quick-scan-info')).toBeInTheDocument();
      });
    });

    it('shows quick scan placeholders for sections not available', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('quick-scan-placeholders')).toBeInTheDocument();
      });

      // Placeholder sections should mention "Full Scan Only"
      const fullScanBadges = screen.getAllByText('Full Scan Only');
      expect(fullScanBadges.length).toBe(3); // Processes, Network, Packages
    });

    it('does not show quick scan info banner for full scans', async () => {
      mockGetScan.mockResolvedValue(mockCompletedFullScan);

      renderPage('2');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toHaveTextContent('Full Scan');
      });

      expect(screen.queryByTestId('quick-scan-info')).not.toBeInTheDocument();
    });

    it('does not show quick scan placeholders for full scans', async () => {
      mockGetScan.mockResolvedValue(mockCompletedFullScan);

      renderPage('2');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('quick-scan-placeholders')).not.toBeInTheDocument();
    });

    it('displays Full Scan badge for full scan type', async () => {
      mockGetScan.mockResolvedValue(mockCompletedFullScan);

      renderPage('2');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toHaveTextContent('Full Scan');
      });
    });

    it('displays Quick Scan badge for quick scan type', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        expect(screen.getByTestId('scan-type-badge')).toHaveTextContent('Quick Scan');
      });
    });

    it('renders full scan sections: processes, network, packages', async () => {
      mockGetScan.mockResolvedValue(mockCompletedFullScan);

      renderPage('2');

      await waitFor(() => {
        expect(screen.getByText(/Running Processes/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Network Interfaces/)).toBeInTheDocument();
      expect(screen.getByText(/Installed Packages/)).toBeInTheDocument();
    });

    it('renders system info and memory for both scan types', async () => {
      mockGetScan.mockResolvedValue(mockCompletedQuickScan);

      renderPage('1');

      await waitFor(() => {
        // System info
        expect(screen.getByText('testserver')).toBeInTheDocument();
        // Memory
        expect(screen.getByText('RAM')).toBeInTheDocument();
        // Disk
        expect(screen.getByText('/')).toBeInTheDocument();
      });
    });
  });
});
