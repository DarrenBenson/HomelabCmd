/**
 * Connectivity status bar component for the dashboard header.
 *
 * Part of EP0008: Tailscale Integration (US0080).
 *
 * Displays current connectivity mode in a compact badge format:
 * - Tailscale mode with tailnet info
 * - Direct SSH mode indicator
 * - Health status indicator
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wifi, Server, AlertCircle } from 'lucide-react';
import { getConnectivityStatusBar } from '../api/connectivity';
import type { ConnectivityStatusBarResponse } from '../types/connectivity';

export function ConnectivityStatusBar(): React.ReactElement | null {
  const [status, setStatus] = useState<ConnectivityStatusBarResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchStatus(): Promise<void> {
      try {
        const data = await getConnectivityStatusBar();
        setStatus(data);
        setError(false);
      } catch {
        setError(true);
      }
    }

    void fetchStatus();

    // Refresh every 60 seconds
    const interval = setInterval(() => void fetchStatus(), 60000);
    return () => clearInterval(interval);
  }, []);

  // Don't render anything while loading or on error
  if (!status) {
    if (error) {
      return (
        <Link
          to="/settings"
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/20 transition-colors"
          title="Connectivity status unavailable - click to configure"
          data-testid="connectivity-status-error"
        >
          <AlertCircle className="h-3 w-3" />
          <span>Connection</span>
        </Link>
      );
    }
    return null;
  }

  const isTailscale = status.mode === 'tailscale';
  const Icon = isTailscale ? Wifi : Server;

  // Determine styling based on health
  const healthClass = status.healthy
    ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/20'
    : 'bg-status-warning/10 text-status-warning border-status-warning/20 hover:bg-status-warning/20';

  return (
    <Link
      to="/settings"
      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors ${healthClass}`}
      title={`${status.display} - click to configure`}
      data-testid="connectivity-status-bar"
    >
      <Icon className="h-3 w-3" />
      <span>{status.display}</span>
    </Link>
  );
}
