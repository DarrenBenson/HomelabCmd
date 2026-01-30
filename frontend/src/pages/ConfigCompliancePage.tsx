/**
 * Configuration Compliance Page
 *
 * Displays fleet-wide configuration compliance status with detailed
 * machine list, filtering, and navigation to individual server config diffs.
 *
 * Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { getComplianceSummary, checkCompliance } from '../api/config-check';
import type { ComplianceSummaryResponse, ComplianceMachineSummary } from '../types/config-check';
import { cn } from '../lib/utils';

type StatusFilter = 'all' | 'compliant' | 'non_compliant' | 'never_checked';

export function ConfigCompliancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ComplianceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingMachine, setCheckingMachine] = useState<string | null>(null);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch compliance summary
  const fetchSummary = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getComplianceSummary();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch compliance summary');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSummary(true);
  }, [fetchSummary]);

  // Handle Check All action
  const handleCheckAll = useCallback(async () => {
    if (!data || checkingAll) return;

    const machinesWithPacks = data.machines.filter(m => m.pack !== null);
    if (machinesWithPacks.length === 0) return;

    setCheckingAll(true);
    setCheckProgress({ current: 0, total: machinesWithPacks.length });

    try {
      for (let i = 0; i < machinesWithPacks.length; i++) {
        const machine = machinesWithPacks[i];
        if (machine.pack) {
          try {
            await checkCompliance(machine.id, { pack_name: machine.pack });
          } catch {
            // Continue with remaining machines
          }
          setCheckProgress({ current: i + 1, total: machinesWithPacks.length });
        }
      }
      await fetchSummary(false);
    } finally {
      setCheckingAll(false);
      setCheckProgress(null);
    }
  }, [data, checkingAll, fetchSummary]);

  // Handle single machine check
  const handleCheckMachine = useCallback(async (machine: ComplianceMachineSummary) => {
    if (!machine.pack || checkingMachine) return;

    setCheckingMachine(machine.id);
    try {
      await checkCompliance(machine.id, { pack_name: machine.pack });
      await fetchSummary(false);
    } catch {
      // Error handled silently
    } finally {
      setCheckingMachine(null);
    }
  }, [checkingMachine, fetchSummary]);

  // Navigate to machine's config diff view
  const handleMachineClick = useCallback((machineId: string) => {
    navigate(`/servers/${machineId}/config/diff`);
  }, [navigate]);

  // Filter machines based on status
  const filteredMachines = data?.machines.filter(m => {
    if (statusFilter === 'all') return true;
    return m.status === statusFilter;
  }) ?? [];

  // Status icon component
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-4 w-4 text-status-success" />;
      case 'non_compliant':
        return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      default:
        return <HelpCircle className="h-4 w-4 text-text-muted" />;
    }
  };

  // Format checked at time
  const formatCheckedAt = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="rounded p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-status-info" />
              <h1 className="text-xl font-semibold text-text-primary">
                Configuration Compliance
              </h1>
            </div>
          </div>

          <button
            onClick={handleCheckAll}
            disabled={checkingAll || !data?.machines.some(m => m.pack !== null)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
              'bg-status-info text-white hover:bg-status-info/90',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', checkingAll && 'animate-spin')} />
            {checkingAll ? 'Checking...' : 'Check All'}
          </button>
        </div>

        {/* Progress bar */}
        {checkProgress && (
          <div className="mb-6 rounded-lg border border-border-default bg-bg-secondary p-4">
            <div className="mb-2 flex justify-between text-sm text-text-secondary">
              <span>Checking compliance...</span>
              <span>{checkProgress.current}/{checkProgress.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full bg-status-info transition-all"
                style={{ width: `${(checkProgress.current / checkProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-6 text-center">
            <p className="text-status-error">{error}</p>
            <button
              onClick={() => fetchSummary(true)}
              className="mt-4 rounded px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-status-success" />
                  <div>
                    <div className="text-3xl font-bold text-status-success">
                      {data.summary.compliant}
                    </div>
                    <div className="text-sm text-text-secondary">Compliant</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-status-warning" />
                  <div>
                    <div className="text-3xl font-bold text-status-warning">
                      {data.summary.non_compliant}
                    </div>
                    <div className="text-sm text-text-secondary">Non-compliant</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-8 w-8 text-text-muted" />
                  <div>
                    <div className="text-3xl font-bold text-text-muted">
                      {data.summary.never_checked}
                    </div>
                    <div className="text-sm text-text-secondary">Never checked</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info banner when no packs assigned */}
            {!data.machines.some(m => m.pack !== null) && (
              <div className="mb-6 rounded-lg border border-status-info/30 bg-status-info/10 p-4">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-status-info flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-text-primary">No configuration packs assigned</p>
                    <p className="text-sm text-text-secondary mt-1">
                      To enable compliance checking, assign a configuration pack to each server.
                      Click on a server below, then use the "Assign a pack" link to configure it.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filter and machine list */}
            <div className="rounded-lg border border-border-default bg-bg-secondary">
              {/* Filter bar */}
              <div className="flex items-center gap-4 border-b border-border-default px-4 py-3">
                <Filter className="h-4 w-4 text-text-tertiary" />
                <div className="flex gap-2">
                  {(['all', 'compliant', 'non_compliant', 'never_checked'] as StatusFilter[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={cn(
                        'rounded-md px-3 py-1 text-sm',
                        statusFilter === filter
                          ? 'bg-status-info text-white'
                          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                      )}
                    >
                      {filter === 'all' && 'All'}
                      {filter === 'compliant' && 'Compliant'}
                      {filter === 'non_compliant' && 'Non-compliant'}
                      {filter === 'never_checked' && 'Never checked'}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-sm text-text-tertiary">
                  {filteredMachines.length} machines
                </span>
              </div>

              {/* Machine list */}
              {filteredMachines.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  No machines match the selected filter
                </div>
              ) : (
                <div className="divide-y divide-border-default">
                  {filteredMachines.map((machine) => (
                    <div
                      key={machine.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-bg-tertiary"
                    >
                      <StatusIcon status={machine.status} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text-primary truncate">
                          {machine.display_name}
                        </div>
                        <div className="text-sm text-text-tertiary">
                          {machine.pack ? (
                            `Pack: ${machine.pack}`
                          ) : (
                            <button
                              onClick={() => navigate(`/servers/${machine.id}`)}
                              className="text-status-info hover:underline"
                            >
                              Assign a pack
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {machine.status === 'non_compliant' && (
                          <span className="text-status-warning">
                            {machine.mismatch_count} {machine.mismatch_count === 1 ? 'mismatch' : 'mismatches'}
                          </span>
                        )}
                        <span className="text-text-tertiary">
                          {formatCheckedAt(machine.checked_at)}
                        </span>
                        {machine.pack && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckMachine(machine);
                            }}
                            disabled={checkingMachine === machine.id || checkingAll}
                            className="rounded p-1 text-text-tertiary hover:bg-bg-primary hover:text-text-primary disabled:opacity-50"
                            title="Check compliance"
                          >
                            <RefreshCw className={cn('h-4 w-4', checkingMachine === machine.id && 'animate-spin')} />
                          </button>
                        )}
                        <button
                          onClick={() => handleMachineClick(machine.id)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-text-secondary hover:bg-bg-primary hover:text-text-primary"
                        >
                          View
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
