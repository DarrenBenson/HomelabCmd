/**
 * Unified Discovery hook.
 *
 * EP0019: Unified Device Discovery - Single Pane of Glass
 *
 * Fetches devices from both Network Scan and Tailscale APIs in parallel,
 * then merges results using intelligent device matching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getConnectivityStatus } from '../api/connectivity';
import { getTailscaleStatus, getTailscaleDevices } from '../api/tailscale';
import { startDiscovery, getDiscovery, getDiscoverySettings } from '../api/discovery';
import { formatRelativeTime } from '../lib/formatters';
import { mergeDevices } from '../lib/deviceMatcher';
import type {
  UnifiedDevice,
  MergedDevice,
  AvailabilityStatus,
  DiscoveryResponse,
  DiscoverySettings,
  DiscoveryDevice,
} from '../types/discovery';
import type { TailscaleDevice } from '../types/tailscale';

const POLL_INTERVAL_MS = 2000;
const DISCOVERY_ID_STORAGE_KEY = 'activeDiscoveryId';

/**
 * Discovery source status.
 */
export interface SourceStatus {
  enabled: boolean;
  configured: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * Combined progress for all discovery sources.
 */
export interface CombinedProgress {
  networkProgress: number | null; // 0-100 or null if not running
  networkScanned: number;
  networkTotal: number;
  tailscaleComplete: boolean;
  tailscaleLoading: boolean;
  overallPercent: number;
}

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
    id: `network-${device.ip}`,
    hostname: device.hostname || device.ip,
    ip: device.ip,
    os: 'linux', // Network discovery doesn't detect OS
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

  const shortHostname = device.hostname.split('.')[0];

