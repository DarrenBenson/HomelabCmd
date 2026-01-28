/**
 * SSH Key Manager component for managing SSH keys.
 * US0071: SSH Key Manager UI
 * US0093: Unified SSH Key Management - added default key support
 */

import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Upload, AlertCircle, Star, Loader2 } from 'lucide-react';
import { listSSHKeys, uploadSSHKey, deleteSSHKey, setDefaultKey } from '../api/scans';
import type { SSHKeyMetadata } from '../types/scan';

interface AddKeyModalProps {
  onClose: () => void;
  onSubmit: (name: string, privateKey: string, username?: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function AddKeyModal({ onClose, onSubmit, isLoading, error }: AddKeyModalProps) {
  const [name, setName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name, privateKey, username || undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPrivateKey(content);
        // Auto-set name from filename if empty
        if (!name) {
          setName(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border-default bg-bg-secondary p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Add SSH Key</h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-primary">
              Key Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., work_key, homelab"
              disabled={isLoading}
              className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none"
              data-testid="key-name-input"
              required
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Only letters, numbers, underscore, and hyphen allowed.
            </p>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-primary">
              SSH Username <span className="text-text-tertiary">(optional)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., darren, admin, root"
              disabled={isLoading}
              className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none"
              data-testid="key-username-input"
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Username for SSH connections with this key. Leave empty to use the default.
            </p>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-primary">
              Private Key
            </label>
            <div className="mb-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-default bg-bg-tertiary px-4 py-3 text-text-secondary hover:border-status-info hover:text-text-primary">
                <Upload className="h-5 w-5" />
                <span>Upload key file</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                  className="hidden"
                  accept=".pem,.key,id_*"
                  data-testid="key-file-input"
                />
              </label>
            </div>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
              disabled={isLoading}
              rows={6}
              className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none"
              data-testid="key-content-input"
              required
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Paste your private key or upload a file. Password-protected keys are not supported.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md bg-bg-tertiary px-4 py-2 text-text-primary hover:bg-bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name || !privateKey}
              className="rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="submit-key-button"
            >
              {isLoading ? 'Adding...' : 'Add Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  keyName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function DeleteConfirmModal({ keyName, onClose, onConfirm, isLoading }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-secondary p-6">
        <h3 className="mb-2 text-lg font-semibold text-text-primary">Delete SSH Key</h3>
        <p className="mb-4 text-text-secondary">
          Are you sure you want to delete <span className="font-mono text-text-primary">{keyName}</span>?
          This action cannot be undone.
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
            data-testid="confirm-delete-button"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SSHKeyManager() {
  const [keys, setKeys] = useState<SSHKeyMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [deleteKey, setDeleteKey] = useState<SSHKeyMetadata | null>(null);
  const [deleting, setDeleting] = useState(false);

  // US0093: Default key state
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const response = await listSSHKeys();
      setKeys(response.keys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SSH keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleAddKey = async (name: string, privateKey: string, username?: string) => {
    setAdding(true);
    setAddError(null);

    try {
      await uploadSSHKey({ name, private_key: privateKey, username });
      setShowAddModal(false);
      await fetchKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add key';
      setAddError(message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKey) return;

    setDeleting(true);
    try {
      await deleteSSHKey(deleteKey.id);
      setDeleteKey(null);
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    } finally {
      setDeleting(false);
    }
  };

  // US0093: Handle setting a key as default
  const handleSetDefault = async (keyId: string) => {
    setSettingDefault(keyId);
    setError(null);

    try {
      await setDefaultKey(keyId);
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default key');
    } finally {
      setSettingDefault(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateFingerprint = (fingerprint: string) => {
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
        data-testid="ssh-keys-card"
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
        data-testid="ssh-keys-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-status-info/20 text-status-info">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">SSH Keys</h2>
              <p className="text-sm text-text-secondary">
                {keys.length === 0 ? 'No keys configured' : `${keys.length} key${keys.length !== 1 ? 's' : ''} configured`}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80"
            data-testid="add-key-button"
          >
            <Plus className="h-4 w-4" />
            Add Key
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-tertiary p-8 text-center">
            <Key className="mx-auto mb-3 h-12 w-12 text-text-tertiary" />
            <p className="mb-2 text-text-primary">No SSH keys configured</p>
            <p className="mb-4 text-sm text-text-secondary">
              Add SSH keys to enable scanning and agent installation on remote servers.
            </p>
            <button
              onClick={() => {
                setAddError(null);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80"
              data-testid="empty-state-add-button"
            >
              <Plus className="h-4 w-4" />
              Add Your First Key
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`flex items-center justify-between rounded-lg border p-4 ${
                  key.is_default
                    ? 'border-status-info/50 bg-status-info/5'
                    : 'border-border-default bg-bg-tertiary'
                }`}
                data-testid={`key-row-${key.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md ${
                    key.is_default
                      ? 'bg-status-info/20 text-status-info'
                      : 'bg-bg-secondary text-text-secondary'
                  }`}>
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{key.name}</span>
                      {/* US0093: Default key indicator */}
                      {key.is_default && (
                        <span className="flex items-center gap-1 rounded-full bg-status-info/20 px-2 py-0.5 text-xs text-status-info">
                          <Star className="h-3 w-3" />
                          Default
                        </span>
                      )}
                      <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                        {key.type}
                      </span>
                      <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-tertiary" title="SSH username for this key">
                        {key.username || 'Default username'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-text-tertiary">
                      <span className="font-mono" title={key.fingerprint}>
                        {truncateFingerprint(key.fingerprint)}
                      </span>
                      <span>Added {formatDate(key.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* US0093: Set as Default button (only show if not already default) */}
                  {!key.is_default && (
                    <button
                      onClick={() => handleSetDefault(key.id)}
                      disabled={settingDefault !== null}
                      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-status-info/10 hover:text-status-info disabled:cursor-not-allowed disabled:opacity-50"
                      title="Set as default key"
                      data-testid={`set-default-${key.id}`}
                    >
                      {settingDefault === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      {settingDefault === key.id ? 'Setting...' : 'Set Default'}
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteKey(key)}
                    className="rounded-md p-2 text-text-secondary hover:bg-status-error/10 hover:text-status-error"
                    title="Delete key"
                    data-testid={`delete-key-${key.id}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAddModal && (
        <AddKeyModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddKey}
          isLoading={adding}
          error={addError}
        />
      )}

      {deleteKey && (
        <DeleteConfirmModal
          keyName={deleteKey.name}
          onClose={() => setDeleteKey(null)}
          onConfirm={handleDeleteKey}
          isLoading={deleting}
        />
      )}
    </>
  );
}
