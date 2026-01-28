/**
 * ScanSystemInfo - Displays OS information from scan results.
 *
 * Shows: Hostname, OS name/version, kernel, uptime
 *
 * US0039: Scan Results Display
 */

import type { OSInfo } from '../types/scan';
import { formatUptime } from '../lib/formatters';

interface ScanSystemInfoProps {
  /** Hostname from scan results */
  hostname: string | null;
  /** OS information */
  os: OSInfo | null;
  /** Uptime in seconds */
  uptimeSeconds: number | null;
}

export function ScanSystemInfo({ hostname, os, uptimeSeconds }: ScanSystemInfoProps) {
  return (
    <div className="rounded-lg border border-tertiary bg-secondary p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">System Information</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-text-tertiary">Hostname</span>
          <span className="font-mono text-text-primary">{hostname || '--'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">OS</span>
          <span className="font-mono text-text-primary">
            {os?.pretty_name || os?.name || '--'}
          </span>
        </div>
        {os?.kernel && (
          <div className="flex justify-between">
            <span className="text-text-tertiary">Kernel</span>
            <span className="font-mono text-text-primary">{os.kernel}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-tertiary">Uptime</span>
          <span className="font-mono text-text-primary">{formatUptime(uptimeSeconds)}</span>
        </div>
      </div>
    </div>
  );
}
