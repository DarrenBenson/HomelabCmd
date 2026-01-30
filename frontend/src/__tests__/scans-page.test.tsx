/**
 * Tests for Scans page and dashboard integration.
 *
 * US0042: Scan Dashboard Integration
 * Test Spec: TS0018
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ScansPage } from '../pages/ScansPage';
import { Dashboard } from '../pages/Dashboard';
import { getScans } from '../api/scans';
import type { ScanListResponse, ScanListItem } from '../types/scan';

// Mock the API
vi.mock('../api/scans', () => ({
  getScans: vi.fn(),
  getScan: vi.fn(),
  listSSHKeys: vi.fn().mockResolvedValue({ keys: [] }),
}));

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../api/servers', () => ({
  getServers: vi.fn().mockResolvedValue({
    servers: [
      {
        id: 'server-1',
        hostname: 'server-1.local',
        display_name: 'Test Server',
        status: 'online',
        latest_metrics: { cpu_percent: 50, memory_percent: 60, disk_percent: 40, uptime_seconds: 86400 },
      },
    ],
    total: 1,
  }),
}));

vi.mock('../api/alerts', () => ({
  getAlerts: vi.fn().mockResolvedValue({ alerts: [], total: 0 }),
  getPendingBreaches: vi.fn().mockResolvedValue({ pending: [], total: 0 }),
}));

vi.mock('../api/actions', () => ({
  getActions: vi.fn().mockResolvedValue({ actions: [], total: 0 }),
}));

vi.mock('../api/costs', () => ({
  getCostSummary: vi.fn().mockResolvedValue({
    daily_cost: 0.50,
    monthly_cost: 15.00,
    yearly_cost: 180.00,
    currency: 'GBP',
    last_updated: new Date().toISOString(),
  }),
}));

// US0136: Mock the useDashboardPreferences hook
vi.mock('../hooks/useDashboardPreferences', () => ({
  useDashboardPreferences: vi.fn().mockReturnValue({
    preferences: {
      card_order: { servers: [], workstations: [] },
      collapsed_sections: [],
      view_mode: 'grid',
      updated_at: null,
    },
    isLoading: false,
    loadError: null,
    isSaving: false,
    showSavedIndicator: false,
    saveError: null,
    updateCardOrder: vi.fn(),
    updateCollapsedSections: vi.fn(),
    retrySave: vi.fn(),
    dismissSaveError: vi.fn(),
  }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderScansPage() {
  return render(
    <MemoryRouter initialEntries={['/scans']}>
      <Routes>
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/scans/history" element={<div data-testid="history-page">History</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scans" element={<ScansPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function createMockScan(overrides: Partial<ScanListItem> = {}): ScanListItem {
  return {
    scan_id: 1,
    hostname: '192.168.1.100',
    scan_type: 'quick',
    status: 'completed',
    started_at: '2026-01-21T10:00:00Z',
    completed_at: '2026-01-21T10:00:15Z',
    error: null,
    ...overrides,
  };
}

const mockScansResponse: ScanListResponse = {
  scans: [
    createMockScan({ scan_id: 1, hostname: '192.168.1.100', scan_type: 'quick', status: 'completed' }),
    createMockScan({ scan_id: 2, hostname: 'dazzbook', scan_type: 'full', status: 'completed' }),
    createMockScan({
      scan_id: 3,
      hostname: '192.168.1.105',
      scan_type: 'quick',
      status: 'failed',
      error: 'Connection refused',
    }),
    createMockScan({ scan_id: 4, hostname: 'nas-server', scan_type: 'full', status: 'completed' }),
    createMockScan({ scan_id: 5, hostname: 'pve-node1', scan_type: 'quick', status: 'completed' }),
  ],
  total: 5,
  limit: 5,
  offset: 0,
};

const emptyScansResponse: ScanListResponse = {
  scans: [],
  total: 0,
  limit: 5,
  offset: 0,
};

describe('ScansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    (getScans as Mock).mockResolvedValue(mockScansResponse);
  });

  describe('Manual scan form displayed (AC2)', () => {
    // TC0018-02: Manual scan form displayed
    it('renders hostname input field', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('hostname-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('hostname-input');
      expect(input).toHaveAttribute('placeholder', 'Hostname or IP address...');
    });
  });

  describe('Quick and Full scan buttons (AC3)', () => {
    // TC0018-03: Quick scan button available
    it('renders Quick Scan button that is disabled when hostname empty', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('quick-scan-button')).toBeInTheDocument();
      });

      const button = screen.getByTestId('quick-scan-button');
      expect(button).toBeDisabled();
    });

    it('enables Quick Scan button when hostname entered', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('hostname-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: '192.168.1.100' } });

      const button = screen.getByTestId('quick-scan-button');
      expect(button).not.toBeDisabled();
    });

    // TC0018-04: Full scan button available
    it('renders Full Scan button that is disabled when hostname empty', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('full-scan-button')).toBeInTheDocument();
      });

      const button = screen.getByTestId('full-scan-button');
      expect(button).toBeDisabled();
    });

    it('enables Full Scan button when hostname entered', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('hostname-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('hostname-input');
      fireEvent.change(input, { target: { value: '192.168.1.100' } });

      const button = screen.getByTestId('full-scan-button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Recent scans displayed (AC4)', () => {
    // TC0018-05: Recent scans widget shows last 5
    it('displays recent scans section', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('recent-scans')).toBeInTheDocument();
      });
    });

    it('fetches scans with limit=5', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(getScans).toHaveBeenCalledWith({ limit: 5 });
      });
    });

    it('displays scan hostnames in recent scans', async () => {
      renderScansPage();

      await waitFor(() => {
        expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
        expect(screen.getByText('dazzbook')).toBeInTheDocument();
      });
    });

    it('shows scan status indicators', async () => {
      renderScansPage();

      await waitFor(() => {
        // Look for completed and failed status indicators
        expect(screen.getAllByTestId(/scan-status-/).length).toBeGreaterThan(0);
      });
    });

    // TC0018-06: Recent scans empty state
    it('shows empty state when no scans exist', async () => {
      (getScans as Mock).mockResolvedValue(emptyScansResponse);

      renderScansPage();

      await waitFor(() => {
        expect(screen.getByTestId('recent-scans-empty')).toBeInTheDocument();
      });
    });
  });

  describe('View All link (AC5)', () => {
    // TC0018-07: View All link navigates to history
    it('has View All link to history page', async () => {
      renderScansPage();

      await waitFor(() => {
        const link = screen.getByText(/view all|view scan history/i);
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/scans/history');
      });
    });
  });
});

describe('Dashboard Navigation (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  // TC0018-01: Navigation link present in Dashboard
  it('has Scans link in dashboard header', async () => {
    renderDashboard();

    await waitFor(() => {
      const scansLink = screen.getByTestId('scans-link');
      expect(scansLink).toBeInTheDocument();
    });
  });

  it('Scans link has correct href', async () => {
    renderDashboard();

    await waitFor(() => {
      const scansLink = screen.getByTestId('scans-link');
      expect(scansLink.closest('a')).toHaveAttribute('href', '/scans');
    });
  });
});
