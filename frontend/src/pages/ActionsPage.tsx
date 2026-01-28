import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Filter, RefreshCw } from 'lucide-react';
import { getActions, cancelAction } from '../api/actions';
import { getServers } from '../api/servers';
import { ActionDetailPanel } from '../components/ActionDetailPanel';
import { Pagination } from '../components/Pagination';
import type { Action, ActionStatus } from '../types/action';
import type { Server } from '../types/server';
import { formatRelativeTime, formatActionType } from '../lib/formatters';

const PAGE_SIZE = 20;

const statusConfig: Record<ActionStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-text-tertiary' },
  approved: { label: 'Approved', color: 'text-status-warning' },
  executing: { label: 'Executing', color: 'text-status-info' },
  completed: { label: 'Completed', color: 'text-status-success' },
  failed: { label: 'Failed', color: 'text-status-error' },
  rejected: { label: 'Rejected', color: 'text-text-muted' },
};

export function ActionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const statusFilter = (searchParams.get('status') as ActionStatus | 'all') || 'all';
  const serverFilter = searchParams.get('server') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // State
  const [actions, setActions] = useState<Action[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [totalActions, setTotalActions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Fetch actions
  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: {
      limit: number;
      offset: number;
      status?: string;
      server_id?: string;
    } = {
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    };

    if (statusFilter !== 'all') params.status = statusFilter;
    if (serverFilter !== 'all') params.server_id = serverFilter;

    try {
      const response = await getActions(params);
      setActions(response.actions);
      setTotalActions(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch actions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serverFilter, currentPage]);

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

  // Fetch actions when filters change
  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

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

  // Clear all filters
  function clearFilters() {
    setSearchParams({});
  }

  // Get server display name
  function getServerName(serverId: string): string {
    const server = servers.find((s) => s.id === serverId);
    return server?.display_name || server?.hostname || serverId;
  }

  // Handle cancel action
  async function handleCancel(actionId: number) {
    setCancelLoading(true);
    try {
      await cancelAction(actionId);
      setSelectedAction(null);
      fetchActions(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel action');
    } finally {
      setCancelLoading(false);
    }
  }

  const totalPages = Math.ceil(totalActions / PAGE_SIZE);
  const hasFilters = statusFilter !== 'all' || serverFilter !== 'all';

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
          <h1 className="text-xl font-bold text-text-primary">Actions</h1>
        </div>
      </header>

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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="executing">Executing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
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
            onClick={fetchActions}
            className="ml-auto p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
            aria-label="Refresh actions"
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
              onClick={fetchActions}
              className="px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="empty-state">
            <CheckCircle className="w-12 h-12 text-status-success" />
            <h2 className="text-lg font-medium text-text-primary">No actions found</h2>
            <p className="text-text-tertiary text-sm">
              {hasFilters ? (
                <>
                  No actions match your filters.{' '}
                  <button onClick={clearFilters} className="text-status-info hover:underline">
                    Clear filters
                  </button>
                </>
              ) : (
                'No remediation actions have been created yet.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Actions table */}
            <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden" data-testid="actions-table">
              <table className="w-full">
                <thead className="bg-bg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {actions.map((action) => {
                    const statConfig = statusConfig[action.status];
                    const isTerminal = ['completed', 'failed', 'rejected'].includes(action.status);

                    return (
                      <tr
                        key={action.id}
                        className={`hover:bg-bg-tertiary cursor-pointer transition-colors ${
                          isTerminal ? 'opacity-70' : ''
                        }`}
                        onClick={() => setSelectedAction(action)}
                        data-testid={`action-row-${action.id}`}
                      >
                        <td className="px-4 py-3 text-sm text-text-primary font-mono">
                          {getServerName(action.server_id)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {formatActionType(action.action_type)}
                          {action.service_name && (
                            <span className="text-text-tertiary"> ({action.service_name})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${statConfig.color}`}>
                            {statConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-tertiary font-mono" title={action.created_at}>
                          {formatRelativeTime(action.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-tertiary font-mono" title={action.completed_at || undefined}>
                          {action.completed_at ? formatRelativeTime(action.completed_at) : '-'}
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
                  totalItems={totalActions}
                  pageSize={PAGE_SIZE}
                  onPageChange={handlePageChange}
                  itemName="actions"
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail panel */}
      {selectedAction && (
        <ActionDetailPanel
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          serverName={getServerName(selectedAction.server_id)}
          onCancel={handleCancel}
          cancelLoading={cancelLoading}
        />
      )}
    </div>
  );
}
