/**
 * Unified Discovery Page.
 *
 * EP0016: Unified Discovery Experience (US0094)
 *
 * Consolidates Network Discovery and Tailscale Discovery into a single page
 * with consistent UX, unified device cards, and matching action flows.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Wifi,
  Globe,
  Settings,
  RefreshCw,
  Loader2,
  Search,
  AlertCircle,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { getConnectivityStatus } from '../api/connectivity';
import { getTailscaleStatus, getTailscaleDevices } from '../api/tailscale';
import { startDiscovery, getDiscovery, getDiscoverySettings } from '../api/discovery';
import { listSSHKeys } from '../api/scans';
import { UnifiedDeviceCard } from '../components/UnifiedDeviceCard';
import { DiscoveryFilters } from '../components/DiscoveryFilters';
import { UnifiedImportModal } from '../components/UnifiedImportModal';
import { DiscoverySettingsModal } from '../components/DiscoverySettingsModal';
import { formatRelativeTime } from '../lib/formatters';
import type {
  UnifiedDevice,
  AvailabilityStatus,
  DiscoveryResponse,
  DiscoverySettings,
  DiscoveryDevice,
} from '../types/discovery';
import type { TailscaleDevice } from '../types/tailscale';
import type { SSHKeyMetadata } from '../types/scan';

type TabId = 'network' | 'tailscale';
type StatusFilter = 'all' | 'available' | 'unavailable';
type OsFilter = 'all' | 'linux' | 'windows' | 'macos' | 'other';

const POLL_INTERVAL_MS = 2000;

/**
 * Transform network discovery device to unified format.
 */
function networkDeviceToUnified(device: DiscoveryDevice): UnifiedDevice {
  let availability: AvailabilityStatus = 'untested';
  let unavailableReason: string | null = null;

  if (device.ssh_auth_status === 'success') {
    availability = 'available';
  } else if (device.ssh_auth_status === 'failed') {
    availability = 'unavailable';
    unavailableReason = device.ssh_auth_error || 'SSH authentication failed';
  }

  return {
    id: device.ip,
    hostname: device.hostname || device.ip,
    ip: device.ip,
    os: 'linux', // Network discovery doesn't detect OS, default to linux
    source: 'network',
    availability,
    unavailableReason,
    isMonitored: device.is_monitored,
    serverId: device.is_monitored ? device.ip.replace(/\./g, '-') : undefined,
    responseTimeMs: device.response_time_ms,
    lastSeen: null,
    sshKeyUsed: device.ssh_key_used,
  };
}

/**
 * Transform Tailscale device to unified format.
 */
function tailscaleDeviceToUnified(
  device: TailscaleDevice & {
    ssh_status?: 'available' | 'unavailable' | 'untested';
    ssh_error?: string | null;
    ssh_key_used?: string | null;
  }
): UnifiedDevice {
  let availability: AvailabilityStatus = 'untested';
  let unavailableReason: string | null = null;

  if (!device.online) {
    availability = 'unavailable';
    unavailableReason = `Offline - last seen ${formatRelativeTime(device.last_seen)}`;
  } else if (device.ssh_status === 'available') {
    availability = 'available';
  } else if (device.ssh_status === 'unavailable') {
    availability = 'unavailable';
    unavailableReason = device.ssh_error || 'SSH connection failed';
  }

  // Derive short hostname from full Tailscale hostname
  const shortHostname = device.hostname.split('.')[0];

  return {
    id: device.id,
    hostname: shortHostname,
    ip: device.tailscale_ip,
    os: device.os.toLowerCase(),
    source: 'tailscale',
    availability,
    unavailableReason,
    isMonitored: device.already_imported,
    serverId: device.already_imported ? shortHostname.toLowerCase() : undefined,
    responseTimeMs: null,
    lastSeen: device.last_seen,
    sshKeyUsed: device.ssh_key_used || null,
    tailscaleDeviceId: device.id,
    tailscaleHostname: device.hostname,
    tailscaleOnline: device.online,
  };
}

