/**
 * PackageList component for displaying pending package updates (US0051, US0052).
 * Enhanced with held-back package detection (US0198).
 *
 * Features:
 * - Displays table of pending packages with version info
 * - Distinguishes between upgradable and held-back packages
 * - Shows hold reason (phased rollout, dependency, manual) with tooltips
 * - Filter toggle: All / Security Only / Held Back
 * - Action buttons: Refresh List, Apply Security, Apply All
 * - Pagination for large lists (25 per page)
 * - Collapsible section
 */

import { useState, useEffect, useCallback } from 'react';
import { getPackageStatus } from '../api/servers';
import { createAction } from '../api/actions';
import { formatRelativeTime } from '../lib/formatters';
import { cn } from '../lib/utils';
import type { PackageWithStatus, PackageStatusResponse, HoldReason } from '../types/server';

interface PackageListProps {
  serverId: string;
  /** Agent mode - when 'readonly', action buttons are hidden (BG0017) */
  agentMode?: 'readonly' | 'readwrite' | null;
}

type FilterMode = 'all' | 'security' | 'held_back';

const PAGE_SIZE = 25;

/**
 * Get human-readable hold reason description for tooltip.
 */
function getHoldReasonDescription(reason: HoldReason, phasedPct: number | null): string {
  switch (reason) {
    case 'phased':
      return phasedPct !== null
        ? `Phased rollout (${phasedPct}% deployed) - Ubuntu/Debian gradually release updates to reduce risk`
        : 'Phased rollout - Ubuntu/Debian gradually release updates to reduce risk';
    case 'dependency':
      return 'Dependency conflict - upgrading would require removing another package';
    case 'manual':
      return 'Manually held - package held via apt-mark hold';
    default:
      return 'Package held back';
  }
}

/**
 * Get short hold reason label for badge.
 */
function getHoldReasonLabel(reason: HoldReason, phasedPct: number | null): string {
  switch (reason) {
    case 'phased':
      return phasedPct !== null ? `Phased ${phasedPct}%` : 'Phased';
    case 'dependency':
      return 'Dep. Conflict';
    case 'manual':
      return 'Manual Hold';
    default:
      return 'Held';
  }
}

