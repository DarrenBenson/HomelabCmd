/**
 * NetworkDiscovery - Network discovery component for finding devices on subnet.
 *
 * Features:
 * - Displays configurable subnet
 * - Initiates discovery scan
 * - Shows progress during scan
 * - Displays found devices with monitored status
 * - Allows selecting device for scanning
 * - SSH key selector dropdown (US0073)
 *
 * US0041: Network Discovery
 * US0073: Network Discovery Key Selection
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
  Star,
  Wifi,
  WifiOff,
  ShieldX,
  Download,
  ExternalLink,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { startDiscovery, getDiscovery, getDiscoverySettings } from '../api/discovery';
import { listSSHKeys } from '../api/scans';
import type { DiscoveryResponse, DiscoveryDevice, DiscoverySettings } from '../types/discovery';
import type { SSHKeyMetadata } from '../types/scan';
import { formatRelativeTime } from '../lib/formatters';
import { DiscoverySettingsModal } from './DiscoverySettingsModal';
import { AgentInstallModal } from './AgentInstallModal';

const POLL_INTERVAL_MS = 2000;

interface NetworkDiscoveryProps {
  /** Callback when user selects a device to scan */
  onSelectDevice: (ip: string) => void;
  /** Active discovery ID to track (if any) */
  activeDiscoveryId?: number;
  /** Callback when discovery starts */
  onDiscoveryStart?: (discoveryId: number) => void;
}

