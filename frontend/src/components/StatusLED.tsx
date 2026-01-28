/**
 * US0114: Accessible Status Indicators
 *
 * Status indicator using shape + colour + icon for WCAG 2.1 AA compliance.
 * Ensures status is distinguishable without relying solely on colour.
 */

import { cn } from '../lib/utils';
import { Check, X, AlertTriangle, Pause, HelpCircle, Circle } from 'lucide-react';
import type { ServerStatus } from '../types/server';

interface StatusLEDProps {
  status: ServerStatus;
  className?: string;
  /** US0090: When true, offline status shows grey hollow circle */
  isWorkstation?: boolean;
  /** US0109: When true, shows hollow amber circle with pause icon */
  isPaused?: boolean;
  /** US0110: Number of active alerts for warning state */
  activeAlertCount?: number;
  /** Tooltip text to display on hover */
  title?: string;
}

/**
 * Status indicator configuration for each state.
 * Shape + colour + icon ensures accessibility without colour dependency.
 */
interface StatusConfig {
  /** Tailwind classes for the container */
  containerClass: string;
  /** Icon component to render */
  Icon: typeof Check;
  /** Tailwind classes for the icon */
  iconClass: string;
  /** Accessible label for screen readers */
  label: string;
}

/**
 * Get status configuration based on current state.
 * Priority: paused > warning > offline > online > unknown
 */
function getStatusConfig(
  status: ServerStatus,
  isPaused: boolean | undefined,
  hasWarning: boolean,
  isWorkstation: boolean | undefined,
  activeAlertCount: number,
): StatusConfig {
  // Paused: hollow amber circle with pause icon
  if (isPaused) {
    return {
      containerClass: 'border-2 border-amber-500 bg-transparent',
      Icon: Pause,
      iconClass: 'text-amber-500',
      label: 'Server status: paused',
    };
  }

  // Warning: yellow triangle with exclamation (online with alerts)
  if (hasWarning) {
    return {
      containerClass: 'bg-yellow-500 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]',
      Icon: AlertTriangle,
      iconClass: 'text-white mt-0.5',
      label: `Server status: warning - ${activeAlertCount} active alert${activeAlertCount !== 1 ? 's' : ''}`,
    };
  }

  // Offline: red filled circle with X (or grey hollow for workstations)
  if (status === 'offline') {
    if (isWorkstation) {
      return {
        containerClass: 'border-2 border-gray-400 bg-transparent',
        Icon: Circle,
        iconClass: 'text-gray-400',
        label: 'Server status: offline',
      };
    }
    return {
      containerClass: 'bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.4)]',
      Icon: X,
      iconClass: 'text-white',
      label: 'Server status: offline',
    };
  }

  // Online: green filled circle with checkmark
  if (status === 'online') {
    return {
      containerClass: 'bg-green-500 animate-pulse-green',
      Icon: Check,
      iconClass: 'text-white',
      label: 'Server status: online',
    };
  }

  // Unknown: grey filled circle with question mark
  return {
    containerClass: 'bg-gray-400',
    Icon: HelpCircle,
    iconClass: 'text-white',
    label: 'Server status: unknown',
  };
}

export function StatusLED({
  status,
  className,
  isWorkstation,
  isPaused,
  activeAlertCount,
  title,
}: StatusLEDProps) {
  // US0110: Determine if server has active warnings (online with alerts)
  const hasWarning = status === 'online' && !isPaused && (activeAlertCount ?? 0) > 0;

  const config = getStatusConfig(
    status,
    isPaused,
    hasWarning,
    isWorkstation,
    activeAlertCount ?? 0,
  );

  const { containerClass, Icon, iconClass, label } = config;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0',
        containerClass,
        className,
      )}
      aria-label={label}
      role="status"
      title={title}
      data-testid="status-led"
    >
      <Icon
        className={cn('w-3 h-3', iconClass)}
        aria-hidden="true"
        strokeWidth={2.5}
      />
    </span>
  );
}
