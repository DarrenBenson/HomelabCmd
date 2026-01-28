/**
 * Card displaying a single pending action with approve/reject buttons (US0030 AC3, AC4, AC5, AC6).
 */

import { Check, X, Wrench } from 'lucide-react';
import type { Action } from '../types/action';
import { formatRelativeTime } from '../lib/formatters';

interface PendingActionCardProps {
  action: Action;
  onApprove: (actionId: number) => void;
  onReject: (action: Action) => void;
  isApproving?: boolean;
}

export function PendingActionCard({
  action,
  onApprove,
  onReject,
  isApproving,
}: PendingActionCardProps) {
  const actionDescription =
    action.action_type === 'restart_service'
      ? `Restart Service: ${action.service_name}`
      : action.action_type === 'clear_logs'
        ? 'Clear Logs'
        : action.action_type;

  return (
    <div
      className="bg-bg-secondary border border-border-subtle rounded-lg p-3"
      data-testid={`pending-action-${action.id}`}
    >
      {/* Header with server name and maintenance badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-semibold text-sm text-text-primary"
          data-testid="action-server-name"
        >
          {action.server_id}
        </span>
        <span
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-status-warning/20 text-status-warning"
          data-testid="maintenance-mode-badge"
        >
          <Wrench className="w-3 h-3" />
          Maintenance Mode
        </span>
      </div>

      {/* Action description */}
      <p className="text-sm text-text-secondary mb-1" data-testid="action-description">
        {actionDescription}
      </p>

      {/* Created time */}
      <p className="text-xs text-text-tertiary mb-3" data-testid="action-created-at">
        Created: {formatRelativeTime(action.created_at)}
      </p>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onApprove(action.id)}
          disabled={isApproving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-status-success/20 text-status-success hover:bg-status-success/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="approve-button"
        >
          <Check className="w-3.5 h-3.5" />
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() => onReject(action)}
          disabled={isApproving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-status-error/20 text-status-error hover:bg-status-error/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="reject-button"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}
