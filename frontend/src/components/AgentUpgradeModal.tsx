/**
 * Modal for upgrading the monitoring agent on a server.
 *
 * EP0007: Agent Management (US0067)
 */

import { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, ArrowUpCircle } from 'lucide-react';
import { upgradeAgent } from '../api/agents';
import type { AgentUpgradeResponse } from '../types/agent';

interface AgentUpgradeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Server identifier */
  serverId: string;
  /** Server display name */
  serverName: string;
  /** Current agent version */
  currentVersion: string | null;
  /** Latest available agent version */
  latestVersion: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when upgrade succeeds */
  onSuccess?: (response: AgentUpgradeResponse) => void;
}

export function AgentUpgradeModal({
  isOpen,
  serverId,
  serverName,
  currentVersion,
  latestVersion,
  onClose,
  onSuccess,
}: AgentUpgradeModalProps) {
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AgentUpgradeResponse | null>(null);

  async function handleUpgrade() {
    setUpgrading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await upgradeAgent(serverId);

      if (response.success) {
        setSuccess(response);
        onSuccess?.(response);
      } else {
        setError(response.error || 'Upgrade failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  }

  function handleClose() {
    if (!upgrading) {
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
      data-testid="agent-upgrade-modal"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowUpCircle className="h-5 w-5 text-status-info" />
            <h2 className="text-lg font-semibold text-text-primary">
              Upgrade Agent
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={upgrading}
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
                <p className="font-medium text-status-success">Agent upgraded successfully</p>
                <p className="text-sm text-text-secondary mt-1">
                  New version: <span className="font-mono">{success.agent_version}</span>
                </p>
              </div>
            </div>
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
              Upgrade the agent on <span className="font-medium text-text-primary">{serverName}</span>?
            </p>

            <div className="rounded-md border border-border-default bg-bg-tertiary p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Current version:</span>
                <span className="font-mono text-text-primary">{currentVersion || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">New version:</span>
                <span className="font-mono text-status-success">{latestVersion}</span>
              </div>
            </div>

            <p className="text-xs text-text-tertiary">
              The agent service will be briefly stopped during the upgrade.
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={upgrading}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors disabled:opacity-50"
                data-testid="confirm-upgrade-button"
              >
                {upgrading && <Loader2 className="h-4 w-4 animate-spin" />}
                {upgrading ? 'Upgrading...' : 'Upgrade'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
