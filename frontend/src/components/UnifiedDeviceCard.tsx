/**
 * Unified Device Card component.
 *
 * EP0016: Unified Discovery Experience (US0095)
 * EP0019: Enhanced for merged devices with dual IPs and source badges
 *
 * Consistent device card for both Network and Tailscale discovery
 * with availability states, greyed-out unavailable devices, and tooltips.
 */

import { Link } from 'react-router-dom';
import {
  Server,
  Monitor,
  Smartphone,
  Download,
  ExternalLink,
  Clock,
  ShieldCheck,
  Key,
  Wifi,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { formatRelativeTime } from '../lib/formatters';
import { SourceIndicator } from './SourceBadge';
import type { UnifiedDevice, MergedDevice, MergedSource } from '../types/discovery';

interface UnifiedDeviceCardProps {
  device: UnifiedDevice | MergedDevice;
  onImport: (device: UnifiedDevice | MergedDevice) => void;
  /** Animation delay for staggered entry (in ms) */
  animationDelay?: number;
}

/**
 * Type guard to check if device is a MergedDevice.
 */
function isMergedDevice(device: UnifiedDevice | MergedDevice): device is MergedDevice {
  return 'mergedSource' in device;
}

/**
 * Get icon for device OS.
 */
function getOsIcon(os: string) {
  const osLower = os.toLowerCase();
  if (osLower === 'linux') return <Server className="h-5 w-5" />;
  if (osLower === 'windows' || osLower === 'macos') return <Monitor className="h-5 w-5" />;
  if (osLower === 'ios' || osLower === 'android') return <Smartphone className="h-5 w-5" />;
  return <Server className="h-5 w-5" />;
}

/**
 * Get recommended path icon and text.
 */
function RecommendedPathIndicator({
  path,
}: {
  path: 'network' | 'tailscale' | undefined;
}) {
  if (!path) return null;

  return (
    <span
      className="flex items-center gap-1 text-xs text-status-info"
      title={`Recommended: ${path === 'tailscale' ? 'Tailscale' : 'Direct network'} connection`}
    >
      <ArrowRight className="h-3 w-3" />
      {path === 'tailscale' ? (
        <Globe className="h-3 w-3" />
      ) : (
        <Wifi className="h-3 w-3" />
      )}
    </span>
  );
}

export function UnifiedDeviceCard({
  device,
  onImport,
  animationDelay = 0,
}: UnifiedDeviceCardProps) {
  const isUnavailable = device.availability === 'unavailable';
  const isAvailable = device.availability === 'available';
  const isMonitored = device.isMonitored;
  const merged = isMergedDevice(device);
  const mergedSource: MergedSource = merged ? device.mergedSource : device.source;

  // Card wrapper classes based on availability
  const cardClasses = `rounded-lg border p-4 transition-all duration-200 ${
    isUnavailable
      ? 'border-border-default bg-bg-tertiary opacity-50 cursor-not-allowed'
      : 'border-border-default bg-bg-secondary hover:border-border-hover hover:shadow-md hover:-translate-y-0.5'
  }`;

  // Status indicator classes
  const statusIndicatorClasses = `flex h-3 w-3 rounded-full ${
    isAvailable ? 'bg-status-success' : 'bg-text-tertiary'
  }`;

  // Animation style for staggered entry
  const animationStyle = animationDelay > 0
    ? {
        animation: 'fadeInUp 0.3s ease-out forwards',
        animationDelay: `${animationDelay}ms`,
        opacity: 0,
      }
    : undefined;

  return (
    <div
      className={cardClasses}
      data-testid={`device-card-${device.id}`}
      title={isUnavailable ? device.unavailableReason || 'Device unavailable' : undefined}
      style={animationStyle}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Status indicator */}
          <div
            className={statusIndicatorClasses}
            title={
              isAvailable
                ? 'Available'
                : isUnavailable
                  ? device.unavailableReason || 'Unavailable'
                  : 'Status unknown'
            }
          />

          <div className="min-w-0 flex-1">
            {/* Hostname and badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-text-primary truncate">{device.hostname}</h3>
              {isMonitored && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-status-success/20 text-status-success"
                  title="Already monitored"
                >
                  <ShieldCheck className="h-3 w-3" />
                </span>
              )}
              {/* Source badge for merged view */}
              <span data-testid={`device-source-${device.id}`}>
                <SourceIndicator
                  source={mergedSource}
                  matchConfidence={merged ? device.matchConfidence : undefined}
                />
              </span>
            </div>

            {/* IP addresses */}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              {/* Show dual IPs for merged devices */}
              {merged && mergedSource === 'both' && device.networkIp && device.tailscaleIp ? (
                <>
                  <span className="flex items-center gap-1 font-mono">
                    <Wifi className="h-3 w-3 text-blue-400" />
                    {device.networkIp}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Globe className="h-3 w-3 text-purple-400" />
                    {device.tailscaleIp}
                  </span>
                </>
              ) : (
                <span className="font-mono">{device.ip}</span>
              )}

              {/* OS */}
              <span className="flex items-center gap-1">
                {getOsIcon(device.os)}
                <span className="capitalize">{device.os}</span>
              </span>
            </div>

            {/* Additional info row */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
              {/* Response time for network devices */}
              {device.responseTimeMs !== null && (
                <span className="font-mono">{device.responseTimeMs}ms</span>
              )}

              {/* Last seen for Tailscale devices */}
              {device.lastSeen && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(device.lastSeen)}
                </span>
              )}

              {/* SSH key used */}
              {device.sshKeyUsed && isAvailable && (
                <span
                  className="flex items-center gap-1 text-status-success"
                  title={`Authenticated with: ${device.sshKeyUsed}`}
                >
                  <Key className="h-3 w-3" />
                  {device.sshKeyUsed}
                </span>
              )}

              {/* Recommended path for merged devices */}
              {merged && mergedSource === 'both' && device.recommendedPath && (
                <RecommendedPathIndicator path={device.recommendedPath} />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-3 flex-shrink-0">
          {isMonitored && device.serverId ? (
            <Link
              to={`/servers/${device.serverId}`}
              className="flex items-center gap-1.5 rounded-md bg-bg-tertiary px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
              title="View server"
              data-testid={`device-view-${device.id}`}
            >
              <ExternalLink className="h-4 w-4" />
              View
            </Link>
          ) : isAvailable && !isMonitored ? (
            <button
              onClick={() => onImport(device)}
              className="flex items-center gap-1.5 rounded-md bg-status-info px-3 py-1.5 text-sm font-medium text-white hover:bg-status-info/80 transition-colors active:scale-95"
              title="Import as server"
              data-testid={`device-import-${device.id}`}
            >
              <Download className="h-4 w-4" />
              Import
            </button>
          ) : null}
        </div>
      </div>

      {/* Unavailability tooltip hint (shown on card) */}
      {isUnavailable && device.unavailableReason && (
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-xs text-text-tertiary truncate" title={device.unavailableReason}>
            {device.unavailableReason}
          </p>
        </div>
      )}
    </div>
  );
}