export function NetworkDiscovery({
  onSelectDevice,
  activeDiscoveryId,
  onDiscoveryStart,
}: NetworkDiscoveryProps) {
  // Settings state
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // SSH keys state (US0073)
  const [sshKeys, setSSHKeys] = useState<SSHKeyMetadata[]>([]);
  const [sshKeysLoading, setSSHKeysLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState<string>(''); // Empty string means "Attempt all keys"

  // Discovery state
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Agent install modal state (EP0007)
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installTargetIp, setInstallTargetIp] = useState<string | null>(null);
  const [installTargetHostname, setInstallTargetHostname] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await getDiscoverySettings();
        setSettings(data);
      } catch (err) {
        setSettingsError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setSettingsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Fetch SSH keys on mount (US0073)
  useEffect(() => {
    async function fetchSSHKeys() {
      try {
        const response = await listSSHKeys();
        setSSHKeys(response.keys);
      } catch (err) {
        console.error('Failed to fetch SSH keys:', err);
        // Non-blocking error - keys dropdown will just be disabled
      } finally {
        setSSHKeysLoading(false);
      }
    }
    fetchSSHKeys();
  }, []);

  // Fetch discovery status
  const fetchDiscovery = useCallback(async (id: number) => {
    setDiscoveryLoading(true);
    try {
      const data = await getDiscovery(id);
      setDiscovery(data);
    } catch (err) {
      console.error('Failed to fetch discovery:', err);
    } finally {
      setDiscoveryLoading(false);
    }
  }, []);

  // Poll while discovery is running
  useEffect(() => {
    if (!activeDiscoveryId) return;

    fetchDiscovery(activeDiscoveryId);

    const shouldPoll = discovery?.status === 'running' || discovery?.status === 'pending';
    if (!shouldPoll && discovery) return;

    const interval = setInterval(() => {
      fetchDiscovery(activeDiscoveryId);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discovery?.status is in deps; full object would cause excessive re-renders
  }, [activeDiscoveryId, discovery?.status, fetchDiscovery]);

  // Handle starting discovery (US0073: pass selected key_id)
  async function handleStartDiscovery() {
    setIsStarting(true);
    try {
      const request = selectedKeyId ? { key_id: selectedKeyId } : undefined;
      const result = await startDiscovery(request);
      setDiscovery(result);
      onDiscoveryStart?.(result.discovery_id);
    } catch (err) {
      console.error('Failed to start discovery:', err);
    } finally {
      setIsStarting(false);
    }
  }

  // Handle refresh
  function handleRefresh() {
    if (activeDiscoveryId) {
      fetchDiscovery(activeDiscoveryId);
    }
  }

  const isRunning = discovery?.status === 'running' || discovery?.status === 'pending';
  const isCompleted = discovery?.status === 'completed';
  const isFailed = discovery?.status === 'failed';
  const hasDevices = isCompleted && discovery.devices && discovery.devices.length > 0;
  const noDevicesFound = isCompleted && discovery.devices && discovery.devices.length === 0;

  // Loading settings
  if (settingsLoading) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-secondary p-6" data-testid="discovery-loading">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-status-info" />
        </div>
      </div>
    );
  }

  // Settings error
  if (settingsError) {
    return (
      <div className="rounded-lg border border-status-error/50 bg-status-error/10 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-status-error" />
          <div>
            <p className="font-medium text-status-error">Failed to load discovery settings</p>
            <p className="text-sm text-text-secondary">{settingsError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border-default bg-bg-secondary p-6"
      data-testid="discovery-section"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">Network Discovery</h2>
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
          aria-label="Discovery settings"
          data-testid="discovery-settings-button"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Subnet and controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Wifi className="h-4 w-4" />
          <span className="font-mono text-sm">{settings?.default_subnet}</span>
        </div>

        {/* SSH Key selector (US0073) */}
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-text-tertiary" />
          <select
            value={selectedKeyId}
            onChange={(e) => setSelectedKeyId(e.target.value)}
            disabled={sshKeysLoading || sshKeys.length === 0 || isRunning}
            className="px-3 py-1.5 text-sm bg-bg-tertiary border border-border-default rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50"
            aria-label="SSH Key"
            data-testid="ssh-key-select"
          >
            <option value="">Attempt all keys</option>
            {sshKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name}
                {key.username ? ` (${key.username})` : ' (Default)'}
              </option>
            ))}
          </select>
          {sshKeys.length === 0 && !sshKeysLoading && (
            <span className="text-xs text-text-tertiary">No keys configured</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {discovery && (
            <button
              onClick={handleRefresh}
              disabled={discoveryLoading}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors disabled:opacity-50"
              aria-label="Refresh discovery"
              data-testid="refresh-discovery-button"
            >
              <RefreshCw className={`h-4 w-4 ${discoveryLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={handleStartDiscovery}
            disabled={isStarting || isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors disabled:opacity-50"
            data-testid="discover-button"
          >
            {isStarting || isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Discover Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress bar (when running) */}
      {isRunning && discovery.progress && (
        <div className="mb-4" data-testid="discovery-progress">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-text-secondary">Scanning network...</span>
            <span className="font-mono text-text-primary">
              {discovery.progress.scanned} / {discovery.progress.total} IPs
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full bg-status-info transition-all duration-300"
              style={{ width: `${discovery.progress.percent}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {isFailed && (
        <div className="mb-4 rounded-lg border border-status-error/50 bg-status-error/10 p-4" data-testid="discovery-error">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-status-error" />
            <div>
              <p className="font-medium text-status-error">Discovery failed</p>
              <p className="text-sm text-text-secondary">{discovery.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* No devices found */}
      {noDevicesFound && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <WifiOff className="h-12 w-12 text-text-tertiary" />
          <p className="mt-4 text-text-primary font-medium">No devices found</p>
          <p className="text-sm text-text-tertiary">
            No devices with SSH (port 22) were detected on the network.
          </p>
        </div>
      )}

      {/* Device results table */}
      {hasDevices && (
        <div data-testid="discovery-results">
          <h3 className="mb-3 text-sm font-medium text-text-secondary">
            Found Devices ({discovery.devices_found})
          </h3>
          <div className="rounded-lg border border-border-default overflow-hidden" data-testid="devices-table">
            <table className="w-full">
              <thead className="bg-bg-tertiary border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary uppercase">
                    IP
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary uppercase">
                    Hostname
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary uppercase">
                    Response
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary uppercase">
                    SSH
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-text-tertiary uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {discovery.devices?.map((device: DiscoveryDevice) => (
                  <tr
                    key={device.ip}
                    className="hover:bg-bg-tertiary transition-colors"
                    data-testid={`device-row-${device.ip}`}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-text-primary">
                      {device.ip}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {device.hostname || '--'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                      {device.response_time_ms} ms
                    </td>
                    {/* SSH status column (US0073: AC5 - show which key succeeded) */}
                    <td className="px-4 py-3 text-sm">
                      {device.ssh_auth_status === 'success' ? (
                        <span
                          className="inline-flex items-center gap-1 text-status-success"
                          title={`Authenticated with: ${device.ssh_key_used || 'unknown key'}`}
                          data-testid={`auth-success-${device.ip}`}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span className="font-medium">{device.ssh_key_used || 'Auth OK'}</span>
                        </span>
                      ) : device.ssh_auth_status === 'failed' ? (
                        <span
                          className="inline-flex items-center gap-1 text-status-error cursor-help"
                          title={device.ssh_auth_error || 'SSH authentication failed'}
                          data-testid={`auth-failed-${device.ip}`}
                        >
                          <ShieldX className="h-4 w-4" />
                          <span>Failed</span>
                        </span>
                      ) : (
                        <span className="text-text-tertiary">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {device.is_monitored ? (
                        <Link
                          to={`/servers/${device.ip.replace(/\./g, '-')}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-status-success hover:bg-status-success/10 rounded-md transition-colors"
                          data-testid={`view-server-link-${device.ip}`}
                        >
                          <Star className="h-4 w-4" />
                          View Server
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      ) : device.ssh_auth_status === 'success' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setInstallTargetIp(device.ip);
                              setInstallTargetHostname(device.hostname || null);
                              setInstallModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-status-success hover:bg-status-success/10 rounded-md transition-colors"
                            data-testid={`install-button-${device.ip}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Install Agent
                          </button>
                          <button
                            onClick={() => onSelectDevice(device.ip)}
                            className="px-3 py-1 text-sm font-medium text-status-info hover:bg-status-info/10 rounded-md transition-colors"
                            data-testid={`scan-button-${device.ip}`}
                          >
                            Scan
                          </button>
                        </div>
                      ) : (
                        <span className="text-text-tertiary text-sm">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Last discovery time */}
      {discovery?.completed_at && (
        <p className="mt-4 text-xs text-text-tertiary" data-testid="last-discovery-time">
          Last discovery: {formatRelativeTime(discovery.completed_at)}
        </p>
      )}

      {/* Settings Modal */}
      <DiscoverySettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={async () => {
          // Refresh settings after save
          try {
            const data = await getDiscoverySettings();
            setSettings(data);
          } catch (err) {
            console.error('Failed to refresh settings:', err);
          }
        }}
      />

      {/* Agent Install Modal (EP0007) */}
      {installTargetIp && (
        <AgentInstallModal
          isOpen={installModalOpen}
          ipAddress={installTargetIp}
          hostname={installTargetHostname || undefined}
          sshKeyId={selectedKeyId || undefined}
          onClose={() => {
            setInstallModalOpen(false);
            setInstallTargetIp(null);
            setInstallTargetHostname(null);
          }}
          onSuccess={() => {
            // Refresh discovery to update monitored status
            if (activeDiscoveryId) {
              fetchDiscovery(activeDiscoveryId);
            }
          }}
        />
      )}
    </div>
  );
}
