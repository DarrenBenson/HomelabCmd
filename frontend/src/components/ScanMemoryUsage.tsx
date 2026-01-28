/**
 * ScanMemoryUsage - Displays memory usage with progress bar.
 *
 * US0039: Scan Results Display
 */

import type { MemoryInfo } from '../types/scan';
import { UsageBar } from './UsageBar';
import { formatMemoryCompact } from '../lib/formatters';

interface ScanMemoryUsageProps {
  /** Memory usage information */
  memory: MemoryInfo | null;
}

export function ScanMemoryUsage({ memory }: ScanMemoryUsageProps) {
  if (!memory) {
    return (
      <div className="rounded-lg border border-tertiary bg-secondary p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">Memory</h3>
        <p className="text-text-tertiary">No memory information available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-tertiary bg-secondary p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Memory</h3>
      <UsageBar
        value={memory.percent}
        label="RAM"
        displayValue={formatMemoryCompact(memory.used_mb, memory.total_mb)}
      />
    </div>
  );
}
