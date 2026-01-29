import { useState, useMemo } from 'react';
import { HardDrive, ChevronDown, ChevronRight } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import type { WidgetProps, FilesystemMetric } from './types';

interface DiskWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
}

/**
 * Sort key for filesystem list
 */
type SortKey = 'mount_point' | 'percent' | 'used_bytes';
type SortDirection = 'asc' | 'desc';

/**
 * Get colour based on disk usage percentage (AC3).
 * - < 70%: Green (healthy)
 * - 70-90%: Amber (warning)
 * - > 90%: Red (critical)
 */
function getDiskColour(value: number): { text: string; bar: string } {
  if (value >= 90) {
    return { text: 'text-status-error', bar: 'bg-status-error' };
  }
  if (value >= 70) {
    return { text: 'text-status-warning', bar: 'bg-status-warning' };
  }
  return { text: 'text-status-success', bar: 'bg-status-success' };
}

/**
 * Format bytes in human-readable form.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Column header component with sort indicator (AC4).
 */
function SortHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors',
        align === 'right' && 'ml-auto'
      )}
      data-testid={`sort-${sortKey}`}
    >
      {label}
      {isActive && (
        <span className="text-status-info">
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );
}

/**
 * Filesystem row component (AC2, AC5).
 */
function FilesystemRow({
  fs,
  isExpanded,
  onToggle,
}: {
  fs: FilesystemMetric;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colour = getDiskColour(fs.percent);
  const isCritical = fs.percent >= 90;
  const normalizedValue = Math.min(100, Math.max(0, fs.percent));

  return (
    <div
      className={cn(
        'border-b border-border-subtle last:border-b-0',
        isCritical && 'bg-status-error/5'
      )}
      data-testid={`filesystem-${fs.mount_point}`}
    >
      {/* Main row - clickable to expand (AC5) */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-2 px-1 hover:bg-bg-tertiary/50 transition-colors"
        aria-expanded={isExpanded}
        data-testid={`expand-${fs.mount_point}`}
      >
        {/* Expand icon */}
        <span className="text-text-muted">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>

        {/* Mount point */}
        <span
          className={cn(
            'flex-1 truncate text-left font-mono text-xs',
            isCritical ? 'text-status-error font-medium' : 'text-text-primary'
          )}
          title={fs.mount_point}
        >
          {fs.mount_point}
        </span>

        {/* Usage bar and percentage */}
        <div className="flex items-center gap-2 w-32">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary"
            role="progressbar"
            aria-valuenow={fs.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${fs.mount_point} usage: ${normalizedValue.toFixed(0)}%`}
          >
            <div
              className={cn('h-full transition-all duration-300', colour.bar)}
              style={{ width: `${normalizedValue}%` }}
            />
          </div>
          <span
            className={cn('w-10 text-right font-mono text-xs', colour.text)}
          >
            {normalizedValue.toFixed(0)}%
          </span>
        </div>

        {/* Used / Total */}
        <span className="w-24 text-right text-xs text-text-secondary">
          {formatBytes(fs.used_bytes)} / {formatBytes(fs.total_bytes)}
        </span>
      </button>

      {/* Expanded details (AC5) */}
      {isExpanded && (
        <div
          className="ml-5 pb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
          data-testid={`details-${fs.mount_point}`}
        >
          <div className="text-text-tertiary">Device:</div>
          <div className="font-mono text-text-secondary">{fs.device}</div>

          <div className="text-text-tertiary">Filesystem:</div>
          <div className="font-mono text-text-secondary">{fs.fs_type}</div>

          <div className="text-text-tertiary">Available:</div>
          <div className="font-mono text-text-secondary">
            {formatBytes(fs.available_bytes)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Disk Usage Widget (US0168)
 *
 * Displays per-filesystem disk usage with:
 * - AC1: List of all mounted filesystems
 * - AC2: Used/total and percentage with progress bars
 * - AC3: Colour-coded thresholds (green < 70%, amber 70-90%, red > 90%)
 * - AC4: Sortable columns (mount point, usage percentage)
 * - AC5: Expandable details (device, filesystem type, available space)
 */
export function DiskWidget({ machine, isEditMode = false, onRemove }: DiskWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>('mount_point');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedMounts, setExpandedMounts] = useState<Set<string>>(new Set());

  const filesystems = machine.filesystems;
  const hasFilesystems = filesystems && filesystems.length > 0;

  // Sort filesystems (AC4)
  const sortedFilesystems = useMemo(() => {
    if (!filesystems) return [];

    return [...filesystems].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'mount_point':
          comparison = a.mount_point.localeCompare(b.mount_point);
          break;
        case 'percent':
          comparison = a.percent - b.percent;
          break;
        case 'used_bytes':
          comparison = a.used_bytes - b.used_bytes;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filesystems, sortKey, sortDirection]);

  // Handle sort column click
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      // Toggle direction if same column
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      // New column - default to ascending for mount_point, descending for usage
      setSortKey(key);
      setSortDirection(key === 'mount_point' ? 'asc' : 'desc');
    }
  };

  // Toggle expanded state for a filesystem (AC5)
  const toggleExpanded = (mountPoint: string) => {
    setExpandedMounts(prev => {
      const next = new Set(prev);
      if (next.has(mountPoint)) {
        next.delete(mountPoint);
      } else {
        next.add(mountPoint);
      }
      return next;
    });
  };

  // Calculate aggregate stats for header
  const aggregateStats = useMemo(() => {
    if (!filesystems || filesystems.length === 0) return null;

    const totalBytes = filesystems.reduce((sum, fs) => sum + fs.total_bytes, 0);
    const usedBytes = filesystems.reduce((sum, fs) => sum + fs.used_bytes, 0);
    const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return { totalBytes, usedBytes, percent };
  }, [filesystems]);

  // Stale indicator for offline machines
  const isStale = machine.status === 'offline';

  // Fallback to aggregate metrics if no per-filesystem data
  const metrics = machine.latest_metrics;
  const diskPercent = metrics?.disk_percent ?? null;
  const diskUsedGb = metrics?.disk_used_gb ?? null;
  const diskTotalGb = metrics?.disk_total_gb ?? null;

  return (
    <WidgetContainer
      title="Disk Usage"
      icon={<HardDrive className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {hasFilesystems ? (
          <>
            {/* Aggregate summary header */}
            {aggregateStats && (
              <div className="mb-2 flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs text-text-secondary">
                  {sortedFilesystems.length} filesystem{sortedFilesystems.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-text-secondary">
                  Total: {formatBytes(aggregateStats.usedBytes)} / {formatBytes(aggregateStats.totalBytes)}
                  <span className={cn('ml-2 font-medium', getDiskColour(aggregateStats.percent).text)}>
                    ({aggregateStats.percent.toFixed(0)}%)
                  </span>
                </span>
              </div>
            )}

            {/* Column headers with sort (AC4) */}
            <div className="flex items-center gap-2 py-1 px-1 border-b border-border-default mb-1">
              <span className="w-3" /> {/* Spacer for expand icon */}
              <SortHeader
                label="Mount"
                sortKey="mount_point"
                currentKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <div className="flex-1" />
              <SortHeader
                label="Usage"
                sortKey="percent"
                currentKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
              />
              <span className="w-24" /> {/* Spacer for size column */}
            </div>

            {/* Scrollable filesystem list (edge case #2: many filesystems) */}
            <div className="flex-1 overflow-y-auto" data-testid="filesystem-list">
              {sortedFilesystems.map(fs => (
                <FilesystemRow
                  key={fs.mount_point}
                  fs={fs}
                  isExpanded={expandedMounts.has(fs.mount_point)}
                  onToggle={() => toggleExpanded(fs.mount_point)}
                />
              ))}
            </div>
          </>
        ) : (
          /* Fallback: show aggregate disk metrics (edge case #1: no filesystem data) */
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {diskPercent !== null ? (
              <>
                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-bg-tertiary"
                  role="progressbar"
                  aria-valuenow={diskPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Disk usage: ${diskPercent.toFixed(0)}%`}
                  data-testid="disk-progress"
                >
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      getDiskColour(diskPercent).bar
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, diskPercent))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between w-full text-sm">
                  <span className="text-text-secondary" data-testid="disk-used-total">
                    {diskUsedGb !== null ? `${diskUsedGb.toFixed(1)} GB` : '--'} /{' '}
                    {diskTotalGb !== null ? `${diskTotalGb.toFixed(1)} GB` : '--'}
                  </span>
                  <span
                    className={cn('font-mono font-bold', getDiskColour(diskPercent).text)}
                    data-testid="disk-value"
                  >
                    {diskPercent.toFixed(0)}%
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-text-muted" data-testid="no-data">
                No disk data available
              </div>
            )}
          </div>
        )}

        {/* Stale indicator for offline machines */}
        {isStale && (
          <div className="mt-1 text-xs text-status-warning" data-testid="stale-indicator">
            Last known value (offline)
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
