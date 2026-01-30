import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCostBreakdown, updateCostConfig } from '../api/costs';
import { getCostHistory, getMonthlySummary } from '../api/cost-history';
import { updateServer } from '../api/servers';
import { PowerEditModal } from '../components/PowerEditModal';
import { CategoryBadge } from '../components/CategoryBadge';
import { CostSettingsDialog } from '../components/CostSettingsDialog';
import { CostTrendChart } from '../components/CostTrendChart';
import { MonthlySummaryChart } from '../components/MonthlySummaryChart';
import { formatCost } from '../lib/formatters';
import type { CostBreakdown, ServerCostItem, PowerConfigUpdate, CostConfigUpdate } from '../types/cost';
import type { CostHistoryItem, CostHistoryPeriod, MonthlySummaryItem } from '../types/cost-history';
import { ArrowUpDown, Settings, Zap } from 'lucide-react';

type SortField = 'hostname' | 'category' | 'avg_cpu' | 'estimated_watts' | 'daily_cost' | 'monthly_cost';
type SortDirection = 'asc' | 'desc';
type CostTab = 'breakdown' | 'trends' | 'monthly';

/**
 * Full cost breakdown page showing per-server electricity costs.
 * US0183: Historical Cost Tracking - AC3 (Cost trend visualisation), AC5 (Monthly summary).
 */
