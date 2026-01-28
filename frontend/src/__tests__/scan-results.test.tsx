/**
 * Tests for Scan Results Display components.
 *
 * US0039: Scan Results Display
 * Test Spec: TS0015
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ScanStatusResponse, ScanResults } from '../types/scan';

// Components under test
import { UsageBar } from '../components/UsageBar';
import { ScanSystemInfo } from '../components/ScanSystemInfo';
import { ScanDiskUsage } from '../components/ScanDiskUsage';
import { ScanMemoryUsage } from '../components/ScanMemoryUsage';
import { ScanProcessList } from '../components/ScanProcessList';
import { ScanNetworkInterfaces } from '../components/ScanNetworkInterfaces';
import { ScanPackageList } from '../components/ScanPackageList';
import { ScanResultsPage } from '../pages/ScanResultsPage';

// Mock the API
vi.mock('../api/scans', () => ({
  getScan: vi.fn(),
}));

import { getScan } from '../api/scans';

// Test fixtures
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

// Helper to render page with router
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

describe('UsageBar Component', () => {
  // TC308: Usage Bar - Green Below 80%
  it('renders green for usage below 80%', () => {
    render(<UsageBar value={60} label="Test" />);
    const bar = screen.getByRole('meter');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    // Check the inner div has green class
    const innerBar = bar.querySelector('div');
    expect(innerBar).toHaveClass('bg-green-400');
  });

  // TC309: Usage Bar - Amber Between 80-90%
  it('renders amber for usage between 80-90%', () => {
    render(<UsageBar value={85} label="Test" />);
    const bar = screen.getByRole('meter');
    const innerBar = bar.querySelector('div');
    expect(innerBar).toHaveClass('bg-amber-400');
  });

  // TC310: Usage Bar - Red Above 90%
  it('renders red for usage above 90%', () => {
    render(<UsageBar value={95} label="Test" />);
    const bar = screen.getByRole('meter');
    const innerBar = bar.querySelector('div');
    expect(innerBar).toHaveClass('bg-red-400');
  });

  it('displays label and value', () => {
    render(<UsageBar value={50} label="Memory" displayValue="8 / 16 GB" />);
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('8 / 16 GB (50%)')).toBeInTheDocument();
  });

  it('clamps value to 0-100 range', () => {
    render(<UsageBar value={150} />);
    const bar = screen.getByRole('meter');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('ScanSystemInfo Component', () => {
  // TC301: Quick Scan - System Info Displayed
  it('displays all system information fields', () => {
    render(
      <ScanSystemInfo
        hostname="testserver"
        os={mockQuickScanResults.os}
        uptimeSeconds={345600}
      />
    );

    expect(screen.getByText('testserver')).toBeInTheDocument();
    expect(screen.getByText('Ubuntu 22.04.3 LTS')).toBeInTheDocument();
    expect(screen.getByText('5.15.0-91-generic')).toBeInTheDocument();
    expect(screen.getByText('4d 0h')).toBeInTheDocument();
  });

  it('handles null values gracefully', () => {
    render(<ScanSystemInfo hostname={null} os={null} uptimeSeconds={null} />);

    // Should show -- for missing values
    const dashElements = screen.getAllByText('--');
    expect(dashElements.length).toBeGreaterThan(0);
  });
});

describe('ScanDiskUsage Component', () => {
  // TC302: Quick Scan - Disk Usage Displayed
  it('displays all disk mounts with usage bars', () => {
    render(<ScanDiskUsage disks={mockQuickScanResults.disk} />);

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('/home')).toBeInTheDocument();
    // Check for formatted values
    expect(screen.getByText(/120\/500 GB/)).toBeInTheDocument();
  });

  it('handles empty disk array', () => {
    render(<ScanDiskUsage disks={[]} />);
    expect(screen.getByText('No disk information available')).toBeInTheDocument();
  });
});

describe('ScanMemoryUsage Component', () => {
  // TC303: Quick Scan - Memory Usage Displayed
  it('displays memory usage with progress bar', () => {
    render(<ScanMemoryUsage memory={mockQuickScanResults.memory} />);

    expect(screen.getByText('RAM')).toBeInTheDocument();
    expect(screen.getByText(/8\/16 GB/)).toBeInTheDocument();
    const bar = screen.getByRole('meter');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('handles null memory', () => {
    render(<ScanMemoryUsage memory={null} />);
    expect(screen.getByText('No memory information available')).toBeInTheDocument();
  });
});

describe('ScanProcessList Component', () => {
  // TC305: Full Scan - Process List Displayed
  it('displays process list with correct columns', () => {
    render(<ScanProcessList processes={mockFullScanResults.processes} defaultCollapsed={false} />);

    expect(screen.getByText('PID')).toBeInTheDocument();
    expect(screen.getByText('Command')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toBeInTheDocument();
  });

  // TC311: Process List - Sort By Memory (default)
  it('sorts processes by memory descending by default', () => {
    render(<ScanProcessList processes={mockFullScanResults.processes} defaultCollapsed={false} />);

    const rows = screen.getAllByRole('row');
    // First data row (after header) should be highest memory
    expect(rows[1]).toHaveTextContent('chrome');
    expect(rows[1]).toHaveTextContent('15.6%');
  });

  // TC312: Process List - Sort By CPU
  it('sorts by CPU when clicking CPU header', () => {
    render(<ScanProcessList processes={mockFullScanResults.processes} defaultCollapsed={false} />);

    const cpuHeader = screen.getByText('CPU');
    fireEvent.click(cpuHeader);

    const rows = screen.getAllByRole('row');
    // First data row should now be highest CPU (dockerd at 8.0%)
    expect(rows[1]).toHaveTextContent('dockerd');
  });

  // TC307: Full Scan - Sections Are Collapsible
  it('toggles collapsed state on click', () => {
    render(<ScanProcessList processes={mockFullScanResults.processes} defaultCollapsed={true} />);

    // Initially collapsed - no table visible
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Click to expand
    const header = screen.getByRole('button');
    fireEvent.click(header);

    // Table should now be visible
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  // TC317: Long Process List - Limited to 50
  it('limits process list to 50 entries', () => {
    const manyProcesses = Array.from({ length: 100 }, (_, i) => ({
      user: 'user',
      pid: i + 1,
      cpu_percent: Math.random() * 10,
      mem_percent: Math.random() * 20,
      command: `process-${i}`,
    }));

    render(<ScanProcessList processes={manyProcesses} defaultCollapsed={false} />);

    const rows = screen.getAllByRole('row');
    // 1 header row + 50 data rows
    expect(rows.length).toBe(51);
    expect(screen.getByText('Showing top 50')).toBeInTheDocument();
  });
});

describe('ScanNetworkInterfaces Component', () => {
  // TC306: Full Scan - Network Interfaces Displayed
  it('displays network interfaces with addresses', () => {
    render(
      <ScanNetworkInterfaces
        interfaces={mockFullScanResults.network_interfaces}
        defaultCollapsed={false}
      />
    );

    expect(screen.getByText('eth0')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100/24')).toBeInTheDocument();
    expect(screen.getByText('lo')).toBeInTheDocument();
  });

  it('shows interface state', () => {
    render(
      <ScanNetworkInterfaces
        interfaces={mockFullScanResults.network_interfaces}
        defaultCollapsed={false}
      />
    );

    expect(screen.getAllByText('UP').length).toBeGreaterThan(0);
  });
});

describe('ScanPackageList Component', () => {
  // TC304: Full Scan - Packages Section Displayed
  it('displays package count and list', () => {
    render(<ScanPackageList packages={mockFullScanResults.packages} defaultCollapsed={false} />);

    expect(screen.getByText(/Installed Packages.*1,234/)).toBeInTheDocument();
    expect(screen.getByText('python3')).toBeInTheDocument();
    expect(screen.getByText('nodejs')).toBeInTheDocument();
  });

  it('filters packages by search query', () => {
    render(<ScanPackageList packages={mockFullScanResults.packages} defaultCollapsed={false} />);

    const searchInput = screen.getByPlaceholderText('Search packages...');
    fireEvent.change(searchInput, { target: { value: 'python' } });

    expect(screen.getByText('python3')).toBeInTheDocument();
    expect(screen.queryByText('nodejs')).not.toBeInTheDocument();
  });

  // TC318: No Packages - Message Displayed
  it('shows not available message when packages is null', () => {
    render(<ScanPackageList packages={null} defaultCollapsed={false} />);
    expect(screen.getByText('Package list not available')).toBeInTheDocument();
  });
});

describe('ScanResultsPage', () => {
  const mockGetScan = getScan as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TC313: Navigation - Results Persist Via URL
  it('fetches scan by ID from URL params', async () => {
    mockGetScan.mockResolvedValue(mockCompletedQuickScan);

    renderPage('1');

    await waitFor(() => {
      expect(mockGetScan).toHaveBeenCalledWith(1);
    });

    // Hostname appears in heading "Scan: 192.168.1.100"
    expect(await screen.findByRole('heading', { name: /192\.168\.1\.100/ })).toBeInTheDocument();
  });

  // TC314: Navigation - Invalid Scan ID Shows Error
  it('shows not found for invalid scan ID', async () => {
    mockGetScan.mockRejectedValue({ status: 404, message: 'Not found' });

    // Mock ApiError behavior
    const { ApiError } = await import('../api/client');
    mockGetScan.mockRejectedValue(new ApiError(404, 'Scan not found'));

    renderPage('999');

    expect(await screen.findByText('Scan Not Found')).toBeInTheDocument();
  });

  // TC315: Failed Scan - Error Message Displayed
  it('displays error for failed scan', async () => {
    mockGetScan.mockResolvedValue(mockFailedScan);

    renderPage('3');

    expect(await screen.findByText('Scan Failed')).toBeInTheDocument();
    expect(screen.getByText('SSH connection refused')).toBeInTheDocument();
  });

  // TC319: Loading State - Spinner Displayed
  it('shows loading state initially', () => {
    mockGetScan.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderPage('1');

    expect(screen.getByText('Loading scan...')).toBeInTheDocument();
  });

  // TC320: Pending Scan - Progress Displayed
  it('displays progress for running scan', async () => {
    mockGetScan.mockResolvedValue(mockRunningScan);

    renderPage('4');

    expect(await screen.findByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Collecting disk info')).toBeInTheDocument();
  });

  // TC301-TC303: Quick scan results
  it('displays quick scan results correctly', async () => {
    mockGetScan.mockResolvedValue(mockCompletedQuickScan);

    renderPage('1');

    // Wait for content to load - check for badge and status
    await waitFor(() => {
      expect(screen.getByTestId('scan-type-badge')).toHaveTextContent('Quick Scan');
    });
    expect(screen.getByText('Completed')).toBeInTheDocument();

    // Quick scan info banner should be shown
    expect(screen.getByTestId('quick-scan-info')).toBeInTheDocument();

    // System info
    expect(screen.getByText('testserver')).toBeInTheDocument();
    expect(screen.getByText('Ubuntu 22.04.3 LTS')).toBeInTheDocument();

    // Disk usage
    expect(screen.getByText('/')).toBeInTheDocument();

    // Memory
    expect(screen.getByText('RAM')).toBeInTheDocument();

    // Quick scan placeholders should be shown
    expect(screen.getByTestId('quick-scan-placeholders')).toBeInTheDocument();
  });

  // TC304-TC306: Full scan results
  it('displays full scan results with additional sections', async () => {
    mockGetScan.mockResolvedValue(mockCompletedFullScan);

    renderPage('2');

    // Wait for content to load - check for badge and status
    await waitFor(() => {
      expect(screen.getByTestId('scan-type-badge')).toHaveTextContent('Full Scan');
    });
    expect(screen.getByText('Completed')).toBeInTheDocument();

    // Quick scan info banner should NOT be shown for full scans
    expect(screen.queryByTestId('quick-scan-info')).not.toBeInTheDocument();

    // Should have actual sections for full scan (not placeholders)
    expect(screen.getByText(/Running Processes/)).toBeInTheDocument();
    expect(screen.getByText(/Network Interfaces/)).toBeInTheDocument();
    expect(screen.getByText(/Installed Packages/)).toBeInTheDocument();

    // Quick scan placeholders should NOT be shown for full scans
    expect(screen.queryByTestId('quick-scan-placeholders')).not.toBeInTheDocument();
  });

  // TC316: Partial Results - Warning Displayed
  it('shows warning for partial results with errors', async () => {
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
    expect(screen.getByText('Failed to collect package list')).toBeInTheDocument();
  });

  // BG0005: Back button navigates to scans page
  it('navigates to scans page when back link is clicked', async () => {
    mockGetScan.mockResolvedValue(mockCompletedQuickScan);

    renderPage('1');

    // Wait for scan to load
    await waitFor(() => {
      expect(screen.getByTestId('scan-type-badge')).toBeInTheDocument();
    });

    // Find and click the back link
    const backLink = screen.getByRole('link', { name: /Back to Scans/i });
    expect(backLink).toHaveAttribute('href', '/scans');

    fireEvent.click(backLink);

    // Should navigate to scans page
    await waitFor(() => {
      expect(screen.getByTestId('scans-page')).toBeInTheDocument();
    });
  });

  it('not found page has back link to scans', async () => {
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
