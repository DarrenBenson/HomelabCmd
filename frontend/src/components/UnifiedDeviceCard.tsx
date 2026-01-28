/**
 * Unified Device Card component.
 *
 * EP0016: Unified Discovery Experience (US0095)
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
  Wifi,
  Globe,
  ShieldCheck,
  Key,
} from 'lucide-react';
import { formatRelativeTime } from '../lib/formatters';
import type { UnifiedDevice } from '../types/discovery';

interface UnifiedDeviceCardProps {
  device: UnifiedDevice;
  onImport: (device: UnifiedDevice) => void;
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
 * Get source icon.
 */
function getSourceIcon(source: 'network' | 'tailscale') {
  return source === 'network' ? (
    <Wifi className="h-3 w-3" />
  ) : (
    <Globe className="h-3 w-3" />
  );
}

export function UnifiedDeviceCard({ device, onImport }: UnifiedDeviceCardProps) {
  const isUnavailable = device.availability === 'unavailable';
  const isAvailable = device.availability === 'available';
  const isMonitored = device.isMonitored;

  // Card wrapper classes based on availability
  const cardClasses = `rounded-lg border p-4 transition-colors ${
    isUnavailable
      ? 'border-border-default bg-bg-tertiary opacity-50 cursor-not-allowed'
      : 'border-border-default bg-bg-secondary hover:border-border-hover'
  }`;

  // Status indicator classes
  const statusIndicatorClasses = `flex h-3 w-3 rounded-full ${
    isAvailable ? 'bg-status-success' : 'bg-text-tertiary'
  }`;

  return (
    <div
      className={cardClasses}
      data-testid={`device-card-${device.id}`}
      title={isUnavailable ? device.unavailableReason || 'Device unavailable' : undefined}
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
            {/* Hostname */}
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-primary truncate">{device.hostname}</h3>
              {isMonitored && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-status-success/20 text-status-success"
                  title="Already monitored"
                >
                  <ShieldCheck className="h-3 w-3" />
                </span>
              )}
            </div>

            {/* IP, OS, and source */}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              <span className="font-mono">{device.ip}</span>
              <span className="flex items-center gap-1">
                {getOsIcon(device.os)}
                <span className="capitalize">{device.os}</span>
              </span>
              <span
                className="flex items-center gap-1 text-text-tertiary"
                title={device.source === 'network' ? 'Network discovery' : 'Tailscale'}
              >
                {getSourceIcon(device.source)}
              </span>
            </div>

            {/* Additional info row */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
              {/* Response time for network devices */}
              {device.source === 'network' && device.responseTimeMs !== null && (
                <span className="font-mono">{device.responseTimeMs}ms</span>
              )}

              {/* Last seen for Tailscale devices */}
              {device.source === 'tailscale' && device.lastSeen && (
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
            >
              <ExternalLink className="h-4 w-4" />
              View
            </Link>
          ) : isAvailable && !isMonitored ? (
            <button
              onClick={() => onImport(device)}
              className="flex items-center gap-1.5 rounded-md bg-status-info px-3 py-1.5 text-sm font-medium text-white hover:bg-status-info/80 transition-colors"
              title="Import as server"
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
