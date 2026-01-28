import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Filter, RefreshCw } from 'lucide-react';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../api/alerts';
import { getServers } from '../api/servers';
import { restartService } from '../api/services';
import { ApiError } from '../api/client';
import { AlertDetailPanel } from '../components/AlertDetailPanel';
import { Pagination } from '../components/Pagination';
import type { Alert, AlertStatus, AlertSeverity, AlertFilters } from '../types/alert';
import type { Server } from '../types/server';
import { formatRelativeTime } from '../lib/formatters';

const PAGE_SIZE = 20;

const severityConfig: Record<AlertSeverity, { label: string; badgeColor: string }> = {
  critical: { label: 'CRITICAL', badgeColor: 'bg-status-error text-bg-primary' },
  high: { label: 'HIGH', badgeColor: 'bg-status-warning text-bg-primary' },
  medium: { label: 'MEDIUM', badgeColor: 'bg-status-info text-bg-primary' },
  low: { label: 'LOW', badgeColor: 'bg-text-tertiary text-bg-primary' },
};

const statusConfig: Record<AlertStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-status-warning' },
  acknowledged: { label: 'Acknowledged', color: 'text-status-info' },
  resolved: { label: 'Resolved', color: 'text-status-success' },
};

export function AlertsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const statusFilter = (searchParams.get('status') as AlertStatus | 'all') || 'all';
  const severityFilter = (searchParams.get('severity') as AlertSeverity | 'all') || 'all';
  const serverFilter = searchParams.get('server') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restartMessage, setRestartMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filters: AlertFilters = {
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    };

    if (statusFilter !== 'all') filters.status = statusFilter;
    if (severityFilter !== 'all') filters.severity = severityFilter;
    if (serverFilter !== 'all') filters.server_id = serverFilter;

    try {
      const response = await getAlerts(filters);
      setAlerts(response.alerts);
      setTotalAlerts(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, serverFilter, currentPage]);

  // Fetch servers for filter dropdown
  useEffect(() => {
    async function loadServers() {
      try {
        const response = await getServers();
        setServers(response.servers);
      } catch {
        // Silently fail - server filter will just be empty
      }
    }
    loadServers();
  }, []);

  // Fetch alerts when filters change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Update URL params
  function updateFilter(key: string, value: string) {
    setSearchParams((prev) => {
      if (value === 'all' || value === '') {
        prev.delete(key);
      } else {
        prev.set(key, value);
      }
      // Reset to page 1 when filters change (except when changing page)
      if (key !== 'page') {
        prev.delete('page');
      }
      return prev;
    });
  }

  function handlePageChange(page: number) {
    updateFilter('page', page === 1 ? '' : page.toString());
  }

  // Handle acknowledge
  async function handleAcknowledge(alertId: number) {
    setActionInProgress(alertId);
    setActionError(null);

    try {
      await acknowledgeAlert(alertId);
      // Update local state
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, status: 'acknowledged' as AlertStatus, acknowledged_at: new Date().toISOString() }
            : a
        )
      );
      // Update selected alert if open
      if (selectedAlert?.id === alertId) {
        setSelectedAlert((prev) =>
          prev ? { ...prev, status: 'acknowledged' as AlertStatus, acknowledged_at: new Date().toISOString() } : null
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionInProgress(null);
    }
  }

  // Handle resolve
  async function handleResolve(alertId: number) {
    setActionInProgress(alertId);
    setActionError(null);

    try {
      await resolveAlert(alertId);
      // Update local state
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, status: 'resolved' as AlertStatus, resolved_at: new Date().toISOString(), auto_resolved: false }
            : a
        )
      );
      // Update selected alert if open
      if (selectedAlert?.id === alertId) {
        setSelectedAlert((prev) =>
          prev
            ? { ...prev, status: 'resolved' as AlertStatus, resolved_at: new Date().toISOString(), auto_resolved: false }
            : null
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve alert');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionInProgress(null);
    }
  }

  // Handle restart service
  async function handleRestartService(serverId: string, serviceName: string) {
    if (selectedAlert) {
      setActionInProgress(selectedAlert.id);
    }
    setRestartMessage(null);

    try {
      const result = await restartService(serverId, serviceName);
      if (result.status === 'pending') {
        setRestartMessage({
          type: 'info',
          text: `Restart pending approval for ${serviceName} (server in maintenance mode)`,
        });
      } else {
        setRestartMessage({ type: 'success', text: `Restarting ${serviceName}...` });
      }
      // Auto-clear message after 5 seconds
      setTimeout(() => setRestartMessage(null), 5000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRestartMessage({ type: 'info', text: `Restart already pending for ${serviceName}` });
      } else {
        setRestartMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to queue restart',
        });
      }
      setTimeout(() => setRestartMessage(null), 5000);
    } finally {
      setActionInProgress(null);
    }
  }

  // Clear all filters
  function clearFilters() {
    setSearchParams({});
  }

  const totalPages = Math.ceil(totalAlerts / PAGE_SIZE);
  const hasFilters = statusFilter !== 'all' || severityFilter !== 'all' || serverFilter !== 'all';

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
            aria-label="Back to dashboard"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">Alerts</h1>
        </div>
      </header>

      {/* Error toast */}
      {actionError && (
        <div
          className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center justify-between gap-2"
          data-testid="action-error-toast"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
            <span className="text-sm text-text-secondary">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-text-tertiary hover:text-text-secondary text-sm"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-4 border-b border-border-default">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-text-tertiary">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
            data-testid="status-filter"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => updateFilter('severity', e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
            data-testid="severity-filter"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Server filter */}
          <select
            value={serverFilter}
            onChange={(e) => updateFilter('server', e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
            data-testid="server-filter"
          >
            <option value="all">All Servers</option>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.display_name || server.hostname}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-status-info hover:text-status-info/80 transition-colors"
              data-testid="clear-filters"
            >
              Clear filters
            </button>
          )}

          <button
            onClick={fetchAlerts}
            className="ml-auto p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
            aria-label="Refresh alerts"
            data-testid="refresh-button"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-status-info animate-spin" data-testid="loading-spinner" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="error-state">
            <AlertCircle className="w-12 h-12 text-status-error" />
            <p className="text-text-secondary">{error}</p>
            <button
              onClick={fetchAlerts}
              className="px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="empty-state">
            <CheckCircle className="w-12 h-12 text-status-success" />
            <h2 className="text-lg font-medium text-text-primary">No alerts found</h2>
            <p className="text-text-tertiary text-sm">
              {hasFilters ? (
                <>
                  No alerts match your filters.{' '}
                  <button onClick={clearFilters} className="text-status-info hover:underline">
                    Clear filters
                  </button>
                </>
              ) : (
                'All systems operational - no alerts to display.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Alerts table */}
            <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden" data-testid="alerts-table">
              <table className="w-full">
                <thead className="bg-bg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {alerts.map((alert) => {
                    const sevConfig = severityConfig[alert.severity];
                    const statConfig = statusConfig[alert.status];
                    const isResolved = alert.status === 'resolved';

                    return (
                      <tr
                        key={alert.id}
                        className={`hover:bg-bg-tertiary cursor-pointer transition-colors ${
                          isResolved ? 'opacity-60' : ''
                        }`}
                        onClick={() => setSelectedAlert(alert)}
                        data-testid={`alert-row-${alert.id}`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`${sevConfig.badgeColor} text-[10px] font-mono font-bold px-1.5 py-0.5 rounded`}
                          >
                            {sevConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary font-medium">
                          {alert.title}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary font-mono">
                          {alert.server_name || alert.server_id}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${statConfig.color}`}>
                            {statConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-tertiary font-mono" title={alert.created_at}>
                          {formatRelativeTime(alert.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {alert.can_acknowledge && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcknowledge(alert.id);
                              }}
                              disabled={actionInProgress === alert.id}
                              className="px-2 py-1 text-xs font-medium text-status-info hover:bg-status-info/10 rounded transition-colors disabled:opacity-50"
                              data-testid={`acknowledge-button-${alert.id}`}
                            >
                              {actionInProgress === alert.id ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : (
                                'Acknowledge'
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalAlerts}
                  pageSize={PAGE_SIZE}
                  onPageChange={handlePageChange}
                  itemName="alerts"
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail panel */}
      {selectedAlert && (
        <AlertDetailPanel
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onRestartService={handleRestartService}
          isActionInProgress={actionInProgress === selectedAlert.id}
          restartMessage={restartMessage}
        />
      )}
    </div>
  );
}
