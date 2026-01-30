/**
 * Configuration diff view page component.
 *
 * Displays differences between expected and actual configuration states
 * with colour-coded sections and collapsible mismatch groups.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getConfigDiff, checkCompliance } from '../api/config-check';
import { MismatchSection } from '../components/MismatchSection';
import { DiffBlock } from '../components/DiffLine';
import { ApplyPackModal } from '../components/ApplyPackModal';
import { RemovePackModal } from '../components/RemovePackModal';
import { cn } from '../lib/utils';
import type { ConfigDiffResponse, DiffMismatchItem } from '../types/config-check';

function formatCheckedAt(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

interface MismatchItemCardProps {
  mismatch: DiffMismatchItem;
}

function MismatchItemCard({ mismatch }: MismatchItemCardProps) {
  return (
    <div
      className="rounded border border-border-default bg-bg-tertiary p-3"
      data-testid={`mismatch-item-${mismatch.item}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="font-mono text-sm text-text-primary truncate" title={mismatch.item}>
            {mismatch.item}
          </div>
          <div className="text-xs text-text-secondary">
            {getMismatchDescription(mismatch)}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded px-2 py-0.5 text-xs font-medium',
            getMismatchBadgeStyle(mismatch.type)
          )}
        >
          {getMismatchLabel(mismatch.type)}
        </span>
      </div>

      {/* Expected vs Actual for non-diff items */}
      {!mismatch.diff && (
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded bg-status-success/10 p-2">
            <div className="text-xs text-text-tertiary mb-1">Expected</div>
            <div className="font-mono text-status-success">
              {formatExpected(mismatch)}
            </div>
          </div>
          <div className="rounded bg-status-error/10 p-2">
            <div className="text-xs text-text-tertiary mb-1">Actual</div>
            <div className="font-mono text-status-error">
              {formatActual(mismatch)}
            </div>
          </div>
        </div>
      )}

      {/* Unified diff for file content mismatches */}
      {mismatch.diff && (
        <div className="mt-3">
          <DiffBlock diff={mismatch.diff} />
        </div>
      )}
    </div>
  );
}

function getMismatchLabel(type: string): string {
  const labels: Record<string, string> = {
    missing_file: 'Missing',
    wrong_permissions: 'Permissions',
    wrong_content: 'Content',
    missing_package: 'Missing',
    wrong_version: 'Version',
    wrong_setting: 'Value',
  };
  return labels[type] ?? type;
}

function getMismatchBadgeStyle(type: string): string {
  if (type.startsWith('missing')) {
    return 'bg-status-error/20 text-status-error';
  }
  if (type === 'wrong_version') {
    return 'bg-status-warning/20 text-status-warning';
  }
  return 'bg-status-info/20 text-status-info';
}

function getMismatchDescription(mismatch: DiffMismatchItem): string {
  switch (mismatch.type) {
    case 'missing_file':
      return 'File does not exist on server';
    case 'wrong_permissions':
      return `Expected mode ${mismatch.expected.mode}, found ${mismatch.actual.mode}`;
    case 'wrong_content':
      return 'File content differs from expected';
    case 'missing_package':
      return 'Package is not installed';
    case 'wrong_version':
      return `Expected >= ${mismatch.expected.min_version}, found ${mismatch.actual.version}`;
    case 'wrong_setting':
      return `Expected "${mismatch.expected.value}", found "${mismatch.actual.value}"`;
    default:
      return 'Configuration mismatch';
  }
}

function formatExpected(mismatch: DiffMismatchItem): string {
  const { expected } = mismatch;
  if (mismatch.type === 'missing_file') {
    return `exists: true${expected.mode ? `, mode: ${expected.mode}` : ''}`;
  }
  if (mismatch.type === 'wrong_permissions') {
    return expected.mode ?? 'unknown';
  }
  if (mismatch.type === 'missing_package') {
    return 'installed: true';
  }
  if (mismatch.type === 'wrong_version') {
    return `>= ${expected.min_version ?? 'unknown'}`;
  }
  if (mismatch.type === 'wrong_setting') {
    return expected.value ?? 'unknown';
  }
  return JSON.stringify(expected);
}

