/**
 * SummaryBar - Dashboard fleet health summary
 * US0134: Dashboard Summary Bar
 *
 * Displays at-a-glance fleet health information:
 * - Total machines count
 * - Online count (green)
 * - Offline servers (red, only when > 0)
 * - Workstation status (X/Y format, blue)
 * - Refresh button
 * - All healthy indicator
 */

import React, { useMemo } from 'react';
import {
  Monitor,
  CheckCircle,
  AlertTriangle,
  Laptop,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import type { Server } from '../types/server';
import type { StatusFilter, TypeFilter } from './DashboardFilters';

// Stat colour variants
type StatColour = 'default' | 'green' | 'red' | 'blue';

interface StatProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  colour?: StatColour;
  onClick?: () => void;
  testId?: string;
}

/**
 * Individual stat display with icon, label, and value
 */
function Stat({
  icon: Icon,
  label,
  value,
  colour = 'default',
  onClick,
  testId,
}: StatProps) {
  const colourClasses: Record<StatColour, string> = {
    default: 'text-text-secondary',
    green: 'text-status-success',
    red: 'text-status-error',
    blue: 'text-status-info',
  };

  const baseClasses =
    'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors';
  const interactiveClasses = onClick
    ? 'hover:bg-bg-tertiary cursor-pointer focus:outline-none focus:ring-2 focus:ring-status-info'
    : '';

  const content = (
    <>
      <Icon className={`w-4 h-4 ${colourClasses[colour]}`} aria-hidden="true" />
      <span className="text-sm text-text-tertiary">{label}</span>
      <span className={`text-lg font-bold ${colourClasses[colour]}`}>
        {value}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`${baseClasses} ${interactiveClasses}`}
        onClick={onClick}
        data-testid={testId}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClasses} data-testid={testId}>
      {content}
    </div>
  );
}

// Filter callback type for summary bar click actions
export type SummaryFilterCallback = (
  status?: StatusFilter,
  type?: TypeFilter
) => void;

export interface SummaryBarProps {
  machines: readonly Server[];
  onFilter: SummaryFilterCallback;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * SummaryBar component - Fleet health overview
 */
export function SummaryBar({
  machines,
  onFilter,
  onRefresh,
  isRefreshing,
}: SummaryBarProps) {
  // Calculate stats from machines
  const stats = useMemo(() => {
    const servers = machines.filter((m) => m.machine_type === 'server');
    const workstations = machines.filter((m) => m.machine_type === 'workstation');

    const onlineCount = machines.filter((m) => m.status === 'online').length;
    const offlineServers = servers.filter((m) => m.status === 'offline').length;
    const onlineWorkstations = workstations.filter(
      (m) => m.status === 'online'
    ).length;

    return {
      total: machines.length,
      online: onlineCount,
      offlineServers,
      workstationsOnline: onlineWorkstations,
      workstationsTotal: workstations.length,
      allHealthy: offlineServers === 0,
      hasWorkstations: workstations.length > 0,
    };
  }, [machines]);

  return (
    <div
      className="flex flex-wrap items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-bg-secondary/50 rounded-lg"
      data-testid="summary-bar"
    >
      {/* Total Machines */}
      <Stat
        icon={Monitor}
        label="Machines"
        value={stats.total}
        testId="stat-machines"
      />

      {/* Online Count */}
      <Stat
        icon={CheckCircle}
        label="Online"
        value={stats.online}
        colour="green"
        onClick={() => onFilter('online', 'all')}
        testId="stat-online"
      />

      {/* Offline Servers - Only show when > 0 (AC4, AC8) */}
      {stats.offlineServers > 0 && (
        <Stat
          icon={AlertTriangle}
          label="Servers Offline"
          value={stats.offlineServers}
          colour="red"
          onClick={() => onFilter('offline', 'server')}
          testId="stat-servers-offline"
        />
      )}

      {/* All Healthy Indicator - Show when no offline servers (AC8) */}
      {stats.allHealthy && stats.total > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-status-success"
          data-testid="all-healthy-indicator"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-medium">All systems operational</span>
        </div>
      )}

      {/* Workstation Status - Only show when workstations exist (Edge Case 4) */}
      {stats.hasWorkstations && (
        <Stat
          icon={Laptop}
          label="Workstations"
          value={`${stats.workstationsOnline}/${stats.workstationsTotal}`}
          colour="blue"
          onClick={() => onFilter('all', 'workstation')}
          testId="stat-workstations"
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh Button (AC7) */}
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onRefresh}
        disabled={isRefreshing}
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
    </div>
  );
}
