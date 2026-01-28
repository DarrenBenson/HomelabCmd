import { X, Check, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import type { Alert, AlertSeverity, AlertStatus } from '../types/alert';
import { formatRelativeTime } from '../lib/formatters';

interface AlertDetailPanelProps {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: (alertId: number) => void;
  onResolve: (alertId: number) => void;
  onRestartService?: (serverId: string, serviceName: string) => void;
  isActionInProgress?: boolean;
  restartMessage?: { type: 'success' | 'info' | 'error'; text: string } | null;
  isRestartQueued?: boolean;
}

const severityConfig: Record<AlertSeverity, { label: string; badgeColor: string; textColor: string }> = {
  critical: {
    label: 'CRITICAL',
    badgeColor: 'bg-status-error text-bg-primary',
    textColor: 'text-status-error',
  },
  high: {
    label: 'HIGH',
    badgeColor: 'bg-status-warning text-bg-primary',
    textColor: 'text-status-warning',
  },
  medium: {
    label: 'MEDIUM',
    badgeColor: 'bg-status-info text-bg-primary',
    textColor: 'text-status-info',
  },
  low: {
    label: 'LOW',
    badgeColor: 'bg-text-tertiary text-bg-primary',
    textColor: 'text-text-tertiary',
  },
};

const statusConfig: Record<AlertStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-status-warning' },
  acknowledged: { label: 'Acknowledged', color: 'text-status-info' },
  resolved: { label: 'Resolved', color: 'text-status-success' },
};

export function AlertDetailPanel({
  alert,
  onClose,
  onAcknowledge,
  onResolve,
  onRestartService,
  isActionInProgress = false,
  restartMessage,
  isRestartQueued = false,
}: AlertDetailPanelProps) {
  const sevConfig = severityConfig[alert.severity];
  const statConfig = statusConfig[alert.status];

  const canAcknowledge = alert.can_acknowledge;
  const canResolve = alert.can_resolve;
  const canRestart = alert.service_name && alert.status !== 'resolved' && onRestartService && !isRestartQueued;

  const handleRestartService = () => {
    if (!alert.service_name || !onRestartService) {
      return;
    }
    onRestartService(alert.server_id, alert.service_name);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="detail-panel-backdrop"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-primary border-l border-border-default shadow-xl z-50 overflow-y-auto"
        data-testid="alert-detail-panel"
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-primary border-b border-border-default px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Alert Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
            aria-label="Close panel"
            data-testid="close-panel-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title with severity */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`${sevConfig.badgeColor} text-xs font-mono font-bold px-2 py-1 rounded`}>
                {sevConfig.label}
              </span>
            </div>
            <h3 className={`text-xl font-bold ${sevConfig.textColor}`} data-testid="detail-title">
              {alert.title}
            </h3>
          </div>

          {/* Details grid */}
          <div className="space-y-4">
            <DetailRow label="Server" value={alert.server_name || alert.server_id} testId="detail-server" />
            <DetailRow label="Type" value={alert.alert_type} testId="detail-type" />
            <DetailRow
              label="Status"
              value={<span className={statConfig.color}>{statConfig.label}</span>}
              testId="detail-status"
            />

            {alert.threshold_value !== null && (
              <DetailRow
                label="Threshold"
                value={`${alert.threshold_value}%`}
                testId="detail-threshold"
              />
            )}

            {alert.actual_value !== null && (
              <DetailRow
                label="Actual"
                value={`${alert.actual_value}%`}
                testId="detail-actual"
              />
            )}

            {alert.message && (
              <DetailRow label="Message" value={alert.message} testId="detail-message" />
            )}

            <div className="border-t border-border-default pt-4 space-y-3">
              <DetailRow
                label="Created"
                value={
                  <span title={alert.created_at}>
                    {formatRelativeTime(alert.created_at)}
                    <span className="text-text-tertiary ml-2 text-xs">
                      ({new Date(alert.created_at).toLocaleString()})
                    </span>
                  </span>
                }
                testId="detail-created"
              />

              {alert.acknowledged_at && (
                <DetailRow
                  label="Acknowledged"
                  value={
                    <span title={alert.acknowledged_at}>
                      {formatRelativeTime(alert.acknowledged_at)}
                    </span>
                  }
                  testId="detail-acknowledged"
                />
              )}

              {alert.resolved_at && (
                <DetailRow
                  label="Resolved"
                  value={
                    <span title={alert.resolved_at}>
                      {formatRelativeTime(alert.resolved_at)}
                      {alert.auto_resolved && (
                        <span className="ml-2 text-xs text-text-tertiary">(auto)</span>
                      )}
                    </span>
                  }
                  testId="detail-resolved"
                />
              )}
            </div>
          </div>

          {/* Restart feedback message */}
          {restartMessage && (
            <div
              className={`rounded-md p-3 text-sm ${
                restartMessage.type === 'success'
                  ? 'bg-status-success/10 text-status-success'
                  : restartMessage.type === 'info'
                    ? 'bg-status-info/10 text-status-info'
                    : 'bg-status-error/10 text-status-error'
              }`}
              data-testid="restart-message"
            >
              {restartMessage.text}
            </div>
          )}

          {/* Actions */}
          {(canAcknowledge || canResolve || canRestart || isRestartQueued) && (
            <div className="border-t border-border-default pt-6 flex flex-col gap-3">
              {/* Restart service button for service alerts */}
              {canRestart && (
                <button
                  onClick={handleRestartService}
                  disabled={isActionInProgress}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-status-warning text-bg-primary rounded-md font-medium hover:bg-status-warning/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="detail-restart-button"
                >
                  {isActionInProgress ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Restart {alert.service_name}
                </button>
              )}

              {/* Show queued badge when restart is pending approval */}
              {isRestartQueued && alert.service_name && (
                <div
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-status-info/10 border border-status-info/50 text-status-info rounded-md font-medium"
                  data-testid="detail-restart-queued"
                >
                  Restart {alert.service_name} - Queued
                </div>
              )}

              <div className="flex gap-3">
                {canAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={isActionInProgress}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="detail-acknowledge-button"
                  >
                    {isActionInProgress ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Acknowledge
                  </button>
                )}

                {canResolve && (
                  <button
                    onClick={() => onResolve(alert.id)}
                    disabled={isActionInProgress}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-status-success text-bg-primary rounded-md font-medium hover:bg-status-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="detail-resolve-button"
                  >
                    {isActionInProgress ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Resolve
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  testId?: string;
}

function DetailRow({ label, value, testId }: DetailRowProps) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-text-tertiary flex-shrink-0">{label}</span>
      <span className="text-sm text-text-primary text-right font-mono" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
