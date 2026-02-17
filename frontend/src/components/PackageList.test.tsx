import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PackageList } from './PackageList';
import { getPackageStatus } from '../api/servers';
import { createAction } from '../api/actions';
import type { PackageStatusResponse } from '../types/server';

vi.mock('../api/servers', () => ({
  getPackageStatus: vi.fn(),
}));

vi.mock('../api/actions', () => ({
  createAction: vi.fn(),
}));

// US0198: Updated mock response with held-back package support
const mockPackageStatusResponse: PackageStatusResponse = {
  server_id: 'test-server',
  last_checked: '2026-01-20T10:30:00Z',
  summary: {
    upgradable_count: 3,
    held_back_count: 2,
    security_count: 2,
  },
  packages: [
    {
      name: 'openssl',
      current_version: '3.0.13',
      candidate_version: '3.0.14',
      status: 'upgradable',
      hold_reason: null,
      phased_percentage: null,
      repository: 'bookworm-security',
      is_security: true,
    },
    {
      name: 'libssl3',
      current_version: '3.0.13',
      candidate_version: '3.0.14',
      status: 'upgradable',
      hold_reason: null,
      phased_percentage: null,
      repository: 'bookworm-security',
      is_security: true,
    },
    {
      name: 'vim',
      current_version: '9.0.1378',
      candidate_version: '9.0.1499',
      status: 'upgradable',
      hold_reason: null,
      phased_percentage: null,
      repository: 'bookworm',
      is_security: false,
    },
    {
      name: 'firefox',
      current_version: '120.0',
      candidate_version: '121.0',
      status: 'held_back',
      hold_reason: 'phased',
      phased_percentage: 45,
      repository: 'jammy-updates',
      is_security: false,
    },
    {
      name: 'linux-image-generic',
      current_version: '5.15.0-90',
      candidate_version: '5.15.0-91',
      status: 'held_back',
      hold_reason: 'manual',
      phased_percentage: null,
      repository: 'jammy-updates',
      is_security: false,
    },
  ],
};

const emptyPackageStatusResponse: PackageStatusResponse = {
  server_id: 'test-server',
  last_checked: '2026-01-20T10:30:00Z',
  summary: {
    upgradable_count: 0,
    held_back_count: 0,
    security_count: 0,
  },
  packages: [],
};

const allHeldBackResponse: PackageStatusResponse = {
  server_id: 'test-server',
  last_checked: '2026-01-20T10:30:00Z',
  summary: {
    upgradable_count: 0,
    held_back_count: 3,
    security_count: 0,
  },
  packages: [
    {
      name: 'firefox',
      current_version: '120.0',
      candidate_version: '121.0',
      status: 'held_back',
      hold_reason: 'phased',
      phased_percentage: 45,
      repository: 'jammy-updates',
      is_security: false,
    },
    {
      name: 'linux-image-generic',
      current_version: '5.15.0-90',
      candidate_version: '5.15.0-91',
      status: 'held_back',
      hold_reason: 'dependency',
      phased_percentage: null,
      repository: 'jammy-updates',
      is_security: false,
    },
    {
      name: 'nvidia-driver',
      current_version: '535.0',
      candidate_version: '545.0',
      status: 'held_back',
      hold_reason: 'manual',
      phased_percentage: null,
      repository: 'jammy',
      is_security: false,
    },
  ],
};

/**
 * PackageList tests (US0051, US0052, US0198)
 * Spec Reference: sdlc-studio/stories/US0051-package-update-list.md
 * Spec Reference: sdlc-studio/stories/US0052-trigger-package-updates.md
 * Spec Reference: sdlc-studio/stories/US0198-package-held-back-status-indicator.md
 */
