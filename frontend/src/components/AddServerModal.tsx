/**
 * Modal for generating registration tokens for pull-based agent installation.
 *
 * Secure Agent Architecture: Pull-based installation with per-agent tokens.
 */

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Plus, Copy, Clock, Trash2 } from 'lucide-react';
import {
  createRegistrationToken,
  listRegistrationTokens,
  cancelRegistrationToken,
} from '../api/agent-register';
import type {
  CreateRegistrationTokenRequest,
  CreateRegistrationTokenResponse,
  RegistrationToken,
  AgentMode,
} from '../types/agent-register';

interface AddServerModalProps {
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when a token is successfully created (for parent to refresh data) */
  onTokenCreated?: () => void;
}

/**
 * Format remaining time until expiry.
 */
function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`;
  }
  return `${diffSecs}s`;
}

export function AddServerModal({ onClose, onTokenCreated }: AddServerModalProps) {
  // Token generation form state
  const [mode, setMode] = useState<AgentMode>('readonly');
  const [displayName, setDisplayName] = useState('');
  const [monitoredServices, setMonitoredServices] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(15);

  // Generated token state
  const [generatedToken, setGeneratedToken] = useState<CreateRegistrationTokenResponse | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  // Pending tokens list
  const [pendingTokens, setPendingTokens] = useState<RegistrationToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPendingList, setShowPendingList] = useState(false);

  // Timer for countdown updates
  const [, setTick] = useState(0);

  // Load pending tokens when showing the list
  useEffect(() => {
    if (showPendingList) {
      loadPendingTokens();
    }
  }, [showPendingList]);

  // Update countdown every second
  useEffect(() => {
    if (!generatedToken) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [generatedToken]);

  async function loadPendingTokens() {
    setLoadingTokens(true);
    try {
      const response = await listRegistrationTokens();
      setPendingTokens(response.tokens);
    } catch (err) {
      console.error('Failed to load pending tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const services = monitoredServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const request: CreateRegistrationTokenRequest = {
        mode,
        display_name: displayName || undefined,
        monitored_services: services.length > 0 ? services : undefined,
        expiry_minutes: expiryMinutes,
      };

      const response = await createRegistrationToken(request);
      setGeneratedToken(response);
      setCopied(false);
      // Notify parent that a token was created
      onTokenCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyCommand() {
    if (!generatedToken) return;

    try {
      await navigator.clipboard.writeText(generatedToken.install_command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = generatedToken.install_command;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCancelToken(tokenId: number) {
    try {
      await cancelRegistrationToken(tokenId);
      setPendingTokens((tokens) => tokens.filter((t) => t.id !== tokenId));
    } catch (err) {
      console.error('Failed to cancel token:', err);
    }
  }

  function handleClose() {
    if (!generating) {
      // Reset state
      setMode('readonly');
      setDisplayName('');
      setMonitoredServices('');
      setExpiryMinutes(15);
      setGeneratedToken(null);
      setCopied(false);
      setError(null);
      setShowPendingList(false);
      onClose();
    }
  }

  function handleGenerateAnother() {
    setGeneratedToken(null);
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="add-server-modal"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-status-info" />
            <h2 className="text-lg font-semibold text-text-primary">Add Server</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={generating}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-3">
            <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        )}

        {/* Generated token success view */}
        {generatedToken && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-status-success/30 bg-status-success/10 p-4">
              <CheckCircle className="h-5 w-5 text-status-success flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-status-success">Registration token created</p>
                <p className="text-sm text-text-secondary mt-1">
                  Run this command on the target server:
                </p>
              </div>
            </div>

            {/* Install command */}
            <div className="rounded-md border border-border-default bg-bg-tertiary p-3">
              <div className="flex items-start justify-between gap-2">
                <code className="text-xs text-text-primary break-all font-mono">
                  {generatedToken.install_command}
                </code>
                <button
                  onClick={handleCopyCommand}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-bg-secondary transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-status-success" />
                  ) : (
                    <Copy className="h-4 w-4 text-text-tertiary" />
                  )}
                </button>
              </div>
            </div>

            {/* Token info */}
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Expires in: {formatTimeRemaining(generatedToken.expires_at)}</span>
              </div>
              <span className="text-text-tertiary">|</span>
              <span>
                Token: <code className="font-mono text-xs">{generatedToken.token_prefix}...</code>
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleGenerateAnother}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                Generate Another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Token generation form */}
        {!generatedToken && !showPendingList && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">
              Generate a registration token to install the agent on a new server. The token is
              one-time use and expires after the configured time.
            </p>

            {/* Mode selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Agent Mode
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex-1 cursor-pointer rounded-md border p-3 transition-colors ${
                    mode === 'readonly'
                      ? 'border-status-info bg-status-info/10'
                      : 'border-border-default bg-bg-tertiary hover:border-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="readonly"
                    checked={mode === 'readonly'}
                    onChange={() => setMode('readonly')}
                    className="sr-only"
                  />
                  <div className="font-medium text-sm text-text-primary">Read-only</div>
                  <div className="text-xs text-text-secondary mt-1">
                    Metrics collection only
                  </div>
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-md border p-3 transition-colors ${
                    mode === 'readwrite'
                      ? 'border-status-info bg-status-info/10'
                      : 'border-border-default bg-bg-tertiary hover:border-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="readwrite"
                    checked={mode === 'readwrite'}
                    onChange={() => setMode('readwrite')}
                    className="sr-only"
                  />
                  <div className="font-medium text-sm text-text-primary">Read-write</div>
                  <div className="text-xs text-text-secondary mt-1">
                    Full management
                  </div>
                </label>
              </div>
            </div>

            {/* Display name (optional) */}
            <div>
              <label
                htmlFor="displayName"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Display Name <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Media Server"
                disabled={generating}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
              />
            </div>

            {/* Monitored services (optional) */}
            <div>
              <label
                htmlFor="services"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Monitored Services <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                id="services"
                type="text"
                value={monitoredServices}
                onChange={(e) => setMonitoredServices(e.target.value)}
                placeholder="e.g., nginx, docker, plex"
                disabled={generating}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Comma-separated list of systemd services to monitor
              </p>
            </div>

            {/* Token expiry */}
            <div>
              <label
                htmlFor="expiry"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Token Expiry
              </label>
              <select
                id="expiry"
                value={expiryMinutes}
                onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                disabled={generating}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
              >
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowPendingList(true)}
                className="text-sm text-text-secondary hover:text-status-info transition-colors"
              >
                View pending tokens
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={generating}
                  className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors disabled:opacity-50"
                  data-testid="generate-token-button"
                >
                  {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {generating ? 'Generating...' : 'Generate Token'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending tokens list */}
        {!generatedToken && showPendingList && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-primary">Pending Tokens</h3>
              <button
                type="button"
                onClick={() => setShowPendingList(false)}
                className="text-sm text-text-secondary hover:text-status-info transition-colors"
              >
                Back to generate
              </button>
            </div>

            {loadingTokens && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
              </div>
            )}

            {!loadingTokens && pendingTokens.length === 0 && (
              <div className="rounded-md border border-border-default bg-bg-tertiary p-6 text-center">
                <p className="text-sm text-text-tertiary">No pending tokens</p>
              </div>
            )}

            {!loadingTokens && pendingTokens.length > 0 && (
              <div className="space-y-2">
                {pendingTokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between rounded-md border border-border-default bg-bg-tertiary p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-text-primary">
                          {token.token_prefix}...
                        </code>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            token.mode === 'readonly'
                              ? 'bg-status-info/20 text-status-info'
                              : 'bg-status-warning/20 text-status-warning'
                          }`}
                        >
                          {token.mode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                        {token.display_name && <span>{token.display_name}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeRemaining(token.expires_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelToken(token.id)}
                      className="p-1.5 text-text-tertiary hover:text-status-error transition-colors"
                      title="Cancel token"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
