import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ServerCard } from '../components/ServerCard';
import { DashboardFilters } from '../components/DashboardFilters';
import type { StatusFilter, TypeFilter } from '../components/DashboardFilters';
import { AlertBanner } from '../components/AlertBanner';
import { AlertDetailPanel } from '../components/AlertDetailPanel';
import { PendingActionsPanel } from '../components/PendingActionsPanel';
import { RejectModal } from '../components/RejectModal';
import { CostBadge } from '../components/CostBadge';
import { ConnectivityStatusBar } from '../components/ConnectivityStatusBar';
import { AddServerModal } from '../components/AddServerModal';
import { getServers } from '../api/servers';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../api/alerts';
import { restartService } from '../api/services';
import { ApiError } from '../api/client';
import { getActions, approveAction, rejectAction } from '../api/actions';
import type { Server } from '../types/server';
import type { Alert, AlertSeverity, AlertStatus } from '../types/alert';
import type { Action } from '../types/action';
import { Loader2, ServerOff, AlertCircle, Settings, Radar, ListTodo, Plus, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

const POLL_INTERVAL_MS = 30000; // 30 seconds

const severityOrder: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    // Sort by severity first (critical first)
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    // Then by created_at (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Sort servers: active servers first, then inactive servers at the end (EP0007)
function sortServers(servers: Server[]): Server[] {
  return [...servers].sort((a, b) => {
    // Inactive servers go to the end
    if (a.is_inactive && !b.is_inactive) return 1;
    if (!a.is_inactive && b.is_inactive) return -1;
    // Then sort by display name or hostname
    const nameA = (a.display_name || a.hostname).toLowerCase();
    const nameB = (b.display_name || b.hostname).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<Server[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingActions, setPendingActions] = useState<Action[]>([]);
  const [inProgressActions, setInProgressActions] = useState<Action[]>([]);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set());
  const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set());
  const [rejectingAction, setRejectingAction] = useState<Action | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertActionInProgress, setAlertActionInProgress] = useState(false);
  const [restartMessage, setRestartMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  // US0115: Quick action message state
  const [quickActionMessage, setQuickActionMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // US0112: Filter state from URL parameters
  const searchQuery = searchParams.get('q') || '';
  const statusFilterParam = searchParams.get('status') || 'all';
  const typeFilterParam = searchParams.get('type') || 'all';

  // Validate status filter from URL
  const validStatuses: StatusFilter[] = ['all', 'online', 'offline', 'warning', 'paused'];
  const statusFilter: StatusFilter = validStatuses.includes(statusFilterParam as StatusFilter)
    ? (statusFilterParam as StatusFilter)
    : 'all';

  // Validate type filter from URL
  const validTypes: TypeFilter[] = ['all', 'server', 'workstation'];
  const typeFilter: TypeFilter = validTypes.includes(typeFilterParam as TypeFilter)
    ? (typeFilterParam as TypeFilter)
    : 'all';

  // US0112: Update URL when filters change
  const updateSearchParams = useCallback(
    (updates: { q?: string; status?: StatusFilter; type?: TypeFilter }) => {
      const newParams = new URLSearchParams(searchParams);

      if (updates.q !== undefined) {
        if (updates.q) {
          newParams.set('q', updates.q);
        } else {
          newParams.delete('q');
        }
      }

      if (updates.status !== undefined) {
        if (updates.status && updates.status !== 'all') {
          newParams.set('status', updates.status);
        } else {
          newParams.delete('status');
        }
      }

      if (updates.type !== undefined) {
        if (updates.type && updates.type !== 'all') {
          newParams.set('type', updates.type);
        } else {
          newParams.delete('type');
        }
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // US0112: Filter handlers
  const handleSearchChange = useCallback(
    (query: string) => {
      updateSearchParams({ q: query });
    },
    [updateSearchParams]
  );

  const handleStatusChange = useCallback(
    (status: StatusFilter) => {
      updateSearchParams({ status });
    },
    [updateSearchParams]
  );

  const handleTypeChange = useCallback(
    (type: TypeFilter) => {
      updateSearchParams({ type });
    },
    [updateSearchParams]
  );

  const handleClearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // US0112: Check if any filters are active
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || typeFilter !== 'all';

  // US0112: Filter servers based on search and filters
  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      // Search filter (case-insensitive match on id, hostname, and display_name)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        server.id.toLowerCase().includes(searchLower) ||
        server.hostname.toLowerCase().includes(searchLower) ||
        (server.display_name?.toLowerCase().includes(searchLower) ?? false);

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (statusFilter === 'paused') {
          matchesStatus = server.is_paused === true;
        } else if (statusFilter === 'warning') {
          // Warning: online server with active alerts
          matchesStatus =
            server.status === 'online' &&
            !server.is_paused &&
            (server.active_alert_count ?? 0) > 0;
        } else {
          // online/offline status (and not paused for online check)
          matchesStatus = server.status === statusFilter && !server.is_paused;
        }
      }

      // Type filter
      const matchesType =
        typeFilter === 'all' || server.machine_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [servers, searchQuery, statusFilter, typeFilter]);

  // US0115: Handle quick action message display
  const handleQuickActionMessage = useCallback((msg: { type: 'success' | 'info' | 'error'; text: string }) => {
    setQuickActionMessage(msg);
    setTimeout(() => setQuickActionMessage(null), 5000);
  }, []);

  // Function to refresh data (used by AddServerModal after token creation)
  const refreshData = useCallback(async () => {
    try {
      const [serverData, alertData, actionsData] = await Promise.all([
        getServers(),
        getAlerts({ status: 'open' }),
        getActions(),
      ]);
      setServers(sortServers(serverData.servers));
      setAlerts(sortAlerts(alertData.alerts));
      setPendingActions(actionsData.actions.filter((a) => a.status === 'pending'));
      setInProgressActions(
        actionsData.actions.filter((a) =>
          ['pending', 'approved', 'executing'].includes(a.status)
        )
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        const [serverData, alertData, actionsData] = await Promise.all([
          getServers(),
          getAlerts({ status: 'open' }),
          getActions(), // Fetch all actions, filter client-side
        ]);
        if (!ignore) {
          setServers(sortServers(serverData.servers));
          setAlerts(sortAlerts(alertData.alerts));
          // Pending actions for the panel display
          setPendingActions(actionsData.actions.filter((a) => a.status === 'pending'));
          // In-progress actions for queued check (pending, approved, executing)
          setInProgressActions(
            actionsData.actions.filter((a) =>
              ['pending', 'approved', 'executing'].includes(a.status)
            )
          );
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Set up polling
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, []);

  async function handleAcknowledge(alertId: number) {
    // Optimistic update
    setAcknowledgingIds((prev) => new Set(prev).add(alertId));
    setAcknowledgeError(null);

    try {
      await acknowledgeAlert(alertId);
      // Remove from list on success (acknowledged alerts not shown on dashboard)
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      // Revert on error - alert stays in list, show error toast
      const message = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      setAcknowledgeError(message);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setAcknowledgeError(null), 5000);
    } finally {
      setAcknowledgingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  // US0030 AC4: Approve action handler
  async function handleApproveAction(actionId: number) {
    setApprovingIds((prev) => new Set(prev).add(actionId));
    setActionError(null);

    // Optimistic update - remove from pending list, update status in in-progress list
    const previousPendingActions = pendingActions;
    const previousInProgressActions = inProgressActions;
    setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
    setInProgressActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'approved' as const } : a))
    );

    try {
      await approveAction(actionId);
    } catch (err) {
      // Revert on error
      const message = err instanceof Error ? err.message : 'Failed to approve action';
      setActionError(message);
      setPendingActions(previousPendingActions);
      setInProgressActions(previousInProgressActions);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  }

  // US0030 AC5: Reject action handler
  async function handleRejectAction(reason: string) {
    if (!rejectingAction) return;

    setRejectLoading(true);
    setActionError(null);

    try {
      await rejectAction(rejectingAction.id, reason);
      // Remove from both lists on success
      setPendingActions((prev) => prev.filter((a) => a.id !== rejectingAction.id));
      setInProgressActions((prev) => prev.filter((a) => a.id !== rejectingAction.id));
      setRejectingAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject action';
      setActionError(message);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setRejectLoading(false);
    }
  }

  // Handle resolve alert from detail panel
  async function handleResolve(alertId: number) {
    setAlertActionInProgress(true);

    try {
      await resolveAlert(alertId);
      // Update local state
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      // Update selected alert
      if (selectedAlert?.id === alertId) {
        setSelectedAlert((prev) =>
          prev
            ? { ...prev, status: 'resolved' as AlertStatus, resolved_at: new Date().toISOString(), auto_resolved: false }
            : null
        );
      }
    } catch (err) {
      setAcknowledgeError(err instanceof Error ? err.message : 'Failed to resolve alert');
      setTimeout(() => setAcknowledgeError(null), 5000);
    } finally {
      setAlertActionInProgress(false);
    }
  }

  // Handle restart service from alert detail panel
  async function handleRestartService(serverId: string, serviceName: string) {
    setAlertActionInProgress(true);
    setRestartMessage(null);

    try {
      const result = await restartService(serverId, serviceName);
      if (result.status === 'pending') {
        setRestartMessage({
          type: 'info',
          text: `Restart pending approval for ${serviceName} (server in maintenance mode)`,
        });
        // Refresh actions lists to show the new action
        const actionsData = await getActions();
        setPendingActions(actionsData.actions.filter((a) => a.status === 'pending'));
        setInProgressActions(
          actionsData.actions.filter((a) =>
            ['pending', 'approved', 'executing'].includes(a.status)
          )
        );
      } else {
        setRestartMessage({ type: 'success', text: `Restarting ${serviceName}...` });
      }
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
      setAlertActionInProgress(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-status-info animate-spin" />
      </div>
    );
  }

  // Error state (no cached data)
  if (error && servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-status-error" />
        <p className="text-text-secondary">{error}</p>
        <button
          className="px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const hasServers = servers.length > 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-status-success font-sans">
            HomelabCmd
          </h1>
          <div className="flex items-center gap-4">
            <ConnectivityStatusBar />
            <CostBadge />
            <span className="text-text-tertiary text-sm font-mono">
              {servers.length} server{servers.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowAddServerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-status-success text-bg-primary rounded-md text-sm font-medium hover:bg-status-success/90 transition-colors"
              aria-label="Add Server"
              title="Add Server"
              data-testid="add-server-button"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
            <Link
              to="/scans"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Scans"
              title="Scans"
              data-testid="scans-link"
            >
              <Radar className="w-5 h-5" />
            </Link>
            <Link
              to="/discovery"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Device Discovery"
              title="Device Discovery"
              data-testid="discovery-link"
            >
              <Globe className="w-5 h-5" />
            </Link>
            <Link
              to="/actions"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Actions"
              title="Actions"
              data-testid="actions-link"
            >
              <ListTodo className="w-5 h-5" />
            </Link>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Settings"
              title="Settings"
              data-testid="settings-button"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Error toast (when we have cached data) */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
          <span className="text-sm text-text-secondary">
            Unable to refresh - showing cached data
          </span>
        </div>
      )}

      {/* Acknowledge error toast */}
      {acknowledgeError && (
        <div
          className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center justify-between gap-2"
          data-testid="acknowledge-error-toast"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
            <span className="text-sm text-text-secondary">{acknowledgeError}</span>
          </div>
          <button
            onClick={() => setAcknowledgeError(null)}
            className="text-text-tertiary hover:text-text-secondary text-sm"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action error toast (US0030) */}
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

      {/* US0115: Quick action message toast */}
      {quickActionMessage && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between gap-2 ${
            quickActionMessage.type === 'error'
              ? 'bg-status-error/10 border border-status-error/30'
              : quickActionMessage.type === 'success'
                ? 'bg-status-success/10 border border-status-success/30'
                : 'bg-status-info/10 border border-status-info/30'
          }`}
          data-testid="quick-action-toast"
        >
          <span className="text-sm text-text-secondary">{quickActionMessage.text}</span>
          <button
            onClick={() => setQuickActionMessage(null)}
            className="text-text-tertiary hover:text-text-secondary text-sm"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {hasServers ? (
          <>
            {/* Alert Banner */}
            <AlertBanner
              alerts={alerts}
              onAcknowledge={handleAcknowledge}
              onAlertSelect={setSelectedAlert}
              acknowledgingIds={acknowledgingIds}
            />

            {/* Pending Actions Panel (US0030) */}
            <PendingActionsPanel
              actions={pendingActions}
              onApprove={handleApproveAction}
              onReject={setRejectingAction}
              approvingIds={approvingIds}
            />

            {/* US0112: Dashboard Filters */}
            <DashboardFilters
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              statusFilter={statusFilter}
              onStatusChange={handleStatusChange}
              typeFilter={typeFilter}
              onTypeChange={handleTypeChange}
              onClear={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {/* Server Grid or Empty State */}
            {filteredServers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredServers.map((server) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    onClick={() => navigate(`/servers/${server.id}`)}
                    onPauseToggle={refreshData}
                    onMessage={handleQuickActionMessage}
                  />
                ))}
              </div>
            ) : (
              /* US0112 AC7: Empty state when filters match no servers */
              <div
                className="flex flex-col items-center justify-center py-12 gap-3"
                data-testid="no-matches-message"
              >
                <ServerOff className="w-10 h-10 text-text-tertiary" />
                <p className="text-text-secondary">No servers match your filters</p>
                <button
                  onClick={handleClearFilters}
                  className="text-status-info hover:text-status-info/80 text-sm font-medium transition-colors"
                  data-testid="clear-filters-link"
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <ServerOff className="w-12 h-12 text-text-tertiary" />
            <h2 className="text-xl font-bold text-text-primary">No servers registered</h2>
            <p className="text-text-tertiary">
              Deploy the agent to your first server to get started.
            </p>
            <button
              onClick={() => setShowAddServerModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-status-success text-bg-primary rounded-md font-medium hover:bg-status-success/90 transition-colors"
              data-testid="add-server-button-empty"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>
        )}
      </main>

      {/* Reject Modal (US0030 AC5) */}
      {rejectingAction && (
        <RejectModal
          action={rejectingAction}
          onReject={handleRejectAction}
          onCancel={() => setRejectingAction(null)}
          isLoading={rejectLoading}
        />
      )}

      {/* Alert Detail Panel */}
      {selectedAlert && (
        <AlertDetailPanel
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onRestartService={handleRestartService}
          isActionInProgress={alertActionInProgress}
          restartMessage={restartMessage}
          isRestartQueued={
            selectedAlert.service_name
              ? inProgressActions.some(
                  (a) =>
                    a.action_type === 'restart_service' &&
                    a.server_id === selectedAlert.server_id &&
                    a.service_name === selectedAlert.service_name
                )
              : false
          }
        />
      )}

      {/* Add Server Modal */}
      {showAddServerModal && (
        <AddServerModal
          onClose={() => setShowAddServerModal(false)}
          onTokenCreated={refreshData}
        />
      )}
    </div>
  );
}
