import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PackageList } from './PackageList';
import { getServerPackages } from '../api/servers';
import { createAction } from '../api/actions';
import type { PackagesResponse } from '../types/server';

vi.mock('../api/servers', () => ({
  getServerPackages: vi.fn(),
}));

vi.mock('../api/actions', () => ({
  createAction: vi.fn(),
}));

const mockPackagesResponse: PackagesResponse = {
  server_id: 'test-server',
  last_checked: '2026-01-20T10:30:00Z',
  total_count: 5,
  security_count: 2,
  packages: [
    {
      name: 'openssl',
      current_version: '3.0.13',
      new_version: '3.0.14',
      repository: 'bookworm-security',
      is_security: true,
      detected_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-01-20T10:30:00Z',
    },
    {
      name: 'libssl3',
      current_version: '3.0.13',
      new_version: '3.0.14',
      repository: 'bookworm-security',
      is_security: true,
      detected_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-01-20T10:30:00Z',
    },
    {
      name: 'vim',
      current_version: '9.0.1378',
      new_version: '9.0.1499',
      repository: 'bookworm',
      is_security: false,
      detected_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-01-20T10:30:00Z',
    },
    {
      name: 'curl',
      current_version: '7.88.1',
      new_version: '7.88.2',
      repository: 'bookworm',
      is_security: false,
      detected_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-01-20T10:30:00Z',
    },
    {
      name: 'git',
      current_version: '2.39.2',
      new_version: '2.39.5',
      repository: 'bookworm',
      is_security: false,
      detected_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-01-20T10:30:00Z',
    },
  ],
};

const emptyPackagesResponse: PackagesResponse = {
  server_id: 'test-server',
  last_checked: '2026-01-20T10:30:00Z',
  total_count: 0,
  security_count: 0,
  packages: [],
};

/**
 * PackageList tests (US0051, US0052)
 * Spec Reference: sdlc-studio/stories/US0051-package-update-list.md
 * Spec Reference: sdlc-studio/stories/US0052-trigger-package-updates.md
 */
describe('PackageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      (getServerPackages as Mock).mockReturnValue(new Promise(() => {}));
      render(<PackageList serverId="test-server" />);

      // Panel should render with loading state inside
      expect(screen.getByTestId('package-list-panel')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message on API failure', async () => {
      (getServerPackages as Mock).mockRejectedValue(new Error('Network error'));
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-list-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('empty state (US0051 AC3)', () => {
    it('shows up to date message when no packages', async () => {
      (getServerPackages as Mock).mockResolvedValue(emptyPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('package-table')).toBeInTheDocument();
      });
    });

    it('displays package names', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('openssl')).toBeInTheDocument();
        expect(screen.getByText('vim')).toBeInTheDocument();
        expect(screen.getByText('curl')).toBeInTheDocument();
      });
    });

    it('displays version information', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        // Multiple packages can have the same version, so use getAllByText
        expect(screen.getAllByText('3.0.13').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('3.0.14').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays security badge for security packages', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        const securityLabels = screen.getAllByText('Security');
        expect(securityLabels.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('displays standard label for non-security packages', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        const standardLabels = screen.getAllByText('Standard');
        expect(standardLabels.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('header badges', () => {
    it('shows total count badge', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('5 available')).toBeInTheDocument();
      });
    });

    it('shows security count badge', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('2 security')).toBeInTheDocument();
      });
    });
  });

  describe('filter toggle (US0051 AC4)', () => {
    it('shows All and Security filter buttons', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-all')).toBeInTheDocument();
        expect(screen.getByTestId('filter-security')).toBeInTheDocument();
      });
    });

    it('displays package counts on filter buttons', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-all')).toHaveTextContent('All (5)');
        expect(screen.getByTestId('filter-security')).toHaveTextContent('Security (2)');
      });
    });

    it('filters to security only when clicked', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-security')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-security'));

      await waitFor(() => {
        expect(screen.getByText('openssl')).toBeInTheDocument();
        expect(screen.getByText('libssl3')).toBeInTheDocument();
        expect(screen.queryByText('vim')).not.toBeInTheDocument();
        expect(screen.queryByText('curl')).not.toBeInTheDocument();
      });
    });

    it('shows all packages when All filter clicked', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
        expect(screen.getByText('curl')).toBeInTheDocument();
      });
    });
  });

  describe('collapse/expand', () => {
    it('can collapse and expand the panel', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-list-button')).toBeInTheDocument();
        expect(screen.getByTestId('refresh-list-button')).toHaveTextContent('Refresh List');
      });
    });

    it('shows Apply All button with count', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-all-button')).toBeInTheDocument();
        expect(screen.getByTestId('apply-all-button')).toHaveTextContent('Apply All (5)');
      });
    });

    it('shows Apply Security button with count when security updates exist', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-security-button')).toBeInTheDocument();
        expect(screen.getByTestId('apply-security-button')).toHaveTextContent('Apply Security (2)');
      });
    });

    it('hides Apply Security button when no security updates', async () => {
      const noSecurityResponse: PackagesResponse = {
        ...mockPackagesResponse,
        security_count: 0,
        packages: mockPackagesResponse.packages.filter((p) => !p.is_security),
      };
      (getServerPackages as Mock).mockResolvedValue(noSecurityResponse);
      render(<PackageList serverId="test-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('apply-all-button')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('apply-security-button')).not.toBeInTheDocument();
    });
  });

  describe('action execution (US0052 AC1, AC2, AC3)', () => {
    it('calls createAction with apt_update when Refresh List clicked', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
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
    it('calls getServerPackages with serverId', async () => {
      (getServerPackages as Mock).mockResolvedValue(mockPackagesResponse);
      render(<PackageList serverId="my-server-id" />);

      await waitFor(() => {
        expect(getServerPackages).toHaveBeenCalledWith('my-server-id');
      });
    });
  });
});
