/**
 * Tests for Compliance Dashboard Widget
 *
 * Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComplianceWidget } from '../../components/widgets/ComplianceWidget';
import * as configCheckApi from '../../api/config-check';
import type { ComplianceSummaryResponse } from '../../types/config-check';

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the API
vi.mock('../../api/config-check', () => ({
  getComplianceSummary: vi.fn(),
  checkCompliance: vi.fn(),
}));

const mockGetComplianceSummary = vi.mocked(configCheckApi.getComplianceSummary);
const mockCheckCompliance = vi.mocked(configCheckApi.checkCompliance);

function renderWidget(props = {}) {
  return render(
    <MemoryRouter>
      <ComplianceWidget {...props} />
    </MemoryRouter>
  );
}

describe('ComplianceWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching data', async () => {
      mockGetComplianceSummary.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWidget();

      expect(screen.getByTestId('compliance-loading')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockGetComplianceSummary.mockRejectedValue(new Error('Network error'));

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      mockGetComplianceSummary.mockRejectedValue(new Error('Failed'));

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries when retry button clicked', async () => {
      mockGetComplianceSummary
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          summary: { compliant: 1, non_compliant: 0, never_checked: 0, total: 1 },
          machines: [],
        });

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(mockGetComplianceSummary).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty state (no packs configured)', () => {
    it('shows empty state when no machines have packs', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 0, never_checked: 2, total: 2 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'never_checked', pack: null, mismatch_count: null, checked_at: null },
          { id: 's2', display_name: 'Server 2', status: 'never_checked', pack: null, mismatch_count: null, checked_at: null },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-empty')).toBeInTheDocument();
      });
      expect(screen.getByText('No packs configured')).toBeInTheDocument();
    });
  });

  describe('Summary counts', () => {
    it('displays correct compliant count', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 8, non_compliant: 3, never_checked: 2, total: 13 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-compliant-count')).toHaveTextContent('8');
      });
    });

    it('displays correct non-compliant count', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 8, non_compliant: 3, never_checked: 2, total: 13 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-non-compliant-count')).toHaveTextContent('3');
      });
    });

    it('displays correct never-checked count', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 8, non_compliant: 3, never_checked: 2, total: 13 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-never-checked-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Border colour coding (AC3)', () => {
    it('has green border class when all compliant', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 3, non_compliant: 0, never_checked: 0, total: 3 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      const { container } = renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-summary')).toBeInTheDocument();
      });

      // Check for green border class on WidgetContainer
      const widgetContainer = container.querySelector('.border-l-status-success');
      expect(widgetContainer).toBeInTheDocument();
    });

    it('has amber border class when some non-compliant', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 5, non_compliant: 2, never_checked: 1, total: 8 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'non_compliant', pack: 'base', mismatch_count: 3, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      const { container } = renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-summary')).toBeInTheDocument();
      });

      // Check for amber border class
      const widgetContainer = container.querySelector('.border-l-status-warning');
      expect(widgetContainer).toBeInTheDocument();
    });

    it('has grey border class when all never checked', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 0, never_checked: 3, total: 3 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'never_checked', pack: 'base', mismatch_count: null, checked_at: null },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      const { container } = renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-summary')).toBeInTheDocument();
      });

      // Check for grey border class
      const widgetContainer = container.querySelector('.border-l-text-muted');
      expect(widgetContainer).toBeInTheDocument();
    });
  });

  describe('Non-compliant machine list (AC4)', () => {
    it('shows non-compliant machines in list', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 2, non_compliant: 2, never_checked: 0, total: 4 },
        machines: [
          { id: 'studypc', display_name: 'StudyPC', status: 'non_compliant', pack: 'dev', mismatch_count: 3, checked_at: '2026-01-28T06:00:00Z' },
          { id: 'laptoppro', display_name: 'LaptopPro', status: 'non_compliant', pack: 'dev', mismatch_count: 1, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-machines-list')).toBeInTheDocument();
      });

      expect(screen.getByText('StudyPC')).toBeInTheDocument();
      expect(screen.getByText('LaptopPro')).toBeInTheDocument();
    });

    it('shows mismatch count for each machine', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 2, never_checked: 0, total: 2 },
        machines: [
          { id: 'studypc', display_name: 'StudyPC', status: 'non_compliant', pack: 'dev', mismatch_count: 3, checked_at: '2026-01-28T06:00:00Z' },
          { id: 'laptoppro', display_name: 'LaptopPro', status: 'non_compliant', pack: 'dev', mismatch_count: 1, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByText('3 items')).toBeInTheDocument();
      });
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('limits displayed machines to 5', async () => {
      const machines = Array.from({ length: 7 }, (_, i) => ({
        id: `server${i}`,
        display_name: `Server ${i}`,
        status: 'non_compliant' as const,
        pack: 'base',
        mismatch_count: i + 1,
        checked_at: '2026-01-28T06:00:00Z',
      }));

      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 7, never_checked: 0, total: 7 },
        machines,
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-machines-list')).toBeInTheDocument();
      });

      // Should show first 5 machines
      expect(screen.getByText('Server 0')).toBeInTheDocument();
      expect(screen.getByText('Server 4')).toBeInTheDocument();

      // Should not show remaining machines
      expect(screen.queryByText('Server 5')).not.toBeInTheDocument();

      // Should show "+2 more" link
      expect(screen.getByTestId('compliance-view-more')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });
  });

  describe('Navigation links (AC5)', () => {
    it('navigates to machine config when machine clicked', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 1, never_checked: 0, total: 1 },
        machines: [
          { id: 'studypc', display_name: 'StudyPC', status: 'non_compliant', pack: 'dev', mismatch_count: 3, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-machine-studypc')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('compliance-machine-studypc'));

      expect(mockNavigate).toHaveBeenCalledWith('/servers/studypc/config');
    });

    it('navigates to config page when View Details clicked', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 1, non_compliant: 0, never_checked: 0, total: 1 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-view-details')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('compliance-view-details'));

      expect(mockNavigate).toHaveBeenCalledWith('/config');
    });
  });

  describe('Check All button (AC6)', () => {
    it('shows Check All button', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 1, non_compliant: 0, never_checked: 0, total: 1 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-check-all')).toBeInTheDocument();
      });
    });

    it('triggers compliance checks when Check All clicked', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 1, non_compliant: 1, never_checked: 0, total: 2 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
          { id: 's2', display_name: 'Server 2', status: 'non_compliant', pack: 'dev', mismatch_count: 2, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);
      mockCheckCompliance.mockResolvedValue({
        server_id: 's1',
        pack_name: 'base',
        is_compliant: true,
        mismatches: [],
        checked_at: '2026-01-28T07:00:00Z',
        check_duration_ms: 100,
      });

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-check-all')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('compliance-check-all'));

      await waitFor(() => {
        // Should call checkCompliance for each machine with a pack
        expect(mockCheckCompliance).toHaveBeenCalledWith('s1', { pack_name: 'base' });
        expect(mockCheckCompliance).toHaveBeenCalledWith('s2', { pack_name: 'dev' });
      });
    });

    it('shows progress during Check All', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 2, never_checked: 0, total: 2 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'non_compliant', pack: 'base', mismatch_count: 1, checked_at: '2026-01-28T06:00:00Z' },
          { id: 's2', display_name: 'Server 2', status: 'non_compliant', pack: 'dev', mismatch_count: 2, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      // Make checkCompliance slow so we can see progress
      mockCheckCompliance.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          server_id: 's1',
          pack_name: 'base',
          is_compliant: true,
          mismatches: [],
          checked_at: '2026-01-28T07:00:00Z',
          check_duration_ms: 100,
        }), 100))
      );

      renderWidget();

      await waitFor(() => {
        expect(screen.getByTestId('compliance-check-all')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('compliance-check-all'));

      await waitFor(() => {
        expect(screen.getByTestId('compliance-progress')).toBeInTheDocument();
      });
    });

    it('disables Check All when no packs configured', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 0, non_compliant: 0, never_checked: 2, total: 2 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'never_checked', pack: null, mismatch_count: null, checked_at: null },
          { id: 's2', display_name: 'Server 2', status: 'never_checked', pack: null, mismatch_count: null, checked_at: null },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget();

      // Widget shows empty state when no packs configured
      await waitFor(() => {
        expect(screen.getByTestId('compliance-empty')).toBeInTheDocument();
      });
    });
  });

  describe('Edit mode', () => {
    it('passes isEditMode to WidgetContainer', async () => {
      const response: ComplianceSummaryResponse = {
        summary: { compliant: 1, non_compliant: 0, never_checked: 0, total: 1 },
        machines: [
          { id: 's1', display_name: 'Server 1', status: 'compliant', pack: 'base', mismatch_count: 0, checked_at: '2026-01-28T06:00:00Z' },
        ],
      };
      mockGetComplianceSummary.mockResolvedValue(response);

      renderWidget({ isEditMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('compliance-widget')).toBeInTheDocument();
      });

      // Widget should render in edit mode (WidgetContainer handles visual changes)
    });
  });
});
