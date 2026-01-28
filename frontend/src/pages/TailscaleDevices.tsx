/**
 * Tailscale Device Discovery page.
 *
 * Part of EP0008: Tailscale Integration (US0077, US0078).
 *
 * Displays all devices in the user's Tailscale tailnet with:
 * - Filter by online status
 * - Filter by OS type
 * - Cache indicator with refresh button
 * - Import modal for registering devices as servers (US0078)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Globe,
  RefreshCw,
  AlertCircle,
  Monitor,
  Server,
  Smartphone,
  Download,
  Clock,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { getTailscaleDevices, getTailscaleStatus } from '../api/tailscale';
import { ImportDeviceModal } from '../components/ImportDeviceModal';
import type {
  TailscaleDevice,
  TailscaleStatusResponse,
} from '../types/tailscale';

type OnlineFilter = 'all' | 'online' | 'offline';
type OsFilter = 'all' | 'linux' | 'windows' | 'macos' | 'ios' | 'android';

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
 * Format relative time string.
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface DeviceCardProps {
  device: TailscaleDevice;
  onImport: (device: TailscaleDevice) => void;
}

function DeviceCard({ device, onImport }: DeviceCardProps) {
  return (
    <div
      className="rounded-lg border border-border-default bg-bg-secondary p-4"
      data-testid={`device-card-${device.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <div
            className={`mt-1 flex h-3 w-3 rounded-full ${
              device.online ? 'bg-status-success' : 'bg-text-tertiary'
            }`}
            title={device.online ? 'Online' : 'Offline'}
          />

          <div>
            {/* Hostname */}
            <h3 className="font-medium text-text-primary">{device.hostname}</h3>

            {/* IP and OS */}
            <div className="mt-1 flex items-center gap-3 text-sm text-text-secondary">
              <span className="font-mono">{device.tailscale_ip}</span>
              <span className="flex items-center gap-1">
                {getOsIcon(device.os)}
                {device.os}
              </span>
              <span
                className={`${device.online ? 'text-status-success' : 'text-text-tertiary'}`}
              >
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Last seen */}
            <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
              <Clock className="h-3 w-3" />
              Last seen: {formatRelativeTime(device.last_seen)}
            </div>
          </div>
        </div>

        {/* Import button or View Machine link */}
        {device.already_imported ? (
          <Link
            to={`/servers/${device.hostname.split('.')[0].toLowerCase()}`}
            className="flex items-center gap-2 rounded-md bg-bg-tertiary px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            title="View imported machine"
          >
            <ExternalLink className="h-4 w-4" />
            View Machine
          </Link>
        ) : (
          <button
            onClick={() => onImport(device)}
            className="flex items-center gap-2 rounded-md bg-status-info px-3 py-1.5 text-sm font-medium text-white hover:bg-status-info/80"
            title="Import as server"
          >
            <Download className="h-4 w-4" />
            Import
          </button>
        )}
      </div>
    </div>
  );
}

