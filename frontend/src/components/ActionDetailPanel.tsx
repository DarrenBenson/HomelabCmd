import { X, CheckCircle, XCircle, Clock, Loader2, Ban } from 'lucide-react';
import type { Action, ActionStatus } from '../types/action';
import { formatActionType } from '../lib/formatters';

interface ActionDetailPanelProps {
  action: Action;
  onClose: () => void;
  serverName?: string;
  onCancel?: (actionId: number) => void;
  cancelLoading?: boolean;
}

const statusConfig: Record<ActionStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'text-text-tertiary',
    bgColor: 'bg-text-tertiary/10',
    icon: <Clock className="w-4 h-4" />,
  },
  approved: {
    label: 'Approved',
    color: 'text-status-warning',
    bgColor: 'bg-status-warning/10',
    icon: <Clock className="w-4 h-4" />,
  },
  executing: {
    label: 'Executing',
    color: 'text-status-info',
    bgColor: 'bg-status-info/10',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  completed: {
    label: 'Completed',
    color: 'text-status-success',
    bgColor: 'bg-status-success/10',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  failed: {
    label: 'Failed',
    color: 'text-status-error',
    bgColor: 'bg-status-error/10',
    icon: <XCircle className="w-4 h-4" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-text-muted',
    bgColor: 'bg-text-muted/10',
    icon: <Ban className="w-4 h-4" />,
  },
};

function formatTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '-';
  return new Date(isoTimestamp).toLocaleString();
}

export function ActionDetailPanel({ action, onClose, serverName, onCancel, cancelLoading }: ActionDetailPanelProps) {
  const statConfig = statusConfig[action.status];
  const displayServerName = serverName || action.server_id;
  const canCancel = (action.status === 'pending' || action.status === 'approved') && onCancel;

  // Build title
  const actionTitle = action.service_name
    ? `${formatActionType(action.action_type)}: ${action.service_name}`
    : formatActionType(action.action_type);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="action-detail-backdrop"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-bg-primary border-l border-border-default shadow-xl z-50 overflow-y-auto"
        data-testid="action-detail-panel"
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-primary border-b border-border-default px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Action Details</h2>
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
          {/* Title and status */}
          <div>
            <h3 className="text-xl font-bold text-text-primary mb-2" data-testid="action-title">
              {actionTitle}
            </h3>
            <p className="text-text-secondary font-mono text-sm mb-3" data-testid="action-server">
              on {displayServerName}
            </p>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${statConfig.bgColor} ${statConfig.color}`}
              data-testid="action-status-badge"
            >
              {statConfig.icon}
              <span className="font-medium">{statConfig.label}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-text-tertiary uppercase tracking-wider">Timeline</h4>
            <div className="space-y-3 border-l-2 border-border-default pl-4 ml-2">
              {/* Created */}
              <TimelineEntry
                label="Created"
                timestamp={action.created_at}
                detail={`by ${action.created_by}`}
                testId="timeline-created"
              />

              {/* Approved */}
              {action.approved_at && (
                <TimelineEntry
                  label="Approved"
                  timestamp={action.approved_at}
                  detail={`by ${action.approved_by}`}
                  testId="timeline-approved"
                />
              )}

              {/* Rejected */}
              {action.rejected_at && (
                <TimelineEntry
                  label="Rejected"
                  timestamp={action.rejected_at}
                  detail={`by ${action.rejected_by}`}
                  testId="timeline-rejected"
                />
              )}

              {/* Executed */}
              {action.executed_at && (
                <TimelineEntry
                  label="Executed"
                  timestamp={action.executed_at}
                  testId="timeline-executed"
                />
              )}

              {/* Completed */}
              {action.completed_at && (
                <TimelineEntry
                  label={action.status === 'failed' ? 'Failed' : 'Completed'}
                  timestamp={action.completed_at}
                  testId="timeline-completed"
                />
              )}
            </div>
          </div>

          {/* Rejection reason */}
          {action.rejection_reason && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-tertiary uppercase tracking-wider">Rejection Reason</h4>
              <p className="text-text-secondary text-sm bg-bg-secondary p-3 rounded-md" data-testid="rejection-reason">
                {action.rejection_reason}
              </p>
            </div>
          )}

          {/* Command */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-text-tertiary uppercase tracking-wider">Command</h4>
            <div
              className="bg-bg-tertiary border border-border-default rounded-md p-3 font-mono text-sm text-text-primary overflow-x-auto"
              data-testid="action-command"
            >
              {action.command}
            </div>
          </div>

          {/* Execution details */}
          {action.executed_at && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-text-tertiary uppercase tracking-wider">Execution Details</h4>

              {/* Exit code */}
              {action.exit_code !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-tertiary">Exit code:</span>
                  <span
                    className={`font-mono text-sm font-medium ${
                      action.exit_code === 0 ? 'text-status-success' : 'text-status-error'
                    }`}
                    data-testid="exit-code"
                  >
                    {action.exit_code}
                  </span>
                </div>
              )}

              {/* Output (stdout) */}
              <div className="space-y-2">
                <span className="text-sm text-text-tertiary">Output:</span>
                <div
                  className="bg-bg-tertiary border border-border-default rounded-md p-3 font-mono text-xs text-text-secondary max-h-48 overflow-auto whitespace-pre-wrap"
                  data-testid="action-stdout"
                >
                  {action.stdout || (action.status === 'executing' ? 'Executing...' : '(empty)')}
                </div>
              </div>

              {/* Stderr - show as Warnings if exit code 0, Errors otherwise */}
              {action.stderr && (
                <div className="space-y-2">
                  <span className="text-sm text-text-tertiary">
                    {action.exit_code === 0 ? 'Warnings:' : 'Errors:'}
                  </span>
                  <div
                    className={`rounded-md p-3 font-mono text-xs max-h-48 overflow-auto whitespace-pre-wrap ${
                      action.exit_code === 0
                        ? 'bg-status-warning/5 border border-status-warning/20 text-status-warning'
                        : 'bg-status-error/5 border border-status-error/20 text-status-error'
                    }`}
                    data-testid="action-stderr"
                  >
                    {action.stderr}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alert link */}
          {action.alert_id && (
            <div className="text-sm text-text-tertiary">
              Triggered by Alert #{action.alert_id}
            </div>
          )}

          {/* Cancel button for pending/approved actions */}
          {canCancel && (
            <div className="pt-4 border-t border-border-default">
              <button
                onClick={() => onCancel(action.id)}
                disabled={cancelLoading}
                className="w-full px-4 py-2 bg-status-error/10 text-status-error border border-status-error/30 rounded-md hover:bg-status-error/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="cancel-action-button"
              >
                {cancelLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Cancel Action
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface TimelineEntryProps {
  label: string;
  timestamp: string | null;
  detail?: string;
  testId?: string;
}

function TimelineEntry({ label, timestamp, detail, testId }: TimelineEntryProps) {
  return (
    <div className="relative" data-testid={testId}>
      <div className="absolute -left-[1.35rem] top-1.5 w-2 h-2 rounded-full bg-border-default" />
      <div className="text-sm">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="text-text-tertiary ml-2">{formatTimestamp(timestamp)}</span>
        {detail && <span className="text-text-muted ml-1">{detail}</span>}
      </div>
    </div>
  );
}
