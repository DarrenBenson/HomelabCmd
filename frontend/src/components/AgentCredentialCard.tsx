/**
 * Card component for displaying and managing agent credentials.
 *
 * Secure Agent Architecture: Shows auth method and provides token management.
 */

import { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  ShieldAlert,
  RefreshCw,
  Trash2,
  Loader2,
  CheckCircle,
  Copy,
  AlertCircle,
} from 'lucide-react';
import {
  getAgentCredential,
  rotateAgentToken,
  revokeAgentToken,
} from '../api/agent-register';
import type { AgentCredential, RotateTokenResponse } from '../types/agent-register';
import { formatRelativeTime } from '../lib/formatters';

interface AgentCredentialCardProps {
  /** Server GUID for credential lookup */
  serverGuid: string | null;
  /** Callback when credential is revoked */
  onRevoked?: () => void;
}

export function AgentCredentialCard({ serverGuid, onRevoked }: AgentCredentialCardProps) {
  const [credential, setCredential] = useState<AgentCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [rotating, setRotating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Rotated token display
  const [rotatedToken, setRotatedToken] = useState<RotateTokenResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!serverGuid) {
      setLoading(false);
      return;
    }

    let ignore = false;

    async function fetchCredential() {
      try {
        // serverGuid is guaranteed non-null here due to early return above
        const data = await getAgentCredential(serverGuid!);
        if (!ignore) {
          setCredential(data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          // 404 is expected for legacy servers
          if (err instanceof Error && err.message.includes('404')) {
            setCredential(null);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to fetch credential');
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchCredential();

    return () => {
      ignore = true;
    };
  }, [serverGuid]);

  async function handleRotate() {
    if (!serverGuid) return;

    setRotating(true);
    setError(null);

    try {
      const response = await rotateAgentToken(serverGuid);
      if (response.success) {
        setRotatedToken(response);
        // Refresh credential info
        const updated = await getAgentCredential(serverGuid);
        setCredential(updated);
      } else {
        setError(response.error || 'Failed to rotate token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate token');
    } finally {
      setRotating(false);
    }
  }

  async function handleRevoke() {
    if (!serverGuid) return;

    setRevoking(true);
    setError(null);

    try {
      const response = await revokeAgentToken(serverGuid);
      if (response.success) {
        setCredential((prev) =>
          prev ? { ...prev, is_revoked: true } : null
        );
        setShowRevokeConfirm(false);
        onRevoked?.();
      } else {
        setError(response.error || 'Failed to revoke token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopyToken() {
    if (!rotatedToken?.api_token) return;

    try {
      await navigator.clipboard.writeText(rotatedToken.api_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = rotatedToken.api_token;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
        <span className="text-sm text-text-tertiary">Loading credential info...</span>
      </div>
    );
  }

  // No server GUID means legacy server (pre-GUID era)
  if (!serverGuid) {
    return (
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-status-warning" />
        <div>
          <p className="text-sm font-medium text-text-primary">Legacy Authentication</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            This server was registered before GUID support. Re-install the agent to enable
            per-agent authentication.
          </p>
        </div>
      </div>
    );
  }

  // No credential found - using legacy shared API key
  if (!credential) {
    return (
      <div className="flex items-center gap-3">
        <Key className="h-5 w-5 text-status-warning" />
        <div>
          <p className="text-sm font-medium text-text-primary">Shared API Key</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            This agent uses the legacy shared API key. Re-install with a registration token to
            enable per-agent authentication.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-2">
          <AlertCircle className="h-4 w-4 text-status-error flex-shrink-0 mt-0.5" />
          <p className="text-xs text-status-error">{error}</p>
        </div>
      )}

      {/* Rotated token display */}
      {rotatedToken && rotatedToken.api_token && (
        <div className="rounded-md border border-status-success/30 bg-status-success/10 p-3">
          <div className="flex items-start gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-status-success flex-shrink-0 mt-0.5" />
            <p className="text-xs text-status-success font-medium">
              Token rotated successfully. Copy the new token:
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-text-primary bg-bg-tertiary p-2 rounded break-all">
              {rotatedToken.api_token}
            </code>
            <button
              onClick={handleCopyToken}
              className="p-1.5 rounded hover:bg-bg-tertiary transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-status-success" />
              ) : (
                <Copy className="h-4 w-4 text-text-tertiary" />
              )}
            </button>
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            Update the agent's config.yaml with this new token.
          </p>
        </div>
      )}

      {/* Horizontal layout: Info on left, Actions on right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Auth type and token info */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {credential.is_legacy ? (
              <Key className="h-5 w-5 text-status-warning" />
            ) : (
              <Shield className="h-5 w-5 text-status-success" />
            )}
            <span className="text-sm font-medium text-text-primary">
              {credential.is_legacy ? 'Legacy Authentication' : 'Per-Agent Token'}
            </span>
            {credential.is_revoked && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-status-error/20 text-status-error">
                Revoked
              </span>
            )}
          </div>

          {/* Token details inline */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Token prefix:</span>
              <code className="font-mono text-xs text-text-primary">
                {credential.api_token_prefix}...
              </code>
            </div>
            {credential.last_used_at && (
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Last used:</span>
                <span className="text-text-primary">
                  {formatRelativeTime(credential.last_used_at)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Created:</span>
              <span className="text-text-primary">
                {formatRelativeTime(credential.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!credential.is_revoked && !credential.is_legacy && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRotate}
              disabled={rotating || revoking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {rotating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Rotate Token
            </button>
            {!showRevokeConfirm ? (
              <button
                onClick={() => setShowRevokeConfirm(true)}
                disabled={rotating || revoking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Revoke Token
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-status-error">Revoke access?</span>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="px-2 py-1 rounded text-xs font-medium bg-status-error text-white hover:bg-status-error/90 transition-colors disabled:opacity-50"
                >
                  {revoking ? 'Revoking...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowRevokeConfirm(false)}
                  disabled={revoking}
                  className="px-2 py-1 rounded text-xs font-medium text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: Token details stacked (hidden on md+) */}
      <div className="md:hidden space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Token prefix:</span>
          <code className="font-mono text-xs text-text-primary">
            {credential.api_token_prefix}...
          </code>
        </div>
        {credential.last_used_at && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Last used:</span>
            <span className="text-text-primary">
              {formatRelativeTime(credential.last_used_at)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-secondary">Created:</span>
          <span className="text-text-primary">
            {formatRelativeTime(credential.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
