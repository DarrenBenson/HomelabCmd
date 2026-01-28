/**
 * Connectivity Settings component for managing connectivity mode.
 *
 * Part of EP0008: Tailscale Integration (US0080).
 *
 * Provides UI for:
 * - Selecting between Tailscale and Direct SSH modes
 * - Displaying current mode status
 * - Mode requirements and benefits
 */

import React, { useState, useEffect } from 'react';
import { Link2, Wifi, Server, AlertCircle, Check, Loader2 } from 'lucide-react';
import {
  getConnectivityStatus,
  updateConnectivityMode,
} from '../api/connectivity';
import type {
  ConnectivityMode,
  ConnectivityStatusResponse,
} from '../types/connectivity';

export function ConnectivitySettings(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status state
  const [status, setStatus] = useState<ConnectivityStatusResponse | null>(null);

  // Selected mode (may differ from saved mode before save)
  const [selectedMode, setSelectedMode] = useState<ConnectivityMode>('direct_ssh');

  // Saving state
  const [saving, setSaving] = useState(false);

  const fetchStatus = async (): Promise<void> => {
    try {
      const data = await getConnectivityStatus();
      setStatus(data);
      setSelectedMode(data.mode);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectivity status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleModeChange = (mode: ConnectivityMode): void => {
    setSelectedMode(mode);
    setError(null);
    setSuccess(null);
  };

  const handleSaveMode = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateConnectivityMode({
        mode: selectedMode,
        ssh_username: status?.ssh.username,
      });
      setSuccess(result.message);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mode');
    } finally {
      setSaving(false);
    }
  };

  // Check if mode has changed from saved value
  const modeChanged = status && selectedMode !== status.mode;

  if (loading) {
    return (
      <section className="rounded-lg border border-border-default bg-bg-secondary p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
          <span className="ml-2 text-text-secondary">Loading connectivity settings...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border-default bg-bg-secondary p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link2 className="h-5 w-5 text-brand-primary" />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Connectivity Mode</h2>
            <p className="text-sm text-text-secondary">
              {status?.mode_auto_detected
                ? 'Mode auto-detected based on configuration'
                : `Current mode: ${status?.mode === 'tailscale' ? 'Tailscale' : 'Direct SSH'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Success/error messages */}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-status-success/20 bg-status-success/10 p-3 text-status-success">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-status-error/20 bg-status-error/10 p-3 text-status-error">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode selection */}
      <div className="space-y-4">
        {/* Tailscale Mode */}
        <div
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            selectedMode === 'tailscale'
              ? 'border-brand-primary bg-brand-primary/5'
              : 'border-border-default hover:border-border-hover'
          }`}
          onClick={() => handleModeChange('tailscale')}
          data-testid="tailscale-mode-option"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <input
                type="radio"
                name="connectivity-mode"
                value="tailscale"
                checked={selectedMode === 'tailscale'}
                onChange={() => handleModeChange('tailscale')}
                className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-brand-primary" />
                <span className="font-medium text-text-primary">Tailscale Mode</span>
                {status?.mode === 'tailscale' && (
                  <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-xs text-brand-primary">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                Use Tailscale mesh network for connectivity. Requires Tailscale API token.
              </p>
              {status?.tailscale.configured && (
                <div className="mt-2 space-y-1 text-sm">
                  {status.tailscale.connected && (
                    <>
                      <div className="flex items-center gap-1 text-status-success">
                        <Check className="h-3 w-3" />
                        <span>Connected to tailnet: {status.tailscale.tailnet}</span>
                      </div>
                      <div className="flex items-center gap-1 text-status-success">
                        <Check className="h-3 w-3" />
                        <span>{status.tailscale.device_count} devices discovered</span>
                      </div>
                    </>
                  )}
                  {!status.tailscale.connected && (
                    <div className="flex items-center gap-1 text-status-warning">
                      <AlertCircle className="h-3 w-3" />
                      <span>Token configured but not connected</span>
                    </div>
                  )}
                </div>
              )}
              {!status?.tailscale.configured && selectedMode === 'tailscale' && (
                <div className="mt-2 flex items-center gap-1 text-sm text-status-warning">
                  <AlertCircle className="h-3 w-3" />
                  <span>Configure Tailscale API token below to enable this mode</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Direct SSH Mode */}
        <div
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            selectedMode === 'direct_ssh'
              ? 'border-brand-primary bg-brand-primary/5'
              : 'border-border-default hover:border-border-hover'
          }`}
          onClick={() => handleModeChange('direct_ssh')}
          data-testid="direct-ssh-mode-option"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <input
                type="radio"
                name="connectivity-mode"
                value="direct_ssh"
                checked={selectedMode === 'direct_ssh'}
                onChange={() => handleModeChange('direct_ssh')}
                className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-text-secondary" />
                <span className="font-medium text-text-primary">Direct SSH Mode</span>
                {status?.mode === 'direct_ssh' && (
                  <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-xs text-brand-primary">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                Connect directly via IP address. Use network discovery or manual configuration.
                No Tailscale API token required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      {modeChanged && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => void handleSaveMode()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 font-medium text-white hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="save-mode-button"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Mode</span>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
