/**
 * Tailscale SSH Settings component for managing SSH connection configuration.
 *
 * Part of EP0008: Tailscale Integration (US0079).
 *
 * Provides UI for:
 * - Uploading SSH private key for Tailscale machine connections
 * - Configuring default SSH username
 * - Displaying key status and fingerprint
 *
 * Note: This is separate from SSHKeyManager (US0071) which manages
 * multiple named SSH keys for the scanning feature. This component
 * manages a single SSH key used for Tailscale-connected machines.
 */

import { useState, useEffect } from 'react';
import { Terminal, AlertCircle, Check, Upload, Trash2, Loader2, User } from 'lucide-react';
import { getSSHStatus, uploadSSHKey, removeSSHKey, updateSSHUsername } from '../api/ssh';
import type { SSHKeyStatusResponse } from '../types/ssh';

interface RemoveConfirmModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function RemoveConfirmModal({ onClose, onConfirm, isLoading }: RemoveConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-secondary p-6">
        <h3 className="mb-2 text-lg font-semibold text-text-primary">Remove SSH Key</h3>
        <p className="mb-4 text-text-secondary">
          Are you sure you want to remove the SSH private key?
          SSH connections to Tailscale machines will be unavailable until a new key is configured.
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
            data-testid="confirm-remove-ssh-key-button"
          >
            {isLoading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TailscaleSSHSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status state
  const [status, setStatus] = useState<SSHKeyStatusResponse | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Username state
  const [username, setUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Remove key modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await getSSHStatus();
      setStatus(data);
      setUsername(data.username);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SSH status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadSSHKey(file);
      setSuccess(`SSH key uploaded: ${result.key_type}`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload SSH key');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveKey = async () => {
    setRemoving(true);
    setError(null);
    setSuccess(null);

    try {
      await removeSSHKey();
      setSuccess('SSH key removed');
      setShowRemoveModal(false);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove SSH key');
    } finally {
      setRemoving(false);
    }
  };

  const handleUsernameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username === status?.username) return;

    setSavingUsername(true);
    setError(null);
    setSuccess(null);

    try {
      await updateSSHUsername(username.trim());
      setSuccess('SSH username updated');
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username');
    } finally {
      setSavingUsername(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateFingerprint = (fingerprint: string | null) => {
    if (!fingerprint) return null;
    // SHA256:abc123... -> SHA256:abc1...3xyz
    const parts = fingerprint.split(':');
    if (parts.length === 2 && parts[1].length > 12) {
      return `${parts[0]}:${parts[1].slice(0, 6)}...${parts[1].slice(-4)}`;
    }
    return fingerprint;
  };

  if (loading) {
    return (
      <section
        className="rounded-lg border border-border-default bg-bg-secondary p-6"
        data-testid="tailscale-ssh-settings-card"
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
        data-testid="tailscale-ssh-settings-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-status-info/20 text-status-info">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">SSH Connection</h2>
              <p className="text-sm text-text-secondary">
                {status?.configured
                  ? `Key configured: ${status.key_type}`
                  : 'No SSH key configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div
            className="mb-4 flex items-center gap-2 rounded-md border border-status-success/30 bg-status-success/10 p-3 text-sm text-status-success"
            data-testid="ssh-success-message"
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error"
            data-testid="ssh-error-message"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Key status display */}
        {status?.configured && (
          <div className="mb-4 space-y-2 rounded-md border border-border-default bg-bg-tertiary p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Key Type</span>
              <span className="font-mono text-sm text-text-primary">{status.key_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Fingerprint</span>
              <span
                className="font-mono text-sm text-text-primary"
                title={status.fingerprint || undefined}
              >
                {truncateFingerprint(status.fingerprint)}
              </span>
            </div>
            {status.uploaded_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Uploaded</span>
                <span className="text-sm text-text-primary">{formatDate(status.uploaded_at)}</span>
              </div>
            )}
          </div>
        )}

        {/* Upload key section */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-text-primary">
            SSH Private Key
          </label>
          <div className="flex gap-2">
            <label
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-default bg-bg-tertiary px-4 py-3 text-text-secondary hover:border-status-info hover:text-text-primary ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>{status?.configured ? 'Replace key' : 'Upload key file'}</span>
                </>
              )}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                accept=".pem,.key,id_*"
                data-testid="ssh-key-file-input"
              />
            </label>
            {status?.configured && (
              <button
                type="button"
                onClick={() => setShowRemoveModal(true)}
                disabled={uploading}
                className="flex items-center gap-2 rounded-md bg-bg-tertiary px-4 py-2 text-sm font-medium text-status-error hover:bg-status-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="remove-ssh-key-button"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            Upload an SSH private key (RSA, Ed25519, or ECDSA in PEM format).
            Password-protected keys are not supported.
          </p>
        </div>

        {/* Username configuration */}
        <form onSubmit={handleUsernameUpdate}>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Default Username
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="homelabcmd"
                disabled={savingUsername}
                className="w-full rounded-md border border-border-default bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info"
                data-testid="ssh-username-input"
              />
            </div>
            <button
              type="submit"
              disabled={savingUsername || !username.trim() || username === status?.username}
              className="rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="save-ssh-username-button"
            >
              {savingUsername ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save'
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            Default username for SSH connections to Tailscale machines.
          </p>
        </form>

        {/* Unconfigured state guidance */}
        {!status?.configured && (
          <div className="mt-4 rounded-lg border border-dashed border-border-default bg-bg-tertiary p-4 text-center">
            <Terminal className="mx-auto mb-2 h-8 w-8 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              Upload an SSH private key to enable SSH connections to Tailscale machines.
              The key is encrypted at rest.
            </p>
          </div>
        )}
      </section>

      {/* Remove confirmation modal */}
      {showRemoveModal && (
        <RemoveConfirmModal
          onClose={() => setShowRemoveModal(false)}
          onConfirm={handleRemoveKey}
          isLoading={removing}
        />
      )}
    </>
  );
}
