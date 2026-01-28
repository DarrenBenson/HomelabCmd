/**
 * Panel displaying pending actions requiring approval (US0030 AC1, AC2).
 */

import { Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PendingActionCard } from './PendingActionCard';
import type { Action } from '../types/action';

interface PendingActionsPanelProps {
  actions: Action[];
  onApprove: (actionId: number) => void;
  onReject: (action: Action) => void;
  approvingIds: Set<number>;
  maxDisplay?: number;
}

export function PendingActionsPanel({
  actions,
  onApprove,
  onReject,
  approvingIds,
  maxDisplay = 5,
}: PendingActionsPanelProps) {
  // AC2: Panel hidden when empty
  if (actions.length === 0) {
    return null;
  }

  const displayActions = actions.slice(0, maxDisplay);
  const hasMore = actions.length > maxDisplay;

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-lg p-4"
      data-testid="pending-actions-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-status-warning" />
          <span className="text-text-primary font-medium" data-testid="pending-actions-count">
            Pending Actions ({actions.length})
          </span>
        </div>
        <Link
          to="/actions?status=pending"
          className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          data-testid="view-all-actions-link"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Action List */}
      <div className="space-y-2 max-h-80 overflow-y-auto" data-testid="pending-actions-list">
        {displayActions.map((action) => (
          <PendingActionCard
            key={action.id}
            action={action}
            onApprove={onApprove}
            onReject={onReject}
            isApproving={approvingIds.has(action.id)}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {hasMore && (
        <div className="mt-3 pt-3 border-t border-border-subtle text-center">
          <span className="text-sm text-text-tertiary">
            +{actions.length - maxDisplay} more action
            {actions.length - maxDisplay !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
