/**
 * Unified Discovery Page.
 *
 * EP0016: Unified Discovery Experience (US0094)
 * EP0019: Single Pane of Glass - Merged network and Tailscale discovery
 *
 * Consolidates Network Discovery and Tailscale Discovery into a single page
 * with merged device list, intelligent deduplication, and unified controls.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Search,
  WifiOff,
} from 'lucide-react';
import { listSSHKeys } from '../api/scans';
import { useUnifiedDiscovery } from '../hooks/useUnifiedDiscovery';
import { UnifiedDeviceCard } from '../components/UnifiedDeviceCard';
import { DiscoveryFilters } from '../components/DiscoveryFilters';
import { UnifiedImportModal } from '../components/UnifiedImportModal';
import { DiscoverySettingsModal } from '../components/DiscoverySettingsModal';
import { DiscoverySourcePanel } from '../components/discovery/DiscoverySourcePanel';
import type { MergedDevice, UnifiedDevice, SourceFilter } from '../types/discovery';
import type { SSHKeyMetadata } from '../types/scan';

type StatusFilter = 'all' | 'available' | 'unavailable';
type OsFilter = 'all' | 'linux' | 'windows' | 'macos' | 'other';

export function DiscoveryPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [osFilter, setOsFilter] = useState<OsFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hideImported, setHideImported] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');

  // SSH keys state
  const [sshKeys, setSshKeys] = useState<SSHKeyMetadata[]>([]);
  const [sshKeysLoading, setSshKeysLoading] = useState(true);

  // Modal state
  const [selectedDevice, setSelectedDevice] = useState<MergedDevice | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Unified discovery hook
  const {
    devices,
    networkStatus,
    tailscaleStatus,
    networkSettings,
    progress,
    isDiscovering,
    discoverAll,
    refreshNetworkSettings,
  } = useUnifiedDiscovery({
    selectedKeyId,
    autoLoadTailscale: true,
  });

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

  // Handle device import
  function handleImport(device: UnifiedDevice | MergedDevice) {
    // All devices from useUnifiedDiscovery are MergedDevices
    setSelectedDevice(device as MergedDevice);
    setImportModalOpen(true);
  }

  // Handle import success
  function handleImportSuccess() {
    setImportModalOpen(false);
    setSelectedDevice(null);
    // Refresh all sources
    discoverAll(selectedKeyId || undefined);
  }

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    // Source filter
    if (sourceFilter === 'network' && device.mergedSource !== 'network') return false;
    if (sourceFilter === 'tailscale' && device.mergedSource !== 'tailscale') return false;
    if (sourceFilter === 'both' && device.mergedSource !== 'both') return false;

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

    // Hide imported filter
    if (hideImported && device.isMonitored) return false;

    return true;
  });

  // Compute counts
  const totalDevices = devices.length;
  const availableCount = devices.filter((d) => d.availability === 'available').length;
  const unavailableCount = devices.filter((d) => d.availability === 'unavailable').length;

  // Determine if we have any results to show
  const hasDevices = devices.length > 0;
  const hasDiscovered = networkStatus.lastUpdated || tailscaleStatus.lastUpdated;

  return (
    <div className="min-h-screen bg-bg-primary" data-testid="discovery-page">
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
                Find and import devices from your network and Tailscale
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Discovery Source Panel */}
        <DiscoverySourcePanel
          networkStatus={networkStatus}
          tailscaleStatus={tailscaleStatus}
          networkSettings={networkSettings}
          progress={progress}
          isDiscovering={isDiscovering}
          sshKeys={sshKeys}
          selectedKeyId={selectedKeyId}
          onKeyIdChange={setSelectedKeyId}
          onDiscoverAll={discoverAll}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />

        {/* Filters (only show when we have devices) */}
        {hasDevices && (
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
            showSourceFilter={true}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            hideImported={hideImported}
            onHideImportedChange={setHideImported}
            totalCount={totalDevices}
            filteredCount={filteredDevices.length}
            availableCount={availableCount}
            unavailableCount={unavailableCount}
          />
        )}

        {/* Device grid */}
        {filteredDevices.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDevices.map((device, index) => (
              <UnifiedDeviceCard
                key={device.id}
                device={device}
                onImport={handleImport}
                animationDelay={index * 50}
              />
            ))}
          </div>
        )}

        {/* Loading state (while discovering with no results yet) */}
        {isDiscovering && !hasDevices && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-status-info" data-testid="discovering-indicator" />
            <p className="mt-4 font-medium text-text-primary">Discovering devices...</p>
            <p className="text-sm text-text-tertiary">
              Scanning your network and Tailscale for available devices.
            </p>
          </div>
        )}

        {/* Empty state - no devices found after discovery */}
        {!isDiscovering && hasDiscovered && !hasDevices && (
          <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="no-devices-message">
            <WifiOff className="h-12 w-12 text-text-tertiary" />
            <p className="mt-4 font-medium text-text-primary">No devices found</p>
            <p className="text-sm text-text-tertiary">
              No devices with SSH (port 22) were detected.
            </p>
            <button
              onClick={() => discoverAll(selectedKeyId || undefined)}
              className="mt-4 flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90"
            >
              <Search className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Empty state - filters active but no matches */}
        {!isDiscovering && hasDevices && filteredDevices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-text-tertiary" />
            <p className="mt-4 font-medium text-text-primary">No matching devices</p>
            <p className="text-sm text-text-tertiary">
              Try adjusting your filters to see more devices.
            </p>
            <button
              onClick={() => {
                setStatusFilter('all');
                setOsFilter('all');
                setSourceFilter('all');
                setHideImported(false);
              }}
              className="mt-4 rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Initial state - no discovery run yet */}
        {!isDiscovering && !hasDiscovered && !hasDevices && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-text-tertiary" />
            <p className="mt-4 font-medium text-text-primary">Ready to discover</p>
            <p className="text-sm text-text-tertiary">
              Click "Discover All" to scan your network and Tailscale for devices.
            </p>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <DiscoverySettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={refreshNetworkSettings}
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
