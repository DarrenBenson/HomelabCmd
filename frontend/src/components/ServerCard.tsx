import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { StatusLED } from './StatusLED';
import { MachineTypeBadge } from './MachineTypeBadge';
import { MachineTypeIcon } from './MachineTypeIcon';
import type { Server } from '../types/server';

interface ServerCardProps {
  server: Server;
  onClick?: () => void;
}

/**
 * US0090: Format last_seen timestamp as relative time for workstations
 */
function getWorkstationLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Last seen: Unknown';
  return `Last seen: ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '--';
  return `${Math.round(value)}%`;
}

function formatUpdateCount(count: number | null): string {
  if (count === null) return '--';
  if (count > 99) return '99+';
  return String(count);
}

export function ServerCard({ server, onClick }: ServerCardProps) {
  const metrics = server.latest_metrics;
  const isInactive = server.is_inactive;

  // US0090: Check if this is an offline workstation
  const isWorkstation = server.machine_type === 'workstation';
  const isOfflineWorkstation = server.status === 'offline' && isWorkstation;

  // US0090: Dynamic time updates for offline workstations (every 60 seconds)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isOfflineWorkstation) {
      const interval = setInterval(() => setTick((t) => t + 1), 60000);
      return () => clearInterval(interval);
    }
  }, [isOfflineWorkstation]);

  // US0090: Tooltip for workstation status
  const statusTitle = isOfflineWorkstation
    ? 'Workstation - intermittent availability expected'
    : undefined;

  // US0091: Machine type for visual distinction (default to 'server')
  const machineType = server.machine_type ?? 'server';

  // US0091: Tooltip for machine type badge and icon
  const machineTypeTooltip = isWorkstation
    ? 'Workstation - intermittent availability expected'
    : 'Server - 24/7 uptime expected';

  // US0091: Border styling based on machine type
  const borderColour = isWorkstation ? 'border-l-purple-500' : 'border-l-blue-500';
  const borderStyle = isOfflineWorkstation ? 'border-dashed' : '';

  return (
    <div
      className={`bg-bg-secondary border border-border-default rounded-lg p-4 cursor-pointer transition-all duration-150 hover:border-border-strong hover:shadow-lg border-l-4 ${borderColour} ${borderStyle} ${
        isInactive ? 'opacity-50 grayscale' : ''
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      data-testid="server-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {/* US0091: Machine type icon */}
        <MachineTypeIcon
          type={machineType}
          title={machineTypeTooltip}
          className="text-text-tertiary flex-shrink-0"
        />
        <StatusLED
          status={server.status}
          isWorkstation={isWorkstation}
          title={statusTitle}
        />
        <h3
          className="font-sans font-semibold text-text-primary truncate"
          data-testid="server-hostname"
        >
          {server.display_name || server.hostname}
        </h3>
        {/* US0091: Machine type badge */}
        <MachineTypeBadge type={machineType} title={machineTypeTooltip} />
        {/* Inactive badge (EP0007) */}
        {server.is_inactive && (
          <span
            className="ml-auto flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded bg-text-tertiary/20 text-text-tertiary"
            data-testid="inactive-badge"
            title="Agent removed - server inactive"
          >
            Inactive
          </span>
        )}
        {/* Maintenance mode badge (US0029 AC4) */}
        {!server.is_inactive && server.is_paused && (
          <span
            className="ml-auto flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded bg-status-warning/20 text-status-warning"
            data-testid="maintenance-badge"
            title="Server is in maintenance mode"
          >
            Maintenance
          </span>
        )}
      </div>

      {/* US0090: Last seen display for offline workstations */}
      {isOfflineWorkstation && (
        <div
          className="font-mono text-xs text-text-muted mb-3"
          data-testid="workstation-last-seen"
        >
          {getWorkstationLastSeen(server.last_seen)}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center" data-testid="server-metrics">
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.cpu_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            CPU
          </div>
        </div>
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.memory_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            RAM
          </div>
        </div>
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.disk_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Disk
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border-subtle">
        <span className="font-mono text-xs text-text-tertiary">
          ↑ {formatUptime(metrics?.uptime_seconds ?? null)}
        </span>
        {/* Update indicator */}
        {server.updates_available !== null && server.updates_available > 0 ? (
          <span
            className="font-mono text-xs"
            data-testid="update-indicator"
          >
            <span className="text-text-tertiary">
              {formatUpdateCount(server.updates_available)} updates
            </span>
            {server.security_updates !== null && server.security_updates > 0 && (
              <span className="text-status-warning ml-1">
                ({formatUpdateCount(server.security_updates)} security)
              </span>
            )}
          </span>
        ) : server.security_updates !== null && server.security_updates > 0 ? (
          <span
            className="font-mono text-xs text-status-warning"
            data-testid="update-indicator"
          >
            {formatUpdateCount(server.security_updates)} security updates
          </span>
        ) : server.updates_available === 0 ? (
          <span
            className="font-mono text-xs text-status-success"
            data-testid="update-indicator"
          >
            Up to date
          </span>
        ) : null}
      </div>
    </div>
  );
}
