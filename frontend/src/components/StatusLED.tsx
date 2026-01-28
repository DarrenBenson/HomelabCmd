import { cn } from '../lib/utils';
import type { ServerStatus } from '../types/server';

interface StatusLEDProps {
  status: ServerStatus;
  className?: string;
  /** US0090: When true, offline status shows grey instead of red */
  isWorkstation?: boolean;
  /** Tooltip text to display on hover */
  title?: string;
}

export function StatusLED({
  status,
  className,
  isWorkstation,
  title,
}: StatusLEDProps) {
  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0',
        {
          'bg-status-success animate-pulse-green': status === 'online',
          'bg-status-error shadow-[0_0_10px_rgba(248,113,113,0.4)]':
            status === 'offline' && !isWorkstation,
          'bg-text-muted':
            status === 'unknown' || (status === 'offline' && isWorkstation),
        },
        className,
      )}
      aria-label={`Server status: ${status}`}
      role="status"
      title={title}
    />
  );
}
