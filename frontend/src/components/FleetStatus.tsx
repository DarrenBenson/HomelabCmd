/**
 * FleetStatus - Unified dashboard status component
 *
 * Replaces AlertBanner and SummaryBar with a single, streamlined component.
 * Shows fleet health at a glance with alert list when issues exist.
 * Includes collapsible search and filter panel.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Monitor,
  Search,
  X,
} from 'lucide-react';
import { AlertCard } from './AlertCard';
import { FilterChip } from './FilterChip';
import type { Alert } from '../types/alert';
import type { Server } from '../types/server';

export type StatusFilter = 'all' | 'online' | 'offline' | 'warning' | 'paused';

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'warning', label: 'Warning' },
  { value: 'paused', label: 'Paused' },
];

export interface FleetStatusProps {
  /** All servers/machines in the fleet */
  machines: readonly Server[];
  /** Active alerts to display */
  alerts: Alert[];
  /** Callback when acknowledging an alert */
  onAcknowledge: (alertId: number) => void;
  /** Callback when selecting an alert for detail view */
  onAlertSelect?: (alert: Alert) => void;
  /** Set of alert IDs currently being acknowledged */
  acknowledgingIds: Set<number>;
  /** Maximum number of alerts to display before showing "more" indicator */
  maxAlertDisplay?: number;
  /** Callback for refresh action */
  onRefresh: () => void;
  /** Whether data is currently refreshing */
  isRefreshing: boolean;
  /** Current search query */
  searchQuery?: string;
  /** Search query change handler */
  onSearchChange?: (query: string) => void;
  /** Current status filter */
  statusFilter?: StatusFilter;
  /** Status filter change handler */
  onStatusChange?: (status: StatusFilter) => void;
  /** Clear all filters handler */
  onClearFilters?: () => void;
  /** Whether any filters are active */
  hasActiveFilters?: boolean;
}

/**
 * FleetStatus component - Fleet health overview with alerts and filters
 */
