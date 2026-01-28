/**
 * Tailscale Settings component for managing Tailscale API token.
 *
 * Part of EP0008: Tailscale Integration (US0076).
 *
 * Provides UI for:
 * - Saving/removing Tailscale API tokens
 * - Testing connection to Tailscale API
 * - Displaying connection status
 */

import { useState, useEffect } from 'react';
import { Globe, AlertCircle, Check, X, Loader2, Trash2 } from 'lucide-react';
import {
  getTailscaleStatus,
  saveTailscaleToken,
  removeTailscaleToken,
  testTailscaleConnection,
} from '../api/tailscale';
import type { TailscaleStatusResponse, TailscaleTestResponse } from '../types/tailscale';

interface RemoveConfirmModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function RemoveConfirmModal({ onClose, onConfirm, isLoading }: RemoveConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-secondary p-6">
        <h3 className="mb-2 text-lg font-semibold text-text-primary">Remove Tailscale Token</h3>
        <p className="mb-4 text-text-secondary">
          Are you sure you want to remove the Tailscale API token?
          Device discovery via Tailscale will be unavailable until a new token is configured.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-md bg-bg-tertiary px-4 py-2 text-text-primary hover:bg-bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-md bg-status-error px-4 py-2 font-medium text-white hover:bg-status-error/80 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="confirm-remove-token-button"
          >
            {isLoading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TailscaleSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status state
  const [status, setStatus] = useState<TailscaleStatusResponse | null>(null);

  // Token input state
  const [tokenInput, setTokenInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Test connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TailscaleTestResponse | null>(null);

  // Remove token modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await getTailscaleStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Tailscale status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      await saveTailscaleToken(tokenInput.trim());
      setSuccess('Tailscale token saved');
      setTokenInput('');
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveToken = async () => {
    setRemoving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      await removeTailscaleToken();
      setSuccess('Tailscale token removed');
      setShowRemoveModal(false);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove token');
    } finally {
      setRemoving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testTailscaleConnection();
      setTestResult(result);
    } catch (err) {
      // Connection errors come back as HTTP 503
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection test failed',
        code: 'TAILSCALE_CONNECTION_ERROR',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <section
        className="rounded-lg border border-border-default bg-bg-secondary p-6"
        data-testid="tailscale-settings-card"
      >
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className="rounded-lg border border-border-default bg-bg-secondary p-6"
        data-testid="tailscale-settings-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-status-info/20 text-status-info">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Tailscale Configuration</h2>
              <p className="text-sm text-text-secondary">
                {status?.configured
                  ? `Token configured: ${status.masked_token}`
                  : 'No API token configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div
            className="mb-4 flex items-center gap-2 rounded-md border border-status-success/30 bg-status-success/10 p-3 text-sm text-status-success"
            data-testid="success-message"
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error"
            data-testid="error-message"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Token input form */}
        <form onSubmit={handleSaveToken} className="mb-4">
          <label className="mb-2 block text-sm font-medium text-text-primary">
            API Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={status?.configured ? 'Enter new token to replace' : 'tskey-api-...'}
              disabled={saving || testing}
              className="flex-1 rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info"
              data-testid="token-input"
            />
            <button
              type="submit"
              disabled={saving || testing || !tokenInput.trim()}
              className="rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="save-token-button"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Token'
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            Create an API token at{' '}
            <a
              href="https://login.tailscale.com/admin/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-status-info hover:underline"
            >
              Tailscale Admin Console
            </a>
            {' '}with <code className="rounded bg-bg-tertiary px-1">devices:read</code> scope.
          </p>
        </form>

        {/* Test connection and remove buttons */}
        {status?.configured && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || saving}
                className="flex items-center gap-2 rounded-md bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="test-connection-button"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowRemoveModal(true)}
                disabled={testing || saving}
                className="flex items-center gap-2 rounded-md bg-bg-tertiary px-4 py-2 text-sm font-medium text-status-error hover:bg-status-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="remove-token-button"
              >
                <Trash2 className="h-4 w-4" />
                Remove Token
              </button>
            </div>

            {/* Test result display */}
            {testResult && (
              <div
                className={`rounded-md border p-4 ${
                  testResult.success
                    ? 'border-status-success/30 bg-status-success/10'
                    : 'border-status-error/30 bg-status-error/10'
                }`}
                data-testid="test-result"
              >
                {testResult.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-status-success">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Connected to tailnet: {testResult.tailnet || 'unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-status-success">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">{testResult.device_count} devices discovered</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-status-error">
                    <X className="h-5 w-5" />
                    <span>{testResult.error || 'Connection failed'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Unconfigured state guidance */}
        {!status?.configured && (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-tertiary p-4 text-center">
            <Globe className="mx-auto mb-2 h-8 w-8 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              Configure a Tailscale API token to enable automatic device discovery from your tailnet.
            </p>
          </div>
        )}
      </section>

      {/* Remove confirmation modal */}
      {showRemoveModal && (
        <RemoveConfirmModal
          onClose={() => setShowRemoveModal(false)}
          onConfirm={handleRemoveToken}
          isLoading={removing}
        />
      )}
    </>
  );
}
