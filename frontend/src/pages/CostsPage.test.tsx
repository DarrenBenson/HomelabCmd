import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CostsPage } from './CostsPage';
import * as costsApi from '../api/costs';
import * as serversApi from '../api/servers';
import type { CostBreakdown } from '../types/cost';

/**
 * CostsPage tests for US0036 (Cost Breakdown View).
 */

vi.mock('../api/costs');
vi.mock('../api/servers');

const mockCostBreakdown: CostBreakdown = {
  servers: [
    {
      server_id: 'server-1',
      hostname: 'web-server',
      machine_category: 'office_desktop',
      machine_category_label: 'Office Desktop',
      machine_category_source: 'auto',
      cpu_model: 'Intel Core i5-8250U',
      idle_watts: 40,
      tdp_watts: 65,
      estimated_watts: 53.8,
      avg_cpu_percent: 23.0,
      daily_cost: 0.37,
      monthly_cost: 11.23,
    },
    {
      server_id: 'server-2',
      hostname: 'db-server',
      machine_category: 'workstation',
      machine_category_label: 'Workstation',
      machine_category_source: 'user',
      cpu_model: 'AMD Ryzen 9 5900X',
      idle_watts: 100,
      tdp_watts: 125,
      estimated_watts: 112.5,
      avg_cpu_percent: 50.0,
      daily_cost: 0.72,
      monthly_cost: 21.6,
    },
    {
      server_id: 'server-3',
      hostname: 'pi-node',
      machine_category: null,
      machine_category_label: null,
      machine_category_source: null,
      cpu_model: null,
      idle_watts: null,
      tdp_watts: null,
      estimated_watts: null,
      avg_cpu_percent: null,
      daily_cost: null,
      monthly_cost: null,
    },
  ],
  totals: {
    servers_configured: 2,
    servers_unconfigured: 1,
    total_estimated_watts: 166.3,
    daily_cost: 1.09,
    monthly_cost: 32.83,
    // Deprecated fields for backwards compatibility
    servers_with_tdp: 2,
    servers_without_tdp: 1,
    total_tdp_watts: 190,
  },
  settings: {
    electricity_rate: 0.24,
    currency_symbol: '£',
  },
};

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/costs']}>
      <Routes>
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/settings" element={<div data-testid="settings-page">Settings</div>} />
        <Route path="/servers/:serverId" element={<div data-testid="server-detail">Server Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CostsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('displays loading spinner initially', () => {
      vi.mocked(costsApi.getCostBreakdown).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithRouter();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('displays error message on fetch failure', async () => {
      vi.mocked(costsApi.getCostBreakdown).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('displays back button on error', async () => {
      vi.mocked(costsApi.getCostBreakdown).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });

  describe('Cost table display', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostBreakdown).mockResolvedValue(mockCostBreakdown);
    });

    it('displays page header', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Electricity Costs')).toBeInTheDocument();
      });
    });

    it('displays rate info', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Rate: £0.24/kWh')).toBeInTheDocument();
      });
    });

    it('displays total estimated power', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Total Est\. Power: 166\.3W/)).toBeInTheDocument();
      });
    });

    it('displays cost table', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-table')).toBeInTheDocument();
      });
    });

    it('displays configured servers in table', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-row-server-1')).toBeInTheDocument();
        expect(screen.getByTestId('cost-row-server-2')).toBeInTheDocument();
      });
    });

    it('displays server hostnames', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('web-server')).toBeInTheDocument();
        expect(screen.getByText('db-server')).toBeInTheDocument();
      });
    });

    it('displays estimated power values', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('53.8W')).toBeInTheDocument();
        expect(screen.getByText('112.5W')).toBeInTheDocument();
      });
    });

    it('displays daily costs', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('£0.37')).toBeInTheDocument();
        expect(screen.getByText('£0.72')).toBeInTheDocument();
      });
    });

    it('displays total row', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-total-row')).toBeInTheDocument();
      });
    });

    it('displays total daily cost', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('£1.09')).toBeInTheDocument();
      });
    });

    it('displays total monthly cost', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('£32.83')).toBeInTheDocument();
      });
    });
  });

  describe('Unconfigured servers', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostBreakdown).mockResolvedValue(mockCostBreakdown);
    });

    it('displays unconfigured servers section', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('unconfigured-servers')).toBeInTheDocument();
      });
    });

    it('displays unconfigured server with Configure button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('configure-server-3')).toBeInTheDocument();
      });
    });

    it('shows unconfigured server hostname', async () => {
      renderWithRouter();

      await waitFor(() => {
        const button = screen.getByTestId('configure-server-3');
        expect(button).toHaveTextContent('pi-node');
      });
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostBreakdown).mockResolvedValue(mockCostBreakdown);
    });

    it('displays sort buttons', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-hostname')).toBeInTheDocument();
        expect(screen.getByTestId('sort-category')).toBeInTheDocument();
        expect(screen.getByTestId('sort-estimated_watts')).toBeInTheDocument();
        expect(screen.getByTestId('sort-daily_cost')).toBeInTheDocument();
      });
    });

    it('changes sort direction on click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-daily_cost')).toBeInTheDocument();
      });

      // Default sort is daily_cost desc, clicking toggles to asc
      fireEvent.click(screen.getByTestId('sort-daily_cost'));

      // Verify the sort direction changed (visual indicator)
      const sortButton = screen.getByTestId('sort-daily_cost');
      expect(sortButton.querySelector('.text-status-info')).toBeInTheDocument();
    });

    it('sorts by monthly_cost when clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-monthly_cost')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-monthly_cost'));

      // Verify monthly_cost sort button is active
      const sortButton = screen.getByTestId('sort-monthly_cost');
      expect(sortButton.querySelector('.text-status-info')).toBeInTheDocument();
    });

    it('sorts by hostname when clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-hostname')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-hostname'));

      // Verify hostname sort button is active
      const sortButton = screen.getByTestId('sort-hostname');
      expect(sortButton.querySelector('.text-status-info')).toBeInTheDocument();
    });

    it('sorts by category when clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-category')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-category'));

      // Verify category sort button is active
      const sortButton = screen.getByTestId('sort-category');
      expect(sortButton.querySelector('.text-status-info')).toBeInTheDocument();
    });

    it('sorts by avg_cpu when clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-avg_cpu')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-avg_cpu'));

      // Verify avg_cpu sort button is active
      const sortButton = screen.getByTestId('sort-avg_cpu');
      expect(sortButton.querySelector('.text-status-info')).toBeInTheDocument();
    });

    it('sorts by estimated_watts when clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sort-estimated_watts')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-estimated_watts'));

      // Verify estimated_watts sort button is active
      const sortButton = screen.getByTestId('sort-estimated_watts');
      expect(sortButton.querySelector('.text-status-info')).toBeInTheDocument();
    });
  });

  describe('Power Edit Modal', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostBreakdown).mockResolvedValue(mockCostBreakdown);
      vi.mocked(serversApi.updateServer).mockResolvedValue({
        id: 'server-3',
        hostname: 'pi-node',
        display_name: null,
        ip_address: null,
        status: 'online',
        is_paused: false,
        paused_at: null,
        last_seen: '2026-01-20T10:00:00Z',
        os_distribution: 'Raspbian',
        os_version: '11',
        kernel_version: '5.10',
        architecture: 'arm64',
        cpu_model: null,
        cpu_cores: null,
        machine_category: 'sbc',
        machine_category_source: 'user',
        idle_watts: 2,
        tdp_watts: 6,
        updates_available: null,
        security_updates: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-20T10:00:00Z',
        latest_metrics: null,
      });
    });

    it('opens power modal when Configure clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('configure-server-3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('configure-server-3'));

      expect(screen.getByTestId('power-modal')).toBeInTheDocument();
    });

    it('opens power modal when Edit clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('edit-power-server-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-power-server-1'));

      expect(screen.getByTestId('power-modal')).toBeInTheDocument();
    });

    it('closes modal on cancel', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('configure-server-3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('configure-server-3'));
      expect(screen.getByTestId('power-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('power-modal-cancel'));

      expect(screen.queryByTestId('power-modal')).not.toBeInTheDocument();
    });

    it('calls updateServer on save', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('configure-server-3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('configure-server-3'));

      // Select a category
      const categorySelect = screen.getByTestId('power-modal-category');
      fireEvent.change(categorySelect, { target: { value: 'sbc' } });

      fireEvent.click(screen.getByTestId('power-modal-save'));

      await waitFor(() => {
        expect(serversApi.updateServer).toHaveBeenCalledWith('server-3', {
          machine_category: 'sbc',
          idle_watts: 2,
          tdp_watts: 6,
        });
      });
    });

    it('refreshes data after save', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('configure-server-3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('configure-server-3'));

      // Select a category
      const categorySelect = screen.getByTestId('power-modal-category');
      fireEvent.change(categorySelect, { target: { value: 'sbc' } });

      fireEvent.click(screen.getByTestId('power-modal-save'));

      await waitFor(() => {
        // Second call to getCostBreakdown after save
        expect(costsApi.getCostBreakdown).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(costsApi.getCostBreakdown).mockResolvedValue(mockCostBreakdown);
    });

    it('navigates to dashboard on back button click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('opens cost settings dialog on Configure Rate click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('configure-rate-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('configure-rate-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-dialog')).toBeInTheDocument();
      });
    });

    it('navigates to server detail on hostname click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('web-server')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('web-server'));

      await waitFor(() => {
        expect(screen.getByTestId('server-detail')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('displays message when no servers have power configuration', async () => {
      vi.mocked(costsApi.getCostBreakdown).mockResolvedValue({
        servers: [
          {
            server_id: 'server-1',
            hostname: 'server-1',
            machine_category: null,
            machine_category_label: null,
            machine_category_source: null,
            cpu_model: null,
            idle_watts: null,
            tdp_watts: null,
            estimated_watts: null,
            avg_cpu_percent: null,
            daily_cost: null,
            monthly_cost: null,
          },
        ],
        totals: {
          servers_configured: 0,
          servers_unconfigured: 1,
          total_estimated_watts: 0,
          daily_cost: 0,
          monthly_cost: 0,
          servers_with_tdp: 0,
          servers_without_tdp: 1,
          total_tdp_watts: 0,
        },
        settings: {
          electricity_rate: 0.24,
          currency_symbol: '£',
        },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/No servers have power configuration yet/)).toBeInTheDocument();
      });
    });
  });
});
