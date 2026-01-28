import { RotateCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { ServiceStatusLED } from './ServiceStatusLED';
import type { ExpectedService, ServiceStatus } from '../types/service';

interface ServiceCardProps {
  service: ExpectedService;
  onRestart?: () => void;
  isRestarting?: boolean;
  isQueued?: boolean;
  /** When true, restart button is hidden (agent in readonly mode - BG0017) */
  isReadonly?: boolean;
}

/**
 * Card displaying an expected service with its status and resource usage.
 */
export function ServiceCard({ service, onRestart, isRestarting = false, isQueued = false, isReadonly = false }: ServiceCardProps) {
  const status: ServiceStatus = service.current_status?.status ?? 'unknown';
  const isRunning = status === 'running';
  const isStopped = status === 'stopped' || status === 'failed';
  const displayName = service.display_name || service.service_name;

  return (
    <div
      className={cn(
        'rounded-lg border border-border-default bg-bg-secondary p-4',
        isStopped && 'border-l-4 border-l-status-error',
        !service.enabled && 'opacity-50',
      )}
      data-testid="service-card"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ServiceStatusLED status={status} />
          <span className="font-semibold text-text-primary">{displayName}</span>
          <span
            className={cn(
              'rounded px-2 py-0.5 font-mono text-xs',
              service.is_critical
                ? 'bg-status-warning/20 text-status-warning'
                : 'bg-text-tertiary/20 text-text-secondary'
            )}
            data-testid={service.is_critical ? 'critical-badge' : 'standard-badge'}
          >
            {service.is_critical ? 'Core' : 'Standard'}
          </span>
        </div>

        {/* Restart button - only for stopped/failed services, hidden in readonly mode (BG0017) */}
        {isStopped && !isReadonly && (
          isQueued ? (
            <span
              className="flex items-center gap-1 rounded border border-status-info/50 bg-status-info/10 px-2 py-1 text-sm text-status-info"
              data-testid="queued-badge"
            >
              Queued
            </span>
          ) : (
            <button
              onClick={onRestart}
              disabled={isRestarting}
              className={cn(
                'flex items-center gap-1 rounded border border-border-default px-2 py-1 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors',
                isRestarting && 'opacity-50 cursor-wait'
              )}
              title="Queue service restart"
              data-testid="restart-button"
            >
              <RotateCw className={cn('h-3.5 w-3.5', isRestarting && 'animate-spin')} />
              {isRestarting ? 'Restarting...' : 'Restart'}
            </button>
          )
        )}
      </div>

      {/* Status and resource info */}
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-text-secondary">
        <span data-testid="service-status">
          Status:{' '}
          <span className="text-text-primary capitalize">
            {status}
            {status === 'unknown' && service.current_status?.status_reason && (
              <span className="text-text-muted"> ({service.current_status.status_reason})</span>
            )}
          </span>
        </span>

        {isRunning && service.current_status && (
          <>
            {service.current_status.pid !== null && (
              <span data-testid="service-pid">
                PID: <span className="text-text-primary">{service.current_status.pid}</span>
              </span>
            )}
            {service.current_status.memory_mb !== null && (
              <span data-testid="service-memory">
                RAM: <span className="text-text-primary">{service.current_status.memory_mb.toFixed(0)} MB</span>
              </span>
            )}
            {service.current_status.cpu_percent !== null && (
              <span data-testid="service-cpu">
                CPU: <span className="text-text-primary">{service.current_status.cpu_percent.toFixed(1)}%</span>
              </span>
            )}
          </>
        )}

        {service.current_status?.last_seen && (
          <span data-testid="service-last-seen" className="text-text-muted">
            Last seen: {new Date(service.current_status.last_seen).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