describe('PackageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      (getPackageStatus as Mock).mockReturnValue(new Promise(() => {}));
      render(<PackageList serverId="test-server" />);

      // Panel should render with loading state inside
      expect(screen.getByTestId('package-list-panel')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message on API failure', async () => {
      (getPackageStatus as Mock).mockRejectedValue(new Error('Network error'));
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-list-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('empty state (US0051 AC3)', () => {
    it('shows up to date message when no packages', async () => {
      (getPackageStatus as Mock).mockResolvedValue(emptyPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-list-empty')).toBeInTheDocument();
      });

      expect(screen.getByText('System is up to date')).toBeInTheDocument();
      expect(screen.getByText('No packages need updating')).toBeInTheDocument();
    });
  });

  describe('package table display (US0051 AC3)', () => {
    it('renders package table after loading', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-table')).toBeInTheDocument();
      });
    });

    it('displays package names', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('openssl')).toBeInTheDocument();
        expect(screen.getByText('vim')).toBeInTheDocument();
        expect(screen.getByText('firefox')).toBeInTheDocument();
      });
    });

    it('displays version information', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        // Multiple packages can have the same version, so use getAllByText
        expect(screen.getAllByText('3.0.13').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('3.0.14').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('header badges (US0198 AC4)', () => {
    it('shows upgradable count badge', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('upgradable-badge')).toBeInTheDocument();
        expect(screen.getByText('3 will upgrade')).toBeInTheDocument();
      });
    });

    it('shows held back count badge', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('held-back-badge')).toBeInTheDocument();
        expect(screen.getByText('2 held back')).toBeInTheDocument();
      });
    });

    it('shows security count badge', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('security-badge')).toBeInTheDocument();
        expect(screen.getByText('2 security')).toBeInTheDocument();
      });
    });
  });

  describe('held-back package display (US0198 AC2)', () => {
    it('displays held-back packages with distinct visual style', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        const firefoxRow = screen.getByTestId('package-row-firefox');
        expect(firefoxRow).toHaveClass('bg-status-warning/5');
      });
    });

    it('shows held badge for held-back packages', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('held-badge-firefox')).toBeInTheDocument();
        expect(screen.getByText('Phased 45%')).toBeInTheDocument();
      });
    });

    it('shows ready badge for upgradable packages', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('upgradable-badge-openssl')).toBeInTheDocument();
        expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows manual hold reason', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('held-badge-linux-image-generic')).toBeInTheDocument();
        expect(screen.getByText('Manual Hold')).toBeInTheDocument();
      });
    });
  });

  describe('held-back tooltip (US0198 AC3)', () => {
    it('shows tooltip on hover with hold reason description', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('held-badge-firefox')).toBeInTheDocument();
      });

      // Hover over the badge
      fireEvent.mouseEnter(screen.getByTestId('held-badge-firefox'));

      await waitFor(() => {
        expect(screen.getByTestId('tooltip-firefox')).toBeInTheDocument();
        expect(screen.getByText(/Phased rollout \(45% deployed\)/)).toBeInTheDocument();
      });
    });

    it('hides tooltip on mouse leave', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('held-badge-firefox')).toBeInTheDocument();
      });

      // Hover then leave
      fireEvent.mouseEnter(screen.getByTestId('held-badge-firefox'));

      await waitFor(() => {
        expect(screen.getByTestId('tooltip-firefox')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(screen.getByTestId('held-badge-firefox'));

      await waitFor(() => {
        expect(screen.queryByTestId('tooltip-firefox')).not.toBeInTheDocument();
      });
    });
  });

  describe('all packages held back warning (US0198 edge case)', () => {
    it('shows warning when all packages are held back', async () => {
      (getPackageStatus as Mock).mockResolvedValue(allHeldBackResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('all-held-back-warning')).toBeInTheDocument();
        expect(
          screen.getByText(/All updates are currently held back/)
        ).toBeInTheDocument();
      });
    });

    it('disables Apply All button when no upgradable packages', async () => {
      (getPackageStatus as Mock).mockResolvedValue(allHeldBackResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        const applyAllButton = screen.getByTestId('apply-all-button');
        expect(applyAllButton).toBeDisabled();
        expect(applyAllButton).toHaveTextContent('Apply All (0)');
      });
    });
  });

  describe('filter toggle (US0051 AC4, US0198)', () => {
    it('shows All, Security, and Held Back filter buttons', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-all')).toBeInTheDocument();
        expect(screen.getByTestId('filter-security')).toBeInTheDocument();
        expect(screen.getByTestId('filter-held-back')).toBeInTheDocument();
      });
    });

    it('displays package counts on filter buttons', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-all')).toHaveTextContent('All (5)');
        expect(screen.getByTestId('filter-security')).toHaveTextContent('Security (2)');
        expect(screen.getByTestId('filter-held-back')).toHaveTextContent('Held Back (2)');
      });
    });

    it('filters to held back only when clicked', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-held-back')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-held-back'));

      await waitFor(() => {
        expect(screen.getByText('firefox')).toBeInTheDocument();
        expect(screen.getByText('linux-image-generic')).toBeInTheDocument();
        expect(screen.queryByText('openssl')).not.toBeInTheDocument();
        expect(screen.queryByText('vim')).not.toBeInTheDocument();
      });
    });

    it('filters to security only when clicked', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-security')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-security'));

      await waitFor(() => {
        expect(screen.getByText('openssl')).toBeInTheDocument();
        expect(screen.getByText('libssl3')).toBeInTheDocument();
        expect(screen.queryByText('vim')).not.toBeInTheDocument();
        expect(screen.queryByText('firefox')).not.toBeInTheDocument();
      });
    });

    it('shows all packages when All filter clicked', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-security')).toBeInTheDocument();
      });

      // First filter to security
      fireEvent.click(screen.getByTestId('filter-security'));

      await waitFor(() => {
        expect(screen.queryByText('vim')).not.toBeInTheDocument();
      });

      // Then click All
      fireEvent.click(screen.getByTestId('filter-all'));

      await waitFor(() => {
        expect(screen.getByText('vim')).toBeInTheDocument();
        expect(screen.getByText('firefox')).toBeInTheDocument();
      });
    });
  });

  describe('collapse/expand', () => {
    it('can collapse and expand the panel', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-table')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(screen.getByTestId('package-list-toggle'));

      expect(screen.queryByTestId('package-table')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByTestId('package-list-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('package-table')).toBeInTheDocument();
      });
    });
  });

  describe('action buttons (US0052)', () => {
    it('shows Refresh List button', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
        expect(screen.getByTestId('refresh-list-button')).toHaveTextContent('Refresh List');
      });
    });

    it('shows Apply All button with upgradable count (US0198 AC4)', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-all-button')).toBeInTheDocument();
        // Should show upgradable count, not total count
        expect(screen.getByTestId('apply-all-button')).toHaveTextContent('Apply All (3)');
      });
    });

    it('shows Apply Security button with count when security updates exist', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-security-button')).toBeInTheDocument();
        expect(screen.getByTestId('apply-security-button')).toHaveTextContent(
          'Apply Security (2)'
        );
      });
    });
  });

  describe('action execution (US0052 AC1, AC2, AC3)', () => {
    it('calls createAction with apt_update when Refresh List clicked', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockResolvedValue({ id: 1, status: 'pending' });
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-list-button'));

      await waitFor(() => {
        expect(createAction).toHaveBeenCalledWith({
          server_id: 'test-server',
          action_type: 'apt_update',
        });
      });
    });

    it('calls createAction with apt_upgrade_all when Apply All clicked', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockResolvedValue({ id: 2, status: 'pending' });
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-all-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-all-button'));

      await waitFor(() => {
        expect(createAction).toHaveBeenCalledWith({
          server_id: 'test-server',
          action_type: 'apt_upgrade_all',
        });
      });
    });

    it('calls createAction with apt_upgrade_security when Apply Security clicked', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockResolvedValue({ id: 3, status: 'pending' });
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-security-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-security-button'));

      await waitFor(() => {
        expect(createAction).toHaveBeenCalledWith({
          server_id: 'test-server',
          action_type: 'apt_upgrade_security',
        });
      });
    });
  });

  describe('action feedback (US0052 AC6)', () => {
    it('shows success message after action queued', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockResolvedValue({ id: 1, status: 'pending' });
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-list-button'));

      await waitFor(() => {
        expect(screen.getByTestId('action-success')).toBeInTheDocument();
        expect(screen.getByText('Refresh list action queued')).toBeInTheDocument();
      });
    });

    it('shows error message on action failure', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockRejectedValue(new Error('Server error'));
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-list-button'));

      await waitFor(() => {
        expect(screen.getByTestId('action-error')).toBeInTheDocument();
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('shows conflict error for duplicate action (409)', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockRejectedValue(new Error('409: Conflict'));
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-all-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-all-button'));

      await waitFor(() => {
        expect(screen.getByTestId('action-error')).toBeInTheDocument();
        expect(screen.getByText('An update action is already in progress')).toBeInTheDocument();
      });
    });

    it('disables all buttons while action is loading', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      (createAction as Mock).mockReturnValue(new Promise(() => {})); // Never resolves
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('refresh-list-button'));

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toHaveTextContent('Queuing...');
      });

      expect(screen.getByTestId('apply-all-button')).toBeDisabled();
      expect(screen.getByTestId('apply-security-button')).toBeDisabled();
    });
  });

  describe('API calls', () => {
    it('calls getPackageStatus with serverId', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="my-server-id" />);

      await waitFor(() => {
        expect(getPackageStatus).toHaveBeenCalledWith('my-server-id');
      });
    });
  });

  describe('readonly mode (BG0017)', () => {
    it('hides action buttons in readonly mode', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" agentMode="readonly" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-table')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('refresh-list-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('apply-all-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('apply-security-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('readonly-actions-notice')).toBeInTheDocument();
    });

    it('shows action buttons in readwrite mode', async () => {
      (getPackageStatus as Mock).mockResolvedValue(mockPackageStatusResponse);
      render(<PackageList serverId="test-server" agentMode="readwrite" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
        expect(screen.getByTestId('apply-all-button')).toBeInTheDocument();
      });
    });
  });
});
