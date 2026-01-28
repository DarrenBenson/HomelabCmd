import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Wrench, Pause, Play } from 'lucide-react';
import { StatusLED } from './StatusLED';
import { MachineTypeBadge } from './MachineTypeBadge';
import { MachineTypeIcon } from './MachineTypeIcon';
import { TailscaleBadge } from './TailscaleBadge';
import { MetricSparkline } from './MetricSparkline';
import { pauseServer, unpauseServer } from '../api/servers';
import type { Server } from '../types/server';

interface ServerCardProps {
  server: Server;
  onClick?: () => void;
  /** US0115: Called after pause toggle to refresh server list */
  onPauseToggle?: () => void;
  /** US0115: Message display handler */
  onMessage?: (msg: { type: 'success' | 'error' | 'info'; text: string }) => void;
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

/**
 * US0110: Format alert count with 99+ cap
 */
function formatAlertCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

/**
 * US0110: Build tooltip text for warning badge
 * Shows up to 3 alert titles, with "+N more" if exceeded
 */
function getAlertTooltip(count: number, summaries: string[] | undefined): string {
  if (!summaries || summaries.length === 0) {
    return `${count} active alert${count !== 1 ? 's' : ''}`;
  }

  const displayedAlerts = summaries.slice(0, 3);
  const remaining = count - displayedAlerts.length;

  let tooltip = displayedAlerts.join(', ');
  if (remaining > 0) {
    tooltip += `, +${remaining} more`;
  }

  return tooltip;
}

export function ServerCard({ server, onClick, onPauseToggle, onMessage }: ServerCardProps) {
  const metrics = server.latest_metrics;
  const isInactive = server.is_inactive;

  // US0115: Toggle button loading state
  const [toggling, setToggling] = useState(false);

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

  // US0109: Maintenance mode indicator - paused but not inactive
  const showMaintenanceIndicator = server.is_paused && !isInactive;

  // US0110: Warning state - online server with active alerts (not paused)
  const activeAlertCount = server.active_alert_count ?? 0;
  const hasWarning =
    server.status === 'online' &&
    !server.is_paused &&
    !isInactive &&
    activeAlertCount > 0;

  // US0110: Determine border colour based on state priority
  // Priority: offline > paused > warning > machine type default
  let effectiveBorderColour = borderColour;
  if (hasWarning) {
    effectiveBorderColour = 'border-l-yellow-500';
  }

  // US0110: StatusLED tooltip for warning state
  let effectiveStatusTitle = showMaintenanceIndicator ? 'Paused' : statusTitle;
  if (hasWarning) {
    effectiveStatusTitle = `Warning - ${activeAlertCount} active alert${activeAlertCount !== 1 ? 's' : ''}`;
  }

  // US0115: Handle pause/unpause toggle
  const handleTogglePause = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (toggling || isInactive) return;

    setToggling(true);
    try {
      if (server.is_paused) {
        await unpauseServer(server.id);
        onMessage?.({ type: 'success', text: `${server.display_name || server.hostname} resumed` });
      } else {
        await pauseServer(server.id);
        onMessage?.({ type: 'success', text: `${server.display_name || server.hostname} paused` });
      }
      onPauseToggle?.();
    } catch (err) {
      onMessage?.({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to toggle pause state',
      });
    } finally {
      setToggling(false);
    }
  }, [server, toggling, isInactive, onPauseToggle, onMessage]);

  return (
    <div
      className={`bg-bg-secondary border border-border-default rounded-lg p-4 cursor-pointer transition-all duration-150 hover:border-border-strong hover:shadow-lg border-l-4 ${effectiveBorderColour} ${borderStyle} ${
        isInactive ? 'opacity-50 grayscale' : ''
      } ${showMaintenanceIndicator ? 'ring-2 ring-amber-500/50 border-amber-500' : ''} ${
        hasWarning ? 'ring-2 ring-yellow-500/30' : ''
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
          isPaused={showMaintenanceIndicator}
          activeAlertCount={activeAlertCount}
          title={effectiveStatusTitle}
        />
        {/* US0109: Wrench icon for maintenance mode */}
        {showMaintenanceIndicator && (
          <span title="Maintenance mode - monitoring paused" data-testid="maintenance-wrench-icon">
            <Wrench
              className="w-4 h-4 text-amber-500 flex-shrink-0"
              aria-hidden="true"
            />
          </span>
        )}
        <h3
          className="font-sans font-semibold text-text-primary truncate"
          data-testid="server-hostname"
        >
          {server.display_name || server.hostname}
        </h3>
        {/* US0091: Machine type badge */}
        <MachineTypeBadge type={machineType} title={machineTypeTooltip} />
        {/* US0111: Tailscale connectivity badge */}
        <TailscaleBadge tailscaleHostname={server.tailscale_hostname} />
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
        {/* US0110: Warning badge with alert count */}
        {hasWarning && (
          <span
            className="ml-auto flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center gap-1"
            data-testid="warning-badge"
            title={getAlertTooltip(activeAlertCount, server.active_alert_summaries)}
          >
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            {formatAlertCount(activeAlertCount)} alert{activeAlertCount !== 1 ? 's' : ''}
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

      {/* Metrics Grid with Sparklines */}
      <div className="grid grid-cols-3 gap-2 text-center" data-testid="server-metrics">
        {/* CPU */}
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.cpu_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            CPU
          </div>
          {/* US0113: CPU Sparkline */}
          {!isInactive && (
            <div className="flex items-center justify-center mt-1" data-testid="cpu-sparkline-container">
              <MetricSparkline
                serverId={server.id}
                metric="cpu_percent"
                period="30m"
                isOffline={server.status === 'offline'}
              />
            </div>
          )}
        </div>
        {/* RAM */}
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.memory_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            RAM
          </div>
          {/* US0113: Memory Sparkline */}
          {!isInactive && (
            <div className="flex items-center justify-center mt-1" data-testid="memory-sparkline-container">
              <MetricSparkline
                serverId={server.id}
                metric="memory_percent"
                period="30m"
                isOffline={server.status === 'offline'}
              />
            </div>
          )}
        </div>
        {/* Disk */}
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.disk_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Disk
          </div>
          {/* US0113: Disk Sparkline */}
          {!isInactive && (
            <div className="flex items-center justify-center mt-1" data-testid="disk-sparkline-container">
              <MetricSparkline
                serverId={server.id}
                metric="disk_percent"
                period="30m"
                isOffline={server.status === 'offline'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          {/* US0115: Pause/Play toggle button */}
          {!isInactive && onPauseToggle && (
            <button
              onClick={handleTogglePause}
              disabled={toggling}
              className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-status-info"
              aria-label={server.is_paused ? 'Resume monitoring' : 'Pause monitoring'}
              title={server.is_paused ? 'Resume monitoring' : 'Pause monitoring'}
              data-testid="toggle-pause-button"
            >
              {server.is_paused ? (
                <Play className="w-4 h-4 text-status-success" aria-hidden="true" />
              ) : (
                <Pause className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
              )}
            </button>
          )}
          <span className="font-mono text-xs text-text-tertiary">
            ↑ {formatUptime(metrics?.uptime_seconds ?? null)}
          </span>
        </div>
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
