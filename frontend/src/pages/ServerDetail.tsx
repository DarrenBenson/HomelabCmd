import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServer, getMetricsHistory, pauseServer, unpauseServer, updateServer } from '../api/servers';
import { getCostConfig } from '../api/costs';
import { getAgentVersion, activateServer } from '../api/agents';
import { testSSHConnection } from '../api/ssh';
import type { SSHTestResponse } from '../types/ssh';
import { StatusLED } from '../components/StatusLED';
import { Gauge } from '../components/Gauge';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { ExportButton } from '../components/ExportButton';
import { ServicesPanel } from '../components/ServicesPanel';
import { PackageList } from '../components/PackageList';
import { AgentUpgradeModal } from '../components/AgentUpgradeModal';
import { AgentRemoveModal } from '../components/AgentRemoveModal';
import { AgentInstallModal } from '../components/AgentInstallModal';
import { AgentCredentialCard } from '../components/AgentCredentialCard';
import { ServerCredentials } from '../components/ServerCredentials';
import { PackAssignment } from '../components/PackAssignment';
import { ServerDetailWidgetView } from '../components/widgets';
import { ServerCostHistoryWidget } from '../components/widgets/ServerCostHistoryWidget';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';
import {
  formatUptime,
  formatRelativeTime,
  formatBytes,
  formatMemoryCompact,
  formatDiskCompact,
  formatLoadAverage,
  formatCost,
} from '../lib/formatters';
import { MACHINE_CATEGORIES, type MachineCategory, type PowerConfigUpdate } from '../types/cost';
import { CategoryBadge } from '../components/CategoryBadge';
import { TailscaleBadge } from '../components/TailscaleBadge';
import { PowerEditModal } from '../components/PowerEditModal';
import type {
  ServerDetail as ServerDetailType,
  MetricsHistoryResponse,
  TimeRange,
} from '../types/server';

// Lazy load chart component to reduce initial bundle size
const MetricsChart = lazy(() =>
  import('../components/MetricsChart').then((m) => ({ default: m.MetricsChart }))
);

const POLLING_INTERVAL = 30000; // 30 seconds

