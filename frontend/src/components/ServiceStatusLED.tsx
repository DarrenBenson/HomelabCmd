import { cn } from '../lib/utils';
import type { ServiceStatus } from '../types/service';

interface ServiceStatusLEDProps {
  status: ServiceStatus;
  className?: string;
}

/**
 * LED indicator for service status.
 * - running: green with pulse animation
 * - stopped/failed: red with glow
 * - unknown: grey
 */
export function ServiceStatusLED({ status, className }: ServiceStatusLEDProps) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full',
        {
          'bg-status-success animate-pulse-green': status === 'running',
          'bg-status-error shadow-[0_0_10px_rgba(248,113,113,0.4)]':
            status === 'stopped' || status === 'failed',
          'bg-text-muted': status === 'unknown',
        },
        className,
      )}
      aria-label={`Service status: ${status}`}
      role="status"
      data-testid="service-status-led"
    />
  );
}
