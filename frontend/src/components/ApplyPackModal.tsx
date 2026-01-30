/**
 * Modal for applying a configuration pack to a server.
 *
 * EP0010: Configuration Management - US0119 Apply Configuration Pack.
 *
 * States:
 * - Preview: Shows dry-run results grouped by type
 * - Progress: Polls for updates, shows progress bar and item list
 * - Complete: Shows summary with success/failure counts
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Play,
  FileText,
  Package,
  Settings,
} from 'lucide-react';
import { getApplyPreview, applyConfigPack, getApplyStatus } from '../api/config-apply';
import type {
  ApplyPreviewResponse,
  ApplyStatusResponse,
  ApplyItemResult,
} from '../types/config-apply';

interface ApplyPackModalProps {
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
  /** Callback when apply succeeds */
  onSuccess?: () => void;
}

type ModalState = 'loading' | 'preview' | 'applying' | 'complete' | 'error';

export function ApplyPackModal({
  isOpen,
  serverId,
  serverName,
  packName,
  onClose,
  onSuccess,
}: ApplyPackModalProps) {
  const [state, setState] = useState<ModalState>('loading');
  const [preview, setPreview] = useState<ApplyPreviewResponse | null>(null);
  const [applyId, setApplyId] = useState<number | null>(null);
  const [status, setStatus] = useState<ApplyStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const result = await getApplyPreview(serverId, packName);
      setPreview(result);
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
      setApplyId(null);
      setStatus(null);
      setError(null);
    }
  }, [isOpen, serverId, packName, loadPreview]);

  // Poll for status while applying
  useEffect(() => {
    if (state !== 'applying' || applyId === null) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await getApplyStatus(serverId, applyId);
        setStatus(result);

        if (result.status === 'completed' || result.status === 'failed') {
          setState('complete');
          clearInterval(pollInterval);

          if (result.status === 'completed' && result.items_failed === 0) {
            onSuccess?.();
          }
        }
      } catch (err) {
        console.error('Failed to poll apply status:', err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [state, applyId, serverId, onSuccess]);

  async function handleApply() {
    setState('applying');
    setError(null);

    try {
      const result = await applyConfigPack(serverId, packName);
      setApplyId(result.apply_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start apply');
      setState('error');
    }
  }

  function handleClose() {
    if (state !== 'applying') {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="apply-pack-modal"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play className="h-5 w-5 text-status-info" />
            <h2 className="text-lg font-semibold text-text-primary">
              Apply Configuration Pack
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={state === 'applying'}
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
            onApply={handleApply}
            onClose={handleClose}
          />
        )}

        {/* Applying state */}
        {state === 'applying' && (
          <ProgressContent status={status} />
        )}

        {/* Complete state */}
        {state === 'complete' && status && (
          <CompleteContent
            status={status}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}

interface PreviewContentProps {
  preview: ApplyPreviewResponse;
  serverName: string;
  packName: string;
  onApply: () => void;
  onClose: () => void;
}

function PreviewContent({
  preview,
  serverName,
  packName,
  onApply,
  onClose,
}: PreviewContentProps) {
  return (
    <div className="space-y-5">
      <p className="text-text-secondary">
        Apply <span className="font-medium text-text-primary">{packName}</span> to{' '}
        <span className="font-medium text-text-primary">{serverName}</span>?
      </p>

      <p className="text-sm text-text-tertiary">
        This will make the following changes:
      </p>

      {/* Files section */}
      {preview.files.length > 0 && (
        <PreviewSection
          icon={<FileText className="h-4 w-4" />}
          title="Files to create/update"
          items={preview.files.map((f) => ({
            label: f.path,
            detail: f.mode,
          }))}
        />
      )}

      {/* Packages section */}
      {preview.packages.length > 0 && (
        <PreviewSection
          icon={<Package className="h-4 w-4" />}
          title="Packages to install"
          items={preview.packages.map((p) => ({
            label: p.package,
            detail: p.version ?? undefined,
          }))}
        />
      )}

      {/* Settings section */}
      {preview.settings.length > 0 && (
        <PreviewSection
          icon={<Settings className="h-4 w-4" />}
          title="Settings to change"
          items={preview.settings.map((s) => ({
            label: `${s.key}`,
            detail: s.value,
          }))}
        />
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 text-xs text-text-tertiary bg-bg-tertiary rounded-md p-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          This will execute commands with sudo on the target machine. Ensure you trust
          this pack's contents.
        </span>
      </div>

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
          onClick={onApply}
          className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors"
          data-testid="confirm-apply-button"
        >
          Confirm and Apply
        </button>
      </div>
    </div>
  );
}

interface PreviewSectionProps {
  icon: React.ReactNode;
  title: string;
  items: readonly { label: string; detail?: string }[];
}

function PreviewSection({ icon, title, items }: PreviewSectionProps) {
  return (
    <div className="rounded-md border border-border-default bg-bg-tertiary p-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-text-primary">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center justify-between">
            <span className="font-mono text-text-secondary">{item.label}</span>
            {item.detail && (
              <span className="text-text-tertiary text-xs">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ProgressContentProps {
  status: ApplyStatusResponse | null;
}

function ProgressContent({ status }: ProgressContentProps) {
  const progress = status?.progress ?? 0;
  const currentItem = status?.current_item ?? 'Initialising...';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-text-primary">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-medium">Applying configuration...</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-bg-tertiary rounded-full h-2.5">
        <div
          className="bg-status-info h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-text-secondary">
        <span>{currentItem}</span>
        <span>{progress}%</span>
      </div>

      {/* Results list */}
      {status?.items && status.items.length > 0 && (
        <div className="mt-4 space-y-1 max-h-40 overflow-y-auto">
          {status.items.map((item, index) => (
            <ItemResult key={index} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

interface CompleteContentProps {
  status: ApplyStatusResponse;
  onClose: () => void;
}

function CompleteContent({ status, onClose }: CompleteContentProps) {
  const isSuccess = status.status === 'completed' && status.items_failed === 0;
  const isPartialSuccess = status.status === 'completed' && status.items_failed > 0;

  return (
    <div className="space-y-4">
      {/* Success/failure banner */}
      {isSuccess && (
        <div className="flex items-start gap-3 rounded-md border border-status-success/30 bg-status-success/10 p-4">
          <CheckCircle className="h-5 w-5 text-status-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-status-success">Apply completed successfully</p>
            <p className="text-sm text-text-secondary mt-1">
              {status.items_completed} item{status.items_completed !== 1 ? 's' : ''} applied
            </p>
          </div>
        </div>
      )}

      {isPartialSuccess && (
        <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-status-warning">Apply completed with errors</p>
            <p className="text-sm text-text-secondary mt-1">
              {status.items_completed} succeeded, {status.items_failed} failed
            </p>
          </div>
        </div>
      )}

      {status.status === 'failed' && (
        <div className="flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-4">
          <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-status-error">Apply failed</p>
            <p className="text-sm text-text-secondary mt-1">
              {status.error ?? 'Unknown error'}
            </p>
          </div>
        </div>
      )}

      {/* Results list */}
      {status.items.length > 0 && (
        <div className="rounded-md border border-border-default bg-bg-tertiary p-3 max-h-60 overflow-y-auto">
          <p className="text-sm font-medium text-text-primary mb-2">Results</p>
          <div className="space-y-1">
            {status.items.map((item, index) => (
              <ItemResult key={index} item={item} />
            ))}
          </div>
        </div>
      )}

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

interface ItemResultProps {
  item: ApplyItemResult;
}

function ItemResult({ item }: ItemResultProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {item.success ? (
        <CheckCircle className="h-4 w-4 text-status-success flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-status-error flex-shrink-0" />
      )}
      <span className={`font-mono ${item.success ? 'text-text-secondary' : 'text-status-error'}`}>
        {item.item}
      </span>
      {item.error && (
        <span className="text-xs text-status-error truncate" title={item.error}>
          {item.error}
        </span>
      )}
    </div>
  );
}
