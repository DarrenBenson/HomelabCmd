/**
 * Server Credential Management Component (US0088).
 *
 * Allows users to view and manage per-server credential configuration.
 * Displays credential status, SSH username, sudo mode, and provides
 * controls for storing/removing credentials.
 *
 * Security: Never displays credential values - only shows configuration status.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { Key, Shield, Trash2, Loader2, AlertCircle, CheckCircle, User } from 'lucide-react';
import {
  getServerCredentials,
  storeServerCredential,
  deleteServerCredential,
  updateServer,
} from '../api/servers';
import type { ServerCredentialsResponse, CredentialScope } from '../types/server';

interface ServerCredentialsProps {
  serverId: string;
  onUpdate?: () => void;
}

export function ServerCredentials({ serverId, onUpdate }: ServerCredentialsProps): ReactElement {
  const [credentials, setCredentials] = useState<ServerCredentialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [sshUsername, setSshUsername] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [sudoPassword, setSudoPassword] = useState('');

  // Operation states
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingSshKey, setSavingSshKey] = useState(false);
  const [savingSudoPassword, setSavingSudoPassword] = useState(false);
  const [savingSudoMode, setSavingSudoMode] = useState(false);
  const [deletingCredential, setDeletingCredential] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServerCredentials(serverId);
      setCredentials(data);
      setSshUsername(data.ssh_username || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleSaveUsername = async (): Promise<void> => {
    setSavingUsername(true);
    try {
      await updateServer(serverId, {
        ssh_username: sshUsername.trim() || null,
      });
      await fetchCredentials();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save username');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSudoModeChange = async (mode: 'passwordless' | 'password'): Promise<void> => {
    setSavingSudoMode(true);
    try {
      await updateServer(serverId, { sudo_mode: mode });
      await fetchCredentials();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sudo mode');
    } finally {
      setSavingSudoMode(false);
    }
  };

  const handleSaveSshKey = async (): Promise<void> => {
    if (!sshKey.trim()) return;
    setSavingSshKey(true);
    try {
      await storeServerCredential(serverId, 'ssh_private_key', sshKey);
      setSshKey('');
      await fetchCredentials();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SSH key');
    } finally {
      setSavingSshKey(false);
    }
  };

  const handleSaveSudoPassword = async (): Promise<void> => {
    if (!sudoPassword.trim()) return;
    setSavingSudoPassword(true);
    try {
      await storeServerCredential(serverId, 'sudo_password', sudoPassword);
      setSudoPassword('');
      await fetchCredentials();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sudo password');
    } finally {
      setSavingSudoPassword(false);
    }
  };

  const handleDeleteCredential = async (credentialType: string): Promise<void> => {
    setDeletingCredential(credentialType);
    try {
      await deleteServerCredential(serverId, credentialType);
      await fetchCredentials();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove credential');
    } finally {
      setDeletingCredential(null);
    }
  };

  const getScopeBadge = (scope: CredentialScope, configured: boolean): ReactElement => {
    if (!configured || scope === 'none') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-text-tertiary/20 text-text-tertiary">
          Not configured
        </span>
      );
    }
    if (scope === 'per_server') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-status-info/20 text-status-info">
          Per-server
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded bg-status-success/20 text-status-success">
        Global
      </span>
    );
  };

  const getCredentialStatus = (type: string): { configured: boolean; scope: CredentialScope } => {
    const cred = credentials?.credentials.find((c) => c.credential_type === type);
    return cred || { configured: false, scope: 'none' };
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="rounded-lg border border-border-default bg-bg-secondary p-6"
        data-testid="credentials-loading"
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          <span className="ml-2 text-text-secondary">Loading credentials...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !credentials) {
    return (
      <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-6">
        <div className="flex items-center gap-2 text-status-error">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load credentials: {error}</span>
        </div>
        <button
          onClick={fetchCredentials}
          className="mt-4 px-4 py-2 text-sm font-medium rounded bg-status-error/20 text-status-error hover:bg-status-error/30"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!credentials) return <></>;

  const sshKeyStatus = getCredentialStatus('ssh_private_key');
  const sudoPasswordStatus = getCredentialStatus('sudo_password');

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-6 space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded bg-status-error/10 border border-status-error/30 text-status-error text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SSH Configuration Section */}
      <div>
        <h3 className="text-md font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          SSH Configuration
        </h3>

        {/* SSH Username */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="ssh-username"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              SSH Username Override
            </label>
            <div className="flex gap-2">
              <input
                id="ssh-username"
                type="text"
                value={sshUsername}
                onChange={(e) => setSshUsername(e.target.value)}
                placeholder="Leave empty to use global default"
                className="flex-1 px-3 py-2 text-sm rounded border border-border-default bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-status-info"
              />
              <button
                onClick={handleSaveUsername}
                disabled={savingUsername}
                data-testid="save-ssh-username"
                className="px-4 py-2 text-sm font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 disabled:opacity-50"
              >
                {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
            {credentials.ssh_username && (
              <p className="text-xs text-text-tertiary mt-1">
                Current: {credentials.ssh_username}
              </p>
            )}
          </div>

          {/* SSH Key */}
          <div className="pt-3 border-t border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">SSH Key</span>
              <div className="flex items-center gap-2">
                {getScopeBadge(sshKeyStatus.scope, sshKeyStatus.configured)}
                {sshKeyStatus.scope === 'per_server' && (
                  <button
                    onClick={() => handleDeleteCredential('ssh_private_key')}
                    disabled={deletingCredential === 'ssh_private_key'}
                    data-testid="remove-ssh_private_key"
                    className="p-1 text-status-error hover:bg-status-error/20 rounded"
                    title="Remove per-server key"
                  >
                    {deletingCredential === 'ssh_private_key' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <textarea
              data-testid="ssh-key-input"
              value={sshKey}
              onChange={(e) => setSshKey(e.target.value)}
              placeholder="Paste SSH private key to set per-server key..."
              rows={4}
              className="w-full px-3 py-2 text-sm font-mono rounded border border-border-default bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-status-info"
            />
            <button
              onClick={handleSaveSshKey}
              disabled={savingSshKey || !sshKey.trim()}
              data-testid="save-ssh-key"
              className="mt-2 px-4 py-2 text-sm font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 disabled:opacity-50"
            >
              {savingSshKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save SSH Key'}
            </button>
          </div>
        </div>
      </div>

      {/* Sudo Configuration Section */}
      <div className="pt-4 border-t border-border-default">
        <h3 className="text-md font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Sudo Configuration
        </h3>

        {/* Sudo Mode */}
        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-2">Sudo Mode</span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sudo-mode"
                  checked={credentials.sudo_mode === 'passwordless'}
                  onChange={() => handleSudoModeChange('passwordless')}
                  disabled={savingSudoMode}
                  className="text-status-info focus:ring-status-info"
                />
                <span className="text-sm text-text-primary">Passwordless sudo</span>
                {credentials.sudo_mode === 'passwordless' && (
                  <CheckCircle className="h-4 w-4 text-status-success" />
                )}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sudo-mode"
                  checked={credentials.sudo_mode === 'password'}
                  onChange={() => handleSudoModeChange('password')}
                  disabled={savingSudoMode}
                  className="text-status-info focus:ring-status-info"
                />
                <span className="text-sm text-text-primary">Requires sudo password</span>
                {credentials.sudo_mode === 'password' && (
                  <CheckCircle className="h-4 w-4 text-status-success" />
                )}
              </label>
            </div>
          </div>

          {/* Sudo Password (only shown when mode is 'password') */}
          {credentials.sudo_mode === 'password' && (
            <div className="pt-3 border-t border-border-default">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-secondary">Sudo Password</span>
                <div className="flex items-center gap-2">
                  {getScopeBadge(sudoPasswordStatus.scope, sudoPasswordStatus.configured)}
                  {sudoPasswordStatus.scope === 'per_server' && (
                    <button
                      onClick={() => handleDeleteCredential('sudo_password')}
                      disabled={deletingCredential === 'sudo_password'}
                      data-testid="remove-sudo_password"
                      className="p-1 text-status-error hover:bg-status-error/20 rounded"
                      title="Remove per-server password"
                    >
                      {deletingCredential === 'sudo_password' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  data-testid="sudo-password-input"
                  value={sudoPassword}
                  onChange={(e) => setSudoPassword(e.target.value)}
                  placeholder="Enter sudo password"
                  className="flex-1 px-3 py-2 text-sm rounded border border-border-default bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-status-info"
                />
                <button
                  onClick={handleSaveSudoPassword}
                  disabled={savingSudoPassword || !sudoPassword.trim()}
                  data-testid="save-sudo-password"
                  className="px-4 py-2 text-sm font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 disabled:opacity-50"
                >
                  {savingSudoPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Credential Status Summary */}
      <div className="pt-4 border-t border-border-default">
        <h4 className="text-sm font-medium text-text-secondary mb-3">Credential Status Summary</h4>
        <div className="bg-bg-primary rounded p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary flex items-center gap-2">
              <Key className="h-3 w-3" />
              SSH Key
            </span>
            {getScopeBadge(sshKeyStatus.scope, sshKeyStatus.configured)}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary flex items-center gap-2">
              <User className="h-3 w-3" />
              SSH Username
            </span>
            {credentials.ssh_username ? (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-status-info/20 text-status-info">
                {credentials.ssh_username}
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-text-tertiary/20 text-text-tertiary">
                Using default
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary flex items-center gap-2">
              <Shield className="h-3 w-3" />
              Sudo Password
            </span>
            {getScopeBadge(sudoPasswordStatus.scope, sudoPasswordStatus.configured)}
          </div>
        </div>
      </div>
    </div>
  );
}
