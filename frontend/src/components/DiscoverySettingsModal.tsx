/**
 * Modal for configuring network discovery settings.
 *
 * US0041: Network Discovery (AC2 - Subnet configurable)
 * US0037: SSH Key Configuration
 */

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { getDiscoverySettings, updateDiscoverySettings } from '../api/discovery';
import { getSSHConfig, updateSSHConfig } from '../api/scans';
import type { DiscoverySettings } from '../types/discovery';
import type { SSHConfig } from '../types/scan';

interface DiscoverySettingsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when settings are saved */
  onSave?: () => void;
}

export function DiscoverySettingsModal({
  isOpen,
  onClose,
  onSave,
}: DiscoverySettingsModalProps) {
  // Loading state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [timeoutMs, setTimeoutMs] = useState(500);
  const [defaultUsername, setDefaultUsername] = useState('');

  // Original values for comparison
  const [originalDiscovery, setOriginalDiscovery] = useState<DiscoverySettings | null>(null);
  const [originalSSH, setOriginalSSH] = useState<SSHConfig | null>(null);

  // Load settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const [discoverySettings, sshConfig] = await Promise.all([
          getDiscoverySettings(),
          getSSHConfig(),
        ]);

        setSubnet(discoverySettings.default_subnet);
        setTimeoutMs(discoverySettings.timeout_ms);
        setDefaultUsername(sshConfig.default_username);

        setOriginalDiscovery(discoverySettings);
        setOriginalSSH(sshConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [isOpen]);

  // Handle save
  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updates: Promise<unknown>[] = [];

      // Update discovery settings if changed
      if (
        originalDiscovery &&
        (subnet !== originalDiscovery.default_subnet ||
          timeoutMs !== originalDiscovery.timeout_ms)
      ) {
        updates.push(
          updateDiscoverySettings({
            default_subnet: subnet,
            timeout_ms: timeoutMs,
          })
        );
      }

      // Update SSH settings if changed
      if (originalSSH && defaultUsername !== originalSSH.default_username) {
        updates.push(
          updateSSHConfig({
            default_username: defaultUsername,
          })
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        setSuccess('Settings saved successfully');
        onSave?.();

        // Update original values
        setOriginalDiscovery({ default_subnet: subnet, timeout_ms: timeoutMs });
        if (originalSSH) {
          setOriginalSSH({ ...originalSSH, default_username: defaultUsername });
        }
      } else {
        setSuccess('No changes to save');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Handle close
  function handleClose() {
    setError(null);
    setSuccess(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="discovery-settings-modal"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Discovery Settings
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-status-info" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-3">
            <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        )}

        {/* Success state */}
        {!loading && success && (
          <div className="mb-4 rounded-md border border-status-success/30 bg-status-success/10 p-3">
            <p className="text-sm text-status-success">{success}</p>
          </div>
        )}

        {/* Form */}
        {!loading && (
          <div className="space-y-5">
            {/* Subnet */}
            <div>
              <label
                htmlFor="subnet"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Default Subnet
              </label>
              <input
                id="subnet"
                type="text"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="192.168.1.0/24"
                disabled={saving}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
                data-testid="subnet-input"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Network range in CIDR notation (e.g., 192.168.1.0/24)
              </p>
            </div>

            {/* Default Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Default SSH Username
              </label>
              <input
                id="username"
                type="text"
                value={defaultUsername}
                onChange={(e) => setDefaultUsername(e.target.value)}
                placeholder="darren"
                disabled={saving}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
                data-testid="username-input"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Username for SSH connections when scanning devices
              </p>
            </div>

            {/* Timeout */}
            <div>
              <label
                htmlFor="timeout"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Connection Timeout
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="timeout"
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  disabled={saving}
                  className="w-24 rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
                  data-testid="timeout-input"
                />
                <span className="text-sm text-text-secondary">ms</span>
              </div>
              <p className="mt-1 text-xs text-text-tertiary">
                How long to wait for each device to respond (100-5000ms)
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors disabled:opacity-50"
                data-testid="save-settings-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
