import { Check, Loader2 } from 'lucide-react';
import type { Alert, AlertSeverity } from '../types/alert';
import { formatRelativeTime } from '../lib/formatters';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (alertId: number) => void;
  onSelect?: (alert: Alert) => void;
  isAcknowledging?: boolean;
}

const severityConfig: Record<AlertSeverity, { label: string; borderColor: string; badgeColor: string }> = {
  critical: {
    label: 'CRITICAL',
    borderColor: 'border-l-status-error',
    badgeColor: 'bg-status-error text-bg-primary',
  },
  high: {
    label: 'HIGH',
    borderColor: 'border-l-status-warning',
    badgeColor: 'bg-status-warning text-bg-primary',
  },
  medium: {
    label: 'MEDIUM',
    borderColor: 'border-l-status-info',
    badgeColor: 'bg-status-info text-bg-primary',
  },
  low: {
    label: 'LOW',
    borderColor: 'border-l-text-secondary',
    badgeColor: 'bg-text-tertiary text-bg-primary',
  },
};

export function AlertCard({ alert, onAcknowledge, onSelect, isAcknowledging = false }: AlertCardProps) {
  const config = severityConfig[alert.severity];
  const canAcknowledge = alert.can_acknowledge;

  return (
    <div
      className={`bg-bg-secondary border border-border-default ${config.borderColor} border-l-4 rounded-lg p-3 flex items-start justify-between gap-3 ${onSelect ? 'cursor-pointer hover:bg-bg-tertiary transition-colors' : ''}`}
      data-testid="alert-card"
      data-severity={alert.severity}
      onClick={onSelect ? () => onSelect(alert) : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`${config.badgeColor} text-[10px] font-mono font-bold px-1.5 py-0.5 rounded`}
            data-testid="alert-severity"
          >
            {config.label}
          </span>
          <span className="text-text-primary text-sm font-medium truncate" data-testid="alert-title">
            {alert.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-tertiary font-mono">
          <span data-testid="alert-server">{alert.server_name || alert.server_id}</span>
          <span>•</span>
          <span data-testid="alert-time">{formatRelativeTime(alert.created_at)}</span>
        </div>
      </div>

      {canAcknowledge && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcknowledge(alert.id);
          }}
          disabled={isAcknowledging}
          className="flex-shrink-0 p-1.5 text-text-tertiary hover:text-status-success hover:bg-bg-tertiary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Acknowledge alert"
          data-testid="alert-acknowledge-button"
        >
          {isAcknowledging ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
