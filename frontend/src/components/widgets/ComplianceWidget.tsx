/**
 * Compliance Dashboard Widget
 *
 * Displays fleet-wide configuration compliance status with summary counts,
 * colour-coded border, and non-compliant machine list.
 *
 * Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import { getComplianceSummary, checkCompliance } from '../../api/config-check';
import type { ComplianceSummaryResponse, ComplianceMachineSummary } from '../../types/config-check';

interface ComplianceWidgetProps {
  /** Whether in edit mode (shows resize handles) */
  isEditMode?: boolean;
  /** Callback when remove button clicked */
  onRemove?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const POLLING_INTERVAL = 60000; // 60 seconds
const MAX_DISPLAYED_MACHINES = 5;

/**
 * Get border colour class based on compliance state.
 * - Green if all compliant
 * - Amber if some non-compliant
 * - Grey if all never checked
 */
function getBorderColour(summary: ComplianceSummaryResponse['summary']): string {
  if (summary.non_compliant > 0) {
    return 'border-l-status-warning';
  }
  if (summary.compliant > 0) {
    return 'border-l-status-success';
  }
  return 'border-l-text-muted';
}

/**
 * Compliance Dashboard Widget
 *
 * Shows fleet-wide compliance status with:
 * - Summary counts (compliant/non-compliant/never checked)
 * - Colour-coded border based on overall status
 * - List of non-compliant machines with mismatch counts
 * - Navigation to detail pages
 * - Check All button to trigger compliance checks
 */
