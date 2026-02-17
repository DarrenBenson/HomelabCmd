/**
 * Discovery Progress Bar component.
 *
 * EP0019: Unified Device Discovery - Single Pane of Glass
 *
 * Combined progress bar showing both network scan and Tailscale fetch progress
 * with checkmarks for completed sources.
 */

import { Check, Loader2, Wifi, Globe } from 'lucide-react';
import type { CombinedProgress } from '../../hooks/useUnifiedDiscovery';

interface DiscoveryProgressBarProps {
  progress: CombinedProgress;
  tailscaleEnabled: boolean;
}

/**
 * Individual source status indicator.
 */
function SourceStatus({
  icon: Icon,
  label,
  loading,
  complete,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  complete: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-full p-1 ${
          complete
            ? 'bg-status-success/20 text-status-success'
            : loading
              ? 'bg-status-info/20 text-status-info'
              : 'bg-bg-tertiary text-text-tertiary'
        }`}
      >
        {complete ? (
          <Check className="h-3 w-3" />
        ) : loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
      </div>
      <span
        className={`text-xs ${
          complete
            ? 'text-status-success'
            : loading
              ? 'text-text-primary'
              : 'text-text-tertiary'
        }`}
      >
        {label}
        {detail && <span className="text-text-tertiary"> - {detail}</span>}
      </span>
    </div>
  );
}

/**
 * Combined progress bar for unified discovery.
 */
export function DiscoveryProgressBar({
  progress,
  tailscaleEnabled,
}: DiscoveryProgressBarProps) {
  const {
    networkProgress,
    networkScanned,
    networkTotal,
    tailscaleComplete,
    tailscaleLoading,
  } = progress;

  const networkRunning = networkProgress !== null;
  const networkComplete = !networkRunning && networkScanned > 0;

  // Calculate segment widths
  const networkWeight = tailscaleEnabled ? 70 : 100;
  const tailscaleWeight = tailscaleEnabled ? 30 : 0;

  const networkWidth = networkRunning
    ? (networkProgress / 100) * networkWeight
    : networkComplete
      ? networkWeight
      : 0;

  const tailscaleWidth = tailscaleComplete
    ? tailscaleWeight
    : tailscaleLoading
      ? tailscaleWeight * 0.5 // Show partial progress while loading
      : 0;

  const totalWidth = networkWidth + tailscaleWidth;

  // Determine network detail text
  let networkDetail: string | undefined;
  if (networkRunning) {
    networkDetail = `${networkScanned}/${networkTotal} IPs`;
  } else if (networkComplete) {
    networkDetail = 'Complete';
  }

  // Only show progress bar if something is happening
  const showProgressBar = networkRunning || tailscaleLoading;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {showProgressBar && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Discovering devices...</span>
            <span className="font-mono text-text-primary">{Math.round(totalWidth)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div className="flex h-full">
              {/* Network segment */}
              <div
                className={`h-full transition-all duration-300 ${
                  networkComplete ? 'bg-status-success' : 'bg-status-info'
                }`}
                style={{ width: `${networkWidth}%` }}
              />
              {/* Tailscale segment */}
              {tailscaleEnabled && (
                <div
                  className={`h-full transition-all duration-300 ${
                    tailscaleComplete ? 'bg-status-success' : 'bg-purple-500'
                  }`}
                  style={{ width: `${tailscaleWidth}%` }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source status indicators */}
      <div className="flex flex-wrap items-center gap-4">
        <SourceStatus
          icon={Wifi}
          label="Network"
          loading={networkRunning}
          complete={networkComplete}
          detail={networkDetail}
        />
        {tailscaleEnabled && (
          <SourceStatus
            icon={Globe}
            label="Tailscale"
            loading={tailscaleLoading}
            complete={tailscaleComplete}
            detail={tailscaleComplete ? 'Complete' : undefined}
          />
        )}
      </div>
    </div>
  );
}