  return {
    id: `tailscale-${device.id}`,
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

export interface UseUnifiedDiscoveryOptions {
  /** Key ID for network discovery SSH authentication */
  selectedKeyId?: string;
  /** Whether to auto-load Tailscale devices on mount */
  autoLoadTailscale?: boolean;
}

export interface UseUnifiedDiscoveryResult {
  /** Merged device list from all sources */
  devices: MergedDevice[];

  /** Network-only devices (before merge) */
  networkDevices: UnifiedDevice[];

  /** Tailscale-only devices (before merge) */
  tailscaleDevices: UnifiedDevice[];

  /** Network source status */
  networkStatus: SourceStatus;

  /** Tailscale source status */
  tailscaleStatus: SourceStatus;

  /** Network discovery settings */
  networkSettings: DiscoverySettings | null;

  /** Combined progress information */
  progress: CombinedProgress;

  /** Network discovery response (for detailed status) */
  networkDiscovery: DiscoveryResponse | null;

  /** Tailscale cache info */
  tailscaleCacheInfo: { cache_hit: boolean; cached_at: string | null } | null;

  /** Whether any discovery is currently running */
  isDiscovering: boolean;

  /** Start network discovery */
  startNetworkDiscovery: (keyId?: string) => Promise<void>;

  /** Refresh Tailscale devices */
  refreshTailscale: (testSSH?: boolean) => Promise<void>;

  /** Start discovery from all enabled sources */
  discoverAll: (keyId?: string) => Promise<void>;

  /** Refresh network settings */
  refreshNetworkSettings: () => Promise<void>;
}

/**
 * Hook for unified device discovery across network and Tailscale sources.
 */
export function useUnifiedDiscovery(
  options: UseUnifiedDiscoveryOptions = {}
): UseUnifiedDiscoveryResult {
  const { selectedKeyId, autoLoadTailscale = true } = options;

  // Network state
  const [networkSettings, setNetworkSettings] = useState<DiscoverySettings | null>(null);
  const [networkSettingsLoading, setNetworkSettingsLoading] = useState(true);
  const [networkSettingsError, setNetworkSettingsError] = useState<string | null>(null);
  const [networkDiscovery, setNetworkDiscovery] = useState<DiscoveryResponse | null>(null);
  const [networkDevices, setNetworkDevices] = useState<UnifiedDevice[]>([]);
  const [isNetworkScanning, setIsNetworkScanning] = useState(false);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | undefined>(() => {
    const storedId = localStorage.getItem(DISCOVERY_ID_STORAGE_KEY);
    return storedId ? parseInt(storedId, 10) : undefined;
  });

  // Tailscale state
  const [tailscaleConfigured, setTailscaleConfigured] = useState<boolean>(false);
  const [tailscaleDevices, setTailscaleDevices] = useState<UnifiedDevice[]>([]);
  const [tailscaleLoading, setTailscaleLoading] = useState(false);
  const [tailscaleError, setTailscaleError] = useState<string | null>(null);
  const [tailscaleCacheInfo, setTailscaleCacheInfo] = useState<{
    cache_hit: boolean;
    cached_at: string | null;
  } | null>(null);
  const [tailscaleLastUpdated, setTailscaleLastUpdated] = useState<string | null>(null);

  // Initial load tracking
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const tailscaleLoadedRef = useRef(false);

  // Check configuration status on mount
  useEffect(() => {
    async function checkConfiguration() {
      try {
        const [, tailscaleStatus] = await Promise.all([
          getConnectivityStatus(),
          getTailscaleStatus(),
        ]);
        setTailscaleConfigured(tailscaleStatus.configured);
      } catch {
        setTailscaleConfigured(false);
      } finally {
        setInitialLoadComplete(true);
      }
    }
    checkConfiguration();
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

      if (data.status === 'completed' && data.devices) {
        setNetworkDevices(data.devices.map(networkDeviceToUnified));
      }
    } catch (err) {
      console.error('Failed to fetch discovery:', err);
    }
  }, []);

  // Poll while network discovery is running
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

  // Fetch Tailscale devices
  const refreshTailscale = useCallback(
    async (testSSH = true) => {
      if (!tailscaleConfigured) return;

      setTailscaleLoading(true);
      setTailscaleError(null);

      try {
        const params: { refresh?: boolean; test_ssh?: boolean } = {
          refresh: true,
        };
        if (testSSH) params.test_ssh = true;

        const response = await getTailscaleDevices(params);
        setTailscaleDevices(response.devices.map(tailscaleDeviceToUnified));
        setTailscaleCacheInfo({
          cache_hit: response.cache_hit,
          cached_at: response.cached_at,
        });
        setTailscaleLastUpdated(new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch devices';
        setTailscaleError(message);
        setTailscaleDevices([]);
      } finally {
        setTailscaleLoading(false);
      }
    },
    [tailscaleConfigured]
  );

  // Auto-load Tailscale devices on mount if configured
  useEffect(() => {
    if (
      autoLoadTailscale &&
      tailscaleConfigured &&
      initialLoadComplete &&
      !tailscaleLoadedRef.current
    ) {
      tailscaleLoadedRef.current = true;
      // Use cached data initially (no refresh)
      setTailscaleLoading(true);
      getTailscaleDevices({ test_ssh: true })
        .then((response) => {
          setTailscaleDevices(response.devices.map(tailscaleDeviceToUnified));
          setTailscaleCacheInfo({
            cache_hit: response.cache_hit,
            cached_at: response.cached_at,
          });
          setTailscaleLastUpdated(new Date().toISOString());
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to fetch devices';
          setTailscaleError(message);
        })
        .finally(() => {
          setTailscaleLoading(false);
        });
    }
  }, [autoLoadTailscale, tailscaleConfigured, initialLoadComplete]);

  // Start network discovery
  const startNetworkDiscovery = useCallback(
    async (keyId?: string) => {
      setIsNetworkScanning(true);
      try {
        const request = (keyId || selectedKeyId) ? { key_id: keyId || selectedKeyId } : undefined;
        const result = await startDiscovery(request);
        setNetworkDiscovery(result);
        setActiveDiscoveryId(result.discovery_id);
        localStorage.setItem(DISCOVERY_ID_STORAGE_KEY, result.discovery_id.toString());
      } catch (err) {
        console.error('Failed to start discovery:', err);
      } finally {
        setIsNetworkScanning(false);
      }
    },
    [selectedKeyId]
  );

  // Refresh network settings
  const refreshNetworkSettings = useCallback(async () => {
    try {
      const data = await getDiscoverySettings();
      setNetworkSettings(data);
    } catch (err) {
      console.error('Failed to refresh settings:', err);
    }
  }, []);

  // Discover from all sources
  const discoverAll = useCallback(
    async (keyId?: string) => {
      const promises: Promise<void>[] = [];

      // Start network discovery
      promises.push(startNetworkDiscovery(keyId));

      // Refresh Tailscale if configured
      if (tailscaleConfigured) {
        promises.push(refreshTailscale(true));
      }

      await Promise.all(promises);
    },
    [startNetworkDiscovery, refreshTailscale, tailscaleConfigured]
  );

  // Merge devices from both sources
  const mergedDevices = mergeDevices(networkDevices, tailscaleDevices);

  // Calculate progress
  const isNetworkRunning =
    networkDiscovery?.status === 'running' || networkDiscovery?.status === 'pending';

  const progress: CombinedProgress = {
    networkProgress: isNetworkRunning ? (networkDiscovery?.progress?.percent ?? 0) : null,
    networkScanned: networkDiscovery?.progress?.scanned ?? 0,
    networkTotal: networkDiscovery?.progress?.total ?? 0,
    tailscaleComplete: !tailscaleLoading && tailscaleDevices.length > 0,
    tailscaleLoading,
    overallPercent: calculateOverallProgress(
      isNetworkRunning ? (networkDiscovery?.progress?.percent ?? 0) : 100,
      !tailscaleLoading,
      tailscaleConfigured
    ),
  };

  // Build status objects
  const networkStatus: SourceStatus = {
    enabled: true,
    configured: !networkSettingsError,
    loading: networkSettingsLoading || isNetworkScanning || isNetworkRunning,
    error: networkSettingsError || networkDiscovery?.error || null,
    lastUpdated: networkDiscovery?.completed_at || null,
  };

  const tailscaleStatusObj: SourceStatus = {
    enabled: tailscaleConfigured,
    configured: tailscaleConfigured,
    loading: tailscaleLoading,
    error: tailscaleError,
    lastUpdated: tailscaleLastUpdated,
  };

  return {
    devices: mergedDevices,
    networkDevices,
    tailscaleDevices,
    networkStatus,
    tailscaleStatus: tailscaleStatusObj,
    networkSettings,
    progress,
    networkDiscovery,
    tailscaleCacheInfo,
    isDiscovering: isNetworkScanning || isNetworkRunning || tailscaleLoading,
    startNetworkDiscovery,
    refreshTailscale,
    discoverAll,
    refreshNetworkSettings,
  };
}

/**
 * Calculate overall progress percentage.
 */
function calculateOverallProgress(
  networkPercent: number,
  tailscaleComplete: boolean,
  tailscaleEnabled: boolean
): number {
  if (!tailscaleEnabled) {
    return networkPercent;
  }

  // Weight: 70% network, 30% Tailscale (network takes longer)
  const tailscalePercent = tailscaleComplete ? 100 : 0;
  return Math.round(networkPercent * 0.7 + tailscalePercent * 0.3);
}
