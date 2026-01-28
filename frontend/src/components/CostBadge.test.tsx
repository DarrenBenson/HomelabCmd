import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CostBadge } from './CostBadge';
import * as costsApi from '../api/costs';
import type { CostSummary } from '../types/cost';

/**
 * CostBadge component tests for US0035 (Dashboard Cost Summary Display).
 */

vi.mock('../api/costs');

const mockCostSummary: CostSummary = {
  daily_cost: 3.24,
  monthly_cost: 97.2,
  currency_symbol: '£',
  servers_included: 3,
  servers_missing_tdp: 1,
  total_tdp_watts: 135,
  electricity_rate: 0.24,
};

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<CostBadge />} />
        <Route path="/costs" element={<div data-testid="costs-page">Costs Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CostBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and display', () => {
    it('does not render while loading', async () => {
      vi.mocked(costsApi.getCostSummary).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithRouter();

      // Badge should not be visible while loading
      expect(screen.queryByTestId('cost-badge')).not.toBeInTheDocument();
    });

    it('renders cost badge after loading', async () => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue(mockCostSummary);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });
    });

    it('displays daily cost with currency symbol', async () => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue(mockCostSummary);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge-value')).toHaveTextContent('£3.24/day');
      });
    });

    it('does not render when no servers have TDP', async () => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue({
        ...mockCostSummary,
        servers_included: 0,
      });

      renderWithRouter();

      // Wait for API call to complete
      await waitFor(() => {
        expect(costsApi.getCostSummary).toHaveBeenCalled();
      });

      // Badge should not be visible
      expect(screen.queryByTestId('cost-badge')).not.toBeInTheDocument();
    });

    it('does not render on API error', async () => {
      vi.mocked(costsApi.getCostSummary).mockRejectedValue(new Error('API Error'));

      renderWithRouter();

      // Wait for API call to complete
      await waitFor(() => {
        expect(costsApi.getCostSummary).toHaveBeenCalled();
      });

      // Badge should not be visible
      expect(screen.queryByTestId('cost-badge')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue(mockCostSummary);
    });

    it('shows tooltip on hover', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.mouseEnter(screen.getByTestId('cost-badge'));

      expect(screen.getByTestId('cost-tooltip')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.mouseEnter(screen.getByTestId('cost-badge'));
      expect(screen.getByTestId('cost-tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(screen.getByTestId('cost-badge'));
      expect(screen.queryByTestId('cost-tooltip')).not.toBeInTheDocument();
    });

    it('displays daily cost in tooltip', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.mouseEnter(screen.getByTestId('cost-badge'));

      expect(screen.getByText('Daily:')).toBeInTheDocument();
      expect(screen.getByText('£3.24')).toBeInTheDocument();
    });

    it('displays monthly cost in tooltip', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.mouseEnter(screen.getByTestId('cost-badge'));

      expect(screen.getByText('Monthly:')).toBeInTheDocument();
      expect(screen.getByText('£97.20')).toBeInTheDocument();
    });

    it('displays server count in tooltip', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.mouseEnter(screen.getByTestId('cost-badge'));

      expect(screen.getByText('Based on 3 servers')).toBeInTheDocument();
    });

    it('displays unconfigured server warning', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.mouseEnter(screen.getByTestId('cost-badge'));

      expect(screen.getByText('1 server not configured')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue(mockCostSummary);
    });

    it('navigates to /costs on click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-badge'));

      await waitFor(() => {
        expect(screen.getByTestId('costs-page')).toBeInTheDocument();
      });
    });
  });

  describe('Currency formats', () => {
    it('displays dollar currency correctly', async () => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue({
        ...mockCostSummary,
        currency_symbol: '$',
        daily_cost: 1.44,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge-value')).toHaveTextContent('$1.44/day');
      });
    });

    it('displays euro currency correctly', async () => {
      vi.mocked(costsApi.getCostSummary).mockResolvedValue({
        ...mockCostSummary,
        currency_symbol: '€',
        daily_cost: 2.16,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-badge-value')).toHaveTextContent('€2.16/day');
      });
    });
  });
});
