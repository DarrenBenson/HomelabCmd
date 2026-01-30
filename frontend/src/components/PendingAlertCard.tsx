/**
 * PendingAlertCard component displays a pending breach countdown.
 *
 * Shows alerts that are waiting for their sustained duration to be met
 * before firing. Displays a countdown timer and current metric value.
 *
 * US0181: Alert Sustained Duration Configuration (AC4)
 */

import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import type { PendingBreach } from '../types/alert';

interface PendingAlertCardProps {
  breach: PendingBreach;
}

/**
 * Format time remaining into a human-readable string.
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) {
    return 'Firing soon...';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes} min`;
}

/**
 * Get display name for metric type.
 */
function getMetricLabel(metricType: string): string {
  switch (metricType) {
    case 'cpu':
      return 'CPU';
    case 'memory':
      return 'Memory';
    case 'disk':
      return 'Disk';
    default:
      return metricType.toUpperCase();
  }
}

export function PendingAlertCard({ breach }: PendingAlertCardProps) {
  const isCritical = breach.severity === 'critical';
  const serverName = breach.server_name || breach.server_id;
  const metricLabel = getMetricLabel(breach.metric_type);
  const timeRemaining = formatTimeRemaining(breach.time_until_alert);

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        isCritical
          ? 'border-status-error/30 bg-status-error/5'
          : 'border-status-warning/30 bg-status-warning/5'
      }`}
      data-testid="pending-alert-card"
    >
      <div className="flex items-center gap-3">
        {/* Severity icon */}
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            isCritical ? 'bg-status-error/20 text-status-error' : 'bg-status-warning/20 text-status-warning'
          }`}
        >
          {isCritical ? (
            <AlertCircle className="h-4 w-4" data-testid="severity-critical" />
          ) : (
            <AlertTriangle className="h-4 w-4" data-testid="severity-high" />
          )}
        </div>

        {/* Server and metric info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary" data-testid="server-name">
              {serverName}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                isCritical
                  ? 'bg-status-error/20 text-status-error'
                  : 'bg-status-warning/20 text-status-warning'
              }`}
              data-testid="metric-type"
            >
              {metricLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span data-testid="current-value">
              {breach.current_value !== null ? `${breach.current_value.toFixed(1)}%` : '-'}
            </span>
            <span>{'>'}</span>
            <span data-testid="threshold-value">{breach.threshold_value}%</span>
          </div>
        </div>
      </div>

      {/* Countdown timer */}
      <div
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
          isCritical ? 'bg-status-error/10 text-status-error' : 'bg-status-warning/10 text-status-warning'
        }`}
        data-testid="countdown"
      >
        <Clock className="h-4 w-4" />
        <span className="font-mono text-sm font-medium">{timeRemaining}</span>
      </div>
    </div>
  );
}
