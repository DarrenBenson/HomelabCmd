import { useState, useEffect, useCallback } from 'react';
import { Boxes, RefreshCw, ChevronRight } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import { getServerServices, restartService } from '../../api/services';
import { getActions } from '../../api/actions';
import type { WidgetProps } from './types';
import type { ExpectedService } from '../../types/service';

interface ServicesWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
  /** Whether the server is inactive (agent removed) */
  isInactive?: boolean;
  /** Agent mode - when 'readonly', actions are disabled */
  agentMode?: 'readonly' | 'readwrite' | null;
}

const POLLING_INTERVAL = 30000; // 30 seconds

/**
 * Get status colour based on service state.
 */
function getStatusColour(status: string): { bg: string; text: string } {
  switch (status) {
    case 'running':
      return { bg: 'bg-status-success/20', text: 'text-status-success' };
    case 'stopped':
    case 'dead':
    case 'failed':
      return { bg: 'bg-status-error/20', text: 'text-status-error' };
    default:
      return { bg: 'bg-text-muted/20', text: 'text-text-muted' };
  }
}

/**
 * Services Widget
 *
 * Compact view of systemd services with status indicators and restart actions.
 * Integrates with existing service monitoring and remediation APIs.
 */
export function ServicesWidget({
  machine,
  isEditMode = false,
  onRemove,
  isInactive = false,
  agentMode,
}: ServicesWidgetProps) {
  const [services, setServices] = useState<ExpectedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restartingServices, setRestartingServices] = useState<Set<string>>(new Set());
  const [queuedServices, setQueuedServices] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const isReadonly = agentMode === 'readonly';
  const displayedServices = showAll ? services : services.slice(0, 5);

  // Fetch services data
  const fetchServices = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const [servicesData, actionsData] = await Promise.all([
        getServerServices(machine.id),
        getActions({ server_id: machine.id }),
      ]);
      setServices(servicesData.services);

      // Track queued restart actions
      const queued = new Set<string>();
      for (const action of actionsData.actions) {
        if (
          action.action_type === 'restart_service' &&
          action.service_name &&
          ['pending', 'approved', 'executing'].includes(action.status)
        ) {
          queued.add(action.service_name);
        }
      }
      setQueuedServices(queued);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, [machine.id]);

  // Initial fetch and polling
  useEffect(() => {
    fetchServices(true);

    const interval = setInterval(() => {
      fetchServices(false);
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchServices]);

  // Handle restart action
  const handleRestart = useCallback(async (serviceName: string) => {
    setRestartingServices((prev) => new Set(prev).add(serviceName));

    try {
      await restartService(machine.id, serviceName);
      setQueuedServices((prev) => new Set(prev).add(serviceName));
    } catch {
      // Silent fail - user will see status update on next poll
    } finally {
      setRestartingServices((prev) => {
        const next = new Set(prev);
        next.delete(serviceName);
        return next;
      });
    }
  }, [machine.id]);

  // Count services by status
  const runningCount = services.filter(s => s.current_status?.status === 'running').length;
  const stoppedCount = services.filter(s => s.current_status?.status !== 'running').length;

  return (
    <WidgetContainer
      title="Services"
      icon={<Boxes className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {/* Summary header */}
        <div className="mb-2 flex items-center gap-3 text-xs">
          <span className="text-status-success" data-testid="services-running-count">
            {runningCount} running
          </span>
          {stoppedCount > 0 && (
            <span className="text-status-error" data-testid="services-stopped-count">
              {stoppedCount} stopped
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && services.length === 0 && (
          <div className="flex flex-1 items-center justify-center" data-testid="services-loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
          </div>
        )}

        {/* Error state */}
        {error && services.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-status-error" data-testid="services-error">
            {error}
          </div>
        )}

        {/* Inactive state */}
        {isInactive && (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted" data-testid="services-inactive">
            Agent Inactive
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !isInactive && services.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-text-secondary" data-testid="services-empty">
            No services configured
          </div>
        )}

        {/* Services list */}
        {!isInactive && services.length > 0 && (
          <div className="flex-1 space-y-1 overflow-auto" data-testid="services-list">
            {displayedServices.map((service) => {
              const status = service.current_status?.status ?? 'unknown';
              const { bg } = getStatusColour(status);
              const isRestarting = restartingServices.has(service.service_name);
              const isQueued = queuedServices.has(service.service_name);

              return (
                <div
                  key={service.service_name}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-bg-tertiary"
                  data-testid={`service-${service.service_name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn('h-2 w-2 flex-shrink-0 rounded-full', bg)}
                      data-testid={`service-status-${service.service_name}`}
                    />
                    <span className="truncate text-sm text-text-primary">
                      {service.display_name || service.service_name}
                    </span>
                  </div>

                  {/* Actions */}
                  {!isReadonly && status !== 'running' && (
                    <button
                      onClick={() => handleRestart(service.service_name)}
                      disabled={isRestarting || isQueued}
                      className={cn(
                        'ml-2 flex-shrink-0 rounded p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
                        (isRestarting || isQueued) && 'cursor-not-allowed opacity-50'
                      )}
                      title={isQueued ? 'Restart queued' : 'Restart service'}
                      data-testid={`restart-${service.service_name}`}
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isRestarting && 'animate-spin')} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Show more/less toggle */}
        {services.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 flex items-center justify-center gap-1 text-xs text-text-secondary hover:text-text-primary"
            data-testid="services-toggle"
          >
            <span>{showAll ? 'Show less' : `Show all (${services.length})`}</span>
            <ChevronRight className={cn('h-3 w-3 transition-transform', showAll && 'rotate-90')} />
          </button>
        )}
      </div>
    </WidgetContainer>
  );
}
