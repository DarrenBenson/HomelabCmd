/**
 * Import Device Modal component.
 *
 * Part of EP0008: Tailscale Integration (US0078, US0082).
 *
 * Modal for importing Tailscale devices as monitored servers.
 * Pre-fills device data and allows editing display name, machine type, and TDP.
 *
 * US0082: Optionally installs monitoring agent after import when SSH is configured.
 * US0093: Unified SSH key management with key selection dropdown.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Server,
  Monitor,
  AlertTriangle,
  Loader2,
  CheckCircle,
  RefreshCw,
  Key,
} from 'lucide-react';
import { importTailscaleDevice, checkTailscaleImport } from '../api/tailscale';
import { listSSHKeys } from '../api/scans';
import { installAgent } from '../api/agents';
import type {
  TailscaleDevice,
  TailscaleImportedMachine,
} from '../types/tailscale';
import type { SSHKeyMetadata } from '../types/scan';

interface ImportDeviceModalProps {
  device: TailscaleDevice;
  onClose: () => void;
  onSuccess: (machine: TailscaleImportedMachine) => void;
}

/** Import phase for progress tracking */
type ImportPhase =
  | 'idle'
  | 'importing'
  | 'installing'
  | 'success'
  | 'partial_success';

export function ImportDeviceModal({
  device,
  onClose,
  onSuccess,
}: ImportDeviceModalProps) {
  // Form state - derive display_name from hostname
  const [displayName, setDisplayName] = useState(
    device.hostname.split('.')[0].toUpperCase()
  );
  const [machineType, setMachineType] = useState<'server' | 'workstation'>(
    'server'
  );
  const [tdp, setTdp] = useState<string>('');

  // US0082 + US0093: Agent installation state with unified key management
  const [installAgentChecked, setInstallAgentChecked] = useState(false);
  const [sshKeys, setSshKeys] = useState<SSHKeyMetadata[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [checkingSSH, setCheckingSSH] = useState(true);

  // Derived state: SSH is configured if we have at least one key
  const sshConfigured = sshKeys.length > 0;

  // UI state
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [checkingDuplicate, setCheckingDuplicate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [duplicate, setDuplicate] = useState<{
    machine_id: string;
    display_name: string;
  } | null>(null);

  // Imported machine reference for retry
  const [importedMachine, setImportedMachine] =
    useState<TailscaleImportedMachine | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Check for duplicate on mount
  useEffect(() => {
    async function checkDuplicate() {
      try {
        const result = await checkTailscaleImport(device.hostname);
        if (result.imported && result.machine_id && result.display_name) {
          setDuplicate({
            machine_id: result.machine_id,
            display_name: result.display_name,
          });
        }
      } catch {
        // Ignore check errors - we'll catch duplicate on submit
      } finally {
        setCheckingDuplicate(false);
      }
    }
    checkDuplicate();
  }, [device.hostname]);

  // US0082 + US0093: Check SSH keys on mount using unified key manager
  useEffect(() => {
    async function checkSSHKeys() {
      try {
        const response = await listSSHKeys();
        setSshKeys(response.keys);

        // US0093 AC2: Pre-select default key, or first key if no default
        const defaultKey = response.keys.find((k) => k.is_default);
        if (defaultKey) {
          setSelectedKeyId(defaultKey.id);
        } else if (response.keys.length > 0) {
          setSelectedKeyId(response.keys[0].id);
        }

        // AC2: Default to checked when SSH is configured (has keys)
        setInstallAgentChecked(response.keys.length > 0);
      } catch {
        // SSH check failed - treat as not configured
        setSshKeys([]);
        setSelectedKeyId('');
        setInstallAgentChecked(false);
      } finally {
        setCheckingSSH(false);
      }
    }
    checkSSHKeys();
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!displayName.trim()) {
      errors.displayName = 'Display name is required';
    } else if (displayName.length > 100) {
      errors.displayName = 'Display name must be 100 characters or less';
    }

    if (tdp) {
      const tdpNum = Number(tdp);
      if (isNaN(tdpNum)) {
        errors.tdp = 'TDP must be a number';
      } else if (tdpNum <= 0) {
        errors.tdp = 'TDP must be a positive number';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [displayName, tdp]);

  // US0082: Install agent on imported machine (AC3)
  const doInstallAgent = useCallback(
    async (machine: TailscaleImportedMachine) => {
      setPhase('installing');
      setAgentError(null);

      try {
        const result = await installAgent({
          hostname: machine.tailscale_hostname || device.hostname,
          server_id: machine.server_id,
          display_name: machine.display_name,
        });

        if (result.success) {
          setPhase('success');
          setSuccessMessage(
            `Imported and installed agent on ${machine.display_name}`
          );
          onSuccess(machine);
        } else {
          // AC5: Agent install failed but server was created
          setPhase('partial_success');
          setAgentError(result.error || 'Agent installation failed');
          setSuccessMessage(
            `Imported ${machine.display_name} but agent installation failed`
          );
          onSuccess(machine);
        }
      } catch (err) {
        // AC5: Network error during agent install
        setPhase('partial_success');
        const message =
          err instanceof Error ? err.message : 'Agent installation failed';
        setAgentError(message);
        setSuccessMessage(
          `Imported ${machine.display_name} but agent installation failed`
        );
        onSuccess(machine);
      }
    },
    [device.hostname, onSuccess]
  );

  // US0082: Handle retry agent install (AC5)
  const handleRetryInstall = useCallback(async () => {
    if (!importedMachine) return;
    setRetrying(true);
    try {
      await doInstallAgent(importedMachine);
    } finally {
      setRetrying(false);
    }
  }, [importedMachine, doInstallAgent]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    setError(null);
    setAgentError(null);
    setPhase('importing');

    try {
      const response = await importTailscaleDevice({
        tailscale_device_id: device.id,
        tailscale_hostname: device.hostname,
        tailscale_ip: device.tailscale_ip,
        os: device.os,
        display_name: displayName.trim(),
        machine_type: machineType,
        tdp: tdp ? Number(tdp) : null,
        category_id: null,
      });

      setImportedMachine(response.machine);

      // US0082 AC3: Install agent if checkbox is checked
      if (installAgentChecked && sshConfigured) {
        await doInstallAgent(response.machine);
      } else {
        // AC4: Import only, no agent installation
        setPhase('success');
        setSuccessMessage(`Imported ${response.machine.display_name} successfully`);
        onSuccess(response.machine);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import device';
      setError(message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Determine if form inputs should be disabled
  const isFormDisabled =
    loading || !!duplicate || phase === 'installing' || phase === 'success';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg rounded-lg bg-bg-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Import Tailscale Device
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Loading state for duplicate check */}
          {checkingDuplicate && (
            <div className="mb-4 flex items-center gap-2 text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking if device is already imported...</span>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicate && (
            <div className="mb-6 rounded-md border border-status-warning/30 bg-status-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning" />
                <div>
                  <p className="font-medium text-status-warning">
                    A machine with this hostname already exists
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {device.hostname} was imported as "{duplicate.display_name}
                    ".
                  </p>
                  <Link
                    to={`/servers/${duplicate.machine_id}`}
                    className="mt-2 inline-block text-sm font-medium text-status-info hover:underline"
                  >
                    View Machine
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Success message (AC3, AC4) */}
          {successMessage && phase === 'success' && (
            <div className="mb-4 rounded-md border border-status-success/30 bg-status-success/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-status-success" />
                <span className="text-sm text-status-success">
                  {successMessage}
                </span>
              </div>
            </div>
          )}

          {/* Partial success message with retry (AC5) */}
          {phase === 'partial_success' && (
            <div className="mb-4 space-y-3">
              <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning" />
                  <div>
                    <p className="text-sm font-medium text-status-warning">
                      {successMessage}
                    </p>
                    {agentError && (
                      <p className="mt-1 text-sm text-text-secondary">
                        {agentError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryInstall}
                disabled={retrying}
                className="flex items-center gap-2 rounded-md border border-status-info px-3 py-1.5 text-sm font-medium text-status-info hover:bg-status-info/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {retrying ? 'Installing...' : 'Retry Install'}
              </button>
            </div>
          )}

          {/* Agent installation progress (AC6) */}
          {phase === 'installing' && (
            <div className="mb-4 rounded-md border border-status-info/30 bg-status-info/10 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-status-info" />
                <span className="text-sm text-status-info">
                  Installing agent on {device.hostname}...
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
              {error}
            </div>
          )}

          {/* Read-only fields */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Tailscale Hostname
              </label>
              <div className="mt-1 rounded-md bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary">
                {device.hostname}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Tailscale IP
                </label>
                <div className="mt-1 rounded-md bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary">
                  {device.tailscale_ip}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  OS
                </label>
                <div className="mt-1 rounded-md bg-bg-tertiary px-3 py-2 text-sm text-text-primary">
                  {device.os}
                </div>
              </div>
            </div>
          </div>

          <hr className="mb-6 border-border-default" />

          {/* Editable fields */}
          <div className="space-y-4">
            {/* Display name */}
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-text-primary"
              >
                Display Name <span className="text-status-error">*</span>
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isFormDisabled}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary ${
                  validationErrors.displayName
                    ? 'border-status-error'
                    : 'border-border-default'
                } bg-bg-secondary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:cursor-not-allowed disabled:opacity-50`}
                placeholder="Enter display name"
              />
              {validationErrors.displayName && (
                <p className="mt-1 text-sm text-status-error">
                  {validationErrors.displayName}
                </p>
              )}
            </div>

            {/* Machine type */}
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Machine Type <span className="text-status-error">*</span>
              </label>
              <div className="mt-2 flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="machineType"
                    value="server"
                    checked={machineType === 'server'}
                    onChange={() => setMachineType('server')}
                    disabled={isFormDisabled}
                    className="h-4 w-4 text-status-info focus:ring-status-info"
                  />
                  <Server className="h-4 w-4 text-text-secondary" />
                  <span className="text-text-primary">Server</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="machineType"
                    value="workstation"
                    checked={machineType === 'workstation'}
                    onChange={() => setMachineType('workstation')}
                    disabled={isFormDisabled}
                    className="h-4 w-4 text-status-info focus:ring-status-info"
                  />
                  <Monitor className="h-4 w-4 text-text-secondary" />
                  <span className="text-text-primary">Workstation</span>
                </label>
              </div>
            </div>

            {/* TDP */}
            <div>
              <label
                htmlFor="tdp"
                className="block text-sm font-medium text-text-primary"
              >
                TDP (Watts)
              </label>
              <input
                type="number"
                id="tdp"
                value={tdp}
                onChange={(e) => setTdp(e.target.value)}
                disabled={isFormDisabled}
                min="1"
                className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary ${
                  validationErrors.tdp
                    ? 'border-status-error'
                    : 'border-border-default'
                } bg-bg-secondary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:cursor-not-allowed disabled:opacity-50`}
                placeholder="Optional - used for power cost estimates"
              />
              {validationErrors.tdp && (
                <p className="mt-1 text-sm text-status-error">
                  {validationErrors.tdp}
                </p>
              )}
              <p className="mt-1 text-xs text-text-tertiary">
                Optional - used for power cost estimates
              </p>
            </div>

            {/* US0082 + US0093: Install Agent checkbox with key selection (AC1, AC2) */}
            <div className="pt-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="installAgent"
                  checked={installAgentChecked}
                  onChange={(e) => setInstallAgentChecked(e.target.checked)}
                  disabled={!sshConfigured || isFormDisabled || checkingSSH}
                  className="mt-1 h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Install monitoring agent after import"
                />
                <div className="flex-1">
                  <label
                    htmlFor="installAgent"
                    className={`block text-sm font-medium ${
                      sshConfigured ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    Install monitoring agent after import
                  </label>
                  {!sshConfigured && !checkingSSH && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      <Link
                        to="/settings"
                        className="text-status-info hover:underline"
                      >
                        Configure SSH key in Settings
                      </Link>{' '}
                      to enable
                    </p>
                  )}
                  {checkingSSH && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking SSH configuration...
                    </p>
                  )}
                </div>
              </div>

              {/* US0093: SSH Key selection dropdown (AC2) */}
              {installAgentChecked && sshKeys.length > 1 && (
                <div className="mt-3 ml-7">
                  <label
                    htmlFor="sshKey"
                    className="flex items-center gap-1 text-sm font-medium text-text-primary"
                  >
                    <Key className="h-4 w-4 text-text-secondary" />
                    SSH Key
                  </label>
                  <select
                    id="sshKey"
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(e.target.value)}
                    disabled={isFormDisabled}
                    className="mt-1 w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sshKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name}
                        {key.is_default ? ' (default)' : ''} - {key.fingerprint.slice(0, 20)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show single key info when only one key configured */}
              {installAgentChecked && sshKeys.length === 1 && (
                <p className="mt-2 ml-7 flex items-center gap-1 text-xs text-text-tertiary">
                  <Key className="h-3 w-3" />
                  Using: {sshKeys[0].name} ({sshKeys[0].fingerprint.slice(0, 20)}...)
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={phase === 'installing'}
              className="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            {phase !== 'success' && phase !== 'partial_success' && (
              <button
                type="submit"
                disabled={
                  loading ||
                  !!duplicate ||
                  checkingDuplicate ||
                  phase === 'installing'
                }
                className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(loading || phase === 'importing') && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {loading || phase === 'importing'
                  ? 'Importing...'
                  : 'Import Machine'}
              </button>
            )}
            {(phase === 'success' || phase === 'partial_success') && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/80"
              >
                Done
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