export function ComplianceWidget({
  isEditMode = false,
  onRemove,
  className,
}: ComplianceWidgetProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<ComplianceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number } | null>(null);

  // Fetch compliance summary
  const fetchSummary = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getComplianceSummary();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch compliance summary');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchSummary(true);

    const interval = setInterval(() => {
      if (!checkingAll) {
        fetchSummary(false);
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchSummary, checkingAll]);

  // Handle Check All action
  const handleCheckAll = useCallback(async () => {
    if (!data || checkingAll) return;

    // Get machines that have packs assigned (exclude never_checked without pack)
    const machinesWithPacks = data.machines.filter(m => m.pack !== null);
    if (machinesWithPacks.length === 0) {
      return;
    }

    setCheckingAll(true);
    setCheckProgress({ current: 0, total: machinesWithPacks.length });

    try {
      for (let i = 0; i < machinesWithPacks.length; i++) {
        const machine = machinesWithPacks[i];
        if (machine.pack) {
          try {
            await checkCompliance(machine.id, { pack_name: machine.pack });
          } catch {
            // Continue with remaining machines even if one fails
          }
          setCheckProgress({ current: i + 1, total: machinesWithPacks.length });
        }
      }
      // Refresh data after all checks
      await fetchSummary(false);
    } finally {
      setCheckingAll(false);
      setCheckProgress(null);
    }
  }, [data, checkingAll, fetchSummary]);

  // Navigate to machine's config diff view
  const handleMachineClick = useCallback((machineId: string) => {
    navigate(`/servers/${machineId}/config`);
  }, [navigate]);

  // Navigate to configuration management page
  const handleViewDetails = useCallback(() => {
    navigate('/config');
  }, [navigate]);

  // Get non-compliant machines for display
  const nonCompliantMachines = data?.machines.filter(
    (m): m is ComplianceMachineSummary & { status: 'non_compliant' } =>
      m.status === 'non_compliant'
  ) ?? [];

  const displayedMachines = nonCompliantMachines.slice(0, MAX_DISPLAYED_MACHINES);
  const remainingCount = nonCompliantMachines.length - MAX_DISPLAYED_MACHINES;

  // Check if any machines have packs configured
  const hasPacksConfigured = data?.machines.some(m => m.pack !== null) ?? false;

  // Border colour based on compliance state
  const borderColour = data ? getBorderColour(data.summary) : 'border-l-text-muted';

  return (
    <WidgetContainer
      title="Configuration Compliance"
      icon={<ShieldCheck className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
      className={cn('border-l-4', borderColour, className)}
    >
      <div className="flex h-full flex-col" data-testid="compliance-widget">
        {/* Loading state */}
        {loading && !data && (
          <div className="flex flex-1 items-center justify-center" data-testid="compliance-loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
          </div>
        )}

        {/* Error state */}
        {error && !data && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2" data-testid="compliance-error">
            <span className="text-sm text-status-error">{error}</span>
            <button
              onClick={() => fetchSummary(true)}
              className="rounded px-3 py-1 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state - no packs configured */}
        {!loading && !error && data && !hasPacksConfigured && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-text-secondary" data-testid="compliance-empty">
            <AlertTriangle className="h-8 w-8" />
            <span className="text-sm">No packs configured</span>
            <span className="text-xs">Assign configuration packs to your machines to enable compliance checking</span>
          </div>
        )}

        {/* Main content */}
        {data && (hasPacksConfigured || data.summary.total > 0) && (
          <>
            {/* Check All button in header area */}
            <div className="mb-4 flex items-center justify-end">
              <button
                onClick={handleCheckAll}
                disabled={checkingAll || !hasPacksConfigured}
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                  (checkingAll || !hasPacksConfigured) && 'cursor-not-allowed opacity-50'
                )}
                data-testid="compliance-check-all"
              >
                <RefreshCw className={cn('h-3 w-3', checkingAll && 'animate-spin')} />
                <span>{checkingAll ? 'Checking...' : 'Check All'}</span>
              </button>
            </div>

            {/* Progress indicator */}
            {checkProgress && (
              <div className="mb-4" data-testid="compliance-progress">
                <div className="mb-1 flex justify-between text-xs text-text-secondary">
                  <span>Checking compliance...</span>
                  <span>{checkProgress.current}/{checkProgress.total}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full bg-status-info transition-all"
                    style={{ width: `${(checkProgress.current / checkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Summary counts */}
            <div className="mb-4 grid grid-cols-3 gap-2" data-testid="compliance-summary">
              <div className="text-center">
                <div className="text-2xl font-bold text-status-success" data-testid="compliance-compliant-count">
                  {data.summary.compliant}
                </div>
                <div className="text-xs text-text-secondary">Compliant</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-warning" data-testid="compliance-non-compliant-count">
                  {data.summary.non_compliant}
                </div>
                <div className="text-xs text-text-secondary">Non-compliant</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-text-muted" data-testid="compliance-never-checked-count">
                  {data.summary.never_checked}
                </div>
                <div className="text-xs text-text-secondary">Never checked</div>
              </div>
            </div>

            {/* Non-compliant machine list */}
            {nonCompliantMachines.length > 0 && (
              <div className="flex-1 space-y-1" data-testid="compliance-machines-list">
                <div className="mb-2 text-sm font-medium text-text-secondary">
                  Needs Attention:
                </div>
                {displayedMachines.map((machine) => (
                  <div
                    key={machine.id}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-bg-tertiary"
                    onClick={() => handleMachineClick(machine.id)}
                    data-testid={`compliance-machine-${machine.id}`}
                  >
                    <span className="truncate text-sm text-text-primary">
                      {machine.display_name}
                    </span>
                    <span className="flex-shrink-0 text-sm text-status-warning">
                      {machine.mismatch_count} {machine.mismatch_count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                ))}
                {remainingCount > 0 && (
                  <button
                    onClick={handleViewDetails}
                    className="flex w-full items-center justify-center gap-1 rounded px-2 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                    data-testid="compliance-view-more"
                  >
                    <span>+{remainingCount} more</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* View Details link */}
            <div className="mt-4 text-center">
              <button
                onClick={handleViewDetails}
                className="text-sm text-text-secondary hover:text-text-primary"
                data-testid="compliance-view-details"
              >
                View Details
              </button>
            </div>
          </>
        )}
      </div>
    </WidgetContainer>
  );
}
