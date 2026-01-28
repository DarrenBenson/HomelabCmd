/**
 * PackageList component for displaying pending package updates (US0051, US0052).
 *
 * Features:
 * - Displays table of pending packages with version info
 * - Filter toggle: All / Security Only
 * - Action buttons: Refresh List, Apply Security, Apply All
 * - Pagination for large lists (25 per page)
 * - Collapsible section
 */

import { useState, useEffect, useCallback } from 'react';
import { getServerPackages } from '../api/servers';
import { createAction } from '../api/actions';
import { formatRelativeTime } from '../lib/formatters';
import { cn } from '../lib/utils';
import type { Package, PackagesResponse } from '../types/server';

interface PackageListProps {
  serverId: string;
  /** Agent mode - when 'readonly', action buttons are hidden (BG0017) */
  agentMode?: 'readonly' | 'readwrite' | null;
}

type FilterMode = 'all' | 'security';

const PAGE_SIZE = 25;

export function PackageList({ serverId, agentMode }: PackageListProps) {
  const isReadonly = agentMode === 'readonly';
  const [packages, setPackages] = useState<PackagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getServerPackages(serverId);
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Filter packages based on current filter
  const filteredPackages: Package[] = packages
    ? filter === 'security'
      ? packages.packages.filter((p) => p.is_security)
      : packages.packages
    : [];

  // Pagination
  const totalPages = Math.ceil(filteredPackages.length / PAGE_SIZE);
  const paginatedPackages = filteredPackages.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Action handlers
  const handleAction = async (actionType: 'apt_update' | 'apt_upgrade_all' | 'apt_upgrade_security') => {
    setActionLoading(actionType);
    setActionError(null);
    setActionSuccess(null);

    try {
      await createAction({
        server_id: serverId,
        action_type: actionType,
      });
      const successMessages: Record<string, string> = {
        apt_update: 'Refresh list action queued',
        apt_upgrade_all: 'Apply all updates action queued',
        apt_upgrade_security: 'Apply security updates action queued',
      };
      setActionSuccess(successMessages[actionType]);
      // Clear success message after 3 seconds
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      if (err instanceof Error && err.message.includes('409')) {
        setActionError('An update action is already in progress');
      } else {
        setActionError(err instanceof Error ? err.message : 'Failed to queue action');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // If no packages data and not loading and no error, don't render anything
  if (!loading && !packages && !error) {
    return null;
  }

  const totalCount = packages?.total_count ?? 0;
  const securityCount = packages?.security_count ?? 0;

  return (
    <div
      className="rounded-lg border border-border-default bg-bg-secondary"
      data-testid="package-list-panel"
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-bg-tertiary/50"
        data-testid="package-list-toggle"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">System Updates</h2>
          {totalCount > 0 && (
            <span className="rounded-full bg-status-warning/20 px-2 py-0.5 text-xs font-medium text-status-warning">
              {totalCount} available
            </span>
          )}
          {securityCount > 0 && (
            <span className="rounded-full bg-status-error/20 px-2 py-0.5 text-xs font-medium text-status-error">
              {securityCount} security
            </span>
          )}
        </div>
        <svg
          className={cn(
            'h-5 w-5 text-text-secondary transition-transform',
            collapsed ? '' : 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="border-t border-border-default p-4">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="py-4 text-center text-status-error" data-testid="package-list-error">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && totalCount === 0 && (
            <div className="py-8 text-center" data-testid="package-list-empty">
              <p className="text-status-success font-medium">System is up to date</p>
              <p className="mt-1 text-sm text-text-secondary">No packages need updating</p>
            </div>
          )}

          {/* Package list */}
          {!loading && !error && totalCount > 0 && (
            <>
              {/* Filter and info row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-text-secondary">
                  {packages?.last_checked && (
                    <span>Last checked: {formatRelativeTime(packages.last_checked)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={cn(
                      'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                      filter === 'all'
                        ? 'bg-status-info text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                    )}
                    data-testid="filter-all"
                  >
                    All ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilter('security')}
                    className={cn(
                      'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                      filter === 'security'
                        ? 'bg-status-error text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                    )}
                    data-testid="filter-security"
                  >
                    Security ({securityCount})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="package-table">
                  <thead>
                    <tr className="border-b border-border-default text-left text-text-secondary">
                      <th className="pb-2 pr-4 font-medium">Package</th>
                      <th className="pb-2 pr-4 font-medium">Current</th>
                      <th className="pb-2 pr-4 font-medium">Available</th>
                      <th className="pb-2 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPackages.map((pkg) => (
                      <tr
                        key={pkg.name}
                        className="border-b border-border-default/50 last:border-0"
                        data-testid={`package-row-${pkg.name}`}
                      >
                        <td className="py-2 pr-4 font-mono text-text-primary">{pkg.name}</td>
                        <td className="py-2 pr-4 font-mono text-text-secondary">
                          {pkg.current_version}
                        </td>
                        <td className="py-2 pr-4 font-mono text-text-primary">{pkg.new_version}</td>
                        <td className="py-2">
                          {pkg.is_security ? (
                            <span className="inline-flex items-center gap-1 text-status-warning">
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Security
                            </span>
                          ) : (
                            <span className="text-text-secondary">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(currentPage * PAGE_SIZE, filteredPackages.length)} of{' '}
                    {filteredPackages.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-md bg-bg-tertiary px-3 py-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                      data-testid="prev-page"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-md bg-bg-tertiary px-3 py-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                      data-testid="next-page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons - hidden in readonly mode (BG0017) */}
              {!isReadonly && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border-default pt-4">
                  <button
                    onClick={() => handleAction('apt_update')}
                    disabled={actionLoading !== null}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'bg-bg-tertiary text-text-secondary hover:bg-bg-primary hover:text-text-primary',
                      actionLoading === 'apt_update' && 'opacity-50 cursor-wait'
                    )}
                    data-testid="refresh-list-button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {actionLoading === 'apt_update' ? 'Queuing...' : 'Refresh List'}
                  </button>

                  {securityCount > 0 && (
                    <button
                      onClick={() => handleAction('apt_upgrade_security')}
                      disabled={actionLoading !== null}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        'bg-status-warning/20 text-status-warning hover:bg-status-warning/30',
                        actionLoading === 'apt_upgrade_security' && 'opacity-50 cursor-wait'
                      )}
                      data-testid="apply-security-button"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {actionLoading === 'apt_upgrade_security'
                        ? 'Queuing...'
                        : `Apply Security (${securityCount})`}
                    </button>
                  )}

                  <button
                    onClick={() => handleAction('apt_upgrade_all')}
                    disabled={actionLoading !== null}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'bg-status-info/20 text-status-info hover:bg-status-info/30',
                      actionLoading === 'apt_upgrade_all' && 'opacity-50 cursor-wait'
                    )}
                    data-testid="apply-all-button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {actionLoading === 'apt_upgrade_all' ? 'Queuing...' : `Apply All (${totalCount})`}
                  </button>

                  {/* Status messages */}
                  {actionSuccess && (
                    <span className="text-sm text-status-success" data-testid="action-success">
                      {actionSuccess}
                    </span>
                  )}
                  {actionError && (
                    <span className="text-sm text-status-error" data-testid="action-error">
                      {actionError}
                    </span>
                  )}
                </div>
              )}
              {isReadonly && (
                <div className="mt-4 border-t border-border-default pt-4 text-sm text-text-tertiary" data-testid="readonly-actions-notice">
                  Actions disabled - agent is in readonly mode.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
