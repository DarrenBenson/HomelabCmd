import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { AlertCard } from './AlertCard';
import type { Alert } from '../types/alert';

interface AlertBannerProps {
  alerts: Alert[];
  onAcknowledge: (alertId: number) => void;
  onAlertSelect?: (alert: Alert) => void;
  acknowledgingIds: Set<number>;
  maxDisplay?: number;
}

export function AlertBanner({
  alerts,
  onAcknowledge,
  onAlertSelect,
  acknowledgingIds,
  maxDisplay = 5,
}: AlertBannerProps) {
  const displayAlerts = alerts.slice(0, maxDisplay);
  const hasMore = alerts.length > maxDisplay;

  // Empty state - all systems operational
  if (alerts.length === 0) {
    return (
      <div
        className="bg-bg-secondary border border-status-success/30 rounded-lg p-4 flex items-center justify-between"
        data-testid="alert-banner-empty"
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-status-success" />
          <span className="text-text-primary font-medium">All Systems Operational</span>
        </div>
        <Link
          to="/alerts"
          className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          data-testid="view-history-link"
        >
          View History
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-lg p-4"
      data-testid="alert-banner"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-status-warning" />
          <span className="text-text-primary font-medium" data-testid="alert-count">
            {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Link
          to="/alerts?status=open"
          className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          data-testid="view-all-link"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Alert List */}
      <div className="space-y-2" data-testid="alert-list">
        {displayAlerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={onAcknowledge}
            onSelect={onAlertSelect}
            isAcknowledging={acknowledgingIds.has(alert.id)}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {hasMore && (
        <div className="mt-3 pt-3 border-t border-border-subtle text-center">
          <span className="text-sm text-text-tertiary">
            +{alerts.length - maxDisplay} more alert{alerts.length - maxDisplay !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
