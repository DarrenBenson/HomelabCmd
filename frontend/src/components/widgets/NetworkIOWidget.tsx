import { useState, useMemo } from 'react';
import { Network, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { formatBytes } from '../../lib/formatters';
import { cn } from '../../lib/utils';
import type { WidgetProps, NetworkInterfaceMetric } from './types';

interface NetworkIOWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
}

/**
 * Sort key for interface list
 */
type SortKey = 'name' | 'rx_bytes' | 'tx_bytes';
type SortDirection = 'asc' | 'desc';

/**
 * Column header component with sort indicator (similar to DiskWidget).
 */
function SortHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors',
        align === 'right' && 'ml-auto'
      )}
      data-testid={`sort-${sortKey}`}
    >
      {label}
      {isActive && (
        <span className="text-status-info">
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );
}

/**
 * Interface row component with expandable details (AC4).
 */
function InterfaceRow({
  iface,
  isExpanded,
  onToggle,
}: {
  iface: NetworkInterfaceMetric;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isDown = !iface.is_up;

  return (
    <div
      className={cn(
        'border-b border-border-subtle last:border-b-0',
        isDown && 'bg-status-warning/5'
      )}
      data-testid={`interface-${iface.name}`}
    >
      {/* Main row - clickable to expand (AC4) */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-2 px-1 hover:bg-bg-tertiary/50 transition-colors"
        aria-expanded={isExpanded}
        data-testid={`expand-${iface.name}`}
      >
        {/* Expand icon */}
        <span className="text-text-muted">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>

        {/* Interface name with status icon */}
        <div className="flex items-center gap-1.5 min-w-[80px]">
          {iface.is_up ? (
            <Wifi className="h-3 w-3 text-status-success" />
          ) : (
            <WifiOff className="h-3 w-3 text-status-warning" />
          )}
          <span
            className={cn(
              'font-mono text-xs',
              isDown ? 'text-text-muted' : 'text-text-primary'
            )}
          >
            {iface.name}
          </span>
        </div>

        {/* RX */}
        <div className="flex items-center gap-1 flex-1 justify-end">
          <ArrowDown className="h-3 w-3 text-status-success" />
          <span className="font-mono text-xs text-text-secondary w-16 text-right">
            {formatBytes(iface.rx_bytes)}
          </span>
        </div>

        {/* TX */}
        <div className="flex items-center gap-1 flex-1 justify-end">
          <ArrowUp className="h-3 w-3 text-status-info" />
          <span className="font-mono text-xs text-text-secondary w-16 text-right">
            {formatBytes(iface.tx_bytes)}
          </span>
        </div>
      </button>

      {/* Expanded details (AC4) */}
      {isExpanded && (
        <div
          className="ml-5 pb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
          data-testid={`details-${iface.name}`}
        >
          <div className="text-text-tertiary">Status:</div>
          <div className={cn('font-medium', iface.is_up ? 'text-status-success' : 'text-status-warning')}>
            {iface.is_up ? 'Up' : 'Down'}
          </div>

          <div className="text-text-tertiary">RX Packets:</div>
          <div className="font-mono text-text-secondary">
            {iface.rx_packets.toLocaleString()}
          </div>

          <div className="text-text-tertiary">TX Packets:</div>
          <div className="font-mono text-text-secondary">
            {iface.tx_packets.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Network I/O Widget (US0171)
 *
 * Displays per-interface network traffic with:
 * - AC1: RX/TX bytes in human-readable format
 * - AC2: Historical chart (deferred - requires sparkline API)
 * - AC3: Interface list
 * - AC4: Per-interface expandable details
 */
export function NetworkIOWidget({
  machine,
  isEditMode = false,
  onRemove,
}: NetworkIOWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedInterfaces, setExpandedInterfaces] = useState<Set<string>>(new Set());

  const networkInterfaces = machine.network_interfaces;
  const hasInterfaces = networkInterfaces && networkInterfaces.length > 0;

  // Sort interfaces
  const sortedInterfaces = useMemo(() => {
    if (!networkInterfaces) return [];

    return [...networkInterfaces].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rx_bytes':
          comparison = a.rx_bytes - b.rx_bytes;
          break;
        case 'tx_bytes':
          comparison = a.tx_bytes - b.tx_bytes;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [networkInterfaces, sortKey, sortDirection]);

  // Handle sort column click
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  // Toggle expanded state for an interface
  const toggleExpanded = (name: string) => {
    setExpandedInterfaces(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Calculate aggregate stats for header
  const aggregateStats = useMemo(() => {
    if (!networkInterfaces || networkInterfaces.length === 0) return null;

    const totalRx = networkInterfaces.reduce((sum, iface) => sum + iface.rx_bytes, 0);
    const totalTx = networkInterfaces.reduce((sum, iface) => sum + iface.tx_bytes, 0);
    const upCount = networkInterfaces.filter(iface => iface.is_up).length;

    return { totalRx, totalTx, upCount, total: networkInterfaces.length };
  }, [networkInterfaces]);

  // Stale indicator for offline machines
  const isStale = machine.status === 'offline';

  // Fallback to aggregate metrics if no per-interface data
  const metrics = machine.latest_metrics;
  const rxBytes = metrics?.network_rx_bytes ?? null;
  const txBytes = metrics?.network_tx_bytes ?? null;

  return (
    <WidgetContainer
      title="Network I/O"
      icon={<Network className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {hasInterfaces ? (
          <>
            {/* Aggregate summary header */}
            {aggregateStats && (
              <div className="mb-2 flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs text-text-secondary">
                  {aggregateStats.upCount}/{aggregateStats.total} interface{aggregateStats.total !== 1 ? 's' : ''} up
                </span>
                <span className="text-xs text-text-secondary">
                  Total: ↓{formatBytes(aggregateStats.totalRx)} ↑{formatBytes(aggregateStats.totalTx)}
                </span>
              </div>
            )}

            {/* Column headers with sort */}
            <div className="flex items-center gap-2 py-1 px-1 border-b border-border-default mb-1">
              <span className="w-3" /> {/* Spacer for expand icon */}
              <SortHeader
                label="Interface"
                sortKey="name"
                currentKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <div className="flex-1" />
              <SortHeader
                label="RX"
                sortKey="rx_bytes"
                currentKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
              />
              <SortHeader
                label="TX"
                sortKey="tx_bytes"
                currentKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
              />
            </div>

            {/* Scrollable interface list */}
            <div className="flex-1 overflow-y-auto" data-testid="interface-list">
              {sortedInterfaces.map(iface => (
                <InterfaceRow
                  key={iface.name}
                  iface={iface}
                  isExpanded={expandedInterfaces.has(iface.name)}
                  onToggle={() => toggleExpanded(iface.name)}
                />
              ))}
            </div>
          </>
        ) : (
          /* Fallback: show aggregate network metrics */
          <div className="flex flex-col justify-center h-full space-y-4">
            {rxBytes !== null || txBytes !== null ? (
              <>
                {/* Received (RX) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 text-status-success" />
                    <span className="text-sm text-text-secondary">Received</span>
                  </div>
                  <div className="font-mono text-lg font-medium text-text-primary" data-testid="network-rx">
                    {formatBytes(rxBytes)}
                  </div>
                </div>

                {/* Transmitted (TX) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-status-info" />
                    <span className="text-sm text-text-secondary">Transmitted</span>
                  </div>
                  <div className="font-mono text-lg font-medium text-text-primary" data-testid="network-tx">
                    {formatBytes(txBytes)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-text-muted" data-testid="no-data">
                No network data available
              </div>
            )}
          </div>
        )}

        {/* Stale indicator for offline machines */}
        {isStale && (
          <div className="mt-1 text-center text-xs text-status-warning" data-testid="stale-indicator">
            Last known value (offline)
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
