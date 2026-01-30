/**
 * Modal for removing a configuration pack from a server.
 *
 * EP0010: Configuration Management - US0123 Remove Configuration Pack.
 *
 * States:
 * - Loading: Fetching preview
 * - Preview: Shows items to delete/skip with warning banner
 * - Removing: Executing removal
 * - Complete: Shows summary with backup paths
 * - Error: Shows error with retry option
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Trash2,
  FileText,
  Package,
  Settings,
  SkipForward,
} from 'lucide-react';
import { getRemovePreview, removeConfigPack } from '../api/config-apply';
import type {
  RemovePreviewResponse,
  RemoveResponse,
  RemoveItemResult,
} from '../types/config-apply';

interface RemovePackModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Server identifier */
  serverId: string;
  /** Server display name */
  serverName: string;
  /** Configuration pack name */
  packName: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when remove succeeds */
  onSuccess?: () => void;
}

type ModalState = 'loading' | 'preview' | 'removing' | 'complete' | 'error';

export function RemovePackModal({
  isOpen,
  serverId,
  serverName,
  packName,
  onClose,
  onSuccess,
}: RemovePackModalProps) {
  const [state, setState] = useState<ModalState>('loading');
  const [preview, setPreview] = useState<RemovePreviewResponse | null>(null);
  const [result, setResult] = useState<RemoveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const previewResult = await getRemovePreview(serverId, packName);
      setPreview(previewResult);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
      setState('error');
    }
  }, [serverId, packName]);

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPreview();
    } else {
      // Reset state when closed
      setState('loading');
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, [isOpen, loadPreview]);

  async function handleRemove() {
    setState('removing');
    setError(null);

    try {
      const removeResult = await removeConfigPack(serverId, packName);
      setResult(removeResult);
      setState('complete');

      if (removeResult.success) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove pack');
      setState('error');
    }
  }

  function handleClose() {
    if (state !== 'removing') {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="remove-pack-modal"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-status-error" />
            <h2 className="text-lg font-semibold text-text-primary">
              Remove Configuration Pack
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={state === 'removing'}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading state */}
        {state === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-status-info" />
          </div>
        )}

        {/* Error state */}
        {state === 'error' && error && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-4">
              <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-status-error">Error</p>
                <p className="text-sm text-text-secondary mt-1">{error}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                Close
              </button>
              <button
                onClick={loadPreview}
                className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Preview state */}
        {state === 'preview' && preview && (
          <PreviewContent
            preview={preview}
            serverName={serverName}
            packName={packName}
            onRemove={handleRemove}
            onClose={handleClose}
          />
        )}

        {/* Removing state */}
        {state === 'removing' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-status-error" />
            <span className="text-text-secondary">Removing configuration...</span>
          </div>
        )}

        {/* Complete state */}
        {state === 'complete' && result && (
          <CompleteContent result={result} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}

interface PreviewContentProps {
  preview: RemovePreviewResponse;
  serverName: string;
  packName: string;
  onRemove: () => void;
  onClose: () => void;
}

function PreviewContent({
  preview,
  serverName,
  packName,
  onRemove,
  onClose,
}: PreviewContentProps) {
  return (
    <div className="space-y-5">
      <p className="text-text-secondary">
        Remove <span className="font-medium text-text-primary">{packName}</span> from{' '}
        <span className="font-medium text-text-primary">{serverName}</span>?
      </p>

      {/* AC6: Warning banner */}
      <div
        className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-4"
        data-testid="remove-warning-banner"
      >
        <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-status-warning">Warning</p>
          <p className="text-sm text-text-secondary mt-1">{preview.warning}</p>
        </div>
      </div>

      {/* Files section - will be deleted */}
      {preview.files.length > 0 && (
        <RemovePreviewSection
          icon={<FileText className="h-4 w-4" />}
          title="Files to delete (backups will be created)"
          items={preview.files.map((f) => ({
            label: f.path,
            detail: `Backup: ${f.backup_path}`,
            action: 'delete',
          }))}
          actionColor="text-status-error"
        />
      )}

      {/* Packages section - will be skipped */}
      {preview.packages.length > 0 && (
        <RemovePreviewSection
          icon={<Package className="h-4 w-4" />}
          title="Packages (will NOT be removed)"
          items={preview.packages.map((p) => ({
            label: p.package,
            detail: p.note,
            action: 'skip',
          }))}
          actionColor="text-text-tertiary"
        />
      )}

      {/* Settings section - will be removed */}
      {preview.settings.length > 0 && (
        <RemovePreviewSection
          icon={<Settings className="h-4 w-4" />}
          title="Settings to remove"
          items={preview.settings.map((s) => ({
            label: s.key,
            detail: s.note,
            action: 'remove',
          }))}
          actionColor="text-status-warning"
        />
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-2 rounded-md bg-status-error px-4 py-2 text-sm font-medium text-white hover:bg-status-error/90 transition-colors"
          data-testid="confirm-remove-button"
        >
          <Trash2 className="h-4 w-4" />
          Remove Files
        </button>
      </div>
    </div>
  );
}

interface RemovePreviewSectionProps {
  icon: React.ReactNode;
  title: string;
  items: readonly { label: string; detail: string; action: string }[];
  actionColor: string;
}

function RemovePreviewSection({ icon, title, items, actionColor }: RemovePreviewSectionProps) {
  return (
    <div className="rounded-md border border-border-default bg-bg-tertiary p-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-text-primary">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {item.action === 'skip' ? (
                <SkipForward className={`h-3 w-3 ${actionColor} flex-shrink-0`} />
              ) : item.action === 'delete' ? (
                <Trash2 className={`h-3 w-3 ${actionColor} flex-shrink-0`} />
              ) : (
                <AlertCircle className={`h-3 w-3 ${actionColor} flex-shrink-0`} />
              )}
              <span className="font-mono text-text-secondary">{item.label}</span>
            </div>
            <span className="text-text-tertiary text-xs ml-5">{item.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CompleteContentProps {
  result: RemoveResponse;
  onClose: () => void;
}

function CompleteContent({ result, onClose }: CompleteContentProps) {
  const isSuccess = result.success;
  const hasFailures = result.items_failed > 0;

  return (
    <div className="space-y-4">
      {/* Success/failure banner */}
      {isSuccess && !hasFailures && (
        <div className="flex items-start gap-3 rounded-md border border-status-success/30 bg-status-success/10 p-4">
          <CheckCircle className="h-5 w-5 text-status-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-status-success">Removal completed successfully</p>
            <p className="text-sm text-text-secondary mt-1">
              {result.items_deleted} file{result.items_deleted !== 1 ? 's' : ''} deleted,{' '}
              {result.items_removed} setting{result.items_removed !== 1 ? 's' : ''} removed,{' '}
              {result.items_skipped} package{result.items_skipped !== 1 ? 's' : ''} preserved
            </p>
          </div>
        </div>
      )}

      {hasFailures && (
        <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-status-warning">Removal completed with errors</p>
            <p className="text-sm text-text-secondary mt-1">
              {result.items_deleted} deleted, {result.items_failed} failed
            </p>
          </div>
        </div>
      )}

      {/* Results list */}
      {result.items.length > 0 && (
        <div className="rounded-md border border-border-default bg-bg-tertiary p-3 max-h-60 overflow-y-auto">
          <p className="text-sm font-medium text-text-primary mb-2">Results</p>
          <div className="space-y-1">
            {result.items.map((item, index) => (
              <RemoveItemResultRow key={index} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Tip about backups */}
      <div className="flex items-start gap-2 text-xs text-text-tertiary bg-bg-tertiary rounded-md p-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          To restore deleted files, copy from the .homelabcmd.bak backups on the target machine.
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

interface RemoveItemResultRowProps {
  item: RemoveItemResult;
}

function RemoveItemResultRow({ item }: RemoveItemResultRowProps) {
  const getIcon = () => {
    if (item.action === 'skipped') {
      return <SkipForward className="h-4 w-4 text-text-tertiary flex-shrink-0" />;
    }
    if (item.success) {
      return <CheckCircle className="h-4 w-4 text-status-success flex-shrink-0" />;
    }
    return <AlertCircle className="h-4 w-4 text-status-error flex-shrink-0" />;
  };

  return (
    <div className="flex items-start gap-2 text-sm">
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono truncate ${
              item.success ? 'text-text-secondary' : 'text-status-error'
            }`}
          >
            {item.item}
          </span>
          <span className="text-xs text-text-tertiary flex-shrink-0">({item.action})</span>
        </div>
        {item.backup_path && (
          <span className="text-xs text-text-tertiary">Backup: {item.backup_path}</span>
        )}
        {item.note && !item.backup_path && (
          <span className="text-xs text-text-tertiary">{item.note}</span>
        )}
        {item.error && (
          <span className="text-xs text-status-error">{item.error}</span>
        )}
      </div>
    </div>
  );
}
