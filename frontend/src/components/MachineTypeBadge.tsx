import type { ReactElement } from 'react';
import { cn } from '../lib/utils';

interface MachineTypeBadgeProps {
  type: 'server' | 'workstation';
  title?: string;
}

/**
 * US0091: Badge displaying machine type (Server/Workstation)
 * US0135 AC7: Dark mode support with accessible colours
 *
 * - AC2: Type badges - "Server" or "Workstation" text
 * - AC5: Hover tooltip - Full machine type description on hover
 */
export function MachineTypeBadge({ type, title }: MachineTypeBadgeProps): ReactElement {
  const isWorkstation = type === 'workstation';
  const styles = isWorkstation
    ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'
    : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';

  return (
    <span
      className={cn('text-xs px-2 py-0.5 rounded-full border', styles)}
      title={title}
      data-testid="machine-type-badge"
    >
      {isWorkstation ? 'Workstation' : 'Server'}
    </span>
  );
}