export function ServerDetail() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();

  const [server, setServer] = useState<ServerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Historical metrics state
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Maintenance mode state (US0029 AC5)
  const [pauseLoading, setPauseLoading] = useState(false);

  // Power configuration state (US0033, US0056)
  const [powerModalOpen, setPowerModalOpen] = useState(false);
  const [powerSaving, setPowerSaving] = useState(false);
  const [electricityRate, setElectricityRate] = useState(0.24);
  const [currencySymbol, setCurrencySymbol] = useState('£');

  // Agent management state (EP0007)
  const [latestAgentVersion, setLatestAgentVersion] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  // SSH test connection state (US0079)
  const [sshTesting, setSshTesting] = useState(false);
  const [sshTestResult, setSshTestResult] = useState<SSHTestResponse | null>(null);

  // Advanced section collapsed state
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // View mode state (EP0012: Widget-based detail view)
  const [viewMode, setViewMode] = useState<'classic' | 'widget'>('classic');

  // Edit layout mode state (US0175: Edit Layout Mode)
  const [isEditMode, setIsEditMode] = useState(false);

  // Mobile detection (US0177: Responsive Widget Layout)
  const isMobile = useIsMobile();

  // Auto-exit edit mode when switching to mobile (US0177 AC5)
  useEffect(() => {
    if (isMobile && isEditMode) {
      setIsEditMode(false);
    }
  }, [isMobile, isEditMode]);

  const fetchServerData = useCallback(async (showLoading = false, ignore = false) => {
    if (!serverId) return;

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getServer(serverId);
      if (!ignore) {
        setServer(data);
        setNotFound(false);
      }
    } catch (err) {
      if (!ignore) {
        if (err instanceof Error && err.message.includes('404')) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to fetch server');
        }
      }
    } finally {
      if (!ignore) {
        setLoading(false);
      }
    }
  }, [serverId]);

  useEffect(() => {
    let ignore = false;

    fetchServerData(true, ignore);

    // Fetch cost config for daily cost calculation
    getCostConfig()
      .then((config) => {
        if (!ignore) {
          setElectricityRate(config.electricity_rate);
          setCurrencySymbol(config.currency_symbol);
        }
      })
      .catch(() => {
        // Use defaults if fetch fails
      });

    // Fetch latest agent version (EP0007)
    getAgentVersion()
      .then((response) => {
        if (!ignore) {
          setLatestAgentVersion(response.version);
        }
      })
      .catch(() => {
        // Ignore if version check fails
      });

    // Set up polling
    const interval = setInterval(() => {
      if (!ignore) {
        fetchServerData(false, ignore);
      }
    }, POLLING_INTERVAL);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchServerData]);

  const handleBack = () => {
    navigate('/');
  };

  const handleRefresh = () => {
    fetchServerData(true);
  };

  // Fetch metrics history
  const fetchMetricsHistory = useCallback(async (range: TimeRange) => {
    if (!serverId) return;

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const data = await getMetricsHistory(serverId, range);
      setMetricsHistory(data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setHistoryLoading(false);
    }
  }, [serverId]);

  // Effect to fetch history when range changes or server loads
  useEffect(() => {
    if (server && !notFound) {
      fetchMetricsHistory(timeRange);
    }
  }, [server, timeRange, fetchMetricsHistory, notFound]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  // Maintenance mode toggle handler (US0029 AC5)
  const handleToggleMaintenance = async () => {
    if (!server || !serverId) return;

    setPauseLoading(true);
    try {
      const updated = server.is_paused
        ? await unpauseServer(serverId)
        : await pauseServer(serverId);
      setServer(updated);
    } catch (err) {
      console.error('Failed to toggle maintenance mode:', err);
    } finally {
      setPauseLoading(false);
    }
  };

  // Reactivate inactive server handler (BG0012)
  const handleActivate = async () => {
    if (!server || !serverId) return;

    setActivating(true);
    try {
      const result = await activateServer(serverId);
      if (result.success) {
        // Refresh server data to get updated state
        await fetchServerData(false, false);
      }
    } catch (err) {
      console.error('Failed to activate server:', err);
    } finally {
      setActivating(false);
    }
  };

  // SSH test connection handler (US0079)
  const handleTestSSH = async () => {
    if (!serverId) return;

    setSshTesting(true);
    setSshTestResult(null);

    try {
      const result = await testSSHConnection(serverId);
      setSshTestResult(result);
    } catch (err) {
      // API errors come back as HTTP errors
      setSshTestResult({
        success: false,
        hostname: server?.tailscale_hostname || '',
        latency_ms: null,
        host_key_fingerprint: null,
        error: err instanceof Error ? err.message : 'Connection test failed',
        attempts: 1,
      });
    } finally {
      setSshTesting(false);
    }
  };

  // Power configuration handlers (US0033, US0056)
  const handlePowerEdit = () => {
    setPowerModalOpen(true);
  };

  const handlePowerCancel = () => {
    setPowerModalOpen(false);
  };

  const handlePowerSave = async (config: PowerConfigUpdate) => {
    if (!serverId) return;

    setPowerSaving(true);
    try {
      const updated = await updateServer(serverId, config);
      setServer(updated);
      setPowerModalOpen(false);
    } catch (err) {
      console.error('Failed to save power config:', err);
    } finally {
      setPowerSaving(false);
    }
  };

  // Get label for machine category
  const getCategoryLabel = (category: MachineCategory | null): string | null => {
    if (!category) return null;
    const found = MACHINE_CATEGORIES.find((c) => c.value === category);
    return found?.label ?? category;
  };

  // Check if upgrade is available (show upgrade option even for "unknown" versions)
  const upgradeAvailable = latestAgentVersion &&
    server?.agent_version &&
    server?.agent_version !== latestAgentVersion;

  // Calculate estimated power based on CPU usage
  // Formula: Power = idle + (max - idle) × (cpu% / 100)
  const calculateEstimatedPower = (): number | null => {
    const idleWatts = server?.idle_watts;
    const maxWatts = server?.tdp_watts;
    const cpuPercent = metrics?.cpu_percent;

    if (maxWatts === null || maxWatts === undefined) return null;

    // Use idle watts from server or category default, fallback to 40% of max
    const idle = idleWatts ?? Math.round(maxWatts * 0.4);
    // Use current CPU% or default to 50% if no metrics
    const cpu = cpuPercent ?? 50;

    return Math.round(idle + (maxWatts - idle) * (cpu / 100));
  };

  // Calculate daily cost from estimated power
  const calculateDailyCost = (): number | null => {
    const estimatedWatts = calculateEstimatedPower();
    if (estimatedWatts === null) return null;
    const kwhPerDay = (estimatedWatts * 24) / 1000;
    return Math.round(kwhPerDay * electricityRate * 100) / 100;
  };

  // Loading state
  if (loading && !server) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-6xl">
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

  // Not found state
  if (notFound) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-4 text-xl text-text-secondary" data-testid="not-found-message">
              Server not found
            </p>
            <button
              onClick={handleBack}
              className="rounded-md bg-bg-secondary px-4 py-2 text-text-primary hover:bg-bg-tertiary"
              data-testid="back-button"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !server) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-6xl">
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
                onClick={handleRefresh}
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

  if (!server) {
    return null;
  }

  const metrics = server.latest_metrics;
  const displayName = server.display_name || server.hostname;

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="mx-auto max-w-6xl">
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
              <h1 className="text-2xl font-bold text-text-primary">
                {displayName}
              </h1>
              <TailscaleBadge tailscaleHostname={server.tailscale_hostname} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle (EP0012) */}
            <div className="flex rounded-md border border-border-default">
              <button
                onClick={() => {
                  setViewMode('classic');
                  setIsEditMode(false); // Exit edit mode when switching views
                }}
                className={cn(
                  'px-3 py-2 text-sm transition-colors',
                  viewMode === 'classic'
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
                data-testid="view-mode-classic"
                aria-label="Classic view"
              >
                Classic
              </button>
              <button
                onClick={() => setViewMode('widget')}
                className={cn(
                  'px-3 py-2 text-sm transition-colors',
                  viewMode === 'widget'
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
                data-testid="view-mode-widget"
                aria-label="Widget view"
              >
                Widget
              </button>
            </div>
            {/* Edit Layout Button (US0175) - only visible in widget view on non-mobile (US0177) */}
            {viewMode === 'widget' && !isMobile && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  'rounded-md px-4 py-2 text-sm transition-colors',
                  isEditMode
                    ? 'bg-status-info text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )}
                data-testid="edit-layout-button"
                aria-label={isEditMode ? 'Exit edit mode' : 'Edit layout'}
              >
                {isEditMode ? 'Done Editing' : 'Edit Layout'}
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-md bg-bg-secondary px-4 py-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              data-testid="refresh-button"
              aria-label="Refresh server data"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Offline warning */}
        {server.status === 'offline' && (
          <div
            className="mb-6 rounded-md border border-status-error/30 bg-status-error/10 p-4 text-status-error"
            data-testid="offline-warning"
          >
            Server is offline. Last seen: {formatRelativeTime(server.last_seen)}
          </div>
        )}

        {/* Widget View (EP0012) */}
        {viewMode === 'widget' && (
          <ServerDetailWidgetView
            server={server}
            isEditMode={isEditMode}
            onExitEditMode={() => setIsEditMode(false)}
            estimatedPower={calculateEstimatedPower()}
            dailyCost={calculateDailyCost()}
            currencySymbol={currencySymbol}
            onToggleMaintenance={handleToggleMaintenance}
            onTestSSH={server.tailscale_hostname ? handleTestSSH : undefined}
            onPowerEdit={handlePowerEdit}
            pauseLoading={pauseLoading}
            sshTesting={sshTesting}
            sshTestResult={sshTestResult}
          />
        )}

        {/* Classic View - Main content grid */}
        {viewMode === 'classic' && (
        <>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Server Information */}
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-6"
            data-testid="server-info-card"
          >
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Server Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <StatusLED status={server.status} />
                <span className="text-text-primary capitalize">{server.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Hostname</span>
                <span className="font-mono text-text-primary" data-testid="hostname">
                  {server.hostname}
                </span>
              </div>
              {server.ip_address && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">IP Address</span>
                  <span className="font-mono text-text-primary" data-testid="ip-address">
                    {server.ip_address}
                  </span>
                </div>
              )}
              {/* Tailscale SSH Connection (US0079) */}
              {server.tailscale_hostname && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Tailscale</span>
                    <span className="font-mono text-text-primary" data-testid="tailscale-hostname">
                      {server.tailscale_hostname}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleTestSSH}
                      disabled={sshTesting}
                      className="px-3 py-1 text-xs font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="test-ssh-button"
                    >
                      {sshTesting ? 'Testing...' : 'Test SSH'}
                    </button>
                  </div>
                  {sshTestResult && (
                    <div
                      className={cn(
                        'rounded-md p-3 text-sm',
                        sshTestResult.success
                          ? 'bg-status-success/10 border border-status-success/30'
                          : 'bg-status-error/10 border border-status-error/30'
                      )}
                      data-testid="ssh-test-result"
                    >
                      {sshTestResult.success ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-status-success">
                            <span className="font-medium">Connected</span>
                          </div>
                          <div className="text-text-secondary">
                            Latency: {sshTestResult.latency_ms}ms
                          </div>
                          {sshTestResult.host_key_fingerprint && (
                            <div className="font-mono text-xs text-text-tertiary truncate" title={sshTestResult.host_key_fingerprint}>
                              {sshTestResult.host_key_fingerprint}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-status-error">
                          <span className="font-medium">Failed:</span>{' '}
                          {sshTestResult.error}
                          {sshTestResult.attempts > 1 && (
                            <span className="text-text-tertiary"> ({sshTestResult.attempts} attempts)</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">Last Seen</span>
                <span className="font-mono text-text-primary" data-testid="last-seen">
                  {formatRelativeTime(server.last_seen)}
                </span>
              </div>
              {/* Maintenance Mode (US0029 AC5) */}
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Maintenance Mode</span>
                <div className="flex items-center gap-3">
                  <span
                    className={server.is_paused ? 'text-status-warning' : 'text-text-primary'}
                    data-testid="maintenance-status"
                  >
                    {server.is_paused ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={handleToggleMaintenance}
                    disabled={pauseLoading}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded transition-colors',
                      server.is_paused
                        ? 'bg-status-success/20 text-status-success hover:bg-status-success/30'
                        : 'bg-status-warning/20 text-status-warning hover:bg-status-warning/30',
                      pauseLoading && 'opacity-50 cursor-not-allowed'
                    )}
                    data-testid="maintenance-toggle"
                  >
                    {pauseLoading ? '...' : server.is_paused ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
              {/* Paused timestamp */}
              {server.is_paused && server.paused_at && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Paused Since</span>
                  <span className="font-mono text-text-primary" data-testid="paused-at">
                    {formatRelativeTime(server.paused_at)}
                  </span>
                </div>
              )}

              {/* Agent Management Section (EP0007, BG0017) */}
              <div className="border-t border-border-default pt-3 mt-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Agent Version</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-text-primary"
                        data-testid="agent-version"
                      >
                        {server.agent_version || 'Unknown'}
                      </span>
                      {upgradeAvailable && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-status-info/20 text-status-info">
                            Update available
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Agent Mode (BG0017) */}
                  {server.agent_mode && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Agent Mode</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded',
                          server.agent_mode === 'readonly'
                            ? 'bg-text-tertiary/20 text-text-tertiary'
                            : 'bg-status-success/20 text-status-success'
                        )}
                        data-testid="agent-mode"
                      >
                        {server.agent_mode === 'readonly' ? 'Read Only' : 'Read/Write'}
                      </span>
                    </div>
                  )}
                  {server.agent_mode === 'readonly' && (
                    <div className="text-xs text-text-tertiary" data-testid="readonly-notice">
                      Actions disabled. Reinstall agent with --mode readwrite to enable.
                    </div>
                  )}

                  {/* Inactive status with reinstall/reactivate buttons (BG0012, BG0013) */}
                  {server.is_inactive && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">Status</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-text-tertiary/20 text-text-tertiary">
                          Inactive
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                        {(server.ip_address || server.tailscale_hostname) && (
                          <button
                            onClick={() => setInstallModalOpen(true)}
                            className="px-3 py-1 text-xs font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 transition-colors"
                            data-testid="reinstall-agent-button"
                          >
                            Reinstall Agent
                          </button>
                        )}
                        <button
                          onClick={handleActivate}
                          disabled={activating}
                          className="px-3 py-1 text-xs font-medium rounded bg-status-success/20 text-status-success hover:bg-status-success/30 transition-colors disabled:opacity-50"
                          data-testid="reactivate-server-button"
                        >
                          {activating ? 'Activating...' : 'Reactivate Server'}
                        </button>
                        <button
                          onClick={() => setRemoveModalOpen(true)}
                          className="px-3 py-1 text-xs font-medium rounded bg-status-error/20 text-status-error hover:bg-status-error/30 transition-colors"
                          data-testid="delete-server-button"
                        >
                          Delete Server
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Install Agent button for servers without agent (Tailscale imports) */}
                  {!server.is_inactive && !server.agent_version && (server.ip_address || server.tailscale_hostname) && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-text-secondary">No agent installed</span>
                      <button
                        onClick={() => setInstallModalOpen(true)}
                        className="px-3 py-1 text-xs font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 transition-colors"
                        data-testid="install-agent-button"
                      >
                        Install Agent
                      </button>
                    </div>
                  )}

                  {/* Agent actions - only show when agent is installed */}
                  {!server.is_inactive && server.agent_version && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {upgradeAvailable && (
                          <button
                            onClick={() => setUpgradeModalOpen(true)}
                            className="px-3 py-1 text-xs font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 transition-colors"
                            data-testid="upgrade-agent-button"
                          >
                            Upgrade Agent
                          </button>
                        )}
                      <button
                        onClick={() => setRemoveModalOpen(true)}
                        className="px-3 py-1 text-xs font-medium rounded bg-status-error/20 text-status-error hover:bg-status-error/30 transition-colors"
                        data-testid="remove-agent-button"
                      >
                        Remove Agent
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-6"
            data-testid="system-info-card"
          >
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              System
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-text-secondary">OS</span>
                <span className="font-mono text-text-primary" data-testid="os-info">
                  {server.os_distribution || '--'} {server.os_version || ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Kernel</span>
                <span className="font-mono text-text-primary" data-testid="kernel-version">
                  {server.kernel_version || '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Architecture</span>
                <span className="font-mono text-text-primary" data-testid="architecture">
                  {server.architecture || '--'}
                </span>
              </div>
              {/* CPU Info (US0056 AC6) */}
              <div className="flex justify-between gap-4">
                <span className="text-text-secondary shrink-0">CPU</span>
                <span
                  className="truncate font-mono text-text-primary text-right"
                  data-testid="cpu-model"
                >
                  {server.cpu_model || '--'}
                </span>
              </div>
              {server.cpu_cores && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Cores</span>
                  <span className="font-mono text-text-primary" data-testid="cpu-cores">
                    {server.cpu_cores}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">Uptime</span>
                <span className="font-mono text-text-primary" data-testid="uptime">
                  {formatUptime(metrics?.uptime_seconds ?? null)}
                </span>
              </div>
              {/* Power Configuration (US0033, US0056 AC6) */}
              <div className="border-t border-border-default pt-3 mt-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Category</span>
                    <div className="flex items-center gap-2">
                      <CategoryBadge
                        label={getCategoryLabel(server.machine_category)}
                        source={server.machine_category_source}
                      />
                      <button
                        onClick={handlePowerEdit}
                        className="rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                        data-testid="power-edit-button"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  {server.tdp_watts !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Est. Power</span>
                      <span
                        className="font-mono text-text-primary"
                        data-testid="tdp-display"
                      >
                        {calculateEstimatedPower()}W
                      </span>
                    </div>
                  )}
                  {server.tdp_watts !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Est. Cost</span>
                      <span className="font-mono text-status-success" data-testid="daily-cost">
                        {formatCost(calculateDailyCost(), currencySymbol)}/day
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Pack Assignment (US0121) - Configuration pack assignment */}
        {serverId && (
          <div className="mt-6" data-testid="pack-assignment-section">
            <PackAssignment serverId={serverId} onUpdate={() => fetchServerData(false)} />
          </div>
        )}

        {/* Advanced Configuration - Collapsible section for rarely-used settings */}
        <div className="mt-6" data-testid="advanced-section">
          <button
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="flex w-full items-center justify-between rounded-lg border border-border-default bg-bg-secondary p-4 text-left hover:bg-bg-tertiary transition-colors"
            data-testid="advanced-toggle"
          >
            <span className="text-lg font-semibold text-text-primary">
              Advanced Configuration
            </span>
            <svg
              className={cn(
                'h-5 w-5 text-text-secondary transition-transform',
                advancedExpanded && 'rotate-180'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {advancedExpanded && (
            <div className="mt-4 space-y-6">
              {/* Agent Security */}
              <div
                className="rounded-lg border border-border-default bg-bg-secondary p-6"
                data-testid="agent-security-card"
              >
                <h2 className="mb-4 text-lg font-semibold text-text-primary">
                  Agent Security
                </h2>
                <AgentCredentialCard serverGuid={server.guid} />
              </div>

              {/* Server Credentials (US0088) - Per-server SSH/sudo configuration */}
              {serverId && (
                <div data-testid="server-credentials-section">
                  <div className="rounded-lg border border-border-default bg-bg-secondary p-6">
                    <h2 className="mb-4 text-lg font-semibold text-text-primary">
                      Server Credentials
                    </h2>
                    <ServerCredentials serverId={serverId} onUpdate={() => fetchServerData(false)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Updates - Package List (US0051, US0052) */}
        {serverId && !server.is_inactive && (
          <div className="mt-6">
            <PackageList serverId={serverId} agentMode={server.agent_mode} />
          </div>
        )}

        {/* Resource Utilisation */}
        <div
          className="mt-6 rounded-lg border border-border-default bg-bg-secondary p-6"
          data-testid="resource-utilisation-card"
        >
          <h2 className="mb-6 text-lg font-semibold text-text-primary">
            Resource Utilisation
          </h2>
          <div className="flex flex-wrap justify-center gap-8 sm:justify-start">
            <Gauge
              value={metrics?.cpu_percent ?? null}
              label="CPU"
            />
            <Gauge
              value={metrics?.memory_percent ?? null}
              label="RAM"
              absoluteValue={formatMemoryCompact(metrics?.memory_used_mb ?? null, metrics?.memory_total_mb ?? null)}
            />
            <Gauge
              value={metrics?.disk_percent ?? null}
              label="Disk"
              absoluteValue={formatDiskCompact(metrics?.disk_used_gb ?? null, metrics?.disk_total_gb ?? null)}
            />
          </div>
        </div>

        {/* Network I/O and Load Average row */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Network I/O */}
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-6"
            data-testid="network-io-card"
          >
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Network I/O
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-text-secondary">Received (RX)</span>
                <span className="font-mono text-text-primary" data-testid="network-rx">
                  {formatBytes(metrics?.network_rx_bytes ?? null)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Transmitted (TX)</span>
                <span className="font-mono text-text-primary" data-testid="network-tx">
                  {formatBytes(metrics?.network_tx_bytes ?? null)}
                </span>
              </div>
            </div>
          </div>

          {/* Load Average */}
          <div
            className="rounded-lg border border-border-default bg-bg-secondary p-6"
            data-testid="load-average-card"
          >
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Load Average
            </h2>
            <div className="flex justify-around">
              <div className="text-center">
                <div
                  className="font-mono text-2xl font-bold text-text-primary"
                  data-testid="load-1m"
                >
                  {formatLoadAverage(metrics?.load_1m ?? null)}
                </div>
                <div className="text-sm text-text-secondary">1 min</div>
              </div>
              <div className="text-center">
                <div
                  className="font-mono text-2xl font-bold text-text-primary"
                  data-testid="load-5m"
                >
                  {formatLoadAverage(metrics?.load_5m ?? null)}
                </div>
                <div className="text-sm text-text-secondary">5 min</div>
              </div>
              <div className="text-center">
                <div
                  className="font-mono text-2xl font-bold text-text-primary"
                  data-testid="load-15m"
                >
                  {formatLoadAverage(metrics?.load_15m ?? null)}
                </div>
                <div className="text-sm text-text-secondary">15 min</div>
              </div>
            </div>
          </div>
        </div>

        {/* Server Cost History Widget (US0183 AC4) */}
        {serverId && server.tdp_watts !== null && (
          <div className="mt-6">
            <ServerCostHistoryWidget
              serverId={serverId}
              currencySymbol={currencySymbol}
            />
          </div>
        )}

        {/* Services */}
        {serverId && (
          <div className="mt-6">
            <ServicesPanel serverId={serverId} isInactive={server.is_inactive} agentMode={server.agent_mode} server={server} />
          </div>
        )}

        {/* Historical Metrics */}
        <div
          className="mt-6 rounded-lg border border-border-default bg-bg-secondary p-6"
          data-testid="historical-metrics-card"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              Historical Metrics
            </h2>
            <div className="flex items-center gap-2">
              <TimeRangeSelector
                value={timeRange}
                onChange={handleTimeRangeChange}
                disabled={historyLoading}
              />
              {serverId && (
                <ExportButton
                  serverId={serverId}
                  timeRange={timeRange}
                  disabled={historyLoading}
                />
              )}
            </div>
          </div>

          {historyError && (
            <div className="mb-4 text-sm text-status-error" data-testid="history-error">
              {historyError}
            </div>
          )}

          <div className="mt-4">
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
                </div>
              }
            >
              <MetricsChart
                data={metricsHistory?.data_points ?? []}
                timeRange={timeRange}
                loading={historyLoading}
              />
            </Suspense>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#22D3EE]" />
              <span className="text-text-secondary">CPU</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#4ADE80]" />
              <span className="text-text-secondary">Memory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#FBBF24]" />
              <span className="text-text-secondary">Disk</span>
            </div>
          </div>
        </div>

        {/* End Classic View conditional (EP0012) */}
        </>
        )}

      </div>

      {/* Power Edit Modal (US0056 AC3) */}
      {powerModalOpen && server && (
        <PowerEditModal
          serverName={server.hostname}
          cpuModel={server.cpu_model}
          avgCpuPercent={null}
          currentCategory={server.machine_category}
          currentCategorySource={server.machine_category_source}
          currentIdleWatts={server.idle_watts}
          currentMaxWatts={server.tdp_watts}
          onSave={handlePowerSave}
          onCancel={handlePowerCancel}
          isLoading={powerSaving}
        />
      )}

      {/* Agent Upgrade Modal (EP0007) */}
      {upgradeModalOpen && server && latestAgentVersion && (
        <AgentUpgradeModal
          isOpen={upgradeModalOpen}
          serverId={server.id}
          serverName={server.display_name || server.hostname}
          currentVersion={server.agent_version}
          latestVersion={latestAgentVersion}
          onClose={() => setUpgradeModalOpen(false)}
          onSuccess={() => {
            fetchServerData(false);
            setUpgradeModalOpen(false);
          }}
        />
      )}

      {/* Agent Remove Modal (EP0007) */}
      {removeModalOpen && server && (
        <AgentRemoveModal
          isOpen={removeModalOpen}
          serverId={server.id}
          serverName={server.display_name || server.hostname}
          onClose={() => setRemoveModalOpen(false)}
          onSuccess={(_, deleted) => {
            setRemoveModalOpen(false);
            if (deleted) {
              navigate('/');
            } else {
              fetchServerData(false);
            }
          }}
        />
      )}

      {/* Agent Install Modal for reinstall (BG0013) and Tailscale imports */}
      {installModalOpen && server && (server.ip_address || server.tailscale_hostname) && (
        <AgentInstallModal
          isOpen={installModalOpen}
          ipAddress={server.ip_address || server.tailscale_hostname || ''}
          hostname={server.hostname}
          onClose={() => setInstallModalOpen(false)}
          onSuccess={() => {
            setInstallModalOpen(false);
            fetchServerData(false);
          }}
        />
      )}
    </div>
  );
}
