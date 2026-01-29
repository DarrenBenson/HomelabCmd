/**
 * MachineSection component for US0132: Server and Workstation Grouping
 * Enhanced for US0133: Responsive Dashboard Layout
 * Enhanced for US0137: Cross-section drag-and-drop (DndContext lifted to Dashboard)
 *
 * Displays a collapsible section of machine cards with:
 * - Section header with icon, title, and online/offline counts
 * - SortableContext for within-section reordering (uses parent DndContext)
 * - Empty section messaging with discovery link
 * - US0133 AC7: Sticky section headers during scroll
 */

import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronRight, Server, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SortableServerCard } from './SortableServerCard';
import type { Server as ServerType } from '../types/server';
import { cn } from '../lib/utils';

export interface MachineSectionProps {
  title: string;
  type: 'server' | 'workstation';
  machines: ServerType[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onReorder: (newOrder: string[]) => void;
  onCardClick: (server: ServerType) => void;
  onPauseToggle: () => void;
  onMessage: (msg: { type: 'success' | 'info' | 'error'; text: string }) => void;
}

export function MachineSection({
  title,
  type,
  machines,
  collapsed,
  onToggleCollapse,
  onCardClick,
  onPauseToggle,
  onMessage,
}: MachineSectionProps): React.ReactElement {
  // Filter machines for this section
  // Note: machines without machine_type default to 'server' section
  const sectionMachines = machines.filter((m) =>
    type === 'server'
      ? (m.machine_type === 'server' || !m.machine_type)
      : m.machine_type === type
  );
  const online = sectionMachines.filter((m) => m.status === 'online').length;
  const offline = sectionMachines.length - online;

  const Icon = type === 'server' ? Server : Monitor;

  return (
    <section className="mb-8" data-testid={`section-${type}s`}>
      {/* Section Header - Clickable to collapse/expand, US0133 AC7: sticky on scroll */}
      <button
        className="flex items-center gap-2 w-full text-left py-2 group sticky top-0 z-10 bg-bg-primary"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-controls={`section-content-${type}s`}
        data-testid={`section-header-${type}s`}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-text-tertiary transition-transform duration-200',
            !collapsed && 'rotate-90'
          )}
        />
        <Icon className="h-5 w-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary group-hover:text-status-info transition-colors">
          {title}{' '}
          <span className="text-text-tertiary font-normal">
            ({online} online, {offline} offline)
          </span>
        </h2>
      </button>

      {/* Section Content - Collapsible */}
      {!collapsed && (
        <div id={`section-content-${type}s`} className="mt-4">
          {sectionMachines.length > 0 ? (
            /* US0137: SortableContext uses parent DndContext from Dashboard */
            <SortableContext
              items={sectionMachines.map((s) => s.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pl-4">
                {sectionMachines.map((server) => (
                  <SortableServerCard
                    key={server.id}
                    server={server}
                    onClick={() => onCardClick(server)}
                    onPauseToggle={onPauseToggle}
                    onMessage={onMessage}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            /* AC6: Empty section message */
            <div
              className="text-text-tertiary py-8 text-center"
              data-testid={`empty-section-${type}s`}
            >
              No {type}s registered.{' '}
              <Link
                to="/discovery"
                className="text-status-info hover:text-status-info/80 transition-colors"
              >
                Discover devices
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
