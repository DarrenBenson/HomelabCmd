/**
 * Unified Import Modal component.
 *
 * EP0016: Unified Discovery Experience (US0099)
 *
 * Combined import modal for both Network and Tailscale devices
 * with Display Name, TDP, Machine Type, and optional agent installation.
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
  Wifi,
  Globe,
} from 'lucide-react';
import { importTailscaleDevice, checkTailscaleImport } from '../api/tailscale';
import { installAgent } from '../api/agents';
import type { UnifiedDevice } from '../types/discovery';
import type { TailscaleImportedMachine } from '../types/tailscale';
import type { SSHKeyMetadata } from '../types/scan';

interface UnifiedImportModalProps {
  isOpen: boolean;
  device: UnifiedDevice;
  sshKeys: SSHKeyMetadata[];
  onClose: () => void;
  onSuccess: () => void;
}

type ImportPhase = 'idle' | 'importing' | 'installing' | 'success' | 'partial_success';

export function UnifiedImportModal({
  isOpen,
  device,
  sshKeys,
  onClose,
  onSuccess,
}: UnifiedImportModalProps) {
  // Form state
  const [displayName, setDisplayName] = useState(
    device.hostname.charAt(0).toUpperCase() + device.hostname.slice(1)
  );
  const [machineType, setMachineType] = useState<'server' | 'workstation'>('server');
  const [tdp, setTdp] = useState<string>('');

  // Agent installation state
  const [installAgentChecked, setInstallAgentChecked] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');

  // Derived state
  const sshConfigured = sshKeys.length > 0;
  const isTailscale = device.source === 'tailscale';
  // Network devices require agent install - can't import without it
  const agentInstallRequired = !isTailscale;

  // UI state
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<{
    machine_id: string;
    display_name: string;
  } | null>(null);
  const [importedMachine, setImportedMachine] = useState<TailscaleImportedMachine | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Reset form when device changes
  useEffect(() => {
    setDisplayName(device.hostname.charAt(0).toUpperCase() + device.hostname.slice(1));
    setMachineType('server');
    setTdp('');
    setError(null);
    setAgentError(null);
    setValidationErrors({});
    setDuplicate(null);
    setPhase('idle');
    setSuccessMessage(null);

    // Pre-select default key or first key
    const defaultKey = sshKeys.find((k) => k.is_default);
    if (defaultKey) {
      setSelectedKeyId(defaultKey.id);
    } else if (sshKeys.length > 0) {
      setSelectedKeyId(sshKeys[0].id);
    }

    // Default to install agent if SSH is configured and device is available
    // Network devices require agent install, so always check for them
    const isNetwork = device.source !== 'tailscale';
    setInstallAgentChecked(
      (sshKeys.length > 0 && device.availability === 'available') || isNetwork
    );
  }, [device, sshKeys]);

  // Check for duplicate on mount (Tailscale only)
  useEffect(() => {
    if (!isTailscale || !device.tailscaleHostname) return;

    async function checkDuplicate() {
      setCheckingDuplicate(true);
      try {
        const result = await checkTailscaleImport(device.tailscaleHostname!);
        if (result.imported && result.machine_id && result.display_name) {
          setDuplicate({
            machine_id: result.machine_id,
            display_name: result.display_name,
          });
        }
      } catch {
        // Ignore check errors
      } finally {
        setCheckingDuplicate(false);
      }
    }
    checkDuplicate();
  }, [isTailscale, device.tailscaleHostname]);

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

  // Install agent on imported machine
  const doInstallAgent = useCallback(
    async (machine: TailscaleImportedMachine | { server_id: string; display_name: string; tailscale_hostname?: string }) => {
      setPhase('installing');
      setAgentError(null);

      try {
        const hostname = isTailscale
          ? (machine as TailscaleImportedMachine).tailscale_hostname || device.tailscaleHostname || device.ip
          : device.ip;

        const result = await installAgent({
          hostname,
          server_id: machine.server_id,
          display_name: machine.display_name,
        });

        if (result.success) {
          setPhase('success');
          setSuccessMessage(`Imported and installed agent on ${machine.display_name}`);
          onSuccess();
        } else {
          setPhase('partial_success');
          setAgentError(result.error || 'Agent installation failed');
          setSuccessMessage(`Imported ${machine.display_name} but agent installation failed`);
          onSuccess();
        }
      } catch (err) {
        setPhase('partial_success');
        const message = err instanceof Error ? err.message : 'Agent installation failed';
        setAgentError(message);
        setSuccessMessage(`Imported ${machine.display_name} but agent installation failed`);
        onSuccess();
      }
    },
    [device, isTailscale, onSuccess]
  );

  // Retry agent install
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
      if (isTailscale && device.tailscaleDeviceId && device.tailscaleHostname) {
        // Tailscale import
        const response = await importTailscaleDevice({
          tailscale_device_id: device.tailscaleDeviceId,
          tailscale_hostname: device.tailscaleHostname,
          tailscale_ip: device.ip,
          os: device.os,
          display_name: displayName.trim(),
          machine_type: machineType,
          tdp: tdp ? Number(tdp) : null,
          category_id: null,
        });

        setImportedMachine(response.machine);

        if (installAgentChecked && sshConfigured) {
          await doInstallAgent(response.machine);
        } else {
          setPhase('success');
          setSuccessMessage(`Imported ${response.machine.display_name} successfully`);
          onSuccess();
        }
      } else {
        // Network device - for now just trigger agent install which creates the server
        // This follows the existing pattern where agent installation creates the server
        if (installAgentChecked && sshConfigured) {
          const result = await installAgent({
            hostname: device.ip,
            display_name: displayName.trim(),
          });

          if (result.success) {
            setPhase('success');
            setSuccessMessage(`Imported and installed agent on ${displayName}`);
            onSuccess();
          } else {
            setPhase('idle');
            setError(result.error || 'Installation failed');
          }
        } else {
          // Can't import network device without agent install in current architecture
          setPhase('idle');
          setError('Network devices require agent installation. Please configure an SSH key in Settings first.');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import device';
      setError(message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && phase !== 'installing') {
      onClose();
    }
  };

  // Form disabled state
  const isFormDisabled =
    loading || !!duplicate || phase === 'installing' || phase === 'success';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg rounded-lg bg-bg-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <div className="flex items-center gap-2">
            {isTailscale ? (
              <Globe className="h-5 w-5 text-status-info" />
            ) : (
              <Wifi className="h-5 w-5 text-status-info" />
            )}
            <h2 className="text-lg font-semibold text-text-primary">
              Import Device
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'installing'}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Duplicate check loading */}
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
                    This device is already imported
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {device.hostname} was imported as "{duplicate.display_name}".
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

          {/* Success message */}
          {successMessage && phase === 'success' && (
            <div className="mb-4 rounded-md border border-status-success/30 bg-status-success/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-status-success" />
                <span className="text-sm text-status-success">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Partial success with retry */}
          {phase === 'partial_success' && (
            <div className="mb-4 space-y-3">
              <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning" />
                  <div>
                    <p className="text-sm font-medium text-status-warning">{successMessage}</p>
                    {agentError && (
                      <p className="mt-1 text-sm text-text-secondary">{agentError}</p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryInstall}
                disabled={retrying}
                className="flex items-center gap-2 rounded-md border border-status-info px-3 py-1.5 text-sm font-medium text-status-info hover:bg-status-info/10 disabled:opacity-50"
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

          {/* Installing progress */}
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
                {isTailscale ? 'Tailscale Hostname' : 'IP Address'}
              </label>
              <div className="mt-1 rounded-md bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary">
                {isTailscale ? device.tailscaleHostname : device.ip}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {isTailscale ? 'Tailscale IP' : 'Hostname'}
                </label>
                <div className="mt-1 rounded-md bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary">
                  {isTailscale ? device.ip : (device.hostname || '--')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">OS</label>
                <div className="mt-1 rounded-md bg-bg-tertiary px-3 py-2 text-sm text-text-primary capitalize">
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
              <label htmlFor="displayName" className="block text-sm font-medium text-text-primary">
                Display Name <span className="text-status-error">*</span>
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isFormDisabled}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary ${
                  validationErrors.displayName ? 'border-status-error' : 'border-border-default'
                } bg-bg-secondary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50`}
                placeholder="Enter display name"
              />
              {validationErrors.displayName && (
                <p className="mt-1 text-sm text-status-error">{validationErrors.displayName}</p>
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
              <label htmlFor="tdp" className="block text-sm font-medium text-text-primary">
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
                  validationErrors.tdp ? 'border-status-error' : 'border-border-default'
                } bg-bg-secondary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50`}
                placeholder="Optional - used for power cost estimates"
              />
              {validationErrors.tdp && (
                <p className="mt-1 text-sm text-status-error">{validationErrors.tdp}</p>
              )}
              <p className="mt-1 text-xs text-text-tertiary">
                Optional - used for power cost estimates
              </p>
            </div>

            {/* Install Agent checkbox */}
            <div className="pt-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="installAgent"
                  checked={installAgentChecked}
                  onChange={(e) => setInstallAgentChecked(e.target.checked)}
                  disabled={!sshConfigured || isFormDisabled || agentInstallRequired}
                  className="mt-1 h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info disabled:opacity-50"
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
                  {agentInstallRequired && sshConfigured && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      Required for network devices
                    </p>
                  )}
                  {!sshConfigured && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      <Link to="/settings" className="text-status-info hover:underline">
                        Configure SSH key in Settings
                      </Link>{' '}
                      to enable
                    </p>
                  )}
                </div>
              </div>

              {/* SSH Key selection */}
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
                    className="mt-1 w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
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

              {/* Single key info */}
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
              className="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            {phase !== 'success' && phase !== 'partial_success' && (
              <button
                type="submit"
                disabled={loading || !!duplicate || checkingDuplicate || phase === 'installing'}
                className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/80 disabled:opacity-50"
              >
                {(loading || phase === 'importing') && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading || phase === 'importing' ? 'Importing...' : 'Import Device'}
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
