/**
 * Modal for rejecting an action with a reason (US0030 AC5).
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Action } from '../types/action';

interface RejectModalProps {
  action: Action;
  onReject: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RejectModal({ action, onReject, onCancel, isLoading }: RejectModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onReject(reason.trim());
    }
  };

  const actionDescription =
    action.action_type === 'restart_service'
      ? `Restart ${action.service_name} on ${action.server_id}`
      : `${action.action_type} on ${action.server_id}`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="reject-modal-overlay"
      onClick={onCancel}
    >
      <div
        className="bg-bg-secondary border border-border-default rounded-lg w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="reject-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Reject Action</h2>
          <button
            onClick={onCancel}
            className="p-1 text-text-tertiary hover:text-text-secondary rounded"
            aria-label="Close"
            data-testid="reject-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4">
          <p className="text-text-secondary text-sm mb-4">
            Rejecting:{' '}
            <span className="font-medium text-text-primary">{actionDescription}</span>
          </p>

          <label className="block text-sm font-medium text-text-secondary mb-2">
            Reason (required):
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Service recovered automatically"
            className="w-full h-24 px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-info resize-none"
            data-testid="reject-reason-input"
            disabled={isLoading}
            required
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              data-testid="reject-modal-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isLoading}
              className="px-4 py-2 text-sm font-medium bg-status-error text-white rounded-md hover:bg-status-error/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="reject-modal-submit"
            >
              {isLoading ? 'Rejecting...' : 'Reject Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
