/**
 * ScanDiskUsage - Displays disk usage for each mount point.
 *
 * Uses UsageBar with threshold colouring for visual representation.
 *
 * US0039: Scan Results Display
 */

import type { DiskInfo } from '../types/scan';
import { UsageBar } from './UsageBar';
import { formatDiskCompact } from '../lib/formatters';

interface ScanDiskUsageProps {
  /** Array of disk usage info per mount point */
  disks: DiskInfo[];
}

export function ScanDiskUsage({ disks }: ScanDiskUsageProps) {
  if (disks.length === 0) {
    return (
      <div className="rounded-lg border border-tertiary bg-secondary p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">Disk Usage</h3>
        <p className="text-text-tertiary">No disk information available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-tertiary bg-secondary p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Disk Usage</h3>
      <div className="space-y-3">
        {disks.map((disk) => (
          <UsageBar
            key={disk.mount}
            value={disk.percent}
            label={disk.mount}
            displayValue={formatDiskCompact(disk.used_gb, disk.total_gb)}
          />
        ))}
      </div>
    </div>
  );
}