export function TailscaleDevices() {
  const navigate = useNavigate();

  // Status state
  const [status, setStatus] = useState<TailscaleStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Device list state
  const [devices, setDevices] = useState<TailscaleDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    cache_hit: boolean;
    cached_at: string | null;
  } | null>(null);

  // Filter state
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all');
  const [osFilter, setOsFilter] = useState<OsFilter>('all');

  // Modal state (US0078)
  const [selectedDevice, setSelectedDevice] = useState<TailscaleDevice | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Check if Tailscale is configured
  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await getTailscaleStatus();
        setStatus(data);
      } catch {
        setStatus({ configured: false });
      } finally {
        setStatusLoading(false);
      }
    }
    checkStatus();
  }, []);

  // Fetch devices
  const fetchDevices = useCallback(
    async (refresh = false) => {
      if (!status?.configured) return;

      setLoading(true);
      setError(null);

      try {
        const params: { online?: boolean; os?: string; refresh?: boolean } = {};

        if (onlineFilter !== 'all') {
          params.online = onlineFilter === 'online';
        }
        if (osFilter !== 'all') {
          params.os = osFilter;
        }
        if (refresh) {
          params.refresh = true;
        }

        const response = await getTailscaleDevices(params);
        setDevices(response.devices);
        setCacheInfo({
          cache_hit: response.cache_hit,
          cached_at: response.cached_at,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch devices';
        setError(message);
        setDevices([]);
      } finally {
        setLoading(false);
      }
    },
    [status?.configured, onlineFilter, osFilter]
  );

  // Fetch devices when status or filters change
  useEffect(() => {
    if (status?.configured) {
      fetchDevices();
    }
  }, [status?.configured, onlineFilter, osFilter, fetchDevices]);

  // Handle import - open modal (US0078)
  const handleImport = useCallback((device: TailscaleDevice) => {
    setSelectedDevice(device);
    setShowImportModal(true);
  }, []);

  // Handle import success - close modal and refresh device list
  const handleImportSuccess = useCallback(() => {
    setShowImportModal(false);
    setSelectedDevice(null);
    // Refresh device list to update already_imported status
    fetchDevices(true);
  }, [fetchDevices]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowImportModal(false);
    setSelectedDevice(null);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchDevices(true);
  }, [fetchDevices]);

  // Loading state for initial status check
  if (statusLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
        </div>
      </div>
    );
  }

  // No token configured
  if (!status?.configured) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <Globe className="h-6 w-6 text-status-info" />
          <h1 className="text-2xl font-bold text-text-primary">Tailscale Device Discovery</h1>
        </div>

        <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-8 text-center">
          <Globe className="mx-auto mb-4 h-12 w-12 text-text-tertiary" />
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Configure Tailscale API Token
          </h2>
          <p className="mb-4 text-text-secondary">
            Configure your Tailscale API token in Settings to discover devices on your tailnet.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            data-testid="back-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Globe className="h-6 w-6 text-status-info" />
          <h1 className="text-2xl font-bold text-text-primary">Tailscale Device Discovery</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Cache indicator */}
          {cacheInfo && (
            <span className="text-sm text-text-tertiary">
              {cacheInfo.cache_hit && cacheInfo.cached_at
                ? `Cached ${formatRelativeTime(cacheInfo.cached_at)}`
                : 'Fresh data'}
            </span>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="refresh-button"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="online-filter" className="text-sm text-text-secondary">
            Status:
          </label>
          <select
            id="online-filter"
            value={onlineFilter}
            onChange={(e) => setOnlineFilter(e.target.value as OnlineFilter)}
            className="rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="os-filter" className="text-sm text-text-secondary">
            OS:
          </label>
          <select
            id="os-filter"
            value={osFilter}
            onChange={(e) => setOsFilter(e.target.value as OsFilter)}
            className="rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="all">Any OS</option>
            <option value="linux">Linux</option>
            <option value="windows">Windows</option>
            <option value="macos">macOS</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
        </div>

        {/* Device count */}
        <span className="text-sm text-text-secondary">
          Found {devices.length} device{devices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-4 text-status-error">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className="ml-auto rounded-md bg-status-error px-3 py-1 text-sm font-medium text-white hover:bg-status-error/80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && devices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
          <p className="text-text-secondary">Discovering devices...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && devices.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-8 text-center">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-text-tertiary" />
          <h2 className="mb-2 text-lg font-semibold text-text-primary">No devices found</h2>
          <p className="text-text-secondary">
            {onlineFilter !== 'all' || osFilter !== 'all'
              ? 'No devices match your filters. Try adjusting the filters.'
              : 'No devices found in your tailnet.'}
          </p>
        </div>
      )}

      {/* Device list */}
      {devices.length > 0 && (
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} onImport={handleImport} />
          ))}
        </div>
      )}

      {/* Import modal (US0078) */}
      {showImportModal && selectedDevice && (
        <ImportDeviceModal
          device={selectedDevice}
          onClose={handleModalClose}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
