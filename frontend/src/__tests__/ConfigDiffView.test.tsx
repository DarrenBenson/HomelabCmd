/**
 * Tests for Configuration Diff View page.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 * Test Spec: TS0182
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigDiffView } from '../pages/ConfigDiffView';
import { getConfigDiff, checkCompliance } from '../api/config-check';
import type { ConfigDiffResponse } from '../types/config-check';

// Mock the APIs
vi.mock('../api/config-check', () => ({
  getConfigDiff: vi.fn(),
  checkCompliance: vi.fn(),
}));

vi.mock('../api/config-apply', () => ({
  getApplyPreview: vi.fn(),
  applyConfigPack: vi.fn(),
  getApplyStatus: vi.fn(),
}));

import { getApplyPreview } from '../api/config-apply';
const mockGetApplyPreview = getApplyPreview as Mock;

const mockGetConfigDiff = getConfigDiff as Mock;
const mockCheckCompliance = checkCompliance as Mock;

const mockDiffResponseWithMismatches: ConfigDiffResponse = {
  server_id: 'test-server',
  pack_name: 'base',
  is_compliant: false,
  summary: {
    total_items: 3,
    compliant: 0,
    mismatched: 3,
  },
  mismatches: [
    {
      type: 'missing_file',
      category: 'files',
      item: '~/.bashrc.d/aliases.sh',
      expected: { exists: true, mode: '0644' },
      actual: { exists: false },
      diff: null,
    },
    {
      type: 'wrong_version',
      category: 'packages',
      item: 'curl',
      expected: { installed: true, min_version: '8.5.0' },
      actual: { installed: true, version: '8.2.0' },
      diff: null,
    },
    {
      type: 'wrong_content',
      category: 'files',
      item: '~/.config/ghostty/config',
      expected: { exists: true, hash: 'sha256:abc123' },
      actual: { exists: true, hash: 'sha256:def456' },
      diff: '--- expected\n+++ actual\n@@ -1,3 +1,3 @@\n font-size = 14\n-theme = catppuccin-mocha\n+theme = default',
    },
  ],
  checked_at: '2026-01-29T10:00:00Z',
};

const mockCompliantResponse: ConfigDiffResponse = {
  server_id: 'test-server',
  pack_name: 'base',
  is_compliant: true,
  summary: {
    total_items: 10,
    compliant: 10,
    mismatched: 0,
  },
  mismatches: [],
  checked_at: '2026-01-29T10:00:00Z',
};

function renderWithRouter(serverId = 'test-server', packName = 'base') {
  return render(
    <MemoryRouter initialEntries={[`/servers/${serverId}/config/diff?pack=${packName}`]}>
      <Routes>
        <Route path="/servers/:serverId/config/diff" element={<ConfigDiffView />} />
        <Route path="/servers/:serverId" element={<div>Server Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ConfigDiffView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching data', () => {
      mockGetConfigDiff.mockImplementation(() => new Promise(() => {}));
      renderWithRouter();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('shows error message when fetch fails', async () => {
      mockGetConfigDiff.mockRejectedValue(new Error('Network error'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows helpful message when no compliance check exists', async () => {
      mockGetConfigDiff.mockRejectedValue(new Error('404 Not Found'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('No compliance check found. Run a check first.')).toBeInTheDocument();
    });
  });

  describe('Non-compliant state', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
    });

    it('renders compliance summary with correct status', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-summary')).toBeInTheDocument();
      });
      expect(screen.getByTestId('compliance-status')).toHaveTextContent('Non-Compliant');
    });

    it('shows correct mismatch count', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-count')).toHaveTextContent('3');
      });
    });

    it('renders mismatch sections', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-sections')).toBeInTheDocument();
      });
    });

    it('renders Missing Files section with correct count', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-missing-files')).toBeInTheDocument();
      });

      const badge = screen.getAllByTestId('mismatch-count-badge')[0];
      expect(badge).toHaveTextContent('1');
    });

    it('renders Version Mismatches section with correct count', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-version-mismatches')).toBeInTheDocument();
      });
    });

    it('renders Content Differences section with correct count', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-content-differences')).toBeInTheDocument();
      });
    });

    it('shows Apply Pack button when non-compliant', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('apply-pack-button')).toBeInTheDocument();
      });
      // Button should be enabled (US0119 implemented)
      expect(screen.getByTestId('apply-pack-button')).toBeEnabled();
    });
  });

  describe('Compliant state', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockCompliantResponse);
    });

    it('renders compliant status', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-status')).toHaveTextContent('Compliant');
      });
    });

    it('shows compliant message instead of mismatch sections', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('compliant-message')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('mismatch-sections')).not.toBeInTheDocument();
    });

    it('does not show Apply Pack button when compliant', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('compliant-message')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('apply-pack-button')).not.toBeInTheDocument();
    });
  });

  describe('Collapsible sections', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
    });

    it('Missing Files section expands by default', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-missing-files')).toBeInTheDocument();
      });

      // First section should be expanded by default
      expect(screen.getByTestId('mismatch-item-~/.bashrc.d/aliases.sh')).toBeInTheDocument();
    });

    it('clicking section header toggles content visibility', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-missing-files')).toBeInTheDocument();
      });

      // Content should be visible initially
      expect(screen.getByTestId('mismatch-item-~/.bashrc.d/aliases.sh')).toBeInTheDocument();

      // Click to collapse
      const toggleButtons = screen.getAllByTestId('mismatch-section-toggle');
      fireEvent.click(toggleButtons[0]);

      // Content should be hidden
      expect(screen.queryByTestId('mismatch-item-~/.bashrc.d/aliases.sh')).not.toBeInTheDocument();

      // Click to expand again
      fireEvent.click(toggleButtons[0]);

      // Content should be visible again
      expect(screen.getByTestId('mismatch-item-~/.bashrc.d/aliases.sh')).toBeInTheDocument();
    });
  });

  describe('Check Again button', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
      mockCheckCompliance.mockResolvedValue({
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: true,
        mismatches: [],
        checked_at: '2026-01-29T11:00:00Z',
        check_duration_ms: 500,
      });
    });

    it('renders Check Again button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });
    });

    it('triggers new compliance check when clicked', async () => {
      mockGetConfigDiff
        .mockResolvedValueOnce(mockDiffResponseWithMismatches)
        .mockResolvedValueOnce(mockCompliantResponse);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('check-again-button'));

      await waitFor(() => {
        expect(mockCheckCompliance).toHaveBeenCalledWith('test-server', { pack_name: 'base' });
      });

      // After check, diff should be refetched
      await waitFor(() => {
        expect(mockGetConfigDiff).toHaveBeenCalledTimes(2);
      });
    });

    it('shows loading state while checking', async () => {
      mockCheckCompliance.mockImplementation(() => new Promise(() => {}));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('check-again-button'));

      await waitFor(() => {
        expect(screen.getByText('Checking...')).toBeInTheDocument();
      });
    });
  });

  describe('Diff block rendering', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
    });

    it('renders diff block for content mismatches', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-content-differences')).toBeInTheDocument();
      });

      // Expand the content differences section
      // Find the content differences toggle (third section)
      const contentSection = screen.getByTestId('mismatch-section-content-differences');
      const contentToggle = contentSection.querySelector('[data-testid="mismatch-section-toggle"]');
      if (contentToggle) {
        fireEvent.click(contentToggle);
      }

      await waitFor(() => {
        expect(screen.getByTestId('diff-block')).toBeInTheDocument();
      });
    });

    it('renders diff lines with correct styling', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-content-differences')).toBeInTheDocument();
      });

      // Expand the content differences section
      const contentSection = screen.getByTestId('mismatch-section-content-differences');
      const contentToggle = contentSection.querySelector('[data-testid="mismatch-section-toggle"]');
      if (contentToggle) {
        fireEvent.click(contentToggle);
      }

      await waitFor(() => {
        // Should have add and remove lines
        expect(screen.getByTestId('diff-line-remove')).toBeInTheDocument();
        expect(screen.getByTestId('diff-line-add')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
    });

    it('renders back button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('back button navigates to server detail', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      await waitFor(() => {
        expect(screen.getByText('Server Detail Page')).toBeInTheDocument();
      });
    });
  });

  describe('Mismatch type variations (AC coverage)', () => {
    it('renders wrong_permissions mismatch with expected/actual modes', async () => {
      const permissionsMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'wrong_permissions',
            category: 'files',
            item: '/etc/ssh/sshd_config',
            expected: { exists: true, mode: '0600' },
            actual: { exists: true, mode: '0644' },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(permissionsMismatch);
      renderWithRouter();

      // Wait for mismatch section to appear
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-permission-mismatches')).toBeInTheDocument();
      });

      // Expand the Permission Mismatches section (collapsed by default)
      const section = screen.getByTestId('mismatch-section-permission-mismatches');
      const toggle = section.querySelector('[data-testid="mismatch-section-toggle"]');
      fireEvent.click(toggle!);

      // Now the mismatch item should be visible
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-/etc/ssh/sshd_config')).toBeInTheDocument();
      });

      // Should show expected mode 0600, found 0644
      expect(screen.getByText(/Expected mode 0600, found 0644/)).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
    });

    it('renders missing_package mismatch correctly', async () => {
      const packageMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'missing_package',
            category: 'packages',
            item: 'htop',
            expected: { installed: true },
            actual: { installed: false },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(packageMismatch);
      renderWithRouter();

      // Wait for mismatch section to appear
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-missing-packages')).toBeInTheDocument();
      });

      // Expand the Missing Packages section (collapsed by default)
      const section = screen.getByTestId('mismatch-section-missing-packages');
      const toggle = section.querySelector('[data-testid="mismatch-section-toggle"]');
      fireEvent.click(toggle!);

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-htop')).toBeInTheDocument();
      });

      expect(screen.getByText('Package is not installed')).toBeInTheDocument();
      expect(screen.getByText('installed: true')).toBeInTheDocument();
      expect(screen.getByText('not installed')).toBeInTheDocument();
    });

    it('renders wrong_setting mismatch correctly', async () => {
      const settingMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'wrong_setting',
            category: 'settings',
            item: 'sshd.PermitRootLogin',
            expected: { value: 'no' },
            actual: { value: 'yes' },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(settingMismatch);
      renderWithRouter();

      // Wait for mismatch section to appear
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-setting-mismatches')).toBeInTheDocument();
      });

      // Expand the Setting Mismatches section (collapsed by default)
      const section = screen.getByTestId('mismatch-section-setting-mismatches');
      const toggle = section.querySelector('[data-testid="mismatch-section-toggle"]');
      fireEvent.click(toggle!);

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-sshd.PermitRootLogin')).toBeInTheDocument();
      });

      expect(screen.getByText(/Expected "no", found "yes"/)).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('renders unknown mismatch type with default label', async () => {
      // Unknown types still need to go into a known category (files, packages, settings)
      // They will be filtered based on type. Let's use a type that would appear in content differences
      const unknownMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'wrong_content', // Use known type to ensure section renders
            category: 'files',
            item: '/custom/check',
            expected: { custom: 'expected' },
            actual: { custom: 'actual' },
            diff: null, // No diff means expected/actual boxes are shown
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(unknownMismatch);
      renderWithRouter();

      // Wait for mismatch section to appear
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-content-differences')).toBeInTheDocument();
      });

      // Expand the Content Differences section
      const section = screen.getByTestId('mismatch-section-content-differences');
      const toggle = section.querySelector('[data-testid="mismatch-section-toggle"]');
      fireEvent.click(toggle!);

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-/custom/check')).toBeInTheDocument();
      });

      // wrong_content has "Content" label
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('File content differs from expected')).toBeInTheDocument();
    });

    it('handles missing mode in wrong_permissions mismatch', async () => {
      const permissionsMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'wrong_permissions',
            category: 'files',
            item: '/etc/config',
            expected: {},
            actual: {},
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(permissionsMismatch);
      renderWithRouter();

      // Wait for mismatch section to appear
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-permission-mismatches')).toBeInTheDocument();
      });

      // Expand the Permission Mismatches section
      const section = screen.getByTestId('mismatch-section-permission-mismatches');
      const toggle = section.querySelector('[data-testid="mismatch-section-toggle"]');
      fireEvent.click(toggle!);

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-/etc/config')).toBeInTheDocument();
      });

      // Should show 'unknown' for missing mode
      const unknowns = screen.getAllByText('unknown');
      expect(unknowns.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty value in wrong_setting mismatch', async () => {
      const settingMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'wrong_setting',
            category: 'settings',
            item: 'some.setting',
            expected: { value: 'expected_value' },
            actual: {},
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(settingMismatch);
      renderWithRouter();

      // Wait for mismatch section to appear
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-section-setting-mismatches')).toBeInTheDocument();
      });

      // Expand the Setting Mismatches section
      const section = screen.getByTestId('mismatch-section-setting-mismatches');
      const toggle = section.querySelector('[data-testid="mismatch-section-toggle"]');
      fireEvent.click(toggle!);

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-some.setting')).toBeInTheDocument();
      });

      // Should show '(empty)' for missing actual value
      expect(screen.getByText('(empty)')).toBeInTheDocument();
    });

    it('handles missing_file without mode in expected', async () => {
      const fileMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'missing_file',
            category: 'files',
            item: '/etc/myfile',
            expected: { exists: true },
            actual: { exists: false },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(fileMismatch);
      renderWithRouter();

      // Missing Files section is expanded by default
      await waitFor(() => {
        expect(screen.getByTestId('mismatch-item-/etc/myfile')).toBeInTheDocument();
      });

      // Should show 'exists: true' without mode
      expect(screen.getByText('exists: true')).toBeInTheDocument();
      expect(screen.getByText('not found')).toBeInTheDocument();
    });
  });

  describe('Check Again error handling', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
    });

    it('shows error when Check Again fails with Error', async () => {
      mockCheckCompliance.mockRejectedValue(new Error('SSH connection failed'));
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('check-again-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('SSH connection failed')).toBeInTheDocument();
    });

    it('shows generic error when Check Again fails with non-Error', async () => {
      mockCheckCompliance.mockRejectedValue('Unknown failure');
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('check-again-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Compliance check failed')).toBeInTheDocument();
    });

    it('disables Check Again button while checking', async () => {
      let resolveCheck: (value: unknown) => void;
      mockCheckCompliance.mockImplementation(
        () => new Promise((resolve) => { resolveCheck = resolve; })
      );
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('check-again-button'));

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeDisabled();
      });

      // Resolve to complete the test
      resolveCheck!({ is_compliant: true });
    });
  });

  describe('Fetch error edge cases', () => {
    it('shows generic error when fetch fails with non-Error', async () => {
      mockGetConfigDiff.mockRejectedValue('Network unavailable');
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to fetch configuration diff')).toBeInTheDocument();
    });
  });

  describe('Apply Pack modal (US0119)', () => {
    beforeEach(() => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
      // Mock the apply preview API for the modal
      mockGetApplyPreview.mockResolvedValue({
        files: [{ path: '/etc/config', mode: '0644' }],
        packages: [{ package: 'htop', version: '3.0' }],
        settings: [{ key: 'some.setting', value: 'value' }],
      });
    });

    it('opens Apply Pack modal when button is clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('apply-pack-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-pack-button'));

      await waitFor(() => {
        expect(screen.getByTestId('apply-pack-modal')).toBeInTheDocument();
      });
    });

    it('closes Apply Pack modal when cancelled', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('apply-pack-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-pack-button'));

      // Wait for modal to open and preview to load
      await waitFor(() => {
        expect(screen.getByTestId('apply-pack-modal')).toBeInTheDocument();
      });

      // Wait for the preview content to load (Cancel button appears in preview state)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      // Find and click cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('apply-pack-modal')).not.toBeInTheDocument();
      });
    });

    it('shows preview content with files, packages, and settings', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('apply-pack-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('apply-pack-button'));

      // Wait for preview to load
      await waitFor(() => {
        expect(screen.getByText('Files to create/update')).toBeInTheDocument();
      });

      expect(screen.getByText('Packages to install')).toBeInTheDocument();
      expect(screen.getByText('Settings to change')).toBeInTheDocument();
      expect(screen.getByText('/etc/config')).toBeInTheDocument();
      expect(screen.getByText('htop')).toBeInTheDocument();
    });
  });

  describe('Different pack names', () => {
    it('displays custom pack name from query params', async () => {
      mockGetConfigDiff.mockResolvedValue({
        ...mockCompliantResponse,
        pack_name: 'security-hardened',
      });
      renderWithRouter('my-server', 'security-hardened');

      await waitFor(() => {
        expect(screen.getByText(/Pack: security-hardened/)).toBeInTheDocument();
      });
    });

    it('defaults to base pack when no pack param', async () => {
      mockGetConfigDiff.mockResolvedValue(mockCompliantResponse);

      render(
        <MemoryRouter initialEntries={['/servers/test-server/config/diff']}>
          <Routes>
            <Route path="/servers/:serverId/config/diff" element={<ConfigDiffView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockGetConfigDiff).toHaveBeenCalledWith('test-server', 'base');
      });
      expect(screen.getByText(/Pack: base/)).toBeInTheDocument();
    });

    it('calls checkCompliance with custom pack name', async () => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
      mockCheckCompliance.mockResolvedValue({ is_compliant: true });

      renderWithRouter('test-server', 'custom-pack');

      await waitFor(() => {
        expect(screen.getByTestId('check-again-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('check-again-button'));

      await waitFor(() => {
        expect(mockCheckCompliance).toHaveBeenCalledWith('test-server', { pack_name: 'custom-pack' });
      });
    });
  });

  describe('Singular/plural mismatch count', () => {
    it('shows "mismatch" for single item', async () => {
      const singleMismatch: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'missing_file',
            category: 'files',
            item: '/etc/single',
            expected: { exists: true },
            actual: { exists: false },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(singleMismatch);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('mismatch')).toBeInTheDocument();
      });
    });

    it('shows "mismatches" for multiple items', async () => {
      mockGetConfigDiff.mockResolvedValue(mockDiffResponseWithMismatches);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('mismatches')).toBeInTheDocument();
      });
    });
  });

  describe('Header information', () => {
    it('displays server ID in header', async () => {
      mockGetConfigDiff.mockResolvedValue(mockCompliantResponse);
      renderWithRouter('production-server', 'base');

      await waitFor(() => {
        expect(screen.getByText(/production-server/)).toBeInTheDocument();
      });
    });

    it('displays last checked timestamp', async () => {
      mockGetConfigDiff.mockResolvedValue(mockCompliantResponse);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty mismatch sections', () => {
    it('hides sections with zero items (MismatchSection returns null for count 0)', async () => {
      // All mismatches are of one type - missing_file
      const onlyMissingFiles: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 1, compliant: 0, mismatched: 1 },
        mismatches: [
          {
            type: 'missing_file',
            category: 'files',
            item: '/etc/file1',
            expected: { exists: true },
            actual: { exists: false },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(onlyMissingFiles);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-sections')).toBeInTheDocument();
      });

      // Missing Files section should exist (has 1 item)
      expect(screen.getByTestId('mismatch-section-missing-files')).toBeInTheDocument();

      // Permission section should NOT exist (0 items - MismatchSection returns null)
      expect(screen.queryByTestId('mismatch-section-permission-mismatches')).not.toBeInTheDocument();

      // Content Differences section should NOT exist (0 items)
      expect(screen.queryByTestId('mismatch-section-content-differences')).not.toBeInTheDocument();

      // Missing Packages section should NOT exist (0 items)
      expect(screen.queryByTestId('mismatch-section-missing-packages')).not.toBeInTheDocument();
    });

    it('renders multiple sections when multiple mismatch types exist', async () => {
      const mixedMismatches: ConfigDiffResponse = {
        server_id: 'test-server',
        pack_name: 'base',
        is_compliant: false,
        summary: { total_items: 3, compliant: 0, mismatched: 3 },
        mismatches: [
          {
            type: 'missing_file',
            category: 'files',
            item: '/etc/file1',
            expected: { exists: true },
            actual: { exists: false },
            diff: null,
          },
          {
            type: 'wrong_permissions',
            category: 'files',
            item: '/etc/file2',
            expected: { mode: '0600' },
            actual: { mode: '0644' },
            diff: null,
          },
          {
            type: 'missing_package',
            category: 'packages',
            item: 'nginx',
            expected: { installed: true },
            actual: { installed: false },
            diff: null,
          },
        ],
        checked_at: '2026-01-29T10:00:00Z',
      };
      mockGetConfigDiff.mockResolvedValue(mixedMismatches);
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('mismatch-sections')).toBeInTheDocument();
      });

      // All three sections should be rendered
      expect(screen.getByTestId('mismatch-section-missing-files')).toBeInTheDocument();
      expect(screen.getByTestId('mismatch-section-permission-mismatches')).toBeInTheDocument();
      expect(screen.getByTestId('mismatch-section-missing-packages')).toBeInTheDocument();
    });
  });
});
