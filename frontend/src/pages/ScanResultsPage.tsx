/**
 * ScanResultsPage - Main page for viewing scan results.
 *
 * Features:
 * - Fetches scan by ID from URL params
 * - Polls while scan is pending/running
 * - Displays results when completed
 * - Handles error and not found states
 *
 * US0039: Scan Results Display
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, AlertCircle, Info, Zap, ScanLine } from 'lucide-react';
import { getScan } from '../api/scans';
import { ApiError } from '../api/client';
import type { ScanStatusResponse } from '../types/scan';
import { ScanSystemInfo } from '../components/ScanSystemInfo';
import { ScanDiskUsage } from '../components/ScanDiskUsage';
import { ScanMemoryUsage } from '../components/ScanMemoryUsage';
import { ScanProcessList } from '../components/ScanProcessList';
import { ScanNetworkInterfaces } from '../components/ScanNetworkInterfaces';
import { ScanPackageList } from '../components/ScanPackageList';

const POLL_INTERVAL_MS = 2000;

export function ScanResultsPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();

  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchScan = useCallback(async () => {
    if (!scanId) return;

    const id = parseInt(scanId, 10);
    if (isNaN(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const data = await getScan(id);
      setScan(data);
      setError(null);
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load scan');
      }
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  // Initial fetch
  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  // Poll while pending or running
  useEffect(() => {
    if (!scan || scan.status === 'completed' || scan.status === 'failed') {
      return;
    }

    const interval = setInterval(fetchScan, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scan, fetchScan]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="ml-3 text-text-secondary">Loading scan...</span>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <div className="min-h-screen bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-tertiary bg-secondary p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-4 text-lg font-medium text-text-primary">Scan Not Found</h2>
            <p className="mt-2 text-text-tertiary">
              The scan you're looking for doesn't exist or has been deleted.
            </p>
            <Link
              to="/scans"
              className="mt-4 inline-flex items-center gap-2 text-accent hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Scans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !scan) {
    return (
      <div className="min-h-screen bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-red-400/50 bg-red-400/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
              <div>
                <p className="font-medium text-red-400">Error loading scan</p>
                <p className="text-sm text-text-secondary">{error || 'Unknown error'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center gap-2 text-accent hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Pending/Running state - show progress
  if (scan.status === 'pending' || scan.status === 'running') {
    return (
      <div className="min-h-screen bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6">
            <Link
              to="/scans"
              className="mb-4 inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Scans
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">Scan: {scan.hostname}</h1>
            <p className="text-text-secondary">
              {scan.scan_type === 'full' ? 'Full Scan' : 'Quick Scan'} - In Progress
            </p>
          </header>

          <div className="rounded-lg border border-tertiary bg-secondary p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-text-secondary">Progress</span>
              <span className="font-mono text-text-primary">{scan.progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-tertiary">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${scan.progress}%` }}
              />
            </div>
            {scan.current_step && (
              <p className="mt-3 text-sm text-text-tertiary">{scan.current_step}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (scan.status === 'failed') {
    return (
      <div className="min-h-screen bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6">
            <Link
              to="/scans"
              className="mb-4 inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Scans
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">Scan: {scan.hostname}</h1>
            <p className="text-text-secondary">
              {scan.scan_type === 'full' ? 'Full Scan' : 'Quick Scan'} - Failed
            </p>
          </header>

          <div className="rounded-lg border border-red-400/50 bg-red-400/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
              <div>
                <p className="font-medium text-red-400">Scan Failed</p>
                <p className="text-sm text-text-secondary">{scan.error || 'Unknown error'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed state - show results
  const { results } = scan;
  const hasPartialErrors = results?.errors && results.errors.length > 0;
  const isFullScan = scan.scan_type === 'full';

  return (
    <div className="min-h-screen bg-primary p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link
            to="/scans"
            className="mb-4 inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scans
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">Scan: {scan.hostname}</h1>
                {isFullScan ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-status-info/20 px-3 py-1 text-sm font-medium text-status-info"
                    data-testid="scan-type-badge"
                  >
                    <ScanLine className="h-4 w-4" />
                    Full Scan
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-status-warning/20 px-3 py-1 text-sm font-medium text-status-warning"
                    data-testid="scan-type-badge"
                  >
                    <Zap className="h-4 w-4" />
                    Quick Scan
                  </span>
                )}
              </div>
              <p className="mt-1 text-text-secondary">Completed</p>
            </div>
            <div className="text-right text-sm text-text-tertiary">
              <p>Started: {formatTimestamp(scan.started_at)}</p>
              <p>Completed: {formatTimestamp(scan.completed_at)}</p>
            </div>
          </div>
        </header>

        {/* Partial errors warning */}
        {hasPartialErrors && (
          <div className="mb-6 rounded-lg border border-amber-400/50 bg-amber-400/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-400">Some data unavailable</p>
                <ul className="mt-1 text-sm text-text-secondary">
                  {results?.errors?.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Quick scan info banner */}
        {!isFullScan && (
          <div
            className="mb-6 rounded-lg border border-status-info/30 bg-status-info/10 p-4"
            data-testid="quick-scan-info"
          >
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 flex-shrink-0 text-status-info" />
              <div>
                <p className="font-medium text-status-info">Quick Scan Results</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Quick scans show system overview: OS info, disk usage, and memory.
                  Run a <span className="font-medium">Full Scan</span> to also see running processes,
                  network interfaces, and installed packages.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results grid */}
        <div className="space-y-6">
          {/* System Info and Memory - side by side on larger screens */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ScanSystemInfo
              hostname={results?.hostname ?? null}
              os={results?.os ?? null}
              uptimeSeconds={results?.uptime_seconds ?? null}
            />
            <ScanMemoryUsage memory={results?.memory ?? null} />
          </div>

          {/* Disk Usage */}
          <ScanDiskUsage disks={results?.disk ?? []} />

          {/* Full scan sections */}
          {isFullScan ? (
            <>
              <ScanProcessList processes={results?.processes ?? []} />
              <ScanNetworkInterfaces interfaces={results?.network_interfaces ?? []} />
              <ScanPackageList packages={results?.packages ?? null} />
            </>
          ) : (
            /* Quick scan placeholders */
            <div className="space-y-4" data-testid="quick-scan-placeholders">
              <div className="rounded-lg border border-border-default bg-bg-secondary p-6 opacity-60">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-text-tertiary">Running Processes</h3>
                  <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-1 rounded">Full Scan Only</span>
                </div>
                <p className="mt-2 text-sm text-text-tertiary">
                  Process list with CPU and memory usage is available with a Full Scan.
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-secondary p-6 opacity-60">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-text-tertiary">Network Interfaces</h3>
                  <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-1 rounded">Full Scan Only</span>
                </div>
                <p className="mt-2 text-sm text-text-tertiary">
                  Network interface details and IP addresses are available with a Full Scan.
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-secondary p-6 opacity-60">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-text-tertiary">Installed Packages</h3>
                  <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-1 rounded">Full Scan Only</span>
                </div>
                <p className="mt-2 text-sm text-text-tertiary">
                  List of installed packages is available with a Full Scan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