export function DiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine initial tab from URL or connectivity mode
  const [activeTab, setActiveTab] = useState<TabId>('network');
  const [tailscaleConfigured, setTailscaleConfigured] = useState<boolean | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [osFilter, setOsFilter] = useState<OsFilter>('all');
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');

  // SSH keys state
  const [sshKeys, setSshKeys] = useState<SSHKeyMetadata[]>([]);
  const [sshKeysLoading, setSshKeysLoading] = useState(true);

  // Network discovery state
  const [networkSettings, setNetworkSettings] = useState<DiscoverySettings | null>(null);
  const [networkSettingsLoading, setNetworkSettingsLoading] = useState(true);
  const [networkSettingsError, setNetworkSettingsError] = useState<string | null>(null);
  const [networkDiscovery, setNetworkDiscovery] = useState<DiscoveryResponse | null>(null);
  const [networkDevices, setNetworkDevices] = useState<UnifiedDevice[]>([]);
  const [isNetworkScanning, setIsNetworkScanning] = useState(false);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | undefined>(() => {
    const storedId = localStorage.getItem('activeDiscoveryId');
    return storedId ? parseInt(storedId, 10) : undefined;
  });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Tailscale state
  const [tailscaleDevices, setTailscaleDevices] = useState<UnifiedDevice[]>([]);
  const [tailscaleLoading, setTailscaleLoading] = useState(false);
  const [tailscaleError, setTailscaleError] = useState<string | null>(null);
  const [tailscaleCacheInfo, setTailscaleCacheInfo] = useState<{
    cache_hit: boolean;
    cached_at: string | null;
  } | null>(null);

  // Import modal state
  const [selectedDevice, setSelectedDevice] = useState<UnifiedDevice | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Check connectivity mode and Tailscale status on mount
  useEffect(() => {
    async function checkConfiguration() {
      try {
        const [connectivityStatus, tailscaleStatus] = await Promise.all([
          getConnectivityStatus(),
          getTailscaleStatus(),
        ]);

        setTailscaleConfigured(tailscaleStatus.configured);
        const currentMode = connectivityStatus.mode;

        // Determine initial tab based on URL param or connectivity mode
        const tabParam = searchParams.get('tab') as TabId | null;
        if (tabParam === 'tailscale' && tailscaleStatus.configured) {
          setActiveTab('tailscale');
        } else if (tabParam === 'network') {
          setActiveTab('network');
        } else if (currentMode === 'tailscale' && tailscaleStatus.configured) {
          setActiveTab('tailscale');
        } else {
          setActiveTab('network');
        }
      } catch {
        // Default to network tab on error
        setActiveTab('network');
        setTailscaleConfigured(false);
      } finally {
        setInitialLoadComplete(true);
      }
    }
    checkConfiguration();
  }, [searchParams]);

  // Fetch SSH keys on mount
  useEffect(() => {
    async function fetchSSHKeys() {
      try {
        const response = await listSSHKeys();
        setSshKeys(response.keys);
      } catch {
        // Non-blocking error
      } finally {
        setSshKeysLoading(false);
      }
    }
    fetchSSHKeys();
  }, []);

  // Fetch network discovery settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await getDiscoverySettings();
        setNetworkSettings(data);
      } catch (err) {
        setNetworkSettingsError(
          err instanceof Error ? err.message : 'Failed to load settings'
        );
      } finally {
        setNetworkSettingsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Fetch network discovery status
  const fetchNetworkDiscovery = useCallback(async (id: number) => {
    try {
      const data = await getDiscovery(id);
      setNetworkDiscovery(data);

      // Update devices when discovery completes
      if (data.status === 'completed' && data.devices) {
        setNetworkDevices(data.devices.map(networkDeviceToUnified));
      }
    } catch (err) {
      console.error('Failed to fetch discovery:', err);
    }
  }, []);

  // Poll while network discovery is running
  // Note: We intentionally only depend on networkDiscovery?.status, not the full object,
  // to avoid re-running on every state change. The shouldPoll check uses the object
  // but only cares about the status value.
  useEffect(() => {
    if (!activeDiscoveryId) return;

    fetchNetworkDiscovery(activeDiscoveryId);

    const shouldPoll =
      networkDiscovery?.status === 'running' || networkDiscovery?.status === 'pending';
    if (!shouldPoll && networkDiscovery) return;

    const interval = setInterval(() => {
      fetchNetworkDiscovery(activeDiscoveryId);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiscoveryId, networkDiscovery?.status, fetchNetworkDiscovery]);

  // Fetch Tailscale devices when tab is activated
  const fetchTailscaleDevices = useCallback(
    async (refresh = false, testSSH = true) => {
      if (!tailscaleConfigured) return;

      setTailscaleLoading(true);
      setTailscaleError(null);

      try {
        const params: { refresh?: boolean; test_ssh?: boolean } = {};
        if (refresh) params.refresh = true;
        if (testSSH) params.test_ssh = true;

        const response = await getTailscaleDevices(params);
        setTailscaleDevices(response.devices.map(tailscaleDeviceToUnified));
        setTailscaleCacheInfo({
          cache_hit: response.cache_hit,
          cached_at: response.cached_at,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch devices';
        setTailscaleError(message);
        setTailscaleDevices([]);
      } finally {
        setTailscaleLoading(false);
      }
    },
    [tailscaleConfigured]
  );

  // Load Tailscale devices when tab becomes active
  useEffect(() => {
    if (activeTab === 'tailscale' && tailscaleConfigured && initialLoadComplete) {
      fetchTailscaleDevices(false, true);
    }
  }, [activeTab, tailscaleConfigured, initialLoadComplete, fetchTailscaleDevices]);

  // Handle tab change
  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    setSearchParams({ tab });
  }

  // Handle network discovery start
  async function handleStartNetworkDiscovery() {
    setIsNetworkScanning(true);
    try {
      const request = selectedKeyId ? { key_id: selectedKeyId } : undefined;
      const result = await startDiscovery(request);
      setNetworkDiscovery(result);
      setActiveDiscoveryId(result.discovery_id);
      localStorage.setItem('activeDiscoveryId', result.discovery_id.toString());
    } catch (err) {
      console.error('Failed to start discovery:', err);
    } finally {
      setIsNetworkScanning(false);
    }
  }

  // Handle device import
  function handleImport(device: UnifiedDevice) {
    setSelectedDevice(device);
    setImportModalOpen(true);
  }

  // Handle import success
  function handleImportSuccess() {
    setImportModalOpen(false);
    setSelectedDevice(null);

    // Refresh the appropriate device list
    if (selectedDevice?.source === 'tailscale') {
      fetchTailscaleDevices(true, true);
    } else if (activeDiscoveryId) {
      fetchNetworkDiscovery(activeDiscoveryId);
    }
  }

  // Get devices for current tab with filters applied
  const devices = activeTab === 'network' ? networkDevices : tailscaleDevices;
  const filteredDevices = devices.filter((device) => {
    // Status filter
    if (statusFilter === 'available' && device.availability !== 'available') return false;
    if (statusFilter === 'unavailable' && device.availability !== 'unavailable') return false;

    // OS filter
    if (osFilter !== 'all') {
      const deviceOs = device.os.toLowerCase();
      if (osFilter === 'other') {
        if (['linux', 'windows', 'macos'].includes(deviceOs)) return false;
      } else if (deviceOs !== osFilter) {
        return false;
      }
    }

    return true;
  });

  // Compute counts
  const totalDevices = devices.length;
  const availableCount = devices.filter((d) => d.availability === 'available').length;

  // Loading state
  if (!initialLoadComplete) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-status-info" />
        </div>
      </div>
    );
  }

  const isNetworkRunning =
    networkDiscovery?.status === 'running' || networkDiscovery?.status === 'pending';

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Device Discovery</h1>
              <p className="text-sm text-text-tertiary">
                Find and import devices from your network or Tailscale
              </p>
            </div>
          </div>

          {/* Tab controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('network')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'network'
                  ? 'bg-status-info text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              <Wifi className="h-4 w-4" />
              Network Scan
            </button>
            {tailscaleConfigured && (
              <button
                onClick={() => handleTabChange('tailscale')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'tailscale'
                    ? 'bg-status-info text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                }`}
              >
                <Globe className="h-4 w-4" />
                Tailscale
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Network Scan Tab */}
        {activeTab === 'network' && (
          <>
            {/* Network discovery controls */}
            <section className="rounded-lg border border-border-default bg-bg-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Subnet info */}
                <div className="flex items-center gap-4">
                  {networkSettingsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                  ) : networkSettingsError ? (
                    <span className="text-sm text-status-error">{networkSettingsError}</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Wifi className="h-4 w-4" />
                        <span className="font-mono text-sm">{networkSettings?.default_subnet}</span>
                      </div>
                      <button
                        onClick={() => setSettingsModalOpen(true)}
                        className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
                        aria-label="Discovery settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {networkDiscovery?.completed_at && (
                    <span className="text-xs text-text-tertiary">
                      Last scan: {formatRelativeTime(networkDiscovery.completed_at)}
                    </span>
                  )}
                  <button
                    onClick={handleStartNetworkDiscovery}
                    disabled={isNetworkScanning || isNetworkRunning || networkSettingsLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors disabled:opacity-50"
                  >
                    {isNetworkScanning || isNetworkRunning ? (
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

              {/* Progress bar */}
              {isNetworkRunning && networkDiscovery?.progress && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Scanning network...</span>
                    <span className="font-mono text-text-primary">
                      {networkDiscovery.progress.scanned} / {networkDiscovery.progress.total} IPs
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-status-info transition-all duration-300"
                      style={{ width: `${networkDiscovery.progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error state */}
              {networkDiscovery?.status === 'failed' && (
                <div className="mt-4 flex items-start gap-3 rounded-md border border-status-error/50 bg-status-error/10 p-3">
                  <AlertCircle className="h-5 w-5 text-status-error" />
                  <p className="text-sm text-status-error">{networkDiscovery.error}</p>
                </div>
              )}
            </section>

            {/* Filters */}
            {networkDevices.length > 0 && (
              <DiscoveryFilters
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                osFilter={osFilter}
                onOsFilterChange={setOsFilter}
                selectedKeyId={selectedKeyId}
                onKeyIdChange={setSelectedKeyId}
                sshKeys={sshKeys}
                sshKeysLoading={sshKeysLoading}
                showKeySelector={true}
                totalCount={totalDevices}
                filteredCount={filteredDevices.length}
                availableCount={availableCount}
              />
            )}

            {/* Device grid */}
            {networkDevices.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDevices.map((device) => (
                  <UnifiedDeviceCard
                    key={device.id}
                    device={device}
                    onImport={handleImport}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isNetworkRunning &&
              networkDiscovery?.status === 'completed' &&
              networkDevices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <WifiOff className="h-12 w-12 text-text-tertiary" />
                  <p className="mt-4 font-medium text-text-primary">No devices found</p>
                  <p className="text-sm text-text-tertiary">
                    No devices with SSH (port 22) were detected on the network.
                  </p>
                </div>
              )}

            {/* No scan yet */}
            {!networkDiscovery && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-text-tertiary" />
                <p className="mt-4 font-medium text-text-primary">Ready to discover</p>
                <p className="text-sm text-text-tertiary">
                  Click "Discover Now" to scan your network for devices.
                </p>
              </div>
            )}
          </>
        )}

        {/* Tailscale Tab */}
        {activeTab === 'tailscale' && (
          <>
            {/* Tailscale controls */}
            <section className="rounded-lg border border-border-default bg-bg-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Cache info */}
                <div className="flex items-center gap-2 text-text-secondary">
                  <Globe className="h-4 w-4" />
                  {tailscaleCacheInfo && (
                    <span className="text-sm">
                      {tailscaleCacheInfo.cache_hit && tailscaleCacheInfo.cached_at
                        ? `Cached ${formatRelativeTime(tailscaleCacheInfo.cached_at)}`
                        : 'Fresh data'}
                    </span>
                  )}
                </div>

                {/* Refresh button */}
                <button
                  onClick={() => fetchTailscaleDevices(true, true)}
                  disabled={tailscaleLoading}
                  className="flex items-center gap-2 rounded-md bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${tailscaleLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Loading state */}
              {tailscaleLoading && tailscaleDevices.length === 0 && (
                <div className="mt-4 flex items-center gap-2 text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Testing SSH connectivity...</span>
                </div>
              )}
            </section>

            {/* Error state */}
            {tailscaleError && (
              <div className="flex items-center gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-4 text-status-error">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{tailscaleError}</span>
                <button
                  onClick={() => fetchTailscaleDevices(true, true)}
                  className="ml-auto rounded-md bg-status-error px-3 py-1 text-sm font-medium text-white hover:bg-status-error/80"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Filters */}
            {tailscaleDevices.length > 0 && (
              <DiscoveryFilters
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                osFilter={osFilter}
                onOsFilterChange={setOsFilter}
                selectedKeyId={selectedKeyId}
                onKeyIdChange={setSelectedKeyId}
                sshKeys={sshKeys}
                sshKeysLoading={sshKeysLoading}
                showKeySelector={false}
                totalCount={totalDevices}
                filteredCount={filteredDevices.length}
                availableCount={availableCount}
              />
            )}

            {/* Device grid */}
            {tailscaleDevices.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDevices.map((device) => (
                  <UnifiedDeviceCard
                    key={device.id}
                    device={device}
                    onImport={handleImport}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!tailscaleLoading && !tailscaleError && tailscaleDevices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <XCircle className="h-12 w-12 text-text-tertiary" />
                <p className="mt-4 font-medium text-text-primary">No devices found</p>
                <p className="text-sm text-text-tertiary">
                  No devices found in your tailnet.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Settings Modal */}
      <DiscoverySettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={async () => {
          try {
            const data = await getDiscoverySettings();
            setNetworkSettings(data);
          } catch (err) {
            console.error('Failed to refresh settings:', err);
          }
        }}
      />

      {/* Import Modal */}
      {selectedDevice && (
        <UnifiedImportModal
          isOpen={importModalOpen}
          device={selectedDevice}
          sshKeys={sshKeys}
          onClose={() => {
            setImportModalOpen(false);
            setSelectedDevice(null);
          }}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
