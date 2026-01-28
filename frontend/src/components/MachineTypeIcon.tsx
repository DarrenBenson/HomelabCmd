import type { ReactElement } from 'react';
import { Server, Monitor } from 'lucide-react';
import { cn } from '../lib/utils';

interface MachineTypeIconProps {
  type: 'server' | 'workstation';
  className?: string;
  title?: string;
}

/**
 * US0091: Icon displaying machine type (Server rack or Monitor)
 *
 * - AC1: Machine type icons - Server icon for servers, Monitor icon for workstations
 * - AC5: Hover tooltip - Full machine type description on hover
 */
export function MachineTypeIcon({ type, className, title }: MachineTypeIconProps): ReactElement {
  const Icon = type === 'workstation' ? Monitor : Server;

  return (
    <span data-testid="machine-type-icon" title={title}>
      <Icon className={cn('h-4 w-4', className)} />
    </span>
  );
}