export function CostsPage() {
  const navigate = useNavigate();

  // Active tab state (US0183)
  const [activeTab, setActiveTab] = useState<CostTab>('breakdown');

  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('daily_cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Power edit modal state
  const [editingServer, setEditingServer] = useState<ServerCostItem | null>(null);
  const [powerSaving, setPowerSaving] = useState(false);

  // Cost settings dialog state
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [costSaving, setCostSaving] = useState(false);

  // Trends tab state (US0183 AC3)
  const [trendPeriod, setTrendPeriod] = useState<CostHistoryPeriod>('30d');
  const [trendData, setTrendData] = useState<CostHistoryItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Monthly tab state (US0183 AC5)
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlySummaryItem[]>([]);
  const [yearToDate, setYearToDate] = useState<number | undefined>(undefined);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  useEffect(() => {
    fetchBreakdown();
  }, []);

  // Fetch trend data when trends tab is active or period changes
  useEffect(() => {
    if (activeTab === 'trends') {
      fetchTrendData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, trendPeriod]);

  // Fetch monthly data when monthly tab is active or year changes
  useEffect(() => {
    if (activeTab === 'monthly') {
      fetchMonthlyData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthlyYear]);

  async function fetchBreakdown() {
    try {
      const data = await getCostBreakdown();
      setBreakdown(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost breakdown');
    } finally {
      setLoading(false);
    }
  }

  // Fetch cost trend data (US0183 AC3)
  async function fetchTrendData() {
    setTrendLoading(true);
    try {
      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (trendPeriod) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '12m':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      const response = await getCostHistory({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        aggregation: trendPeriod === '12m' ? 'monthly' : trendPeriod === '90d' ? 'weekly' : 'daily',
      });
      setTrendData(response.items);
    } catch (err) {
      console.error('Failed to load trend data:', err);
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }

  // Fetch monthly summary data (US0183 AC5)
  async function fetchMonthlyData() {
    setMonthlyLoading(true);
    try {
      const response = await getMonthlySummary(monthlyYear);
      setMonthlyData(response.months);
      setYearToDate(response.year_to_date_cost);
    } catch (err) {
      console.error('Failed to load monthly data:', err);
      setMonthlyData([]);
      setYearToDate(undefined);
    } finally {
      setMonthlyLoading(false);
    }
  }

  const handleBack = () => {
    navigate('/');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePowerSave = async (config: PowerConfigUpdate) => {
    if (!editingServer) return;

    setPowerSaving(true);
    try {
      await updateServer(editingServer.server_id, config);
      // Refresh breakdown data
      await fetchBreakdown();
      setEditingServer(null);
    } catch (err) {
      console.error('Failed to save power config:', err);
    } finally {
      setPowerSaving(false);
    }
  };

  const handleCostConfigSave = async (update: CostConfigUpdate) => {
    setCostSaving(true);
    try {
      await updateCostConfig(update);
      // Refresh breakdown data to show updated costs
      await fetchBreakdown();
      setCostDialogOpen(false);
    } catch (err) {
      console.error('Failed to save cost config:', err);
      throw err; // Re-throw so dialog knows save failed
    } finally {
      setCostSaving(false);
    }
  };

  // Sort servers
  const sortedServers = breakdown
    ? [...breakdown.servers].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'hostname':
            comparison = a.hostname.localeCompare(b.hostname);
            break;
          case 'category':
            comparison = (a.machine_category_label ?? '').localeCompare(b.machine_category_label ?? '');
            break;
          case 'avg_cpu':
            comparison = (a.avg_cpu_percent ?? 0) - (b.avg_cpu_percent ?? 0);
            break;
          case 'estimated_watts':
            comparison = (a.estimated_watts ?? 0) - (b.estimated_watts ?? 0);
            break;
          case 'daily_cost':
            comparison = (a.daily_cost ?? 0) - (b.daily_cost ?? 0);
            break;
          case 'monthly_cost':
            comparison = (a.monthly_cost ?? 0) - (b.monthly_cost ?? 0);
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      })
    : [];

  // Split into configured and unconfigured (has category or power config)
  const configuredServers = sortedServers.filter(
    (s) => s.machine_category !== null || s.idle_watts !== null || s.tdp_watts !== null
  );
  const unconfiguredServers = sortedServers.filter(
    (s) => s.machine_category === null && s.idle_watts === null && s.tdp_watts === null
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info"
              data-testid="loading-spinner"
            />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !breakdown) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-4 text-status-error" data-testid="error-message">
              {error}
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleBack}
                className="rounded-md bg-bg-secondary px-4 py-2 text-text-primary hover:bg-bg-tertiary"
                data-testid="back-button"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-status-info px-4 py-2 text-white hover:bg-status-info/80"
                data-testid="retry-button"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!breakdown) {
    return null;
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-text-primary"
      data-testid={`sort-${field}`}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${
          sortField === field ? 'text-status-info' : 'text-text-tertiary'
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              data-testid="back-button"
              aria-label="Back to dashboard"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-status-warning" />
              <h1 className="text-2xl font-bold text-text-primary">
                Electricity Costs
              </h1>
            </div>
          </div>
          <button
            onClick={() => setCostDialogOpen(true)}
            className="flex items-center gap-2 rounded-md bg-bg-secondary px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            data-testid="configure-rate-button"
          >
            <Settings className="h-4 w-4" />
            Configure Rate
          </button>
        </header>

        {/* Rate info */}
        <div className="mb-6 flex items-center gap-4 text-sm text-text-secondary">
          <span>
            Rate: {breakdown.settings.currency_symbol}
            {breakdown.settings.electricity_rate.toFixed(2)}/kWh
          </span>
          <span>|</span>
          <span>
            Total Est. Power: {breakdown.totals.total_estimated_watts}W
          </span>
          <span>|</span>
          <span>
            Est. Daily: {formatCost(breakdown.totals.daily_cost, breakdown.settings.currency_symbol)}
          </span>
        </div>

        {/* Tab navigation (US0183) */}
        <div className="mb-6 flex border-b border-border-default" data-testid="cost-tabs">
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'breakdown'
                ? 'border-b-2 border-status-info text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="tab-breakdown"
          >
            Breakdown
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'trends'
                ? 'border-b-2 border-status-info text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="tab-trends"
          >
            Trends
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'monthly'
                ? 'border-b-2 border-status-info text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="tab-monthly"
          >
            Monthly
          </button>
        </div>

        {/* Trends tab content (US0183 AC3) */}
        {activeTab === 'trends' && (
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-6"
            data-testid="trends-content"
          >
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Cost Trends
            </h2>
            <CostTrendChart
              data={trendData}
              currencySymbol={breakdown.settings.currency_symbol}
              period={trendPeriod}
              onPeriodChange={setTrendPeriod}
              loading={trendLoading}
            />
          </div>
        )}

        {/* Monthly tab content (US0183 AC5) */}
        {activeTab === 'monthly' && (
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-6"
            data-testid="monthly-content"
          >
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Monthly Summary
            </h2>
            <MonthlySummaryChart
              data={monthlyData}
              currencySymbol={breakdown.settings.currency_symbol}
              yearToDate={yearToDate}
              year={monthlyYear}
              onYearChange={setMonthlyYear}
              loading={monthlyLoading}
            />
          </div>
        )}

        {/* Breakdown tab - Main cost table */}
        {activeTab === 'breakdown' && (
        <>
        {/* Main cost table */}
        <div
          className="mb-6 overflow-hidden rounded-lg border border-border-default bg-bg-secondary"
          data-testid="cost-table"
        >
          <table className="w-full">
            <thead className="border-b border-border-default bg-bg-tertiary">
              <tr className="text-left text-sm text-text-secondary">
                <th className="px-4 py-3">
                  <SortButton field="hostname" label="Server" />
                </th>
                <th className="px-4 py-3">
                  <SortButton field="category" label="Category" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="avg_cpu" label="Avg CPU" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="estimated_watts" label="Est. Power" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="daily_cost" label="Daily" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="monthly_cost" label="Monthly" />
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configuredServers.map((server) => (
                <tr
                  key={server.server_id}
                  className="border-b border-border-default last:border-b-0"
                  data-testid={`cost-row-${server.server_id}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/servers/${server.server_id}`)}
                      className="font-mono text-text-primary hover:text-status-info"
                    >
                      {server.hostname}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge
                      label={server.machine_category_label}
                      source={server.machine_category_source}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {server.avg_cpu_percent !== null
                      ? `${server.avg_cpu_percent.toFixed(1)}%`
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {server.estimated_watts !== null
                      ? `${server.estimated_watts.toFixed(1)}W`
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {formatCost(server.daily_cost, breakdown.settings.currency_symbol)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {formatCost(server.monthly_cost, breakdown.settings.currency_symbol)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingServer(server)}
                      className="rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary hover:bg-bg-primary hover:text-text-primary"
                      data-testid={`edit-power-${server.server_id}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {/* Total row */}
              {configuredServers.length > 0 && (
                <tr className="bg-bg-tertiary font-semibold" data-testid="cost-total-row">
                  <td className="px-4 py-3 text-text-primary">Total</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {breakdown.totals.total_estimated_watts}W
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-status-success">
                    {formatCost(breakdown.totals.daily_cost, breakdown.settings.currency_symbol)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-status-success">
                    {formatCost(breakdown.totals.monthly_cost, breakdown.settings.currency_symbol)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              )}
            </tbody>
          </table>

          {configuredServers.length === 0 && (
            <div className="p-8 text-center text-text-tertiary">
              No servers have power configuration yet. Configure a machine category to see cost estimates.
            </div>
          )}
        </div>

        {/* Unconfigured servers */}
        {unconfiguredServers.length > 0 && (
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-4"
            data-testid="unconfigured-servers"
          >
            <h2 className="mb-3 text-sm font-semibold text-text-secondary">
              Unconfigured Servers ({unconfiguredServers.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {unconfiguredServers.map((server) => (
                <button
                  key={server.server_id}
                  onClick={() => setEditingServer(server)}
                  className="flex items-center gap-2 rounded-md bg-bg-tertiary px-3 py-2 text-sm hover:bg-bg-primary"
                  data-testid={`configure-${server.server_id}`}
                >
                  <span className="font-mono text-text-primary">
                    {server.hostname}
                  </span>
                  <span className="text-status-info">Configure</span>
                </button>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Power Edit Modal */}
      {editingServer && (
        <PowerEditModal
          serverName={editingServer.hostname}
          cpuModel={editingServer.cpu_model}
          avgCpuPercent={editingServer.avg_cpu_percent}
          currentCategory={editingServer.machine_category}
          currentCategorySource={editingServer.machine_category_source}
          currentIdleWatts={editingServer.idle_watts}
          currentMaxWatts={editingServer.tdp_watts}
          onSave={handlePowerSave}
          onCancel={() => setEditingServer(null)}
          isLoading={powerSaving}
        />
      )}

      {/* Cost Settings Dialog */}
      {costDialogOpen && (
        <CostSettingsDialog
          config={{
            electricity_rate: breakdown.settings.electricity_rate,
            currency_symbol: breakdown.settings.currency_symbol,
            updated_at: null,
          }}
          onSave={handleCostConfigSave}
          onCancel={() => setCostDialogOpen(false)}
          isLoading={costSaving}
        />
      )}
    </div>
  );
}
