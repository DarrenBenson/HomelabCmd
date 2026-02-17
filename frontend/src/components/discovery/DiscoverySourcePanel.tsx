/**
 * Discovery Source Panel component.
 *
 * EP0019: Unified Device Discovery - Single Pane of Glass
 *
 * Control panel for discovery sources with toggles, status, and "Discover All" button.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wifi,
  Globe,
  Settings,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Key,
} from 'lucide-react';
import { DiscoveryProgressBar } from './DiscoveryProgressBar';
import type { SourceStatus, CombinedProgress } from '../../hooks/useUnifiedDiscovery';
import type { DiscoverySettings } from '../../types/discovery';
import type { SSHKeyMetadata } from '../../types/scan';

interface DiscoverySourcePanelProps {
  networkStatus: SourceStatus;
  tailscaleStatus: SourceStatus;
  networkSettings: DiscoverySettings | null;
  progress: CombinedProgress;
  isDiscovering: boolean;
  sshKeys: SSHKeyMetadata[];
  selectedKeyId: string;
  onKeyIdChange: (keyId: string) => void;
  onDiscoverAll: (keyId?: string) => void;
  onOpenSettings: () => void;
}

/**
 * Connection status indicator.
 */
function ConnectionStatus({
  configured,
  error,
  label,
}: {
  configured: boolean;
  error: string | null;
  label: string;
}) {
  if (error) {
    return (
      <span className="flex items-center gap-1 text-xs text-status-error" title={error}>
        <XCircle className="h-3 w-3" />
        {label} Error
      </span>
    );
  }

  if (!configured) {
    return (
      <span className="flex items-center gap-1 text-xs text-text-tertiary">
        <AlertCircle className="h-3 w-3" />
        {label} Not Configured
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-status-success">
      <CheckCircle className="h-3 w-3" />
      {label} Connected
    </span>
  );
}

/**
 * Discovery source panel with controls and status.
 */
export function DiscoverySourcePanel({
  networkStatus,
  tailscaleStatus,
  networkSettings,
  progress,
  isDiscovering,
  sshKeys,
  selectedKeyId,
  onKeyIdChange,
  onDiscoverAll,
  onOpenSettings,
}: DiscoverySourcePanelProps) {
  const [networkEnabled, setNetworkEnabled] = useState(true);
  const [tailscaleEnabled, setTailscaleEnabled] = useState(tailscaleStatus.configured);

  // Update tailscale enabled when configuration changes
  if (tailscaleStatus.configured && !tailscaleEnabled && !tailscaleStatus.loading) {
    setTailscaleEnabled(true);
  }

  const handleDiscoverAll = () => {
    onDiscoverAll(selectedKeyId || undefined);
  };

  const canDiscover =
    !isDiscovering &&
    (networkEnabled || (tailscaleEnabled && tailscaleStatus.configured));

  return (
    <section className="rounded-lg border border-border-default bg-bg-secondary p-4 space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Source toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary">Discovery Sources</h3>

          <div className="flex flex-wrap items-center gap-6">
            {/* Network source */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={networkEnabled}
                onChange={(e) => setNetworkEnabled(e.target.checked)}
                disabled={isDiscovering}
                className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-text-primary">Network Scan</span>
              </div>
              {networkSettings && (
                <span className="font-mono text-xs text-text-tertiary">
                  {networkSettings.default_subnet}
                </span>
              )}
              <button
                onClick={onOpenSettings}
                className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
                aria-label="Network discovery settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </label>

            {/* Tailscale source */}
            <label
              className={`flex items-center gap-3 ${
                tailscaleStatus.configured ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={tailscaleEnabled && tailscaleStatus.configured}
                onChange={(e) => setTailscaleEnabled(e.target.checked)}
                disabled={isDiscovering || !tailscaleStatus.configured}
                className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-text-primary">Tailscale</span>
              </div>
              <ConnectionStatus
                configured={tailscaleStatus.configured}
                error={tailscaleStatus.error}
                label=""
              />
            </label>
          </div>

          {/* Tailscale not configured hint */}
          {!tailscaleStatus.configured && (
            <p className="text-xs text-text-tertiary">
              <Link to="/settings" className="text-status-info hover:underline">
                Configure Tailscale
              </Link>{' '}
              to discover devices across your tailnet
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* SSH Key selector */}
          {networkEnabled && sshKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-text-tertiary" />
              <select
                value={selectedKeyId}
                onChange={(e) => onKeyIdChange(e.target.value)}
                disabled={isDiscovering}
                className="rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50"
                aria-label="SSH Key"
              >
                <option value="">All keys</option>
                {sshKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                    {key.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Discover All button */}
          <button
            onClick={handleDiscoverAll}
            disabled={!canDiscover}
            data-testid="discover-all-button"
            className="flex items-center gap-2 px-4 py-2 bg-status-info text-white rounded-md font-medium hover:bg-status-info/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDiscovering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Discover All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {isDiscovering && (
        <DiscoveryProgressBar
          progress={progress}
          tailscaleEnabled={tailscaleEnabled && tailscaleStatus.configured}
        />
      )}

      {/* Error states */}
      {networkStatus.error && (
        <div className="flex items-start gap-3 rounded-md border border-status-error/50 bg-status-error/10 p-3" data-testid="network-scan-status">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-status-error" />
          <div>
            <p className="text-sm font-medium text-status-error">Network Discovery Error</p>
            <p className="text-xs text-text-secondary">{networkStatus.error}</p>
          </div>
        </div>
      )}

      {tailscaleStatus.error && tailscaleEnabled && (
        <div className="flex items-start gap-3 rounded-md border border-status-error/50 bg-status-error/10 p-3" data-testid="tailscale-scan-status">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-status-error" />
          <div>
            <p className="text-sm font-medium text-status-error">Tailscale Error</p>
            <p className="text-xs text-text-secondary">{tailscaleStatus.error}</p>
          </div>
        </div>
      )}
    </section>
  );
}
