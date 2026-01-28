/**
 * Recent Scans component - displays the last 5 scans.
 *
 * US0042: Scan Dashboard Integration (AC4)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Loader2, History } from 'lucide-react';
import { getScans } from '../api/scans';
import type { ScanListItem } from '../types/scan';

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function ScanStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-status-success" data-testid="scan-status-completed" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-status-error" data-testid="scan-status-failed" />;
    case 'running':
    case 'pending':
      return <Loader2 className="w-4 h-4 text-status-info animate-spin" data-testid="scan-status-running" />;
    default:
      return <Clock className="w-4 h-4 text-text-tertiary" data-testid="scan-status-unknown" />;
  }
}

export function RecentScans() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchRecentScans() {
      try {
        const response = await getScans({ limit: 5 });
        if (!ignore) {
          setScans(response.scans);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load recent scans');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchRecentScans();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section
      className="rounded-lg border border-border-default bg-bg-secondary p-6"
      data-testid="recent-scans"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-text-tertiary" />
          <h2 className="text-lg font-medium text-text-primary">Recent Scans</h2>
        </div>
        <Link
          to="/scans/history"
          className="text-sm text-status-info hover:underline"
        >
          View All
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-status-info animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && scans.length === 0 && (
        <div className="text-center py-8" data-testid="recent-scans-empty">
          <p className="text-sm text-text-tertiary">
            No scans yet. Run a scan to see results here.
          </p>
        </div>
      )}

      {!loading && !error && scans.length > 0 && (
        <ul className="space-y-2">
          {scans.map((scan) => (
            <li key={scan.scan_id}>
              <Link
                to={`/scans/${scan.scan_id}`}
                className="flex items-center justify-between p-3 rounded-md hover:bg-bg-tertiary transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ScanStatusIcon status={scan.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-status-info">
                      {scan.results?.hostname || scan.hostname}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {scan.results?.hostname && scan.results.hostname !== scan.hostname
                        ? `${scan.hostname} · `
                        : ''}
                      {scan.scan_type === 'full' ? 'Full Scan' : 'Quick Scan'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-tertiary whitespace-nowrap ml-2">
                  {formatTimeAgo(scan.started_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