export function PackageList({ serverId, agentMode }: PackageListProps) {
  const isReadonly = agentMode === 'readonly';
  const [packages, setPackages] = useState<PackageStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Tooltip state
  const [tooltipPkg, setTooltipPkg] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPackageStatus(serverId);
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
  const filteredPackages: PackageWithStatus[] = packages
    ? filter === 'security'
      ? packages.packages.filter((p) => p.is_security)
      : filter === 'held_back'
        ? packages.packages.filter((p) => p.status === 'held_back')
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

  const totalCount = packages ? packages.packages.length : 0;
  const upgradableCount = packages?.summary.upgradable_count ?? 0;
  const heldBackCount = packages?.summary.held_back_count ?? 0;
  const securityCount = packages?.summary.security_count ?? 0;

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
          {/* US0198 AC4: Updated summary showing accurate counts */}
          {upgradableCount > 0 && (
            <span
              className="rounded-full bg-status-success/20 px-2 py-0.5 text-xs font-medium text-status-success"
              data-testid="upgradable-badge"
            >
              {upgradableCount} will upgrade
            </span>
          )}
          {heldBackCount > 0 && (
            <span
              className="rounded-full bg-status-warning/20 px-2 py-0.5 text-xs font-medium text-status-warning"
              data-testid="held-back-badge"
            >
              {heldBackCount} held back
            </span>
          )}
          {securityCount > 0 && (
            <span
              className="rounded-full bg-status-error/20 px-2 py-0.5 text-xs font-medium text-status-error"
              data-testid="security-badge"
            >
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

          {/* All packages held back warning (US0198 edge case) */}
          {!loading && !error && totalCount > 0 && upgradableCount === 0 && heldBackCount > 0 && (
            <div
              className="mb-4 rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning"
              data-testid="all-held-back-warning"
            >
              <strong>All updates are currently held back.</strong> No packages will be installed
              when applying updates. This is usually due to phased rollouts or dependency conflicts.
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
                  {heldBackCount > 0 && (
                    <button
                      onClick={() => setFilter('held_back')}
                      className={cn(
                        'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                        filter === 'held_back'
                          ? 'bg-status-warning text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                      )}
                      data-testid="filter-held-back"
                    >
                      Held Back ({heldBackCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-visible">
                <table className="w-full text-sm table-fixed" data-testid="package-table">
                  <thead>
                    <tr className="border-b border-border-default text-left text-text-secondary">
                      <th className="pb-2 pr-2 font-medium w-[30%]">Package</th>
                      <th className="pb-2 pr-2 font-medium w-[25%]">Current</th>
                      <th className="pb-2 pr-2 font-medium w-[25%]">Available</th>
                      <th className="pb-2 font-medium w-[20%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPackages.map((pkg) => (
                      <tr
                        key={pkg.name}
                        className={cn(
                          'border-b border-border-default/50 last:border-0',
                          // US0198 AC2: Distinct visual style for held-back packages
                          pkg.status === 'held_back' && 'bg-status-warning/5'
                        )}
                        data-testid={`package-row-${pkg.name}`}
                      >
                        <td className="py-2 pr-2">
                          <span
                            className={cn(
                              'font-mono truncate block',
                              pkg.status === 'held_back'
                                ? 'text-status-warning'
                                : 'text-text-primary'
                            )}
                            title={pkg.name}
                          >
                            {pkg.name}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className="font-mono text-text-secondary truncate block" title={pkg.current_version}>
                            {pkg.current_version}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className="font-mono text-text-primary truncate block" title={pkg.candidate_version}>
                            {pkg.candidate_version}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Status indicator */}
                            {pkg.status === 'held_back' && pkg.hold_reason && (
                              <div className="relative">
                                <span
                                  className="inline-flex cursor-help items-center gap-1 rounded-full bg-status-warning/20 px-2 py-0.5 text-xs font-medium text-status-warning"
                                  onMouseEnter={() => setTooltipPkg(pkg.name)}
                                  onMouseLeave={() => setTooltipPkg(null)}
                                  data-testid={`held-badge-${pkg.name}`}
                                >
                                  {/* Held icon */}
                                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  {getHoldReasonLabel(pkg.hold_reason, pkg.phased_percentage)}
                                </span>
                                {/* US0198 AC3: Tooltip showing hold reason */}
                                {tooltipPkg === pkg.name && (
                                  <div
                                    className="absolute left-0 bottom-full z-10 mb-1 w-64 rounded-md border border-border-default bg-bg-primary p-2 text-xs text-text-secondary shadow-lg"
                                    data-testid={`tooltip-${pkg.name}`}
                                  >
                                    {getHoldReasonDescription(
                                      pkg.hold_reason,
                                      pkg.phased_percentage
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {pkg.status === 'upgradable' && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-status-success/20 px-2 py-0.5 text-xs font-medium text-status-success"
                                data-testid={`upgradable-badge-${pkg.name}`}
                              >
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Ready
                              </span>
                            )}
                            {/* Security badge */}
                            {pkg.is_security && (
                              <span className="inline-flex items-center gap-1 text-status-error">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="text-xs">Security</span>
                              </span>
                            )}
                          </div>
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
                        'bg-status-error/20 text-status-error hover:bg-status-error/30',
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

                  {/* US0198 AC4: Show accurate count of what WILL upgrade */}
                  <button
                    onClick={() => handleAction('apt_upgrade_all')}
                    disabled={actionLoading !== null || upgradableCount === 0}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'bg-status-info/20 text-status-info hover:bg-status-info/30',
                      (actionLoading === 'apt_upgrade_all' || upgradableCount === 0) &&
                        'opacity-50 cursor-not-allowed'
                    )}
                    data-testid="apply-all-button"
                    title={
                      upgradableCount === 0
                        ? 'No packages can be upgraded (all held back)'
                        : undefined
                    }
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {actionLoading === 'apt_upgrade_all'
                      ? 'Queuing...'
                      : `Apply All (${upgradableCount})`}
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
                <div
                  className="mt-4 border-t border-border-default pt-4 text-sm text-text-tertiary"
                  data-testid="readonly-actions-notice"
                >
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
