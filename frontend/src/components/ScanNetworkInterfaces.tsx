/**
 * ScanNetworkInterfaces - Displays network interface information.
 *
 * Features:
 * - Shows interface name, state, and addresses
 * - Collapsible section
 *
 * US0039: Scan Results Display
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NetworkInterface } from '../types/scan';
import { cn } from '../lib/utils';

interface ScanNetworkInterfacesProps {
  /** Array of network interfaces */
  interfaces: NetworkInterface[];
  /** Whether section starts collapsed */
  defaultCollapsed?: boolean;
}

function getStateColour(state: string): string {
  switch (state.toLowerCase()) {
    case 'up':
      return 'text-green-400';
    case 'down':
      return 'text-red-400';
    default:
      return 'text-text-tertiary';
  }
}

export function ScanNetworkInterfaces({ interfaces, defaultCollapsed = true }: ScanNetworkInterfacesProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="rounded-lg border border-tertiary bg-secondary">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-tertiary/50"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
          <h3 className="text-sm font-medium text-text-secondary">
            Network Interfaces ({interfaces.length})
          </h3>
        </div>
      </button>

      {!isCollapsed && (
        <div className="border-t border-tertiary p-4">
          {interfaces.length === 0 ? (
            <p className="text-text-tertiary">No network interface information available</p>
          ) : (
            <div className="space-y-3">
              {interfaces.map((iface) => (
                <div key={iface.name} className="rounded border border-tertiary/50 bg-primary/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-text-primary">{iface.name}</span>
                    <span className={cn('text-sm', getStateColour(iface.state))}>
                      {iface.state.toUpperCase()}
                    </span>
                  </div>
                  {iface.addresses.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {iface.addresses.map((addr, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-text-tertiary">{addr.type}:</span>
                          <span className="font-mono text-text-secondary">{addr.address}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {iface.addresses.length === 0 && (
                    <p className="mt-1 text-sm text-text-tertiary">No addresses assigned</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
