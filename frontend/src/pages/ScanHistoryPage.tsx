/**
 * ScanHistoryPage - Page for viewing scan history with filtering.
 *
 * Features:
 * - Lists all scans with chronological ordering (newest first)
 * - Filter by hostname, status, and scan type
 * - Pagination support
 * - Click to view scan details
 * - Delete scans with confirmation
 *
 * US0040: Scan History View
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
  Trash2,
  Eye,
  Clock,
  Search,
} from 'lucide-react';
import { getScans, deleteScan } from '../api/scans';
import { Pagination } from '../components/Pagination';
import type { ScanListItem, ScanListFilters, ScanStatus, ScanType } from '../types/scan';
import { formatRelativeTime } from '../lib/formatters';

const PAGE_SIZE = 20;

const statusConfig: Record<ScanStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  completed: { label: 'Completed', color: 'text-status-success', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-status-error', icon: XCircle },
  pending: { label: 'Pending', color: 'text-status-warning', icon: Clock },
  running: { label: 'Running', color: 'text-status-info', icon: Loader2 },
};

const typeLabels: Record<ScanType, string> = {
  quick: 'Quick',
  full: 'Full',
};

export function ScanHistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const hostnameFilter = searchParams.get('hostname') || '';
  const statusFilter = (searchParams.get('status') as ScanStatus | '') || '';
  const typeFilter = (searchParams.get('scan_type') as ScanType | '') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // State
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ScanListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounced hostname filter
  const [hostnameInput, setHostnameInput] = useState(hostnameFilter);

  // Fetch scans
  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filters: ScanListFilters = {
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    };

    if (hostnameFilter) filters.hostname = hostnameFilter;
    if (statusFilter) filters.status = statusFilter as ScanListFilters['status'];
    if (typeFilter) filters.scan_type = typeFilter as ScanListFilters['scan_type'];

    try {
      const response = await getScans(filters);
      setScans(response.scans);
      setTotalScans(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scans');
    } finally {
      setLoading(false);
    }
  }, [hostnameFilter, statusFilter, typeFilter, currentPage]);

  // Fetch scans when filters change
  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  // Debounce hostname input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hostnameInput !== hostnameFilter) {
        updateFilter('hostname', hostnameInput);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateFilter is stable; including it causes infinite loop
  }, [hostnameInput, hostnameFilter]);

  // Update URL params
  function updateFilter(key: string, value: string) {
    setSearchParams((prev) => {
      if (value === '' || value === 'all') {
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
    setHostnameInput('');
    setSearchParams({});
  }

  // Delete handlers
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteScan(deleteTarget.scan_id);
      // Remove from list
      setScans((prev) => prev.filter((s) => s.scan_id !== deleteTarget.scan_id));
      setTotalScans((prev) => prev - 1);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete scan');
    } finally {
      setIsDeleting(false);
    }
  }

  const totalPages = Math.ceil(totalScans / PAGE_SIZE);
  const hasFilters = hostnameFilter !== '' || statusFilter !== '' || typeFilter !== '';
  const showNoMatchingScans = !loading && scans.length === 0 && hasFilters;
  const showEmptyState = !loading && scans.length === 0 && !hasFilters && !error;

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
          <h1 className="text-xl font-bold text-text-primary">Scan History</h1>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-border-default">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-text-tertiary">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Hostname filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Hostname..."
              value={hostnameInput}
              onChange={(e) => setHostnameInput(e.target.value)}
              className="bg-bg-secondary border border-border-default rounded-md pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-info w-40"
              data-testid="hostname-filter"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
            data-testid="status-filter"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => updateFilter('scan_type', e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
            data-testid="type-filter"
          >
            <option value="">All Types</option>
            <option value="quick">Quick</option>
            <option value="full">Full</option>
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
            onClick={fetchScans}
            className="ml-auto p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
            aria-label="Refresh scans"
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
              onClick={fetchScans}
              className="px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="empty-state">
            <Clock className="w-12 h-12 text-text-tertiary" />
            <h2 className="text-lg font-medium text-text-primary">No scans yet</h2>
            <p className="text-text-tertiary text-sm">
              Scans will appear here once you run your first scan.
            </p>
          </div>
        ) : showNoMatchingScans ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="no-results-state">
            <Search className="w-12 h-12 text-text-tertiary" />
            <h2 className="text-lg font-medium text-text-primary">No matching scans</h2>
            <p className="text-text-tertiary text-sm">
              No scans match your filters.{' '}
              <button onClick={clearFilters} className="text-status-info hover:underline">
                Clear filters
              </button>
            </p>
          </div>
        ) : (
          <>
            {/* Scans table */}
            <div
              className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden"
              data-testid="scans-table"
            >
              <table className="w-full">
                <thead className="bg-bg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Hostname
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {scans.map((scan) => {
                    const statConfig = statusConfig[scan.status];
                    const StatusIcon = statConfig.icon;

                    return (
                      <tr
                        key={scan.scan_id}
                        className="hover:bg-bg-tertiary cursor-pointer transition-colors"
                        onClick={() => navigate(`/scans/${scan.scan_id}`)}
                        data-testid={`scan-row-${scan.scan_id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm text-text-primary font-mono">
                            {scan.results?.hostname || scan.hostname}
                          </div>
                          {scan.results?.hostname && scan.results.hostname !== scan.hostname && (
                            <div className="text-xs text-text-tertiary font-mono">
                              {scan.hostname}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {typeLabels[scan.scan_type]}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={`flex items-center gap-1.5 text-sm ${statConfig.color}`}
                            data-testid={`status-${scan.status}-${scan.scan_id}`}
                          >
                            <StatusIcon
                              className={`w-4 h-4 ${scan.status === 'running' ? 'animate-spin' : ''}`}
                            />
                            {statConfig.label}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-text-tertiary font-mono"
                          title={scan.started_at || undefined}
                        >
                          {scan.started_at ? formatRelativeTime(scan.started_at) : '--'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/scans/${scan.scan_id}`);
                              }}
                              className="p-1.5 text-text-tertiary hover:text-status-info hover:bg-status-info/10 rounded transition-colors"
                              aria-label="View scan"
                              data-testid={`view-button-${scan.scan_id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(scan);
                              }}
                              className="p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
                              aria-label="Delete scan"
                              data-testid={`delete-button-${scan.scan_id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                  totalItems={totalScans}
                  pageSize={PAGE_SIZE}
                  onPageChange={handlePageChange}
                  itemName="scans"
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          data-testid="delete-confirm-modal"
        >
          <div className="bg-bg-secondary border border-border-default rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-status-error/10 rounded-full">
                <AlertCircle className="w-6 h-6 text-status-error" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-text-primary">Delete scan for {deleteTarget.hostname}?</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  This action cannot be undone. The scan results will be permanently removed.
                </p>

                {deleteError && (
                  <p className="mt-3 text-sm text-status-error" data-testid="delete-error">
                    {deleteError}
                  </p>
                )}

                <div className="mt-4 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
                    disabled={isDeleting}
                    data-testid="cancel-delete-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2 text-sm font-medium text-white bg-status-error hover:bg-status-error/90 rounded-md transition-colors disabled:opacity-50"
                    disabled={isDeleting}
                    data-testid="confirm-delete-button"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
