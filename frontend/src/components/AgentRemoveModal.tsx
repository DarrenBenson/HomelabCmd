/**
 * Modal for removing the monitoring agent from a server.
 *
 * EP0007: Agent Management (US0064, US0067)
 */

import { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { removeAgent } from '../api/agents';
import type { AgentRemoveResponse } from '../types/agent';

interface AgentRemoveModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Server identifier */
  serverId: string;
  /** Server display name */
  serverName: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when removal succeeds */
  onSuccess?: (response: AgentRemoveResponse, deleted: boolean) => void;
}

export function AgentRemoveModal({
  isOpen,
  serverId,
  serverName,
  onClose,
  onSuccess,
}: AgentRemoveModalProps) {
  const [deleteCompletely, setDeleteCompletely] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AgentRemoveResponse | null>(null);

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await removeAgent(serverId, { delete_completely: deleteCompletely });

      if (response.success) {
        setSuccess(response);
        onSuccess?.(response, deleteCompletely);
      } else {
        setError(response.error || 'Removal failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Removal failed');
    } finally {
      setRemoving(false);
    }
  }

  function handleClose() {
    if (!removing) {
      setDeleteCompletely(false);
      setError(null);
      setSuccess(null);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="agent-remove-modal"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-status-error" />
            <h2 className="text-lg font-semibold text-text-primary">
              Remove Agent
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={removing}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success state */}
        {success && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-status-success/30 bg-status-success/10 p-4">
              <CheckCircle className="h-5 w-5 text-status-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-status-success">
                  {deleteCompletely ? 'Server deleted' : 'Agent removed'}
                </p>
                {/* Show base message without warning */}
                <p className="text-sm text-text-secondary mt-1">
                  {success.message.includes('. Warning:')
                    ? success.message.split('. Warning:')[0]
                    : success.message}
                </p>
              </div>
            </div>

            {/* Show warning if uninstall failed (BG0012) */}
            {success.message.includes('. Warning:') && (
              <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-4">
                <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-status-warning">Uninstall Warning</p>
                  <p className="text-sm text-text-secondary mt-1">
                    {success.message.split('. Warning: ')[1]}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !success && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-3">
            <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        )}

        {/* Confirmation content */}
        {!success && (
          <div className="space-y-5">
            <p className="text-text-secondary">
              Remove the agent from <span className="font-medium text-text-primary">{serverName}</span>?
            </p>

            {/* Delete option */}
            <div className="rounded-md border border-border-default bg-bg-tertiary p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteCompletely}
                  onChange={(e) => setDeleteCompletely(e.target.checked)}
                  disabled={removing}
                  className="mt-1 h-4 w-4 rounded border-border-default text-status-error focus:ring-status-error"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    Delete server completely
                  </span>
                  <p className="text-xs text-text-tertiary mt-1">
                    Remove all historical metrics and data. Cannot be undone.
                  </p>
                </div>
              </label>
            </div>

            {/* Warning for delete */}
            {deleteCompletely && (
              <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
                <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0" />
                <p className="text-sm text-status-warning">
                  This will permanently delete all data associated with this server.
                </p>
              </div>
            )}

            {!deleteCompletely && (
              <p className="text-xs text-text-tertiary">
                The server will be marked inactive but historical data will be preserved.
                You can re-install the agent later.
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={removing}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-2 rounded-md bg-status-error px-4 py-2 text-sm font-medium text-white hover:bg-status-error/90 transition-colors disabled:opacity-50"
                data-testid="confirm-remove-button"
              >
                {removing && <Loader2 className="h-4 w-4 animate-spin" />}
                {removing ? 'Removing...' : deleteCompletely ? 'Delete Server' : 'Remove Agent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