function formatActual(mismatch: DiffMismatchItem): string {
  const { actual } = mismatch;
  if (mismatch.type === 'missing_file') {
    return 'not found';
  }
  if (mismatch.type === 'wrong_permissions') {
    return actual.mode ?? 'unknown';
  }
  if (mismatch.type === 'missing_package') {
    return 'not installed';
  }
  if (mismatch.type === 'wrong_version') {
    return actual.version ?? 'unknown';
  }
  if (mismatch.type === 'wrong_setting') {
    return actual.value ?? '(empty)';
  }
  return JSON.stringify(actual);
}

export function ConfigDiffView() {
  const { serverId } = useParams<{ serverId: string }>();
  const [searchParams] = useSearchParams();
  const packName = searchParams.get('pack') ?? 'base';
  const navigate = useNavigate();

  const [data, setData] = useState<ConfigDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const fetchDiff = useCallback(async () => {
    if (!serverId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getConfigDiff(serverId, packName);
      setData(response);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('404')) {
          setError('No compliance check found. Run a check first.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to fetch configuration diff');
      }
    } finally {
      setLoading(false);
    }
  }, [serverId, packName]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const handleCheckAgain = async () => {
    if (!serverId) return;

    setChecking(true);
    setError(null);

    try {
      await checkCompliance(serverId, { pack_name: packName });
      await fetchDiff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compliance check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Filter mismatches by category
  const fileMismatches = data?.mismatches.filter((m) => m.category === 'files') ?? [];
  const packageMismatches = data?.mismatches.filter((m) => m.category === 'packages') ?? [];
  const settingMismatches = data?.mismatches.filter((m) => m.category === 'settings') ?? [];

  // Loading state
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info"
              data-testid="loading-spinner"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              data-testid="back-button"
              aria-label="Back to server detail"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Configuration Compliance
              </h1>
              <p className="text-sm text-text-secondary">
                {serverId} &middot; Pack: {packName}
              </p>
            </div>
          </div>
          <button
            onClick={handleCheckAgain}
            disabled={checking}
            className={cn(
              'flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-white hover:bg-status-info/80 transition-colors',
              checking && 'opacity-50 cursor-not-allowed'
            )}
            data-testid="check-again-button"
          >
            {checking ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Checking...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Check Again
              </>
            )}
          </button>
        </header>

        {/* Error state */}
        {error && (
          <div
            className="mb-6 rounded-md border border-status-error/30 bg-status-error/10 p-4 text-status-error"
            data-testid="error-message"
          >
            {error}
          </div>
        )}

        {/* Summary card */}
        {data && (
          <div
            className={cn(
              'mb-6 rounded-lg border p-6',
              data.is_compliant
                ? 'border-status-success/30 bg-status-success/10'
                : 'border-status-error/30 bg-status-error/10'
            )}
            data-testid="compliance-summary"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {data.is_compliant ? (
                  <svg
                    className="h-8 w-8 text-status-success"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-8 w-8 text-status-error"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                <div>
                  <h2
                    className={cn(
                      'text-xl font-semibold',
                      data.is_compliant ? 'text-status-success' : 'text-status-error'
                    )}
                    data-testid="compliance-status"
                  >
                    {data.is_compliant ? 'Compliant' : 'Non-Compliant'}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    Last checked: {formatCheckedAt(data.checked_at)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-text-primary" data-testid="mismatch-count">
                  {data.summary.mismatched}
                </div>
                <div className="text-sm text-text-secondary">
                  {data.summary.mismatched === 1 ? 'mismatch' : 'mismatches'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mismatch sections */}
        {data && !data.is_compliant && (
          <div className="space-y-4" data-testid="mismatch-sections">
            <MismatchSection
              title="Missing Files"
              count={fileMismatches.filter((m) => m.type === 'missing_file').length}
              variant="error"
              defaultExpanded
            >
              {fileMismatches
                .filter((m) => m.type === 'missing_file')
                .map((m, i) => (
                  <MismatchItemCard key={`${m.item}-${i}`} mismatch={m} />
                ))}
            </MismatchSection>

            <MismatchSection
              title="Permission Mismatches"
              count={fileMismatches.filter((m) => m.type === 'wrong_permissions').length}
              variant="warning"
            >
              {fileMismatches
                .filter((m) => m.type === 'wrong_permissions')
                .map((m, i) => (
                  <MismatchItemCard key={`${m.item}-${i}`} mismatch={m} />
                ))}
            </MismatchSection>

            <MismatchSection
              title="Content Differences"
              count={fileMismatches.filter((m) => m.type === 'wrong_content').length}
              variant="info"
            >
              {fileMismatches
                .filter((m) => m.type === 'wrong_content')
                .map((m, i) => (
                  <MismatchItemCard key={`${m.item}-${i}`} mismatch={m} />
                ))}
            </MismatchSection>

            <MismatchSection
              title="Missing Packages"
              count={packageMismatches.filter((m) => m.type === 'missing_package').length}
              variant="error"
            >
              {packageMismatches
                .filter((m) => m.type === 'missing_package')
                .map((m, i) => (
                  <MismatchItemCard key={`${m.item}-${i}`} mismatch={m} />
                ))}
            </MismatchSection>

            <MismatchSection
              title="Version Mismatches"
              count={packageMismatches.filter((m) => m.type === 'wrong_version').length}
              variant="warning"
            >
              {packageMismatches
                .filter((m) => m.type === 'wrong_version')
                .map((m, i) => (
                  <MismatchItemCard key={`${m.item}-${i}`} mismatch={m} />
                ))}
            </MismatchSection>

            <MismatchSection
              title="Setting Mismatches"
              count={settingMismatches.length}
              variant="warning"
            >
              {settingMismatches.map((m, i) => (
                <MismatchItemCard key={`${m.item}-${i}`} mismatch={m} />
              ))}
            </MismatchSection>
          </div>
        )}

        {/* Compliant message */}
        {data && data.is_compliant && (
          <div
            className="rounded-lg border border-status-success/30 bg-bg-secondary p-8 text-center"
            data-testid="compliant-message"
          >
            <svg
              className="mx-auto h-16 w-16 text-status-success mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg text-text-primary">
              All configuration items are compliant with the <strong>{packName}</strong> pack.
            </p>
          </div>
        )}

        {/* Action buttons - US0119 Apply, US0123 Remove */}
        {data && !data.is_compliant && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowRemoveModal(true)}
              className="rounded-md border border-status-error px-6 py-2 text-status-error hover:bg-status-error/10 transition-colors"
              data-testid="remove-pack-button"
            >
              Remove Pack
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              className="rounded-md bg-status-info px-6 py-2 text-white hover:bg-status-info/80 transition-colors"
              data-testid="apply-pack-button"
            >
              Apply {packName} Pack
            </button>
          </div>
        )}

        {/* Apply Pack Modal - US0119 */}
        {serverId && (
          <ApplyPackModal
            isOpen={showApplyModal}
            serverId={serverId}
            serverName={serverId}
            packName={packName}
            onClose={() => setShowApplyModal(false)}
            onSuccess={() => {
              // Refresh the diff view after successful apply
              fetchDiff();
            }}
          />
        )}

        {/* Remove Pack Modal - US0123 */}
        {serverId && (
          <RemovePackModal
            isOpen={showRemoveModal}
            serverId={serverId}
            serverName={serverId}
            packName={packName}
            onClose={() => setShowRemoveModal(false)}
            onSuccess={() => {
              // Refresh the diff view after successful removal
              fetchDiff();
            }}
          />
        )}
      </div>
    </div>
  );
}