export function FleetStatus({
  machines,
  alerts,
  onAcknowledge,
  onAlertSelect,
  acknowledgingIds,
  maxAlertDisplay = 3,
  onRefresh,
  isRefreshing,
  searchQuery = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusChange,
  onClearFilters,
  hasActiveFilters = false,
}: FleetStatusProps) {
  // Local state for filter panel visibility
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Calculate fleet stats
  const stats = useMemo(() => {
    const onlineCount = machines.filter((m) => m.status === 'online').length;
    const offlineCount = machines.filter((m) => m.status === 'offline').length;

    return {
      total: machines.length,
      online: onlineCount,
      offline: offlineCount,
    };
  }, [machines]);

  const displayAlerts = alerts.slice(0, maxAlertDisplay);
  const hasMoreAlerts = alerts.length > maxAlertDisplay;
  const hasAlerts = alerts.length > 0;
  const hasFilterSupport = Boolean(onSearchChange && onStatusChange);

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden"
      data-testid="fleet-status"
    >
      {/* Header row */}
      <div
        className={`p-4 flex flex-wrap items-center justify-between gap-3 ${
          hasAlerts || filterPanelOpen ? 'border-b border-border-default' : ''
        }`}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {hasAlerts ? (
            <>
              <AlertTriangle
                className="w-5 h-5 text-status-warning flex-shrink-0"
                aria-hidden="true"
              />
              <span
                className="text-text-primary font-medium"
                data-testid="alert-count"
              >
                {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <>
              <CheckCircle
                className="w-5 h-5 text-status-success flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-text-primary font-medium">
                All Systems Operational
              </span>
            </>
          )}
        </div>

        {/* Stats and actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Machine count */}
          <div
            className="flex items-center gap-1.5 text-sm text-text-secondary"
            data-testid="stat-machines"
          >
            <Monitor className="w-4 h-4" aria-hidden="true" />
            <span>{stats.total} Machine{stats.total !== 1 ? 's' : ''}</span>
          </div>

          {/* Separator */}
          <div
            className="w-px h-4 bg-border-default hidden sm:block"
            aria-hidden="true"
          />

          {/* Online count */}
          <div
            className="flex items-center gap-1.5 text-sm"
            data-testid="stat-online"
          >
            <span className="w-2 h-2 rounded-full bg-status-success" aria-hidden="true" />
            <span className="text-status-success font-medium">{stats.online} Online</span>
          </div>

          {/* Offline count - only show if > 0 */}
          {stats.offline > 0 && (
            <div
              className="flex items-center gap-1.5 text-sm"
              data-testid="stat-offline"
            >
              <span className="w-2 h-2 rounded-full bg-status-error" aria-hidden="true" />
              <span className="text-status-error font-medium">{stats.offline} Offline</span>
            </div>
          )}

          {/* Separator */}
          <div
            className="w-px h-4 bg-border-default hidden sm:block"
            aria-hidden="true"
          />

          {/* Search/Filter toggle button - only show if filter support enabled */}
          {hasFilterSupport && (
            <button
              type="button"
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className={`relative flex items-center gap-1.5 px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-status-info ${
                filterPanelOpen
                  ? 'text-text-primary bg-bg-tertiary'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
              data-testid="filter-toggle-button"
              aria-label={filterPanelOpen ? 'Hide filters' : 'Show filters'}
              aria-expanded={filterPanelOpen}
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm hidden sm:inline">Filter</span>
              {/* Active filter indicator */}
              {hasActiveFilters && !filterPanelOpen && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-status-info rounded-full border-2 border-bg-secondary"
                  data-testid="filter-active-indicator"
                  aria-label="Filters active"
                />
              )}
            </button>
          )}

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2 py-1 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="refresh-button"
            aria-label={isRefreshing ? 'Refreshing...' : 'Refresh data'}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="text-sm hidden sm:inline">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </button>

          {/* View History / View All link */}
          <Link
            to={hasAlerts ? '/alerts?status=open' : '/alerts'}
            className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
            data-testid={hasAlerts ? 'view-all-link' : 'view-history-link'}
          >
            {hasAlerts ? 'View All' : 'View History'}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Filter panel - collapsible */}
      {hasFilterSupport && filterPanelOpen && (
        <div
          className={`p-4 space-y-3 bg-bg-primary/50 ${hasAlerts ? 'border-b border-border-default' : ''}`}
          data-testid="filter-panel"
        >
          {/* Search box */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearchChange?.('');
                }
              }}
              className="w-full pl-10 pr-10 py-2 bg-bg-secondary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-info focus:border-transparent"
              data-testid="search-input"
              aria-label="Search servers"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-primary rounded"
                aria-label="Clear search"
                data-testid="clear-search-button"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status filters */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {statusFilters.map((filter) => (
                <FilterChip
                  key={filter.value}
                  label={filter.label}
                  active={statusFilter === filter.value}
                  onClick={() => onStatusChange?.(filter.value)}
                  testId={`status-filter-${filter.value}`}
                />
              ))}
            </div>

            {/* Clear button */}
            {hasActiveFilters && (
              <>
                <div className="w-px h-6 bg-border-default" aria-hidden="true" />
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="px-3 py-1 text-sm font-medium text-text-tertiary hover:text-text-primary transition-colors"
                  data-testid="clear-filters-button"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Alert list - only shown when alerts exist */}
      {hasAlerts && (
        <div className="p-4 space-y-2" data-testid="alert-list">
          {displayAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={onAcknowledge}
              onSelect={onAlertSelect}
              isAcknowledging={acknowledgingIds.has(alert.id)}
            />
          ))}

          {/* Show more indicator */}
          {hasMoreAlerts && (
            <div className="pt-2 text-center">
              <Link
                to="/alerts?status=open"
                className="text-sm text-status-info hover:text-status-info/80 transition-colors"
                data-testid="view-more-link"
              >
                View All {alerts.length} Alerts
                <ChevronRight className="w-4 h-4 inline ml-1" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
